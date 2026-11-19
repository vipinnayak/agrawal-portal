// src/utils/companyAuditService.js
/**
 * Agrawal Jain & Co. — Company / Group Audit Multi-Endpoint Service
 * Integrates 16 group/company Google Apps Script endpoints and provides
 * specialized work completion analysis:
 *  1. Work Completion ON Target Date (0 days delay)
 *  2. Work Completion BEFORE Target Date (Ahead of schedule)
 *  3. Work Completion AFTER Target Date (Delayed completion)
 *  4. Work In-Progress / Overdue / Blank Target Date analysis
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- THE 16 COMPANY AUDIT ENDPOINTS ---
export const COMPANY_AUDIT_ENDPOINTS = [
  {
    id: 1,
    name: "Sunil Ispat Pvt Ltd",
    shortName: "Sunil Ispat",
    url: "https://script.google.com/macros/s/AKfycbzonmaBKPH8Hk23lbx3vp03JSnhfJ4kthocU1PI16KcNpWtw8rM8L7YSxhXoJPl1VCc/exec",
    group: "Sunil Ispat",
    period: "FY26-27",
    category: "City PMS Q2",
  },
  {
    id: 2,
    name: "Sambhv Steel Tubes Pvt Ltd",
    shortName: "Sambhv Steel",
    url: "https://script.google.com/macros/s/AKfycbyH6ZmDQwi3xfwC4fIa4g-SRCJSNYDte2jMsDi7OYN2i8FOdIULiZ4d1w9JKU5yGAAP2w/exec",
    group: "Sambhv Steel",
    period: "FY26-27",
    category: "Plant PMS July-Nov",
  },
  {
    id: 3,
    name: "VISHV GURU ISPAT PRIVATE LIMITED",
    shortName: "Vishv Guru",
    url: "https://script.google.com/macros/s/AKfycbzDgkusbZ_ZxKS_3nv6i8DZsrKn3cfQFeUnmssSyViDRtPx3gCGSwjc0_1ju7JwQ6pjIg/exec",
    group: "Vishv Guru",
    period: "FY26-27",
    category: "PMS Q2",
  },
  {
    id: 4,
    name: "UNITED LOGISTICS-FY 2025-26",
    shortName: "United Logistics",
    url: "https://script.google.com/macros/s/AKfycbz9QZ9NJlu-ekrfWMOhhbjKqL4Nub9Ulc2Bmjtj8MG93PD0irM-7V7Npb7c-9H2qcI0mw/exec",
    group: "United Logistics",
    period: "FY25-26",
    category: "Logistics Audit",
  },
  {
    id: 5,
    name: "Real Grp_Real Space & Ajay Steels FY 26-27",
    shortName: "Real Space & Ajay Steels",
    url: "https://script.google.com/macros/s/AKfycbzzyXUVtyBDgxqp4i_uwB94V1ZSNF6j97chXc1_OHutkSaM8_hPcIzUtxffSsFSnLHRLg/exec",
    group: "Real Group",
    period: "FY26-27",
    category: "Real Space & Ajay Steels",
  },
  {
    id: 6,
    name: "Maruti Ferrans",
    shortName: "Maruti Ferrans",
    url: "https://script.google.com/macros/s/AKfycbxjpFX42Q9KwhrcCKB5gFYg90Of1aU8uhJf1FG4fXytymcJ61Z5x6YKrEIxlf2RTq2fQQ/exec",
    group: "Maruti Group",
    period: "FY26-27",
    category: "PMS Plant Q2",
  },
  {
    id: 7,
    name: "Viraj Steel and Power Private Limited",
    shortName: "Viraj Steel",
    url: "https://script.google.com/macros/s/AKfycbzzehXA82zWWLP8C3q0X3w5_W9HfdzKOhJSh3EX4sDafOhIz8xiChtEZDVQQ8hHSDfmWQ/exec",
    group: "Viraj Steel",
    period: "FY26-27",
    category: "PMS Q2",
  },
  {
    id: 8,
    name: "Ambika Iron & Minerals IA FY 26-27",
    shortName: "Ambika Iron",
    url: "https://script.google.com/macros/s/AKfycbxfia0Ms-lUhXaF2E459S0yRGkth4lYYmeby1FbwHaXoP0fMZVo0cQ8zg0OWdEX9Aq4/exec",
    group: "Ambika Group",
    period: "FY26-27",
    category: "PMS Q2",
  },
  {
    id: 9,
    name: "Real Ispat & Power Limited City / API Ispat & Power Tech Pvt Ltd",
    shortName: "Real Ispat & Power City",
    url: "https://script.google.com/macros/s/AKfycbwv3sj1l6iyPlWedxyvnHTBt0vRkOgM_y1ypnWs6Mln9xA7DBLSrL-LDYj7kRzLJ2Z6/exec",
    group: "Real Group",
    period: "FY26-27",
    category: "City IAR H-1",
  },
  {
    id: 10,
    name: "NUTAN ISPAT IA FY 26-27",
    shortName: "Nutan Ispat",
    url: "https://script.google.com/macros/s/AKfycbzdQxo-Umpul1YQCgff8n8W4qgvVJ90v95niySB2HsUx4jN2zJTUkAm_sUNIb6NpbtF/exec",
    group: "Nutan Group",
    period: "FY26-27",
    category: "City PMS Q2",
  },
  {
    id: 11,
    name: "KARNIKRIPA IA FY26-27",
    shortName: "Karnikripa",
    url: "https://script.google.com/macros/s/AKfycbxz_GVnySx17cq0BBlsCNyjoAMywlgm4a8MugVwRKsGkEH92v1J1f5TGxwbtHSeoZhdYg/exec",
    group: "Karnikripa",
    period: "FY26-27",
    category: "City PMS Q2",
  },
  {
    id: 12,
    name: "IAR - Sai baba hospital Apr - June'2026",
    shortName: "Sai Baba Hospital",
    url: "https://script.google.com/macros/s/AKfycbzwBSPS9eC5HszwP7shiEWZdHx7JJHPzxjAil0wlRFoux5kdQQF_UixpbOKTUQ8t1aNZw/exec",
    group: "Sai Baba Hospital",
    period: "Apr-June 2026",
    category: "Hospital Audit",
  },
  {
    id: 13,
    name: "NRVS & N R Ispat",
    shortName: "NRVS & NR Ispat",
    url: "https://script.google.com/macros/s/AKfycbxTQmHCrMV2P1uDz4CNvdjahHTd5NiAs5X0ntsfz5CI4n_GVgs_XFAovJgrlFwXiZgx/exec",
    group: "NR Group",
    period: "FY26-27",
    category: "NRVS Q2",
  },
  {
    id: 14,
    name: "SKS IA FY 2026-27",
    shortName: "SKS Ispat",
    url: "https://script.google.com/macros/s/AKfycbze6_gcKJVoq9sn84XpgFNguxMjmViiCNFUkliIIqTrNQl0n7zROSoyfm9_G22u1mHU/exec",
    group: "SKS Group",
    period: "FY26-27",
    category: "PMS Q2",
  },
  {
    id: 15,
    name: "SKY Alloy IA FY 2025-26_PMS",
    shortName: "SKY Alloy",
    url: "https://script.google.com/macros/s/AKfycbz4LN3xdHQU-thKzGD2Y7ZLO2U7fH3Pf12_eNgytRVB1KQ3fUk_QZOAfYRbABCSwkl5RA/exec",
    group: "SKY Alloy Group",
    period: "FY25-26",
    category: "PMS Audit",
  },
  {
    id: 16,
    name: "Real Ispat and Power Limited",
    shortName: "Real Ispat and Power Limited",
    url: "https://script.google.com/macros/s/AKfycbxfoOPx9NYAs7ckB3ukud-Hbt88kMzVm0R2HbOauEaVVEwcJxMoju_iw3C7bAoBg_fiKA/exec",
    group: "Real Group",
    period: "FY25-26",
    category: "PMS Audit",
  },
];

// In-memory cache for multi-endpoint responses
let cachedCompanyAuditData = null;
let lastCompanyFetchTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export function invalidateCompanyAuditCache() {
  cachedCompanyAuditData = null;
  lastCompanyFetchTimestamp = 0;
}

/**
 * Flexible Date Parser: handles DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, MM/DD/YYYY, DD-MM-YY, ISO dates.
 */
