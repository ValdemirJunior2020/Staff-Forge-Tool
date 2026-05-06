// client/src/pages/EtlImportsPage.tsx

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  Table2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { getGoogleSheetRows } from "../lib/googleSheetApi";
import { trackEvent } from "../lib/firebase";

const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1QZO61rBDUUbNH-lkWrmhgADjHraZkV4wfZ_cSo0MaD8/edit?usp=sharing";

type TabStatus = {
  tabName: string;
  purpose: string;
  required: boolean;
  status: "checking" | "healthy" | "empty" | "missing";
  rows: number;
  message: string;
};

const requiredTabs: Omit<TabStatus, "status" | "rows" | "message">[] = [
  {
    tabName: "Agents_Master",
    purpose: "Master list of all agents, vendors, roles, sites, and status.",
    required: true,
  },
  {
    tabName: "Utilization_Daily",
    purpose:
      "Daily utilization records used for idle time, productive time, and vendor performance.",
    required: true,
  },
  {
    tabName: "Utilization_Hourly",
    purpose:
      "Hourly utilization by state such as available, break, offline, and on call.",
    required: false,
  },
  {
    tabName: "Schedules",
    purpose:
      "Agent schedules, shift start/end, lunch, and breaks for staffing comparison.",
    required: false,
  },
  {
    tabName: "Call_Volume",
    purpose:
      "Offered calls, answered calls, abandoned calls, AHT, and service level by hour.",
    required: false,
  },
  {
    tabName: "Vendor_Targets",
    purpose:
      "Vendor goals such as target utilization, occupancy, service level, and shrinkage.",
    required: false,
  },
  {
    tabName: "Dashboard",
    purpose: "Optional summary tab for business-level notes and executive KPIs.",
    required: false,
  },
  {
    tabName: "Data_Profile",
    purpose:
      "Import profile and workbook audit details generated from the source files.",
    required: false,
  },
  {
    tabName: "README",
    purpose: "Instructions explaining how the StaffForge Google Sheet works.",
    required: false,
  },
];

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export default function EtlImportsPage() {
  const [tabs, setTabs] = useState<TabStatus[]>(
    requiredTabs.map((tab) => ({
      ...tab,
      status: "checking",
      rows: 0,
      message: "Waiting for scan",
    }))
  );

  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<string>("Agents_Master");
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function scanTabs() {
    setLoading(true);

    const results: TabStatus[] = [];

    for (const tab of requiredTabs) {
      try {
        const rows = await getGoogleSheetRows<Record<string, unknown>>(
          tab.tabName
        );

        if (rows.length > 0) {
          results.push({
            ...tab,
            status: "healthy",
            rows: rows.length,
            message: `${rows.length} rows loaded successfully`,
          });
        } else {
          results.push({
            ...tab,
            status: "empty",
            rows: 0,
            message: "Tab exists but has no rows yet",
          });
        }
      } catch (error) {
        console.error(`Failed to read ${tab.tabName}:`, error);

        results.push({
          ...tab,
          status: "missing",
          rows: 0,
          message: "Could not read this tab",
        });
      }
    }

    setTabs(results);

    await trackEvent("etl_import_scan_completed", {
      tabsScanned: results.length,
      healthyTabs: results.filter((tab) => tab.status === "healthy").length,
      emptyTabs: results.filter((tab) => tab.status === "empty").length,
      missingTabs: results.filter((tab) => tab.status === "missing").length,
    });

    setLoading(false);
  }

  async function loadPreview(tabName: string) {
    setSelectedTab(tabName);
    setPreviewLoading(true);

    try {
      const rows = await getGoogleSheetRows<Record<string, unknown>>(tabName);
      setPreviewRows(rows.slice(0, 25));

      await trackEvent("etl_tab_preview_loaded", {
        tabName,
        previewRows: rows.slice(0, 25).length,
        totalRows: rows.length,
      });
    } catch (error) {
      console.error(`Preview failed for ${tabName}:`, error);
      setPreviewRows([]);
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    scanTabs();
    loadPreview("Agents_Master");
  }, []);

  const totals = useMemo(() => {
    return {
      healthy: tabs.filter((tab) => tab.status === "healthy").length,
      empty: tabs.filter((tab) => tab.status === "empty").length,
      missing: tabs.filter((tab) => tab.status === "missing").length,
      requiredMissing: tabs.filter(
        (tab) => tab.required && tab.status !== "healthy"
      ).length,
      totalRows: tabs.reduce((sum, tab) => sum + tab.rows, 0),
    };
  }, [tabs]);

  const previewHeaders = useMemo(() => {
    if (previewRows.length === 0) return [];

    return Object.keys(previewRows[0]);
  }, [previewRows]);

  function exportStatus() {
    downloadCsv(
      "staffforge-etl-import-status.csv",
      ["Tab", "Required", "Status", "Rows", "Purpose", "Message"],
      tabs.map((tab) => [
        tab.tabName,
        tab.required ? "Yes" : "No",
        tab.status,
        String(tab.rows),
        tab.purpose,
        tab.message,
      ])
    );
  }

  function statusBadge(tab: TabStatus) {
    if (tab.status === "healthy") {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700">
          <CheckCircle2 size={14} />
          Healthy
        </span>
      );
    }

    if (tab.status === "empty") {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-yellow-50 px-3 py-1 text-xs font-black text-yellow-700">
          <AlertTriangle size={14} />
          Empty
        </span>
      );
    }

    if (tab.status === "missing") {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
          <XCircle size={14} />
          Missing
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
        <RefreshCw size={14} />
        Checking
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-200">
          ETL Import Control Room
        </p>

        <h2 className="mt-4 text-4xl font-black">
          Google Sheet data pipeline health check.
        </h2>

        <p className="mt-4 max-w-4xl text-slate-300">
          This page verifies the StaffForge Google Sheet tabs that feed the
          dashboard, utilization engine, forecasting, and audit-ready reports.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={scanTabs}
            className="sf-button sf-primary"
          >
            <RefreshCw size={18} />
            {loading ? "Scanning..." : "Scan Google Sheet"}
          </button>

          <button
            type="button"
            onClick={exportStatus}
            className="sf-button sf-secondary"
          >
            <Download size={18} />
            Export Status
          </button>

          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackEvent("etl_google_sheet_opened", {
                source: "Staff-Forge Tool Google Sheet",
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-yellow-300 bg-yellow-400 px-5 py-3 font-black text-slate-950 shadow-lg shadow-yellow-500/30 transition hover:scale-[1.02] hover:bg-yellow-300"
          >
            <ExternalLink size={18} />
            Open StaffForge Google Sheet
          </a>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <div className="sf-card p-5">
          <ShieldCheck className="mb-3 text-green-700" />
          <p className="text-sm font-bold text-slate-500">Healthy Tabs</p>
          <h3 className="mt-2 text-3xl font-black">{totals.healthy}</h3>
        </div>

        <div className="sf-card p-5">
          <AlertTriangle className="mb-3 text-yellow-700" />
          <p className="text-sm font-bold text-slate-500">Empty Tabs</p>
          <h3 className="mt-2 text-3xl font-black">{totals.empty}</h3>
        </div>

        <div className="sf-card p-5">
          <XCircle className="mb-3 text-red-700" />
          <p className="text-sm font-bold text-slate-500">Missing Tabs</p>
          <h3 className="mt-2 text-3xl font-black">{totals.missing}</h3>
        </div>

        <div className="sf-card p-5">
          <Database className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Total Rows</p>
          <h3 className="mt-2 text-3xl font-black">{totals.totalRows}</h3>
        </div>

        <div className="sf-card p-5">
          <FileSpreadsheet className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Required Issues</p>
          <h3 className="mt-2 text-3xl font-black">
            {totals.requiredMissing}
          </h3>
        </div>
      </section>

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-blue-950">
        <div className="flex items-start gap-3">
          <UploadCloud className="mt-1 text-blue-700" />
          <div>
            <h3 className="text-lg font-black">Import Status</h3>
            <p className="mt-1 text-sm leading-6">
              StaffForge is currently using Google Sheets as the live data
              source. A tab marked <b>Healthy</b> means the app can read it and
              found rows. A tab marked <b>Empty</b> means the tab exists but
              needs data. Required tabs should stay healthy.
            </p>
          </div>
        </div>
      </section>

      <section className="sf-card overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-xl font-black">Sheet Tabs Used by StaffForge</h3>
          <p className="text-sm text-slate-500">
            Click Preview to inspect the first 25 rows from any tab.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4">Tab</th>
                <th className="p-4">Required</th>
                <th className="p-4">Status</th>
                <th className="p-4">Rows</th>
                <th className="p-4">Purpose</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>

            <tbody>
              {tabs.map((tab) => (
                <tr key={tab.tabName} className="border-t border-slate-100">
                  <td className="p-4 font-black">{tab.tabName}</td>
                  <td className="p-4">{tab.required ? "Yes" : "No"}</td>
                  <td className="p-4">{statusBadge(tab)}</td>
                  <td className="p-4 font-black">{tab.rows}</td>
                  <td className="p-4">{tab.purpose}</td>
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => loadPreview(tab.tabName)}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
                    >
                      Preview
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sf-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-black">Preview: {selectedTab}</h3>
            <p className="text-sm text-slate-500">
              First 25 rows from the selected Google Sheet tab.
            </p>
          </div>

          {previewLoading && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              Loading preview...
            </span>
          )}
        </div>

        <div className="max-h-130 overflow-auto">
          {previewRows.length === 0 ? (
            <div className="p-8 text-center font-semibold text-slate-500">
              No preview rows found for this tab.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-600">
                <tr>
                  {previewHeaders.map((header) => (
                    <th key={header} className="whitespace-nowrap p-3">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    {previewHeaders.map((header) => (
                      <td key={header} className="whitespace-nowrap p-3">
                        {String(row[header] ?? "-")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}