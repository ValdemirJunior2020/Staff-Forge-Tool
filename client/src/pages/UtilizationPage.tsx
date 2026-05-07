// client/src/pages/UtilizationPage.tsx

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { trackEvent } from "../lib/firebase";
import { getGoogleSheetRows } from "../lib/googleSheetApi";
import {
  calculateDataQuality,
  confidenceFromDataQuality,
} from "../lib/dataQuality";
import EvidenceCard, {
  ConfidenceBadge,
  DataSourcePill,
} from "../components/evidence/EvidenceCard";

const LOADING_GIF =
  "https://media1.tenor.com/m/12DuAMmK3dwAAAAC/sofakingdoge.gif";

const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1QZO61rBDUUbNH-lkWrmhgADjHraZkV4wfZ_cSo0MaD8/edit?usp=sharing";

type AgentMasterRow = {
  agent_id?: string;
  hp_id?: string;
  employee_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  agent_name?: string;
  vendor?: string;
  bpo?: string;
  site?: string;
  role?: string;
  status?: string;
};

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

type VendorSummary = {
  vendor: string;
  agents: number;
  scheduledHours: number;
  productiveHours: number;
  idleHours: number;
  utilization: number;
  risk: string;
  rowCount: number;
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

function getAgentKey(agent: AgentMasterRow): string {
  return (
    agent.agent_id ||
    agent.hp_id ||
    agent.employee_id ||
    agent.full_name ||
    agent.agent_name ||
    `${agent.first_name || ""} ${agent.last_name || ""}`.trim()
  );
}

function getUtilizationAgentKey(row: UtilizationRow): string {
  return row.agent_id || row.full_name || "";
}

function getRisk(utilization: number, idleHours: number): string {
  if (utilization === 0) return "No utilization data";
  if (utilization < 60) return "High idle risk";
  if (idleHours >= 10) return "Idle watch";
  if (utilization >= 85) return "Healthy";
  return "Monitor";
}

function getRiskClass(risk: string): string {
  if (risk === "Healthy") return "bg-green-50 text-green-700";
  if (risk === "High idle risk") return "bg-red-50 text-red-700";
  if (risk === "Idle watch") return "bg-orange-50 text-orange-700";
  return "bg-blue-50 text-blue-700";
}

export default function UtilizationPage() {
  const [agentRows, setAgentRows] = useState<AgentMasterRow[]>([]);
  const [rows, setRows] = useState<UtilizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [search, setSearch] = useState("");
  const [showAllRows, setShowAllRows] = useState(false);

  async function loadUtilization() {
    setLoading(true);

    try {
      const [masterAgents, utilizationRows] = await Promise.all([
        getGoogleSheetRows<AgentMasterRow>("Agents_Master"),
        getGoogleSheetRows<UtilizationRow>("Utilization_Daily"),
      ]);

      setAgentRows(masterAgents);
      setRows(utilizationRows);
      setLastUpdated(new Date().toLocaleString());

      await trackEvent("utilization_page_loaded", {
        masterAgentRows: masterAgents.length,
        utilizationRows: utilizationRows.length,
        source: "google_sheet",
      });
    } catch (error) {
      console.error("Utilization loading failed:", error);
      setAgentRows([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUtilization();
  }, []);

  const dataQuality = useMemo(() => {
    return calculateDataQuality(rows as Record<string, unknown>[], [
      "agent_id",
      "full_name",
      "vendor",
      "scheduled_hours",
      "productive_hours",
      "idle_hours",
      "utilization_percent",
    ]);
  }, [rows]);

  const confidence = confidenceFromDataQuality(dataQuality.score);

  const masterAgentsTotal = useMemo(() => {
    const uniqueAgents = new Set(
      agentRows.map((agent) => getAgentKey(agent)).filter(Boolean)
    );

    return uniqueAgents.size;
  }, [agentRows]);

  const activeMasterAgents = useMemo(() => {
    return agentRows.filter((agent) =>
      String(agent.status || "").toLowerCase().includes("active")
    ).length;
  }, [agentRows]);

  const utilizedAgents = useMemo(() => {
    const uniqueAgents = new Set(
      rows.map((row) => getUtilizationAgentKey(row)).filter(Boolean)
    );

    return uniqueAgents.size;
  }, [rows]);

  const vendorSummaries = useMemo<VendorSummary[]>(() => {
    const grouped = new Map<
      string,
      {
        agentIds: Set<string>;
        scheduledHours: number;
        productiveHours: number;
        idleHours: number;
        utilizationTotal: number;
        utilizationCount: number;
        rowCount: number;
      }
    >();

    rows.forEach((row) => {
      const vendor = row.vendor || "Unknown";
      const agentId = row.agent_id || row.full_name || "Unknown Agent";

      if (!grouped.has(vendor)) {
        grouped.set(vendor, {
          agentIds: new Set(),
          scheduledHours: 0,
          productiveHours: 0,
          idleHours: 0,
          utilizationTotal: 0,
          utilizationCount: 0,
          rowCount: 0,
        });
      }

      const bucket = grouped.get(vendor)!;

      bucket.rowCount += 1;
      bucket.agentIds.add(agentId);
      bucket.scheduledHours += toNumber(row.scheduled_hours);
      bucket.productiveHours += toNumber(row.productive_hours);
      bucket.idleHours += toNumber(row.idle_hours);

      const utilizationValue = toNumber(row.utilization_percent);

      if (utilizationValue > 0) {
        bucket.utilizationTotal += utilizationValue;
        bucket.utilizationCount += 1;
      }
    });

    return Array.from(grouped.entries())
      .map(([vendor, data]) => {
        const utilization =
          data.utilizationCount > 0
            ? data.utilizationTotal / data.utilizationCount
            : data.scheduledHours > 0
            ? (data.productiveHours / data.scheduledHours) * 100
            : 0;

        return {
          vendor,
          agents: data.agentIds.size,
          scheduledHours: data.scheduledHours,
          productiveHours: data.productiveHours,
          idleHours: data.idleHours,
          utilization,
          risk: getRisk(utilization, data.idleHours),
          rowCount: data.rowCount,
        };
      })
      .sort((a, b) => b.idleHours - a.idleHours);
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return rows;

    return rows.filter((row) => {
      const searchableText = [
        row.date,
        row.agent_id,
        row.full_name,
        row.vendor,
        row.scheduled_hours,
        row.productive_hours,
        row.available_hours,
        row.idle_hours,
        row.break_hours,
        row.calls_handled,
        row.utilization_percent,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [rows, search]);

  const visibleRows = showAllRows ? filteredRows : filteredRows.slice(0, 25);

  const totalIdleHours = vendorSummaries.reduce(
    (sum, vendor) => sum + vendor.idleHours,
    0
  );

  const bestVendor =
    vendorSummaries.length > 0
      ? [...vendorSummaries].sort((a, b) => b.utilization - a.utilization)[0]
      : null;

  const highestRiskVendor =
    vendorSummaries.length > 0
      ? [...vendorSummaries].sort((a, b) => b.idleHours - a.idleHours)[0]
      : null;

  const riskAlerts = vendorSummaries.filter(
    (vendor) =>
      vendor.risk === "High idle risk" ||
      vendor.risk === "Idle watch" ||
      vendor.risk === "Monitor"
  ).length;

  const rowCounts = vendorSummaries.map((vendor) => vendor.rowCount);
  const maxRows = rowCounts.length ? Math.max(...rowCounts) : 0;
  const minRows = rowCounts.length ? Math.min(...rowCounts) : 0;
  const comparisonWarning =
    maxRows > 0 && minRows > 0 && maxRows / minRows >= 3;

  async function handleExport() {
    await trackEvent("utilization_export_clicked", {
      masterAgents: masterAgentsTotal,
      activeMasterAgents,
      utilizedAgents,
      utilizationRows: rows.length,
      vendors: vendorSummaries.length,
      dataQualityScore: dataQuality.score,
      confidence: confidence.label,
    });

    const headers = [
      "Vendor",
      "Utilized Agents",
      "Rows",
      "Scheduled Hours",
      "Productive Hours",
      "Idle Hours",
      "Utilization",
      "Risk",
      "Master Agents Total",
      "Active Master Agents",
      "Data Quality Score",
      "Confidence",
    ];

    const csvRows = vendorSummaries.map((row) =>
      [
        row.vendor,
        row.agents,
        row.rowCount,
        row.scheduledHours,
        row.productiveHours,
        row.idleHours,
        `${row.utilization.toFixed(2)}%`,
        row.risk,
        masterAgentsTotal,
        activeMasterAgents,
        dataQuality.score,
        confidence.label,
      ].join(",")
    );

    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "staffforge-utilization-summary.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  async function handleCreateAction() {
    await trackEvent("utilization_create_action_clicked", {
      riskAlerts,
      idleHours: totalIdleHours,
      highestRiskVendor: highestRiskVendor?.vendor || "N/A",
      evidence: "Agents_Master + Utilization_Daily",
      dataQualityScore: dataQuality.score,
    });

    alert(
      `Action created with evidence: StaffForge found ${masterAgentsTotal} master agents and ${utilizedAgents} utilized agents in the current utilization data. Review ${
        highestRiskVendor?.vendor || "vendors"
      } first because this vendor has the highest idle-hour exposure.`
    );
  }

  function showFormula(title: string, formula: string) {
    alert(`${title}\n\n${formula}`);
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <img
            src={LOADING_GIF}
            alt="Loading utilization"
            className="mx-auto h-40 w-40 rounded-3xl object-cover"
          />

          <h2 className="mt-5 text-2xl font-black text-slate-950">
            Loading Utilization Data...
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            StaffForge is reading Agents_Master and Utilization_Daily.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-200">
          Utilization Command Center
        </p>

        <h2 className="mt-4 text-4xl font-black">
          Evidence-first utilization analysis by vendor.
        </h2>

        <p className="mt-4 max-w-4xl text-slate-300">
          This page uses <b>Agents_Master</b> for total agents and{" "}
          <b>Utilization_Daily</b> for utilization calculations.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadUtilization}
            className="sf-button sf-primary"
          >
            <RefreshCw size={18} />
            Refresh Data
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="sf-button sf-secondary"
          >
            <Download size={18} />
            Export Report
          </button>

          <button
            type="button"
            onClick={handleCreateAction}
            className="sf-button sf-secondary"
          >
            <FileSpreadsheet size={18} />
            Create Action
          </button>

          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackEvent("utilization_source_sheet_clicked", {
                source: "Staff-Forge Tool Google Sheet",
              })
            }
            className="inline-flex items-center justify-center rounded-2xl border-2 border-yellow-300 bg-yellow-400 px-5 py-3 font-black text-slate-950 shadow-lg shadow-yellow-500/30 transition hover:scale-[1.02] hover:bg-yellow-300"
          >
            Where this data is coming from? click to see
          </a>
        </div>

        {lastUpdated && (
          <p className="mt-4 text-sm text-slate-400">
            Last updated: {lastUpdated}
          </p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <div className="sf-card p-5">
          <Users className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Master Agents</p>
          <h3 className="mt-2 text-3xl font-black">{masterAgentsTotal}</h3>
          <DataSourcePill
            source="Google Sheet → Agents_Master → unique agent_id/hp_id/full_name"
            lastUpdated={lastUpdated}
          />
          <button
            type="button"
            onClick={() =>
              showFormula(
                "Master Agents",
                "Count unique agents from Agents_Master. Google Sheets row count may include the header row, so the app counts usable data rows only."
              )
            }
            className="mt-3 text-sm font-black text-blue-700"
          >
            How was this calculated?
          </button>
        </div>

        <div className="sf-card p-5">
          <Users className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Utilized Agents</p>
          <h3 className="mt-2 text-3xl font-black">{utilizedAgents}</h3>
          <DataSourcePill
            source="Google Sheet → Utilization_Daily → unique agent_id/full_name"
            lastUpdated={lastUpdated}
          />
          <button
            type="button"
            onClick={() =>
              showFormula(
                "Utilized Agents",
                "Count unique agents found in Utilization_Daily. This is not the same as total master agents."
              )
            }
            className="mt-3 text-sm font-black text-blue-700"
          >
            How was this calculated?
          </button>
        </div>

        <div className="sf-card p-5">
          <Clock className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Idle Hours</p>
          <h3 className="mt-2 text-3xl font-black">
            {formatNumber(totalIdleHours)}
          </h3>
          <DataSourcePill
            source="Google Sheet → Utilization_Daily → idle_hours"
            formula="SUM(idle_hours)"
            lastUpdated={lastUpdated}
          />
        </div>

        <div className="sf-card p-5">
          <ArrowUpRight className="mb-3 text-green-700" />
          <p className="text-sm font-bold text-slate-500">Best Vendor</p>
          <h3 className="mt-2 text-3xl font-black">
            {bestVendor ? bestVendor.vendor : "N/A"}
          </h3>
          <DataSourcePill
            source="Google Sheet → Utilization_Daily"
            formula="Highest average utilization_percent"
            lastUpdated={lastUpdated}
          />
          {comparisonWarning && (
            <p className="mt-3 rounded-xl bg-orange-50 p-3 text-xs font-bold text-orange-700">
              Vendor comparison may be incomplete because vendors have different
              data volumes.
            </p>
          )}
        </div>

        <div className="sf-card p-5">
          <AlertTriangle className="mb-3 text-orange-600" />
          <p className="text-sm font-bold text-slate-500">Data Quality Score</p>
          <h3 className="mt-2 text-3xl font-black">{dataQuality.score}%</h3>
          <p className="mt-2 text-sm text-slate-500">{dataQuality.level}</p>
          <ConfidenceBadge
            label={confidence.label}
            explanation={confidence.explanation}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <EvidenceCard title="Master agent source" type="Verified Data">
          StaffForge loaded <b>{masterAgentsTotal}</b> usable master agent
          records from <b>Google Sheet → Agents_Master</b>.
        </EvidenceCard>

        <EvidenceCard title="Utilization source" type="Verified Data">
          StaffForge loaded <b>{rows.length}</b> utilization rows from{" "}
          <b>Google Sheet → Utilization_Daily</b>. This is why utilized agents
          may be lower than total master agents.
        </EvidenceCard>

        <EvidenceCard title="Current operational result" type="Calculated Result">
          StaffForge calculated <b>{formatNumber(totalIdleHours)}</b> total idle
          hours across <b>{vendorSummaries.length}</b> vendors using{" "}
          <b>SUM(idle_hours)</b>.
        </EvidenceCard>

        <EvidenceCard title="Human review requirement" type="Needs Human Review">
          Before making staffing decisions, confirm that <b>Schedules</b> and{" "}
          <b>Call_Volume</b> are complete. Master agent count and utilization
          count measure different things.
        </EvidenceCard>
      </section>

      <section className="sf-card overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-xl font-black">Vendor Utilization Overview</h3>
          <p className="text-sm text-slate-500">
            Executive summary grouped by vendor from Utilization_Daily.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4">Vendor</th>
                <th className="p-4">Utilized Agents</th>
                <th className="p-4">Rows</th>
                <th className="p-4">Scheduled Hours</th>
                <th className="p-4">Productive Hours</th>
                <th className="p-4">Idle Hours</th>
                <th className="p-4">Utilization</th>
                <th className="p-4">Risk</th>
              </tr>
            </thead>

            <tbody>
              {vendorSummaries.map((row) => (
                <tr key={row.vendor} className="border-t border-slate-100">
                  <td className="p-4 font-black">{row.vendor}</td>
                  <td className="p-4">{row.agents}</td>
                  <td className="p-4">{row.rowCount}</td>
                  <td className="p-4">{formatNumber(row.scheduledHours)}</td>
                  <td className="p-4">{formatNumber(row.productiveHours)}</td>
                  <td className="p-4">{formatNumber(row.idleHours)}</td>
                  <td className="p-4 font-black">
                    {row.utilization.toFixed(1)}%
                  </td>
                  <td className="p-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${getRiskClass(
                        row.risk
                      )}`}
                    >
                      {row.risk}
                    </span>
                  </td>
                </tr>
              ))}

              {vendorSummaries.length === 0 && (
                <tr>
                  <td
                    className="p-6 text-center font-semibold text-slate-500"
                    colSpan={8}
                  >
                    No utilization data found. Confirm that the Google Sheet has
                    a tab named Utilization_Daily.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sf-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-black">Detailed Utilization Records</h3>
            <p className="text-sm text-slate-500">
              Showing {visibleRows.length} of {filteredRows.length} matching
              rows. Total utilization rows loaded: {rows.length}.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search vendor, agent, ID, date..."
                className="w-full outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAllRows((current) => !current)}
              className="sf-button sf-secondary"
            >
              {showAllRows ? "Show Less" : "Show All Rows"}
            </button>
          </div>
        </div>

        <div className="max-h-130 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Agent ID</th>
                <th className="p-4">Agent Name</th>
                <th className="p-4">Vendor</th>
                <th className="p-4">Scheduled</th>
                <th className="p-4">Productive</th>
                <th className="p-4">Available</th>
                <th className="p-4">Idle</th>
                <th className="p-4">Break</th>
                <th className="p-4">Calls</th>
                <th className="p-4">Utilization</th>
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row, index) => (
                <tr
                  key={`${row.agent_id || row.full_name || "row"}-${index}`}
                  className="border-t border-slate-100"
                >
                  <td className="p-4">{row.date || "-"}</td>
                  <td className="p-4">{row.agent_id || "-"}</td>
                  <td className="p-4 font-semibold">
                    {row.full_name || "Unnamed Agent"}
                  </td>
                  <td className="p-4 font-black">{row.vendor || "Unknown"}</td>
                  <td className="p-4">
                    {formatNumber(toNumber(row.scheduled_hours))}
                  </td>
                  <td className="p-4">
                    {formatNumber(toNumber(row.productive_hours))}
                  </td>
                  <td className="p-4">
                    {formatNumber(toNumber(row.available_hours))}
                  </td>
                  <td className="p-4">
                    {formatNumber(toNumber(row.idle_hours))}
                  </td>
                  <td className="p-4">
                    {formatNumber(toNumber(row.break_hours))}
                  </td>
                  <td className="p-4">
                    {formatNumber(toNumber(row.calls_handled))}
                  </td>
                  <td className="p-4 font-black">
                    {toNumber(row.utilization_percent).toFixed(1)}%
                  </td>
                </tr>
              ))}

              {visibleRows.length === 0 && (
                <tr>
                  <td
                    className="p-6 text-center font-semibold text-slate-500"
                    colSpan={11}
                  >
                    No detailed rows match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}