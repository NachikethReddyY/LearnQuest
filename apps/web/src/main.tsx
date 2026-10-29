import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { Outlet, RouterProvider, createRootRoute, createRoute, createRouter, redirect, useRouterState } from "@tanstack/react-router";
import "./index.css";
import Landing from "./pages/Landing";
import { authClient } from "./lib/auth";
import { blip } from "./lib/sound";
import Loader from "./components/Loader";
import SoundToggle from "./components/SoundToggle";

const PlayerPage = lazy(() => import("./player/PlayerPage"));
const DiffPage = lazy(() => import("./player/DiffPage"));
const Login = lazy(() => import("./pages/Login"));
const Home = lazy(() => import("./pages/Home"));
const Course = lazy(() => import("./pages/Course"));

// The player has its own audio, so button sounds and the toggle stay off there.
const isQuiet = (p: string) => p.startsWith("/play") || p.startsWith("/diff");

function Root() {
  const quiet = isQuiet(useRouterState({ select: (s) => s.location.pathname }));
  return (
    <>
      <Suspense fallback={<div className="grid min-h-screen place-items-center"><Loader label="Loading your quest" /></div>}>
        <Outlet />
      </Suspense>
      {!quiet && <SoundToggle />}
    </>
  );
}

// Sends signed-out visitors to /login before the route renders.
async function requireSession() {
  const { data } = await authClient.getSession();
  if (!data) throw redirect({ to: "/login" });
}

function Index(): React.ReactElement | null {
  const { data, isPending } = authClient.useSession();
  return isPending ? null : data ? <Home /> : <Landing />;
}

const root = createRootRoute({ component: Root });
const r = { getParentRoute: () => root };
const routeTree = root.addChildren([
  createRoute({ ...r, path: "/", component: Index }),
  createRoute({ ...r, path: "/login", component: () => <Login /> }),
  createRoute({
    ...r,
    path: "/play",
    component: () => <PlayerPage />,
    beforeLoad: requireSession,
    validateSearch: (s: Record<string, unknown>): { lesson?: string } => ({ lesson: typeof s.lesson === "string" ? s.lesson : undefined }),
  }),
  createRoute({ ...r, path: "/diff", component: () => <DiffPage /> }),
  createRoute({ ...r, path: "/courses/$slug", component: () => <Course />, beforeLoad: requireSession }),
]);

const router = createRouter({ routeTree });
declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}

// One listener for every button, so pages need no changes.
document.addEventListener("click", (e) => {
  if (isQuiet(location.pathname)) return;
  const el = (e.target as Element | null)?.closest("button, a.btn, .pill");
  if (el) blip(el.matches("a.btn, button[type=submit]") ? 520 : 380);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
