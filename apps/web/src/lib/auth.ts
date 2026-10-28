import { createAuthClient } from "better-auth/react";

// Same origin as the page: Better Auth defaults to /api/auth, proxied to the API in dev.
export const authClient = createAuthClient();
