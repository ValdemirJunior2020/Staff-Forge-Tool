// client/src/pages/IntelligencePage.tsx

import { useMemo, useState } from "react";
import { Brain, CheckCircle2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api";
import { getGoogleSheetRows } from "../lib/googleSheetApi";
import { trackEvent } from "../lib/firebase";

type ApiRecommendation = {
  title?: string;
  severity?: string;
  detail?: string;
  impact_score?: number;
  confidence?: number;
};

type UtilizationRow = {
  vendor?: string;
  agent_id?: string;
  full_name?: string;
  scheduled_hours?: string | number;
  productive_hours?: string | number;
  idle_hours?: string | number;
  utilization_percent?: string | number;
};

type Recommendation = {
  title: string;
  severity: string;
  detail: string;
  impact_score: number;
  confidence: number;
};

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  const parsed = Number(String(value).replace("%", "").replace(",", "").trim());

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeApiRecommendations(
  items: ApiRecommendation[] | null | undefined
): Recommendation[] {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => ({
    title: item.title || `Recommendation ${index + 1}`,
    severity: item.severity || "medium",
    detail: item.detail || "No detail provided yet.",
    impact_score: item.impact_score ?? 50,
    confidence: item.confidence ?? 0.7,
  }));
}

function buildLocalRecommendations(rows: UtilizationRow[]): Recommendation[] {
  if (!rows.length) {
    return [
      {
        title: "Import utilization data",
        severity: "high",
        detail:
          "No utilization rows were found. Load the Utilization_Daily tab so StaffForge can calculate idle time, vendor risk, staffing gaps, and improvement actions.",
        impact_score: 95,
        confidence: 0.98,
      },
      {
        title: "Validate vendor agent IDs",
        severity: "medium",
        detail:
          "Before running workforce optimization, make sure every agent has a consistent agent_id across vendors and daily utilization reports.",
        impact_score: 80,
        confidence: 0.86,
      },
    ];
  }

  const vendorBuckets = new Map<
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

    if (!vendorBuckets.has(vendor)) {
      vendorBuckets.set(vendor, {
        rows: 0,
        idleHours: 0,
        scheduledHours: 0,
        productiveHours: 0,
        utilizationTotal: 0,
        utilizationCount: 0,
      });
    }

    const bucket = vendorBuckets.get(vendor)!;
    const utilization = toNumber(row.utilization_percent);

    bucket.rows += 1;
    bucket.idleHours += toNumber(row.idle_hours);
    bucket.scheduledHours += toNumber(row.scheduled_hours);
    bucket.productiveHours += toNumber(row.productive_hours);

    if (utilization > 0) {
      bucket.utilizationTotal += utilization;
      bucket.utilizationCount += 1;
    }
  });

  const recommendations: Recommendation[] = [];

  Array.from(vendorBuckets.entries()).forEach(([vendor, bucket]) => {
    const utilization =
      bucket.utilizationCount > 0
        ? bucket.utilizationTotal / bucket.utilizationCount
        : bucket.scheduledHours > 0
        ? (bucket.productiveHours / bucket.scheduledHours) * 100
        : 0;

    if (utilization > 0 && utilization < 65) {
      recommendations.push({
        title: `${vendor} utilization is too low`,
        severity: "high",
        detail: `${vendor} is averaging ${utilization.toFixed(
          1
        )}% utilization. Review schedules, idle time, and available status to determine if too many agents are staffed during low demand periods.`,
        impact_score: 92,
        confidence: 0.9,
      });
    }

    if (bucket.idleHours >= 10) {
      recommendations.push({
        title: `${vendor} has high idle hours`,
        severity: "medium",
        detail: `${vendor} has ${bucket.idleHours.toFixed(
          1
        )} idle hours in the loaded data. Compare this against call volume by hour to identify overstaffing windows.`,
        impact_score: 84,
        confidence: 0.88,
      });
    }

    if (utilization >= 85) {
      recommendations.push({
        title: `${vendor} is operating efficiently`,
        severity: "low",
        detail: `${vendor} is showing strong utilization at ${utilization.toFixed(
          1
        )}%. Use this vendor as a benchmark for staffing balance and break adherence.`,
        impact_score: 70,
        confidence: 0.8,
      });
    }
  });

  if (!recommendations.length) {
    recommendations.push({
      title: "No major utilization risk detected",
      severity: "low",
      detail:
        "The loaded utilization data does not show an obvious high-risk vendor yet. Next step is to add hourly call volume and schedules for deeper analysis.",
      impact_score: 65,
      confidence: 0.75,
    });
  }

  return recommendations.sort((a, b) => b.impact_score - a.impact_score);
}