export function parseFlexibleDate(str) {
  if (!str || typeof str !== "string") return null;
  const s = str.trim();
  if (!s || s === "-" || s === "N/A" || s === "NA" || /^(null|undefined)$/i.test(s)) return null;

  const parts = s.split(/[-/.]/);
  if (parts.length === 3) {
    let p1 = parseInt(parts[0], 10);
    let p2 = parseInt(parts[1], 10);
    let p3 = parseInt(parts[2], 10);
    if (isNaN(p1) || isNaN(p2) || isNaN(p3)) return null;
    if (p3 < 100) p3 += 2000;
    // Disambiguate day vs month
    if (p1 > 12) return new Date(p3, p2 - 1, p1);
    if (p2 > 12) return new Date(p3, p1 - 1, p2);
    // Default to Indian DD/MM/YYYY
    return new Date(p3, p2 - 1, p1);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a Date object into standard DD-MM-YYYY format
 */
export function formatDisplayDate(dateObj) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) return "-";
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const yyyy = dateObj.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Normalize an individual task row from a company's sheet
 */
function normalizeCompanyTaskRecord(r, company, idx) {
  const pick = (...keys) => {
    for (const k of keys) {
      if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "") {
        return String(r[k]).trim();
      }
    }
    return "";
  };

  const sNo = pick("S.NO", "Sl. No.", "Sno", "Store Department", "Section Code", "id", "Sr.", "S. No.") || String(idx + 1);
  const particulars = pick("PARTICULARS", "Particulars", "Accounts Departments and Books of Accounts", "task", "description");
  const department = pick("DEPARTMENT", "Department", "dept");
  const category = pick("CATEGORY", "Category");
  const division = pick("DIVISION", "Division");
  const toBeDoneBy = pick("TO BE DONE BY", "To be Done By", "To be done by", "Audit/Staff Article");
  const personIncharge = pick("PERSON INCHARGE", "Person Incharge", "Audit/Staff Article");

  const targetRaw = pick("TARGET DATE", "Target Date", "TARGET DATE_2", "PERSON INCHARGE_2", "Target date");
  const actualRaw = pick("ACTUAL DATE", "Actual Date", "Actual Date of Completion", "Column_10", "Completion Date");
  const statusRaw = pick("Status", "STATUS", "status");

  const targetDate = parseFlexibleDate(targetRaw);
  const actualDate = parseFlexibleDate(actualRaw);

  let completionType = "BLANK_TARGET";
  let diffDays = null;

  if (targetDate && actualDate) {
    diffDays = Math.round((actualDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      completionType = "ON_DATE";
    } else if (diffDays < 0) {
      completionType = "BEFORE_TARGET";
    } else {
      completionType = "AFTER_TARGET";
    }
  } else if (targetDate && !actualDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (targetDate < today) {
      completionType = "PENDING_OVERDUE";
    } else {
      completionType = "PENDING_UPCOMING";
    }
  } else if (!targetDate && actualDate) {
    completionType = "DONE_NO_TARGET";
  } else {
    completionType = "BLANK_TARGET";
  }

  return {
    taskId: `${company.shortName.replace(/\s+/g, "")}_${sNo}_${idx}`,
    companyId: company.id,
    companyName: company.name,
    shortName: company.shortName,
    group: company.group,
    period: company.period,
    sNo,
    particulars: particulars || "Audit procedure task",
    department: department || "General",
    category: category || "-",
    division: division || "-",
    toBeDoneBy: toBeDoneBy || "-",
    personIncharge: personIncharge || "Unassigned",
    targetRaw,
    actualRaw,
    statusRaw: statusRaw || (actualDate ? "Completed" : "Pending"),
    targetDate,
    actualDate,
    diffDays,
    completionType,
  };
}

/**
 * Fetch and parse data from all 14 company endpoints in parallel
 */
export async function fetchAllCompanyAuditData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedCompanyAuditData && now - lastCompanyFetchTimestamp < CACHE_TTL_MS) {
    return cachedCompanyAuditData;
  }

  const results = await Promise.allSettled(
    COMPANY_AUDIT_ENDPOINTS.map(async (company) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(company.url, { signal: controller.signal });
        clearTimeout(timeout);

        const text = await res.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          return {
            company,
            status: "FORMAT_ERROR",
            error: `Non-JSON response (HTTP ${res.status})`,
            records: [],
          };
        }

        if (!json || json.success === false) {
          return {
            company,
            status: "ENDPOINT_ERROR",
            error: json?.message || "Endpoint error",
            records: [],
          };
        }

        const report = json.report || json;
        const recs = Array.isArray(report.records) ? report.records : Array.isArray(json.data) ? json.data : [];
        const parsed = recs.map((r, idx) => normalizeCompanyTaskRecord(r, company, idx));

        return {
          company,
          status: "LIVE",
          spreadsheetName: json.spreadsheetName || company.name,
          sheetName: report.sheetName || company.category,
          records: parsed,
        };
      } catch (err) {
        return {
          company,
          status: "FETCH_FAILED",
          error: err.name === "AbortError" ? "Timeout after 12s" : err.message,
          records: [],
        };
      }
    })
  );

  const companyMap = new Map();
  const allTasks = [];

  results.forEach((item, idx) => {
    const comp = COMPANY_AUDIT_ENDPOINTS[idx];
    if (item.status === "fulfilled") {
      const data = item.value;
      const recs = data.records || [];
      allTasks.push(...recs);

      const onDate = recs.filter((t) => t.completionType === "ON_DATE");
      const beforeTarget = recs.filter((t) => t.completionType === "BEFORE_TARGET");
      const afterTarget = recs.filter((t) => t.completionType === "AFTER_TARGET");
      const pendingOverdue = recs.filter((t) => t.completionType === "PENDING_OVERDUE");
      const pendingUpcoming = recs.filter((t) => t.completionType === "PENDING_UPCOMING");
      const blankTarget = recs.filter((t) => t.completionType === "BLANK_TARGET");

      companyMap.set(comp.id, {
        company: comp,
        status: data.status,
        error: data.error || null,
        spreadsheetName: data.spreadsheetName || comp.name,
        sheetName: data.sheetName || comp.category,
        total: recs.length,
        onDateCount: onDate.length,
        beforeTargetCount: beforeTarget.length,
        afterTargetCount: afterTarget.length,
        pendingOverdueCount: pendingOverdue.length,
        pendingUpcomingCount: pendingUpcoming.length,
        blankTargetCount: blankTarget.length,
        records: recs,
      });
    } else {
      companyMap.set(comp.id, {
        company: comp,
        status: "FAILED",
        error: item.reason?.message || "Unknown error",
        total: 0,
        onDateCount: 0,
        beforeTargetCount: 0,
        afterTargetCount: 0,
        pendingOverdueCount: 0,
        pendingUpcomingCount: 0,
        blankTargetCount: 0,
        records: [],
      });
    }
  });

  const payload = {
    allTasks,
    companySummaries: Array.from(companyMap.values()),
    timestamp: now,
  };

  cachedCompanyAuditData = payload;
  lastCompanyFetchTimestamp = now;
  return payload;
}

