// client/src/pages/ForecastingPage.tsx

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  RefreshCw,
  Users,
  Wand2,
} from "lucide-react";
import { getGoogleSheetRows } from "../lib/googleSheetApi";
import { trackEvent } from "../lib/firebase";

const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1QZO61rBDUUbNH-lkWrmhgADjHraZkV4wfZ_cSo0MaD8/edit?usp=sharing";

const LOADING_GIF =
  "https://cdn.dribbble.com/userupload/19368548/file/original-b0421d56cd54c90ca2d702a052f8e78c.gif";

type AnyRow = Record<string, unknown>;

type ForecastConfidence = "High" | "Medium" | "Low";

type ForecastRow = {
  period: string;
  vendor: string;
  expectedDemand: number;
  requiredAgents: number;
  availableAgents: number;
  gap: number;
  coverageHealth: string;
  confidence: ForecastConfidence;
  recommendation: string;
  evidence: string[];
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  const cleaned = String(value).replace("%", "").replace(",", "").trim();
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

function getVendor(row: AnyRow): string {
  return (
    clean(row.vendor) ||
    clean(row.bpo) ||
    clean(row.call_center) ||
    clean(row.callCenter) ||
    clean(row.site) ||
    "Unknown"
  );
}

function getAgentKey(row: AnyRow): string {
  const direct =
    clean(row.agent_id) ||
    clean(row.hp_id) ||
    clean(row.employee_id) ||
    clean(row.emp_id) ||
    clean(row.id) ||
    clean(row.full_name) ||
    clean(row.agent_name) ||
    clean(row.agent) ||
    clean(row.name);

  if (direct) return direct;

  const first = clean(row.first_name);
  const last = clean(row.last_name);

  return `${first} ${last}`.trim();
}

function getPeriod(row: AnyRow): string {
  return (
    clean(row.period) ||
    clean(row.week) ||
    clean(row.date) ||
    clean(row.forecast_date) ||
    clean(row.hour) ||
    "Current Forecast"
  );
}

function getDemand(row: AnyRow): number {
  return (
    toNumber(row.expected_demand) ||
    toNumber(row.offered_calls) ||
    toNumber(row.calls_offered) ||
    toNumber(row.call_volume) ||
    toNumber(row.calls) ||
    toNumber(row.calls_handled) ||
    0
  );
}

function getAhtSeconds(row: AnyRow): number {
  const rawAht =
    toNumber(row.aht_seconds) ||
    toNumber(row.avg_aht_seconds) ||
    toNumber(row.average_handle_time_seconds) ||
    toNumber(row.aht);

  return rawAht > 0 ? rawAht : 360;
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function getCoverageHealth(gap: number, requiredAgents: number): string {
  if (requiredAgents === 0) return "Needs demand data";
  if (gap < 0) return "Understaffed";
  if (gap > Math.max(3, requiredAgents * 0.25)) return "Overstaffed";
  return "Healthy";
}

function getCoverageClass(health: string): string {
  if (health === "Healthy") return "bg-green-50 text-green-700";
  if (health === "Understaffed") return "bg-red-50 text-red-700";
  if (health === "Overstaffed") return "bg-orange-50 text-orange-700";
  return "bg-blue-50 text-blue-700";
}

function downloadCsv(filename: string, rows: ForecastRow[]) {
  const headers = [
    "Period",
    "Vendor",
    "Expected Demand",
    "Required Agents",
    "Available Agents",
    "Gap",
    "Coverage Health",
    "Confidence",
    "Recommendation",
    "Evidence",
  ];

  const csvRows = rows.map((row) => [
    row.period,
    row.vendor,
    row.expectedDemand,
    row.requiredAgents,
    row.availableAgents,
    row.gap,
    row.coverageHealth,
    row.confidence,
    row.recommendation,
    row.evidence.join(" | "),
  ]);

  const csv = [
    headers.map((header) => `"${header}"`).join(","),
    ...csvRows.map((row) =>
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

export default function ForecastingPage() {
  const [agentsRows, setAgentsRows] = useState<AnyRow[]>([]);
  const [scheduleRows, setScheduleRows] = useState<AnyRow[]>([]);
  const [callVolumeRows, setCallVolumeRows] = useState<AnyRow[]>([]);
  const [utilizationRows, setUtilizationRows] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<ForecastRow | null>(null);

  async function loadForecastData() {
    setLoading(true);
    setNotice("");

    try {
      const [agents, schedules, callVolume, utilization] = await Promise.all([
        getGoogleSheetRows<AnyRow>("Agents_Master").catch(() => []),
        getGoogleSheetRows<AnyRow>("Schedules").catch(() => []),
        getGoogleSheetRows<AnyRow>("Call_Volume").catch(() => []),
        getGoogleSheetRows<AnyRow>("Utilization_Daily").catch(() => []),
      ]);

      setAgentsRows(agents);
      setScheduleRows(schedules);
      setCallVolumeRows(callVolume);
      setUtilizationRows(utilization);
      setLastUpdated(new Date().toLocaleString());

      await trackEvent("forecasting_data_loaded", {
        agents: agents.length,
        schedules: schedules.length,
        callVolume: callVolume.length,
        utilization: utilization.length,
      });

      setNotice(
        `Forecast refreshed using ${agents.length} agent rows, ${schedules.length} schedule rows, ${callVolume.length} call-volume rows, and ${utilization.length} utilization rows.`
      );
    } catch (error) {
      console.error("Forecasting load failed:", error);
      setAgentsRows([]);
      setScheduleRows([]);
      setCallVolumeRows([]);
      setUtilizationRows([]);
      setNotice(
        "Forecast data could not be loaded. Check your Google Sheet tabs."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadForecastData();
  }, []);

  const forecastRows = useMemo<ForecastRow[]>(() => {
    const activeAgentsByVendor = new Map<string, Set<string>>();
    const scheduledAgentsByVendor = new Map<string, Set<string>>();
    const demandByVendorPeriod = new Map<
      string,
      {
        period: string;
        vendor: string;
        expectedDemand: number;
        ahtSecondsTotal: number;
        ahtCount: number;
        evidenceRows: number;
        source: "Call_Volume" | "Utilization_Daily fallback";
      }
    >();

    agentsRows.forEach((row) => {
      const vendor = getVendor(row);
      const agentKey = getAgentKey(row);
      const status = clean(row.status).toLowerCase();

      if (!vendor || vendor === "Unknown" || !agentKey) return;

      if (!activeAgentsByVendor.has(vendor)) {
        activeAgentsByVendor.set(vendor, new Set());
      }

      if (!status || status.includes("active")) {
        activeAgentsByVendor.get(vendor)!.add(agentKey);
      }
    });

    scheduleRows.forEach((row) => {
      const vendor = getVendor(row);
      const agentKey = getAgentKey(row);

      if (!vendor || vendor === "Unknown" || !agentKey) return;

      if (!scheduledAgentsByVendor.has(vendor)) {
        scheduledAgentsByVendor.set(vendor, new Set());
      }

      scheduledAgentsByVendor.get(vendor)!.add(agentKey);
    });

    if (callVolumeRows.length > 0) {
      callVolumeRows.forEach((row) => {
        const vendor = getVendor(row);
        const period = getPeriod(row);
        const expectedDemand = getDemand(row);
        const ahtSeconds = getAhtSeconds(row);

        if (!vendor || vendor === "Unknown") return;

        const key = `${vendor}__${period}`;

        if (!demandByVendorPeriod.has(key)) {
          demandByVendorPeriod.set(key, {
            period,
            vendor,
            expectedDemand: 0,
            ahtSecondsTotal: 0,
            ahtCount: 0,
            evidenceRows: 0,
            source: "Call_Volume",
          });
        }

        const bucket = demandByVendorPeriod.get(key)!;
        bucket.expectedDemand += expectedDemand;
        bucket.ahtSecondsTotal += ahtSeconds;
        bucket.ahtCount += 1;
        bucket.evidenceRows += 1;
      });
    } else {
      utilizationRows.forEach((row) => {
        const vendor = getVendor(row);
        const period = getPeriod(row);
        const expectedDemand = getDemand(row);
        const ahtSeconds = getAhtSeconds(row);

        if (!vendor || vendor === "Unknown") return;

        const key = `${vendor}__${period}`;

        if (!demandByVendorPeriod.has(key)) {
          demandByVendorPeriod.set(key, {
            period,
            vendor,
            expectedDemand: 0,
            ahtSecondsTotal: 0,
            ahtCount: 0,
            evidenceRows: 0,
            source: "Utilization_Daily fallback",
          });
        }

        const bucket = demandByVendorPeriod.get(key)!;
        bucket.expectedDemand += expectedDemand;
        bucket.ahtSecondsTotal += ahtSeconds;
        bucket.ahtCount += 1;
        bucket.evidenceRows += 1;
      });
    }

    const rows: ForecastRow[] = Array.from(demandByVendorPeriod.values()).map(
      (bucket): ForecastRow => {
        const averageAht =
          bucket.ahtCount > 0 ? bucket.ahtSecondsTotal / bucket.ahtCount : 360;

        const targetOccupancy = 0.85;

        const requiredAgents =
          bucket.expectedDemand > 0
            ? Math.ceil(
                (bucket.expectedDemand * averageAht) /
                  (3600 * targetOccupancy)
              )
            : 0;

        const scheduledAgents =
          scheduledAgentsByVendor.get(bucket.vendor)?.size || 0;

        const activeAgents = activeAgentsByVendor.get(bucket.vendor)?.size || 0;

        const availableAgents =
          scheduledAgents > 0 ? scheduledAgents : activeAgents;

        const gap = availableAgents - requiredAgents;
        const coverageHealth = getCoverageHealth(gap, requiredAgents);

        const confidence: ForecastConfidence =
          callVolumeRows.length > 0 && scheduleRows.length > 0
            ? "High"
            : callVolumeRows.length > 0 || scheduleRows.length > 0
            ? "Medium"
            : "Low";

        let recommendation = "Monitor vendor staffing.";

        if (coverageHealth === "Understaffed") {
          recommendation = `Add ${Math.abs(
            gap
          )} agent(s) or move volume away from ${bucket.vendor}.`;
        }

        if (coverageHealth === "Overstaffed") {
          recommendation = `Review ${gap} extra available agent(s) for possible reallocation.`;
        }

        if (coverageHealth === "Healthy") {
          recommendation = "Coverage looks aligned based on current evidence.";
        }

        if (coverageHealth === "Needs demand data") {
          recommendation =
            "Add Call_Volume data to calculate true required staffing.";
        }

        return {
          period: bucket.period,
          vendor: bucket.vendor,
          expectedDemand: bucket.expectedDemand,
          requiredAgents,
          availableAgents,
          gap,
          coverageHealth,
          confidence,
          recommendation,
          evidence: [
            `Demand source: ${bucket.source}`,
            `Evidence rows: ${bucket.evidenceRows}`,
            `Average AHT used: ${averageAht.toFixed(0)} seconds`,
            `Target occupancy: 85%`,
            scheduledAgents > 0
              ? `Available agents from Schedules: ${scheduledAgents}`
              : `Available agents from Agents_Master fallback: ${activeAgents}`,
          ],
        };
      }
    );

    if (rows.length > 0) {
      return rows.sort((a, b) => {
        if (
          a.coverageHealth === "Understaffed" &&
          b.coverageHealth !== "Understaffed"
        ) {
          return -1;
        }

        if (
          b.coverageHealth === "Understaffed" &&
          a.coverageHealth !== "Understaffed"
        ) {
          return 1;
        }

        return Math.abs(b.gap) - Math.abs(a.gap);
      });
    }

    const vendors = Array.from(activeAgentsByVendor.keys());

    return vendors.map(
      (vendor): ForecastRow => ({
        period: "Current Forecast",
        vendor,
        expectedDemand: 0,
        requiredAgents: 0,
        availableAgents: activeAgentsByVendor.get(vendor)?.size || 0,
        gap: activeAgentsByVendor.get(vendor)?.size || 0,
        coverageHealth: "Needs demand data",
        confidence: "Low",
        recommendation: "Add Call_Volume and Schedules data to generate forecast.",
        evidence: [
          "Agents_Master is loaded.",
          "Call_Volume is empty.",
          "Schedules may be empty.",
        ],
      })
    );
  }, [agentsRows, scheduleRows, callVolumeRows, utilizationRows]);

  const totals = useMemo(() => {
    const projectedDemand = forecastRows.reduce(
      (sum, row) => sum + row.expectedDemand,
      0
    );

    const requiredAgents = forecastRows.reduce(
      (sum, row) => sum + row.requiredAgents,
      0
    );

    const availableAgents = forecastRows.reduce(
      (sum, row) => sum + row.availableAgents,
      0
    );

    const understaffedCount = forecastRows.filter(
      (row) => row.coverageHealth === "Understaffed"
    ).length;

    const overstaffedCount = forecastRows.filter(
      (row) => row.coverageHealth === "Overstaffed"
    ).length;

    const healthyCount = forecastRows.filter(
      (row) => row.coverageHealth === "Healthy"
    ).length;

    const coverageHealth =
      forecastRows.length === 0
        ? "N/A"
        : understaffedCount > 0
        ? "Understaffed"
        : overstaffedCount > 0
        ? "Overstaffed"
        : healthyCount > 0
        ? "Healthy"
        : "Needs demand data";

    const attritionRisk =
      agentsRows.filter((row) =>
        clean(row.status).toLowerCase().includes("leave")
      ).length > 0
        ? "Watch"
        : "N/A";

    return {
      projectedDemand,
      requiredAgents,
      availableAgents,
      understaffedCount,
      overstaffedCount,
      coverageHealth,
      attritionRisk,
    };
  }, [forecastRows, agentsRows]);

  async function handleRunForecast() {
    await loadForecastData();

    await trackEvent("forecast_run_clicked", {
      forecastRows: forecastRows.length,
    });
  }

  async function handleCreatePlan() {
    const highestPriority =
      forecastRows.find((row) => row.coverageHealth === "Understaffed") ||
      forecastRows.find((row) => row.coverageHealth === "Overstaffed") ||
      forecastRows[0] ||
      null;

    setSelectedPlan(highestPriority);

    await trackEvent("forecast_plan_created", {
      vendor: highestPriority?.vendor || "N/A",
      coverageHealth: highestPriority?.coverageHealth || "N/A",
    });
  }

  async function handleExport() {
    downloadCsv("staffforge-forecast-plan.csv", forecastRows);

    await trackEvent("forecast_exported", {
      rows: forecastRows.length,
      projectedDemand: totals.projectedDemand,
      requiredAgents: totals.requiredAgents,
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <img
            src={LOADING_GIF}
            alt="Loading forecast"
            className="mx-auto h-44 w-44 rounded-3xl object-cover"
          />

          <h2 className="mt-5 text-2xl font-black text-slate-950">
            Loading Forecasting Intelligence...
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            StaffForge is reading Call_Volume, Schedules, Agents_Master, and
            Utilization_Daily.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-200">
          Forecasting Intelligence
        </p>

        <h2 className="mt-4 text-4xl font-black">
          Predict staffing needs before the operation breaks.
        </h2>

        <p className="mt-4 max-w-5xl text-slate-300">
          This page estimates required agents by vendor using call demand, AHT,
          target occupancy, schedules, and master-agent coverage. If Call_Volume
          or Schedules are missing, StaffForge marks the forecast as lower
          confidence instead of inventing certainty.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleRunForecast}
            className="sf-button sf-primary"
          >
            <RefreshCw size={18} />
            Run Forecast
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="sf-button sf-secondary"
          >
            <Download size={18} />
            Export Forecast
          </button>

          <button
            type="button"
            onClick={handleCreatePlan}
            className="sf-button sf-secondary"
          >
            <CalendarDays size={18} />
            Create Plan
          </button>

          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackEvent("forecast_source_sheet_clicked", {
                source: "Staff-Forge Tool Google Sheet",
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-yellow-300 bg-yellow-400 px-5 py-3 font-black text-slate-950 shadow-lg shadow-yellow-500/30 transition hover:scale-[1.02] hover:bg-yellow-300"
          >
            <ExternalLink size={18} />
            Where this data is coming from? click to see
          </a>
        </div>

        {lastUpdated && (
          <p className="mt-4 text-sm text-slate-400">
            Last updated: {lastUpdated}
          </p>
        )}
      </section>

      {notice && (
        <section className="rounded-3xl border border-green-200 bg-green-50 p-5 text-green-950">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 text-green-700" />
            <div>
              <h3 className="font-black">Forecast Result</h3>
              <p className="mt-1 text-sm leading-6">{notice}</p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="sf-card p-5">
          <BarChart3 className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Projected Demand</p>
          <h3 className="mt-2 text-3xl font-black">
            {formatNumber(totals.projectedDemand)}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            From Call_Volume or utilization fallback
          </p>
        </div>

        <div className="sf-card p-5">
          <Users className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Required Agents</p>
          <h3 className="mt-2 text-3xl font-black">
            {formatNumber(totals.requiredAgents)}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Demand × AHT ÷ occupancy
          </p>
        </div>

        <div className="sf-card p-5">
          <CheckCircle2 className="mb-3 text-green-700" />
          <p className="text-sm font-bold text-slate-500">Coverage Health</p>
          <h3 className="mt-2 text-3xl font-black">
            {totals.coverageHealth}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Based on available vs required
          </p>
        </div>

        <div className="sf-card p-5">
          <AlertTriangle className="mb-3 text-orange-600" />
          <p className="text-sm font-bold text-slate-500">Attrition Risk</p>
          <h3 className="mt-2 text-3xl font-black">{totals.attritionRisk}</h3>
          <p className="mt-2 text-sm text-slate-500">
            Future ML model placeholder
          </p>
        </div>
      </section>

      {selectedPlan && (
        <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-blue-950">
          <div className="flex items-start gap-3">
            <Wand2 className="mt-1 text-blue-700" />
            <div>
              <h3 className="text-lg font-black">Forecast Plan Created</h3>
              <p className="mt-1 text-sm leading-6">
                Priority vendor: <b>{selectedPlan.vendor}</b>. Period:{" "}
                <b>{selectedPlan.period}</b>. Status:{" "}
                <b>{selectedPlan.coverageHealth}</b>. Recommendation:{" "}
                <b>{selectedPlan.recommendation}</b>
              </p>

              <ul className="mt-3 space-y-1 text-sm">
                {selectedPlan.evidence.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="sf-card overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-xl font-black">Forecast Plan</h3>
          <p className="text-sm text-slate-500">
            Staffing prediction by vendor and period.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4">Period</th>
                <th className="p-4">Vendor</th>
                <th className="p-4">Expected Demand</th>
                <th className="p-4">Required Agents</th>
                <th className="p-4">Available Agents</th>
                <th className="p-4">Gap</th>
                <th className="p-4">Coverage</th>
                <th className="p-4">Confidence</th>
                <th className="p-4">Recommendation</th>
              </tr>
            </thead>

            <tbody>
              {forecastRows.map((row, index) => (
                <tr
                  key={`${row.period}-${row.vendor}-${index}`}
                  className="border-t border-slate-100"
                >
                  <td className="p-4 font-bold">{row.period}</td>
                  <td className="p-4 font-black">{row.vendor}</td>
                  <td className="p-4">{formatNumber(row.expectedDemand)}</td>
                  <td className="p-4">{row.requiredAgents}</td>
                  <td className="p-4">{row.availableAgents}</td>
                  <td className="p-4 font-black">{row.gap}</td>
                  <td className="p-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${getCoverageClass(
                        row.coverageHealth
                      )}`}
                    >
                      {row.coverageHealth}
                    </span>
                  </td>
                  <td className="p-4">{row.confidence}</td>
                  <td className="p-4">{row.recommendation}</td>
                </tr>
              ))}

              {forecastRows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="p-6 text-center font-semibold text-slate-500"
                  >
                    No forecast rows found. Add Call_Volume and Schedules data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-blue-950">
        <h3 className="text-lg font-black">Purpose of Forecasting</h3>
        <p className="mt-2 text-sm leading-6">
          Forecasting is where StaffForge should answer: “Do we have enough
          agents scheduled for the demand coming in?” It uses demand, AHT, and
          target occupancy to estimate required agents, then compares that
          against schedules or the master-agent list.
        </p>
      </section>
    </div>
  );
}