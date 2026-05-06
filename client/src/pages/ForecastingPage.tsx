// client/src/pages/ForecastingPage.tsx

import {
  AlertTriangle,
  Brain,
  CalendarDays,
  Download,
  LineChart,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { trackEvent } from "../lib/firebase";

const forecastRows = [
  {
    week: "Current Week",
    expectedDemand: 0,
    requiredAgents: 0,
    availableAgents: 0,
    gap: 0,
    recommendation: "Import call volume and schedule data",
  },
  {
    week: "Next Week",
    expectedDemand: 0,
    requiredAgents: 0,
    availableAgents: 0,
    gap: 0,
    recommendation: "Waiting for historical utilization",
  },
  {
    week: "Next 30 Days",
    expectedDemand: 0,
    requiredAgents: 0,
    availableAgents: 0,
    gap: 0,
    recommendation: "Waiting for vendor data",
  },
];

export default function ForecastingPage() {
  async function handleAction(action: string) {
    await trackEvent("forecasting_action_clicked", {
      action,
    });

    alert(`${action} clicked. Forecasting will activate after data import.`);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-linear-to-br from-slate-950 to-blue-950 p-8 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-200">
          Forecasting Intelligence
        </p>

        <h2 className="mt-4 text-4xl font-black">
          Predict staffing needs before the operation breaks.
        </h2>

        <p className="mt-4 max-w-4xl text-slate-300">
          This module will compare call demand, historical utilization, vendor
          schedules, attrition risk, and staffing gaps to recommend the best
          coverage plan.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleAction("Run forecast")}
            className="sf-button sf-primary"
          >
            <Brain size={18} />
            Run Forecast
          </button>

          <button
            type="button"
            onClick={() => handleAction("Export forecast")}
            className="sf-button sf-secondary"
          >
            <Download size={18} />
            Export Forecast
          </button>

          <button
            type="button"
            onClick={() => handleAction("Create staffing recommendation")}
            className="sf-button sf-secondary"
          >
            <CalendarDays size={18} />
            Create Plan
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="sf-card p-5">
          <LineChart className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Projected Demand</p>
          <h3 className="mt-2 text-3xl font-black">0</h3>
          <p className="mt-2 text-sm text-slate-500">Needs call volume data</p>
        </div>

        <div className="sf-card p-5">
          <Users className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Required Agents</p>
          <h3 className="mt-2 text-3xl font-black">0</h3>
          <p className="mt-2 text-sm text-slate-500">Based on workload</p>
        </div>

        <div className="sf-card p-5">
          <TrendingUp className="mb-3 text-green-700" />
          <p className="text-sm font-bold text-slate-500">Coverage Health</p>
          <h3 className="mt-2 text-3xl font-black">N/A</h3>
          <p className="mt-2 text-sm text-slate-500">After import</p>
        </div>

        <div className="sf-card p-5">
          <TrendingDown className="mb-3 text-red-700" />
          <p className="text-sm font-bold text-slate-500">Attrition Risk</p>
          <h3 className="mt-2 text-3xl font-black">N/A</h3>
          <p className="mt-2 text-sm text-slate-500">Future ML model</p>
        </div>
      </section>

      <section className="sf-card overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-xl font-black">Forecast Plan</h3>
          <p className="text-sm text-slate-500">
            This will become your staffing forecast by week and vendor.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4">Period</th>
                <th className="p-4">Expected Demand</th>
                <th className="p-4">Required Agents</th>
                <th className="p-4">Available Agents</th>
                <th className="p-4">Gap</th>
                <th className="p-4">Recommendation</th>
              </tr>
            </thead>

            <tbody>
              {forecastRows.map((row) => (
                <tr key={row.week} className="border-t border-slate-100">
                  <td className="p-4 font-black">{row.week}</td>
                  <td className="p-4">{row.expectedDemand}</td>
                  <td className="p-4">{row.requiredAgents}</td>
                  <td className="p-4">{row.availableAgents}</td>
                  <td className="p-4">{row.gap}</td>
                  <td className="p-4">{row.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-blue-900">
        <div className="flex items-start gap-3">
          <AlertTriangle />
          <div>
            <h3 className="font-black">What this page is supposed to do</h3>
            <p className="mt-1 text-sm">
              After ETL import, StaffForge should predict if each vendor has
              enough people scheduled, too many people idle, or a future staffing
              shortage.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}