// --- INTELLIGENCE SUMMARY & REPORT BUILDERS ---

/**
 * 1. Work Completion ON Date Report
 */
export function getWorkCompletionOnDateReport(data, companyQuery = null) {
  const { allTasks = [], companySummaries = [] } = data || {};
  let tasks = allTasks.filter((t) => t.completionType === "ON_DATE");

  if (companyQuery) {
    const q = companyQuery.toLowerCase().trim();
    tasks = tasks.filter((t) => t.companyName.toLowerCase().includes(q) || t.shortName.toLowerCase().includes(q));
  }

  const totalCompleted = allTasks.filter((t) => ["ON_DATE", "BEFORE_TARGET", "AFTER_TARGET"].includes(t.completionType)).length;
  const onDatePct = totalCompleted > 0 ? ((tasks.length / totalCompleted) * 100).toFixed(1) : "0";

  let res = `🎯 **Work Completion ON Target Date Report**\n`;
  res += `• 📅 **Audit Standard**: Tasks completed **strictly on the deadline date** (0 days delay / exact on-time execution).\n`;
  res += `• 📊 **Total Completed On Target Date**: **${tasks.length} tasks** (${onDatePct}% of all completed audit work)\n`;
  res += `• 🏢 **Coverage**: Spans **${companySummaries.filter((s) => s.status === "LIVE").length} live corporate client sheets**\n\n`;

  // Company Tally
  const compTally = new Map();
  tasks.forEach((t) => {
    compTally.set(t.shortName, (compTally.get(t.shortName) || 0) + 1);
  });

  if (compTally.size > 0) {
    res += `━━━━━━━━━━━━━━━━━━━━\n`;
    res += `🏢 **1. Company Breakdown (On-Date Completions)**:\n`;
    Array.from(compTally.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([comp, count], i) => {
        res += `• **${comp}**: **${count} tasks** completed on target date\n`;
      });
    res += `\n`;
  }

  // Person incharge tally
  const personTally = new Map();
  tasks.forEach((t) => {
    const p = t.personIncharge || "Unassigned";
    if (p !== "Unassigned" && p !== "-") {
      personTally.set(p, (personTally.get(p) || 0) + 1);
    }
  });

  if (personTally.size > 0) {
    res += `👔 **2. Top On-Time Performers (In-Charge Staff)**:\n`;
    Array.from(personTally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([person, count], i) => {
        res += `• **${person}**: **${count} tasks** on-time\n`;
      });
    res += `\n`;
  }

  // Sample tasks
  res += `━━━━━━━━━━━━━━━━━━━━\n`;
  res += `📋 **3. Sample Completed On Date Tasks**:\n`;
  tasks.slice(0, 10).forEach((t, i) => {
    const dateStr = formatDisplayDate(t.targetDate);
    res += `  ${i + 1}. [${t.shortName}] **${t.particulars.slice(0, 80)}**\n`;
    res += `     • 👤 Incharge: **${t.personIncharge}** (${t.toBeDoneBy}) | 🏛️ Dept: **${t.department}**\n`;
    res += `     • 🎯 Target: **${dateStr}** | ✅ Actual: **${formatDisplayDate(t.actualDate)}** *(0 days delay)*\n`;
  });

  if (tasks.length > 10) {
    res += `\n*(+${tasks.length - 10} more tasks completed on date across live client groups)*\n`;
  }

  res += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  res += `[ACTION_CHIPS:Completed before target date report|⚡ Before Target Date;Completed after target date report|⚠️ After Target Date;Overall work completion analysis|📊 Full Overview;Download completion report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_COMPANY_AUDIT_EXCEL:ON_DATE]\n[DOWNLOAD_COMPANY_AUDIT_PDF:ON_DATE]`;

  return res;
}

