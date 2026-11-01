import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, errorMessage, formFailure } from "@/lib/api-client";

// `fetch` is replaced by a pretend server, so each answer the real routes can give (see `route` in
// src/server/http/route.ts) is checked without a network.

function answer(body: unknown, init: ResponseInit = {}) {
  const text = body === undefined || typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text as string | undefined, init);
}

function serverAnswers(response: Response | Error) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response.clone();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("api calls that work", () => {
  it("get reads the JSON answer, and puts the query in the address without empty values", async () => {
    const fetchMock = serverAnswers(answer({ places: [] }));
    const result = await api.get("/api/places", {
      q: "chouf",
      page: 2,
      empty: undefined,
      none: null,
      open: false,
    });
    expect(result).toEqual({ places: [] });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/places?q=chouf&page=2&open=false");
  });

  it("adds to a query the address already has", async () => {
    const fetchMock = serverAnswers(answer({}));
    await api.get("/api/places?sort=price", { page: 3 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/places?sort=price&page=3");
  });

  it("post sends the body as JSON and says so", async () => {
    const fetchMock = serverAnswers(answer({ id: "b1" }, { status: 201 }));
    expect(await api.post("/api/bookings", { nights: 2 })).toEqual({ id: "b1" });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"nights":2}');
    expect(init?.headers).toMatchObject({ "content-type": "application/json", accept: "application/json" });
  });

  it("patch, put and delete use their own method; a call without a body sends none", async () => {
    const fetchMock = serverAnswers(answer({}));
    await api.patch("/api/x", { a: 1 });
    await api.put("/api/x", { a: 1 });
    await api.delete("/api/x");
    expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual(["PATCH", "PUT", "DELETE"]);
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBeUndefined();
  });

  it("gives nothing back for an answer with no content", async () => {
    serverAnswers(answer(undefined, { status: 204 }));
    expect(await api.delete("/api/x")).toBeUndefined();
  });

  it("upload sends the form as it is, leaving the content type to the browser", async () => {
    const fetchMock = serverAnswers(answer({ id: "p1" }));
    const form = new FormData();
    form.set("photo", "x");
    await api.upload("/api/photos", form);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBe(form);
    expect(init?.headers).not.toHaveProperty("content-type");
  });
});

describe("api calls that fail", () => {
  it("throws an ApiError with what the server said", async () => {
    serverAnswers(
      answer(
        { error: { code: "CONFLICT", message: "Those dates were just taken", details: { room: "r1" } } },
        { status: 409 },
      ),
    );
    const caught = await api.post("/api/bookings", {}).catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({
      status: 409,
      code: "CONFLICT",
      message: "Those dates were just taken",
      details: { room: "r1" },
    });
  });

  it("lists the first problem of each wrong field after a failed input check", async () => {
    const details = {
      formErrors: [],
      fieldErrors: { phone: ["Use an international number", "Too short"], name: [] },
    };
    serverAnswers(
      answer({ error: { code: "VALIDATION", message: "Invalid input", details } }, { status: 400 }),
    );
    const caught = (await api.post("/api/bookings", {}).catch((error: unknown) => error)) as ApiError;
    expect(caught.fieldErrors).toEqual({ phone: "Use an international number" });
  });

  it("has no field errors when the failure was about something else", async () => {
    serverAnswers(answer({ error: { code: "FORBIDDEN", message: "No" } }, { status: 403 }));
    const caught = (await api.get("/api/x").catch((error: unknown) => error)) as ApiError;
    expect(caught.fieldErrors).toEqual({});
  });

  it("tells a rate-limited caller how long to wait", async () => {
    serverAnswers(
      answer(
        { error: { code: "RATE_LIMITED", message: "Slow down" } },
        { status: 429, headers: { "retry-after": "30" } },
      ),
    );
    const caught = (await api.get("/api/x").catch((error: unknown) => error)) as ApiError;
    expect(caught).toMatchObject({ status: 429, code: "RATE_LIMITED", retryAfterSeconds: 30 });
  });

  it("survives an answer that is not our JSON, such as a gateway's error page", async () => {
    serverAnswers(answer("<html>Bad gateway</html>", { status: 502, statusText: "Bad Gateway" }));
    const caught = (await api.get("/api/x").catch((error: unknown) => error)) as ApiError;
    expect(caught).toMatchObject({ status: 502, code: "UNKNOWN", message: "Bad Gateway" });
  });

  it("reports a lost connection as status 0", async () => {
    serverAnswers(new TypeError("Failed to fetch"));
    const caught = (await api.get("/api/x").catch((error: unknown) => error)) as ApiError;
    expect(caught).toMatchObject({ status: 0, code: "NETWORK" });
  });
});

describe("errorMessage", () => {
  const fallback = "Something went wrong. Please try again.";

  it("shows what the server said when a person can act on it", () => {
    expect(errorMessage(new ApiError(409, "CONFLICT", "Those dates were just taken"), fallback)).toBe(
      "Those dates were just taken",
    );
  });

  it("shows the translated fallback for a crash, a lost connection, an unreadable answer or anything else", () => {
    expect(errorMessage(new ApiError(500, "INTERNAL", "Something went wrong"), fallback)).toBe(fallback);
    expect(errorMessage(new ApiError(0, "NETWORK", "The server could not be reached"), fallback)).toBe(
      fallback,
    );
    expect(errorMessage(new ApiError(502, "UNKNOWN", "Bad Gateway"), fallback)).toBe(fallback);
    expect(errorMessage(new TypeError("x is undefined"), fallback)).toBe(fallback);
    expect(errorMessage("a string", fallback)).toBe(fallback);
  });
});

describe("formFailure", () => {
  const fallback = "Something went wrong. Please try again.";

  it("gives a message under each wrong field, and none for the whole form", () => {
    const details = { formErrors: [], fieldErrors: { phone: ["Use an international number"] } };
    const caught = new ApiError(400, "VALIDATION", "Invalid input", details);
    expect(formFailure(caught, fallback)).toEqual({
      error: null,
      fieldErrors: { phone: "Use an international number" },
    });
  });

  it("gives one message for the whole form when no field is named", () => {
    expect(formFailure(new ApiError(409, "CONFLICT", "Those dates were just taken"), fallback)).toEqual({
      error: "Those dates were just taken",
      fieldErrors: {},
    });
    expect(formFailure(new ApiError(500, "INTERNAL", "Something went wrong"), fallback)).toEqual({
      error: fallback,
      fieldErrors: {},
    });
  });

  it("keeps a specific input message that is about the whole request, not a field", () => {
    const caught = new ApiError(400, "VALIDATION", "Type your email exactly to confirm", {
      formErrors: ["x"],
      fieldErrors: {},
    });
    expect(formFailure(caught, fallback).error).toBe("Type your email exactly to confirm");
  });
});
