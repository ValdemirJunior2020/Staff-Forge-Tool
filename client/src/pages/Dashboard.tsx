// client/src/pages/Dashboard.tsx

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  Building2,
  Gauge,
  RefreshCw,
  Users,
} from "lucide-react";
import { getGoogleSheetRows } from "../lib/googleSheetApi";
import { trackEvent } from "../lib/firebase";

type DashboardProps = {
  onNavigate?: (page: string) => void;
};

type AgentRow = {
  agent_id?: string;
  hp_id?: string;
  employee_id?: string;
  full_name?: string;
  agent_name?: string;
  first_name?: string;
  last_name?: string;
  vendor?: string;
  bpo?: string;
  status?: string;
};

type UtilizationRow = {
  agent_id?: string;
  full_name?: string;
  vendor?: string;
  scheduled_hours?: string | number;
  productive_hours?: string | number;
  idle_hours?: string | number;
  utilization_percent?: string | number;
};

const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1QZO61rBDUUbNH-lkWrmhgADjHraZkV4wfZ_cSo0MaD8/edit?usp=sharing";

const DASHBOARD_LOADING_GIF =
  "https://cdn.dribbble.com/userupload/19368548/file/original-b0421d56cd54c90ca2d702a052f8e78c.gif";

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  const cleaned = String(value).replace("%", "").replace(",", "").trim();
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

function getAgentKey(agent: AgentRow): string {
  return (
    agent.agent_id ||
    agent.hp_id ||
    agent.employee_id ||
    agent.full_name ||
    agent.agent_name ||
    `${agent.first_name || ""} ${agent.last_name || ""}`.trim()
  );
}

function getVendor(agent: AgentRow): string {
  return agent.vendor || agent.bpo || "Unknown";
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [utilizationRows, setUtilizationRows] = useState<UtilizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  async function loadDashboardData() {
    setLoading(true);

    try {
      const [agentRows, utilizationData] = await Promise.all([
        getGoogleSheetRows<AgentRow>("Agents_Master"),
        getGoogleSheetRows<UtilizationRow>("Utilization_Daily"),
      ]);

      setAgents(agentRows);
      setUtilizationRows(utilizationData);
      setLastUpdated(new Date().toLocaleString());

      await trackEvent("dashboard_data_loaded", {
        agents: agentRows.length,
        utilizationRows: utilizationData.length,
      });
    } catch (error) {
      console.error("Dashboard load failed:", error);
      setAgents([]);
      setUtilizationRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  const totalAgents = useMemo(() => {
    const uniqueAgents = new Set(
      agents.map((agent) => getAgentKey(agent)).filter(Boolean)
    );

    return uniqueAgents.size;
  }, [agents]);

  const activeAgents = useMemo(() => {
    return agents.filter((agent) =>
      String(agent.status || "").toLowerCase().includes("active")
    ).length;
  }, [agents]);

  const totalVendors = useMemo(() => {
    const vendors = new Set(
      agents
        .map((agent) => getVendor(agent))
        .filter((vendor) => vendor !== "Unknown")
    );

    return vendors.size;
  }, [agents]);

  const averageUtilization = useMemo(() => {
    const values = utilizationRows
      .map((row) => toNumber(row.utilization_percent))
      .filter((value) => value > 0);

    if (!values.length) return 0;

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [utilizationRows]);

  const totalIdleHours = useMemo(() => {
    return utilizationRows.reduce(
      (sum, row) => sum + toNumber(row.idle_hours),
      0
    );
  }, [utilizationRows]);

  const dataQualityScore = useMemo(() => {
    if (!agents.length && !utilizationRows.length) return 0;

    let score = 0;

    if (agents.length > 0) score += 35;
    if (utilizationRows.length > 0) score += 35;
    if (totalAgents > 0) score += 10;
    if (totalVendors > 0) score += 10;
    if (averageUtilization > 0) score += 10;

    return score;
  }, [
    agents.length,
    utilizationRows.length,
    totalAgents,
    totalVendors,
    averageUtilization,
  ]);

  const insights = [
    {
      label: "Clickable Insight #1",
      title: "Idle Watch",
      description: `${totalIdleHours.toFixed(
        2
      )} idle hours found in Utilization_Daily. Open Better Engine for prioritized actions.`,
      page: "intelligence",
    },
    {
      label: "Clickable Insight #2",
      title: "Break Pattern Risk",
      description:
        "Open Utilization to review vendor performance, availability, and staffing signals.",
      page: "utilization",
    },
    {
      label: "Clickable Insight #3",
      title: "Data Quality Score",
      description: `Current data quality score is ${dataQualityScore}%. Open ETL Imports to review source tabs.`,
      page: "imports",
    },
  ];

  const kpis = [
    {
      label: "Total Agents",
      value: totalAgents.toLocaleString(),
      sub: "Source: Agents_Master",
      icon: Users,
    },
    {
      label: "Active Agents",
      value: activeAgents.toLocaleString(),
      sub: "Status contains Active",
      icon: Gauge,
    },
    {
      label: "Vendors",
      value: totalVendors.toLocaleString(),
      sub: "Unique vendors in Agents_Master",
      icon: Building2,
    },
    {
      label: "Utilization",
      value: `${averageUtilization.toFixed(1)}%`,
      sub: "Average from Utilization_Daily",
      icon: AlertTriangle,
    },
  ];

  async function handleInsightClick(page: string, title: string) {
    await trackEvent("dashboard_insight_clicked", {
      title,
      destination: page,
    });

    if (onNavigate) {
      onNavigate(page);
    }
  }

  async function handleSourceClick() {
    await trackEvent("dashboard_source_sheet_clicked", {
      source: "Staff-Forge Tool Google Sheet",
      tabs: ["Agents_Master", "Utilization_Daily"],
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <img
            src={DASHBOARD_LOADING_GIF}
            alt="Loading dashboard"
            className="mx-auto h-44 w-44 rounded-3xl object-cover"
          />

          <h2 className="mt-5 text-2xl font-black text-slate-950">
            Loading Dashboard Data...
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            StaffForge is reading Agents_Master and Utilization_Daily. Please
            wait a moment.
          </p>
        </div>
      </div>
    );
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
          StaffForge is reading your Google Sheet and calculating dashboard KPIs
          from <b>Agents_Master</b> and <b>Utilization_Daily</b>.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadDashboardData}
            className="sf-button sf-primary"
          >
            <RefreshCw size={18} />
            Refresh Dashboard
          </button>

          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            onClick={handleSourceClick}
            className="inline-flex items-center justify-center rounded-2xl border-2 border-yellow-300 bg-yellow-400 px-5 py-3 font-black text-slate-950 shadow-lg shadow-yellow-500/30 transition hover:scale-[1.02] hover:bg-yellow-300"
          >
            Where this data is coming from? click to see
          </a>

          {lastUpdated && (
            <p className="text-sm font-semibold text-slate-400">
              Last updated: {lastUpdated}
            </p>
          )}
        </div>
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
            className="group rounded-3xl border border-slate-200 bg-white/95 p-6 text-left shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl"
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