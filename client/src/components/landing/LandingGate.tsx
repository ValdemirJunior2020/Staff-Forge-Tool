// client/src/components/landing/LandingGate.tsx

import { FormEvent, useState } from "react";
import { ArrowRight, Building2, ShieldCheck, Sparkles } from "lucide-react";
import { apiPost } from "../../lib/api";
import { createFirebaseSession, trackEvent } from "../../lib/firebase";
import { useSessionStore } from "../../store/sessionStore";

export default function LandingGate() {
  const setSession = useSessionStore((state) => state.setSession);

  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const firebaseSessionId = await createFirebaseSession({
        fullName,
        tenantKey: "hotelplanner",
        userAgent: navigator.userAgent,
      });

      const apiSession = await apiPost<{ id: string }>("/sessions", {
        full_name: fullName,
        tenant_key: "hotelplanner",
        user_agent: navigator.userAgent,
      });

      const finalSessionId =
        firebaseSessionId || apiSession?.id || crypto.randomUUID();

      setSession({
        sessionId: finalSessionId,
        fullName,
      });

      await trackEvent("staffforge_landing_entered", {
        sessionId: finalSessionId,
        fullName,
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
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#2563eb55,transparent_30%),radial-gradient(circle_at_bottom_right,#14b8a655,transparent_25%)]" />

      <section className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-blue-100">
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
                className="rounded-2xl border border-white/10 bg-white/10 p-4"
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
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-blue-600 p-3 text-white">
              <Building2 />
            </div>

            <div>
              <h2 className="text-2xl font-black">Enter StaffForge</h2>
              <p className="text-sm text-slate-500">
                Enter your name to open the command center.
              </p>
            </div>
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
            className="sf-button sf-primary w-full py-4 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Opening Command Center..." : "Launch Command Center"}
            <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}