// src/utils/seniorTaskService.js
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { normalizeName } from "./attendanceConfig";

export const SENIOR_TASK_API_URL =
  "https://script.google.com/macros/s/AKfycbypIMjaNAgFXnw29uIvwyexG3FcQ65fijzx0nj1w7WJ0E7t5m6VJn2Nw8jZgFH5PM3z/exec";

export const JUNIOR_TASK_API_URL =
  "https://script.google.com/macros/s/AKfycbx4emFG4CqbI7I8ThhfuI97hcVWhCR-uhenuqjtkWEX1jSG2kT280iqcbmU2FF4ni9Slw/exec";

const CACHE_TTL_MS = 5 * 60 * 1000;

export const DELEGATION_SCOPE_CONFIG = {
  senior: {
    key: "senior",
    apiUrl: SENIOR_TASK_API_URL,
    label: "Senior Task",
    shortLabel: "Senior",
    pluralLabel: "Seniors",
    doerLabel: "Senior (Doer)",
    filePrefix: "Senior_Task",
    tagPrefix: "SENIOR_TASK",
    cacheKey: "ajc_senior_task_summary_v1",
  },
  junior: {
    key: "junior",
    apiUrl: JUNIOR_TASK_API_URL,
    label: "Junior Task",
    shortLabel: "Junior",
    pluralLabel: "Juniors",
    doerLabel: "Junior (Doer)",
    filePrefix: "Junior_Task",
    tagPrefix: "JUNIOR_TASK",
    cacheKey: "ajc_junior_task_summary_v1",
  },
};

export function getDelegationMeta(tierOrConfig = "senior") {
  if (typeof tierOrConfig === "object" && tierOrConfig?.key) {
    return DELEGATION_SCOPE_CONFIG[tierOrConfig.key] || DELEGATION_SCOPE_CONFIG.senior;
  }
  return String(tierOrConfig || "").toLowerCase() === "junior"
    ? DELEGATION_SCOPE_CONFIG.junior
    : DELEGATION_SCOPE_CONFIG.senior;
}

const feedState = {
  senior: { cachedPayload: null, cachedAt: 0, inFlightPromise: null },
  junior: { cachedPayload: null, cachedAt: 0, inFlightPromise: null },
};

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAME_TO_INDEX = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const IST_OFFSET_MS = 330 * 60 * 1000;

/**
 * Google Sheets Apps Script serializes IST midnight dates as UTC (e.g. T18:30:00.000Z).
 * Shifting into IST before slicing prevents off-by-one-day / off-by-one-month errors.
 */
export function toIstDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getTime() + IST_OFFSET_MS);
}

export function toIstDateKey(value) {
  const ist = toIstDate(value);
  return ist ? ist.toISOString().slice(0, 10) : "";
}

export function toIstMonthKey(value) {
  const ist = toIstDate(value);
  return ist ? ist.toISOString().slice(0, 7) : "";
}