/**
 * 2. Work Completion BEFORE Target Date Report
 */
export function getWorkCompletionBeforeTargetDateReport(data, companyQuery = null) {
  const { allTasks = [] } = data || {};
  let tasks = allTasks.filter((t) => t.completionType === "BEFORE_TARGET");

  if (companyQuery) {
    const q = companyQuery.toLowerCase().trim();
    tasks = tasks.filter((t) => t.companyName.toLowerCase().includes(q) || t.shortName.toLowerCase().includes(q));
  }

  // Sort by days ahead of schedule descending
  tasks.sort((a, b) => a.diffDays - b.diffDays);

  const totalCompleted = allTasks.filter((t) => ["ON_DATE", "BEFORE_TARGET", "AFTER_TARGET"].includes(t.completionType)).length;
  const beforePct = totalCompleted > 0 ? ((tasks.length / totalCompleted) * 100).toFixed(1) : "0";

  let res = `⚡ **Work Completion BEFORE Target Date Report**\n`;
  res += `• 🏆 **Performance Category**: Tasks finished **ahead of schedule** (Actual completion date earlier than target date).\n`;
  res += `• 📊 **Total Completed Before Target**: **${tasks.length} tasks** (${beforePct}% of completed audit work)\n\n`;

  // Company Tally
  const compTally = new Map();
  tasks.forEach((t) => {
    compTally.set(t.shortName, (compTally.get(t.shortName) || 0) + 1);
  });

  if (compTally.size > 0) {
    res += `━━━━━━━━━━━━━━━━━━━━\n`;
    res += `🏢 **1. Company Breakdown (Early Completions)**:\n`;
    Array.from(compTally.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([comp, count]) => {
        res += `• **${comp}**: **${count} tasks** finished ahead of schedule\n`;
      });
    res += `\n`;
  }

  // Staff tally
  const personTally = new Map();
  tasks.forEach((t) => {
    const p = t.personIncharge || "Unassigned";
    if (p !== "Unassigned" && p !== "-") {
      personTally.set(p, (personTally.get(p) || 0) + 1);
    }
  });

  if (personTally.size > 0) {
    res += `👔 **2. Early Achievers (Staff Delivering Ahead of Target)**:\n`;
    Array.from(personTally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([person, count]) => {
        res += `• **${person}**: **${count} tasks** delivered early\n`;
      });
    res += `\n`;
  }

  res += `━━━━━━━━━━━━━━━━━━━━\n`;
  res += `📋 **3. Detailed Early Completion List**:\n`;
  tasks.slice(0, 12).forEach((t, i) => {
    const daysSaved = Math.abs(t.diffDays);
    res += `  ${i + 1}. [${t.shortName}] **${t.particulars.slice(0, 85)}**\n`;
    res += `     • 👤 Incharge: **${t.personIncharge}** (${t.toBeDoneBy}) | 🏛️ Dept: **${t.department}**\n`;
    res += `     • 🎯 Target: ${formatDisplayDate(t.targetDate)} | ⚡ Completed: ${formatDisplayDate(t.actualDate)} | 🚀 **${daysSaved} day${daysSaved > 1 ? "s" : ""} ahead of schedule!**\n`;
  });

  if (tasks.length > 12) {
    res += `\n*(+${tasks.length - 12} more tasks completed ahead of target)*\n`;
  }

  res += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  res += `[ACTION_CHIPS:Completed on date report|🎯 Completed On Date;Completed after target date report|⚠️ After Target Date;Overall work completion analysis|📊 Full Overview;Download completion report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_COMPANY_AUDIT_EXCEL:BEFORE_TARGET]\n[DOWNLOAD_COMPANY_AUDIT_PDF:BEFORE_TARGET]`;

  return res;
}

