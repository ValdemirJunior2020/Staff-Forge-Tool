// client/src/components/landing/LandingGate.tsx

import { FormEvent, useState } from "react";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { apiPost } from "../../lib/api";
import { createFirebaseSession, trackEvent } from "../../lib/firebase";
import { useSessionStore } from "../../store/sessionStore";

export default function LandingGate() {
  const setSession = useSessionStore((state) => state.setSession);

  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fullName.trim()) {
      setErrorMessage("Please enter your name before opening StaffForge.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const firebaseSessionId = await createFirebaseSession({
        fullName: fullName.trim(),
        tenantKey: "hotelplanner",
        userAgent: navigator.userAgent,
      });

      const apiSession = await apiPost<{ id: string }>("/sessions", {
        full_name: fullName.trim(),
        tenant_key: "hotelplanner",
        user_agent: navigator.userAgent,
      });

      const finalSessionId =
        firebaseSessionId || apiSession?.id || crypto.randomUUID();

      setSession({
        sessionId: finalSessionId,
        fullName: fullName.trim(),
      });

      await trackEvent("staffforge_landing_entered", {
        sessionId: finalSessionId,
        fullName: fullName.trim(),
      });
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Firebase blocked this request. Check your Firestore rules, then try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-slate-950 bg-cover bg-center text-white"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(2,6,23,0.92), rgba(2,6,23,0.58)), url('/bg.png')",
      }}
    >
      <section className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <img
            src="/logo.png"
            alt="StaffForge logo"
            className="mb-8 h-28 w-auto drop-shadow-2xl"
          />

          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-blue-100 backdrop-blur">
            <Sparkles size={16} />
            Workforce Intelligence Platform
          </div>

          <h1 className="text-5xl font-black leading-tight md:text-7xl">
            StaffForge turns BPO chaos into executive clarity.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Unify agents, utilization, headcount gaps, vendor scorecards, audit
            logs, and AI recommendations in one command center.
          </p>

          <div className="mt-8 grid max-w-2xl gap-4 sm:grid-cols-3">
            {["Multi-vendor ready", "AI-native", "Audit-first"].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"
              >
                <ShieldCheck className="mb-3 text-blue-200" />
                <b>{item}</b>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={submit}
          className="rounded-4xl border border-white/15 bg-white/95 p-8 text-slate-950 shadow-2xl"
        >
          <div className="mb-6 text-center">
            <img
              src="/logo.png"
              alt="StaffForge logo"
              className="mx-auto mb-5 h-24 w-auto"
            />

            <h2 className="text-2xl font-black">Enter StaffForge</h2>

            <p className="text-sm text-slate-500">
              Enter your name, then click ENTER.
            </p>
          </div>

          <label className="mb-4 block">
            <span className="text-sm font-bold">Full Name</span>

            <input
              required
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Example: Valdemir Junior"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600"
            />
          </label>

          {errorMessage && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-yellow-400 px-6 py-4 text-lg font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-yellow-500/30 transition hover:scale-[1.02] hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Opening..." : "ENTER"}
            <ArrowRight size={22} />
          </button>
        </form>
      </section>
    </main>
  );
}