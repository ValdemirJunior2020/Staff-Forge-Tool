// client/src/pages/CoverageAuditPage.tsx

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getGoogleSheetRows } from "../lib/googleSheetApi";
import { trackEvent } from "../lib/firebase";

const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1QZO61rBDUUbNH-lkWrmhgADjHraZkV4wfZ_cSo0MaD8/edit?usp=sharing";

const LOADING_GIF =
  "https://cdn.dribbble.com/userupload/19368548/file/original-b0421d56cd54c90ca2d702a052f8e78c.gif";

type AnyRow = Record<string, unknown>;

type CoverageVendor = {
  vendor: string;
  sourceType: "Schedules" | "Agents_Master";
  scheduledOrMasterAgents: string[];
  utilizationAgents: string[];
  matchedAgents: string[];
  missingFromUtilization: string[];
  extraInUtilization: string[];
  matchRate: number;
  risk: "Healthy" | "Needs Review" | "Data Coverage Risk" | "No Utilization";
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalize(value: unknown): string {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
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

function uniqueClean(values: string[]): string[] {
  const seen = new Map<string, string>();

  values.forEach((value) => {
    const display = clean(value);
    const key = normalize(value);

    if (display && key && !seen.has(key)) {
      seen.set(key, display);
    }
  });

  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

function difference(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map((item) => normalize(item)));

  return left.filter((item) => !rightSet.has(normalize(item)));
}

function intersection(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map((item) => normalize(item)));

  return left.filter((item) => rightSet.has(normalize(item)));
}

function getRisk(
  matchRate: number,
  sourceCount: number,
  utilizationCount: number
): CoverageVendor["risk"] {
  if (sourceCount > 0 && utilizationCount === 0) return "No Utilization";
  if (matchRate >= 95) return "Healthy";
  if (matchRate >= 80) return "Needs Review";
  return "Data Coverage Risk";
}

function getRiskClass(risk: CoverageVendor["risk"]) {
  if (risk === "Healthy") return "bg-green-50 text-green-700";
  if (risk === "Needs Review") return "bg-yellow-50 text-yellow-700";
  if (risk === "No Utilization") return "bg-red-50 text-red-700";
  return "bg-orange-50 text-orange-700";
}

function downloadCsv(filename: string, rows: CoverageVendor[]) {
  const headers = [
    "Vendor",
    "Source Type",
    "Scheduled/Master Agents",
    "Utilization Agents",
    "Matched Agents",
    "Missing From Utilization",
    "Extra In Utilization",
    "Match Rate",
    "Risk",
  ];

  const csvRows = rows.map((row) => [
    row.vendor,
    row.sourceType,
    row.scheduledOrMasterAgents.length,
    row.utilizationAgents.length,
    row.matchedAgents.length,
    row.missingFromUtilization.length,
    row.extraInUtilization.length,
    `${row.matchRate.toFixed(1)}%`,
    row.risk,
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

export default function CoverageAuditPage() {
  const [agentsMasterRows, setAgentsMasterRows] = useState<AnyRow[]>([]);
  const [scheduleRows, setScheduleRows] = useState<AnyRow[]>([]);
  const [utilizationRows, setUtilizationRows] = useState<AnyRow[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  async function loadCoverageData() {
    setLoading(true);

    try {
      const [agentsMaster, schedules, utilization] = await Promise.all([
        getGoogleSheetRows<AnyRow>("Agents_Master"),
        getGoogleSheetRows<AnyRow>("Schedules").catch(() => []),
        getGoogleSheetRows<AnyRow>("Utilization_Daily"),
      ]);

      setAgentsMasterRows(agentsMaster);
      setScheduleRows(schedules);
      setUtilizationRows(utilization);
      setLastUpdated(new Date().toLocaleString());

      await trackEvent("coverage_audit_loaded", {
        agentsMasterRows: agentsMaster.length,
        scheduleRows: schedules.length,
        utilizationRows: utilization.length,
      });
    } catch (error) {
      console.error("Coverage audit load failed:", error);
      setAgentsMasterRows([]);
      setScheduleRows([]);
      setUtilizationRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCoverageData();
  }, []);

  const sourceType: CoverageVendor["sourceType"] =
    scheduleRows.length > 0 ? "Schedules" : "Agents_Master";

  const sourceRows = useMemo(() => {
    return scheduleRows.length > 0 ? scheduleRows : agentsMasterRows;
  }, [scheduleRows, agentsMasterRows]);

  const vendorCoverage = useMemo<CoverageVendor[]>(() => {
    const vendors = uniqueClean([
      ...sourceRows.map((row) => getVendor(row)),
      ...utilizationRows.map((row) => getVendor(row)),
    ]).filter((vendor) => vendor !== "Unknown");

    return vendors.map((vendor) => {
      const vendorSourceAgents = uniqueClean(
        sourceRows
          .filter((row) => normalize(getVendor(row)) === normalize(vendor))
          .map((row) => getAgentKey(row))
          .filter(Boolean)
      );

      const vendorUtilizationAgents = uniqueClean(
        utilizationRows
          .filter((row) => normalize(getVendor(row)) === normalize(vendor))
          .map((row) => getAgentKey(row))
          .filter(Boolean)
      );

      const matchedAgents = intersection(
        vendorSourceAgents,
        vendorUtilizationAgents
      );

      const missingFromUtilization = difference(
        vendorSourceAgents,
        vendorUtilizationAgents
      );

      const extraInUtilization = difference(
        vendorUtilizationAgents,
        vendorSourceAgents
      );

      const matchRate =
        vendorSourceAgents.length > 0
          ? (matchedAgents.length / vendorSourceAgents.length) * 100
          : 0;

      return {
        vendor,
        sourceType,
        scheduledOrMasterAgents: vendorSourceAgents,
        utilizationAgents: vendorUtilizationAgents,
        matchedAgents,
        missingFromUtilization,
        extraInUtilization,
        matchRate,
        risk: getRisk(
          matchRate,
          vendorSourceAgents.length,
          vendorUtilizationAgents.length
        ),
      };
    });
  }, [sourceRows, utilizationRows, sourceType]);

  const filteredVendors = useMemo(() => {
    return vendorCoverage.filter((vendor) => {
      const matchesVendor =
        selectedVendor === "All" || vendor.vendor === selectedVendor;

      const text = [
        vendor.vendor,
        vendor.risk,
        vendor.sourceType,
        vendor.missingFromUtilization.join(" "),
        vendor.extraInUtilization.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());

      return matchesVendor && matchesSearch;
    });
  }, [vendorCoverage, selectedVendor, search]);

  const vendorOptions = useMemo(() => {
    return ["All", ...vendorCoverage.map((item) => item.vendor)];
  }, [vendorCoverage]);

  const totals = useMemo(() => {
    const sourceAgents = vendorCoverage.reduce(
      (sum, vendor) => sum + vendor.scheduledOrMasterAgents.length,
      0
    );

    const utilizationAgents = vendorCoverage.reduce(
      (sum, vendor) => sum + vendor.utilizationAgents.length,
      0
    );

    const matchedAgents = vendorCoverage.reduce(
      (sum, vendor) => sum + vendor.matchedAgents.length,
      0
    );

    const missingAgents = vendorCoverage.reduce(
      (sum, vendor) => sum + vendor.missingFromUtilization.length,
      0
    );

    const matchRate =
      sourceAgents > 0 ? Math.round((matchedAgents / sourceAgents) * 100) : 0;

    return {
      sourceAgents,
      utilizationAgents,
      matchedAgents,
      missingAgents,
      matchRate,
      riskVendors: vendorCoverage.filter(
        (vendor) =>
          vendor.risk === "Data Coverage Risk" ||
          vendor.risk === "No Utilization"
      ).length,
    };
  }, [vendorCoverage]);

  async function handleExport() {
    downloadCsv("staffforge-coverage-audit.csv", vendorCoverage);

    await trackEvent("coverage_audit_exported", {
      vendors: vendorCoverage.length,
      missingAgents: totals.missingAgents,
      matchRate: totals.matchRate,
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <img
            src={LOADING_GIF}
            alt="Loading coverage audit"
            className="mx-auto h-44 w-44 rounded-3xl object-cover"
          />

          <h2 className="mt-5 text-2xl font-black text-slate-950">
            Loading Coverage Audit...
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            StaffForge is comparing master/schedule agents against
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
          Tableau Coverage Audit
        </p>

        <h2 className="mt-4 text-4xl font-black">
          Find agents missing from utilization before judging vendors.
        </h2>

        <p className="mt-4 max-w-5xl text-slate-300">
          This page compares <b>{sourceType}</b> against{" "}
          <b>Utilization_Daily</b>. If scheduled or master agents are missing
          from Tableau utilization, the vendor score may look worse than reality.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadCoverageData}
            className="sf-button sf-primary"
          >
            <RefreshCw size={18} />
            Refresh Audit
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="sf-button sf-secondary"
          >
            <Download size={18} />
            Export Coverage CSV
          </button>

          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackEvent("coverage_source_sheet_clicked", {
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

      <section className="grid gap-4 md:grid-cols-5">
        <div className="sf-card p-5">
          <Users className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">
            {sourceType} Agents
          </p>
          <h3 className="mt-2 text-3xl font-black">
            {totals.sourceAgents.toLocaleString()}
          </h3>
        </div>

        <div className="sf-card p-5">
          <Users className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">
            Utilization Agents
          </p>
          <h3 className="mt-2 text-3xl font-black">
            {totals.utilizationAgents.toLocaleString()}
          </h3>
        </div>

        <div className="sf-card p-5">
          <CheckCircle2 className="mb-3 text-green-700" />
          <p className="text-sm font-bold text-slate-500">Matched Agents</p>
          <h3 className="mt-2 text-3xl font-black">
            {totals.matchedAgents.toLocaleString()}
          </h3>
        </div>

        <div className="sf-card p-5">
          <AlertTriangle className="mb-3 text-orange-600" />
          <p className="text-sm font-bold text-slate-500">
            Missing From Utilization
          </p>
          <h3 className="mt-2 text-3xl font-black">
            {totals.missingAgents.toLocaleString()}
          </h3>
        </div>

        <div className="sf-card p-5">
          <ShieldCheck className="mb-3 text-red-600" />
          <p className="text-sm font-bold text-slate-500">Match Rate</p>
          <h3 className="mt-2 text-3xl font-black">{totals.matchRate}%</h3>
          <p className="mt-2 text-sm text-slate-500">
            {totals.riskVendors} vendor(s) need review
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-orange-200 bg-orange-50 p-5 text-orange-950">
        <h3 className="text-lg font-black">Why this matters</h3>
        <p className="mt-2 text-sm leading-6">
          If an agent exists in <b>{sourceType}</b> but is missing from{" "}
          <b>Utilization_Daily</b>, the tool may undercount phone hours. That
          can make a vendor look worse than reality. Treat those cases as{" "}
          <b>Data Coverage Risk</b>, not final performance failure.
        </p>
      </section>

      <section className="sf-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-xl font-black">Vendor Coverage Summary</h3>
            <p className="text-sm text-slate-500">
              Compare master/schedule agents against utilization agents.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search vendor or agent..."
                className="outline-none"
              />
            </div>

            <select
              value={selectedVendor}
              onChange={(event) => setSelectedVendor(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none"
            >
              {vendorOptions.map((vendor) => (
                <option key={vendor} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4">Vendor</th>
                <th className="p-4">Source</th>
                <th className="p-4">Source Agents</th>
                <th className="p-4">Utilization Agents</th>
                <th className="p-4">Matched</th>
                <th className="p-4">Missing</th>
                <th className="p-4">Extra In Utilization</th>
                <th className="p-4">Match Rate</th>
                <th className="p-4">Risk</th>
              </tr>
            </thead>

            <tbody>
              {filteredVendors.map((vendor) => (
                <tr key={vendor.vendor} className="border-t border-slate-100">
                  <td className="p-4 font-black">{vendor.vendor}</td>
                  <td className="p-4">{vendor.sourceType}</td>
                  <td className="p-4">
                    {vendor.scheduledOrMasterAgents.length}
                  </td>
                  <td className="p-4">{vendor.utilizationAgents.length}</td>
                  <td className="p-4">{vendor.matchedAgents.length}</td>
                  <td className="p-4 font-black text-orange-700">
                    {vendor.missingFromUtilization.length}
                  </td>
                  <td className="p-4">{vendor.extraInUtilization.length}</td>
                  <td className="p-4 font-black">
                    {vendor.matchRate.toFixed(1)}%
                  </td>
                  <td className="p-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${getRiskClass(
                        vendor.risk
                      )}`}
                    >
                      {vendor.risk}
                    </span>
                  </td>
                </tr>
              ))}

              {filteredVendors.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="p-6 text-center font-semibold text-slate-500"
                  >
                    No coverage rows found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {filteredVendors.map((vendor) => (
        <section key={`${vendor.vendor}-details`} className="sf-card p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-black">{vendor.vendor}</h3>
              <p className="text-sm text-slate-500">
                Missing agents that may need to be added/mapped in Tableau.
              </p>
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${getRiskClass(
                vendor.risk
              )}`}
            >
              {vendor.risk}
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <h4 className="font-black text-orange-900">
                Missing from Utilization
              </h4>

              <div className="mt-3 max-h-56 overflow-auto text-sm text-orange-900">
                {vendor.missingFromUtilization.length ? (
                  <ul className="space-y-1">
                    {vendor.missingFromUtilization.map((agent) => (
                      <li key={agent}>• {agent}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No missing agents found.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <h4 className="font-black text-blue-900">
                Extra in Utilization
              </h4>

              <div className="mt-3 max-h-56 overflow-auto text-sm text-blue-900">
                {vendor.extraInUtilization.length ? (
                  <ul className="space-y-1">
                    {vendor.extraInUtilization.map((agent) => (
                      <li key={agent}>• {agent}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No extra utilization-only agents found.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}