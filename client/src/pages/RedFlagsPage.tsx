// client/src/pages/RedFlagsPage.tsx

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { getGoogleSheetRows } from "../lib/googleSheetApi";
import { trackEvent } from "../lib/firebase";

const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1QZO61rBDUUbNH-lkWrmhgADjHraZkV4wfZ_cSo0MaD8/edit?usp=sharing";

const LOADING_GIF =
  "https://cdn.dribbble.com/userupload/19368548/file/original-b0421d56cd54c90ca2d702a052f8e78c.gif";

type AnyRow = Record<string, unknown>;

type RedFlagRow = {
  flag_id?: string;
  date?: string;
  vendor?: string;
  agent_id?: string;
  full_name?: string;
  flag_type?: string;
  severity?: string;
  description?: string;
  source_tab?: string;
  recommended_action?: string;
  status?: string;
  owner?: string;
  created_at?: string;
  resolved_at?: string;
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

function minutesFromHoursOrMinutes(value: unknown): number {
  const numberValue = toNumber(value);
  if (numberValue <= 0) return 0;
  return numberValue <= 24 ? numberValue * 60 : numberValue;
}

function getValue(row: AnyRow, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && clean(row[key]) !== "") {
      return row[key];
    }
  }

  return "";
}

function getVendor(row: AnyRow): string {
  return (
    clean(
      getValue(row, [
        "vendor",
        "Vendor",
        "call_center",
        "Call Center",
        "callCenter",
        "bpo",
        "BPO",
        "site",
        "Site",
      ])
    ) || "Unknown"
  );
}

function getAgentId(row: AnyRow): string {
  return clean(
    getValue(row, [
      "agent_id",
      "Agent ID",
      "hp_id",
      "HP ID",
      "employee_id",
      "Employee ID",
      "Tableau ID",
      "tableau_id",
    ])
  );
}

function getFullName(row: AnyRow): string {
  const direct = clean(
    getValue(row, [
      "full_name",
      "Full Name",
      "agent_name",
      "Agent Name",
      "Agent",
      "name",
    ])
  );

  if (direct) return direct;

  const first = clean(getValue(row, ["first_name", "First Name"]));
  const last = clean(getValue(row, ["last_name", "Last Name"]));

  return `${first} ${last}`.trim();
}

function getUtilization(row: AnyRow): number {
  const value =
    toNumber(getValue(row, ["utilization_percent", "Utilization %", "utilization"])) ||
    0;

  if (value > 0 && value <= 1) return value * 100;
  return value;
}

function normalizeSeverity(value: unknown): string {
  const severity = clean(value).toLowerCase();

  if (severity.includes("critical")) return "Critical";
  if (severity.includes("high")) return "High";
  if (severity.includes("medium")) return "Medium";
  if (severity.includes("low")) return "Low";

  return clean(value) || "Needs Review";
}

function getSeverityClass(severity: string): string {
  if (severity === "Critical") return "bg-red-100 text-red-800";
  if (severity === "High") return "bg-red-50 text-red-700";
  if (severity === "Medium") return "bg-yellow-50 text-yellow-700";
  if (severity === "Low") return "bg-blue-50 text-blue-700";
  return "bg-orange-50 text-orange-700";
}

function getStatusClass(status: string): string {
  const normalized = clean(status).toLowerCase();

  if (normalized.includes("resolved")) return "bg-green-50 text-green-700";
  if (normalized.includes("closed")) return "bg-green-50 text-green-700";
  if (normalized.includes("progress")) return "bg-blue-50 text-blue-700";
  if (normalized.includes("open")) return "bg-red-50 text-red-700";

  return "bg-orange-50 text-orange-700";
}

function getHourlyMinutes(row: AnyRow, keys: string[]): number {
  return minutesFromHoursOrMinutes(getValue(row, keys));
}

