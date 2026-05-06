// client/src/pages/AgentsPage.tsx

import { useEffect, useState } from "react";
import { RefreshCw, Search, Users } from "lucide-react";
import { getGoogleSheetRows } from "../lib/googleSheetApi";
import { trackEvent } from "../lib/firebase";

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
  status?: string;
  role?: string;
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

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadAgents() {
    setLoading(true);

    const rows = await getGoogleSheetRows<AgentRow>("Agents_Master");
    setAgents(rows);

    await trackEvent("agents_master_loaded", {
      count: rows.length,
      source: "google_sheet",
    });

    setLoading(false);
  }

  useEffect(() => {
    loadAgents();
  }, []);

  const filteredAgents = agents.filter((agent) => {
    const text = `${getAgentName(agent)} ${getAgentId(agent)} ${getVendor(
      agent
    )}`.toLowerCase();

    return text.includes(search.toLowerCase());
  });

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
          This page reads directly from the <b>Agents_Master</b> tab in your
          Staff-Forge Tool Google Sheet.
        </p>

        <button
          type="button"
          onClick={loadAgents}
          className="sf-button sf-primary mt-6"
        >
          <RefreshCw size={18} />
          {loading ? "Loading..." : "Refresh Agents"}
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="sf-card p-5">
          <Users className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Total Agents</p>
          <h3 className="mt-2 text-3xl font-black">{agents.length}</h3>
        </div>

        <div className="sf-card p-5">
          <p className="text-sm font-bold text-slate-500">Active Agents</p>
          <h3 className="mt-2 text-3xl font-black">
            {
              agents.filter((agent) =>
                String(agent.status || "")
                  .toLowerCase()
                  .includes("active")
              ).length
            }
          </h3>
        </div>

        <div className="sf-card p-5">
          <p className="text-sm font-bold text-slate-500">Google Sheet Tab</p>
          <h3 className="mt-2 text-3xl font-black">Agents_Master</h3>
        </div>
      </section>

      <section className="sf-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-black">Agents</h3>
            <p className="text-sm text-slate-500">
              Search by name, ID, or vendor.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search agents..."
              className="outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4">Agent Name</th>
                <th className="p-4">Agent ID</th>
                <th className="p-4">Vendor</th>
                <th className="p-4">Site</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
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
                  <td className="p-4">{getVendor(agent)}</td>
                  <td className="p-4">{agent.site || "-"}</td>
                  <td className="p-4">{agent.role || "-"}</td>
                  <td className="p-4">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      {agent.status || "Unknown"}
                    </span>
                  </td>
                </tr>
              ))}

              {!loading && filteredAgents.length === 0 && (
                <tr>
                  <td className="p-6 text-center font-semibold text-slate-500" colSpan={6}>
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