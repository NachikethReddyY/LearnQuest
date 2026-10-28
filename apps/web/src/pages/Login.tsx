import { useState, type FormEvent } from "react";
import { authClient } from "../lib/auth";

const field = "w-full rounded-xl border-[3px] border-ink bg-white px-4 py-3 font-semibold outline-none focus:bg-sun/30";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: "in" | "up") {
    setBusy(true);
    setError(null);
    const name = email.split("@")[0] || "Learner";
    const result =
      action === "in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name });
    setBusy(false);
    if (result.error) setError(result.error.message ?? "Something went wrong. Try again.");
    else location.assign("/play");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run("in");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
      <form onSubmit={onSubmit} className="chunk w-full space-y-5 bg-white p-8">
        <h1 className="font-display text-4xl font-black tracking-tight">
          Learn<span className="text-blue">Quest</span>
        </h1>

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-extrabold">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-extrabold">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-pink px-3 py-2 text-sm font-bold">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="btn text-lg disabled:opacity-60">
            Sign in
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run("up")}
            className="pill bg-lilac px-6 py-3 text-sm disabled:opacity-60"
          >
            Create account
          </button>
        </div>
      </form>
    </main>
  );
}