export function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || "Unknown";
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES_SHORT[m - 1] || m} ${y}`;
}

export function formatIstDateDisplay(value) {
  const key = toIstDateKey(value);
  if (!key) return "-";
  const [y, m, d] = key.split("-");
  const mon = MONTH_NAMES_SHORT[Number(m) - 1] || m;
  return `${d}-${mon}-${y}`;
}

export function normalizeSeniorTaskStatus(rawStatus) {
  const clean = String(rawStatus || "").trim().toUpperCase();
  if (!clean) return "BLANK";
  if (clean === "DONE" || clean.includes("COMPLET")) return "DONE";
  if (clean.includes("CANCEL")) return "CANCELLED";
  if (clean === "WIP" || clean.includes("PROGRESS")) return "WIP";
  if (clean === "PENDING" || clean.includes("HOLD")) return "PENDING";
  return clean;
}

export function normalizeSeniorTaskRecord(raw, idx = 0) {
  const rawStatus = String(raw.Status || "").trim();
  const normStatus = normalizeSeniorTaskStatus(rawStatus);
  const timestamp = raw.Timestamp || "";
  const monthKey = toIstMonthKey(timestamp);
  const targetKey = toIstDateKey(raw["Target Completion Date"]);
  const actualKey = toIstDateKey(raw["Actual Date of Completion of work"]);
  const rev1Key = toIstDateKey(raw["Revision 1"]);
  const rev2Key = toIstDateKey(raw["Revision 2"]);
  const totalRevisions = Number(raw["Total Revisions"]) || 0;
  const deadlineStatus = String(raw._report?.deadlineStatus || "").trim();

  const isDone = normStatus === "DONE";
  const isCancelled = normStatus === "CANCELLED";
  const isOpen = !isDone && !isCancelled;

  const isOverdue =
    isOpen &&
    (deadlineStatus.toLowerCase().includes("past") ||
      (targetKey && targetKey < toIstDateKey(new Date().toISOString())));

  let completedOnTime = false;
  let completedLate = false;
  let delayDays = 0;

  if (isDone && targetKey && actualKey) {
    if (actualKey <= targetKey) {
      completedOnTime = true;
    } else {
      completedLate = true;
      const tMs = new Date(`${targetKey}T00:00:00Z`).getTime();
      const aMs = new Date(`${actualKey}T00:00:00Z`).getTime();
      delayDays = Math.max(0, Math.round((aMs - tMs) / 86400000));
    }
  }

  return {
    rowNumber: raw._report?.rowNumber || idx + 2,
    uniqueId: String(raw["Unique Id"] || `ROW-${idx + 2}`).trim(),
    timestamp,
    createdDateKey: toIstDateKey(timestamp),
    createdDateDisplay: formatIstDateDisplay(timestamp),
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    assignor: String(raw["Assignor Name"] || "Unassigned").trim(),
    doer: String(raw["Doer Name"] || "Unassigned").trim(),
    workType: String(raw["Type Of Work"] || "General").trim(),
    groupName: String(raw["Group Name"] || "-").trim(),
    clientName: String(raw["Client Name"] || "-").trim(),
    description: String(raw["Task Description"] || "").trim(),
    targetDate: raw["Target Completion Date"] || "",
    targetDateKey: targetKey,
    targetDateDisplay: formatIstDateDisplay(raw["Target Completion Date"]),
    revision1: raw["Revision 1"] || "",
    revision1Display: formatIstDateDisplay(raw["Revision 1"]),
    revision2: raw["Revision 2"] || "",
    revision2Display: formatIstDateDisplay(raw["Revision 2"]),
    actualDate: raw["Actual Date of Completion of work"] || "",
    actualDateKey: actualKey,
    actualDateDisplay: formatIstDateDisplay(raw["Actual Date of Completion of work"]),
    totalRevisions,
    hasRevision: totalRevisions > 0 || Boolean(rev1Key || rev2Key),
    rawStatus: rawStatus || "Blank",
    normStatus,
    remark: String(raw.Remark || "").trim(),
    period: String(raw.Period || "").trim(),
    deadlineStatus: deadlineStatus || "-",
    isDone,
    isCancelled,
    isOpen,
    isOverdue,
    completedOnTime,
    completedLate,
    delayDays,
  };
}

export async function fetchDelegationTaskReport(tier = "senior", forceRefresh = false) {
  const meta = getDelegationMeta(tier);
  const state = feedState[meta.key];
  const now = Date.now();
  if (!forceRefresh && state.cachedPayload && now - state.cachedAt < CACHE_TTL_MS) {
    return state.cachedPayload;
  }
  if (!forceRefresh && state.inFlightPromise) {
    return state.inFlightPromise;
  }

  state.inFlightPromise = fetch(meta.apiUrl)
    .then((res) => {
      if (!res.ok) throw new Error(`${meta.label} API HTTP ${res.status}`);
      return res.json();
    })
    .then((json) => {
      const report = json?.report || {};
      const rawTasks = Array.isArray(report.tasks) ? report.tasks : [];
      const tasks = rawTasks.map((row, i) => normalizeSeniorTaskRecord(row, i));
      const payload = {
        success: Boolean(json?.success),
        tier: meta.key,
        generatedAt: json?.generatedAt || new Date().toISOString(),
        sheetName: report.sheetName || meta.label,
        apiSummary: report.summary || {},
        tasks,
      };
      state.cachedPayload = payload;
      state.cachedAt = Date.now();
      try {
        const analytics = computeSeniorTaskAnalytics(tasks, payload);
        localStorage.setItem(meta.cacheKey, JSON.stringify({ cachedAt: state.cachedAt, overview: analytics.overview }));
      } catch (_) {}
      return payload;
    })
    .catch((err) => {
      console.warn(`fetchDelegationTaskReport (${meta.key}) error:`, err);
      if (state.cachedPayload) return state.cachedPayload;
      return {
        success: false,
        tier: meta.key,
        generatedAt: null,
        sheetName: meta.label,
        apiSummary: {},
        tasks: [],
        error: err.message,
      };
    })
    .finally(() => {
      state.inFlightPromise = null;
    });

  return state.inFlightPromise;
}

export function fetchSeniorTaskReport(forceRefresh = false) {
  return fetchDelegationTaskReport("senior", forceRefresh);
}

export function fetchJuniorTaskReport(forceRefresh = false) {
  return fetchDelegationTaskReport("junior", forceRefresh);
}

export function getCachedDelegationOverview(tier = "senior") {
  const meta = getDelegationMeta(tier);
  try {
    const raw = localStorage.getItem(meta.cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.overview || null;
  } catch (_) {
    return null;
  }
}

export function getCachedSeniorTaskOverview() {
  return getCachedDelegationOverview("senior");
}

export function getCachedJuniorTaskOverview() {
  return getCachedDelegationOverview("junior");
}

function accumulateBucket(map, key, task) {
  const bucketKey = key || "Unknown";
  if (!map[bucketKey]) {
    map[bucketKey] = {
      name: bucketKey,
      total: 0,
      done: 0,
      cancelled: 0,
      wip: 0,
      pending: 0,
      blank: 0,
      open: 0,
      overdue: 0,
      doneOnTime: 0,
      doneLate: 0,
      revisions: 0,
      tasksWithRevisions: 0,
      remarks: [],
    };
  }
  const b = map[bucketKey];
  b.total += 1;
  if (task.isDone) b.done += 1;
  else if (task.isCancelled) b.cancelled += 1;
  else b.open += 1;

  if (task.normStatus === "WIP") b.wip += 1;
  else if (task.normStatus === "PENDING") b.pending += 1;
  else if (task.normStatus === "BLANK") b.blank += 1;

  if (task.isOverdue) b.overdue += 1;
  if (task.completedOnTime) b.doneOnTime += 1;
  if (task.completedLate) b.doneLate += 1;
  b.revisions += task.totalRevisions;
  if (task.hasRevision) b.tasksWithRevisions += 1;
  if (task.isCancelled && task.remark && b.remarks.length < 5) {
    b.remarks.push({ id: task.uniqueId, remark: task.remark, client: task.clientName, desc: task.description });
  }
}

function finalizeBuckets(map, sortField = "total") {
  return Object.values(map)
    .map((b) => {
      const doneWithDates = b.doneOnTime + b.doneLate;
      return {
        ...b,
        cancelRate: b.total ? Number(((b.cancelled / b.total) * 100).toFixed(1)) : 0,
        doneRate: b.total ? Number(((b.done / b.total) * 100).toFixed(1)) : 0,
        onTimeRate: doneWithDates ? Number(((b.doneOnTime / doneWithDates) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b[sortField] - a[sortField] || b.total - a.total);
}

/**
 * Computes full multi-dimensional Senior Task analytics once per dataset.
 */
export function computeSeniorTaskAnalytics(tasks = [], meta = {}) {
  const list = Array.isArray(tasks) ? tasks : [];
  const totalTasks = list.length;

  const monthMap = {};
  const doerMap = {};
  const assignorMap = {};
  const workTypeMap = {};
  const groupMap = {};
  const clientMap = {};

  let doneCount = 0;
  let cancelledCount = 0;
  let wipCount = 0;
  let pendingCount = 0;
  let blankCount = 0;
  let openCount = 0;
  let overdueCount = 0;
  let dueWithin7DaysCount = 0;
  let upcomingCount = 0;
  let doneOnTimeCount = 0;
  let doneLateCount = 0;
  let totalRevisions = 0;
  let tasksWithRevisions = 0;
  let rev1Count = 0;
  let rev2Count = 0;

  const monthCancelAssignors = {};
  const monthCancelDoers = {};

  list.forEach((t) => {
    if (t.isDone) doneCount += 1;
    else if (t.isCancelled) cancelledCount += 1;
    else openCount += 1;

    if (t.normStatus === "WIP") wipCount += 1;
    else if (t.normStatus === "PENDING") pendingCount += 1;
    else if (t.normStatus === "BLANK") blankCount += 1;

    if (t.isOverdue) overdueCount += 1;
    if (t.isOpen && t.deadlineStatus === "Due within 7 days") dueWithin7DaysCount += 1;
    if (t.isOpen && t.deadlineStatus === "Upcoming") upcomingCount += 1;
    if (t.completedOnTime) doneOnTimeCount += 1;
    if (t.completedLate) doneLateCount += 1;

    totalRevisions += t.totalRevisions;
    if (t.hasRevision) tasksWithRevisions += 1;
    if (t.revision1) rev1Count += 1;
    if (t.revision2) rev2Count += 1;

    const mk = t.monthKey || "Unknown";
    accumulateBucket(monthMap, mk, t);
    accumulateBucket(doerMap, t.doer, t);
    accumulateBucket(assignorMap, t.assignor, t);
    accumulateBucket(workTypeMap, t.workType, t);
    accumulateBucket(groupMap, t.groupName, t);
    accumulateBucket(clientMap, t.clientName, t);

    if (t.isCancelled) {
      if (!monthCancelAssignors[mk]) monthCancelAssignors[mk] = {};
      if (!monthCancelDoers[mk]) monthCancelDoers[mk] = {};
      monthCancelAssignors[mk][t.assignor] = (monthCancelAssignors[mk][t.assignor] || 0) + 1;
      monthCancelDoers[mk][t.doer] = (monthCancelDoers[mk][t.doer] || 0) + 1;
    }
  });

  const monthly = Object.values(monthMap)
    .map((m) => {
      const doneWithDates = m.doneOnTime + m.doneLate;
      const topAssignorEntry = Object.entries(monthCancelAssignors[m.name] || {}).sort((a, b) => b[1] - a[1])[0];
      const topDoerEntry = Object.entries(monthCancelDoers[m.name] || {}).sort((a, b) => b[1] - a[1])[0];
      return {
        ...m,
        monthKey: m.name,
        monthLabel: formatMonthLabel(m.name),
        cancelRate: m.total ? Number(((m.cancelled / m.total) * 100).toFixed(1)) : 0,
        doneRate: m.total ? Number(((m.done / m.total) * 100).toFixed(1)) : 0,
        onTimeRate: doneWithDates ? Number(((m.doneOnTime / doneWithDates) * 100).toFixed(1)) : 0,
        topCancelAssignor: topAssignorEntry ? `${topAssignorEntry[0]} (${topAssignorEntry[1]})` : "-",
        topCancelDoer: topDoerEntry ? `${topDoerEntry[0]} (${topDoerEntry[1]})` : "-",
      };
    })
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const doers = finalizeBuckets(doerMap, "total");
  const assignors = finalizeBuckets(assignorMap, "total");
  const workTypes = finalizeBuckets(workTypeMap, "total");
  const groups = finalizeBuckets(groupMap, "total");
  const clients = finalizeBuckets(clientMap, "total");

  const doersByCancelled = [...doers].filter((d) => d.cancelled > 0).sort((a, b) => b.cancelled - a.cancelled || b.cancelRate - a.cancelRate);
  const assignorsByCancelled = [...assignors].filter((a) => a.cancelled > 0).sort((a, b) => b.cancelled - a.cancelled || b.cancelRate - a.cancelRate);
  const workTypesByCancelled = [...workTypes].filter((w) => w.cancelled > 0).sort((a, b) => b.cancelled - a.cancelled);
  const monthsByCancelled = [...monthly].sort((a, b) => b.cancelled - a.cancelled);
  const doersByRevisions = [...doers].filter((d) => d.revisions > 0 || d.tasksWithRevisions > 0).sort((a, b) => b.revisions - a.revisions);

  const doneWithDatesTotal = doneOnTimeCount + doneLateCount;
  const overview = {
    totalTasks,
    doneCount,
    cancelledCount,
    wipCount,
    pendingCount,
    blankCount,
    openCount,
    overdueCount,
    dueWithin7DaysCount,
    upcomingCount,
    doneOnTimeCount,
    doneLateCount,
    onTimeRate: doneWithDatesTotal ? Number(((doneOnTimeCount / doneWithDatesTotal) * 100).toFixed(1)) : 0,
    completionRate: totalTasks ? Number(((doneCount / totalTasks) * 100).toFixed(1)) : 0,
    cancelRate: totalTasks ? Number(((cancelledCount / totalTasks) * 100).toFixed(1)) : 0,
    totalRevisions,
    tasksWithRevisions,
    rev1Count,
    rev2Count,
    uniqueDoers: doers.length,
    uniqueAssignors: assignors.length,
    uniqueWorkTypes: workTypes.length,
    uniqueGroups: groups.length,
    uniqueClients: clients.length,
    monthCount: monthly.length,
    dateRange: monthly.length ? `${monthly[0].monthLabel} – ${monthly[monthly.length - 1].monthLabel}` : "-",
    topCancelledDoer: doersByCancelled[0] || null,
    topCancelledAssignor: assignorsByCancelled[0] || null,
    peakCancelledMonth: monthsByCancelled[0] || null,
    generatedAt: meta?.generatedAt || null,
  };

  return {
    overview,
    monthly,
    doers,
    assignors,
    workTypes,
    groups,
    clients,
    doersByCancelled,
    assignorsByCancelled,
    workTypesByCancelled,
    monthsByCancelled,
    doersByRevisions,
    cancelledTasks: list.filter((t) => t.isCancelled),
    overdueTasks: list.filter((t) => t.isOverdue),
    dueWithin7DaysTasks: list.filter((t) => t.isOpen && t.deadlineStatus === "Due within 7 days"),
    revisedTasks: list.filter((t) => t.hasRevision),
  };
}

/**
 * Resolves optional month/year filters from natural language (e.g., "october 2025", "feb 26", "last month", "august").
 */
export function filterTasksByNaturalMonth(tasks = [], query = "") {
  const q = String(query || "").toLowerCase();
  if (!q) return { matchedLabel: null, monthKey: null, filtered: tasks };

  const allMonths = Array.from(new Set(tasks.map((t) => t.monthKey).filter(Boolean))).sort();
  if (!allMonths.length) return { matchedLabel: null, monthKey: null, filtered: tasks };

  if (q.includes("this month") || q.includes("current month")) {
    const nowKey = toIstMonthKey(new Date().toISOString());
    const targetKey = allMonths.includes(nowKey) ? nowKey : allMonths[allMonths.length - 1];
    return {
      matchedLabel: formatMonthLabel(targetKey),
      monthKey: targetKey,
      filtered: tasks.filter((t) => t.monthKey === targetKey),
    };
  }

  if (q.includes("last month") || q.includes("previous month")) {
    const targetKey = allMonths[Math.max(0, allMonths.length - 2)];
    return {
      matchedLabel: formatMonthLabel(targetKey),
      monthKey: targetKey,
      filtered: tasks.filter((t) => t.monthKey === targetKey),
    };
  }

  const yearMatch = q.match(/\b(202[4-9])\b/);
  const explicitYear = yearMatch ? Number(yearMatch[1]) : null;

  let matchedMonthIndex = null;
  for (const [token, idx] of Object.entries(MONTH_NAME_TO_INDEX)) {
    const regex = new RegExp(`\\b${token}\\b`, "i");
    if (regex.test(q)) {
      matchedMonthIndex = idx;
      break;
    }
  }

  if (matchedMonthIndex !== null) {
    const mm = String(matchedMonthIndex + 1).padStart(2, "0");
    if (explicitYear) {
      const key = `${explicitYear}-${mm}`;
      return {
        matchedLabel: formatMonthLabel(key),
        monthKey: key,
        filtered: tasks.filter((t) => t.monthKey === key),
      };
    }
    const candidates = allMonths.filter((m) => m.endsWith(`-${mm}`));
    if (candidates.length === 1) {
      const key = candidates[0];
      return {
        matchedLabel: formatMonthLabel(key),
        monthKey: key,
        filtered: tasks.filter((t) => t.monthKey === key),
      };
    }
    if (candidates.length > 1) {
      const wantsAllYears = q.includes("all year") || q.includes("both year") || q.includes("both ");
      if (wantsAllYears) {
        const combined = tasks.filter((t) => candidates.includes(t.monthKey));
        return {
          matchedLabel: `${MONTH_NAMES_SHORT[matchedMonthIndex]} (${candidates.map((c) => c.slice(0, 4)).join(" & ")})`,
          monthKey: candidates.join(","),
          filtered: combined,
        };
      }
      // Default to the latest occurrence (e.g. Oct 2026 rather than merging Oct 2025 + Oct 2026)
      const latestKey = candidates[candidates.length - 1];
      return {
        matchedLabel: formatMonthLabel(latestKey),
        monthKey: latestKey,
        otherYears: candidates.slice(0, -1).map((c) => formatMonthLabel(c)),
        filtered: tasks.filter((t) => t.monthKey === latestKey),
      };
    }
  }

  if (explicitYear) {
    const yearStr = String(explicitYear);
    return {
      matchedLabel: `Year ${yearStr}`,
      monthKey: yearStr,
      filtered: tasks.filter((t) => t.monthKey.startsWith(yearStr)),
    };
  }

  return { matchedLabel: null, monthKey: null, filtered: tasks };
}

function emptyDatasetMessage(tier = "senior") {
  const meta = getDelegationMeta(tier);
  return `⏳ **${meta.label} Data Not Loaded Yet**:\n\nLive data from the ${meta.label} Google Apps Script API is still loading or temporarily unreachable. Please wait a few seconds and try again, or open the **Delegation (${meta.shortLabel} & ${meta.key === "senior" ? "Junior" : "Senior"})** card on Admin MD to inspect/refresh.`;
}

function buildTag(meta, suffix, scope = "") {
  return scope ? `[DOWNLOAD_${meta.tagPrefix}_${suffix}:${scope}]` : `[DOWNLOAD_${meta.tagPrefix}_${suffix}]`;
}

// ---------------------------------------------------------------------------
// CHATBOT AI REPORT GENERATORS (SENIOR + JUNIOR PARAMETERIZED)
// ---------------------------------------------------------------------------

export function getSeniorTaskOverviewReport(tasks = [], precomputed = null, tier = "senior") {
  const meta = getDelegationMeta(tier);
  if (!tasks.length) return emptyDatasetMessage(tier);
  const analytics = precomputed || computeSeniorTaskAnalytics(tasks);
  const { overview, monthsByCancelled, doersByCancelled, assignorsByCancelled } = analytics;

  const topCancelMonth = monthsByCancelled[0];
  const topDoer = doersByCancelled[0];
  const topAssignor = assignorsByCancelled[0];

  return `🗂️ **${meta.label} Delegation (${meta.pluralLabel} Data) Executive AI Overview**
