// src/utils/fmsMonthUtils.js
// Shared month/period resolution helpers for Internal Audit FMS and PMS FMS.

export const FMS_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const FMS_MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FMS_MONTH_ALIAS_MAP = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const IST_OFFSET_MS = 330 * 60 * 1000;

function toMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function toMonthNumValue(year, month) {
  return Number(year) * 12 + Number(month);
}

/**
 * Parses ISO timestamps, DD/MM/YYYY, YYYY-MM-DD, or MMM-YY strings into "YYYY-MM".
 */
export function parseFmsDateToMonthKey(val) {
  if (!val) return "";
  const str = String(val).trim();
  if (!str) return "";

  const ymd = str.match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
  if (ymd && !str.includes("T")) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) return toMonthKey(y, m);
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    const dt = new Date(str);
    if (!Number.isNaN(dt.getTime())) {
      const ist = new Date(dt.getTime() + IST_OFFSET_MS);
      return ist.toISOString().slice(0, 7);
    }
  }

  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    if (m >= 1 && m <= 12 && y >= 2000 && y <= 2100) return toMonthKey(y, m);
  }

  const monYr = str.match(/\b([a-z]{3,9})[\s-]+(\d{2,4})\b/i);
  if (monYr) {
    const m = FMS_MONTH_ALIAS_MAP[monYr[1].toLowerCase()];
    const rawY = Number(monYr[2]);
    const y = rawY < 100 ? 2000 + rawY : rawY;
    if (m && y >= 2000 && y <= 2100) return toMonthKey(y, m);
  }

  return "";
}

/**
 * Resolves a target month or "ALL" scope from query text or "YYYY-MM" keys.
 */
export function parseFmsTargetMonth(scopeOrQuery = "") {
  const raw = String(scopeOrQuery || "").trim();
  if (!raw || raw.toUpperCase() === "ALL") return { isAllMonths: true, label: "All Months & Cycles" };

  if (/^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-").map(Number);
    if (m >= 1 && m <= 12) {
      return {
        month: m,
        year: y,
        key: raw,
        label: `${FMS_MONTH_NAMES[m - 1]} ${y}`,
        shortLabel: `${FMS_MONTH_SHORT[m - 1]} ${y}`,
      };
    }
  }

  const q = raw.toLowerCase();
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  if (q.includes("last month") || q.includes("previous month") || q.includes("prev month")) {
    const m = curMonth === 1 ? 12 : curMonth - 1;
    const y = curMonth === 1 ? curYear - 1 : curYear;
    return {
      month: m,
      year: y,
      key: toMonthKey(y, m),
      label: `${FMS_MONTH_NAMES[m - 1]} ${y}`,
      shortLabel: `${FMS_MONTH_SHORT[m - 1]} ${y}`,
    };
  }

  if (q.includes("this month") || q.includes("current month")) {
    return {
      month: curMonth,
      year: curYear,
      key: toMonthKey(curYear, curMonth),
      label: `${FMS_MONTH_NAMES[curMonth - 1]} ${curYear}`,
      shortLabel: `${FMS_MONTH_SHORT[curMonth - 1]} ${curYear}`,
    };
  }

  const yearMatch = q.match(/\b(202[4-9]|203[0-5])\b/);
  const explicitYear = yearMatch ? Number(yearMatch[1]) : null;

  for (const [alias, mNum] of Object.entries(FMS_MONTH_ALIAS_MAP)) {
    const reg = new RegExp(`\\b${alias}\\b`, "i");
    if (reg.test(q)) {
      const y = explicitYear || (mNum > curMonth ? curYear - 1 : curYear);
      return {
        month: mNum,
        year: y,
        key: toMonthKey(y, mNum),
        label: `${FMS_MONTH_NAMES[mNum - 1]} ${y}`,
        shortLabel: `${FMS_MONTH_SHORT[mNum - 1]} ${y}`,
      };
    }
  }

  if (q.includes("monthly") || q.includes("month wise") || q.includes("month-wise") || q.includes("all month")) {
    return { isAllMonths: true, label: "All Months & Cycles" };
  }

  return null;
}

