import { useCallback, useEffect, useState } from "react";
import type { RouterOutputs } from "./trpc";

export type HomeData = RouterOutputs["home"]["get"];
export type PathCardData = HomeData["official"][number];
export type CourseProgress = HomeData["paths"][number]["courses"][number];
export type CourseData = RouterOutputs["courses"]["get"];
export type ExplorePath = RouterOutputs["paths"]["list"][number];

export type ApiState<T> = { data?: T; error?: unknown; loading: boolean; reload: () => void };

// Runs a typed tRPC query whenever `key` changes; `reload` runs it again.
export function useApi<T>(key: string, run: () => Promise<T>): ApiState<T> {
  const [state, setState] = useState<{ key: string; tick: number; data?: T; error?: unknown }>({ key: "", tick: -1 });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    run().then(
      (data) => live && setState({ key, tick, data }),
      (error) => live && setState({ key, tick, error }),
    );
    return () => {
      live = false;
    };
    // `run` closes over the inputs that `key` encodes.
  }, [key, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  // Data stays on screen during a reload; an error only counts for the request that produced it.
  const fresh = state.key === key && state.tick === tick;
  return { data: state.data, error: fresh ? state.error : undefined, loading: !fresh, reload };
}