• 📅 **Dataset Coverage**: ${overview.dateRange} (${overview.monthCount} months)
• 📌 **Total ${meta.shortLabel} Tasks**: **${overview.totalTasks.toLocaleString("en-IN")}** across **${overview.uniqueClients}** clients & **${overview.uniqueWorkTypes}** work types

### 📊 Status Breakdown:
• ✅ **Done / Completed**: **${overview.doneCount.toLocaleString("en-IN")}** (**${overview.completionRate}%**)
• ❌ **Cancelled**: **${overview.cancelledCount.toLocaleString("en-IN")}** (**${overview.cancelRate}%** cancellation rate)
• 🔄 **Open / Active Pipeline**: **${overview.openCount}** (*WIP: ${overview.wipCount}, Pending: ${overview.pendingCount}, Blank Status: ${overview.blankCount}*)
• 🚨 **Overdue (Past Target Date)**: **${overview.overdueCount}** | ⏳ **Due Within 7 Days**: **${overview.dueWithin7DaysCount}**

### 🎯 Timeliness & Revisions:
• ⏱️ **On-Time Completion Rate**: **${overview.onTimeRate}%** (**${overview.doneOnTimeCount}** on/before target vs **${overview.doneLateCount}** completed after target date)
• 🔁 **Total Target Revisions**: **${overview.totalRevisions.toLocaleString("en-IN")}** across **${overview.tasksWithRevisions}** revised tasks

### 🔥 Key Cancellation Highlights:
${topCancelMonth ? `• 📅 **Peak Cancelled Month**: **${topCancelMonth.monthLabel}** — **${topCancelMonth.cancelled}** tasks cancelled (**${topCancelMonth.cancelRate}%** of ${topCancelMonth.total} tasks)` : ""}
${topDoer ? `• 👤 **Most Cancelled ${meta.doerLabel}**: **${topDoer.name}** — **${topDoer.cancelled}** cancelled out of ${topDoer.total} (**${topDoer.cancelRate}%**)` : ""}
${topAssignor ? `• 👔 **Top Cancelling Assignor**: **${topAssignor.name}** — **${topAssignor.cancelled}** cancelled out of ${topAssignor.total} (**${topAssignor.cancelRate}%**)` : ""}

💡 *Ask: "Month-wise ${meta.shortLabel.toLowerCase()} task report", "${meta.shortLabel} cancelled tasks report", "${meta.shortLabel} overdue tasks report", or "${meta.shortLabel} done tasks report".*

${buildTag(meta, "EXCEL")}`;
}

export function getSeniorTaskMonthWiseReport(tasks = [], query = "", tier = "senior") {
  const meta = getDelegationMeta(tier);
  if (!tasks.length) return emptyDatasetMessage(tier);
  const { matchedLabel, monthKey, filtered } = filterTasksByNaturalMonth(tasks, query);
  const dlScope = monthKey || "ALL";

  if (matchedLabel) {
    if (!filtered.length) {
      return `📅 **No ${meta.label}s found for ${matchedLabel}**.`;
    }
    const sub = computeSeniorTaskAnalytics(filtered);
    const { overview, doersByCancelled, assignorsByCancelled, doers, workTypes, cancelledTasks } = sub;

    let res = `📅 **${meta.label} Month-Wise AI Report — ${matchedLabel}**\n\n`;
    res += `• 📌 **Total ${meta.shortLabel} Tasks**: **${overview.totalTasks}** | ✅ **Done**: **${overview.doneCount}** (**${overview.completionRate}%**)\n`;
    res += `• ❌ **Cancelled**: **${overview.cancelledCount}** (**${overview.cancelRate}%**) | 🔄 **Open**: **${overview.openCount}** | 🚨 **Overdue**: **${overview.overdueCount}**\n`;
    res += `• 🔁 **Revisions**: **${overview.totalRevisions}** across **${overview.tasksWithRevisions}** tasks | ⏱️ **On-Time Rate**: **${overview.onTimeRate}%**\n\n`;

    if (doersByCancelled.length > 0) {
      res += `### ❌ Most Cancelled by ${meta.doerLabel} (${matchedLabel}):\n`;
      doersByCancelled.slice(0, 6).forEach((d, idx) => {
        res += `${idx + 1}. **${d.name}** — **${d.cancelled}** cancelled / ${d.total} (*${d.cancelRate}%*)\n`;
      });
      res += `\n`;
    }

    if (assignorsByCancelled.length > 0) {
      res += `### 👔 Cancelled by Assignor (${matchedLabel}):\n`;
      assignorsByCancelled.slice(0, 5).forEach((a, idx) => {
        res += `${idx + 1}. **${a.name}** — **${a.cancelled}** cancelled / ${a.total} (*${a.cancelRate}%*)\n`;
      });
      res += `\n`;
    }

    res += `### 🏆 Top Active ${meta.pluralLabel} (${matchedLabel}):\n`;
    doers.slice(0, 5).forEach((d, idx) => {
      res += `${idx + 1}. **${d.name}** — ${d.total} tasks (✅ ${d.done}, ❌ ${d.cancelled}, 🔄 ${d.open})\n`;
    });

    if (workTypes.length > 0) {
      res += `\n### 🏷️ Top Work Types:\n`;
      res += workTypes.slice(0, 5).map((w) => `• **${w.name}**: ${w.total} (*${w.cancelled} cancelled*)`).join("\n") + "\n";
    }

    if (cancelledTasks.length > 0) {
      const sampleRemarks = cancelledTasks.filter((t) => t.remark).slice(0, 4);
      if (sampleRemarks.length > 0) {
        res += `\n### 📝 Sample Cancel Remarks (${matchedLabel}):\n`;
        sampleRemarks.forEach((c) => {
          res += `• **${c.uniqueId}** (${c.doer}): *"${c.remark}"*\n`;
        });
      }
    }

    res += `\n${buildTag(meta, "MONTHLY_EXCEL", dlScope)}`;
    return res;
  }

  const analytics = computeSeniorTaskAnalytics(tasks);
  const { overview, monthly, monthsByCancelled } = analytics;

  let res = `📅 **${meta.label} Month-Wise Report (${overview.dateRange})**\n`;
  res += `• 📊 **Grand Total**: **${overview.totalTasks.toLocaleString("en-IN")}** ${meta.shortLabel} Tasks | ✅ **${overview.doneCount.toLocaleString("en-IN")}** Done | ❌ **${overview.cancelledCount}** Cancelled (**${overview.cancelRate}%**) | 🔁 **${overview.totalRevisions}** Revisions\n\n`;

  res += `### 🗓️ Monthly Breakdown (Chronological):\n`;
  monthly.forEach((m) => {
    res += `• **${m.monthLabel}**: **${m.total}** total | ✅ **${m.done}** (${m.doneRate}%) | ❌ **${m.cancelled}** (${m.cancelRate}%) | 🔄 ${m.open} open | 🔁 ${m.revisions} rev\n`;
  });

  res += `\n### 🚨 Top 5 Months by Cancellations:\n`;
  monthsByCancelled.slice(0, 5).forEach((m, i) => {
    res += `${i + 1}. **${m.monthLabel}** — **${m.cancelled}** cancelled (${m.cancelRate}%) | Top ${meta.shortLabel}: *${m.topCancelDoer}* | Assignor: *${m.topCancelAssignor}*\n`;
  });

  res += `\n💡 *Tip: Ask "${meta.shortLabel} task report for October 2026" or "${meta.shortLabel} cancelled tasks in Feb 2026" for any specific month.*\n\n${buildTag(meta, "MONTHLY_EXCEL", "ALL")}`;
  return res;
}

