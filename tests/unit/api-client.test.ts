import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, errorMessage, formFailure, isAborted, queryUrl } from "@/lib/api-client";

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

  it("delete sends a JSON body when given one", async () => {
    const fetchMock = serverAnswers(answer({}));
    await api.delete("/api/me/push", { endpoint: "https://fcm.googleapis.com/x" });
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ endpoint: "https://fcm.googleapis.com/x" }),
    );
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

// ---- Cancelling and time limits -------------------------------------------------------------------------------

// A server that never answers, but stops waiting when the browser cancels, as a real `fetch` does.
function quietServer() {
  const fetchMock = vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function outcomeOf(call: Promise<unknown>) {
  const outcome: { state: "pending" | "done" | "failed"; error?: unknown } = { state: "pending" };
  call.then(
    () => (outcome.state = "done"),
    (error: unknown) => {
      outcome.state = "failed";
      outcome.error = error;
    },
  );
  return outcome;
}

describe("cancelling a call", () => {
  afterEach(() => vi.useRealTimers());

  it("fails with ABORTED when the caller cancels, which is not a problem to show", async () => {
    quietServer();
    const controller = new AbortController();
    const call = api.get("/api/x", undefined, { signal: controller.signal }).catch((error: unknown) => error);
    controller.abort();
    const caught = await call;
    expect(caught).toMatchObject({ status: 0, code: "ABORTED" });
    expect(isAborted(caught)).toBe(true);
    expect(errorMessage(caught, "fallback")).toBe("fallback");
  });

  it("does not even send a call that was cancelled before it started", async () => {
    const fetchMock = quietServer();
    const controller = new AbortController();
    controller.abort();
    const caught = await api
      .post("/api/x", { a: 1 }, { signal: controller.signal })
      .catch((error: unknown) => error);
    expect(isAborted(caught)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("really stops the request in the browser, and it follows the caller's signal", async () => {
    const fetchMock = quietServer();
    const controller = new AbortController();
    const call = api.get("/api/x", undefined, { signal: controller.signal }).catch(() => undefined);
    const sent = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(sent?.aborted).toBe(false);
    controller.abort();
    await call;
    expect(sent?.aborted).toBe(true);
  });

  it("does nothing when a call that already finished is cancelled afterwards", async () => {
    serverAnswers(answer({ ok: true }));
    const controller = new AbortController();
    await expect(api.get("/api/x", undefined, { signal: controller.signal })).resolves.toEqual({ ok: true });
    expect(() => controller.abort()).not.toThrow();
  });

  it("is told apart from a server failure and from a lost connection", async () => {
    serverAnswers(answer({ error: { code: "CONFLICT", message: "Taken" } }, { status: 409 }));
    expect(isAborted(await api.get("/api/x").catch((error: unknown) => error))).toBe(false);
    serverAnswers(new TypeError("Failed to fetch"));
    expect(isAborted(await api.get("/api/x").catch((error: unknown) => error))).toBe(false);
    expect(isAborted(new Error("other"))).toBe(false);
  });
});

describe("the time limit", () => {
  afterEach(() => vi.useRealTimers());

  it("gives up after 30 seconds, with TIMEOUT, so a spinner never turns for ever", async () => {
    vi.useFakeTimers();
    quietServer();
    const outcome = outcomeOf(api.get("/api/x"));
    await vi.advanceTimersByTimeAsync(29_999);
    expect(outcome.state).toBe("pending");
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome.state).toBe("failed");
    expect(outcome.error).toMatchObject({ status: 0, code: "TIMEOUT" });
  });

  it("shows the translated fallback for a timeout, not our English sentence", () => {
    expect(errorMessage(new ApiError(0, "TIMEOUT", "The server took too long to answer"), "fallback")).toBe(
      "fallback",
    );
    expect(formFailure(new ApiError(0, "TIMEOUT", "x"), "fallback")).toEqual({
      error: "fallback",
      fieldErrors: {},
    });
  });

  it("takes the caller's limit instead", async () => {
    vi.useFakeTimers();
    quietServer();
    const outcome = outcomeOf(api.get("/api/x", undefined, { timeoutMs: 1_000 }));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(outcome.error).toMatchObject({ code: "TIMEOUT" });
  });

  it("lets an upload wait longer, 2 minutes", async () => {
    vi.useFakeTimers();
    quietServer();
    const outcome = outcomeOf(api.upload("/api/photos", new FormData()));
    await vi.advanceTimersByTimeAsync(119_999);
    expect(outcome.state).toBe("pending");
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome.error).toMatchObject({ code: "TIMEOUT" });
  });

  it("calls a caller's cancel a cancel, even when the limit is also near", async () => {
    vi.useFakeTimers();
    quietServer();
    const controller = new AbortController();
    const outcome = outcomeOf(api.get("/api/x", undefined, { signal: controller.signal, timeoutMs: 1_000 }));
    controller.abort();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(outcome.error).toMatchObject({ code: "ABORTED" });
  });

  it.each([
    ["answers", () => serverAnswers(answer({ ok: true }))],
    [
      "refuses",
      () => serverAnswers(answer({ error: { code: "CONFLICT", message: "Taken" } }, { status: 409 })),
    ],
    ["loses the connection", () => serverAnswers(new TypeError("Failed to fetch"))],
  ])("leaves no timer running when the server %s", async (_name, setUp) => {
    vi.useFakeTimers();
    setUp();
    await api.get("/api/x").catch(() => undefined);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves no timer running when the call is cancelled", async () => {
    vi.useFakeTimers();
    quietServer();
    const controller = new AbortController();
    const call = api.get("/api/x", undefined, { signal: controller.signal }).catch(() => undefined);
    controller.abort();
    await call;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("queryUrl", () => {
  it("leaves out empty values and keeps a query the address already has", () => {
    expect(queryUrl("/api/x", { a: 1, b: undefined, c: null, d: "ü b" })).toBe("/api/x?a=1&d=%C3%BC+b");
    expect(queryUrl("/api/x?sort=price", { page: 2 })).toBe("/api/x?sort=price&page=2");
    expect(queryUrl("/api/x")).toBe("/api/x");
  });
});