/**
 * 3. Work Completion AFTER Target Date Report (Delayed / Overdue Completed)
 */
export function getWorkCompletionAfterTargetDateReport(data, companyQuery = null) {
  const { allTasks = [] } = data || {};
  let tasks = allTasks.filter((t) => t.completionType === "AFTER_TARGET");

  if (companyQuery) {
    const q = companyQuery.toLowerCase().trim();
    tasks = tasks.filter((t) => t.companyName.toLowerCase().includes(q) || t.shortName.toLowerCase().includes(q));
  }

  // Sort by delay days descending
  tasks.sort((a, b) => b.diffDays - a.diffDays);

  const totalCompleted = allTasks.filter((t) => ["ON_DATE", "BEFORE_TARGET", "AFTER_TARGET"].includes(t.completionType)).length;
  const afterPct = totalCompleted > 0 ? ((tasks.length / totalCompleted) * 100).toFixed(1) : "0";

  let res = `⚠️ **Work Completion AFTER Target Date Report**\n`;
  res += `• 🚨 **Audit Finding**: Tasks completed **after the committed target date** (Execution finished with delay).\n`;
  res += `• 📊 **Total Completed After Target**: **${tasks.length} tasks** (${afterPct}% of completed audit work)\n\n`;

  // Company Tally
  const compTally = new Map();
  tasks.forEach((t) => {
    compTally.set(t.shortName, (compTally.get(t.shortName) || 0) + 1);
  });

  if (compTally.size > 0) {
    res += `━━━━━━━━━━━━━━━━━━━━\n`;
    res += `🏢 **1. Company Breakdown (Delayed Completions)**:\n`;
    Array.from(compTally.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([comp, count]) => {
        res += `• **${comp}**: **${count} delayed tasks**\n`;
      });
    res += `\n`;
  }

  // Staff tally
  const personTally = new Map();
  tasks.forEach((t) => {
    const p = t.personIncharge || "Unassigned";
    if (p !== "Unassigned" && p !== "-") {
      personTally.set(p, (personTally.get(p) || 0) + 1);
    }
  });

  if (personTally.size > 0) {
    res += `👔 **2. In-Charge Staff with Delayed Submissions**:\n`;
    Array.from(personTally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([person, count]) => {
        res += `• **${person}**: **${count} tasks** completed past target date\n`;
      });
    res += `\n`;
  }

  res += `━━━━━━━━━━━━━━━━━━━━\n`;
  res += `📋 **3. Critical Delayed Tasks (Ranked by Delay)**:\n`;
  tasks.slice(0, 12).forEach((t, i) => {
    const delay = t.diffDays;
    res += `  ${i + 1}. [${t.shortName}] **${t.particulars.slice(0, 85)}**\n`;
    res += `     • 👤 Incharge: **${t.personIncharge}** (${t.toBeDoneBy}) | 🏛️ Dept: **${t.department}**\n`;
    res += `     • 🎯 Target: ${formatDisplayDate(t.targetDate)} | ⚠️ Completed: ${formatDisplayDate(t.actualDate)} | 🚨 **+${delay} day${delay > 1 ? "s" : ""} delay**\n`;
  });

  if (tasks.length > 12) {
    res += `\n*(+${tasks.length - 12} more tasks completed past target date)*\n`;
  }

  res += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  res += `[ACTION_CHIPS:Completed on date report|🎯 Completed On Date;Completed before target date report|⚡ Before Target Date;Overall work completion analysis|📊 Full Overview;Download completion report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_COMPANY_AUDIT_EXCEL:AFTER_TARGET]\n[DOWNLOAD_COMPANY_AUDIT_PDF:AFTER_TARGET]`;

  return res;
}

/**
 * 4. Overall Firm-Wide Work Completion Intelligence Overview
 */
export function getCompanyAuditOverviewReport(data) {
  const { allTasks = [], companySummaries = [] } = data || {};

  const totalTasks = allTasks.length;
  const onDate = allTasks.filter((t) => t.completionType === "ON_DATE").length;
  const beforeTarget = allTasks.filter((t) => t.completionType === "BEFORE_TARGET").length;
  const afterTarget = allTasks.filter((t) => t.completionType === "AFTER_TARGET").length;
  const totalCompleted = onDate + beforeTarget + afterTarget;

  const pendingOverdue = allTasks.filter((t) => t.completionType === "PENDING_OVERDUE").length;
  const pendingUpcoming = allTasks.filter((t) => t.completionType === "PENDING_UPCOMING").length;
  const blankTarget = allTasks.filter((t) => t.completionType === "BLANK_TARGET").length;

  const liveCompanies = companySummaries.filter((s) => s.status === "LIVE");
  const errorCompanies = companySummaries.filter((s) => s.status !== "LIVE");

  let res = `📊 **Agrawal Jain & Co. — Multi-Company Work Completion Intelligence**\n`;
  res += `• 🏢 **Total Companies Configured**: **${companySummaries.length || COMPANY_AUDIT_ENDPOINTS.length} Client Sheets** (${liveCompanies.length} Live, ${errorCompanies.length} Config/Auth Issue)\n`;
  res += `• 📋 **Total Monitored Tasks**: **${totalTasks} audit tasks** across corporate groups\n\n`;

  res += `━━━━━━━━━━━━━━━━━━━━\n`;
  res += `📈 **1. Executive Completion Scorecard**:\n`;
  res += `• 🎯 **Completed ON Date**: **${onDate} tasks** (${totalCompleted > 0 ? ((onDate / totalCompleted) * 100).toFixed(1) : 0}% of completed work — *100% on-time*)\n`;
  res += `• ⚡ **Completed BEFORE Target**: **${beforeTarget} tasks** (${totalCompleted > 0 ? ((beforeTarget / totalCompleted) * 100).toFixed(1) : 0}% — *ahead of schedule*)\n`;
  res += `• ⚠️ **Completed AFTER Target**: **${afterTarget} tasks** (${totalCompleted > 0 ? ((afterTarget / totalCompleted) * 100).toFixed(1) : 0}% — *delayed completion*)\n`;
  res += `• ⏳ **Pending In-Progress**: **${pendingOverdue + pendingUpcoming} tasks** (${pendingOverdue} past target date, ${pendingUpcoming} upcoming)\n`;
  res += `• 🚨 **Missing Target Date**: **${blankTarget} tasks** (Target date field left blank)\n\n`;

  res += `━━━━━━━━━━━━━━━━━━━━\n`;
  res += `🏢 **2. Company-Wise Performance Table**:\n`;
  liveCompanies.forEach((c) => {
    res += `• 🏢 **${c.shortName}** (*${c.total} tasks*):\n`;
    res += `  - 🎯 On Date: **${c.onDateCount}** | ⚡ Before: **${c.beforeTargetCount}** | ⚠️ After: **${c.afterTargetCount}** | ⏳ Overdue Pending: **${c.pendingOverdueCount}** | 📝 Blank: **${c.blankTargetCount}**\n`;
  });

  if (errorCompanies.length > 0) {
    res += `\n⚠️ **Endpoints Requiring Attention** (${errorCompanies.length}):\n`;
    errorCompanies.forEach((e) => {
      res += `• ❌ **${e.shortName}**: *${e.error || "Web app configuration error"}*\n`;
    });
  }

  res += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  res += `[ACTION_CHIPS:Completed on date report|🎯 Completed On Date (${onDate});Completed before target date report|⚡ Before Target Date (${beforeTarget});Completed after target date report|⚠️ After Target Date (${afterTarget});Download completion report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_COMPANY_AUDIT_EXCEL:ALL]\n[DOWNLOAD_COMPANY_AUDIT_PDF:ALL]`;

  return res;
}

