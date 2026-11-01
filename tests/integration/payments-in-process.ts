import { vi } from "vitest";
import * as callback from "@/app/api/payments/whish/callback/route";
import * as status from "@/app/api/whish-simulator/payment/collect/status/route";
import * as refund from "@/app/api/whish-simulator/payment/whish/refund/route";
import * as create from "@/app/api/whish-simulator/payment/whish/route";

// In simulator mode the Whish client calls our own site over HTTP, and the simulator calls our callback back. The
// tests run no server, so these requests go straight to the route handlers: the whole loop (create, pay, callback,
// status check, refund) runs for real, inside the test process. Stripe is answered by a small stand-in that
// records every call, since tests never reach the real Stripe.

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

const WHISH_ROUTES: Record<string, Handler> = {
  "/api/whish-simulator/payment/whish": create.POST,
  "/api/whish-simulator/payment/collect/status": status.POST,
  "/api/whish-simulator/payment/whish/refund": refund.POST,
  "/api/payments/whish/callback": callback.GET,
};

interface StripeCall {
  method: string;
  path: string;
  form: URLSearchParams;
  idempotencyKey: string | null;
}

/** What the stand-in Stripe answers. Change it in a test to make Stripe say a checkout is paid, or fail. */
interface FakeStripe {
  calls: StripeCall[];
  /** Checkout sessions the fake has made, and whether each was paid. */
  paid: Map<string, boolean>;
  /** When set, refunds are refused, as in an outage. */
  refundsDown: boolean;
}

/**
 * Every Whish request goes to its route handler and every Stripe request to the stand-in; anything else fails, as
 * with no network. Returns the paths called and the stand-in Stripe.
 */
export function sendPaymentsToTheApp() {
  const whishCalls: string[] = [];
  const stripe: FakeStripe = { calls: [], paid: new Map(), refundsDown: false };
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname === "api.stripe.com") return answerAsStripe(stripe, request, url);
    const handler = WHISH_ROUTES[url.pathname];
    if (!handler) throw new Error(`No network in tests: ${request.url}`);
    whishCalls.push(url.pathname);
    return handler(request, { params: Promise.resolve({}) });
  });
  return { whishCalls, stripe };
}

async function answerAsStripe(stripe: FakeStripe, request: Request, url: URL): Promise<Response> {
  const form = new URLSearchParams(request.method === "GET" ? "" : await request.text());
  const path = url.pathname.replace(/^\/v1/, "");
  stripe.calls.push({
    method: request.method,
    path,
    form,
    idempotencyKey: request.headers.get("idempotency-key"),
  });
  if (request.method === "POST" && path === "/checkout/sessions") {
    const id = `cs_test_${stripe.paid.size + 1}_${form.get("client_reference_id")}`;
    stripe.paid.set(id, false);
    return Response.json({ id, url: `https://checkout.stripe.com/c/${id}` });
  }
  const session = /^\/checkout\/sessions\/(.+)$/.exec(path);
  if (request.method === "GET" && session) {
    const id = decodeURIComponent(session[1]!);
    const paid = stripe.paid.get(id) ?? false;
    return Response.json({
      id,
      payment_status: paid ? "paid" : "unpaid",
      payment_intent: paid ? `pi_${id}` : null,
    });
  }
  if (request.method === "POST" && path === "/refunds") {
    if (stripe.refundsDown) return new Response("Stripe is down", { status: 503 });
    return Response.json({ id: `re_${form.get("payment_intent")}`, status: "succeeded" });
  }
  return new Response("Unknown Stripe call", { status: 404 });
}
