// client/src/components/layout/Sidebar.tsx

import {
  Bot,
  Brain,
  Gauge,
  Home,
  LineChart,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { trackEvent } from "../../lib/firebase";

const items = [
  ["dashboard", "Command Center", Home],
  ["agents", "Master Agents", Users],
  ["utilization", "Utilization", Gauge],
  ["intelligence", "Better Engine", Brain],
  ["forecasting", "Forecasting", LineChart],
  ["ai", "AI Assistant", Bot],
  ["imports", "ETL Imports", Upload],
  ["admin", "Admin Audit", ShieldCheck],
] as const;

type SidebarProps = {
  active: string;
  onChange: (id: string) => void;
};

export default function Sidebar({ active, onChange }: SidebarProps) {
  async function handleClick(id: string, label: string) {
    onChange(id);

    await trackEvent("sidebar_clicked", {
      page: id,
      label,
    });
  }

  return (
    <aside className="min-h-screen w-72 shrink-0 bg-slate-950 p-4 text-white">
      <div className="mb-8 rounded-3xl bg-white/10 p-4">
        <p className="text-xs uppercase tracking-[.3em] text-blue-200">
          StaffForge
        </p>

        <h1 className="mt-2 text-2xl font-black">BPO Command OS</h1>

        <p className="mt-2 text-sm text-slate-300">
          2035-ready workforce intelligence.
        </p>
      </div>

      <nav className="space-y-2">
        {items.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => handleClick(id, label)}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
              active === id
                ? "bg-blue-600 shadow-glow"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon size={19} />
            <span className="font-semibold">{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}