/**
 * 5. Specific Company Detailed Completion Report
 */
export function getSingleCompanyCompletionReport(data, query) {
  const { allTasks = [], companySummaries = [] } = data || {};
  const cleanQ = query.toLowerCase().trim();

  const matchedSummaries = companySummaries.filter(
    (s) =>
      cleanQ.includes(s.shortName.toLowerCase()) ||
      cleanQ.includes(s.name.toLowerCase()) ||
      s.shortName.toLowerCase().includes(cleanQ) ||
      s.name.toLowerCase().includes(cleanQ)
  );

  const matchedSummary = matchedSummaries.sort((a, b) => b.shortName.length - a.shortName.length)[0];

  if (!matchedSummary) return null;

  if (matchedSummary.status !== "LIVE") {
    let res = `🏢 **PMS & Work Completion Report: ${matchedSummary.shortName}**\n`;
    res += `• 📂 **Unit / Sheet**: *${matchedSummary.spreadsheetName || matchedSummary.company?.name || matchedSummary.shortName}*\n`;
    res += `• ⚠️ **Endpoint Status**: *${matchedSummary.error || "Web app configuration error"}*\n\n`;
    res += `━━━━━━━━━━━━━━━━━━━━\n`;
    res += `ℹ️ **Google Apps Script Access Notice**:\n`;
    res += `The web script for **${matchedSummary.shortName}** returned *${matchedSummary.error || "403 Forbidden"}*.\n`;
    res += `To view live tasks and completion analytics for this company in the chatbot:\n`;
    res += `1. Open the Google Apps Script project for **${matchedSummary.shortName}**.\n`;
    res += `2. Click **Deploy > Manage Deployments**.\n`;
    res += `3. Click **Edit (pencil icon)**, and ensure **Who has access** is set to **"Anyone"**.\n`;
    res += `4. Click **Deploy**. The chatbot will then automatically sync live audit records!\n\n`;
    res += `[ACTION_CHIPS:Overall work completion analysis|📊 All Companies;Completed on date report|🎯 Completed On Date;Completed before target date report|⚡ Before Target Date;Completed after target date report|⚠️ After Target Date]`;
    return res;
  }

  const compTasks = allTasks.filter((t) => t.companyId === matchedSummary.company.id);

  const onDate = compTasks.filter((t) => t.completionType === "ON_DATE");
  const beforeTarget = compTasks.filter((t) => t.completionType === "BEFORE_TARGET");
  const afterTarget = compTasks.filter((t) => t.completionType === "AFTER_TARGET");
  const pendingOverdue = compTasks.filter((t) => t.completionType === "PENDING_OVERDUE");
  const pendingUpcoming = compTasks.filter((t) => t.completionType === "PENDING_UPCOMING");
  const blankTarget = compTasks.filter((t) => t.completionType === "BLANK_TARGET");

  let res = `🏢 **Work Completion Report: ${matchedSummary.shortName}**\n`;
  res += `• 📂 **Spreadsheet**: *${matchedSummary.spreadsheetName}* | 📑 Sheet: *${matchedSummary.sheetName}*\n`;
  res += `• 📊 **Total Audit Tasks**: **${compTasks.length} tasks**\n`;
  res += `• 🎯 **Completed On Target Date**: **${onDate.length} tasks**\n`;
  res += `• ⚡ **Completed Before Target**: **${beforeTarget.length} tasks** (Ahead of schedule)\n`;
  res += `• ⚠️ **Completed After Target**: **${afterTarget.length} tasks** (Delayed)\n`;
  res += `• ⏳ **In Progress / Overdue**: **${pendingOverdue.length} overdue**, **${pendingUpcoming.length} upcoming**\n`;
  res += `• 📝 **Target Date Blank**: **${blankTarget.length} tasks**\n\n`;

  if (afterTarget.length > 0) {
    res += `━━━━━━━━━━━━━━━━━━━━\n`;
    res += `⚠️ **Delayed Tasks Completed Past Deadline**:\n`;
    afterTarget.slice(0, 6).forEach((t, i) => {
      res += `  ${i + 1}. **${t.particulars.slice(0, 75)}**\n`;
      res += `     • Incharge: **${t.personIncharge}** | Target: ${formatDisplayDate(t.targetDate)} | Done: ${formatDisplayDate(t.actualDate)} (+${t.diffDays} days)\n`;
    });
  }

  if (beforeTarget.length > 0) {
    res += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    res += `⚡ **Early Tasks Completed Ahead of Deadline**:\n`;
    beforeTarget.slice(0, 6).forEach((t, i) => {
      res += `  ${i + 1}. **${t.particulars.slice(0, 75)}**\n`;
      res += `     • Incharge: **${t.personIncharge}** | Target: ${formatDisplayDate(t.targetDate)} | Done: ${formatDisplayDate(t.actualDate)} (${Math.abs(t.diffDays)} days ahead)\n`;
    });
  }

  res += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  res += `[ACTION_CHIPS:Completed on date report|🎯 Completed On Date;Completed before target date report|⚡ Before Target Date;Completed after target date report|⚠️ After Target Date;Download completion report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_COMPANY_AUDIT_EXCEL:${matchedSummary.company.id}]\n[DOWNLOAD_COMPANY_AUDIT_PDF:${matchedSummary.company.id}]`;

  return res;
}

