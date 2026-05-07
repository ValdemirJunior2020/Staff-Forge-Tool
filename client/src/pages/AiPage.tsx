// client/src/pages/AiPage.tsx

import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { getGoogleSheetRows } from "../lib/googleSheetApi";
import { trackEvent } from "../lib/firebase";
import {
  calculateDataQuality,
  confidenceFromDataQuality,
} from "../lib/dataQuality";
import EvidenceCard, {
  ConfidenceBadge,
} from "../components/evidence/EvidenceCard";

type UtilizationRow = {
  date?: string;
  agent_id?: string;
  full_name?: string;
  vendor?: string;
  scheduled_hours?: string | number;
  productive_hours?: string | number;
  idle_hours?: string | number;
  utilization_percent?: string | number;
};

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace("%", "").replace(",", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function AiPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [rows, setRows] = useState<UtilizationRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadData() {
    setLoading(true);

    const utilizationRows = await getGoogleSheetRows<UtilizationRow>(
      "Utilization_Daily"
    );

    setRows(utilizationRows);

    await trackEvent("ai_assistant_data_loaded", {
      utilizationRows: utilizationRows.length,
    });

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const dataQuality = useMemo(() => {
    return calculateDataQuality(rows as Record<string, unknown>[], [
      "vendor",
      "agent_id",
      "scheduled_hours",
      "productive_hours",
      "idle_hours",
      "utilization_percent",
    ]);
  }, [rows]);

  const confidence = confidenceFromDataQuality(dataQuality.score);

  function buildEvidenceBasedAnswer(userQuestion: string) {
    if (!rows.length) {
      return "I do not have enough data to answer safely. No Utilization_Daily rows are loaded. Please add data to the Google Sheet first.";
    }

    const lower = userQuestion.toLowerCase();

    const vendors = new Map<
      string,
      {
        rows: number;
        idleHours: number;
        scheduledHours: number;
        productiveHours: number;
        utilizationTotal: number;
        utilizationCount: number;
      }
    >();

    rows.forEach((row) => {
      const vendor = row.vendor || "Unknown";

      if (!vendors.has(vendor)) {
        vendors.set(vendor, {
          rows: 0,
          idleHours: 0,
          scheduledHours: 0,
          productiveHours: 0,
          utilizationTotal: 0,
          utilizationCount: 0,
        });
      }

      const bucket = vendors.get(vendor)!;

      bucket.rows += 1;
      bucket.idleHours += toNumber(row.idle_hours);
      bucket.scheduledHours += toNumber(row.scheduled_hours);
      bucket.productiveHours += toNumber(row.productive_hours);

      const utilization = toNumber(row.utilization_percent);

      if (utilization > 0) {
        bucket.utilizationTotal += utilization;
        bucket.utilizationCount += 1;
      }
    });

    const summaries = Array.from(vendors.entries()).map(([vendor, data]) => {
      const utilization =
        data.utilizationCount > 0
          ? data.utilizationTotal / data.utilizationCount
          : data.scheduledHours > 0
          ? (data.productiveHours / data.scheduledHours) * 100
          : 0;

      return {
        vendor,
        ...data,
        utilization,
      };
    });

    const highestIdle = [...summaries].sort(
      (a, b) => b.idleHours - a.idleHours
    )[0];

    const bestUtilization = [...summaries].sort(
      (a, b) => b.utilization - a.utilization
    )[0];

    if (lower.includes("idle") || lower.includes("risk")) {
      return `Verified data: I found ${rows.length} rows in Utilization_Daily.

Calculated result: ${highestIdle.vendor} currently has the highest idle-hour exposure with ${highestIdle.idleHours.toFixed(
        2
      )} idle hours.

AI recommendation: Review ${highestIdle.vendor} first, but treat this as a cautious recommendation because schedules and call volume may be needed to confirm whether this is true overstaffing.

Confidence: ${confidence.label}. Reason: ${confidence.explanation}`;
    }

    if (lower.includes("best") || lower.includes("vendor")) {
      return `Verified data: I found ${summaries.length} vendors in Utilization_Daily.

Calculated result: ${bestUtilization.vendor} has the highest average utilization at ${bestUtilization.utilization.toFixed(
        1
      )}%.

Needs human review: Do not call this vendor the true best performer unless each vendor has comparable data volume, schedules, and call volume loaded.

Confidence: ${confidence.label}. Reason: ${confidence.explanation}`;
    }

    if (lower.includes("quality") || lower.includes("trust")) {
      return `Verified data: StaffForge loaded ${rows.length} Utilization_Daily rows.

Calculated result: Data Quality Score is ${dataQuality.score}% (${dataQuality.level}).

Missing or partial fields:
${dataQuality.reasons.map((reason) => `- ${reason}`).join("\n")}

Rule: No evidence = no conclusion. Partial data = cautious recommendation. Complete data = strong recommendation.`;
    }

    return `I can only answer based on the data currently loaded in StaffForge.

Verified data:
- Utilization_Daily rows loaded: ${rows.length}
- Vendors found: ${summaries.length}
- Data Quality Score: ${dataQuality.score}%

Calculated result:
- Highest idle exposure: ${highestIdle.vendor} with ${highestIdle.idleHours.toFixed(
      2
    )} idle hours
- Highest average utilization: ${bestUtilization.vendor} with ${bestUtilization.utilization.toFixed(
      1
    )}%

Needs human review:
If your question requires staffing gaps, schedules, or call demand, add data to Schedules and Call_Volume first.`;
  }

  async function askQuestion() {
    if (!question.trim()) {
      setAnswer("Please type a question first.");
      return;
    }

    const result = buildEvidenceBasedAnswer(question);
    setAnswer(result);

    await trackEvent("ai_assistant_question_answered", {
      question,
      evidenceRows: rows.length,
      dataQualityScore: dataQuality.score,
      confidence: confidence.label,
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-200">
          Evidence-Based AI Assistant
        </p>

        <h2 className="mt-4 text-4xl font-black">
          Ask questions without guessing.
        </h2>

        <p className="mt-4 max-w-4xl text-slate-300">
          This assistant only answers from loaded StaffForge data. If the data is
          missing, it will say so instead of inventing an answer.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadData}
            className="sf-button sf-primary"
          >
            <RefreshCw size={18} />
            {loading ? "Loading..." : "Refresh Evidence"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="sf-card p-5">
          <Bot className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Evidence Rows</p>
          <h3 className="mt-2 text-3xl font-black">{rows.length}</h3>
        </div>

        <div className="sf-card p-5">
          <ShieldCheck className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Data Quality</p>
          <h3 className="mt-2 text-3xl font-black">{dataQuality.score}%</h3>
          <p className="mt-2 text-sm text-slate-500">{dataQuality.level}</p>
        </div>

        <div className="sf-card p-5">
          <CheckCircle2 className="mb-3 text-green-700" />
          <p className="text-sm font-bold text-slate-500">Answer Confidence</p>
          <h3 className="mt-2 text-3xl font-black">{confidence.label}</h3>
          <p className="mt-2 text-sm text-slate-500">
            Based on loaded evidence
          </p>
        </div>
      </section>

      <EvidenceCard title="AI Guardrail" type="Needs Human Review">
        The assistant will not assume schedules, staffing gaps, call volume, or
        vendor performance unless those fields are loaded into StaffForge.
      </EvidenceCard>

      <section className="sf-card p-6">
        <label className="block">
          <span className="text-sm font-black text-slate-600">
            Ask StaffForge
          </span>

          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Example: Which vendor has the highest idle risk?"
            className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-blue-600"
          />
        </label>

        <button
          type="button"
          onClick={askQuestion}
          className="sf-button sf-primary mt-4"
        >
          <Search size={18} />
          AI not working in this tool yet
        </button>
      </section>

      {answer && (
        <section className="sf-card p-6">
          <h3 className="text-xl font-black">Answer</h3>

          <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-100">
            {answer}
          </pre>

          <ConfidenceBadge
            label={confidence.label}
            explanation={confidence.explanation}
          />
        </section>
      )}
    </div>
  );
}