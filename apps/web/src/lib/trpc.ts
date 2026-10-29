import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
// Type-only: no server code reaches the bundle.
import type { AppRouter } from "@learnquest/api/router";

// Same-origin; /api is proxied to the API in dev and preview.
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
    }),
  ],
});

export type RouterOutputs = inferRouterOutputs<AppRouter>;

export const isNotFound = (e: unknown) => e instanceof TRPCClientError && e.data?.code === "NOT_FOUND";
export const trpcCode = (e: unknown) => (e instanceof TRPCClientError ? (e.data?.code as string | undefined) : undefined);
