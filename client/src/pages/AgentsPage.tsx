// client/src/pages/AgentsPage.tsx

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search, Users } from "lucide-react";
import { getGoogleSheetRows } from "../lib/googleSheetApi";
import { trackEvent } from "../lib/firebase";

const MASTER_AGENTS_LOADING_GIF =
  "https://media1.tenor.com/m/IfbOs_yh89AAAAAC/loading-buffering.gif";

const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1QZO61rBDUUbNH-lkWrmhgADjHraZkV4wfZ_cSo0MaD8/edit?usp=sharing";

type AgentRow = {
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
  team_lead?: string;
  supervisor?: string;
  hire_date?: string;
  email?: string;
};

function getAgentName(agent: AgentRow) {
  if (agent.full_name) return agent.full_name;
  if (agent.agent_name) return agent.agent_name;

  const first = agent.first_name || "";
  const last = agent.last_name || "";

  return `${first} ${last}`.trim() || "Unnamed Agent";
}

function getAgentId(agent: AgentRow) {
  return agent.agent_id || agent.hp_id || agent.employee_id || "Missing ID";
}

function getVendor(agent: AgentRow) {
  return agent.vendor || agent.bpo || "Unknown";
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
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

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  async function loadAgents() {
    setLoading(true);

    try {
      const rows = await getGoogleSheetRows<AgentRow>("Agents_Master");

      setAgents(rows);
      setLastUpdated(new Date().toLocaleString());

      await trackEvent("agents_master_loaded", {
        count: rows.length,
        source: "google_sheet",
      });
    } catch (error) {
      console.error("Agents_Master load failed:", error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgents();
  }, []);

  const vendors = useMemo(() => {
    return [
      "All",
      ...Array.from(new Set(agents.map((agent) => getVendor(agent)))).sort(),
    ];
  }, [agents]);

  const statuses = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(
          agents
            .map((agent) => String(agent.status || "Unknown"))
            .filter(Boolean)
        )
      ).sort(),
    ];
  }, [agents]);

  const activeAgents = useMemo(() => {
    return agents.filter((agent) =>
      String(agent.status || "").toLowerCase().includes("active")
    ).length;
  }, [agents]);

  const totalVendors = useMemo(() => {
    return new Set(
      agents
        .map((agent) => getVendor(agent))
        .filter((vendor) => vendor !== "Unknown")
    ).size;
  }, [agents]);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const searchText = [
        getAgentName(agent),
        getAgentId(agent),
        getVendor(agent),
        agent.site,
        agent.role,
        agent.status,
        agent.team_lead,
        agent.supervisor,
        agent.email,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchText.includes(search.toLowerCase());

      const matchesVendor =
        vendorFilter === "All" || getVendor(agent) === vendorFilter;

      const matchesStatus =
        statusFilter === "All" ||
        String(agent.status || "Unknown") === statusFilter;

      return matchesSearch && matchesVendor && matchesStatus;
    });
  }, [agents, search, vendorFilter, statusFilter]);

  async function handleExport() {
    downloadCsv(
      "staffforge-agents-master.csv",
      [
        "Agent ID",
        "Full Name",
        "Vendor",
        "Site",
        "Role",
        "Status",
        "Team Lead",
        "Supervisor",
        "Hire Date",
        "Email",
      ],
      filteredAgents.map((agent) => [
        getAgentId(agent),
        getAgentName(agent),
        getVendor(agent),
        agent.site || "",
        agent.role || "",
        agent.status || "",
        agent.team_lead || "",
        agent.supervisor || "",
        agent.hire_date || "",
        agent.email || "",
      ])
    );

    await trackEvent("agents_master_exported", {
      filteredRows: filteredAgents.length,
      totalRows: agents.length,
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <img
            src={MASTER_AGENTS_LOADING_GIF}
            alt="Loading master agents"
            className="mx-auto h-44 w-44 rounded-3xl object-cover"
          />

          <h2 className="mt-5 text-2xl font-black text-slate-950">
            Loading Master Agents...
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            StaffForge is reading Agents_Master from your Google Sheet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-200">
          Master Agent Database
        </p>

        <h2 className="mt-4 text-4xl font-black">
          Unified agent list from Staff-Forge Tool Google Sheet.
        </h2>

        <p className="mt-4 max-w-4xl text-slate-300">
          This page reads directly from the <b>Agents_Master</b> tab and shows
          the clean master list across vendors.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadAgents}
            className="sf-button sf-primary"
          >
            <RefreshCw size={18} />
            Refresh Agents
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="sf-button sf-secondary"
          >
            <Download size={18} />
            Export CSV
          </button>

          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackEvent("agents_source_sheet_clicked", {
                source: "Staff-Forge Tool Google Sheet",
                tab: "Agents_Master",
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

      <section className="grid gap-4 md:grid-cols-4">
        <div className="sf-card p-5">
          <Users className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Total Agents</p>
          <h3 className="mt-2 text-3xl font-black">{agents.length}</h3>
          <p className="mt-2 text-sm text-slate-500">Rows in Agents_Master</p>
        </div>

        <div className="sf-card p-5">
          <p className="text-sm font-bold text-slate-500">Active Agents</p>
          <h3 className="mt-2 text-3xl font-black">{activeAgents}</h3>
          <p className="mt-2 text-sm text-slate-500">Status contains Active</p>
        </div>

        <div className="sf-card p-5">
          <p className="text-sm font-bold text-slate-500">Vendors</p>
          <h3 className="mt-2 text-3xl font-black">{totalVendors}</h3>
          <p className="mt-2 text-sm text-slate-500">Unique vendor names</p>
        </div>

        <div className="sf-card p-5">
          <p className="text-sm font-bold text-slate-500">Displayed Rows</p>
          <h3 className="mt-2 text-3xl font-black">
            {filteredAgents.length}
          </h3>
          <p className="mt-2 text-sm text-slate-500">After filters/search</p>
        </div>
      </section>

      <section className="sf-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-xl font-black">Agents</h3>
            <p className="text-sm text-slate-500">
              Search and filter by agent, ID, vendor, site, role, status, or
              leader.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search agents..."
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

        <div className="max-h-130 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4">Agent Name</th>
                <th className="p-4">Agent ID</th>
                <th className="p-4">Vendor</th>
                <th className="p-4">Site</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Team Lead</th>
                <th className="p-4">Supervisor</th>
                <th className="p-4">Hire Date</th>
              </tr>
            </thead>

            <tbody>
              {filteredAgents.map((agent, index) => (
                <tr
                  key={`${getAgentId(agent)}-${index}`}
                  className="border-t border-slate-100"
                >
                  <td className="p-4 font-black">{getAgentName(agent)}</td>
                  <td className="p-4">{getAgentId(agent)}</td>
                  <td className="p-4 font-bold">{getVendor(agent)}</td>
                  <td className="p-4">{agent.site || "-"}</td>
                  <td className="p-4">{agent.role || "-"}</td>
                  <td className="p-4">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      {agent.status || "Unknown"}
                    </span>
                  </td>
                  <td className="p-4">{agent.team_lead || "-"}</td>
                  <td className="p-4">{agent.supervisor || "-"}</td>
                  <td className="p-4">{agent.hire_date || "-"}</td>
                </tr>
              ))}

              {!loading && filteredAgents.length === 0 && (
                <tr>
                  <td
                    className="p-6 text-center font-semibold text-slate-500"
                    colSpan={9}
                  >
                    No agents found. Make sure your Google Sheet has a tab named
                    Agents_Master.
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