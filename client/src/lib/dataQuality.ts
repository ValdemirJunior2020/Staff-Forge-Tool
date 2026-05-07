// client/src/lib/dataQuality.ts

export type DataQualityResult = {
  score: number;
  level: "Excellent" | "Good" | "Needs Review" | "Weak";
  reasons: string[];
  missingFields: string[];
  rowCount: number;
};

export function calculateDataQuality<T extends Record<string, unknown>>(
  rows: T[],
  requiredFields: string[]
): DataQualityResult {
  const reasons: string[] = [];
  const missingFields: string[] = [];

  if (!rows.length) {
    return {
      score: 0,
      level: "Weak",
      reasons: ["No rows were loaded from the source data."],
      missingFields: requiredFields,
      rowCount: 0,
    };
  }

  let totalChecks = 0;
  let passedChecks = 0;

  requiredFields.forEach((field) => {
    const filledCount = rows.filter((row) => {
      const value = row[field];
      return value !== undefined && value !== null && String(value).trim() !== "";
    }).length;

    totalChecks += rows.length;
    passedChecks += filledCount;

    if (filledCount === 0) {
      missingFields.push(field);
      reasons.push(`Missing required field: ${field}`);
    } else if (filledCount < rows.length) {
      reasons.push(
        `${field} is partially complete: ${filledCount}/${rows.length} rows`
      );
    } else {
      reasons.push(`${field} is complete.`);
    }
  });

  const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  let level: DataQualityResult["level"] = "Weak";

  if (score >= 95) level = "Excellent";
  else if (score >= 80) level = "Good";
  else if (score >= 60) level = "Needs Review";

  return {
    score,
    level,
    reasons,
    missingFields,
    rowCount: rows.length,
  };
}

export function confidenceFromDataQuality(score: number): {
  label: "High" | "Medium" | "Low";
  explanation: string;
} {
  if (score >= 85) {
    return {
      label: "High",
      explanation: "The required source fields are mostly complete.",
    };
  }

  if (score >= 60) {
    return {
      label: "Medium",
      explanation:
        "Some fields are incomplete, so recommendations should be reviewed before decisions are made.",
    };
  }

  return {
    label: "Low",
    explanation:
      "The data is incomplete. StaffForge should avoid strong conclusions until more data is loaded.",
  };
}