export default function IntelligencePage() {
  const [localRows, setLocalRows] = useState<UtilizationRow[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const { data: apiRecommendations, isLoading: apiLoading } = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => apiGet<ApiRecommendation[]>("/workforce/recommendations"),
  });

  async function loadSheetIntelligence() {
    setLocalLoading(true);
    setActionMessage("");

    try {
      const rows = await getGoogleSheetRows<UtilizationRow>("Utilization_Daily");
      setLocalRows(rows);

      await trackEvent("better_engine_google_sheet_loaded", {
        count: rows.length,
      });
    } catch (error) {
      console.error("Better Engine load failed:", error);
      setLocalRows([]);
    } finally {
      setLocalLoading(false);
    }
  }

  const recommendations = useMemo(() => {
    const apiItems = normalizeApiRecommendations(apiRecommendations);

    if (apiItems.length > 0) {
      return apiItems;
    }

    return buildLocalRecommendations(localRows);
  }, [apiRecommendations, localRows]);

  async function handleCreateAction(recommendation: Recommendation) {
    const message = `Action created for: ${recommendation.title}`;
    setActionMessage(message);

    await trackEvent("better_engine_action_created", {
      title: recommendation.title,
      severity: recommendation.severity,
      impactScore: recommendation.impact_score,
    });
  }

  async function handleOpenAnalysis(recommendation: Recommendation) {
    await trackEvent("better_engine_analysis_opened", {
      title: recommendation.title,
      severity: recommendation.severity,
    });

    alert(
      `${recommendation.title}\n\n${recommendation.detail}\n\nImpact: ${recommendation.impact_score}\nConfidence: ${Math.round(
        recommendation.confidence * 100
      )}%`
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-200">
          Better Engine
        </p>

        <h2 className="mt-4 text-4xl font-black">
          Where We Need to Get Better
        </h2>

        <p className="mt-4 max-w-4xl text-slate-300">
          StaffForge reviews utilization patterns and turns them into prioritized
          operational actions by impact, confidence, and urgency.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadSheetIntelligence}
            className="sf-button sf-primary"
          >
            <RefreshCw size={18} />
            {localLoading || apiLoading ? "Analyzing..." : "Analyze Google Sheet"}
          </button>

          <button
            type="button"
            onClick={() =>
              alert(
                "This engine looks at utilization %, idle hours, scheduled hours, productive hours, and vendor grouping. Next production step: connect call volume and schedules for deeper staffing recommendations."
              )
            }
            className="sf-button sf-secondary"
          >
            <Brain size={18} />
            How it works
          </button>
        </div>
      </section>

      {actionMessage && (
        <div className="flex items-center gap-3 rounded-3xl border border-green-200 bg-green-50 p-5 font-bold text-green-800">
          <CheckCircle2 size={22} />
          {actionMessage}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-3">
        {recommendations.map((recommendation, index) => (
          <article
            key={`${recommendation.title}-${index}`}
            className="sf-card p-6 transition hover:border-blue-300 hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <span
                className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                  recommendation.severity.toLowerCase() === "high"
                    ? "bg-red-50 text-red-700"
                    : recommendation.severity.toLowerCase() === "medium"
                    ? "bg-yellow-50 text-yellow-700"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {recommendation.severity}
              </span>

              <Sparkles className="text-blue-600" size={20} />
            </div>

            <h3 className="mt-4 text-xl font-black">
              #{index + 1} {recommendation.title}
            </h3>

            <p className="mt-3 min-h-24 text-sm leading-6 text-slate-600">
              {recommendation.detail}
            </p>

            <p className="mt-4 text-sm font-bold text-blue-700">
              Impact {recommendation.impact_score} • Confidence{" "}
              {Math.round(recommendation.confidence * 100)}%
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleOpenAnalysis(recommendation)}
                className="sf-button sf-secondary"
              >
                Open analysis
              </button>

              <button
                type="button"
                onClick={() => handleCreateAction(recommendation)}
                className="sf-button sf-primary"
              >
                <Wand2 size={18} />
                Create action
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}