export function getSeniorTaskCancelledReport(tasks = [], query = "", tier = "senior") {
  const meta = getDelegationMeta(tier);
  if (!tasks.length) return emptyDatasetMessage(tier);
  const { matchedLabel, monthKey, filtered } = filterTasksByNaturalMonth(tasks, query);
  const scopeTasks = matchedLabel ? filtered : tasks;
  const scopeLabel = matchedLabel || "All Time";
  const dlScope = monthKey || "ALL";

  if (!scopeTasks.length) {
    return `❌ **No ${meta.label} records found for ${scopeLabel}.**`;
  }

  const analytics = computeSeniorTaskAnalytics(scopeTasks);
  const {
    overview,
    monthly,
    doersByCancelled,
    assignorsByCancelled,
    monthsByCancelled,
    workTypesByCancelled,
    cancelledTasks,
  } = analytics;
  const wantsAllMonths = !matchedLabel && String(query || "").toLowerCase().includes("month");

  if (!overview.cancelledCount) {
    return `✅ **Zero Cancelled Tasks in ${scopeLabel}** across ${overview.totalTasks} ${meta.label}s!`;
  }

  const topDoer = doersByCancelled[0];
  const topAssignor = assignorsByCancelled[0];
  const highRateDoer = [...doersByCancelled].filter((d) => d.total >= 15).sort((a, b) => b.cancelRate - a.cancelRate)[0];

  let res = `❌ **${meta.label} Cancellation AI Report (${scopeLabel})**\n\n`;
  res += `• 🚨 **Total Cancelled Tasks**: **${overview.cancelledCount.toLocaleString("en-IN")}** out of **${overview.totalTasks.toLocaleString("en-IN")}** (**${overview.cancelRate}% cancellation rate**)\n`;
  if (topDoer) {
    res += `• 👤 **${meta.doerLabel} With Most Cancelled Tasks**: **${topDoer.name}** — **${topDoer.cancelled}** tasks cancelled (*${topDoer.cancelRate}% of their ${topDoer.total} tasks*)\n`;
  }
  if (topAssignor) {
    res += `• 👔 **Assignor With Most Cancelled Tasks**: **${topAssignor.name}** — **${topAssignor.cancelled}** tasks cancelled (*${topAssignor.cancelRate}% of their ${topAssignor.total} assigned tasks*)\n`;
  }
  if (highRateDoer && highRateDoer.name !== topDoer?.name) {
    res += `• 📈 **Highest Cancellation Rate (≥15 tasks)**: **${highRateDoer.name}** (**${highRateDoer.cancelRate}%** — ${highRateDoer.cancelled}/${highRateDoer.total})\n`;
  }

  res += `\n### 👥 Top 10 ${meta.pluralLabel} (Doers) by Cancelled Tasks:\n`;
  doersByCancelled.slice(0, 10).forEach((d, idx) => {
    res += `${idx + 1}. **${d.name}** — **${d.cancelled}** cancelled / ${d.total} total (**${d.cancelRate}%**)\n`;
  });

  res += `\n### 👔 Assignor-Wise Cancellations (Who Assigned / Cancelled Most):\n`;
  assignorsByCancelled.slice(0, 8).forEach((a, idx) => {
    res += `${idx + 1}. **${a.name}** — **${a.cancelled}** cancelled / ${a.total} assigned (**${a.cancelRate}%**)\n`;
  });

  if (!matchedLabel && monthsByCancelled.length > 0) {
    if (wantsAllMonths) {
      res += `\n### 📅 Month-Wise Cancellations (Chronological):\n`;
      monthly.forEach((m) => {
        res += `• **${m.monthLabel}**: **${m.cancelled}** cancelled / ${m.total} total (${m.cancelRate}%) | Top ${meta.shortLabel}: ${m.topCancelDoer}\n`;
      });
    } else {
      res += `\n### 📅 Top 6 Months by Cancellations:\n`;
      monthsByCancelled.slice(0, 6).forEach((m, idx) => {
        res += `${idx + 1}. **${m.monthLabel}** — **${m.cancelled}** cancelled (${m.cancelRate}% of ${m.total}) | Top ${meta.shortLabel}: ${m.topCancelDoer}\n`;
      });
    }
  }

  if (workTypesByCancelled.length > 0) {
    res += `\n### 🏷️ Top Work Types Cancelled:\n`;
    workTypesByCancelled.slice(0, 6).forEach((w) => {
      res += `• **${w.name}**: **${w.cancelled}** cancelled / ${w.total} (${w.cancelRate}%)\n`;
    });
  }

  const remarked = cancelledTasks.filter((c) => c.remark).slice(-5).reverse();
  if (remarked.length > 0) {
    res += `\n### 📝 Recent Cancellation Remarks:\n`;
    remarked.forEach((c) => {
      res += `• **${c.uniqueId}** (${c.createdDateDisplay}) — **${c.doer}** | Assignor: ${c.assignor} — *"${c.remark}"*\n`;
    });
  }

  res += `\n${buildTag(meta, "CANCEL_EXCEL", dlScope)}`;
  return res;
}

export function getSeniorTaskRevisionsAndOverdueReport(tasks = [], query = "", tier = "senior") {
  const meta = getDelegationMeta(tier);
  if (!tasks.length) return emptyDatasetMessage(tier);
  const q = String(query || "").toLowerCase();
  const { matchedLabel, monthKey, filtered } = filterTasksByNaturalMonth(tasks, query);
  const scopeTasks = matchedLabel ? filtered : tasks;
  const scopeLabel = matchedLabel || "All Time";
  const dlScope = monthKey || "ALL";
  const analytics = computeSeniorTaskAnalytics(scopeTasks);
  const { overview, doersByRevisions, overdueTasks, doers, assignors, workTypes } = analytics;

  const focusOverdue = q.includes("overdue") || q.includes("past target") || q.includes("pending") || q.includes("delay") || q.includes("due");

  if (focusOverdue) {
    const overdueByDoer = [...doers].filter((d) => d.overdue > 0).sort((a, b) => b.overdue - a.overdue);
    const overdueByAssignor = [...assignors].filter((a) => a.overdue > 0).sort((a, b) => b.overdue - a.overdue);
    const overdueByWorkType = [...workTypes].filter((w) => w.overdue > 0).sort((a, b) => b.overdue - a.overdue);

    let res = `🚨 **${meta.label} Overdue & Open Pipeline AI Report (${scopeLabel})**\n\n`;
    res += `• 🚨 **Overdue (Past Target Date)**: **${overview.overdueCount}** open tasks\n`;
    res += `• ⏳ **Due Within 7 Days**: **${overview.dueWithin7DaysCount}** | 📅 **Upcoming**: **${overview.upcomingCount}**\n`;
    res += `• 🔄 **Total Open Tasks**: **${overview.openCount}** (*WIP: ${overview.wipCount}, Pending: ${overview.pendingCount}, Blank Status: ${overview.blankCount}*)\n\n`;

    if (overdueByDoer.length > 0) {
      res += `### 👤 Top ${meta.pluralLabel} (Doers) by Overdue Tasks:\n`;
      overdueByDoer.slice(0, 12).forEach((d, i) => {
        res += `${i + 1}. **${d.name}** — **${d.overdue}** overdue (*${d.open} total open*)\n`;
      });
    }

    if (overdueByAssignor.length > 0) {
      res += `\n### 👔 Overdue Tasks by Assignor:\n`;
      overdueByAssignor.slice(0, 6).forEach((a, i) => {
        res += `${i + 1}. **${a.name}** — **${a.overdue}** overdue (*${a.open} total open*)\n`;
      });
    }

    if (overdueByWorkType.length > 0) {
      res += `\n### 🏷️ Overdue Work Types:\n`;
      overdueByWorkType.slice(0, 6).forEach((w) => {
        res += `• **${w.name}**: **${w.overdue}** overdue\n`;
      });
    }

    if (overdueTasks.length > 0) {
      res += `\n### 📋 Sample Overdue Tasks:\n`;
      overdueTasks.slice(0, 8).forEach((t, i) => {
        res += `${i + 1}. **${t.uniqueId}** — **${t.doer}** (${t.clientName}) | Target: ${t.targetDateDisplay} | *${t.description.slice(0, 70)}*\n`;
      });
    }

    res += `\n${buildTag(meta, "OVERDUE_EXCEL", dlScope)}`;
    return res;
  }

  let res = `🔁 **${meta.label} Target Revisions & Timeliness Report (${scopeLabel})**\n\n`;
  res += `• 🔁 **Total Target Revisions**: **${overview.totalRevisions.toLocaleString("en-IN")}** across **${overview.tasksWithRevisions}** tasks\n`;
  res += `• 1️⃣ **Tasks with Revision 1**: **${overview.rev1Count}** | 2️⃣ **Tasks with Revision 2**: **${overview.rev2Count}**\n`;
  res += `• ⏱️ **On-Time Done Rate**: **${overview.onTimeRate}%** (*${overview.doneOnTimeCount} on/before target vs ${overview.doneLateCount} completed post-target*)\n\n`;

  if (doersByRevisions.length > 0) {
    res += `### 👤 Top ${meta.pluralLabel} (Doers) by Target Date Revisions:\n`;
    doersByRevisions.slice(0, 10).forEach((d, i) => {
      res += `${i + 1}. **${d.name}** — **${d.revisions}** revisions across **${d.tasksWithRevisions}** tasks (*On-time rate: ${d.onTimeRate}%*)\n`;
    });
  }

  res += `\n${buildTag(meta, "EXCEL")}`;
  return res;
}

export function getSeniorTaskDoneReport(tasks = [], query = "", tier = "senior") {
  const meta = getDelegationMeta(tier);
  if (!tasks.length) return emptyDatasetMessage(tier);
  const { matchedLabel, monthKey, filtered } = filterTasksByNaturalMonth(tasks, query);
  const scopeTasks = matchedLabel ? filtered : tasks;
  const scopeLabel = matchedLabel || "All Time";
  const dlScope = monthKey || "ALL";

  if (!scopeTasks.length) {
    return `✅ **No ${meta.label} records found for ${scopeLabel}.**`;
  }

  const analytics = computeSeniorTaskAnalytics(scopeTasks);
  const { overview, monthly, doers, assignors, workTypes } = analytics;

  const doersByDone = [...doers].filter((d) => d.done > 0).sort((a, b) => b.done - a.done || b.onTimeRate - a.onTimeRate);
  const assignorsByDone = [...assignors].filter((a) => a.done > 0).sort((a, b) => b.done - a.done);
  const workTypesByDone = [...workTypes].filter((w) => w.done > 0).sort((a, b) => b.done - a.done);
  const wantsMonths = !matchedLabel && String(query || "").toLowerCase().includes("month");

  let res = `✅ **${meta.label} Completed (Done) AI Report (${scopeLabel})**\n\n`;
  res += `• 🎯 **Total Completed (Done)**: **${overview.doneCount.toLocaleString("en-IN")}** out of **${overview.totalTasks.toLocaleString("en-IN")}** (**${overview.completionRate}% completion rate**)\n`;
  res += `• ⏱️ **On-Time Completion**: **${overview.doneOnTimeCount.toLocaleString("en-IN")}** on/before target (**${overview.onTimeRate}%**) | 🐢 **Post-Target**: **${overview.doneLateCount.toLocaleString("en-IN")}**\n`;
  res += `• 🔁 **Revisions Across Tasks**: **${overview.totalRevisions.toLocaleString("en-IN")}** (*${overview.tasksWithRevisions} tasks revised*)\n\n`;

  if (doersByDone.length > 0) {
    res += `### 🏆 Top ${meta.pluralLabel} (Doers) by Completed Tasks:\n`;
    doersByDone.slice(0, 10).forEach((d, idx) => {
      res += `${idx + 1}. **${d.name}** — **${d.done}** done / ${d.total} (**${d.doneRate}%** done | On-Time: **${d.onTimeRate}%**)\n`;
    });
  }

  if (assignorsByDone.length > 0) {
    res += `\n### 👔 Assignor-Wise Completed Tasks:\n`;
    assignorsByDone.slice(0, 8).forEach((a, idx) => {
      res += `${idx + 1}. **${a.name}** — **${a.done}** done / ${a.total} (**${a.doneRate}%**)\n`;
    });
  }

  if (wantsMonths && monthly.length > 0) {
    res += `\n### 📅 Month-Wise Completed Tasks:\n`;
    monthly.forEach((m) => {
      res += `• **${m.monthLabel}**: **${m.done}** done / ${m.total} (**${m.doneRate}%**) | On-Time: ${m.doneOnTime} vs Late: ${m.doneLate}\n`;
    });
  }

  if (workTypesByDone.length > 0) {
    res += `\n### 🏷️ Top Work Types Completed:\n`;
    workTypesByDone.slice(0, 6).forEach((w) => {
      res += `• **${w.name}**: **${w.done}** done / ${w.total} (**${w.doneRate}%**)\n`;
    });
  }

  res += `\n${buildTag(meta, "DONE_EXCEL", dlScope)}`;
  return res;
}

