import { useCallback, useEffect, useState } from "react";

// Same-origin JSON helper; /api is proxied to the API in dev and preview.
export async function api<T = void>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method,
    credentials: "include",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw Object.assign(new Error(`${res.status} ${path}`), { status: res.status });
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export type ApiState<T> = { data?: T; error?: { status?: number }; loading: boolean; reload: () => void };

export function useApi<T>(path: string): ApiState<T> {
  const [state, setState] = useState<{ path: string; data?: T; error?: { status?: number } }>({ path: "" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api<T>(path).then(
      (data) => live && setState({ path, data }),
      (error) => live && setState({ path, error }),
    );
    return () => {
      live = false;
    };
  }, [path, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: state.data, error: state.error, loading: state.path !== path, reload };
}

export const enroll = (slug: string) => api(`/api/paths/${slug}/enroll`, { method: "POST" });

export type CourseProgress = { slug: string; title: string; lessonsDone: number; lessonsTotal: number };
export type PathCardData = { slug: string; title: string; tagline: string; origin: "official" | "community" | "ai"; courseCount: number; learners: number };
export type HomeData = {
  stats: { xp: number; todayXp: number; dailyGoalXp: number; streak: number; week: { day: string; solved: number }[] };
  continue: {
    path: { slug: string; title: string };
    course: { slug: string; title: string; index: number; count: number };
    lesson: { slug: string; title: string; level: number; done: number; total: number };
  } | null;
  paths: (Omit<PathCardData, "courseCount" | "learners"> & { courses: CourseProgress[] })[];
  official: PathCardData[];
  community: PathCardData[];
};
export type CourseData = {
  slug: string; title: string; description: string; origin: string;
  lessons: { slug: string; title: string; level: number; done: number; total: number }[];
};
export type ExplorePath = PathCardData & { enrolled: boolean; courses: { slug: string; title: string }[] };