// --- EXCEL & PDF EXPORTERS ---

/**
 * Multi-Tab Styled Excel Exporter
 */
export async function exportCompanyCompletionToExcel(filterType = "ALL", companyIdOrQuery = null) {
  const data = await fetchAllCompanyAuditData();
  const { allTasks = [], companySummaries = [] } = data;

  let tasksToExport = allTasks;
  if (companyIdOrQuery && companyIdOrQuery !== "ALL") {
    const num = Number(companyIdOrQuery);
    if (!isNaN(num) && num > 0) {
      tasksToExport = allTasks.filter((t) => t.companyId === num);
    } else {
      const q = String(companyIdOrQuery).toLowerCase();
      tasksToExport = allTasks.filter((t) => t.companyName.toLowerCase().includes(q) || t.shortName.toLowerCase().includes(q));
    }
  }

  if (filterType === "ON_DATE") {
    tasksToExport = tasksToExport.filter((t) => t.completionType === "ON_DATE");
  } else if (filterType === "BEFORE_TARGET") {
    tasksToExport = tasksToExport.filter((t) => t.completionType === "BEFORE_TARGET");
  } else if (filterType === "AFTER_TARGET") {
    tasksToExport = tasksToExport.filter((t) => t.completionType === "AFTER_TARGET");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. ERP";
  workbook.created = new Date();

  // Tab 1: Executive Summary & Company Tally
  const summarySheet = workbook.addWorksheet("Executive Summary", { views: [{ showGridLines: true }] });
  summarySheet.columns = [
    { header: "Sr.", key: "sr", width: 6 },
    { header: "Company Name", key: "name", width: 32 },
    { header: "Status", key: "status", width: 14 },
    { header: "Total Tasks", key: "total", width: 14 },
    { header: "On Date (Exact)", key: "onDate", width: 16 },
    { header: "Before Target (Early)", key: "beforeTarget", width: 20 },
    { header: "After Target (Delayed)", key: "afterTarget", width: 20 },
    { header: "Pending Overdue", key: "pendingOverdue", width: 18 },
    { header: "Pending Upcoming", key: "pendingUpcoming", width: 18 },
    { header: "Blank Target Date", key: "blankTarget", width: 18 },
  ];

  // Header Banner
  summarySheet.spliceRows(1, 0, [], []);
  summarySheet.mergeCells("A1:J1");
  const ban1 = summarySheet.getCell("A1");
  ban1.value = "AGRAWAL JAIN & CO. — MULTI-COMPANY WORK COMPLETION AUDIT";
  ban1.font = { bold: true, size: 14, color: { argb: "FFFFFF" }, name: "Segoe UI" };
  ban1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E3A8A" } };
  ban1.alignment = { vertical: "middle", horizontal: "center" };
  summarySheet.getRow(1).height = 30;

  summarySheet.mergeCells("A2:J2");
  const ban2 = summarySheet.getCell("A2");
  ban2.value = `Generated: ${new Date().toLocaleString("en-IN")} | Scope: ${filterType} | Total Tasks: ${tasksToExport.length}`;
  ban2.font = { size: 10, italic: true, color: { argb: "FFFFFF" }, name: "Segoe UI" };
  ban2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "3B82F6" } };
  ban2.alignment = { vertical: "middle", horizontal: "center" };
  summarySheet.getRow(2).height = 20;

  const headerRow = summarySheet.getRow(3);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1F2937" } };

  companySummaries.forEach((s, idx) => {
    const row = summarySheet.addRow({
      sr: idx + 1,
      name: s.shortName,
      status: s.status,
      total: s.total,
      onDate: s.onDateCount,
      beforeTarget: s.beforeTargetCount,
      afterTarget: s.afterTargetCount,
      pendingOverdue: s.pendingOverdueCount,
      pendingUpcoming: s.pendingUpcomingCount,
      blankTarget: s.blankTargetCount,
    });
    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F3F4F6" } };
    }
  });

  // Tab 2: Detailed Task List
  const detailSheet = workbook.addWorksheet(
    filterType === "ON_DATE"
      ? "Completed On Date"
      : filterType === "BEFORE_TARGET"
      ? "Completed Before Target"
      : filterType === "AFTER_TARGET"
      ? "Completed After Target"
      : "Audit Tasks Register",
    { views: [{ showGridLines: true }] }
  );

  detailSheet.columns = [
    { header: "Sr.", key: "sr", width: 6 },
    { header: "Company", key: "company", width: 22 },
    { header: "Task S.No", key: "sNo", width: 12 },
    { header: "Audit Particulars / Procedure", key: "particulars", width: 44 },
    { header: "Department", key: "department", width: 18 },
    { header: "Incharge Person", key: "personIncharge", width: 22 },
    { header: "Role", key: "toBeDoneBy", width: 16 },
    { header: "Target Date", key: "targetDate", width: 14 },
    { header: "Actual Date", key: "actualDate", width: 14 },
    { header: "Variance (Days)", key: "diffDays", width: 16 },
    { header: "Completion Status", key: "status", width: 20 },
  ];

  detailSheet.spliceRows(1, 0, [], []);
  detailSheet.mergeCells("A1:K1");
  const dBan1 = detailSheet.getCell("A1");
  dBan1.value = `AGRAWAL JAIN & CO. — WORK COMPLETION REGISTER (${filterType.replace(/_/g, " ")})`;
  dBan1.font = { bold: true, size: 14, color: { argb: "FFFFFF" }, name: "Segoe UI" };
  dBan1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F766E" } };
  dBan1.alignment = { vertical: "middle", horizontal: "center" };
  detailSheet.getRow(1).height = 30;

  detailSheet.mergeCells("A2:K2");
  const dBan2 = detailSheet.getCell("A2");
  dBan2.value = `Total Records Exported: ${tasksToExport.length} | Generated: ${new Date().toLocaleString("en-IN")}`;
  dBan2.font = { size: 10, italic: true, color: { argb: "FFFFFF" }, name: "Segoe UI" };
  dBan2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "14B8A6" } };
  dBan2.alignment = { vertical: "middle", horizontal: "center" };
  detailSheet.getRow(2).height = 20;

  const dHeaderRow = detailSheet.getRow(3);
  dHeaderRow.font = { bold: true, color: { argb: "FFFFFF" } };
  dHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1F2937" } };

  tasksToExport.forEach((t, idx) => {
    let varianceLabel = "-";
    if (t.diffDays !== null) {
      if (t.diffDays === 0) varianceLabel = "0 (Exact)";
      else if (t.diffDays < 0) varianceLabel = `${Math.abs(t.diffDays)} days early`;
      else varianceLabel = `+${t.diffDays} days delay`;
    }

    const row = detailSheet.addRow({
      sr: idx + 1,
      company: t.shortName,
      sNo: t.sNo,
      particulars: t.particulars,
      department: t.department,
      personIncharge: t.personIncharge,
      toBeDoneBy: t.toBeDoneBy,
      targetDate: formatDisplayDate(t.targetDate),
      actualDate: formatDisplayDate(t.actualDate),
      diffDays: varianceLabel,
      status: t.completionType.replace(/_/g, " "),
    });

    if (t.completionType === "ON_DATE") {
      row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D1FAE5" } };
    } else if (t.completionType === "BEFORE_TARGET") {
      row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E0E7FF" } };
    } else if (t.completionType === "AFTER_TARGET") {
      row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } };
    }

    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F9FAFB" } };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `AJC_Work_Completion_Report_${filterType}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), filename);
  return filename;
}