/**
 * Strips multi-prefix designations ("Sr-CA ", "Jr-MIS ", "MD-", etc.) for reliable cross-module matching.
 */
export function cleanSeniorPersonName(name = "") {
  const stripped = String(name || "")
    .replace(/^(md|sr|jr|hr)[\s-]+/i, "")
    .replace(/^(ca|cma|cs|adv|mr|mrs|ms|dr|hr|mis)[\s.-]+/i, "");
  return normalizeName(stripped);
}

/**
 * Finds tasks for any Senior/Junior/MD/Partner matched by Doer or Assignor name.
 */
export function getSeniorTaskPersonReport(tasks = [], query = "", tier = "senior") {
  const meta = getDelegationMeta(tier);
  if (!tasks.length) return null;
  const qNorm = cleanSeniorPersonName(query);
  if (!qNorm) return null;

  const uniqueNames = Array.from(
    new Set(tasks.flatMap((t) => [t.doer, t.assignor]).filter((n) => n && n !== "Unassigned"))
  );

  // Clean noise words to isolate candidate employee tokens
  const stripped = query
    .toLowerCase()
    .replace(
      /\b(senior|seniot|junior|juniot|task|tasks|delegation|delegated|cancelled|canceled|cancle|cancled|report|repost|summary|show|of|for|by|to|from|in|month|wise|most|who|all|the|ca|cma|sr|jr|md|hr|mis|sir)\b/g,
      " "
    )
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!stripped || stripped.length < 2) return null;

  const queryTokens = stripped.split(" ").filter((w) => w.length >= 2);
  if (!queryTokens.length) return null;

  const matchedName = uniqueNames.find((fullName) => {
    const nNorm = cleanSeniorPersonName(fullName);
    if (!nNorm) return false;
    if (nNorm.includes(stripped) || stripped.includes(nNorm)) return true;
    const nameTokens = nNorm.split(" ").filter((w) => w.length >= 2);
    return queryTokens.every((qt) => nameTokens.some((nt) => nt.includes(qt) || qt.includes(nt)));
  });

  if (!matchedName) return null;

  const targetNorm = cleanSeniorPersonName(matchedName);
  const asDoer = tasks.filter((t) => cleanSeniorPersonName(t.doer) === targetNorm);
  const asAssignor = tasks.filter((t) => cleanSeniorPersonName(t.assignor) === targetNorm);

  if (!asDoer.length && !asAssignor.length) return null;

  const doerStats = computeSeniorTaskAnalytics(asDoer);
  const assignorStats = computeSeniorTaskAnalytics(asAssignor);

  let res = `👤 **${meta.label} AI Scorecard — ${matchedName}**\n\n`;

  if (asDoer.length > 0) {
    const ov = doerStats.overview;
    res += `### 📌 As ${meta.doerLabel} (**${ov.totalTasks}** Tasks):\n`;
    res += `• ✅ **Done**: **${ov.doneCount}** (${ov.completionRate}%) | ❌ **Cancelled**: **${ov.cancelledCount}** (**${ov.cancelRate}%**)\n`;
    res += `• 🔄 **Open**: **${ov.openCount}** (*Overdue: ${ov.overdueCount}*) | 🔁 **Revisions**: **${ov.totalRevisions}** (${ov.tasksWithRevisions} tasks)\n`;
    res += `• ⏱️ **On-Time Completion**: **${ov.onTimeRate}%** (*${ov.doneOnTimeCount} on time, ${ov.doneLateCount} late*)\n`;

    if (doerStats.workTypes.length > 0) {
      res += `• 🏷️ **Top Work Types**: ${doerStats.workTypes.slice(0, 4).map((w) => `${w.name} (${w.total})`).join(", ")}\n`;
    }
    const recentCancelled = doerStats.cancelledTasks.slice(-3).reverse();
    if (recentCancelled.length > 0) {
      res += `• 📝 **Recent Cancelled Tasks**:\n`;
      recentCancelled.forEach((c) => {
        res += `  - **${c.uniqueId}** (${c.createdDateDisplay}, ${c.clientName}): *${c.description.slice(0, 60)}*${c.remark ? ` — Remark: "${c.remark}"` : ""}\n`;
      });
    }
    res += `\n`;
  }
  if (asAssignor.length > 0) {
    const ov = assignorStats.overview;
    res += `### 👔 As Task Assignor (**${ov.totalTasks}** Assigned):\n`;
    res += `• ✅ **Done**: **${ov.doneCount}** (${ov.completionRate}%) | ❌ **Cancelled**: **${ov.cancelledCount}** (**${ov.cancelRate}%**) | 🔄 **Open**: **${ov.openCount}**\n`;
  }

  res += `\n${buildTag(meta, "EXCEL")}`;
  return res;
}

export function getSeniorTaskWorkTypeOrClientReport(tasks = [], query = "", tier = "senior") {
  const meta = getDelegationMeta(tier);
  if (!tasks.length) return null;
  const analytics = computeSeniorTaskAnalytics(tasks);
  const { workTypes, groups } = analytics;
  const q = String(query || "").toLowerCase();

  if (q.includes("work type") || q.includes("type of work") || q.includes("category")) {
    let res = `🏷️ **${meta.label} Work-Type Breakdown (${workTypes.length} Categories)**\n\n`;
    workTypes.slice(0, 15).forEach((w, i) => {
      res += `${i + 1}. **${w.name}** — **${w.total}** tasks (✅ ${w.done}, ❌ ${w.cancelled} [${w.cancelRate}%], 🔄 ${w.open})\n`;
    });
    res += `\n${buildTag(meta, "EXCEL")}`;
    return res;
  }

  if (q.includes("group") || q.includes("client")) {
    let res = `🏢 **${meta.label} Top Client Groups (${groups.length} Corporate Groups)**\n\n`;
    groups.slice(0, 15).forEach((g, i) => {
      res += `${i + 1}. **${g.name}** — **${g.total}** tasks (✅ ${g.done}, ❌ ${g.cancelled} [${g.cancelRate}%], 🔄 ${g.open})\n`;
    });
    res += `\n${buildTag(meta, "EXCEL")}`;
    return res;
  }

  return null;
}

export const getJuniorTaskOverviewReport = (tasks = [], pre = null) => getSeniorTaskOverviewReport(tasks, pre, "junior");
export const getJuniorTaskMonthWiseReport = (tasks = [], query = "") => getSeniorTaskMonthWiseReport(tasks, query, "junior");
export const getJuniorTaskCancelledReport = (tasks = [], query = "") => getSeniorTaskCancelledReport(tasks, query, "junior");
export const getJuniorTaskRevisionsAndOverdueReport = (tasks = [], query = "") =>
  getSeniorTaskRevisionsAndOverdueReport(tasks, query, "junior");
export const getJuniorTaskDoneReport = (tasks = [], query = "") => getSeniorTaskDoneReport(tasks, query, "junior");
export const getJuniorTaskPersonReport = (tasks = [], query = "") => getSeniorTaskPersonReport(tasks, query, "junior");
export const getJuniorTaskWorkTypeOrClientReport = (tasks = [], query = "") =>
  getSeniorTaskWorkTypeOrClientReport(tasks, query, "junior");

// ---------------------------------------------------------------------------
// MULTI-TAB EXCEL WORKBOOK EXPORTERS (ExcelJS + file-saver)
// ---------------------------------------------------------------------------

function appendStyledSheet(
  wb,
  sheetName,
  rows,
  colWidths = [],
  bannerColor = "4338CA",
  headerColor = "1E3A8A",
  analyticsTitle = "Senior Task Analytics"
) {
  const ws = wb.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 3, showGridLines: true }],
  });

  const safeRows = rows && rows.length > 0 ? rows : [{ Info: "No matching records available" }];
  const keys = Object.keys(safeRows[0]);
  const lastColLetter = String.fromCharCode(64 + Math.min(26, keys.length));

  ws.columns = keys.map((k, idx) => ({
    header: k,
    key: k,
    width: colWidths[idx] || Math.max(14, Math.min(40, k.length + 6)),
  }));

  ws.spliceRows(1, 0, [sheetName.toUpperCase()], [`Agrawal Jain & Co. • ${analyticsTitle} | Rows: ${rows?.length || 0}`]);
  ws.mergeCells(`A1:${lastColLetter}1`);
  ws.mergeCells(`A2:${lastColLetter}2`);

  const titleRow = ws.getRow(1);
  titleRow.height = 24;
  titleRow.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFF" } };
  titleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bannerColor } };
  titleRow.alignment = { vertical: "middle", horizontal: "left" };

  const subRow = ws.getRow(2);
  subRow.height = 18;
  subRow.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "E2E8F0" } };
  subRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bannerColor } };
  subRow.alignment = { vertical: "middle", horizontal: "left" };

  const headerRow = ws.getRow(3);
  headerRow.height = 22;
  headerRow.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColor } };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };

  safeRows.forEach((item, rIdx) => {
    const row = ws.addRow(item);
    row.font = { name: "Segoe UI", size: 10 };
    if (rIdx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
    }
  });
}

async function saveWorkbookFile(wb, filename) {
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), filename);
  return filename;
}

