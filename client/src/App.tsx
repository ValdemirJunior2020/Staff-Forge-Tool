// client/src/App.tsx

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import Sidebar from "./components/layout/Sidebar";
import LandingGate from "./components/landing/LandingGate";
import Dashboard from "./pages/Dashboard";
import AgentsPage from "./pages/AgentsPage";
import IntelligencePage from "./pages/IntelligencePage";
import AiPage from "./pages/AiPage";
import ForecastingPage from "./pages/ForecastingPage";
import UtilizationPage from "./pages/UtilizationPage";
import AdminAuditPage from "./pages/AdminAuditPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import { trackEvent } from "./lib/firebase";
import { useSessionStore } from "./store/sessionStore";

const queryClient = new QueryClient();

const ENTRY_GIF =
  "https://media1.tenor.com/m/XthV2OKkea0AAAAC/hang-in-there-kitten.gif";

function CommandCenterEntryLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="rounded-4xl border border-slate-200 bg-white p-8 text-center shadow-2xl">
        <img
          src={ENTRY_GIF}
          alt="Loading command center"
          className="mx-auto h-44 w-44 rounded-3xl object-cover"
        />

        <h2 className="mt-5 text-3xl font-black text-slate-950">
          Opening StaffForge...
        </h2>

        <p className="mt-2 text-sm font-semibold text-slate-500">
          Please hang in there while the command center loads.
        </p>
      </div>
    </div>
  );
}

function Shell() {
  const [active, setActive] = useState("dashboard");
  const session = useSessionStore();

  useEffect(() => {
    trackEvent("page_view", {
      page: active,
      fullName: session.fullName,
    });
  }, [active, session.fullName]);

  const pages: Record<string, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={setActive} />,
    agents: <AgentsPage />,
    utilization: <UtilizationPage />,
    intelligence: <IntelligencePage />,
    forecasting: <ForecastingPage />,
    ai: <AiPage />,
    imports: <PlaceholderPage title="ETL Import Control Room" />,
    admin: <AdminAuditPage />,
  };

  async function handleExit() {
    await trackEvent("staffforge_exited", {
      fullName: session.fullName,
    });

    session.clear();
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar active={active} onChange={setActive} />

      <main className="flex-1 p-4 lg:p-8">
        <div className="mb-5 flex flex-col justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
          <div>
            <p className="text-sm font-bold text-blue-700">
              Logged in as {session.fullName}
            </p>

            <h1 className="text-2xl font-black">
              {active.replace("-", " ").toUpperCase()}
            </h1>
          </div>

          <button
            type="button"
            onClick={handleExit}
            className="sf-button sf-secondary"
          >
            Exit
          </button>
        </div>

        {pages[active] || <Dashboard onNavigate={setActive} />}
      </main>
    </div>
  );
}

export default function App() {
  const sessionId = useSessionStore((state) => state.sessionId);
  const [showEntryLoader, setShowEntryLoader] = useState(false);
  const previousSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;

    if (sessionId && previousSessionIdRef.current !== sessionId) {
      setShowEntryLoader(true);

      timer = window.setTimeout(() => {
        setShowEntryLoader(false);
      }, 2400);
    }

    if (!sessionId) {
      setShowEntryLoader(false);
    }

    previousSessionIdRef.current = sessionId;

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [sessionId]);

  return (
    <QueryClientProvider client={queryClient}>
      {!sessionId ? (
        <LandingGate />
      ) : showEntryLoader ? (
        <CommandCenterEntryLoader />
      ) : (
        <Shell />
      )}
    </QueryClientProvider>
  );
}