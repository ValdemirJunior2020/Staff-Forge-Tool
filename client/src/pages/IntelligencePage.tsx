// client/src/pages/IntelligencePage.tsx

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  RefreshCw,

  Wand2,
  XCircle,
} from "lucide-react";
import { getGoogleSheetRows } from "../lib/googleSheetApi";
import { trackEvent } from "../lib/firebase";

const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1QZO61rBDUUbNH-lkWrmhgADjHraZkV4wfZ_cSo0MaD8/edit?usp=sharing";

const LOADING_GIF =
  "https://cdn.dribbble.com/userupload/19368548/file/original-b0421d56cd54c90ca2d702a052f8e78c.gif";

type UtilizationRow = {
  date?: string;
  agent_id?: string;
  full_name?: string;
  vendor?: string;
  scheduled_hours?: string | number;
  productive_hours?: string | number;
  available_hours?: string | number;
  idle_hours?: string | number;
  break_hours?: string | number;
  calls_handled?: string | number;
  occupancy_percent?: string | number;
  utilization_percent?: string | number;
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

type Recommendation = {
  id: string;
  rank: number;
  severity: "STRATEGIC" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  summary: string;
  impact: number;
  confidence: number;
  evidence: string[];
  rootCause: string;
  actionPlan: string[];
  owner: string;
  timeline: string;
};

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  const cleaned = String(value).replace("%", "").replace(",", "").trim();
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
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

function getSeverityClass(severity: Recommendation["severity"]) {
  if (severity === "STRATEGIC") return "bg-blue-50 text-blue-700";
  if (severity === "HIGH") return "bg-red-50 text-red-700";
  if (severity === "MEDIUM") return "bg-yellow-50 text-yellow-700";
  return "bg-green-50 text-green-700";
}

function downloadCsv(filename: string, recommendations: Recommendation[]) {
  const headers = [
    "Rank",
    "Severity",
    "Title",
    "Summary",
    "Impact",
    "Confidence",
    "Owner",
    "Timeline",
    "Evidence",
    "Action Plan",
  ];

  const rows = recommendations.map((rec) => [
    rec.rank,
    rec.severity,
    rec.title,
    rec.summary,
    rec.impact,
    `${rec.confidence}%`,
    rec.owner,
    rec.timeline,
    rec.evidence.join(" | "),
    rec.actionPlan.join(" | "),
  ]);

  const csv = [
    headers.map((header) => `"${header}"`).join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export default function IntelligencePage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [utilizationRows, setUtilizationRows] = useState<UtilizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<Recommendation | null>(null);
  const [createdAction, setCreatedAction] = useState<Recommendation | null>(
    null
  );
  const [lastUpdated, setLastUpdated] = useState("");

  async function loadIntelligenceData() {
    setLoading(true);

    try {
      const [agentRows, utilizationData] = await Promise.all([
        getGoogleSheetRows<AgentRow>("Agents_Master"),
        getGoogleSheetRows<UtilizationRow>("Utilization_Daily"),
      ]);

      setAgents(agentRows);
      setUtilizationRows(utilizationData);
      setLastUpdated(new Date().toLocaleString());

      await trackEvent("better_engine_loaded", {
        agents: agentRows.length,
        utilizationRows: utilizationData.length,
      });
    } catch (error) {
      console.error("Better Engine load failed:", error);
      setAgents([]);
      setUtilizationRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIntelligenceData();
  }, []);

  const operations = useMemo(() => {
    const uniqueAgents = new Set(
      agents.map((agent) => getAgentKey(agent)).filter(Boolean)
    );

    const vendors = new Set(
      agents
        .map((agent) => getVendor(agent))
        .filter((vendor) => vendor !== "Unknown")
    );

    const totalIdleHours = utilizationRows.reduce(
      (sum, row) => sum + toNumber(row.idle_hours),
      0
    );

    const totalScheduledHours = utilizationRows.reduce(
      (sum, row) => sum + toNumber(row.scheduled_hours),
      0
    );

    const totalProductiveHours = utilizationRows.reduce(
      (sum, row) => sum + toNumber(row.productive_hours),
      0
    );

    const utilizationValues = utilizationRows
      .map((row) => toNumber(row.utilization_percent))
      .filter((value) => value > 0);

    const averageUtilization =
      utilizationValues.length > 0
        ? utilizationValues.reduce((sum, value) => sum + value, 0) /
          utilizationValues.length
        : totalScheduledHours > 0
        ? (totalProductiveHours / totalScheduledHours) * 100
        : 0;

    const vendorMap = new Map<
      string,
      {
        rows: number;
        agents: Set<string>;
        idleHours: number;
        scheduledHours: number;
        productiveHours: number;
        utilizationTotal: number;
        utilizationCount: number;
      }
    >();

    utilizationRows.forEach((row) => {
      const vendor = row.vendor || "Unknown";

      if (!vendorMap.has(vendor)) {
        vendorMap.set(vendor, {
          rows: 0,
          agents: new Set(),
          idleHours: 0,
          scheduledHours: 0,
          productiveHours: 0,
          utilizationTotal: 0,
          utilizationCount: 0,
        });
      }

      const bucket = vendorMap.get(vendor)!;

      bucket.rows += 1;
      bucket.agents.add(row.agent_id || row.full_name || "Unknown Agent");
      bucket.idleHours += toNumber(row.idle_hours);
      bucket.scheduledHours += toNumber(row.scheduled_hours);
      bucket.productiveHours += toNumber(row.productive_hours);

      const utilization = toNumber(row.utilization_percent);

      if (utilization > 0) {
        bucket.utilizationTotal += utilization;
        bucket.utilizationCount += 1;
      }
    });

    const vendorSummaries = Array.from(vendorMap.entries())
      .map(([vendor, data]) => {
        const utilization =
          data.utilizationCount > 0
            ? data.utilizationTotal / data.utilizationCount
            : data.scheduledHours > 0
            ? (data.productiveHours / data.scheduledHours) * 100
            : 0;

        return {
          vendor,
          rows: data.rows,
          agents: data.agents.size,
          idleHours: data.idleHours,
          scheduledHours: data.scheduledHours,
          productiveHours: data.productiveHours,
          utilization,
        };
      })
      .sort((a, b) => b.idleHours - a.idleHours);

    const highestIdleVendor = vendorSummaries[0];
    const lowestUtilizationVendor = [...vendorSummaries].sort(
      (a, b) => a.utilization - b.utilization
    )[0];

    return {
      totalAgents: uniqueAgents.size,
      totalVendors: vendors.size,
      totalIdleHours,
      totalScheduledHours,
      totalProductiveHours,
      averageUtilization,
      vendorSummaries,
      highestIdleVendor,
      lowestUtilizationVendor,
    };
  }, [agents, utilizationRows]);

  const recommendations = useMemo<Recommendation[]>(() => {
    const recs: Recommendation[] = [];

    recs.push({
      id: "standardize-vendor-files",
      rank: 1,
      severity: "STRATEGIC",
      title: "Standardize every vendor file",
      summary:
        "Require Agent ID, HP ID, login state, schedule start/end, break window, supervisor, and call volume by hour from every BPO.",
      impact: 96,
      confidence: agents.length > 0 && utilizationRows.length > 0 ? 92 : 60,
      evidence: [
        `Agents_Master rows loaded: ${agents.length}`,
        `Utilization_Daily rows loaded: ${utilizationRows.length}`,
        `Vendors detected: ${operations.totalVendors}`,
      ],
      rootCause:
        "Different vendors are not providing the same fields. That makes vendor comparisons weaker and creates manual QA/operations work.",
      actionPlan: [
        "Create one required vendor file format.",
        "Require every BPO to submit the same columns daily.",
        "Reject incomplete files or flag them as Data Coverage Risk.",
        "Add missing-field scoring to the ETL Imports page.",
      ],
      owner: "Workforce Management + Vendor Operations",
      timeline: "Start this week. Enforce within 30 days.",
    });

    if (operations.highestIdleVendor) {
      recs.push({
        id: "idle-risk",
        rank: 2,
        severity:
          operations.highestIdleVendor.idleHours >= 50 ? "HIGH" : "MEDIUM",
        title: `Review idle exposure for ${operations.highestIdleVendor.vendor}`,
        summary: `${operations.highestIdleVendor.vendor} has ${formatNumber(
          operations.highestIdleVendor.idleHours
        )} idle hours in the current utilization data.`,
        impact: 91,
        confidence: 84,
        evidence: [
          `Vendor: ${operations.highestIdleVendor.vendor}`,
          `Idle hours: ${formatNumber(operations.highestIdleVendor.idleHours)}`,
          `Utilized agents: ${operations.highestIdleVendor.agents}`,
          `Utilization rows: ${operations.highestIdleVendor.rows}`,
        ],
        rootCause:
          "Idle time may be caused by overstaffing, low call arrival, break clustering, bad schedule alignment, or incomplete utilization coverage.",
        actionPlan: [
          "Compare idle windows against hourly call volume.",
          "Check if schedules overlap low-call intervals.",
          "Review breaks and available time by hour.",
          "Ask vendor to explain idle windows with evidence.",
        ],
        owner: "WFM Analyst + BPO Account Manager",
        timeline: "Review within 24 hours.",
      });
    }

    if (operations.lowestUtilizationVendor) {
      recs.push({
        id: "staffing-gap-score",
        rank: 3,
        severity: "MEDIUM",
        title: "Create vendor-by-hour staffing gap score",
        summary:
          "Calculate required vs actual headcount by half-hour to show overstaffing, understaffing, and profitable vendor mix.",
        impact: 88,
        confidence: 81,
        evidence: [
          `Lowest utilization vendor: ${
            operations.lowestUtilizationVendor.vendor
          }`,
          `Lowest utilization: ${operations.lowestUtilizationVendor.utilization.toFixed(
            1
          )}%`,
          `Average utilization: ${operations.averageUtilization.toFixed(1)}%`,
        ],
        rootCause:
          "Current data shows utilization symptoms, but the system still needs schedules and call arrivals to calculate true staffing gaps.",
        actionPlan: [
          "Load Schedules tab with start/end/lunch/break windows.",
          "Load Call_Volume tab with offered calls and AHT by hour.",
          "Create required staff formula by half-hour.",
          "Rank vendor gaps by financial impact.",
        ],
        owner: "Operations Analytics",
        timeline: "Design this sprint. Automate next sprint.",
      });
    }

    return recs;
  }, [agents.length, utilizationRows.length, operations]);

  async function openAnalysis(recommendation: Recommendation) {
    setSelectedRecommendation(recommendation);

    await trackEvent("better_engine_analysis_opened", {
      recommendationId: recommendation.id,
      title: recommendation.title,
      impact: recommendation.impact,
      confidence: recommendation.confidence,
    });
  }

  async function createAction(recommendation: Recommendation) {
    setCreatedAction(recommendation);

    await trackEvent("better_engine_action_created", {
      recommendationId: recommendation.id,
      title: recommendation.title,
      owner: recommendation.owner,
      timeline: recommendation.timeline,
    });
  }

  function exportRecommendations() {
    downloadCsv("staffforge-better-engine-recommendations.csv", recommendations);

    trackEvent("better_engine_recommendations_exported", {
      count: recommendations.length,
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <img
            src={LOADING_GIF}
            alt="Loading Better Engine"
            className="mx-auto h-44 w-44 rounded-3xl object-cover"
          />

          <h2 className="mt-5 text-2xl font-black text-slate-950">
            Loading Better Engine...
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            StaffForge is reading your data and building operational
            recommendations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-200">
          Better Engine
        </p>

        <h2 className="mt-4 text-4xl font-black">
          Where We Need to Get Better
        </h2>

        <p className="mt-4 max-w-5xl text-slate-300">
          StaffForge reviews utilization patterns and turns them into
          prioritized operational actions by impact, confidence, urgency, and
          evidence.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadIntelligenceData}
            className="sf-button sf-primary"
          >
            <RefreshCw size={18} />
            Analyze Google Sheet
          </button>

          <button
            type="button"
            onClick={exportRecommendations}
            className="sf-button sf-secondary"
          >
            <Download size={18} />
            Export Recommendations
          </button>

          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackEvent("better_engine_source_sheet_clicked", {
                source: "Staff-Forge Tool Google Sheet",
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-yellow-300 bg-yellow-400 px-5 py-3 font-black text-slate-950 shadow-lg shadow-yellow-500/30 transition hover:scale-[1.02] hover:bg-yellow-300"
          >
            <ExternalLink size={18} />
            Where this data is coming from? click to see
          </a>

          {lastUpdated && (
            <p className="flex items-center text-sm font-semibold text-slate-400">
              Last updated: {lastUpdated}
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="sf-card p-5">
          <BarChart3 className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Recommendations</p>
          <h3 className="mt-2 text-3xl font-black">
            {recommendations.length}
          </h3>
        </div>

        <div className="sf-card p-5">
          <Clock className="mb-3 text-orange-600" />
          <p className="text-sm font-bold text-slate-500">Idle Hours</p>
          <h3 className="mt-2 text-3xl font-black">
            {formatNumber(operations.totalIdleHours)}
          </h3>
        </div>

        <div className="sf-card p-5">
          <BarChart3 className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Avg Utilization</p>
          <h3 className="mt-2 text-3xl font-black">
            {operations.averageUtilization.toFixed(1)}%
          </h3>
        </div>

        <div className="sf-card p-5">
          <CheckCircle2 className="mb-3 text-green-700" />
          <p className="text-sm font-bold text-slate-500">Evidence Loaded</p>
          <h3 className="mt-2 text-3xl font-black">
            {utilizationRows.length}
          </h3>
        </div>
      </section>

      {createdAction && (
        <section className="rounded-3xl border border-green-200 bg-green-50 p-5 text-green-950">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 text-green-700" />
            <div>
              <h3 className="text-lg font-black">Action Created</h3>
              <p className="mt-1 text-sm leading-6">
                <b>{createdAction.title}</b> was added to the action queue.
                Owner: <b>{createdAction.owner}</b>. Timeline:{" "}
                <b>{createdAction.timeline}</b>.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-3">
        {recommendations.map((recommendation) => (
          <div
            key={recommendation.id}
            className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${getSeverityClass(
                  recommendation.severity
                )}`}
              >
                {recommendation.severity}
              </span>

              <Wand2 className="text-blue-600" size={22} />
            </div>

            <h3 className="mt-5 text-xl font-black text-slate-950">
              #{recommendation.rank} {recommendation.title}
            </h3>

            <p className="mt-4 min-h-20 text-sm leading-6 text-slate-600">
              {recommendation.summary}
            </p>

            <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm font-black text-blue-700">
              Impact {recommendation.impact} · Confidence{" "}
              {recommendation.confidence}%
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openAnalysis(recommendation)}
                className="sf-button sf-primary"
              >
                Open analysis
              </button>

              <button
                type="button"
                onClick={() => createAction(recommendation)}
                className="sf-button sf-secondary"
              >
                Create action
              </button>
            </div>
          </div>
        ))}
      </section>

      {selectedRecommendation && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p
                  className={`mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${getSeverityClass(
                    selectedRecommendation.severity
                  )}`}
                >
                  {selectedRecommendation.severity}
                </p>

                <h3 className="text-3xl font-black text-slate-950">
                  {selectedRecommendation.title}
                </h3>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {selectedRecommendation.summary}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRecommendation(null)}
                className="rounded-2xl bg-slate-100 p-3 text-slate-700 hover:bg-red-50 hover:text-red-700"
              >
                <XCircle />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-sm font-bold text-blue-700">Impact Score</p>
                <h4 className="mt-2 text-3xl font-black text-blue-950">
                  {selectedRecommendation.impact}
                </h4>
              </div>

              <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                <p className="text-sm font-bold text-green-700">Confidence</p>
                <h4 className="mt-2 text-3xl font-black text-green-950">
                  {selectedRecommendation.confidence}%
                </h4>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-bold text-slate-500">Timeline</p>
                <h4 className="mt-2 text-lg font-black text-slate-950">
                  {selectedRecommendation.timeline}
                </h4>
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 p-5">
                <h4 className="text-lg font-black">Evidence Used</h4>

                <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                  {selectedRecommendation.evidence.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5">
                <h4 className="text-lg font-black text-orange-950">
                  Root Cause Hypothesis
                </h4>

                <p className="mt-4 text-sm leading-6 text-orange-900">
                  {selectedRecommendation.rootCause}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-5">
              <h4 className="text-lg font-black text-blue-950">
                Operational Action Plan
              </h4>

              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-blue-950">
                {selectedRecommendation.actionPlan.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 p-5">
              <h4 className="text-lg font-black">Executive Decision</h4>

              <p className="mt-3 text-sm leading-6 text-slate-700">
                Owner: <b>{selectedRecommendation.owner}</b>
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-700">
                This recommendation should be treated as operational guidance,
                not final punishment. Confirm source coverage, schedule data,
                and call volume before making vendor-level staffing decisions.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => createAction(selectedRecommendation)}
                className="sf-button sf-primary"
              >
                Create action from this analysis
              </button>

              <button
                type="button"
                onClick={() => setSelectedRecommendation(null)}
                className="sf-button sf-secondary"
              >
                Close analysis
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-orange-200 bg-orange-50 p-5 text-orange-950">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 text-orange-700" />
          <div>
            <h3 className="text-lg font-black">Decision Guardrail</h3>
            <p className="mt-1 text-sm leading-6">
              Better Engine recommendations are evidence-first. They should
              trigger review, coaching, staffing analysis, or vendor follow-up.
              They should not be used as final conclusions unless Schedules,
              Call_Volume, and coverage checks are complete.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}