function buildTaskRowForExport(t, includeRevisionCols = true) {
  const base = {
    "Unique ID": t.uniqueId,
    "Created Date": t.createdDateDisplay,
    "Month": t.monthLabel,
    "Assignor Name": t.assignor,
    "Doer Name": t.doer,
    "Type Of Work": t.workType,
    "Group Name": t.groupName,
    "Client Name": t.clientName,
    "Task Description": t.description,
    "Target Date": t.targetDateDisplay,
    "Actual Completion Date": t.actualDateDisplay,
  };
  if (includeRevisionCols) {
    base["Revision 1"] = t.revision1Display;
    base["Revision 2"] = t.revision2Display;
    base["Total Revisions"] = t.totalRevisions;
  }
  base["Status"] = t.rawStatus;
  base["Deadline Status"] = t.deadlineStatus;
  base["Delay Days"] = t.completedLate ? t.delayDays : 0;
  base["Remark"] = t.remark;
  return base;
}

export async function exportSeniorTaskMasterExcel(inputTasks = null, tier = "senior") {
  const meta = getDelegationMeta(tier);
  const sheetSub = `${meta.label} Analytics`;
  let tasks = Array.isArray(inputTasks) && inputTasks.length ? inputTasks : null;
  if (!tasks) {
    const res = await fetchDelegationTaskReport(meta.key);
    tasks = res.tasks || [];
  }

  const analytics = computeSeniorTaskAnalytics(tasks);
  const { overview, monthly, doers, assignors, cancelledTasks, overdueTasks, revisedTasks, workTypes, groups } = analytics;

  const wb = new ExcelJS.Workbook();
  const today = new Date().toISOString().slice(0, 10);

  appendStyledSheet(
    wb,
    "Executive Summary",
    [
      { Metric: "Report Name", Value: `${meta.label} (Delegation) Full AI Analytics` },
      { Metric: "Generated Date", Value: today },
      { Metric: "Date Coverage", Value: overview.dateRange },
      { Metric: `Total ${meta.shortLabel} Tasks`, Value: overview.totalTasks },
      { Metric: "Completed (Done)", Value: overview.doneCount },
      { Metric: "Completion Rate (%)", Value: `${overview.completionRate}%` },
      { Metric: "Cancelled Tasks", Value: overview.cancelledCount },
      { Metric: "Cancellation Rate (%)", Value: `${overview.cancelRate}%` },
      { Metric: "Open Tasks (WIP / Pending / Blank)", Value: overview.openCount },
      { Metric: "Overdue (Past Target Date)", Value: overview.overdueCount },
      { Metric: "Due Within 7 Days", Value: overview.dueWithin7DaysCount },
      { Metric: "Completed On Time", Value: overview.doneOnTimeCount },
      { Metric: "Completed Late", Value: overview.doneLateCount },
      { Metric: "On-Time Rate (%)", Value: `${overview.onTimeRate}%` },
      { Metric: "Total Revisions Logged", Value: overview.totalRevisions },
      { Metric: `Most Cancelled ${meta.doerLabel}`, Value: overview.topCancelledDoer ? `${overview.topCancelledDoer.name} (${overview.topCancelledDoer.cancelled})` : "-" },
      { Metric: "Top Cancelling Assignor", Value: overview.topCancelledAssignor ? `${overview.topCancelledAssignor.name} (${overview.topCancelledAssignor.cancelled})` : "-" },
      { Metric: "Peak Cancellation Month", Value: overview.peakCancelledMonth ? `${overview.peakCancelledMonth.monthLabel} (${overview.peakCancelledMonth.cancelled})` : "-" },
    ],
    [34, 42],
    "4338CA",
    "1E3A8A",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Month-Wise Report",
    monthly.map((m) => ({
      Month: m.monthLabel,
      "Month Key": m.monthKey,
      "Total Tasks": m.total,
      "Done": m.done,
      "Completion %": `${m.doneRate}%`,
      "Cancelled": m.cancelled,
      "Cancel %": `${m.cancelRate}%`,
      "WIP": m.wip,
      "Pending": m.pending,
      "Blank Status": m.blank,
      "Total Open": m.open,
      "Total Revisions": m.revisions,
      "Done On Time": m.doneOnTime,
      "Done Late": m.doneLate,
      [`Top Cancelled ${meta.shortLabel}`]: m.topCancelDoer,
      "Top Cancelled Assignor": m.topCancelAssignor,
    })),
    [14, 12, 12, 10, 14, 12, 12, 10, 10, 14, 12, 15, 14, 12, 30, 30],
    "4338CA",
    "1E3A8A",
    sheetSub
  );

  const mapPersonRows = (list, label) =>
    list.map((p, idx) => ({
      Rank: idx + 1,
      [label]: p.name,
      "Total Tasks": p.total,
      "Done": p.done,
      "Completion %": `${p.doneRate}%`,
      "Cancelled": p.cancelled,
      "Cancel %": `${p.cancelRate}%`,
      "Open": p.open,
      "Overdue": p.overdue,
      "On-Time %": `${p.onTimeRate}%`,
      "Total Revisions": p.revisions,
    }));

  appendStyledSheet(wb, `${meta.shortLabel} Doer Performance`, mapPersonRows(doers, `${meta.doerLabel} Name`), [8, 28, 12, 10, 14, 12, 12, 10, 10, 12, 15], "4338CA", "1E3A8A", sheetSub);
  appendStyledSheet(wb, "Assignor Breakdown", mapPersonRows(assignors, "Assignor Name"), [8, 28, 12, 10, 14, 12, 12, 10, 10, 12, 15], "4338CA", "1E3A8A", sheetSub);

  appendStyledSheet(
    wb,
    "Cancelled Tasks",
    cancelledTasks.map((t) => buildTaskRowForExport(t, true)),
    [14, 14, 12, 24, 24, 20, 22, 28, 45, 14, 14, 14, 14, 12, 12, 18, 10, 32],
    "991B1B",
    "BE123C",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Overdue & Revisions",
    [...overdueTasks, ...revisedTasks.filter((r) => !r.isOverdue)].map((t) => buildTaskRowForExport(t, true)),
    [14, 14, 12, 24, 24, 20, 22, 28, 45, 14, 14, 14, 14, 12, 12, 18, 10, 32],
    "92400E",
    "B45309",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Work Types & Groups",
    [
      ...workTypes.map((w) => ({ Dimension: "Work Type", Name: w.name, Total: w.total, Done: w.done, Cancelled: w.cancelled, "Cancel %": `${w.cancelRate}%`, Open: w.open })),
      ...groups.slice(0, 60).map((g) => ({ Dimension: "Client Group", Name: g.name, Total: g.total, Done: g.done, Cancelled: g.cancelled, "Cancel %": `${g.cancelRate}%`, Open: g.open })),
    ],
    [14, 34, 12, 12, 12, 12, 12],
    "4338CA",
    "1E3A8A",
    sheetSub
  );

  appendStyledSheet(
    wb,
    `All ${meta.shortLabel} Tasks`,
    tasks.map((t) => buildTaskRowForExport(t, true)),
    [14, 14, 12, 24, 24, 20, 22, 28, 45, 14, 14, 14, 14, 12, 12, 18, 10, 32],
    "4338CA",
    "1E3A8A",
    sheetSub
  );

  return saveWorkbookFile(wb, `${meta.filePrefix}_AI_Analytics_${today}.xlsx`);
}

async function resolveScopedSeniorTasks(inputTasks = null, scopeOrQuery = "ALL", tier = "senior") {
  const meta = getDelegationMeta(tier);
  let baseTasks = Array.isArray(inputTasks) && inputTasks.length ? inputTasks : null;
  if (!baseTasks) {
    const res = await fetchDelegationTaskReport(meta.key);
    baseTasks = res.tasks || [];
  }

  const rawScope = String(scopeOrQuery || "").trim();
  if (!rawScope || rawScope.toUpperCase() === "ALL") {
    return {
      scopeTasks: baseTasks,
      analytics: computeSeniorTaskAnalytics(baseTasks),
      scopeLabel: "All Time",
      fileSlug: "All_Time",
      isSpecificScope: false,
    };
  }

  if (/^\d{4}-\d{2}(,\d{4}-\d{2})*$/.test(rawScope)) {
    const keys = rawScope.split(",");
    const scoped = baseTasks.filter((t) => keys.includes(t.monthKey));
    const label = keys.map(formatMonthLabel).join(" & ");
    return {
      scopeTasks: scoped,
      analytics: computeSeniorTaskAnalytics(scoped),
      scopeLabel: label,
      fileSlug: rawScope.replace(/,/g, "_"),
      isSpecificScope: true,
    };
  }

  if (/^\d{4}$/.test(rawScope)) {
    const scoped = baseTasks.filter((t) => t.monthKey.startsWith(rawScope));
    return {
      scopeTasks: scoped,
      analytics: computeSeniorTaskAnalytics(scoped),
      scopeLabel: `Year ${rawScope}`,
      fileSlug: rawScope,
      isSpecificScope: true,
    };
  }

  const { matchedLabel, monthKey, filtered } = filterTasksByNaturalMonth(baseTasks, rawScope);
  if (matchedLabel) {
    return {
      scopeTasks: filtered,
      analytics: computeSeniorTaskAnalytics(filtered),
      scopeLabel: matchedLabel,
      fileSlug: (monthKey || matchedLabel).replace(/[^a-zA-Z0-9_-]+/g, "_"),
      isSpecificScope: true,
    };
  }

  return {
    scopeTasks: baseTasks,
    analytics: computeSeniorTaskAnalytics(baseTasks),
    scopeLabel: "All Time",
    fileSlug: "All_Time",
    isSpecificScope: false,
  };
}

function buildRankedPersonSheetRows(list, roleLabel, options = {}) {
  const { metricField, metricHeader, rateField, rateHeader } = options;
  return list.map((p, idx) => ({
    Rank: idx + 1,
    [roleLabel]: p.name,
    [metricHeader]: p[metricField],
    "Total Assigned": p.total,
    [rateHeader]: `${p[rateField]}%`,
    "Done": p.done,
    "Cancelled": p.cancelled,
    "Open": p.open,
    "Overdue": p.overdue,
    "On-Time %": `${p.onTimeRate}%`,
  }));
}