function parseMonthYearPair(tokenStr) {
  const m = String(tokenStr || "").trim().match(/^([a-z]{3,9})[\s-]*(\d{2,4})?$/i);
  if (!m) return null;
  const month = FMS_MONTH_ALIAS_MAP[m[1].toLowerCase()];
  if (!month) return null;
  const year = m[2] ? (Number(m[2]) < 100 ? 2000 + Number(m[2]) : Number(m[2])) : null;
  return { month, year };
}

function matchesPeriodString(periodRaw = "", targetMonthSpec = null) {
  if (!periodRaw || !targetMonthSpec?.month || !targetMonthSpec?.year) return null;
  const p = String(periodRaw).trim();
  const lower = p.toLowerCase();
  const targetM = targetMonthSpec.month;
  const targetY = targetMonthSpec.year;
  const targetVal = toMonthNumValue(targetY, targetM);

  // 1. Named Quarter / Half-Year Cycles (recurring yearly)
  if (/^q1\b/i.test(p) || /april\s*to\s*jun/i.test(lower)) {
    return [4, 5, 6].includes(targetM) ? { tier: "direct", reason: `Cycle: ${p}` } : null;
  }
  if (/^q2\b/i.test(p) || /jul(?:y)?\s*to\s*sep/i.test(lower)) {
    return [7, 8, 9].includes(targetM) ? { tier: "direct", reason: `Cycle: ${p}` } : null;
  }
  if (/^q3\b/i.test(p) || /oct(?:ober)?\s*to\s*dec/i.test(lower)) {
    return [10, 11, 12].includes(targetM) ? { tier: "direct", reason: `Cycle: ${p}` } : null;
  }
  if (/^q4\b/i.test(p) || /jan(?:uary)?\s*to\s*mar/i.test(lower)) {
    return [1, 2, 3].includes(targetM) ? { tier: "direct", reason: `Cycle: ${p}` } : null;
  }
  if (/half\s*year.*april\s*to\s*sep/i.test(lower)) {
    return targetM >= 4 && targetM <= 9 ? { tier: "direct", reason: `Half-Year: ${p}` } : null;
  }
  if (/half\s*year.*oct\s*to\s*mar/i.test(lower)) {
    return (targetM >= 10 || targetM <= 3) ? { tier: "direct", reason: `Half-Year: ${p}` } : null;
  }
  if (/monthly/i.test(lower)) {
    return { tier: "direct", reason: `Monthly Schedule: ${p}` };
  }

  // 2. Explicit Month Ranges like "Aug-25 To Feb-26", "July-25 To Nov-25"
  const rangeMatch = p.match(/^([a-z]{3,9}(?:[\s-]*\d{2,4})?)\s+to\s+([a-z]{3,9}(?:[\s-]*\d{2,4})?)$/i);
  if (rangeMatch) {
    const start = parseMonthYearPair(rangeMatch[1]);
    const end = parseMonthYearPair(rangeMatch[2]);
    if (start && end) {
      if (start.year && end.year) {
        const sVal = toMonthNumValue(start.year, start.month);
        const eVal = toMonthNumValue(end.year, end.month);
        if (targetVal >= sVal && targetVal <= eVal) {
          return { tier: "direct", reason: `Period Range: ${p}` };
        }
        return null;
      }
      // Yearless range fallback
      if (start.month <= end.month ? (targetM >= start.month && targetM <= end.month) : (targetM >= start.month || targetM <= end.month)) {
        return { tier: "direct", reason: `Period Range: ${p}` };
      }
      return null;
    }
  }

  // 3. Explicit single month inside period text (e.g., "October 2026")
  const explicitKey = parseFmsDateToMonthKey(p);
  if (explicitKey && explicitKey === targetMonthSpec.key) {
    return { tier: "direct", reason: `Period: ${p}` };
  }

  // 4. Financial / Assessment Years (e.g. "FY-26-27" = Apr 2026 to Mar 2027)
  const fyMatch = p.match(/\b(?:fy|ay)[\s-]*(\d{2,4})[\s-]+(\d{2,4})\b/i);
  if (fyMatch) {
    const rawY1 = Number(fyMatch[1]);
    const y1 = rawY1 < 100 ? 2000 + rawY1 : rawY1;
    const rawY2 = Number(fyMatch[2]);
    const y2 = rawY2 < 100 ? 2000 + rawY2 : rawY2;
    const fyStart = toMonthNumValue(y1, 4);
    const fyEnd = toMonthNumValue(y2, 3);
    if (targetVal >= fyStart && targetVal <= fyEnd) {
      return { tier: "annual", reason: `Annual Retainer (${p})` };
    }
  }

  return null;
}

