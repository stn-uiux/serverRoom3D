import type { ErrorLevel, PortState } from "../types";

/** Color mapping for each error severity level */
export const ERROR_COLORS: Record<ErrorLevel, string> = {
  critical: "#ef4444",
  major: "#f97316",
  minor: "#eab308",
  warning: "#8b5cf6",
};

/** Numeric priority for severity comparison (higher = more severe) */
export const ERROR_PRIORITY: Record<ErrorLevel, number> = {
  critical: 4,
  major: 3,
  minor: 2,
  warning: 1,
};

/**
 * Scan an array of PortStates and return the highest-severity error info.
 * Returns `{ level, color }` or `null` if no errors found.
 */
export const getHighestError = (
  portStates: PortState[] | undefined,
): { level: ErrorLevel; color: string } | null => {
  if (!portStates || portStates.length === 0) return null;

  let maxPriority = 0;
  let highestLevel: ErrorLevel | null = null;

  for (const p of portStates) {
    if (p.status === "error" && p.errorLevel) {
      const priority = ERROR_PRIORITY[p.errorLevel] || 0;
      if (priority > maxPriority) {
        maxPriority = priority;
        highestLevel = p.errorLevel;
      }
    }
  }

  if (!highestLevel) return null;
  return { level: highestLevel, color: ERROR_COLORS[highestLevel] };
};