function getDaysBetweenKeys(startKey, endKey) {
  if (!startKey || !endKey || startKey >= endKey) return 0;
  const s = new Date(`${startKey}T00:00:00Z`).getTime();
  const e = new Date(`${endKey}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((e - s) / 86400000));
}

export async function exportSeniorTaskCancelledExcel(inputTasks = null, scopeOrQuery = "ALL", tier = "senior") {
  const meta = getDelegationMeta(tier);
  const sheetSub = `${meta.label} Cancellation Analytics`;
  const { analytics, scopeLabel, fileSlug, isSpecificScope } = await resolveScopedSeniorTasks(inputTasks, scopeOrQuery, meta.key);
  const { overview, doersByCancelled, assignorsByCancelled, monthsByCancelled, workTypesByCancelled, cancelledTasks } = analytics;

  const wb = new ExcelJS.Workbook();
  const today = new Date().toISOString().slice(0, 10);

  appendStyledSheet(
    wb,
    "Cancellation Summary",
    [
      { Metric: "Dataset", Value: `${meta.label} (${meta.pluralLabel} Data)` },
      { Metric: "Report Scope", Value: scopeLabel },
      { Metric: "Total Tasks Evaluated", Value: overview.totalTasks },
      { Metric: "Total Cancelled Tasks", Value: overview.cancelledCount },
      { Metric: "Overall Cancellation Rate (%)", Value: `${overview.cancelRate}%` },
      { Metric: `Most Cancelled ${meta.doerLabel}`, Value: overview.topCancelledDoer ? `${overview.topCancelledDoer.name} (${overview.topCancelledDoer.cancelled} tasks / ${overview.topCancelledDoer.cancelRate}%)` : "-" },
      { Metric: "Top Cancelling Assignor", Value: overview.topCancelledAssignor ? `${overview.topCancelledAssignor.name} (${overview.topCancelledAssignor.cancelled} tasks / ${overview.topCancelledAssignor.cancelRate}%)` : "-" },
      { Metric: "Peak Cancellation Month", Value: overview.peakCancelledMonth ? `${overview.peakCancelledMonth.monthLabel} (${overview.peakCancelledMonth.cancelled} tasks)` : "-" },
    ],
    [32, 46],
    "991B1B",
    "BE123C",
    sheetSub
  );

  appendStyledSheet(
    wb,
    `Top Cancelled ${meta.pluralLabel}`,
    doersByCancelled.map((d, idx) => ({
      Rank: idx + 1,
      [`${meta.doerLabel} Name`]: d.name,
      "Cancelled Tasks": d.cancelled,
      "Total Assigned": d.total,
      "Cancellation Rate %": `${d.cancelRate}%`,
      "Completed Tasks": d.done,
      "Sample Cancel Remarks": d.remarks.map((r) => `${r.id}: ${r.remark}`).join(" | "),
    })),
    [8, 28, 16, 16, 20, 16, 60],
    "991B1B",
    "BE123C",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Top Cancelling Assignors",
    assignorsByCancelled.map((a, idx) => ({
      Rank: idx + 1,
      "Assignor Name": a.name,
      "Cancelled Tasks": a.cancelled,
      "Total Assigned": a.total,
      "Cancellation Rate %": `${a.cancelRate}%`,
      "Completed Tasks": a.done,
    })),
    [8, 28, 16, 16, 20, 16],
    "991B1B",
    "BE123C",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Month-Wise Cancellations",
    monthsByCancelled.map((m, idx) => ({
      Rank: idx + 1,
      Month: m.monthLabel,
      "Cancelled Count": m.cancelled,
      "Total Tasks": m.total,
      "Cancel Rate %": `${m.cancelRate}%`,
      [`Top Cancelled ${meta.shortLabel}`]: m.topCancelDoer,
      "Top Cancelling Assignor": m.topCancelAssignor,
    })),
    [8, 16, 16, 14, 16, 32, 32],
    "991B1B",
    "BE123C",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Cancelled by Work Type",
    workTypesByCancelled.map((w, idx) => ({
      Rank: idx + 1,
      "Type Of Work": w.name,
      "Cancelled Count": w.cancelled,
      "Total Tasks": w.total,
      "Cancel Rate %": `${w.cancelRate}%`,
    })),
    [8, 30, 16, 14, 16],
    "991B1B",
    "BE123C",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Cancelled Tasks Register",
    cancelledTasks.map((t) => buildTaskRowForExport(t, false)),
    [14, 14, 12, 24, 24, 20, 22, 28, 45, 14, 14, 12, 18, 10, 34],
    "991B1B",
    "BE123C",
    sheetSub
  );

  const suffix = isSpecificScope ? `_${fileSlug}` : "";
  return saveWorkbookFile(wb, `${meta.filePrefix}_Cancellation_Report${suffix}_${today}.xlsx`);
}

export async function exportSeniorTaskOverdueExcel(inputTasks = null, scopeOrQuery = "ALL", tier = "senior") {
  const meta = getDelegationMeta(tier);
  const sheetSub = `${meta.label} Overdue Analytics`;
  const { analytics, scopeLabel, fileSlug, isSpecificScope } = await resolveScopedSeniorTasks(inputTasks, scopeOrQuery, meta.key);
  const { overview, monthly, doers, assignors, workTypes, overdueTasks, dueWithin7DaysTasks } = analytics;

  const todayIst = toIstDateKey(new Date().toISOString());
  const overdueDoers = [...doers].filter((d) => d.overdue > 0).sort((a, b) => b.overdue - a.overdue || b.open - a.open);
  const overdueAssignors = [...assignors].filter((a) => a.overdue > 0).sort((a, b) => b.overdue - a.overdue || b.open - a.open);
  const overdueWorkTypes = [...workTypes].filter((w) => w.overdue > 0).sort((a, b) => b.overdue - a.overdue);

  const wb = new ExcelJS.Workbook();
  const today = new Date().toISOString().slice(0, 10);

  appendStyledSheet(
    wb,
    "Overdue Summary",
    [
      { Metric: "Dataset", Value: `${meta.label} (${meta.pluralLabel} Data)` },
      { Metric: "Report Scope", Value: scopeLabel },
      { Metric: "Total Tasks Evaluated", Value: overview.totalTasks },
      { Metric: "Overdue Open Tasks (Past Target Date)", Value: overview.overdueCount },
      { Metric: "Due Within 7 Days", Value: overview.dueWithin7DaysCount },
      { Metric: "Total Open Pipeline (WIP/Pending/Blank)", Value: overview.openCount },
      { Metric: "WIP / Pending / Blank Split", Value: `WIP: ${overview.wipCount} | Pending: ${overview.pendingCount} | Blank: ${overview.blankCount}` },
      { Metric: `Top Overdue ${meta.doerLabel}`, Value: overdueDoers[0] ? `${overdueDoers[0].name} (${overdueDoers[0].overdue} overdue)` : "-" },
      { Metric: "Top Overdue Assignor", Value: overdueAssignors[0] ? `${overdueAssignors[0].name} (${overdueAssignors[0].overdue} overdue)` : "-" },
    ],
    [36, 48],
    "92400E",
    "B45309",
    sheetSub
  );

  appendStyledSheet(
    wb,
    `Overdue by ${meta.shortLabel}`,
    overdueDoers.map((d, idx) => ({
      Rank: idx + 1,
      [`${meta.doerLabel} Name`]: d.name,
      "Overdue Tasks": d.overdue,
      "Total Open": d.open,
      "WIP": d.wip,
      "Pending": d.pending,
      "Blank Status": d.blank,
      "Total Assigned": d.total,
      "Done %": `${d.doneRate}%`,
    })),
    [8, 28, 15, 13, 10, 10, 14, 15, 12],
    "92400E",
    "B45309",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Overdue by Assignor",
    overdueAssignors.map((a, idx) => ({
      Rank: idx + 1,
      "Assignor Name": a.name,
      "Overdue Tasks": a.overdue,
      "Total Open": a.open,
      "Total Assigned": a.total,
      "Done": a.done,
      "Cancelled": a.cancelled,
    })),
    [8, 28, 15, 13, 15, 12, 12],
    "92400E",
    "B45309",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Month-Wise Overdue",
    monthly
      .filter((m) => m.overdue > 0 || m.open > 0)
      .map((m) => ({
        Month: m.monthLabel,
        "Overdue Tasks": m.overdue,
        "Total Open": m.open,
        "WIP": m.wip,
        "Pending": m.pending,
        "Blank": m.blank,
        "Total Tasks": m.total,
      })),
    [14, 15, 13, 10, 10, 10, 13],
    "92400E",
    "B45309",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Overdue Work Types",
    overdueWorkTypes.map((w, idx) => ({
      Rank: idx + 1,
      "Type Of Work": w.name,
      "Overdue Tasks": w.overdue,
      "Open Tasks": w.open,
      "Total Tasks": w.total,
    })),
    [8, 30, 15, 13, 13],
    "92400E",
    "B45309",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Overdue Tasks Register",
    overdueTasks.map((t) => ({
      ...buildTaskRowForExport(t, true),
      "Days Past Target": getDaysBetweenKeys(t.targetDateKey, todayIst),
    })),
    [14, 14, 12, 24, 24, 20, 22, 28, 45, 14, 14, 14, 14, 12, 12, 18, 10, 32, 16],
    "92400E",
    "B45309",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Due Within 7 Days",
    dueWithin7DaysTasks.map((t) => buildTaskRowForExport(t, false)),
    [14, 14, 12, 24, 24, 20, 22, 28, 45, 14, 14, 12, 18, 10, 32],
    "92400E",
    "B45309",
    sheetSub
  );

  const suffix = isSpecificScope ? `_${fileSlug}` : "";
  return saveWorkbookFile(wb, `${meta.filePrefix}_Overdue_Report${suffix}_${today}.xlsx`);
}

export async function exportSeniorTaskDoneExcel(inputTasks = null, scopeOrQuery = "ALL", tier = "senior") {
  const meta = getDelegationMeta(tier);
  const sheetSub = `${meta.label} Completion Analytics`;
  const { scopeTasks, analytics, scopeLabel, fileSlug, isSpecificScope } = await resolveScopedSeniorTasks(inputTasks, scopeOrQuery, meta.key);
  const { overview, monthly, doers, assignors, workTypes } = analytics;

  const doneTasks = scopeTasks.filter((t) => t.isDone);
  const doneDoers = [...doers].filter((d) => d.done > 0).sort((a, b) => b.done - a.done || b.onTimeRate - a.onTimeRate);
  const doneAssignors = [...assignors].filter((a) => a.done > 0).sort((a, b) => b.done - a.done);
  const doneWorkTypes = [...workTypes].filter((w) => w.done > 0).sort((a, b) => b.done - a.done);

  const wb = new ExcelJS.Workbook();
  const today = new Date().toISOString().slice(0, 10);

  appendStyledSheet(
    wb,
    "Done Tasks Summary",
    [
      { Metric: "Dataset", Value: `${meta.label} (${meta.pluralLabel} Data)` },
      { Metric: "Report Scope", Value: scopeLabel },
      { Metric: "Total Tasks Evaluated", Value: overview.totalTasks },
      { Metric: "Total Completed (Done) Tasks", Value: overview.doneCount },
      { Metric: "Completion Rate (%)", Value: `${overview.completionRate}%` },
      { Metric: "Completed On Time (<= Target)", Value: overview.doneOnTimeCount },
      { Metric: "Completed After Target Date", Value: overview.doneLateCount },
      { Metric: "On-Time Completion Rate (%)", Value: `${overview.onTimeRate}%` },
      { Metric: `Top Completing ${meta.doerLabel}`, Value: doneDoers[0] ? `${doneDoers[0].name} (${doneDoers[0].done} done / ${doneDoers[0].onTimeRate}% on time)` : "-" },
    ],
    [34, 48],
    "047857",
    "059669",
    sheetSub
  );

  appendStyledSheet(
    wb,
    `${meta.shortLabel} Completion & OnTime`,
    buildRankedPersonSheetRows(doneDoers, `${meta.doerLabel} Name`, {
      metricField: "done",
      metricHeader: "Done Tasks",
      rateField: "doneRate",
      rateHeader: "Completion %",
    }),
    [8, 28, 14, 15, 14, 10, 12, 10, 10, 12],
    "047857",
    "059669",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Assignor Completion",
    buildRankedPersonSheetRows(doneAssignors, "Assignor Name", {
      metricField: "done",
      metricHeader: "Done Tasks",
      rateField: "doneRate",
      rateHeader: "Completion %",
    }),
    [8, 28, 14, 15, 14, 10, 12, 10, 10, 12],
    "047857",
    "059669",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Month-Wise Done Report",
    monthly.map((m) => ({
      Month: m.monthLabel,
      "Done Tasks": m.done,
      "Total Tasks": m.total,
      "Completion %": `${m.doneRate}%`,
      "Done On Time": m.doneOnTime,
      "Done Late": m.doneLate,
      "On-Time %": `${m.onTimeRate}%`,
      "Revisions": m.revisions,
    })),
    [14, 13, 13, 14, 14, 12, 12, 12],
    "047857",
    "059669",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Done by Work Type",
    doneWorkTypes.map((w, idx) => ({
      Rank: idx + 1,
      "Type Of Work": w.name,
      "Done Tasks": w.done,
      "Total Tasks": w.total,
      "Completion %": `${w.doneRate}%`,
      "On-Time %": `${w.onTimeRate}%`,
    })),
    [8, 30, 13, 13, 14, 12],
    "047857",
    "059669",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Completed Tasks Register",
    doneTasks.map((t) => ({
      ...buildTaskRowForExport(t, true),
      Timeliness: t.completedOnTime ? "On Time" : t.completedLate ? "Delayed" : "No Date Comparison",
    })),
    [14, 14, 12, 24, 24, 20, 22, 28, 45, 14, 14, 14, 14, 12, 12, 18, 10, 32, 18],
    "047857",
    "059669",
    sheetSub
  );

  const suffix = isSpecificScope ? `_${fileSlug}` : "";
  return saveWorkbookFile(wb, `${meta.filePrefix}_Done_Report${suffix}_${today}.xlsx`);
}

export async function exportSeniorTaskMonthlyExcel(inputTasks = null, scopeOrQuery = "ALL", tier = "senior") {
  const meta = getDelegationMeta(tier);
  const sheetSub = `${meta.label} Monthly Analytics`;
  const { scopeTasks, analytics, scopeLabel, fileSlug, isSpecificScope } = await resolveScopedSeniorTasks(inputTasks, scopeOrQuery, meta.key);
  const { overview, monthly, doers, assignors, cancelledTasks, overdueTasks, workTypes } = analytics;

  const wb = new ExcelJS.Workbook();
  const today = new Date().toISOString().slice(0, 10);

  const monthDoerMap = {};
  scopeTasks.forEach((t) => {
    const key = `${t.monthKey}__${t.doer}`;
    if (!monthDoerMap[key]) {
      monthDoerMap[key] = {
        monthKey: t.monthKey,
        monthLabel: t.monthLabel,
        doer: t.doer,
        total: 0,
        done: 0,
        cancelled: 0,
        open: 0,
        overdue: 0,
        revisions: 0,
      };
    }
    const r = monthDoerMap[key];
    r.total += 1;
    if (t.isDone) r.done += 1;
    else if (t.isCancelled) r.cancelled += 1;
    else r.open += 1;
    if (t.isOverdue) r.overdue += 1;
    r.revisions += t.totalRevisions;
  });

  const monthDoerRows = Object.values(monthDoerMap)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey) || b.total - a.total)
    .map((r) => ({
      Month: r.monthLabel,
      [`${meta.doerLabel} Name`]: r.doer,
      Total: r.total,
      Done: r.done,
      "Done %": r.total ? `${((r.done / r.total) * 100).toFixed(1)}%` : "0%",
      Cancelled: r.cancelled,
      "Cancel %": r.total ? `${((r.cancelled / r.total) * 100).toFixed(1)}%` : "0%",
      Open: r.open,
      Overdue: r.overdue,
      Revisions: r.revisions,
    }));

  appendStyledSheet(
    wb,
    "Monthly Summary",
    [
      { Metric: "Dataset", Value: `${meta.label} (${meta.pluralLabel} Data)` },
      { Metric: "Report Scope", Value: scopeLabel },
      { Metric: "Months Covered", Value: `${overview.monthCount} (${overview.dateRange})` },
      { Metric: `Total ${meta.shortLabel} Tasks`, Value: overview.totalTasks },
      { Metric: "Completed (Done)", Value: `${overview.doneCount} (${overview.completionRate}%)` },
      { Metric: "Cancelled Tasks", Value: `${overview.cancelledCount} (${overview.cancelRate}%)` },
      { Metric: "Open Tasks", Value: `${overview.openCount} (Overdue: ${overview.overdueCount})` },
      { Metric: "On-Time Completion %", Value: `${overview.onTimeRate}%` },
      { Metric: "Total Revisions", Value: overview.totalRevisions },
      { Metric: "Peak Cancellation Month", Value: overview.peakCancelledMonth ? `${overview.peakCancelledMonth.monthLabel} (${overview.peakCancelledMonth.cancelled})` : "-" },
    ],
    [32, 46],
    "4338CA",
    "1E3A8A",
    sheetSub
  );

  appendStyledSheet(
    wb,
    "Month-Wise Comparison",
    monthly.map((m) => ({
      Month: m.monthLabel,
      "Month Key": m.monthKey,
      "Total Tasks": m.total,
      Done: m.done,
      "Completion %": `${m.doneRate}%`,
      Cancelled: m.cancelled,
      "Cancel %": `${m.cancelRate}%`,
      WIP: m.wip,
      Pending: m.pending,
      "Blank Status": m.blank,
      "Total Open": m.open,
      Overdue: m.overdue,
      "Done On Time": m.doneOnTime,
      "Done Late": m.doneLate,
      "On-Time %": `${m.onTimeRate}%`,
      Revisions: m.revisions,
      [`Top Cancelled ${meta.shortLabel}`]: m.topCancelDoer,
      "Top Cancelled Assignor": m.topCancelAssignor,
    })),
    [14, 12, 12, 10, 13, 12, 12, 8, 10, 13, 12, 10, 13, 11, 12, 12, 30, 30],
    "4338CA",
    "1E3A8A",
    sheetSub
  );

  appendStyledSheet(wb, `Month x ${meta.shortLabel} Breakdown`, monthDoerRows, [14, 28, 10, 10, 12, 12, 12, 10, 10, 12], "4338CA", "1E3A8A", sheetSub);

  if (isSpecificScope) {
    appendStyledSheet(
      wb,
      `${meta.shortLabel} Scorecard`,
      buildRankedPersonSheetRows(doers, `${meta.doerLabel} Name`, {
        metricField: "total",
        metricHeader: "Total Tasks",
        rateField: "doneRate",
        rateHeader: "Done %",
      }),
      [8, 28, 14, 15, 12, 10, 12, 10, 10, 12],
      "4338CA",
      "1E3A8A",
      sheetSub
    );
    appendStyledSheet(
      wb,
      "Assignor Scorecard",
      buildRankedPersonSheetRows(assignors, "Assignor Name", {
        metricField: "total",
        metricHeader: "Total Tasks",
        rateField: "doneRate",
        rateHeader: "Done %",
      }),
      [8, 28, 14, 15, 12, 10, 12, 10, 10, 12],
      "4338CA",
      "1E3A8A",
      sheetSub
    );
    appendStyledSheet(
      wb,
      "Cancelled in Month",
      cancelledTasks.map((t) => buildTaskRowForExport(t, false)),
      [14, 14, 12, 24, 24, 20, 22, 28, 45, 14, 14, 12, 18, 10, 34],
      "991B1B",
      "BE123C",
      sheetSub
    );
    appendStyledSheet(
      wb,
      "Overdue in Month",
      overdueTasks.map((t) => buildTaskRowForExport(t, false)),
      [14, 14, 12, 24, 24, 20, 22, 28, 45, 14, 14, 12, 18, 10, 34],
      "92400E",
      "B45309",
      sheetSub
    );
    appendStyledSheet(
      wb,
      "All Tasks in Month",
      scopeTasks.map((t) => buildTaskRowForExport(t, true)),
      [14, 14, 12, 24, 24, 20, 22, 28, 45, 14, 14, 14, 14, 12, 12, 18, 10, 32],
      "4338CA",
      "1E3A8A",
      sheetSub
    );
  } else {
    appendStyledSheet(
      wb,
      "Work Type Summary",
      workTypes.map((w, idx) => ({
        Rank: idx + 1,
        "Work Type": w.name,
        Total: w.total,
        Done: w.done,
        "Done %": `${w.doneRate}%`,
        Cancelled: w.cancelled,
        "Cancel %": `${w.cancelRate}%`,
        Open: w.open,
        Overdue: w.overdue,
      })),
      [8, 30, 12, 10, 12, 12, 12, 10, 10],
      "4338CA",
      "1E3A8A",
      sheetSub
    );
  }

  const suffix = isSpecificScope ? `_${fileSlug}` : "_All_Months";
  return saveWorkbookFile(wb, `${meta.filePrefix}_Monthly_Report${suffix}_${today}.xlsx`);
}

export const exportJuniorTaskMasterExcel = (inputTasks = null) => exportSeniorTaskMasterExcel(inputTasks, "junior");
export const exportJuniorTaskCancelledExcel = (inputTasks = null, scopeOrQuery = "ALL") =>
  exportSeniorTaskCancelledExcel(inputTasks, scopeOrQuery, "junior");
export const exportJuniorTaskOverdueExcel = (inputTasks = null, scopeOrQuery = "ALL") =>
  exportSeniorTaskOverdueExcel(inputTasks, scopeOrQuery, "junior");
export const exportJuniorTaskDoneExcel = (inputTasks = null, scopeOrQuery = "ALL") =>
  exportSeniorTaskDoneExcel(inputTasks, scopeOrQuery, "junior");
export const exportJuniorTaskMonthlyExcel = (inputTasks = null, scopeOrQuery = "ALL") =>
  exportSeniorTaskMonthlyExcel(inputTasks, scopeOrQuery, "junior");
