import { StrictMode, Suspense, lazy, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Landing from "./pages/Landing";
import { authClient } from "./lib/auth";

const PlayerPage = lazy(() => import("./player/PlayerPage"));
const DiffPage = lazy(() => import("./player/DiffPage"));
const Login = lazy(() => import("./pages/Login"));

// Sends signed-out visitors to /login. Renders nothing while the session loads.
function RequireSession({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  useEffect(() => {
    if (!isPending && !data) location.replace("/login");
  }, [data, isPending]);
  return isPending || !data ? null : children;
}

// shortcut: pathname switch, no router; replace with React Router when more pages need guards (Wk 3).
const path = location.pathname.replace(/\/$/, "");
const page =
  path === "/play" ? (
    <RequireSession>
      <PlayerPage />
    </RequireSession>
  ) : path === "/diff" ? (
    <DiffPage />
  ) : path === "/login" ? (
    <Login />
  ) : (
    <Landing />
  );

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<p role="status" className="p-6 font-bold">Loading…</p>}>{page}</Suspense>
  </StrictMode>,
);
