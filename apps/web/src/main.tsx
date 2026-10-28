import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Landing from "./pages/Landing";

const PlayerPage = lazy(() => import("./player/PlayerPage"));
const DiffPage = lazy(() => import("./player/DiffPage"));

// shortcut: pathname switch, no router; replace with React Router when the API lands (Wk 3).
const path = location.pathname.replace(/\/$/, "");
const page = path === "/play" ? <PlayerPage /> : path === "/diff" ? <DiffPage /> : <Landing />;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<p role="status" className="p-6 font-bold">Loading…</p>}>{page}</Suspense>
  </StrictMode>,
);
