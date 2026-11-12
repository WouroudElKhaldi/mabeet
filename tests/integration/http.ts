import { auth } from "@/server/auth/better-auth";
import { prisma, testEmail } from "./helpers";

type RouteHandler = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

export interface Caller {
  userId: string;
  email: string;
  cookie: string;
}

export const TEST_PASSWORD = "correct-horse-battery";

const sessionCookie = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");

/**
 * Signs up a real user through Better Auth, confirms their email (as opening the emailed link does; no session
 * starts before that), signs them in and returns their session cookie.
 */
export async function signUp(name: string): Promise<Caller> {
  const email = testEmail();
  const signedUp = await auth.api.signUpEmail({
    body: { name, email, password: TEST_PASSWORD },
    asResponse: true,
  });
  const { user, token } = (await signedUp.json()) as { user: { id: string }; token: string | null };
  if (token !== null) throw new Error("A new account was signed in before confirming its email");
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  const signedIn = await auth.api.signInEmail({
    body: { email, password: TEST_PASSWORD },
    asResponse: true,
  });
  return { userId: user.id, email, cookie: sessionCookie(signedIn) };
}

export interface CallOptions {
  as?: Caller;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  params?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
}

/** Invokes a Next.js route handler the way the framework would. */
export async function call(
  handler: RouteHandler,
  { as, method, params = {}, body, query }: CallOptions = {},
) {
  const url = new URL("http://localhost/api/test");
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  const request = new Request(url, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: { "content-type": "application/json", ...(as && { cookie: as.cookie }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handler(request, { params: Promise.resolve(params) });
  return { status: response.status, body: (await response.json()) as unknown };
}