function generateRedFlagsFromData(
  dailyRows: AnyRow[],
  hourlyRows: AnyRow[]
): RedFlagRow[] {
  const flags: RedFlagRow[] = [];

  dailyRows.forEach((row, index) => {
    const date = clean(getValue(row, ["date", "Date"]));
    const vendor = getVendor(row);
    const agentId = getAgentId(row);
    const fullName = getFullName(row);
    const utilization = getUtilization(row);
    const idleHours = toNumber(getValue(row, ["idle_hours", "Idle Hours"]));

    if (utilization > 0 && utilization < 60) {
      flags.push({
        flag_id: `UTIL-CRITICAL-${index + 1}`,
        date,
        vendor,
        agent_id: agentId,
        full_name: fullName,
        flag_type: "Utilization below 60%",
        severity: "Critical",
        description: `${fullName || agentId || vendor} has ${utilization.toFixed(
          1
        )}% utilization, below the 60% critical threshold.`,
        source_tab: "Utilization_Daily",
        recommended_action:
          "Review schedule adherence, AUX usage, call volume, and Tableau mapping before judging performance.",
        status: "Open",
        owner: "Operations",
        created_at: new Date().toLocaleString(),
      });
    } else if (utilization >= 60 && utilization < 70) {
      flags.push({
        flag_id: `UTIL-REVIEW-${index + 1}`,
        date,
        vendor,
        agent_id: agentId,
        full_name: fullName,
        flag_type: "Utilization between 60% and 70%",
        severity: "Medium",
        description: `${fullName || agentId || vendor} has ${utilization.toFixed(
          1
        )}% utilization and needs review.`,
        source_tab: "Utilization_Daily",
        recommended_action:
          "Check if this is caused by call volume, staffing, breaks, or available time.",
        status: "Open",
        owner: "Operations",
        created_at: new Date().toLocaleString(),
      });
    }

    if (idleHours > 0) {
      flags.push({
        flag_id: `IDLE-${index + 1}`,
        date,
        vendor,
        agent_id: agentId,
        full_name: fullName,
        flag_type: "Idle / Available Exposure",
        severity: idleHours >= 8 ? "High" : "Medium",
        description: `${fullName || agentId || vendor} has ${idleHours.toFixed(
          2
        )} idle hours in Utilization_Daily.`,
        source_tab: "Utilization_Daily",
        recommended_action:
          "Compare idle time against call arrivals, schedule coverage, and available AUX state.",
        status: "Open",
        owner: "WFM / Vendor Ops",
        created_at: new Date().toLocaleString(),
      });
    }
  });

  const grouped = new Map<
    string,
    {
      date: string;
      vendor: string;
      agent_id: string;
      full_name: string;
      onCall: number;
      available: number;
      breakTime: number;
      offline: number;
      logged: number;
    }
  >();

  hourlyRows.forEach((row) => {
    const vendor = getVendor(row);
    const agentId = getAgentId(row);
    const fullName = getFullName(row);
    const date = clean(getValue(row, ["date", "Date"]));
    const key = `${vendor}__${agentId || fullName || "unknown"}__${date}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        date,
        vendor,
        agent_id: agentId,
        full_name: fullName,
        onCall: 0,
        available: 0,
        breakTime: 0,
        offline: 0,
        logged: 0,
      });
    }

    const bucket = grouped.get(key)!;

    const onCall = getHourlyMinutes(row, [
      "on_call_minutes",
      "On Call Minutes",
      "on_call_hours",
      "On Call Hours",
      "productive_minutes",
      "productive_hours",
    ]);

    const available = getHourlyMinutes(row, [
      "available_minutes",
      "Available Minutes",
      "available_hours",
      "Available Hours",
    ]);

    const breakTime = getHourlyMinutes(row, [
      "break_minutes",
      "Break Minutes",
      "break_hours",
      "Break Hours",
    ]);

    const offline = getHourlyMinutes(row, [
      "offline_minutes",
      "Offline Minutes",
      "offline_hours",
      "Offline Hours",
      "not_ready_minutes",
      "Not Ready Minutes",
      "Offline / Not Ready Minutes",
    ]);

    const logged =
      getHourlyMinutes(row, ["logged_minutes", "Login Minutes", "logged_hours", "Logged Hours"]) ||
      onCall + available + breakTime + offline;

    bucket.onCall += onCall;
    bucket.available += available;
    bucket.breakTime += breakTime;
    bucket.offline += offline;
    bucket.logged += logged;
  });

  Array.from(grouped.values()).forEach((item, index) => {
    if (item.logged <= 0) return;

    const onCallPct = (item.onCall / item.logged) * 100;
    const availablePct = (item.available / item.logged) * 100;
    const breakPct = (item.breakTime / item.logged) * 100;
    const offlinePct = (item.offline / item.logged) * 100;

    if (item.onCall <= 0.01) {
      flags.push({
        flag_id: `ZERO-ONCALL-${index + 1}`,
        date: item.date,
        vendor: item.vendor,
        agent_id: item.agent_id,
        full_name: item.full_name,
        flag_type: "Zero On Call Time",
        severity: "Critical",
        description: `${item.full_name || item.agent_id} has logged time but zero on-call time.`,
        source_tab: "Utilization_Hourly",
        recommended_action:
          "Audit the agent. Confirm if they were scheduled, missing from Tableau, or in non-call AUX status all day.",
        status: "Open",
        owner: "Operations",
        created_at: new Date().toLocaleString(),
      });
    }

    if (onCallPct < 35) {
      flags.push({
        flag_id: `LOW-PROD-${index + 1}`,
        date: item.date,
        vendor: item.vendor,
        agent_id: item.agent_id,
        full_name: item.full_name,
        flag_type: "Low Paid-Time Productivity",
        severity: "High",
        description: `${item.full_name || item.agent_id} has only ${onCallPct.toFixed(
          1
        )}% on-call time compared to logged time.`,
        source_tab: "Utilization_Hourly",
        recommended_action:
          "Review AUX mapping, schedule adherence, and whether the agent was available during low volume.",
        status: "Open",
        owner: "WFM / Vendor Ops",
        created_at: new Date().toLocaleString(),
      });
    }

    if (availablePct > 25) {
      flags.push({
        flag_id: `AVAILABLE-${index + 1}`,
        date: item.date,
        vendor: item.vendor,
        agent_id: item.agent_id,
        full_name: item.full_name,
        flag_type: "Possible Overstaffing / Low Volume",
        severity: "Medium",
        description: `${item.full_name || item.agent_id} has ${availablePct.toFixed(
          1
        )}% available time.`,
        source_tab: "Utilization_Hourly",
        recommended_action:
          "Compare staffing interval to call arrival volume and consider reallocation.",
        status: "Open",
        owner: "WFM",
        created_at: new Date().toLocaleString(),
      });
    }

    if (breakPct > 25) {
      flags.push({
        flag_id: `BREAK-${index + 1}`,
        date: item.date,
        vendor: item.vendor,
        agent_id: item.agent_id,
        full_name: item.full_name,
        flag_type: "Critical Break Risk",
        severity: "Critical",
        description: `${item.full_name || item.agent_id} has ${breakPct.toFixed(
          1
        )}% break time.`,
        source_tab: "Utilization_Hourly",
        recommended_action:
          "Ask vendor to explain high break percentage and validate raw status intervals.",
        status: "Open",
        owner: "Vendor Ops",
        created_at: new Date().toLocaleString(),
      });
    }

    if (offlinePct > 10) {
      flags.push({
        flag_id: `OFFLINE-${index + 1}`,
        date: item.date,
        vendor: item.vendor,
        agent_id: item.agent_id,
        full_name: item.full_name,
        flag_type: "Offline Risk",
        severity: "High",
        description: `${item.full_name || item.agent_id} has ${offlinePct.toFixed(
          1
        )}% offline/not-ready time.`,
        source_tab: "Utilization_Hourly",
        recommended_action:
          "Review offline reason codes, meetings, coaching, system issues, or status abuse.",
        status: "Open",
        owner: "Operations",
        created_at: new Date().toLocaleString(),
      });
    }
  });

  return flags;
}

function downloadCsv(filename: string, rows: RedFlagRow[]) {
  const headers = [
    "flag_id",
    "date",
    "vendor",
    "agent_id",
    "full_name",
    "flag_type",
    "severity",
    "description",
    "source_tab",
    "recommended_action",
    "status",
    "owner",
    "created_at",
    "resolved_at",
  ];

  const csvRows = rows.map((row) =>
    headers.map((header) => String(row[header as keyof RedFlagRow] ?? ""))
  );

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

export default function RedFlagsPage() {
  const [rows, setRows] = useState<RedFlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [sourceMessage, setSourceMessage] = useState("");
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  async function loadRedFlags() {
    setLoading(true);

    try {
      const manualRedFlags = await getGoogleSheetRows<RedFlagRow>("Red_Flags").catch(
        () => []
      );

      if (manualRedFlags.length > 0) {
        setRows(manualRedFlags);
        setSourceMessage("Loaded directly from Red_Flags.");
      } else {
        const [dailyRows, hourlyRows] = await Promise.all([
          getGoogleSheetRows<AnyRow>("Utilization_Daily").catch(() => []),
          getGoogleSheetRows<AnyRow>("Utilization_Hourly").catch(() => []),
        ]);

        const generated = generateRedFlagsFromData(dailyRows, hourlyRows);

        setRows(generated);
        setSourceMessage(
          `Red_Flags was empty, so StaffForge auto-generated ${generated.length} red flags from Utilization_Daily and Utilization_Hourly.`
        );
      }

      setLastUpdated(new Date().toLocaleString());

      await trackEvent("red_flags_loaded", {
        source: "Red_Flags or auto-generated",
      });
    } catch (error) {
      console.error("Red Flags load failed:", error);
      setRows([]);
      setSourceMessage("No red flags could be generated.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRedFlags();
  }, []);

  const vendors = useMemo(() => {
    return [
      "All",
      ...Array.from(new Set(rows.map((row) => clean(row.vendor) || "Unknown"))).sort(),
    ];
  }, [rows]);

  const severities = useMemo(() => {
    return [
      "All",
      ...Array.from(new Set(rows.map((row) => normalizeSeverity(row.severity)))).sort(),
    ];
  }, [rows]);

  const statuses = useMemo(() => {
    return [
      "All",
      ...Array.from(new Set(rows.map((row) => clean(row.status) || "Open"))).sort(),
    ];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.toLowerCase().trim();

    return rows.filter((row) => {
      const vendor = clean(row.vendor) || "Unknown";
      const severity = normalizeSeverity(row.severity);
      const status = clean(row.status) || "Open";

      const matchesVendor = vendorFilter === "All" || vendor === vendorFilter;
      const matchesSeverity =
        severityFilter === "All" || severity === severityFilter;
      const matchesStatus = statusFilter === "All" || status === statusFilter;

      const searchableText = [
        row.flag_id,
        row.date,
        row.vendor,
        row.agent_id,
        row.full_name,
        row.flag_type,
        row.severity,
        row.description,
        row.source_tab,
        row.recommended_action,
        row.status,
        row.owner,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      return matchesVendor && matchesSeverity && matchesStatus && matchesSearch;
    });
  }, [rows, search, vendorFilter, severityFilter, statusFilter]);

  const openFlags = rows.filter(
    (row) => !clean(row.status).toLowerCase().includes("resolved")
  ).length;

  const criticalFlags = rows.filter(
    (row) => normalizeSeverity(row.severity) === "Critical"
  ).length;

  const highFlags = rows.filter(
    (row) => normalizeSeverity(row.severity) === "High"
  ).length;

  const resolvedFlags = rows.filter((row) =>
    clean(row.status).toLowerCase().includes("resolved")
  ).length;

  async function handleExport() {
    downloadCsv("staffforge-red-flags.csv", filteredRows);

    await trackEvent("red_flags_exported", {
      rows: filteredRows.length,
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <img
            src={LOADING_GIF}
            alt="Loading red flags"
            className="mx-auto h-44 w-44 rounded-3xl object-cover"
          />

          <h2 className="mt-5 text-2xl font-black text-slate-950">
            Loading Red Flags...
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            Reading Red_Flags. If empty, generating from utilization data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-200">
          Red Flags Command Center
        </p>

        <h2 className="mt-4 text-4xl font-black">
          One place for operational risk.
        </h2>

        <p className="mt-4 max-w-5xl text-slate-300">
          StaffForge reads Red_Flags first. If empty, it auto-generates red
          flags from Utilization_Daily and Utilization_Hourly using the old
          operations rules.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={loadRedFlags} className="sf-button sf-primary">
            <RefreshCw size={18} />
            Refresh Red Flags
          </button>

          <button type="button" onClick={handleExport} className="sf-button sf-secondary">
            <Download size={18} />
            Export Red Flags
          </button>

          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackEvent("red_flags_source_sheet_clicked", {
                source: "Staff-Forge Tool Google Sheet",
                tab: "Red_Flags / Utilization fallback",
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-yellow-300 bg-yellow-400 px-5 py-3 font-black text-slate-950 shadow-lg shadow-yellow-500/30 transition hover:scale-[1.02] hover:bg-yellow-300"
          >
            <ExternalLink size={18} />
            Where this data is coming from? click to see
          </a>
        </div>

        <p className="mt-4 text-sm text-slate-300">{sourceMessage}</p>

        {lastUpdated && (
          <p className="mt-2 text-sm text-slate-400">Last updated: {lastUpdated}</p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="sf-card p-5">
          <AlertTriangle className="mb-3 text-red-600" />
          <p className="text-sm font-bold text-slate-500">Open Flags</p>
          <h3 className="mt-2 text-3xl font-black">{openFlags}</h3>
        </div>

        <div className="sf-card p-5">
          <AlertTriangle className="mb-3 text-red-700" />
          <p className="text-sm font-bold text-slate-500">Critical</p>
          <h3 className="mt-2 text-3xl font-black">{criticalFlags}</h3>
        </div>

        <div className="sf-card p-5">
          <ShieldCheck className="mb-3 text-orange-600" />
          <p className="text-sm font-bold text-slate-500">High Risk</p>
          <h3 className="mt-2 text-3xl font-black">{highFlags}</h3>
        </div>

        <div className="sf-card p-5">
          <CheckCircle2 className="mb-3 text-green-700" />
          <p className="text-sm font-bold text-slate-500">Resolved</p>
          <h3 className="mt-2 text-3xl font-black">{resolvedFlags}</h3>
        </div>
      </section>

      <section className="sf-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-xl font-black">Operational Red Flags</h3>
            <p className="text-sm text-slate-500">
              Generated from your real Google Sheet data when Red_Flags is empty.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search red flags..."
                className="outline-none"
              />
            </div>

            <select
              value={vendorFilter}
              onChange={(event) => setVendorFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none"
            >
              {vendors.map((vendor) => (
                <option key={vendor} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>

            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none"
            >
              {severities.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Vendor</th>
                <th className="p-4">Agent</th>
                <th className="p-4">Flag Type</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Description</th>
                <th className="p-4">Source</th>
                <th className="p-4">Recommended Action</th>
                <th className="p-4">Owner</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row, index) => {
                const severity = normalizeSeverity(row.severity);
                const status = clean(row.status) || "Open";

                return (
                  <tr key={`${row.flag_id || index}`} className="border-t border-slate-100">
                    <td className="p-4">{row.date || "-"}</td>
                    <td className="p-4 font-black">{row.vendor || "-"}</td>
                    <td className="p-4">
                      <div className="font-bold">{row.full_name || "-"}</div>
                      <div className="text-xs text-slate-500">{row.agent_id || "-"}</div>
                    </td>
                    <td className="p-4 font-bold">{row.flag_type || "-"}</td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${getSeverityClass(
                          severity
                        )}`}
                      >
                        {severity}
                      </span>
                    </td>
                    <td className="p-4">{row.description || "-"}</td>
                    <td className="p-4">{row.source_tab || "-"}</td>
                    <td className="p-4">{row.recommended_action || "-"}</td>
                    <td className="p-4">{row.owner || "-"}</td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                          status
                        )}`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-6 text-center font-semibold text-slate-500">
                    No red flags found in Red_Flags, Utilization_Daily, or Utilization_Hourly.
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