/**
 * Styled PDF Exporter
 */
export async function exportCompanyCompletionToPdf(filterType = "ALL", companyIdOrQuery = null) {
  const data = await fetchAllCompanyAuditData();
  const { allTasks = [] } = data;

  let tasksToExport = allTasks;
  if (companyIdOrQuery && companyIdOrQuery !== "ALL") {
    const num = Number(companyIdOrQuery);
    if (!isNaN(num) && num > 0) {
      tasksToExport = allTasks.filter((t) => t.companyId === num);
    } else {
      const q = String(companyIdOrQuery).toLowerCase();
      tasksToExport = allTasks.filter((t) => t.companyName.toLowerCase().includes(q) || t.shortName.toLowerCase().includes(q));
    }
  }

  if (filterType === "ON_DATE") {
    tasksToExport = tasksToExport.filter((t) => t.completionType === "ON_DATE");
  } else if (filterType === "BEFORE_TARGET") {
    tasksToExport = tasksToExport.filter((t) => t.completionType === "BEFORE_TARGET");
  } else if (filterType === "AFTER_TARGET") {
    tasksToExport = tasksToExport.filter((t) => t.completionType === "AFTER_TARGET");
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "A4" });

  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 50, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("AGRAWAL JAIN & CO. — WORK COMPLETION REPORT", 40, 30);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Category: ${filterType.replace(/_/g, " ")} | Total Records: ${tasksToExport.length} | Generated: ${new Date().toLocaleString("en-IN")}`, 40, 44);

  const tableHead = [["Sr.", "Company", "S.No", "Particulars", "Department", "Incharge", "Target", "Actual", "Variance", "Status"]];
  const tableData = tasksToExport.slice(0, 300).map((t, idx) => [
    idx + 1,
    t.shortName,
    t.sNo,
    t.particulars.length > 50 ? `${t.particulars.slice(0, 48)}...` : t.particulars,
    t.department,
    t.personIncharge,
    formatDisplayDate(t.targetDate),
    formatDisplayDate(t.actualDate),
    t.diffDays !== null ? (t.diffDays === 0 ? "On Date" : t.diffDays < 0 ? `${Math.abs(t.diffDays)}d Early` : `+${t.diffDays}d Late`) : "-",
    t.completionType.replace(/_/g, " "),
  ]);

  autoTable(doc, {
    startY: 60,
    head: tableHead,
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 7, textColor: 30 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 30, right: 30 },
  });

  const filename = `AJC_Work_Completion_Report_${filterType}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}

