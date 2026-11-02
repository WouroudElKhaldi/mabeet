import { AwsClient } from "aws4fetch";
import { env } from "@/server/env";

// Cloudflare R2 through its S3-compatible API. Photos go to the public bucket and are served by Cloudflare from
// R2_PUBLIC_URL, so they never pass through this server. Without the R2 settings, uploads stay in Postgres.

function client(): AwsClient | null {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) return null;
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
}

/** Whether the photo bucket is set up. When it isn't, uploads stay in Postgres. */
export function r2Enabled(): boolean {
  return client() !== null && Boolean(env.R2_PUBLIC_BUCKET) && Boolean(env.R2_PUBLIC_URL);
}

function objectUrl(key: string): string {
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_PUBLIC_BUCKET}/${key}`;
}

function requireClient(): AwsClient {
  const r2 = client();
  if (!r2) throw new Error("R2 is not configured");
  return r2;
}

export async function putObject(
  key: string,
  body: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<void> {
  const response = await requireClient().fetch(objectUrl(key), {
    method: "PUT",
    body,
    headers: {
      "content-type": contentType,
      // Every upload has its own key, so what is behind a key never changes.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
  if (!response.ok) throw new Error(`R2 upload failed: ${response.status} ${await response.text()}`);
}

/** Removes an object: only to undo an upload whose row could not be saved (deleted photos keep their files). */
export async function deleteObject(key: string): Promise<void> {
  const response = await requireClient().fetch(objectUrl(key), { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(`R2 delete failed: ${response.status}`);
}

/** Where a public object is served from. */
export function publicUrl(key: string): string {
  return `${env.R2_PUBLIC_URL?.replace(/\/$/, "")}/${key}`;
}
