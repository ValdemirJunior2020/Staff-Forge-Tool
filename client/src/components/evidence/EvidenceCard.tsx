// client/src/components/evidence/EvidenceCard.tsx

import { AlertTriangle, CheckCircle2, Database, Eye, ShieldCheck } from "lucide-react";

type EvidenceCardProps = {
  title: string;
  type: "Verified Data" | "Calculated Result" | "AI Recommendation" | "Needs Human Review";
  children: React.ReactNode;
};

function getStyle(type: EvidenceCardProps["type"]) {
  if (type === "Verified Data") {
    return {
      icon: <Database size={20} />,
      className: "border-blue-200 bg-blue-50 text-blue-900",
    };
  }

  if (type === "Calculated Result") {
    return {
      icon: <CheckCircle2 size={20} />,
      className: "border-green-200 bg-green-50 text-green-900",
    };
  }

  if (type === "AI Recommendation") {
    return {
      icon: <Eye size={20} />,
      className: "border-yellow-200 bg-yellow-50 text-yellow-900",
    };
  }

  return {
    icon: <AlertTriangle size={20} />,
    className: "border-orange-200 bg-orange-50 text-orange-900",
  };
}

export default function EvidenceCard({ title, type, children }: EvidenceCardProps) {
  const style = getStyle(type);

  return (
    <section className={`rounded-3xl border p-5 ${style.className}`}>
      <div className="flex items-start gap-3">
        <div className="mt-1">{style.icon}</div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">
            {type}
          </p>

          <h3 className="mt-1 text-lg font-black">{title}</h3>

          <div className="mt-2 text-sm leading-6">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function DataSourcePill({
  source,
  formula,
  lastUpdated,
}: {
  source: string;
  formula?: string;
  lastUpdated?: string;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
      <p>
        <b>Source:</b> {source}
      </p>

      {formula && (
        <p className="mt-1">
          <b>Formula:</b> {formula}
        </p>
      )}

      {lastUpdated && (
        <p className="mt-1">
          <b>Last Updated:</b> {lastUpdated}
        </p>
      )}
    </div>
  );
}

export function ConfidenceBadge({
  label,
  explanation,
}: {
  label: "High" | "Medium" | "Low";
  explanation: string;
}) {
  const className =
    label === "High"
      ? "bg-green-50 text-green-700"
      : label === "Medium"
      ? "bg-yellow-50 text-yellow-700"
      : "bg-red-50 text-red-700";

  return (
    <div className={`mt-3 rounded-2xl px-4 py-3 text-sm font-bold ${className}`}>
      Confidence: {label}
      <p className="mt-1 text-xs font-semibold opacity-80">{explanation}</p>
    </div>
  );
}