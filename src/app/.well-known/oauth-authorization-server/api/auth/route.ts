import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/server/auth/better-auth";

/** RFC 8414: where AI apps register, authorize and get tokens. Served at the root and under the issuer's path. */
export const GET = oauthProviderAuthServerMetadata(auth);
