import { StrictMode, Suspense, lazy, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Landing from "./pages/Landing";
import { authClient } from "./lib/auth";
import { blip } from "./lib/sound";
import Loader from "./components/Loader";
import SoundToggle from "./components/SoundToggle";

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

// The player has its own audio, so button sounds and the toggle stay off there.
const quiet = path.startsWith("/play") || path.startsWith("/diff");

// One listener for every button, so pages need no changes.
document.addEventListener("click", (e) => {
  if (quiet) return;
  const el = (e.target as Element | null)?.closest("button, a.btn, .pill");
  if (el) blip(el.matches("a.btn, button[type=submit]") ? 520 : 380);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><Loader label="Loading your quest" /></div>}>{page}</Suspense>
    {!quiet && <SoundToggle />}
  </StrictMode>,
);