/**
 * Checks whether an IA FMS or PMS FMS engagement applies to a target month via live dates or Period schedule.
 */
export function matchFmsRecordToMonth(record, targetMonthSpec, periodField = "iaPeriod") {
  if (!record || !targetMonthSpec?.key) return { matched: false, tier: null, reasons: [] };

  const targetKey = targetMonthSpec.key;
  const reasons = [];

  if (parseFmsDateToMonthKey(record.startDate) === targetKey) {
    reasons.push(`Start Date (${record.startDate})`);
  }
  if (parseFmsDateToMonthKey(record.targetDate) === targetKey) {
    reasons.push(`Target Date (${record.targetDate})`);
  }
  if (parseFmsDateToMonthKey(record.timestamp) === targetKey) {
    reasons.push("Created / Logged in Month");
  }

  const matchedStepCount = (record.steps || []).filter(
    (s) =>
      parseFmsDateToMonthKey(s.planned) === targetKey ||
      parseFmsDateToMonthKey(s.actual) === targetKey
  ).length;
  if (matchedStepCount > 0) {
    reasons.push(`${matchedStepCount} Step Milestone(s) in ${targetMonthSpec.shortLabel}`);
  }

  if (reasons.length > 0) {
    return { matched: true, tier: "direct", reasons };
  }

  const periodMatch = matchesPeriodString(record[periodField], targetMonthSpec);
  if (periodMatch) {
    return { matched: true, tier: periodMatch.tier, reasons: [periodMatch.reason] };
  }

  return { matched: false, tier: null, reasons: [] };
}

/**
 * Summarizes FMS/PMS engagements by cycle/period and recorded activity months.
 */
export function groupFmsRecordsByPeriodAndMonth(unifiedList = [], periodField = "iaPeriod") {
  const periodMap = new Map();
  const datedMonthMap = new Map();
  const quarterTotals = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, HalfYear: 0, AnnualFY: 0, Range: 0, General: 0 };

  unifiedList.forEach((item) => {
    const period = String(item[periodField] || "General").trim() || "General";
    if (!periodMap.has(period)) {
      periodMap.set(period, { period, total: 0, liveCount: 0, items: [] });
    }
    const pBucket = periodMap.get(period);
    pBucket.total += 1;
    if (item.isLiveFms) pBucket.liveCount += 1;
    pBucket.items.push(item);

    if (/^q1/i.test(period)) quarterTotals.Q1 += 1;
    else if (/^q2/i.test(period)) quarterTotals.Q2 += 1;
    else if (/^q3/i.test(period)) quarterTotals.Q3 += 1;
    else if (/^q4/i.test(period)) quarterTotals.Q4 += 1;
    else if (/half/i.test(period)) quarterTotals.HalfYear += 1;
    else if (/^(fy|ay)/i.test(period)) quarterTotals.AnnualFY += 1;
    else if (/\bto\b/i.test(period)) quarterTotals.Range += 1;
    else quarterTotals.General += 1;

    const seenKeys = new Set();
    [item.startDate, item.targetDate, item.timestamp].forEach((dt) => {
      const k = parseFmsDateToMonthKey(dt);
      if (k && !seenKeys.has(k)) {
        seenKeys.add(k);
        if (!datedMonthMap.has(k)) {
          const [y, m] = k.split("-").map(Number);
          datedMonthMap.set(k, {
            key: k,
            label: `${FMS_MONTH_NAMES[m - 1] || m} ${y}`,
            count: 0,
            items: [],
          });
        }
        datedMonthMap.get(k).count += 1;
        datedMonthMap.get(k).items.push(item);
      }
    });
  });

  return {
    periodGroups: Array.from(periodMap.values()).sort((a, b) => b.total - a.total),
    datedMonths: Array.from(datedMonthMap.values()).sort((a, b) => b.key.localeCompare(a.key)),
    quarterTotals,
  };
}

