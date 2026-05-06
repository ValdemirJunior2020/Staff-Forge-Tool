// client/src/pages/Dashboard.tsx

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  Building2,
  Gauge,
  Users,
} from "lucide-react";
import { trackEvent } from "../lib/firebase";

type DashboardProps = {
  onNavigate?: (page: string) => void;
};

const kpis = [
  {
    label: "Total Agents",
    value: "0",
    sub: "Unified master database",
    icon: Users,
  },
  {
    label: "Active Agents",
    value: "0",
    sub: "Production population",
    icon: Gauge,
  },
  {
    label: "Vendors",
    value: "0",
    sub: "BPO partners",
    icon: Building2,
  },
  {
    label: "Utilization",
    value: "0%",
    sub: "Daily average",
    icon: AlertTriangle,
  },
];

const insights = [
  {
    label: "Clickable Insight #1",
    title: "Idle Watch",
    description:
      "Open the Intelligence Engine for prioritized idle time actions and evidence.",
    page: "intelligence",
  },
  {
    label: "Clickable Insight #2",
    title: "Break Pattern Risk",
    description:
      "Open utilization intelligence to review break risk, availability, and staffing signals.",
    page: "utilization",
  },
  {
    label: "Clickable Insight #3",
    title: "Data Quality Score",
    description:
      "Open ETL Imports to review vendor file quality, missing IDs, and workbook issues.",
    page: "imports",
  },
];

export default function Dashboard({ onNavigate }: DashboardProps) {
  async function handleInsightClick(page: string, title: string) {
    await trackEvent("dashboard_insight_clicked", {
      title,
      destination: page,
    });

    if (onNavigate) {
      onNavigate(page);
    } else {
      alert(`${title} clicked. This dashboard needs onNavigate passed from App.tsx.`);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-200">
          Executive Command Center
        </p>

        <h2 className="mt-4 text-4xl font-black">
          One truth for staffing, utilization, and vendor performance.
        </h2>

        <p className="mt-4 max-w-4xl text-slate-300">
          Upload messy files, normalize them, and reveal idle time, break risk,
          staffing gaps, and vendor opportunities.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="sf-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    {item.label}
                  </p>

                  <h3 className="mt-2 text-3xl font-black">{item.value}</h3>

                  <p className="mt-2 text-sm text-slate-500">{item.sub}</p>
                </div>

                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                  <Icon size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        {insights.map((insight) => (
          <button
            key={insight.title}
            type="button"
            onClick={() => handleInsightClick(insight.page, insight.title)}
            className="group rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-blue-700">
                  {insight.label}
                </p>

                <h3 className="mt-2 text-xl font-black text-slate-950">
                  {insight.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {insight.description}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-100 p-3 text-slate-500 transition group-hover:bg-blue-600 group-hover:text-white">
                <ArrowRight size={20} />
              </div>
            </div>
          </button>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="sf-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
              <Brain />
            </div>

            <div>
              <h3 className="text-xl font-black">Better Engine</h3>
              <p className="text-sm text-slate-500">
                Prioritized operational recommendations.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleInsightClick("intelligence", "Better Engine")}
            className="sf-button sf-primary"
          >
            Open Better Engine
            <ArrowRight size={18} />
          </button>
        </div>

        <div className="sf-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
              <BarChart3 />
            </div>

            <div>
              <h3 className="text-xl font-black">Utilization Control</h3>
              <p className="text-sm text-slate-500">
                Breaks, idle time, staffing, and vendor usage.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              handleInsightClick("utilization", "Utilization Control")
            }
            className="sf-button sf-secondary"
          >
            Open Utilization
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}