import sharp from "sharp";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as imageRoute from "@/app/api/images/[imageId]/route";
import * as photoItem from "@/app/api/workspaces/[businessId]/photos/[photoId]/route";
import * as photoUpload from "@/app/api/workspaces/[businessId]/photos/route";
import { env } from "@/server/env";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";
import { addRoom, createPlace, prisma } from "@tests/integration/helpers";
import { type Caller, call, signUp } from "@tests/integration/http";
import { listGallery } from "../server";
import * as repository from "../server/photo-repository";

// The host's photos on the real database: every upload is checked by its bytes and shrunk to WebP, the galleries are
// the place's and each room's, and with R2 an upload whose rows cannot be saved is taken back down (all or nothing).

let landscape: Uint8Array;

beforeAll(async () => {
  landscape = new Uint8Array(
    await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#7a9e7e" } })
      .png()
      .toBuffer(),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetMemoryRateLimits();
});

async function memberAs(businessId: string, roleName: "Owner" | "Housekeeping"): Promise<Caller> {
  const member = await signUp(roleName);
  const role = await prisma.role.findFirstOrThrow({
    where: { businessId, ...(roleName === "Owner" ? { isOwner: true } : { name: roleName }) },
  });
  await prisma.membership.create({ data: { userId: member.userId, businessId, roleId: role.id } });
  return member;
}

/** Posts a photo the way the photos screen does: multipart, with the member's session. */
async function upload(
  as: Caller,
  businessId: string,
  bytes: Uint8Array,
  fields: Record<string, string> = {},
) {
  const form = new FormData();
  form.set("file", new Blob([Buffer.from(bytes)]), "photo.png");
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  const request = new Request("http://localhost/api/test", {
    method: "POST",
    headers: { cookie: as.cookie },
    body: form,
  });
  const response = await photoUpload.POST(request, { params: Promise.resolve({ businessId }) });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function served(url: string) {
  const imageId = url.split("/").pop() ?? "";
  return imageRoute.GET(new Request(`http://localhost${url}`), { params: Promise.resolve({ imageId }) });
}

describe("uploading photos", () => {
  it("stores the place's photo as WebP at most 1600 px, and serves it", async () => {
    const place = await createPlace();
    const owner = await memberAs(place.business.id, "Owner");
    const added = await upload(owner, place.business.id, landscape, { alt: "The terrace", area: "TERRACE" });
    expect(added).toMatchObject({ status: 201, body: { alt: "The terrace", area: "TERRACE" } });
    expect(String(added.body.url)).toMatch(/^\/api\/images\//);

    const response = await served(String(added.body.url));
    expect(response.headers.get("content-type")).toBe("image/webp");
    const { width, height, format } = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    expect({ width, height, format }).toEqual({ width: 1600, height: 800, format: "webp" });
    expect(
      await prisma.auditLog.count({ where: { entityId: String(added.body.id), action: "photo.added" } }),
    ).toBe(1);
  });

  it("puts a room's photo in that room's gallery, and refuses another place's room", async () => {
    const place = await createPlace();
    const other = await createPlace();
    const owner = await memberAs(place.business.id, "Owner");
    const room = await addRoom(place.business.id);
    const otherRoom = await addRoom(other.business.id);

    expect((await upload(owner, place.business.id, landscape, { roomId: room.id })).status).toBe(201);
    expect(await prisma.photo.count({ where: { roomId: room.id } })).toBe(1);
    expect((await upload(owner, place.business.id, landscape, { roomId: otherRoom.id })).status).toBe(404);
  });

  it("refuses a file that is not a photo, one too big, and a member without rooms.manage", async () => {
    const place = await createPlace();
    const owner = await memberAs(place.business.id, "Owner");
    const housekeeping = await memberAs(place.business.id, "Housekeeping");
    const renamed = new TextEncoder().encode("not a photo at all, only text named photo.png");
    expect(await upload(owner, place.business.id, renamed)).toMatchObject({ status: 400 });

    const tooBig = new Uint8Array(2_600_000);
    tooBig.set(landscape.subarray(0, 8));
    expect(await upload(owner, place.business.id, tooBig)).toMatchObject({ status: 400 });
    expect((await upload(housekeeping, place.business.id, landscape)).status).toBe(403);
    expect(await prisma.photo.count({ where: { businessId: place.business.id } })).toBe(0);
  });
});

describe("arranging photos", () => {
  it("makes a photo the cover, tags it, and deletes one so its file is no longer served", async () => {
    const place = await createPlace();
    const owner = await memberAs(place.business.id, "Owner");
    const businessId = place.business.id;
    const first = await upload(owner, businessId, landscape);
    const second = await upload(owner, businessId, landscape);
    const photoId = String(second.body.id);

    const change = (id: string, body: unknown) =>
      call(photoItem.PATCH, { as: owner, method: "PATCH", params: { businessId, photoId: id }, body });
    expect(await change(photoId, { cover: true })).toEqual({ status: 200, body: { ok: true } });
    expect(await change(photoId, { area: "VIEW", alt: "Sunset over the valley" })).toMatchObject({
      status: 200,
    });
    const gallery = await listGallery(place.ctx, null);
    expect(gallery.map((photo) => photo.id)).toEqual([photoId, String(first.body.id)]);
    expect(gallery[0]).toMatchObject({ area: "VIEW", alt: "Sunset over the valley" });

    expect(
      await call(photoItem.DELETE, { as: owner, method: "DELETE", params: { businessId, photoId } }),
    ).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect((await served(String(second.body.url))).status).toBe(404);
    expect((await change(photoId, { cover: true })).status).toBe(404);
  });
});

describe("photos in R2", () => {
  const settings = {
    R2_ACCOUNT_ID: "account",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_PUBLIC_BUCKET: "mabeet-photos",
    R2_PUBLIC_URL: "https://photos.example.test",
  };

  async function withR2(run: (requests: Array<{ method: string; url: string }>) => Promise<void>) {
    const saved = Object.fromEntries(
      Object.keys(settings).map((key) => [key, env[key as keyof typeof settings]]),
    );
    Object.assign(env, settings);
    const requests: Array<{ method: string; url: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        requests.push({ method: request.method, url: request.url });
        return new Response(null, { status: 200 });
      }),
    );
    try {
      await run(requests);
    } finally {
      Object.assign(env, saved);
    }
  }

  it("uploads the file to the public bucket, and the image address sends the caller there", async () => {
    await withR2(async (requests) => {
      const place = await createPlace();
      const owner = await memberAs(place.business.id, "Owner");
      const added = await upload(owner, place.business.id, landscape);
      expect(added.status).toBe(201);
      expect(String(added.body.url)).toMatch(/^https:\/\/photos\.example\.test\/photos\//);
      expect(requests.filter((request) => request.method === "PUT")).toHaveLength(1);
    });
  });

  it("takes the upload back down when its rows cannot be saved, and leaves nothing behind", async () => {
    await withR2(async (requests) => {
      const place = await createPlace();
      const owner = await memberAs(place.business.id, "Owner");
      vi.spyOn(repository, "addUploadedPhoto").mockRejectedValueOnce(new Error("the database went away"));

      expect((await upload(owner, place.business.id, landscape)).status).toBe(500);
      const put = requests.find((request) => request.method === "PUT");
      const removed = requests.find((request) => request.method === "DELETE");
      expect(put).toBeDefined();
      expect(removed?.url).toBe(put?.url);
      expect(await prisma.photo.count({ where: { businessId: place.business.id } })).toBe(0);
      expect(await prisma.storedImage.count({ where: { businessId: place.business.id } })).toBe(0);
    });
  });
});
