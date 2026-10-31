import { vi } from "vitest";
import * as callback from "@/app/api/payments/whish/callback/route";
import * as status from "@/app/api/whish-simulator/payment/collect/status/route";
import * as create from "@/app/api/whish-simulator/payment/whish/route";

// In simulator mode the Whish client calls our own site over HTTP, and the simulator calls our callback back. The
// tests run no server, so this sends those requests straight to the route handlers: the whole loop (create, pay,
// callback, status check) runs for real, inside the test process.

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

const ROUTES: Record<string, Handler> = {
  "/api/whish-simulator/payment/whish": create.POST,
  "/api/whish-simulator/payment/collect/status": status.POST,
  "/api/payments/whish/callback": callback.GET,
};

/** Every request to one of the routes above goes to its handler; anything else fails, as with no network. */
export function sendWhishToTheApp() {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const handler = ROUTES[new URL(request.url).pathname];
    if (!handler) throw new Error(`No network in tests: ${request.url}`);
    calls.push(new URL(request.url).pathname);
    return handler(request, { params: Promise.resolve({}) });
  });
  return calls;
}
