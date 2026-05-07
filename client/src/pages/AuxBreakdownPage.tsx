// client/src/pages/AuxBreakdownPage.tsx

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
} from "lucide-react";
import { getGoogleSheetRows } from "../lib/googleSheetApi";
import { trackEvent } from "../lib/firebase";

const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1QZO61rBDUUbNH-lkWrmhgADjHraZkV4wfZ_cSo0MaD8/edit?usp=sharing";

const LOADING_GIF =
  "https://cdn.dribbble.com/userupload/19368548/file/original-b0421d56cd54c90ca2d702a052f8e78c.gif";

type AnyRow = Record<string, unknown>;

type AuxRow = {
  date?: string;
  vendor?: string;
  agent_id?: string;
  full_name?: string;
  state?: string;
  state_start_time?: string;
  state_end_time?: string;
  duration_minutes?: string | number;
  hour?: string | number;
  source_tab?: string;
  notes?: string;
};

type AuxSummary = {
  state: string;
  minutes: number;
  hours: number;
  percentage: number;
  rows: number;
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

  // If value is small, it is probably hours from your existing StaffForge tab.
  // If value is over 24, it is probably already minutes.
  return numberValue <= 24 ? numberValue * 60 : numberValue;
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
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

function normalizeState(value: unknown): string {
  const state = clean(value).toLowerCase();

  if (!state) return "Unknown";
  if (state.includes("on call") || state.includes("call")) return "On Call";
  if (state.includes("available") || state.includes("avail")) return "Available";
  if (state.includes("break")) return "Break";
  if (state.includes("lunch")) return "Lunch";
  if (state.includes("offline")) return "Offline";
  if (state.includes("not ready") || state.includes("not_ready")) return "Not Ready";
  if (state.includes("meeting")) return "Meeting";
  if (state.includes("training")) return "Training";
  if (state.includes("after call") || state.includes("acw")) return "After Call Work";

  return clean(value);
}

function getRiskForState(state: string, percentage: number): string {
  if (state === "Break" && percentage > 25) return "Critical Break Risk";
  if (state === "Break" && percentage > 15) return "High break time";
  if (state === "Lunch" && percentage > 15) return "High lunch time";
  if (state === "Available" && percentage > 25) return "Possible Overstaffing / Low Volume";
  if (state === "Offline" && percentage > 10) return "Offline Risk";
  if (state === "Not Ready" && percentage > 10) return "High not-ready time";
  return "Normal";
}

function getRiskClass(risk: string): string {
  if (risk === "Normal") return "bg-green-50 text-green-700";
  if (risk.includes("Critical")) return "bg-red-100 text-red-800";
  if (risk.includes("Risk") || risk.includes("High")) return "bg-red-50 text-red-700";
  return "bg-yellow-50 text-yellow-700";
}

function deriveAuxFromUtilizationHourly(rows: AnyRow[]): AuxRow[] {
  const auxRows: AuxRow[] = [];

  rows.forEach((row, index) => {
    const date = clean(getValue(row, ["date", "Date"]));
    const vendor = getVendor(row);
    const agentId = getAgentId(row);
    const fullName = getFullName(row);
    const hour = clean(
      getValue(row, ["hour", "Hour", "hour_starting", "Hour Starting", "interval"])
    );

    const directState = clean(
      getValue(row, ["state", "State", "status", "Status", "state_name", "State Name"])
    );

    const directDuration =
      toNumber(getValue(row, ["duration_minutes", "Duration Minutes"])) ||
      minutesFromHoursOrMinutes(getValue(row, ["duration_hours", "Duration Hours"]));

    if (directState && directDuration > 0) {
      auxRows.push({
        date,
        vendor,
        agent_id: agentId,
        full_name: fullName,
        state: normalizeState(directState),
        state_start_time: clean(
          getValue(row, [
            "state_start_time",
            "State Start DateTime",
            "Status Start DateTime",
            "start_time",
          ])
        ),
        state_end_time: clean(
          getValue(row, [
            "state_end_time",
            "State End DateTime",
            "Status End DateTime",
            "end_time",
          ])
        ),
        duration_minutes: directDuration,
        hour,
        source_tab: "Utilization_Hourly",
        notes: "Auto-derived from state/status row.",
      });
      return;
    }

    const stateColumns = [
      {
        state: "On Call",
        keys: ["on_call_minutes", "On Call Minutes", "on_call_hours", "On Call Hours", "productive_minutes", "productive_hours"],
      },
      {
        state: "Available",
        keys: ["available_minutes", "Available Minutes", "available_hours", "Available Hours"],
      },
      {
        state: "Break",
        keys: ["break_minutes", "Break Minutes", "break_hours", "Break Hours"],
      },
      {
        state: "Lunch",
        keys: ["lunch_minutes", "Lunch Minutes", "lunch_hours", "Lunch Hours"],
      },
      {
        state: "Offline",
        keys: ["offline_minutes", "Offline Minutes", "offline_hours", "Offline Hours"],
      },
      {
        state: "Not Ready",
        keys: [
          "not_ready_minutes",
          "Not Ready Minutes",
          "offline_not_ready_minutes",
          "Offline / Not Ready Minutes",
        ],
      },
      {
        state: "Meeting",
        keys: ["meeting_minutes", "Meeting Minutes", "meeting_training_minutes", "Meeting / Training Minutes"],
      },
      {
        state: "Training",
        keys: ["training_minutes", "Training Minutes"],
      },
      {
        state: "After Call Work",
        keys: ["acw_minutes", "ACW Minutes", "after_call_work_minutes", "After Call Work Minutes"],
      },
    ];

    stateColumns.forEach((item) => {
      const value = getValue(row, item.keys);
      const minutes = minutesFromHoursOrMinutes(value);

      if (minutes > 0) {
        auxRows.push({
          date,
          vendor,
          agent_id: agentId,
          full_name: fullName,
          state: item.state,
          state_start_time: "",
          state_end_time: "",
          duration_minutes: minutes,
          hour,
          source_tab: "Utilization_Hourly",
          notes: `Auto-derived from ${item.state} column on row ${index + 2}.`,
        });
      }
    });
  });

  return auxRows;
}

function downloadCsv(filename: string, rows: AuxRow[]) {
  const headers = [
    "date",
    "vendor",
    "agent_id",
    "full_name",
    "state",
    "state_start_time",
    "state_end_time",
    "duration_minutes",
    "hour",
    "source_tab",
    "notes",
  ];

  const csvRows = rows.map((row) =>
    headers.map((header) => String(row[header as keyof AuxRow] ?? ""))
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

export default function AuxBreakdownPage() {
  const [rows, setRows] = useState<AuxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [sourceMessage, setSourceMessage] = useState("");
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");

  async function loadAuxData() {
    setLoading(true);

    try {
      const auxRows = await getGoogleSheetRows<AuxRow>("AUX_Breakdown").catch(
        () => []
      );

      if (auxRows.length > 0) {
        setRows(auxRows);
        setSourceMessage("Loaded directly from AUX_Breakdown.");
      } else {
        const utilizationHourlyRows = await getGoogleSheetRows<AnyRow>(
          "Utilization_Hourly"
        ).catch(() => []);

        const derivedRows = deriveAuxFromUtilizationHourly(utilizationHourlyRows);

        setRows(derivedRows);
        setSourceMessage(
          `AUX_Breakdown was empty, so StaffForge auto-derived ${derivedRows.length} AUX rows from Utilization_Hourly.`
        );
      }

      setLastUpdated(new Date().toLocaleString());

      await trackEvent("aux_breakdown_loaded", {
        source: "AUX_Breakdown or Utilization_Hourly fallback",
      });
    } catch (error) {
      console.error("AUX load failed:", error);
      setRows([]);
      setSourceMessage("No AUX data found.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAuxData();
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.toLowerCase().trim();

    return rows.filter((row) => {
      const vendor = clean(row.vendor) || "Unknown";
      const state = normalizeState(row.state);

      const matchesVendor = vendorFilter === "All" || vendor === vendorFilter;
      const matchesState = stateFilter === "All" || state === stateFilter;

      const searchableText = [
        row.date,
        row.vendor,
        row.agent_id,
        row.full_name,
        row.state,
        row.state_start_time,
        row.state_end_time,
        row.duration_minutes,
        row.hour,
        row.notes,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      return matchesVendor && matchesState && matchesSearch;
    });
  }, [rows, search, vendorFilter, stateFilter]);

  const vendors = useMemo(() => {
    return [
      "All",
      ...Array.from(new Set(rows.map((row) => clean(row.vendor) || "Unknown"))).sort(),
    ];
  }, [rows]);

  const states = useMemo(() => {
    return [
      "All",
      ...Array.from(new Set(rows.map((row) => normalizeState(row.state)))).sort(),
    ];
  }, [rows]);

  const summaries = useMemo<AuxSummary[]>(() => {
    const grouped = new Map<string, { minutes: number; rows: number }>();

    filteredRows.forEach((row) => {
      const state = normalizeState(row.state);
      const minutes = toNumber(row.duration_minutes);

      if (!grouped.has(state)) {
        grouped.set(state, {
          minutes: 0,
          rows: 0,
        });
      }

      const bucket = grouped.get(state)!;
      bucket.minutes += minutes;
      bucket.rows += 1;
    });

    const totalMinutes = Array.from(grouped.values()).reduce(
      (sum, item) => sum + item.minutes,
      0
    );

    return Array.from(grouped.entries())
      .map(([state, data]) => ({
        state,
        minutes: data.minutes,
        hours: data.minutes / 60,
        percentage:
          totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 100) : 0,
        rows: data.rows,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [filteredRows]);

  const totalMinutes = summaries.reduce((sum, item) => sum + item.minutes, 0);
  const totalHours = totalMinutes / 60;
  const highRiskStates = summaries.filter(
    (item) => getRiskForState(item.state, item.percentage) !== "Normal"
  ).length;

  async function handleExport() {
    downloadCsv("staffforge-aux-breakdown.csv", filteredRows);

    await trackEvent("aux_breakdown_exported", {
      rows: filteredRows.length,
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <img
            src={LOADING_GIF}
            alt="Loading AUX Breakdown"
            className="mx-auto h-44 w-44 rounded-3xl object-cover"
          />

          <h2 className="mt-5 text-2xl font-black text-slate-950">
            Loading AUX Breakdown...
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            Reading AUX_Breakdown. If empty, using Utilization_Hourly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-200">
          AUX Breakdown
        </p>

        <h2 className="mt-4 text-4xl font-black">
          Understand what agents are doing outside active calls.
        </h2>

        <p className="mt-4 max-w-5xl text-slate-300">
          AUX means auxiliary time — agent time outside active call handling,
          such as Available, Break, Lunch, Meeting, Training, Offline, Not Ready,
          or After Call Work.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={loadAuxData} className="sf-button sf-primary">
            <RefreshCw size={18} />
            Refresh AUX
          </button>

          <button type="button" onClick={handleExport} className="sf-button sf-secondary">
            <Download size={18} />
            Export AUX CSV
          </button>

          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackEvent("aux_source_sheet_clicked", {
                source: "Staff-Forge Tool Google Sheet",
                tab: "AUX_Breakdown / Utilization_Hourly",
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
          <Clock className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Total AUX Hours</p>
          <h3 className="mt-2 text-3xl font-black">{formatNumber(totalHours)}</h3>
        </div>

        <div className="sf-card p-5">
          <BarChart3 className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">AUX States</p>
          <h3 className="mt-2 text-3xl font-black">{summaries.length}</h3>
        </div>

        <div className="sf-card p-5">
          <AlertTriangle className="mb-3 text-orange-600" />
          <p className="text-sm font-bold text-slate-500">High Risk States</p>
          <h3 className="mt-2 text-3xl font-black">{highRiskStates}</h3>
        </div>

        <div className="sf-card p-5">
          <CheckCircle2 className="mb-3 text-green-700" />
          <p className="text-sm font-bold text-slate-500">Rows Loaded</p>
          <h3 className="mt-2 text-3xl font-black">{rows.length}</h3>
        </div>
      </section>

      <section className="rounded-3xl border border-orange-200 bg-orange-50 p-5 text-orange-950">
        <h3 className="text-lg font-black">Break accuracy warning</h3>
        <p className="mt-2 text-sm leading-6">
          Best accuracy requires exact <b>state_start_time</b> and{" "}
          <b>state_end_time</b>. If an agent is on break from 9:55 to 10:05,
          StaffForge should count 5 minutes in the 9 AM hour and 5 minutes in
          the 10 AM hour — not the whole hour as break.
        </p>
      </section>

      <section className="sf-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-xl font-black">AUX State Summary</h3>
            <p className="text-sm text-slate-500">
              Auto-calculated from AUX_Breakdown or Utilization_Hourly.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search AUX rows..."
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
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none"
            >
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4">State</th>
                <th className="p-4">Rows</th>
                <th className="p-4">Minutes</th>
                <th className="p-4">Hours</th>
                <th className="p-4">% of AUX</th>
                <th className="p-4">Risk</th>
              </tr>
            </thead>

            <tbody>
              {summaries.map((item) => {
                const risk = getRiskForState(item.state, item.percentage);

                return (
                  <tr key={item.state} className="border-t border-slate-100">
                    <td className="p-4 font-black">{item.state}</td>
                    <td className="p-4">{item.rows}</td>
                    <td className="p-4">{formatNumber(item.minutes)}</td>
                    <td className="p-4">{formatNumber(item.hours)}</td>
                    <td className="p-4 font-black">{item.percentage}%</td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${getRiskClass(
                          risk
                        )}`}
                      >
                        {risk}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {summaries.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center font-semibold text-slate-500">
                    No AUX data found in AUX_Breakdown or Utilization_Hourly.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sf-card overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-xl font-black">Raw AUX Records</h3>
          <p className="text-sm text-slate-500">
            Derived row-level AUX/status records.
          </p>
        </div>

        <div className="max-h-130 overflow-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Vendor</th>
                <th className="p-4">Agent ID</th>
                <th className="p-4">Name</th>
                <th className="p-4">State</th>
                <th className="p-4">Start</th>
                <th className="p-4">End</th>
                <th className="p-4">Minutes</th>
                <th className="p-4">Hour</th>
                <th className="p-4">Source</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={`${row.agent_id}-${row.state}-${index}`} className="border-t border-slate-100">
                  <td className="p-4">{row.date || "-"}</td>
                  <td className="p-4 font-bold">{row.vendor || "-"}</td>
                  <td className="p-4">{row.agent_id || "-"}</td>
                  <td className="p-4">{row.full_name || "-"}</td>
                  <td className="p-4 font-black">{normalizeState(row.state)}</td>
                  <td className="p-4">{row.state_start_time || "-"}</td>
                  <td className="p-4">{row.state_end_time || "-"}</td>
                  <td className="p-4">{formatNumber(toNumber(row.duration_minutes))}</td>
                  <td className="p-4">{row.hour || "-"}</td>
                  <td className="p-4">{row.source_tab || "-"}</td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-6 text-center font-semibold text-slate-500">
                    No AUX rows match your filters.
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