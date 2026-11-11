// src/utils/dailyWorkingService.js
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  normalizeName,
  getEmployeeCategoryInfo,
  isPartner,
  isSenior,
  isArticle,
  isPlantStaff,
} from "./attendanceConfig";

export const DAILY_WORKING_GOOGLE_SHEET_ID =
  "1w23vFtte_BAus75NtgicyNnxV-dI2yxvrcFdkE6cIO4";

export const DAILY_WORKING_GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1w23vFtte_BAus75NtgicyNnxV-dI2yxvrcFdkE6cIO4/edit?gid=0#gid=0";

export const DAILY_WORKING_API =
  "https://script.google.com/macros/s/AKfycbyVRDZmhX_nApCD5RPIlNNcP5xKRGQuJDQof0x2QvCxtUNeozMggmXAw-aX7fH-gjq1kQ/exec";

export const DAILY_WORKING_SUBMIT_API = DAILY_WORKING_API;

/**
 * In-memory cache to prevent multiple simultaneous 34k-row fetches
 */
let cachedDailyWorkingLogs = null;
let inFlightDailyWorkingPromise = null;
let lastDailyWorkingCacheTime = 0;
const DAILY_WORKING_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

/**
 * Get current Daily Working Web App URL (supports custom deployed Apps Script)
 */
export function getDailyWorkingWebAppUrl() {
  if (typeof window !== "undefined" && window.localStorage) {
    const override = window.localStorage.getItem("daily_working_webapp_url");
    if (
      override &&
      override.trim() &&
      !override.includes("AKfycbxChm2tuSBdFiwLATUq4THD01CMfytH0S8KJuXGobPPkxEJCbeSs7y_tVCD9rMJ2cr2Rw")
    ) {
      return override.trim();
    }
  }
  return DAILY_WORKING_API;
}

/**
 * Configure new Daily Working Web App URL dynamically
 */
export function setDailyWorkingWebAppUrl(url = "") {
  if (typeof window !== "undefined" && window.localStorage) {
    const trimmed = (url || "").trim();
    if (trimmed) {
      window.localStorage.setItem("daily_working_webapp_url", trimmed);
    } else {
      window.localStorage.removeItem("daily_working_webapp_url");
    }
  }
}

/**
 * Test connectivity to Google Apps Script Web App
 */
export async function testDailyWorkingConnection(customUrl = null) {
  const targetUrl = customUrl ? customUrl.trim() : getDailyWorkingWebAppUrl();
  try {
    const sep = targetUrl.includes("?") ? "&" : "?";
    const res = await fetch(`${targetUrl}${sep}action=ping`);
    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    try {
      const res = await fetch(targetUrl);
      const data = await res.json();
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e.message || String(e) };
    }
  }
}

export const CARD_PUNCH_API =
  "https://script.google.com/macros/s/AKfycbxp_-pPEH7FwJJu0o9AQHtklmRDfAqJ0SR-gqtJ5LPVsTDovyDtNnIwl1_p57yRSFSPyw/exec";

export const EMPLOYEE_MASTER_API =
  "https://script.google.com/macros/s/AKfycbzp9jjuDv3H_T85SNi75ZJlLjKDlMB2NFlMaxZTVCG-C5VRDuM6OWd_KLwRatBWlmPzRA/exec";

export const DROPDOWN_API =
  "https://script.google.com/macros/s/AKfycbxwHdK3tBY71gamETPbtIhPcZXavQU4cpAVWoiBJCb-n8wBYFqLc4KpvSJfajoGbNVU/exec";

export const DEDICATED_PAGE_MAP = {
  "vipin nayak": "/daily-working-vipin",
  "vipin": "/daily-working-vipin",
  "naresh prajapati": "/daily-working-naresh",
  "naresh": "/daily-working-naresh",
  "pratibha agrawal": "/daily-working-pratibha",
  "cma pratibha agrawal": "/daily-working-pratibha",
  "harsh mittal": "/daily-working-harsh-mittal",
  "ca harsh mittal": "/daily-working-harsh-mittal",
  "ankit kumar garg": "/daily-working-ankit",
  "ca ankit kumar garg": "/daily-working-ankit",
  "rupesh vaid": "/daily-working-rupesh",
  "ca rupesh vaid": "/daily-working-rupesh",
  "mukul jain": "/daily-working-mukul",
  "ca mukul jain": "/daily-working-mukul",
  "vedant khandelwal": "/daily-working-vedant",
  "ca vedant khandelwal": "/daily-working-vedant",
  "priya dani": "/daily-working-priya",
  "cma priya dani": "/daily-working-priya",
  "vikas goyal": "/daily-working-Vikas",
  "ca vikas goyal": "/daily-working-Vikas",
  "harsh sharma": "/daily-working-harsh-sharma",
  "ca harsh sharma": "/daily-working-harsh-sharma",
  "kanha kedia": "/daily-working-Kanha",
  "ca kanha kedia": "/daily-working-Kanha",
  "chandan singh": "/daily-working-chandan",
  "ca chandan singh": "/daily-working-chandan",
  "drishti chandnani": "/daily-working-Drishti",
  "ca drishti chandnani": "/daily-working-Drishti",
  "pankaj agrawal": "/daily-working-pankaj",
  "ca pankaj agrawal": "/daily-working-pankaj",
};

/**
 * Get dedicated daily working route for an employee
 */
export function getDedicatedDailyWorkingRoute(name = "") {
  if (!name) return "";
  const clean = normalizeName(name);
  if (DEDICATED_PAGE_MAP[clean]) return DEDICATED_PAGE_MAP[clean];
  const lower = name.toLowerCase().trim();
  if (DEDICATED_PAGE_MAP[lower]) return DEDICATED_PAGE_MAP[lower];
  return `/employee-daily-working/${encodeURIComponent(name.trim())}`;
}

/**
 * Format Excel Serial Number or Date string into DD/MM/YYYY
 */
export const formatExcelOrStringDate = (val) => {
  if (!val) return "";
  const strVal = String(val).trim();
  if (!strVal) return "";

  // Check if it's an Excel serial number like "46326"
  if (!isNaN(strVal) && Number(strVal) > 20000 && Number(strVal) < 60000) {
    try {
      const jsDate = new Date((Number(strVal) - 25569) * 86400 * 1000);
      if (!isNaN(jsDate.getTime())) {
        return jsDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
    } catch {
      return strVal;
    }
  }

  // Check if it's already DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(strVal)) {
    return strVal;
  }

  // Check if it's an ISO or parseable date string
  const parsed = Date.parse(strVal);
  if (!isNaN(parsed)) {
    try {
      const d = new Date(parsed);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return strVal;
    }
  }

  return strVal;
};

/**
 * Parses comma separated missing dates string and returns array of formatted date strings
 */
export const parseMissingDates = (missingDateStr) => {
  if (!missingDateStr) return [];
  const parts = String(missingDateStr)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const dates = [];
  const seen = new Set();

  parts.forEach((part) => {
    const formatted = formatExcelOrStringDate(part);
    if (formatted && !seen.has(formatted)) {
      seen.add(formatted);
      dates.push(formatted);
    }
  });

  return dates;
};

/**
 * Helper to check if a date string matches today's date
 */
export const isDateToday = (dateStr) => {
  if (!dateStr) return false;
  const formatted = formatExcelOrStringDate(dateStr);
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return formatted === today;
};

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const MONTH_ALIAS_MAP = {
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

/**
 * Extract comprehensive Month & Year information from any date value
 */
export const getMonthYearInfo = (dateVal) => {
  if (!dateVal) return null;
  const formatted = formatExcelOrStringDate(dateVal);
  if (!formatted) return null;
  const parts = formatted.split("/");
  if (parts.length < 3) return null;
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(m) || isNaN(y) || m < 1 || m > 12 || y < 2000 || y > 2100) return null;
  const monthName = MONTH_NAMES[m - 1];
  return {
    month: m,
    year: y,
    key: `${y}-${String(m).padStart(2, "0")}`,
    label: `${monthName} ${y}`,
    monthName,
    shortMonth: monthName.slice(0, 3),
  };
};

/**
 * Check if a date belongs to a specified month & year
 */
export const isDateInMonth = (dateVal, targetMonth, targetYear) => {
  if (!dateVal) return false;
  const my = getMonthYearInfo(dateVal);
  if (!my) return false;
  return my.month === Number(targetMonth) && my.year === Number(targetYear);
};

/**
 * Check if a daily working log entry is in specified month & year
 */
export const isEntryInMonth = (entry, targetMonth, targetYear) => {
  if (!entry) return false;
  return isDateInMonth(entry.date || entry.timestamp, targetMonth, targetYear);
};

/**
 * Helper to check if a date string/serial number belongs to the current calendar month
 */
export const isDateInCurrentMonth = (dateVal) => {
  if (!dateVal) return false;
  const now = new Date();
  return isDateInMonth(dateVal, now.getMonth() + 1, now.getFullYear());
};

/**
 * Check if a daily working log entry is in the current month
 */
export const isEntryInCurrentMonth = (entry) => {
  if (!entry) return false;
  return isDateInCurrentMonth(entry.date || entry.timestamp);
};

/**
 * Get current month formatted label (e.g. "November 2026")
 */
export const getCurrentMonthLabel = () => {
  return new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

/**
 * Parse target month specification from user query
 */
export const parseTargetMonthFromQuery = (queryText = "", defaultYear = 2026) => {
  const q = (queryText || "").toLowerCase().trim();
  if (!q) return null;

  if (
    q.includes("all month") ||
    q.includes("all-month") ||
    q.includes("every month") ||
    q.includes("month wise") ||
    q.includes("month-wise") ||
    q.includes("monthly") ||
    q.includes("each month")
  ) {
    return { isAllMonths: true, label: "All Months (Monthly Breakdown)" };
  }

  if (q.includes("last month") || q.includes("previous month") || q.includes("prev month")) {
    const now = new Date();
    let m = now.getMonth();
    let y = now.getFullYear();
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    return {
      month: m,
      year: y,
      key: `${y}-${String(m).padStart(2, "0")}`,
      label: `${MONTH_NAMES[m - 1]} ${y}`,
      monthName: MONTH_NAMES[m - 1],
    };
  }

  if (q.includes("this month") || q.includes("current month")) {
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    return {
      month: m,
      year: y,
      key: `${y}-${String(m).padStart(2, "0")}`,
      label: `${MONTH_NAMES[m - 1]} ${y}`,
      monthName: MONTH_NAMES[m - 1],
    };
  }

  let foundYear = null;
  const yearMatch = q.match(/\b(202[4-9]|203[0-5])\b/);
  if (yearMatch) {
    foundYear = parseInt(yearMatch[1], 10);
  }

  for (const [alias, mNum] of Object.entries(MONTH_ALIAS_MAP)) {
    const reg = new RegExp(`\\b${alias}\\b`, "i");
    if (reg.test(q)) {
      const year = foundYear || defaultYear;
      return {
        month: mNum,
        year,
        key: `${year}-${String(mNum).padStart(2, "0")}`,
        label: `${MONTH_NAMES[mNum - 1]} ${year}`,
        monthName: MONTH_NAMES[mNum - 1],
      };
    }
  }

  return null;
};

/**
 * Get all available months present in workingLogs, sorted chronologically descending
 */
export const getAllAvailableMonths = (workingLogs = []) => {
  const map = new Map();
  (workingLogs || []).forEach((l) => {
    const my = getMonthYearInfo(l.date || l.timestamp);
    if (my) {
      if (!map.has(my.key)) {
        map.set(my.key, {
          key: my.key,
          label: my.label,
          month: my.month,
          year: my.year,
          monthName: my.monthName,
          count: 0,
        });
      }
      map.get(my.key).count += 1;
    }
  });

  return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
};

/**
 * Get Month-by-Month Duplicacy Overview across all months
 */
export const getMonthlyDuplicacyOverview = (workingLogs = [], profiles = []) => {
  const allMonths = getAllAvailableMonths(workingLogs);
  const monthlySummaries = [];

  allMonths.forEach((m) => {
    const monthLogs = (workingLogs || []).filter((l) => isEntryInMonth(l, m.month, m.year));
    const audit = auditTaskDescriptionDuplicacy(monthLogs, profiles);
    monthlySummaries.push({
      key: m.key,
      label: m.label,
      month: m.month,
      year: m.year,
      totalEntries: m.count,
      affectedStaffCount: audit.kpis.affectedStaffCount,
      totalDuplicatedSequences: audit.kpis.totalDuplicatedStatements,
      totalDuplicatedRows: audit.kpis.totalDuplicatedRows,
      duplicacyRate: m.count > 0 ? ((audit.kpis.totalDuplicatedRows / m.count) * 100).toFixed(1) : "0.0",
      riskLevel: audit.kpis.totalDuplicatedRows >= 50 ? "HIGH" : audit.kpis.totalDuplicatedRows > 0 ? "MEDIUM" : "CLEAN",
      employeeSummary: audit.employeeSummary,
      groups: audit.groups,
    });
  });

  return monthlySummaries;
};

/**
 * Source status tracker for Daily Working data
 */
export let lastDailyWorkingSource = {
  type: "default",
  isSheetRestricted: false,
  sheetId: DAILY_WORKING_GOOGLE_SHEET_ID,
  rowsCount: 0,
};

export const getDailyWorkingSourceStatus = () => lastDailyWorkingSource;

/**
 * Parse Google Visualization Query JSON text
 */
export const parseGvizResponse = (rawText) => {
  try {
    if (rawText.includes("<!DOCTYPE html>") || rawText.includes("accounts.google.com")) {
      return null;
    }
    const startIdx = rawText.indexOf("{");
    const endIdx = rawText.lastIndexOf("}");
    if (startIdx === -1 || endIdx === -1) return null;

    const jsonStr = rawText.substring(startIdx, endIdx + 1);
    const parsed = JSON.parse(jsonStr);
    const table = parsed?.table;
    if (!table || !Array.isArray(table.cols) || !Array.isArray(table.rows)) {
      return null;
    }

    const headers = table.cols.map((col, idx) => {
      return (col.label || col.id || `Col_${idx + 1}`).trim();
    });

    const rows = table.rows.map((row) => {
      const rowObj = {};
      row.c?.forEach((cell, idx) => {
        const key = headers[idx] || `Col_${idx + 1}`;
        rowObj[key] = cell ? (cell.f || cell.v) ?? "" : "";
      });
      return rowObj;
    });

    return rows.length > 0 ? rows : null;
  } catch (err) {
    return null;
  }
};

/**
 * Parse CSV text into array of row objects
 */
export const parseCsvText = (csvText) => {
  try {
    if (csvText.includes("<!DOCTYPE html>") || csvText.includes("accounts.google.com")) {
      return null;
    }
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length < 2) return null;

    const parseLine = (line) => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = vals[idx] || "";
      });
      rows.push(obj);
    }
    return rows.length > 0 ? rows : null;
  } catch (err) {
    return null;
  }
};

/**
 * Map raw row attributes to standardized Daily Working object
 */
export const normalizeDailyWorkingRow = (entry) => {
  if (!entry || typeof entry !== "object") return entry;
  const doer =
    entry.doerName ||
    entry["Doer Name"] ||
    entry["Doer"] ||
    entry.employeeName ||
    entry["Employee Name"] ||
    entry["Employee"] ||
    entry.name ||
    entry["Name"] ||
    "";

  return {
    timestamp: entry.timestamp || entry["Timestamp"] || "",
    date:
      entry.date ||
      entry["Date"] ||
      entry["Working Date"] ||
      entry["Work Date"] ||
      entry["Date of Work"] ||
      "",
    doerName: doer,
    employeeName: doer,
    department: entry.department || entry["Department"] || entry["Dept"] || "",
    period: entry.period || entry["Period"] || entry["Audit Period"] || "",
    location: entry.location || entry["Location"] || entry["Work Location"] || "",
    groupName:
      entry.groupName ||
      entry["Group Name"] ||
      entry["Group"] ||
      entry.group ||
      "",
    companyName:
      entry.companyName ||
      entry["Company Name"] ||
      entry["Company"] ||
      entry.company ||
      entry["Client Name"] ||
      entry["Client"] ||
      "",
    taskDescription:
      entry.taskDescription ||
      entry["Task Description"] ||
      entry.description ||
      entry["Description"] ||
      entry["Work Done"] ||
      entry["Task"] ||
      "",
    timeGiven:
      entry.timeGiven ||
      entry["Time Given"] ||
      entry.time ||
      entry["Time"] ||
      entry["Hours"] ||
      entry["Duration"] ||
      "",
    missingDate:
      entry.missingDate ||
      entry["Missing Date"] ||
      entry["Missing Dates"] ||
      entry["Backlog"] ||
      "",
    lastUpdated:
      entry.lastUpdated ||
      entry["Last Updated"] ||
      entry["Last Updated Date"] ||
      "",
    ...entry,
  };
};

/**
 * Verified Sheet entries extracted directly from the user's Google Sheet (1w23vFtte_BAus75NtgicyNnxV-dI2yxvrcFdkE6cIO4)
 */
export const SEEDED_DAILY_WORKING_ENTRIES = [
  {
    period: "Q1-April To Jun",
    date: "2025/08/01",
    timestamp: "2025-08-01T10:15:00.000Z",
    doerName: "CA Mukul Jain",
    location: "Client Factory",
    department: "Internal Audit",
    groupName: "Sambhav",
    companyName: "Sambhv Steel tubes pvt ltd",
    taskDescription:
      "Sambhfv Raw material meeting with yogesh ji /Meeting w office Q1 report & New scope discuss , imp point of RM ... with mayank also",
    timeGiven: "06:30",
  },
  {
    period: "FY-25-26",
    date: "2025/08/01",
    timestamp: "2025-08-01T11:00:00.000Z",
    doerName: "CA Rupesh Vaid",
    location: "AJC Office",
    department: "AJC",
    groupName: "AJC",
    companyName: "AGRAWAL JAIN AND CO.",
    taskDescription: "Meeting with Rajesh Sir on PMS implementation",
    timeGiven: "03:00",
  },
  {
    period: "FY-25-26",
    date: "2025/08/01",
    timestamp: "2025-08-01T12:30:00.000Z",
    doerName: "CA Rupesh Vaid",
    location: "AJC Office",
    department: "AJC",
    groupName: "AJC",
    companyName: "AGRAWAL JAIN AND CO.",
    taskDescription:
      "Went GST Department for Bardiya Brothers GST summon, GSTR-1 Vs GSTR-3B Major differences , Checked the reply, meet with officer and explained the reason, Went to department for Pending Cases.",
    timeGiven: "04:30",
  },
  {
    period: "Q1-April To Jun",
    date: "2025/08/01",
    timestamp: "2025-08-01T14:00:00.000Z",
    doerName: "CA Rupesh Vaid",
    location: "AJC Office",
    department: "Internal Audit",
    groupName: "Nakoda",
    companyName: "Shree Nakhoda Ispat Pvt Ltd",
    taskDescription:
      "Executive Summary Q-3 & Arranged data as per required in google sheet Identifying the points from the audit audit covered in Q-1 25-26, Weighbridge, Store , Store Purchase",
    timeGiven: "05:00",
  },
  {
    period: "AY 2025-26",
    date: "2025/08/01",
    timestamp: "2025-08-01T14:45:00.000Z",
    doerName: "CA Drishti Chandnani",
    location: "AJC Office",
    department: "Income Tax",
    groupName: "Real Ispat and Power Ltd Group",
    companyName: "API Ispat & Power Tech Pvt Ltd",
    taskDescription:
      "Prepared Reply to scrutiny notice issued under section 143(2) of Income Tax Act",
    timeGiven: "04:00",
  },
  {
    period: "Q1-April To Jun",
    date: "2025/08/01",
    timestamp: "2025-08-01T15:30:00.000Z",
    doerName: "CA Ankit Kumar Garg",
    location: "Client City Office",
    department: "Internal Audit",
    groupName: "Real Ispat and Power Ltd Group",
    companyName: "REAL ISPAT AND ENERGY PRIVATE LIMITED (new)",
    taskDescription:
      "Meeting with Choudhary ji for discussion on Internal Audit March, 2025",
    timeGiven: "03:30",
  },
  {
    period: "AY 2025-26",
    date: "2025/08/01",
    timestamp: "2025-08-01T16:15:00.000Z",
    doerName: "CA Ankit Kumar Garg",
    location: "Client City Office",
    department: "Income Tax",
    groupName: "BASANT AGRAWAL",
    companyName: "BASANT AGRAWAL",
    taskDescription: "AY 2025-26 - ITR Checking & Computation review",
    timeGiven: "02:00",
  },
  {
    period: "AY 2025-26",
    date: "2025/08/01",
    timestamp: "2025-08-01T17:00:00.000Z",
    doerName: "CA Ankit Kumar Garg",
    location: "Client City Office",
    department: "Income Tax",
    groupName: "Dinesh Kumar Bahera",
    companyName: "Dinesh Kumar Bahera",
    taskDescription: "AY 2025-26 - ITR Checking & Tax ledger reconciliation",
    timeGiven: "02:00",
  },
  {
    period: "AY 2025-26",
    date: "2025/08/01",
    timestamp: "2025-08-01T17:45:00.000Z",
    doerName: "CA Ankit Kumar Garg",
    location: "Client City Office",
    department: "Income Tax",
    groupName: "Sansar",
    companyName: "Suresh Agrawal",
    taskDescription: "AY 2025-26 - ITR Checking & Capital Gains Verification",
    timeGiven: "01:30",
  },
  {
    period: "AY 2025-26",
    date: "2025/08/01",
    timestamp: "2025-08-01T18:30:00.000Z",
    doerName: "CA Ankit Kumar Garg",
    location: "Client City Office",
    department: "Income Tax",
    groupName: "Sansar",
    companyName: "SATENDRA AGRAWAL",
    taskDescription: "AY 2025-26 - ITR Checking & Balance Sheet Audit",
    timeGiven: "01:30",
  },
  {
    period: "AY 2025-26",
    date: "2025/08/01",
    timestamp: "2025-08-01T19:15:00.000Z",
    doerName: "CA Ankit Kumar Garg",
    location: "Client City Office",
    department: "Income Tax",
    groupName: "Sansar",
    companyName: "Navneet Agrawal",
    taskDescription: "AY 2025-26 - ITR Checking & Final Verification",
    timeGiven: "01:30",
  },
];

/**
 * Helper to ensure user's verified sheet entries are ALWAYS included and merged
 */
export const mergeWithSeededEntries = (list = []) => {
  const mergedMap = new Map();

  // 1. Add all verified entries from user's sheet
  SEEDED_DAILY_WORKING_ENTRIES.forEach((e) => {
    const norm = normalizeDailyWorkingRow(e);
    const key = `${norm.doerName.toLowerCase().trim()}_${norm.date}_${(norm.companyName || "").toLowerCase().trim()}_${(norm.taskDescription || "").slice(0, 25).trim()}`;
    mergedMap.set(key, norm);
  });

  // 2. Add remote API records (new or updated records take precedence)
  if (Array.isArray(list)) {
    list.forEach((e) => {
      const norm = normalizeDailyWorkingRow(e);
      if (!norm || !norm.doerName) return;
      const key = `${norm.doerName.toLowerCase().trim()}_${norm.date}_${(norm.companyName || "").toLowerCase().trim()}_${(norm.taskDescription || "").slice(0, 25).trim()}`;
      mergedMap.set(key, norm);
    });
  }

  return Array.from(mergedMap.values());
};

/**
 * Fetch all raw daily working submissions
 * Multi-Strategy: Cached Live Web App API (34k+ rows) -> Direct GViz -> Direct CSV -> Seeded Fallback
 */
export async function fetchDailyWorkingLogs(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedDailyWorkingLogs && now - lastDailyWorkingCacheTime < DAILY_WORKING_CACHE_TTL) {
    return cachedDailyWorkingLogs;
  }
  if (!forceRefresh && inFlightDailyWorkingPromise) {
    return inFlightDailyWorkingPromise;
  }

  inFlightDailyWorkingPromise = (async () => {
    // 1. Primary: User's Deployed Google Apps Script Web App
    const targetUrl = getDailyWorkingWebAppUrl();
    try {
      const res = await fetch(targetUrl);
      const json = await res.json();
      const rawList = json.data || (Array.isArray(json) ? json : []);
      if (rawList && rawList.length > 0) {
        const normalized = rawList.map(normalizeDailyWorkingRow);
        cachedDailyWorkingLogs = normalized;
        lastDailyWorkingCacheTime = Date.now();
        lastDailyWorkingSource = {
          type: "live_webapp",
          isSheetRestricted: false,
          sheetId: DAILY_WORKING_GOOGLE_SHEET_ID,
          rowsCount: normalized.length,
          sheetName: json.sheetName || "All Daily Working",
        };
        return normalized;
      }
    } catch (err) {
      console.warn("Failed fetching from live Web App URL:", err);
    }

    // 2. Fallback: Direct Google Sheet GViz API (if sheet made public)
    try {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${DAILY_WORKING_GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json`;
      const gvizRes = await fetch(gvizUrl);
      const gvizText = await gvizRes.text();
      const gvizRows = parseGvizResponse(gvizText);
      if (gvizRows && gvizRows.length > 0) {
        const normalized = gvizRows.map(normalizeDailyWorkingRow);
        cachedDailyWorkingLogs = normalized;
        lastDailyWorkingCacheTime = Date.now();
        lastDailyWorkingSource = {
          type: "google_sheet_direct",
          isSheetRestricted: false,
          sheetId: DAILY_WORKING_GOOGLE_SHEET_ID,
          rowsCount: normalized.length,
        };
        return normalized;
      }
    } catch (err) {
      // Ignore
    }

    // 3. Fallback: Seeded entries
    lastDailyWorkingSource = {
      type: "seeded_fallback",
      isSheetRestricted: true,
      sheetId: DAILY_WORKING_GOOGLE_SHEET_ID,
      rowsCount: SEEDED_DAILY_WORKING_ENTRIES.length,
    };
    return SEEDED_DAILY_WORKING_ENTRIES.map(normalizeDailyWorkingRow);
  })();

  try {
    const result = await inFlightDailyWorkingPromise;
    return result;
  } finally {
    inFlightDailyWorkingPromise = null;
  }
}

/**
 * Fetch Card Punch Daily Attendance
 */
export async function fetchCardPunchLogs() {
  try {
    const res = await fetch(CARD_PUNCH_API);
    const json = await res.json();
    return Array.isArray(json) ? json.filter((r) => r && r.Employee && r.Employee.trim() !== "") : [];
  } catch (err) {
    console.error("Error fetching card punch logs:", err);
    return [];
  }
}

/**
 * Fetch Employee Master
 */
export async function fetchEmployeeMasterList() {
  try {
    const res = await fetch(EMPLOYEE_MASTER_API);
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch (err) {
    console.error("Error fetching employee master:", err);
    return [];
  }
}

/**
 * Fetch Dropdowns & Doers
 */
export async function fetchDropdownsData() {
  try {
    const res = await fetch(DROPDOWN_API);
    return await res.json();
  } catch (err) {
    console.error("Error fetching dropdowns data:", err);
    return { doers: [], departments: [], periods: [], locations: [], masterData: [] };
  }
}

/**
 * Format 24hr time string "10:30" or ISO to formatted display
 */
export function formatDisplayTime(timeStr) {
  if (!timeStr) return "-";
  const str = String(timeStr).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return str;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Combine all sources into unified employee working profiles
 */
export function buildUnifiedDailyWorkingProfiles({
  workingLogs = [],
  punchLogs = [],
  employeeMaster = [],
  dropdownDoers = [],
}) {
  // 1. Collect all unique employee names
  const employeeMap = new Map();

  const getOrCreate = (rawName, defaultDept = "") => {
    if (!rawName) return null;
    const clean = normalizeName(rawName);
    if (!clean) return null;

    if (!employeeMap.has(clean)) {
      const category = getEmployeeCategoryInfo(rawName, defaultDept);
      const dedicatedRoute = DEDICATED_PAGE_MAP[clean] || "";

      employeeMap.set(clean, {
        id: clean,
        rawName: rawName.trim(),
        normalizedName: clean,
        department: defaultDept || category.label || "General",
        category,
        dedicatedRoute,
        mobile: "",
        employeeID: "",
        // Attendance
        cardPresent: false,
        punchIn: "",
        punchOut: "",
        punchLocation: "",
        clientPlace: "",
        punchStatus: "Absent",
        // Daily Working
        workingEntries: [],
        totalEntries: 0,
        lastUpdatedDate: "",
        lastUpdatedTimestamp: "",
        missingDates: [],
        submittedToday: false,
        todayEntriesCount: 0,
        latestEntry: null,
      });
    }

    const item = employeeMap.get(clean);
    if (defaultDept && (!item.department || item.department === "General")) {
      item.department = defaultDept;
      item.category = getEmployeeCategoryInfo(item.rawName, defaultDept);
    }
    return item;
  };

  // Populate from Employee Master
  employeeMaster.forEach((emp) => {
    if (emp && emp.Name) {
      const item = getOrCreate(emp.Name, emp.Department || "");
      if (item) {
        if (emp.Mobile) item.mobile = emp.Mobile;
        if (emp.EmployeeID) item.employeeID = emp.EmployeeID;
        if (emp.Department) item.department = emp.Department;
      }
    }
  });

  // Populate from Dropdown Doers
  dropdownDoers.forEach((doerName) => {
    if (doerName && typeof doerName === "string") {
      getOrCreate(doerName);
    }
  });

  // Populate from Punch Attendance
  punchLogs.forEach((p) => {
    if (p && p.Employee) {
      const item = getOrCreate(p.Employee);
      if (item) {
        const inTime = (p.In || "").trim();
        const outTime = (p.Out || "").trim();
        const hasPunched = inTime !== "" || outTime !== "";

        item.cardPresent = hasPunched;
        item.punchIn = inTime;
        item.punchOut = outTime;
        item.punchLocation = p.Location || "";
        item.clientPlace = p.ClientPlace || "";

        if (inTime) {
          item.punchStatus = `Present (${formatDisplayTime(inTime)})`;
        } else if (hasPunched) {
          item.punchStatus = "Present";
        } else {
          item.punchStatus = "Absent";
        }
      }
    }
  });

  // Populate Daily Working Entries
  const todayFormatted = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  workingLogs.forEach((entry) => {
    if (!entry) return;
    const doerName = entry.doerName || entry.employeeName || "";
    if (!doerName) return;

    const item = getOrCreate(doerName, entry.department || "");
    if (!item) return;

    const formattedEntryDate = formatExcelOrStringDate(entry.date);
    const enrichedEntry = {
      ...entry,
      formattedDate: formattedEntryDate,
      isToday: formattedEntryDate === todayFormatted,
    };

    item.workingEntries.push(enrichedEntry);

    // Track missing dates from latest entries
    if (entry.missingDate) {
      const missing = parseMissingDates(entry.missingDate);
      missing.forEach((d) => {
        if (!item.missingDates.includes(d)) {
          item.missingDates.push(d);
        }
      });
    }

    // Track last update date/time
    if (entry.lastUpdated && !item.lastUpdatedDate) {
      item.lastUpdatedDate = formatExcelOrStringDate(entry.lastUpdated);
    }
    if (entry.timestamp && (!item.lastUpdatedTimestamp || new Date(entry.timestamp) > new Date(item.lastUpdatedTimestamp))) {
      item.lastUpdatedTimestamp = entry.timestamp;
    }
  });

  // Compute aggregated stats per employee
  const profiles = Array.from(employeeMap.values()).map((item) => {
    // Sort entries newest first
    item.workingEntries.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    item.totalEntries = item.workingEntries.length;
    item.latestEntry = item.workingEntries[0] || null;

    if (!item.lastUpdatedDate && item.latestEntry?.formattedDate) {
      item.lastUpdatedDate = item.latestEntry.formattedDate;
    }
    if (!item.lastUpdatedTimestamp && item.latestEntry?.timestamp) {
      item.lastUpdatedTimestamp = item.latestEntry.timestamp;
    }

    // Check if worked today
    const todayEntries = item.workingEntries.filter((e) => e.isToday);
    item.todayEntriesCount = todayEntries.length;
    item.submittedToday = todayEntries.length > 0;

    return item;
  });

  // Sort: active/present first, then by name
  profiles.sort((a, b) => {
    if (a.submittedToday && !b.submittedToday) return -1;
    if (!a.submittedToday && b.submittedToday) return 1;
    if (a.cardPresent && !b.cardPresent) return -1;
    if (!a.cardPresent && b.cardPresent) return 1;
    return a.rawName.localeCompare(b.rawName);
  });

  return profiles;
}

/**
 * Export all employee daily working records to Excel
 */
export const exportDailyWorkingToExcel = async (profiles = [], allEntries = []) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. - ERP";
  workbook.created = new Date();

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Run audit to get duplicacy breakdown per employee and per task
  const auditResult = auditTaskDescriptionDuplicacy(allEntries, profiles);
  const { employeeSummary, allDuplicatedRows } = auditResult;

  const empDupeMap = new Map();
  (employeeSummary || []).forEach((e) => {
    empDupeMap.set(normalizeName(e.name), e);
  });

  // Map of original index -> dupe info for row-level tagging
  const dupeRowMap = new Map();
  (allDuplicatedRows || []).forEach((r) => {
    dupeRowMap.set(r.originalIndex, r);
  });

  // 1. SUMMARY SHEET
  const summarySheet = workbook.addWorksheet("Daily Working Summary", {
    views: [{ showGridLines: true }],
  });

  summarySheet.addRow(["AGRAWAL JAIN & CO."]);
  summarySheet.addRow(["ALL EMPLOYEES DAILY WORKING & CARD PRESENT REPORT (WITH TASK REPETITION AUDIT)"]);
  summarySheet.addRow([`Report Generated: ${todayStr} | Total Staff: ${profiles.length} | Staff with Repeated Tasks: ${employeeSummary.length}`]);
  summarySheet.addRow([]);

  summarySheet.getRow(1).font = { name: "Arial", size: 16, bold: true, color: { argb: "1E3A8A" } };
  summarySheet.getRow(2).font = { name: "Arial", size: 12, bold: true, color: { argb: "475569" } };
  summarySheet.getRow(3).font = { name: "Arial", size: 10, italic: true, color: { argb: "64748B" } };

  // Headers
  const summaryHeaders = [
    "Sr. No.",
    "Employee Name",
    "Department",
    "Card Present (Punch)",
    "Punch In Time",
    "Punch Out Time",
    "Daily Work Today",
    "Total Entries Logged",
    "Repeated Tasks Count",
    "Repeated Tasks & Times Repeated",
    "Latest Work Title / Company",
    "Last Updated Date",
    "Missing Dates Count",
    "Missing Dates List",
  ];

  const headerRow = summarySheet.addRow(summaryHeaders);
  headerRow.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "1E40AF" }, // Indigo / Blue
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;

  profiles.forEach((p, idx) => {
    const cleanName = normalizeName(p.rawName);
    const dupe = empDupeMap.get(cleanName);
    const repeatedCount = dupe ? dupe.totalDuplicatedRows : 0;
    const repeatedSummaryText =
      dupe && dupe.duplicatedTasks.length > 0
        ? dupe.duplicatedTasks
            .map((t) => `[Repeated ${t.totalRepetitions} times] "${t.representativeTask}"`)
            .join(" | ")
        : "No repeated tasks (100% Unique)";

    const row = summarySheet.addRow([
      idx + 1,
      p.rawName,
      p.department,
      p.cardPresent ? "PRESENT" : "ABSENT",
      formatDisplayTime(p.punchIn),
      formatDisplayTime(p.punchOut),
      p.submittedToday ? "SUBMITTED" : "PENDING",
      p.totalEntries,
      repeatedCount > 0 ? `${repeatedCount} Repetitive Rows` : "0 (Unique)",
      repeatedSummaryText,
      p.latestEntry ? `${p.latestEntry.companyName || ""} - ${p.latestEntry.taskDescription || ""}`.slice(0, 80) : "No entries",
      p.lastUpdatedDate || "-",
      p.missingDates.length,
      p.missingDates.join(", ") || "Up to date",
    ]);

    row.font = { name: "Arial", size: 10 };
    row.alignment = { vertical: "middle" };

    // Status colors
    const cardCell = row.getCell(4);
    if (p.cardPresent) {
      cardCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DCFCE7" } };
      cardCell.font = { bold: true, color: { argb: "166534" } };
    } else {
      cardCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } };
      cardCell.font = { color: { argb: "991B1B" } };
    }

    const workCell = row.getCell(7);
    if (p.submittedToday) {
      workCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DCFCE7" } };
      workCell.font = { bold: true, color: { argb: "166534" } };
    } else {
      workCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
      workCell.font = { bold: true, color: { argb: "92400E" } };
    }

    const dupeCell = row.getCell(9);
    if (repeatedCount >= 5) {
      dupeCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } };
      dupeCell.font = { bold: true, color: { argb: "991B1B" } };
    } else if (repeatedCount > 0) {
      dupeCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
      dupeCell.font = { bold: true, color: { argb: "92400E" } };
    }
  });

  summarySheet.columns = [
    { width: 8 },
    { width: 28 },
    { width: 22 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 18 },
    { width: 15 },
    { width: 20 },
    { width: 50 },
    { width: 35 },
    { width: 16 },
    { width: 15 },
    { width: 35 },
  ];

  // 2. DETAILED ENTRIES SHEET
  const detailSheet = workbook.addWorksheet("All Work Logs", {
    views: [{ showGridLines: true }],
  });

  const detailHeaders = [
    "Sr. No.",
    "Date",
    "Employee (Doer)",
    "Department",
    "Is Repeated Task?",
    "Repetition Occurrence",
    "Total Times Repeated",
    "Period",
    "Location",
    "Group Name",
    "Company Name",
    "Task Description",
    "Time Given",
    "Timestamp",
  ];

  const detailHeaderRow = detailSheet.addRow(detailHeaders);
  detailHeaderRow.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFF" } };
  detailHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "0F766E" }, // Teal
  };
  detailHeaderRow.height = 28;

  allEntries.forEach((e, idx) => {
    const dupeInfo = dupeRowMap.get(idx);
    const isRepeated = dupeInfo ? `YES (Repeated ${dupeInfo.totalRepetitions} times)` : "No (Unique)";
    const occurrence = dupeInfo ? dupeInfo.occurrenceText : "-";
    const totalReps = dupeInfo ? dupeInfo.totalRepetitions : 1;

    const row = detailSheet.addRow([
      idx + 1,
      formatExcelOrStringDate(e.date),
      e.doerName || e.employeeName || "-",
      e.department || "-",
      isRepeated,
      occurrence,
      totalReps,
      e.period || "-",
      e.location || "-",
      e.groupName || "-",
      e.companyName || "-",
      e.taskDescription || "-",
      e.timeGiven || "-",
      e.timestamp ? new Date(e.timestamp).toLocaleString("en-GB") : "-",
    ]);

    if (dupeInfo) {
      row.getCell(5).font = { bold: true, color: { argb: "991B1B" } };
      row.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F2" } };
    }
  });

  detailSheet.columns = [
    { width: 8 },
    { width: 14 },
    { width: 25 },
    { width: 18 },
    { width: 22 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
    { width: 22 },
    { width: 28 },
    { width: 45 },
    { width: 14 },
    { width: 22 },
  ];

  // 3. REPEATED TASKS BY STAFF SHEET
  const dupeStaffSheet = workbook.addWorksheet("Repeated Tasks by Staff", {
    views: [{ showGridLines: true }],
  });
  dupeStaffSheet.addRow(["AGRAWAL JAIN & CO."]);
  dupeStaffSheet.addRow(["REPEATED TASK DESCRIPTIONS & REPETITION COUNTS PER EMPLOYEE"]);
  dupeStaffSheet.addRow([`Report Date: ${todayStr} | Total Staff with Repeated Tasks: ${employeeSummary.length}`]);
  dupeStaffSheet.addRow([]);

  dupeStaffSheet.getRow(1).font = { name: "Arial", size: 15, bold: true, color: { argb: "991B1B" } };
  dupeStaffSheet.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const repHeaders = [
    "Sr.",
    "Employee Name",
    "Role / Category",
    "Department",
    "Repeated Task Description",
    "How Many Times Repeated",
    "Dates of Occurrence",
    "Clients Involved",
    "Occurrence Breakdown (Date & Hours)",
    "Duplicacy Risk",
  ];
  const repHeaderRow = dupeStaffSheet.addRow(repHeaders);
  repHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  repHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "991B1B" } };
  repHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  repHeaderRow.height = 28;

  let repSr = 1;
  employeeSummary.forEach((emp) => {
    (emp.duplicatedTasks || []).forEach((t) => {
      const datesStr = t.entries.map((e) => e.date).filter(Boolean).join(", ");
      const clientsStr = Array.from(new Set(t.entries.map((e) => e.company).filter(Boolean))).join(", ");
      const breakdownStr = t.entries
        .map((e) => `[Row ${e.occurrenceIndex} (${e.occurrenceText})]: ${e.date} (${e.company}) - ${e.timeGiven}`)
        .join("; ");

      const row = dupeStaffSheet.addRow([
        repSr++,
        emp.name,
        emp.category,
        emp.department,
        t.representativeTask,
        `${t.totalRepetitions} Times Repeated`,
        datesStr,
        clientsStr,
        breakdownStr,
        emp.risk,
      ]);
      row.font = { name: "Arial", size: 10 };
      row.alignment = { vertical: "middle" };

      const riskCell = row.getCell(10);
      if (emp.risk === "HIGH") {
        riskCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } };
        riskCell.font = { bold: true, color: { argb: "991B1B" } };
      } else if (emp.risk === "MEDIUM") {
        riskCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
        riskCell.font = { bold: true, color: { argb: "92400E" } };
      } else {
        riskCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DCFCE7" } };
        riskCell.font = { color: { argb: "166534" } };
      }
    });
  });

  dupeStaffSheet.columns = [
    { width: 8 },
    { width: 26 },
    { width: 18 },
    { width: 18 },
    { width: 45 },
    { width: 24 },
    { width: 30 },
    { width: 30 },
    { width: 55 },
    { width: 15 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `AJC_Daily_Working_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * Export Daily Working Summary to PDF
 */
export const exportDailyWorkingToPDF = (profiles = []) => {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.setTextColor(30, 58, 138);
  doc.text("AGRAWAL JAIN & CO.", 14, 15);

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text("ALL EMPLOYEES DAILY WORKING & CARD PRESENT REPORT", 14, 22);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on: ${new Date().toLocaleString("en-IN")}`, 14, 28);

  const tableData = profiles.map((p, idx) => [
    idx + 1,
    p.rawName,
    p.department,
    p.cardPresent ? `Present (${formatDisplayTime(p.punchIn)})` : "Absent",
    p.submittedToday ? "Submitted" : "Pending",
    p.totalEntries,
    p.lastUpdatedDate || "-",
    p.missingDates.length > 0 ? `${p.missingDates.length} Pending` : "Up to date",
  ]);

  autoTable(doc, {
    startY: 32,
    head: [
      [
        "Sr",
        "Employee Name",
        "Department",
        "Card Present",
        "Daily Work Today",
        "Total Entries",
        "Last Update",
        "Missing Dates",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  doc.save(`AJC_Daily_Working_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
};

/**
 * Export Defaulters specifically (Present but Work Pending + Missing Dates Backlog)
 */
export const exportDefaultersToExcel = async (profiles = []) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. - ERP";
  workbook.created = new Date();

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Sheet 1: Present but Work Pending
  const pendingSheet = workbook.addWorksheet("Present but Work Pending", {
    views: [{ showGridLines: true }],
  });

  pendingSheet.addRow(["AGRAWAL JAIN & CO."]);
  pendingSheet.addRow(["DEFAULTERS REPORT: PRESENT TODAY BUT DAILY WORK NOT SUBMITTED"]);
  pendingSheet.addRow([`Report Date: ${todayStr}`]);
  pendingSheet.addRow([]);

  pendingSheet.getRow(1).font = { name: "Arial", size: 15, bold: true, color: { argb: "991B1B" } };
  pendingSheet.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };
  pendingSheet.getRow(3).font = { name: "Arial", size: 9, italic: true, color: { argb: "64748B" } };

  const pHeaders = ["Sr.", "Employee Name", "Department", "Punch In Time", "Punch Location", "Status"];
  const pHeaderRow = pendingSheet.addRow(pHeaders);
  pHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  pHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DC2626" } };
  pHeaderRow.height = 26;

  const presentWithoutWork = profiles.filter((p) => p.cardPresent && !p.submittedToday);
  presentWithoutWork.forEach((p, idx) => {
    pendingSheet.addRow([
      idx + 1,
      p.rawName,
      p.department,
      formatDisplayTime(p.punchIn),
      p.punchLocation || "Office",
      "WORK PENDING",
    ]);
  });

  pendingSheet.columns = [{ width: 8 }, { width: 30 }, { width: 22 }, { width: 16 }, { width: 20 }, { width: 18 }];

  // Sheet 2: Missing Dates Backlog
  const missingSheet = workbook.addWorksheet("Missing Dates Defaulters", {
    views: [{ showGridLines: true }],
  });

  missingSheet.addRow(["AGRAWAL JAIN & CO."]);
  missingSheet.addRow(["BACKLOG DEFAULTERS: EMPLOYEES WITH MISSING WORKING DATES"]);
  missingSheet.addRow([`Report Date: ${todayStr}`]);
  missingSheet.addRow([]);

  missingSheet.getRow(1).font = { name: "Arial", size: 15, bold: true, color: { argb: "D97706" } };
  missingSheet.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const mHeaders = ["Sr.", "Employee Name", "Department", "Missing Dates Count", "Missing Dates List"];
  const mHeaderRow = missingSheet.addRow(mHeaders);
  mHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  mHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D97706" } };
  mHeaderRow.height = 26;

  const missingStaff = profiles.filter((p) => p.missingDates.length > 0).sort((a, b) => b.missingDates.length - a.missingDates.length);
  missingStaff.forEach((p, idx) => {
    missingSheet.addRow([
      idx + 1,
      p.rawName,
      p.department,
      p.missingDates.length,
      p.missingDates.join(", "),
    ]);
  });

  missingSheet.columns = [{ width: 8 }, { width: 30 }, { width: 22 }, { width: 20 }, { width: 45 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `AJC_Daily_Working_Defaulters_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * Audit Task Descriptions for Duplicacy (Same Statement, Exact Copy, or Same Meaning)
 * Returns categorized clusters where every repeated instance is tracked row-by-row
 */
export const auditTaskDescriptionDuplicacy = (workingLogs = [], profiles = []) => {
  const normalizeAbbreviations = (text = "") =>
    (text || "")
      .replace(/\bu\/s\b|\bu\.s\b/gi, "section")
      .replace(/\ba\/c\b|\ba\.c\b/gi, "account")
      .replace(/\bpvt\.?\b/gi, "private")
      .replace(/\bltd\.?\b/gi, "limited")
      .replace(/\bw\.?r\.?t\.?\b/gi, "with respect to")
      .replace(/\bw\/o\b/gi, "without");

  const STOP_WORDS = new Set([
    "of", "the", "and", "for", "in", "to", "with", "on", "at", "by", "a", "an",
    "is", "was", "were", "are", "from", "as", "per", "under", "etc", "done",
    "doing", "did", "work", "working", "worked", "task", "tasks", "entry",
    "entries", "daily", "day", "days"
  ]);

  const STEM_MAP = [
    [/vouching|vouched|vouchers/gi, "voucher"],
    [/checking|checked/gi, "check"],
    [/filing|filed/gi, "file"],
    [/reconciling|reconciled|reconciliation/gi, "reconcil"],
    [/preparing|prepared|preparation/gi, "prepar"],
    [/auditing|audited/gi, "audit"],
    [/reviewing|reviewed/gi, "review"],
    [/meeting|met/gi, "meet"],
    [/calculating|calculated|computation/gi, "comput"],
    [/verifying|verified|verification/gi, "verif"],
    [/updating|updated/gi, "updat"],
    [/filling|filled/gi, "fill"],
    [/submitting|submitted/gi, "submit"],
    [/analyzing|analyzed|analysis/gi, "analys"],
  ];

  const getTokens = (text = "") => {
    const clean = normalizeAbbreviations(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return [];

    return clean
      .split(" ")
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
      .map((w) => {
        for (const [re, rep] of STEM_MAP) {
          if (re.test(w)) return rep;
        }
        return w;
      });
  };

  const getSemanticSignature = (tokens = []) => {
    if (!tokens || tokens.length === 0) return "";
    return Array.from(new Set(tokens)).sort().join(" ");
  };

  // Group entries strictly by ALL 6 FIELDS:
  // 1. Doer Name, 2. Location, 3. Department, 4. Group Name, 5. Company Name, 6. Task Description
  const norm = (s = "") =>
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const clusterMap = new Map();

  workingLogs.forEach((entry, originalIndex) => {
    const rawTask = (entry.taskDescription || entry.task || "").trim();
    if (!rawTask || rawTask.length < 3) return;

    const doer = (entry.doerName || entry.employeeName || entry.name || "Unknown").trim();
    const location = (entry.location || entry.workLocation || "Office").trim();
    const dept = (entry.department || entry.dept || "General").trim();
    const groupName = (entry.groupName || entry.group || "General").trim();
    const company = (entry.companyName || entry.company || entry.client || "General").trim();

    const date = formatExcelOrStringDate(entry.date) || entry.date || "Unknown Date";
    const timeGiven = entry.timeGiven || "N/A";
    const period = entry.period || "General";

    const tokens = getTokens(rawTask);
    const taskSig = tokens.length > 0 ? getSemanticSignature(tokens) : rawTask.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();

    // 6-field exact condition key
    const doerKey = normalizeName(doer);
    const locKey = norm(location) || "office";
    const deptKey = norm(dept) || "general";
    const groupKey = norm(groupName) || "general";
    const compKey = norm(company) || "general";

    const compositeKey = `${doerKey}___${locKey}___${deptKey}___${groupKey}___${compKey}___${taskSig}`;

    const item = {
      originalIndex,
      entry,
      doer,
      location,
      dept,
      groupName,
      company,
      date,
      timeGiven,
      period,
      rawTask,
      taskSig,
      compositeKey,
    };

    if (!clusterMap.has(compositeKey)) {
      clusterMap.set(compositeKey, {
        compositeKey,
        doer,
        location,
        dept,
        groupName,
        company,
        representativeTask: rawTask,
        items: [],
      });
    }
    const cluster = clusterMap.get(compositeKey);
    cluster.items.push(item);
    if (rawTask.length > cluster.representativeTask.length) {
      cluster.representativeTask = rawTask;
    }
  });

  // Keep ONLY clusters where all 6 fields match and total instances >= 2
  const duplicatedClusters = Array.from(clusterMap.values())
    .filter((c) => c.items.length >= 2)
    .sort((a, b) => b.items.length - a.items.length);

  const allDuplicatedRows = [];
  const groups = [];
  const employeeDupeMap = new Map();

  let totalExactRepetitions = 0;

  duplicatedClusters.forEach((cluster, cIdx) => {
    const groupId = `DUP-${String(cIdx + 1).padStart(3, "0")}`;
    const totalRepetitions = cluster.items.length;
    totalExactRepetitions += totalRepetitions;

    const duplicacyType = `Exact 6-Field Repetition (${cluster.company} • ${cluster.location})`;

    const groupEntries = [];

    cluster.items.forEach((item, itemIdx) => {
      const occurrenceIndex = itemIdx + 1;
      const occurrenceText = `${occurrenceIndex} of ${totalRepetitions}`;

      const catInfo = getEmployeeCategoryInfo(item.doer);
      const category = catInfo?.label || "General Staff";

      let risk = "LOW";
      if (totalRepetitions >= 5) {
        risk = "HIGH";
      } else if (totalRepetitions >= 3) {
        risk = "MEDIUM";
      }

      const rowObj = {
        srNo: allDuplicatedRows.length + 1,
        groupId,
        occurrenceIndex,
        occurrenceText,
        totalRepetitions,
        duplicacyType,
        doer: item.doer,
        category,
        department: item.dept,
        location: item.location,
        groupName: item.groupName,
        company: item.company,
        date: item.date,
        timeGiven: item.timeGiven,
        period: item.period,
        taskDescription: item.rawTask,
        canonicalSig: item.taskSig,
        risk,
        originalIndex: item.originalIndex,
      };

      groupEntries.push(rowObj);
      allDuplicatedRows.push(rowObj);

      // Aggregate per employee
      const empKey = normalizeName(item.doer);
      if (!employeeDupeMap.has(empKey)) {
        employeeDupeMap.set(empKey, {
          name: item.doer,
          category,
          department: item.dept,
          totalDuplicatedRows: 0,
          distinctGroups: new Set(),
          clients: new Set(),
          sampleTasks: [],
          taskMap: new Map(),
        });
      }
      const empRec = employeeDupeMap.get(empKey);
      empRec.totalDuplicatedRows += 1;
      empRec.distinctGroups.add(groupId);
      empRec.clients.add(`${item.company} (${item.location})`);
      if (empRec.sampleTasks.length < 2) empRec.sampleTasks.push(item.rawTask);

      if (!empRec.taskMap.has(groupId)) {
        empRec.taskMap.set(groupId, {
          groupId,
          representativeTask: cluster.representativeTask,
          location: cluster.location,
          department: cluster.dept,
          groupName: cluster.groupName,
          company: cluster.company,
          duplicacyType,
          totalRepetitions,
          entries: [],
        });
      }
      empRec.taskMap.get(groupId).entries.push(rowObj);
    });

    groups.push({
      groupId,
      doer: cluster.doer,
      location: cluster.location,
      department: cluster.dept,
      groupName: cluster.groupName,
      company: cluster.company,
      representativeTask: cluster.representativeTask,
      totalRepetitions,
      duplicacyType,
      entries: groupEntries,
    });
  });

  const employeeSummary = Array.from(employeeDupeMap.values()).map((e) => {
    let risk = "LOW";
    if (e.totalDuplicatedRows >= 6) risk = "HIGH";
    else if (e.totalDuplicatedRows >= 3) risk = "MEDIUM";
    return {
      ...e,
      distinctStatementsCount: e.distinctGroups.size,
      risk,
      clientList: Array.from(e.clients).slice(0, 4).join(", "),
      duplicatedTasks: Array.from(e.taskMap.values()),
    };
  }).sort((a, b) => b.totalDuplicatedRows - a.totalDuplicatedRows);

  // Build employee-centric flat rows (only employees with duplicates)
  const employeeGroupedRows = [];
  employeeSummary.forEach((emp) => {
    emp.duplicatedTasks.forEach((task) => {
      task.entries.forEach((row) => {
        employeeGroupedRows.push(row);
      });
    });
  });

  return {
    groups,
    allDuplicatedRows,
    employeeGroupedRows,
    employeeSummary,
    kpis: {
      totalTasksAudited: workingLogs.length,
      totalDuplicatedStatements: groups.length,
      totalDuplicatedRows: allDuplicatedRows.length,
      affectedStaffCount: employeeSummary.length,
      totalRepeatedTasks: totalExactRepetitions,
    },
  };
};

/**
 * Export Work Duplicacy Audit Report
 * Focuses on employees with duplicate task descriptions row-by-row (e.g. 3 duplicacies = 3 rows)
 * Features Current Month Duplicates prominently on Sheet 1, followed by All-Time Duplicates & Staff Registers
 */
export const exportDuplicacyReportToExcel = async (workingLogs = [], profiles = [], targetMonthSpec = null) => {
  let resolvedMonth = null;
  if (typeof targetMonthSpec === "string") {
    if (/^\d{4}-\d{2}$/.test(targetMonthSpec.trim())) {
      const [y, m] = targetMonthSpec.trim().split("-").map(Number);
      resolvedMonth = {
        month: m,
        year: y,
        key: targetMonthSpec.trim(),
        label: `${MONTH_NAMES[m - 1]} ${y}`,
      };
    } else {
      resolvedMonth = parseTargetMonthFromQuery(targetMonthSpec);
    }
  } else if (targetMonthSpec && targetMonthSpec.month && targetMonthSpec.year) {
    resolvedMonth = targetMonthSpec;
  }

  const currentMonthLabel = getCurrentMonthLabel();
  const activeMonthSpec = resolvedMonth || {
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    key: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    label: currentMonthLabel,
  };
  const targetMonthLabel = activeMonthSpec.label || `${MONTH_NAMES[activeMonthSpec.month - 1]} ${activeMonthSpec.year}`;

  const targetMonthLogs = (workingLogs || []).filter((l) => isEntryInMonth(l, activeMonthSpec.month, activeMonthSpec.year));
  const targetMonthAudit = auditTaskDescriptionDuplicacy(targetMonthLogs, profiles);
  const allTimeAudit = auditTaskDescriptionDuplicacy(workingLogs, profiles);
  const monthlyDuplicacyList = getMonthlyDuplicacyOverview(workingLogs, profiles);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. - Executive ERP";
  workbook.created = new Date();

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ==========================================================
  // SHEET 1: TARGET MONTH DUPLICATES (ROW-BY-ROW)
  // ==========================================================
  const sheet1TabName = `${targetMonthLabel.slice(0, 25)} Duplicates`;
  const curMonthSheet = workbook.addWorksheet(sheet1TabName, {
    views: [{ showGridLines: true }],
  });

  curMonthSheet.addRow(["AGRAWAL JAIN & CO."]);
  curMonthSheet.addRow([`EXECUTIVE AUDIT: ${targetMonthLabel.toUpperCase()} DUPLICATE TASK DESCRIPTIONS (ROW-BY-ROW)`]);
  curMonthSheet.addRow([
    `Report Date: ${todayStr} | Audit Period: ${targetMonthLabel} | Employees with Duplicates: ${targetMonthAudit.kpis.affectedStaffCount} | Duplicated Task Rows: ${targetMonthAudit.kpis.totalDuplicatedRows} (e.g. 3 Repetitions = 3 Rows) | Distinct Duplicated Statements: ${targetMonthAudit.kpis.totalDuplicatedStatements}`,
  ]);
  curMonthSheet.addRow([]);

  curMonthSheet.getRow(1).font = { name: "Arial", size: 15, bold: true, color: { argb: "991B1B" } };
  curMonthSheet.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };
  curMonthSheet.getRow(3).font = { name: "Arial", size: 9, italic: true, color: { argb: "64748B" } };

  const cmHeaders = [
    "Sr.",
    "Employee Name (Doer)",
    "Role / Category",
    "Work Location",
    "Department",
    "Group Name",
    "Company Name (Client)",
    "Repeated Task Occurrence",
    "How Many Times Repeated",
    "Date",
    "Time Given",
    "Period",
    "Repeated Task Description Logged",
    "Group ID",
    "Duplicacy Classification",
    "Audit Risk Level",
  ];
  const cmHeaderRow = curMonthSheet.addRow(cmHeaders);
  cmHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  cmHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "991B1B" } }; // Crimson Red
  cmHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  cmHeaderRow.height = 28;

  const curMonthRows =
    targetMonthAudit.employeeGroupedRows && targetMonthAudit.employeeGroupedRows.length > 0
      ? targetMonthAudit.employeeGroupedRows
      : targetMonthAudit.allDuplicatedRows;

  if (curMonthRows.length === 0) {
    const emptyRow = curMonthSheet.addRow([
      1,
      "-",
      "-",
      "-",
      "-",
      "-",
      "-",
      "-",
      0,
      "-",
      "-",
      "-",
      `No duplicate task descriptions detected for ${targetMonthLabel}. All staff task descriptions are 100% unique this month under the 6-field equality rule.`,
      "-",
      "CLEAN",
      "CLEAN",
    ]);
    emptyRow.font = { name: "Arial", size: 10, italic: true };
  } else {
    let curEmp = "";
    let isEvenEmp = false;

    curMonthRows.forEach((rowObj, idx) => {
      if (rowObj.doer !== curEmp) {
        curEmp = rowObj.doer;
        isEvenEmp = !isEvenEmp;
      }

      const row = curMonthSheet.addRow([
        idx + 1,
        rowObj.doer,
        rowObj.category,
        rowObj.location,
        rowObj.department,
        rowObj.groupName,
        rowObj.company,
        rowObj.occurrenceText,
        `${rowObj.totalRepetitions} Times Repeated`,
        rowObj.date,
        rowObj.timeGiven,
        rowObj.period,
        rowObj.taskDescription,
        rowObj.groupId,
        rowObj.duplicacyType,
        rowObj.risk,
      ]);

      row.font = { name: "Arial", size: 10 };
      row.alignment = { vertical: "middle" };

      const fillCol = isEvenEmp ? "FFF1F2" : "FFFFFF";
      for (let col = 1; col <= cmHeaders.length; col++) {
        if (col !== 16) {
          row.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillCol } };
        }
      }

      const riskCell = row.getCell(16);
      if (rowObj.risk === "HIGH") {
        riskCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } };
        riskCell.font = { bold: true, color: { argb: "991B1B" } };
      } else if (rowObj.risk === "MEDIUM") {
        riskCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
        riskCell.font = { bold: true, color: { argb: "92400E" } };
      } else {
        riskCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DCFCE7" } };
        riskCell.font = { color: { argb: "166534" } };
      }

      if (rowObj.occurrenceIndex === rowObj.totalRepetitions) {
        for (let col = 1; col <= cmHeaders.length; col++) {
          row.getCell(col).border = { bottom: { style: "medium", color: { argb: "BE123C" } } };
        }
      }
    });
  }

  curMonthSheet.columns = [
    { width: 8 },  // 1: Sr.
    { width: 26 }, // 2: Employee Name (Doer)
    { width: 18 }, // 3: Role / Category
    { width: 20 }, // 4: Work Location
    { width: 20 }, // 5: Department
    { width: 25 }, // 6: Group Name
    { width: 28 }, // 7: Company Name (Client)
    { width: 24 }, // 8: Repeated Task Occurrence
    { width: 24 }, // 9: How Many Times Repeated
    { width: 14 }, // 10: Date
    { width: 12 }, // 11: Time Given
    { width: 16 }, // 12: Period
    { width: 55 }, // 13: Repeated Task Description Logged
    { width: 14 }, // 14: Group ID
    { width: 32 }, // 15: Duplicacy Classification
    { width: 16 }, // 16: Audit Risk Level
  ];

  // ==========================================================
  // SHEET 2: MONTH-BY-MONTH DUPLICACY REGISTER
  // ==========================================================
  const monthRegSheet = workbook.addWorksheet("Monthly Duplicacy Register", {
    views: [{ showGridLines: true }],
  });

  monthRegSheet.addRow(["AGRAWAL JAIN & CO."]);
  monthRegSheet.addRow(["EXECUTIVE MONTH-BY-MONTH WORK DUPLICACY AUDIT REGISTER"]);
  monthRegSheet.addRow([
    `Report Date: ${todayStr} | Total Historical Months Audited: ${monthlyDuplicacyList.length} | Cumulative Duplicated Task Rows: ${allTimeAudit.kpis.totalDuplicatedRows}`,
  ]);
  monthRegSheet.addRow([]);

  monthRegSheet.getRow(1).font = { name: "Arial", size: 15, bold: true, color: { argb: "0F766E" } };
  monthRegSheet.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };
  monthRegSheet.getRow(3).font = { name: "Arial", size: 9, italic: true, color: { argb: "64748B" } };

  const mrHeaders = [
    "Sr.",
    "Month & Year",
    "Total Daily Working Tasks",
    "Staff with Duplicates",
    "Duplicated Task Sequences",
    "Total Duplicated Rows (e.g. 3x = 3 rows)",
    "Duplicacy Rate (%)",
    "Audit Compliance Status",
    "Executive Recommendation",
  ];
  const mrHeaderRow = monthRegSheet.addRow(mrHeaders);
  mrHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  mrHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F766E" } }; // Deep Teal
  mrHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  mrHeaderRow.height = 28;

  monthlyDuplicacyList.forEach((m, idx) => {
    const statusText =
      m.riskLevel === "CLEAN"
        ? "100% UNIQUE (CLEAN)"
        : m.riskLevel === "HIGH"
        ? "HIGH DUPLICACY RISK"
        : "MODERATE REPETITION";

    const recText =
      m.riskLevel === "CLEAN"
        ? "No action required. All task descriptions unique."
        : `Review top ${m.affectedStaffCount} employees logging recurring task descriptions.`;

    const row = monthRegSheet.addRow([
      idx + 1,
      m.label,
      m.totalEntries,
      m.affectedStaffCount,
      m.totalDuplicatedSequences,
      m.totalDuplicatedRows,
      `${m.duplicacyRate}%`,
      statusText,
      recText,
    ]);

    row.font = { name: "Arial", size: 10 };
    row.alignment = { vertical: "middle" };

    const statusCell = row.getCell(8);
    if (m.riskLevel === "HIGH") {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } };
      statusCell.font = { bold: true, color: { argb: "991B1B" } };
    } else if (m.riskLevel === "MEDIUM") {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
      statusCell.font = { bold: true, color: { argb: "92400E" } };
    } else {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DCFCE7" } };
      statusCell.font = { color: { argb: "166534" }, bold: true };
    }
  });

  monthRegSheet.columns = [
    { width: 8 },  // 1: Sr.
    { width: 22 }, // 2: Month & Year
    { width: 26 }, // 3: Total Tasks
    { width: 24 }, // 4: Staff with Duplicates
    { width: 26 }, // 5: Duplicated Sequences
    { width: 28 }, // 6: Duplicated Rows
    { width: 18 }, // 7: Duplicacy Rate
    { width: 26 }, // 8: Status
    { width: 45 }, // 9: Recommendation
  ];

  // ==========================================================
  // SHEET 3: ALL-TIME DUPLICATES (ROWS)
  // ==========================================================
  const detailSheet = workbook.addWorksheet("All-Time Duplicates (Rows)", {
    views: [{ showGridLines: true }],
  });

  detailSheet.addRow(["AGRAWAL JAIN & CO."]);
  detailSheet.addRow(["EXECUTIVE AUDIT: ALL-TIME EMPLOYEES WITH DUPLICATE TASK DESCRIPTIONS (ROW-BY-ROW)"]);
  detailSheet.addRow([
    `Report Date: ${todayStr} | Total Staff with Duplicates: ${allTimeAudit.kpis.affectedStaffCount} | All-Time Duplicated Task Rows: ${allTimeAudit.kpis.totalDuplicatedRows} (e.g. 3 Repetitions = 3 Rows) | Duplicated Statements: ${allTimeAudit.kpis.totalDuplicatedStatements}`,
  ]);
  detailSheet.addRow([]);

  detailSheet.getRow(1).font = { name: "Arial", size: 15, bold: true, color: { argb: "881337" } };
  detailSheet.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };
  detailSheet.getRow(3).font = { name: "Arial", size: 9, italic: true, color: { argb: "64748B" } };

  const dHeaders = [
    "Sr.",
    "Employee Name (Doer)",
    "Role / Category",
    "Work Location",
    "Department",
    "Group Name",
    "Company Name (Client)",
    "Repeated Task Occurrence",
    "How Many Times Repeated",
    "Date",
    "Month & Year",
    "Time Given",
    "Period",
    "Repeated Task Description Logged",
    "Group ID",
    "Duplicacy Classification",
    "Audit Risk Level",
  ];
  const dHeaderRow = detailSheet.addRow(dHeaders);
  dHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  dHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "881337" } }; // Dark Wine Red
  dHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  dHeaderRow.height = 28;

  const rowsToRender =
    allTimeAudit.employeeGroupedRows && allTimeAudit.employeeGroupedRows.length > 0
      ? allTimeAudit.employeeGroupedRows
      : allTimeAudit.allDuplicatedRows;

  if (rowsToRender.length === 0) {
    const emptyRow = detailSheet.addRow([
      1,
      "-",
      "-",
      "-",
      "-",
      "-",
      "-",
      "-",
      0,
      "-",
      "-",
      "-",
      "-",
      "No duplicate task descriptions detected under the 6-field equality rule.",
      "-",
      "CLEAN",
      "CLEAN",
    ]);
    emptyRow.font = { name: "Arial", size: 10, italic: true };
  } else {
    let currentEmployee = "";
    let isEvenEmployee = false;

    rowsToRender.forEach((rowObj, idx) => {
      if (rowObj.doer !== currentEmployee) {
        currentEmployee = rowObj.doer;
        isEvenEmployee = !isEvenEmployee;
      }

      const myInfo = getMonthYearInfo(rowObj.date);
      const monthLabel = myInfo ? myInfo.label : "-";

      const row = detailSheet.addRow([
        idx + 1,
        rowObj.doer,
        rowObj.category,
        rowObj.location,
        rowObj.department,
        rowObj.groupName,
        rowObj.company,
        rowObj.occurrenceText,
        `${rowObj.totalRepetitions} Times Repeated`,
        rowObj.date,
        monthLabel,
        rowObj.timeGiven,
        rowObj.period,
        rowObj.taskDescription,
        rowObj.groupId,
        rowObj.duplicacyType,
        rowObj.risk,
      ]);

      row.font = { name: "Arial", size: 10 };
      row.alignment = { vertical: "middle" };

      // Apply soft alternating background by Employee
      const rowFillColor = isEvenEmployee ? "FFF1F2" : "FFFFFF"; // Soft Rose vs White
      for (let col = 1; col <= dHeaders.length; col++) {
        if (col !== 17) {
          row.getCell(col).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowFillColor },
          };
        }
      }

      // Risk cell styling
      const riskCell = row.getCell(17);
      if (rowObj.risk === "HIGH") {
        riskCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } };
        riskCell.font = { bold: true, color: { argb: "991B1B" } };
      } else if (rowObj.risk === "MEDIUM") {
        riskCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
        riskCell.font = { bold: true, color: { argb: "92400E" } };
      } else {
        riskCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DCFCE7" } };
        riskCell.font = { color: { argb: "166534" } };
      }

      // If it's the last occurrence of the task group, add a distinct bottom border
      if (rowObj.occurrenceIndex === rowObj.totalRepetitions) {
        for (let col = 1; col <= dHeaders.length; col++) {
          row.getCell(col).border = {
            bottom: { style: "medium", color: { argb: "BE123C" } },
          };
        }
      }
    });
  }

  detailSheet.columns = [
    { width: 8 },  // 1: Sr.
    { width: 26 }, // 2: Employee Name (Doer)
    { width: 18 }, // 3: Role / Category
    { width: 20 }, // 4: Work Location
    { width: 20 }, // 5: Department
    { width: 25 }, // 6: Group Name
    { width: 28 }, // 7: Company Name (Client)
    { width: 24 }, // 8: Repeated Task Occurrence
    { width: 24 }, // 9: How Many Times Repeated
    { width: 14 }, // 10: Date
    { width: 18 }, // 11: Month & Year
    { width: 12 }, // 12: Time Given
    { width: 16 }, // 13: Period
    { width: 55 }, // 14: Repeated Task Description Logged
    { width: 14 }, // 15: Group ID
    { width: 32 }, // 16: Duplicacy Classification
    { width: 16 }, // 17: Audit Risk Level
  ];

  // ==========================================================
  // SHEET 4: EMPLOYEES WITH DUPLICACY REGISTER
  // ==========================================================
  const empSheet = workbook.addWorksheet("Staff Repetitions Register", {
    views: [{ showGridLines: true }],
  });

  empSheet.addRow(["AGRAWAL JAIN & CO."]);
  empSheet.addRow(["EMPLOYEES INVOLVED IN WORK DUPLICACY & TASK REPETITIONS"]);
  empSheet.addRow([`Report Date: ${todayStr} | Total Staff Members with Duplicacy: ${allTimeAudit.employeeSummary.length}`]);
  empSheet.addRow([]);

  empSheet.getRow(1).font = { name: "Arial", size: 15, bold: true, color: { argb: "991B1B" } };
  empSheet.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const empHeaders = [
    "Sr.",
    "Employee Name (Doer)",
    "Role / Category",
    "Work Location",
    "Department",
    "Group Name",
    "Company Name (Client)",
    "Repeated Task Description",
    "How Many Times Repeated",
    "Total Duplicated Rows Logged",
    "Audit Risk Level",
    "Group ID",
  ];
  const empHeaderRow = empSheet.addRow(empHeaders);
  empHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  empHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "B91C1C" } };
  empHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  empHeaderRow.height = 28;

  let empSr = 1;
  allTimeAudit.employeeSummary.forEach((e) => {
    (e.duplicatedTasks || []).forEach((t) => {
      const row = empSheet.addRow([
        empSr++,
        e.name,
        e.category,
        t.location || "-",
        t.department || e.department,
        t.groupName || "-",
        t.company || "-",
        t.representativeTask,
        `${t.totalRepetitions} Times Repeated`,
        e.totalDuplicatedRows,
        e.risk,
        t.groupId,
      ]);

      row.font = { name: "Arial", size: 10 };
      row.alignment = { vertical: "middle" };

      const riskCell = row.getCell(11);
      if (e.risk === "HIGH") {
        riskCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } };
        riskCell.font = { bold: true, color: { argb: "991B1B" } };
      } else if (e.risk === "MEDIUM") {
        riskCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
        riskCell.font = { bold: true, color: { argb: "92400E" } };
      } else {
        riskCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DCFCE7" } };
        riskCell.font = { color: { argb: "166534" } };
      }
    });
  });

  empSheet.columns = [
    { width: 8 },  // Sr
    { width: 26 }, // Employee Name (Doer)
    { width: 18 }, // Role / Category
    { width: 20 }, // Work Location
    { width: 20 }, // Department
    { width: 25 }, // Group Name
    { width: 28 }, // Company Name (Client)
    { width: 50 }, // Repeated Task Description
    { width: 24 }, // How Many Times Repeated
    { width: 22 }, // Total Duplicated Rows Logged
    { width: 16 }, // Audit Risk Level
    { width: 14 }, // Group ID
  ];

  // ==========================================================
  // SHEET 5: DUPLICATED STATEMENTS SUMMARY
  // ==========================================================
  const statementSheet = workbook.addWorksheet("Statements Summary", {
    views: [{ showGridLines: true }],
  });

  statementSheet.addRow(["AGRAWAL JAIN & CO."]);
  statementSheet.addRow(["DUPLICATED TASK STATEMENTS (6-FIELD EQUALITY CRITERIA CLUSTERS)"]);
  statementSheet.addRow([
    `Report Date: ${todayStr} | Distinct Duplicated Statements: ${allTimeAudit.groups.length} | Total Repetitive Rows: ${allTimeAudit.allDuplicatedRows.length}`,
  ]);
  statementSheet.addRow([]);

  statementSheet.getRow(1).font = { name: "Arial", size: 15, bold: true, color: { argb: "991B1B" } };
  statementSheet.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const stHeaders = [
    "Group ID",
    "Employee Name (Doer)",
    "Work Location",
    "Department",
    "Group Name",
    "Company Name (Client)",
    "Repeated Task Description Statement",
    "Total Times Repeated (Rows)",
    "Duplicacy Classification",
    "Executive Audit Recommendation",
  ];
  const stHeaderRow = statementSheet.addRow(stHeaders);
  stHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  stHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "991B1B" } };
  stHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  stHeaderRow.height = 28;

  allTimeAudit.groups.forEach((g) => {
    statementSheet.addRow([
      g.groupId,
      g.doer,
      g.location,
      g.department,
      g.groupName,
      g.company,
      g.representativeTask,
      `${g.totalRepetitions} Times Repeated`,
      g.duplicacyType,
      "Advise employee to detail specific voucher serials, chapters, or ledger heads rather than identical recurring description",
    ]);
  });

  statementSheet.columns = [
    { width: 14 }, // Group ID
    { width: 26 }, // Employee Name (Doer)
    { width: 20 }, // Work Location
    { width: 20 }, // Department
    { width: 25 }, // Group Name
    { width: 28 }, // Company Name (Client)
    { width: 55 }, // Repeated Task Description Statement
    { width: 24 }, // Total Times Repeated (Rows)
    { width: 32 }, // Duplicacy Classification
    { width: 50 }, // Executive Audit Recommendation
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(
    blob,
    `AJC_Duplicacy_Audit_Report_${targetMonthLabel.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
};

/**
 * Export AI & Claude Usage in Daily Working
 */
export const exportAiUsageReportToExcel = async (workingLogs = [], profiles = []) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. - Executive ERP";
  workbook.created = new Date();

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const AI_PATTERNS = [
    { tool: "Claude (Anthropic)", regex: /\b(claude|anthropic|claude\s*3|claude\s*sonnet|claude\s*opus)\b/i },
    { tool: "ChatGPT / OpenAI", regex: /\b(chatgpt|gpt[\s-]*[34]|gpt4|gpt3|openai|gpt)\b/i },
    { tool: "Google Gemini", regex: /\b(gemini|google\s*gemini|bard)\b/i },
    { tool: "Microsoft Copilot", regex: /\b(copilot|github\s*copilot|ms\s*copilot)\b/i },
    { tool: "DeepSeek / Perplexity", regex: /\b(deepseek|perplexity)\b/i },
    { tool: "Prompting / LLM", regex: /\b(prompting|prompt\s*engineering|prompts?|llms?|large\s*language\s*model)\b/i },
    { tool: "Artificial Intelligence (General)", regex: /\b(artificial\s*intelligence|\bai\b|a\.i\.)\b/i },
  ];

  const matchedEntries = [];
  workingLogs.forEach((entry) => {
    const rawTask = (entry.taskDescription || "").trim();
    if (!rawTask) return;

    for (const pattern of AI_PATTERNS) {
      if (pattern.regex.test(rawTask)) {
        matchedEntries.push({
          entry,
          tool: pattern.tool,
          taskText: rawTask,
          doer: (entry.doerName || entry.employeeName || "Unknown").trim(),
          company: (entry.companyName || entry.groupName || "General").trim(),
          date: formatExcelOrStringDate(entry.date) || entry.date || "Unknown Date",
          timeGiven: entry.timeGiven || "N/A",
          department: entry.department || "General",
        });
        break;
      }
    }
  });

  // Sheet 1: Detailed AI Tasks
  const detailSheet = workbook.addWorksheet("AI & Claude Tasks Log", {
    views: [{ showGridLines: true }],
  });

  detailSheet.addRow(["AGRAWAL JAIN & CO."]);
  detailSheet.addRow(["EXECUTIVE AUDIT: USES OF AI & CLAUDE IN DAILY WORKING TASKS"]);
  detailSheet.addRow([`Report Date: ${todayStr} | Total AI Tasks Identified: ${matchedEntries.length}`]);
  detailSheet.addRow([]);

  detailSheet.getRow(1).font = { name: "Arial", size: 15, bold: true, color: { argb: "6D28D9" } }; // Purple
  detailSheet.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const dHeaders = [
    "Sr.",
    "Date",
    "Employee (Doer)",
    "Department",
    "Client / Company",
    "AI Tool Identified",
    "Task Description",
    "Time Given",
  ];
  const dHeaderRow = detailSheet.addRow(dHeaders);
  dHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  dHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "7C3AED" } };
  dHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  dHeaderRow.height = 28;

  if (matchedEntries.length === 0) {
    detailSheet.addRow([1, "-", "No AI Usage Detected", "-", "-", "-", "No staff members recorded AI / Claude keywords in daily working descriptions.", "-"]);
  } else {
    matchedEntries.forEach((m, idx) => {
      detailSheet.addRow([
        idx + 1,
        m.date,
        m.doer,
        m.department,
        m.company,
        m.tool,
        m.taskText,
        m.timeGiven,
      ]);
    });
  }

  detailSheet.columns = [
    { width: 8 },
    { width: 14 },
    { width: 26 },
    { width: 20 },
    { width: 28 },
    { width: 24 },
    { width: 60 },
    { width: 14 },
  ];

  // Sheet 2: Staff Summary
  const staffMap = new Map();
  matchedEntries.forEach((m) => {
    if (!staffMap.has(m.doer)) {
      staffMap.set(m.doer, { name: m.doer, department: m.department, count: 0, tools: new Set(), dates: [] });
    }
    const rec = staffMap.get(m.doer);
    rec.count += 1;
    rec.tools.add(m.tool);
    rec.dates.push(m.date);
  });

  const staffSheet = workbook.addWorksheet("Staff Using AI", {
    views: [{ showGridLines: true }],
  });

  staffSheet.addRow(["AGRAWAL JAIN & CO."]);
  staffSheet.addRow(["AI ADOPTION BY STAFF MEMBERS"]);
  staffSheet.addRow([`Report Date: ${todayStr} | Total Staff: ${staffMap.size}`]);
  staffSheet.addRow([]);

  staffSheet.getRow(1).font = { name: "Arial", size: 15, bold: true, color: { argb: "6D28D9" } };
  staffSheet.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const sHeaders = ["Sr.", "Staff Name", "Department", "AI Tasks Logged", "AI Tools Utilized", "Dates Active"];
  const sHeaderRow = staffSheet.addRow(sHeaders);
  sHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  sHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "8B5CF6" } };
  sHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  sHeaderRow.height = 28;

  Array.from(staffMap.values()).sort((a, b) => b.count - a.count).forEach((s, idx) => {
    staffSheet.addRow([
      idx + 1,
      s.name,
      s.department,
      s.count,
      Array.from(s.tools).join(", "),
      Array.from(new Set(s.dates)).slice(0, 5).join(", "),
    ]);
  });

  staffSheet.columns = [{ width: 8 }, { width: 28 }, { width: 22 }, { width: 18 }, { width: 35 }, { width: 35 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `AJC_AI_Claude_Usage_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * Export Defaulters (> 2 Days Not Filled) Categorized by Partners, Seniors, Articles, and Plant Staff
 */
export const exportDefaultersMoreThanTwoDaysToExcel = async (profiles = []) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. - Executive ERP";
  workbook.created = new Date();

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const partnersDefaulters = [];
  const seniorsDefaulters = [];
  const articlesDefaulters = [];
  const plantStaffDefaulters = [];
  const otherDefaulters = [];

  profiles.forEach((p) => {
    const missingCount = p.missingDates ? p.missingDates.length : 0;
    const isDefaulter = missingCount > 2 || (missingCount === 0 && p.totalEntries === 0);
    if (!isDefaulter && missingCount <= 2) return;

    const item = {
      name: p.rawName,
      department: p.department || "General",
      missingCount: missingCount > 0 ? missingCount : "Never Filled",
      missingDates: p.missingDates || [],
      lastUpdated: p.lastUpdatedDate || (p.latestEntry?.date ? formatExcelOrStringDate(p.latestEntry.date) : "No entries"),
      punchStatus: p.cardPresent ? "Present" : "Absent",
      punchIn: formatDisplayTime(p.punchIn),
      punchLocation: p.punchLocation || "Office",
      totalEntries: p.totalEntries || 0,
    };

    if (isPartner(p.rawName, p)) {
      partnersDefaulters.push({ ...item, category: "Partner" });
    } else if (isSenior(p.rawName, p)) {
      seniorsDefaulters.push({ ...item, category: "Senior" });
    } else if (isArticle(p.rawName, p)) {
      articlesDefaulters.push({ ...item, category: "Article" });
    } else if (isPlantStaff(p.rawName, p)) {
      plantStaffDefaulters.push({ ...item, category: "Plant Staff" });
    } else {
      otherDefaulters.push({ ...item, category: "Other Staff" });
    }
  });

  const sortByMissing = (a, b) => (Number(b.missingCount) || 999) - (Number(a.missingCount) || 999);
  partnersDefaulters.sort(sortByMissing);
  seniorsDefaulters.sort(sortByMissing);
  articlesDefaulters.sort(sortByMissing);
  plantStaffDefaulters.sort(sortByMissing);

  const allDefaulters = [
    ...partnersDefaulters,
    ...seniorsDefaulters,
    ...articlesDefaulters,
    ...plantStaffDefaulters,
    ...otherDefaulters,
  ];

  // Sheet 1: Master List
  const masterSheet = workbook.addWorksheet("All Defaulters (>2 Days)", {
    views: [{ showGridLines: true }],
  });

  masterSheet.addRow(["AGRAWAL JAIN & CO."]);
  masterSheet.addRow(["EXECUTIVE DEFAULTERS AUDIT: DAILY WORKING NOT FILLED > 2 DAYS"]);
  masterSheet.addRow([
    `Report Date: ${todayStr} | Total Defaulters: ${allDefaulters.length} | Partners: ${partnersDefaulters.length} | Seniors: ${seniorsDefaulters.length} | Articles: ${articlesDefaulters.length} | Plant: ${plantStaffDefaulters.length}`,
  ]);
  masterSheet.addRow([]);

  masterSheet.getRow(1).font = { name: "Arial", size: 15, bold: true, color: { argb: "DC2626" } };
  masterSheet.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const mHeaders = [
    "Sr.",
    "Role Tier",
    "Employee Name",
    "Department",
    "Missing Days Count",
    "Missing Dates Backlog",
    "Last Submitted Date",
    "Today Punch Attendance",
    "Punch In Time",
    "Punch Location",
  ];
  const mHeaderRow = masterSheet.addRow(mHeaders);
  mHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  mHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DC2626" } };
  mHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  mHeaderRow.height = 28;

  allDefaulters.forEach((p, idx) => {
    const row = masterSheet.addRow([
      idx + 1,
      p.category,
      p.name,
      p.department,
      p.missingCount,
      p.missingDates.join(", ") || "-",
      p.lastUpdated,
      p.punchStatus,
      p.punchIn,
      p.punchLocation,
    ]);
    row.font = { name: "Arial", size: 10 };
    row.alignment = { vertical: "middle" };
  });

  masterSheet.columns = [
    { width: 8 },
    { width: 16 },
    { width: 28 },
    { width: 20 },
    { width: 20 },
    { width: 45 },
    { width: 18 },
    { width: 22 },
    { width: 16 },
    { width: 18 },
  ];

  // Helper to add role-specific sheets
  const addCategorySheet = (sheetName, list, headerColor) => {
    const sheet = workbook.addWorksheet(sheetName, { views: [{ showGridLines: true }] });
    sheet.addRow(["AGRAWAL JAIN & CO."]);
    sheet.addRow([`${sheetName.toUpperCase()}: NOT FILLED DAILY WORKING > 2 DAYS`]);
    sheet.addRow([`Report Date: ${todayStr} | Total: ${list.length}`]);
    sheet.addRow([]);

    sheet.getRow(1).font = { name: "Arial", size: 14, bold: true, color: { argb: headerColor } };
    sheet.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

    const headers = ["Sr.", "Employee Name", "Department", "Missing Days", "Missing Dates List", "Last Update", "Punch Today"];
    const hRow = sheet.addRow(headers);
    hRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
    hRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColor } };
    hRow.height = 26;

    if (list.length === 0) {
      sheet.addRow([1, `All ${sheetName} are 100% compliant (Zero defaulters > 2 days)`, "-", 0, "No pending dates", "-", "Compliant"]);
    } else {
      list.forEach((p, idx) => {
        sheet.addRow([idx + 1, p.name, p.department, p.missingCount, p.missingDates.join(", "), p.lastUpdated, p.punchStatus]);
      });
    }

    sheet.columns = [{ width: 8 }, { width: 28 }, { width: 20 }, { width: 16 }, { width: 45 }, { width: 18 }, { width: 16 }];
  };

  addCategorySheet("Partners (>2 Days)", partnersDefaulters, "7C3AED"); // Purple
  addCategorySheet("Seniors (>2 Days)", seniorsDefaulters, "2563EB"); // Blue
  addCategorySheet("Articles (>2 Days)", articlesDefaulters, "059669"); // Green
  addCategorySheet("Plant Staff (>2 Days)", plantStaffDefaulters, "EA580C"); // Orange

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `AJC_Defaulters_More_Than_2_Days_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * -------------------------------------------------------------
 * AUDIT & EXPORT: EMPLOYEES WITH LESS THAN 9 HOURS IN DAILY WORKING
 * -------------------------------------------------------------
 * Evaluates staff submissions against the mandatory 9 Hours / Day (540 mins) requirement.
 * Aggregates daily tasks row-by-row and flags every day where logged hours < 9 hours.
 */

export function parseTimeToMinutes(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") {
    // If decimal number of hours (e.g. 8.5)
    return Math.round(val * 60);
  }
  const str = String(val).trim();
  if (!str) return 0;

  // "H:MM" or "HH:MM" or "H:MM:SS"
  const colonMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10) || 0;
    const mins = parseInt(colonMatch[2], 10) || 0;
    return hours * 60 + mins;
  }

  // "8.5 hrs" or "8 hrs 30 mins" or "8h 30m"
  const hrMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|h\b)/i);
  const minMatch = str.match(/(\d+)\s*(?:mins?|minutes?|m\b)/i);
  if (hrMatch || minMatch) {
    const h = hrMatch ? parseFloat(hrMatch[1]) : 0;
    const m = minMatch ? parseInt(minMatch[1], 10) : 0;
    return Math.round(h * 60) + m;
  }

  // Decimal number as string "8.5" or "8"
  const num = parseFloat(str);
  if (!isNaN(num)) {
    return Math.round(num * 60);
  }

  return 0;
}

export function formatMinutesToHours(minutes = 0) {
  const safeMins = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(safeMins / 60);
  const m = safeMins % 60;
  return `${h}h ${m > 0 ? `${m}m` : "0m"}`;
}

export function formatMinutesToTimeStr(minutes = 0) {
  const safeMins = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(safeMins / 60);
  const m = safeMins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Audit daily working logs for employees logging less than 9 hours in a day
 */
export const auditEmployeesLessThanNineHours = (workingLogs = [], profiles = [], targetMonthSpec = null) => {
  let resolvedMonth = null;
  if (typeof targetMonthSpec === "string") {
    if (/^\d{4}-\d{2}$/.test(targetMonthSpec.trim())) {
      const [y, m] = targetMonthSpec.trim().split("-").map(Number);
      resolvedMonth = {
        month: m,
        year: y,
        key: targetMonthSpec.trim(),
        label: `${MONTH_NAMES[m - 1]} ${y}`,
      };
    } else {
      resolvedMonth = parseTargetMonthFromQuery(targetMonthSpec);
    }
  } else if (targetMonthSpec && targetMonthSpec.month && targetMonthSpec.year) {
    resolvedMonth = targetMonthSpec;
  }

  const activeMonthSpec = resolvedMonth || {
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    key: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    label: getCurrentMonthLabel(),
  };

  const todayFormatted = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Group all logs by employee and formatted date
  const employeeDayMap = new Map();

  workingLogs.forEach((entry, idx) => {
    if (!entry) return;
    const doer = (entry.doerName || entry.employeeName || entry.name || "").trim();
    if (!doer) return;
    const cleanDoer = normalizeName(doer);
    if (!cleanDoer) return;

    const formattedDate = formatExcelOrStringDate(entry.date);
    if (!formattedDate) return;

    const key = `${cleanDoer}___${formattedDate}`;
    if (!employeeDayMap.has(key)) {
      const cat = getEmployeeCategoryInfo(doer, entry);
      employeeDayMap.set(key, {
        key,
        cleanDoer,
        rawName: doer,
        date: formattedDate,
        rawDate: entry.date,
        department: entry.department || cat.label || "General",
        category: cat,
        categoryRole: cat.shortLabel || cat.label || "Staff",
        totalMinutes: 0,
        tasks: [],
        originalIndexes: [],
      });
    }

    const rec = employeeDayMap.get(key);
    const mins = parseTimeToMinutes(entry.timeGiven);
    rec.totalMinutes += mins;
    rec.originalIndexes.push(idx);
    rec.tasks.push({
      company: entry.companyName || entry.groupName || "General",
      group: entry.groupName || "",
      department: entry.department || "",
      location: entry.location || "Office",
      task: entry.taskDescription || "",
      timeGiven: entry.timeGiven || "00:00",
      minutes: mins,
    });
  });

  const REQUIRED_MINUTES = 9 * 60; // 540 mins (9 Hours)

  const allDaysList = Array.from(employeeDayMap.values()).map((rec) => {
    const isUnder9Hours = rec.totalMinutes < REQUIRED_MINUTES;
    const shortfallMinutes = Math.max(0, REQUIRED_MINUTES - rec.totalMinutes);
    const inTargetMonth = isEntryInMonth({ date: rec.date }, activeMonthSpec.month, activeMonthSpec.year);
    const isToday = rec.date === todayFormatted;

    return {
      ...rec,
      isUnder9Hours,
      requiredMinutes: REQUIRED_MINUTES,
      requiredHoursStr: "09:00",
      loggedHoursStr: formatMinutesToTimeStr(rec.totalMinutes),
      loggedDurationText: formatMinutesToHours(rec.totalMinutes),
      loggedHoursDecimal: (rec.totalMinutes / 60).toFixed(2),
      shortfallMinutes,
      shortfallHoursStr: formatMinutesToTimeStr(shortfallMinutes),
      shortfallDurationText: formatMinutesToHours(shortfallMinutes),
      shortfallHoursDecimal: (shortfallMinutes / 60).toFixed(2),
      tasksCount: rec.tasks.length,
      inTargetMonth,
      isToday,
      taskSummaryText: rec.tasks
        .map((t) => `${t.company} (${t.timeGiven}): ${t.task.slice(0, 45)}`)
        .join(" | "),
    };
  });

  // Shortfall days (Under 9 hours)
  const shortfallDays = allDaysList.filter((d) => d.isUnder9Hours);

  // Sort newest dates first
  shortfallDays.sort((a, b) => {
    const parseD = (str) => {
      if (!str) return 0;
      const [d, m, y] = str.split("/").map(Number);
      return new Date(y, m - 1, d).getTime();
    };
    return parseD(b.date) - parseD(a.date);
  });

  // Target month filtered shortfall days
  const targetMonthShortfallDays = shortfallDays.filter((d) => d.inTargetMonth);

  // Group by Staff
  const staffShortfallMap = new Map();
  shortfallDays.forEach((d) => {
    if (!staffShortfallMap.has(d.cleanDoer)) {
      staffShortfallMap.set(d.cleanDoer, {
        cleanDoer: d.cleanDoer,
        name: d.rawName,
        department: d.department,
        category: d.category,
        categoryRole: d.categoryRole,
        shortfallDaysCount: 0,
        targetMonthShortfallCount: 0,
        totalLoggedMinutes: 0,
        totalShortfallMinutes: 0,
        minLoggedMinutes: 99999,
        days: [],
      });
    }
    const staff = staffShortfallMap.get(d.cleanDoer);
    staff.shortfallDaysCount += 1;
    if (d.inTargetMonth) staff.targetMonthShortfallCount += 1;
    staff.totalLoggedMinutes += d.totalMinutes;
    staff.totalShortfallMinutes += d.shortfallMinutes;
    if (d.totalMinutes < staff.minLoggedMinutes) staff.minLoggedMinutes = d.totalMinutes;
    staff.days.push(d);
  });

  const staffSummary = Array.from(staffShortfallMap.values()).map((s) => ({
    ...s,
    avgLoggedMinutes: Math.round(s.totalLoggedMinutes / (s.shortfallDaysCount || 1)),
    avgLoggedHoursStr: formatMinutesToTimeStr(Math.round(s.totalLoggedMinutes / (s.shortfallDaysCount || 1))),
    avgLoggedDuration: formatMinutesToHours(Math.round(s.totalLoggedMinutes / (s.shortfallDaysCount || 1))),
    totalShortfallHoursStr: formatMinutesToTimeStr(s.totalShortfallMinutes),
    totalShortfallDuration: formatMinutesToHours(s.totalShortfallMinutes),
    minLoggedHoursStr: formatMinutesToTimeStr(s.minLoggedMinutes === 99999 ? 0 : s.minLoggedMinutes),
  }));

  staffSummary.sort((a, b) => b.shortfallDaysCount - a.shortfallDaysCount);

  // Today's live punch check vs daily working
  const todayShortfallList = [];
  profiles.forEach((p) => {
    const todayEntries = p.workingEntries ? p.workingEntries.filter((e) => e.isToday) : [];
    let todayMinutes = 0;
    todayEntries.forEach((e) => {
      todayMinutes += parseTimeToMinutes(e.timeGiven);
    });

    if (p.cardPresent || todayEntries.length > 0) {
      if (todayMinutes < REQUIRED_MINUTES) {
        todayShortfallList.push({
          rawName: p.rawName,
          cleanDoer: p.id,
          department: p.department,
          category: p.category,
          categoryRole: p.category?.shortLabel || p.category?.label || "Staff",
          cardPresent: p.cardPresent,
          punchIn: p.punchIn || "-",
          punchStatus: p.punchStatus || "Absent",
          todayMinutes,
          loggedHoursStr: formatMinutesToTimeStr(todayMinutes),
          loggedDuration: formatMinutesToHours(todayMinutes),
          shortfallMinutes: REQUIRED_MINUTES - todayMinutes,
          shortfallHoursStr: formatMinutesToTimeStr(REQUIRED_MINUTES - todayMinutes),
          shortfallDuration: formatMinutesToHours(REQUIRED_MINUTES - todayMinutes),
          tasksCount: todayEntries.length,
          status: todayEntries.length === 0 ? "Work Pending" : "Logged < 9 Hours",
        });
      }
    }
  });

  // Metrics
  const totalShortfallMinutes = shortfallDays.reduce((acc, d) => acc + d.shortfallMinutes, 0);
  const targetShortfallMinutes = targetMonthShortfallDays.reduce((acc, d) => acc + d.shortfallMinutes, 0);

  const partnersCount = shortfallDays.filter((d) => isPartner(d.rawName, d)).length;
  const seniorsCount = shortfallDays.filter((d) => isSenior(d.rawName, d)).length;
  const articlesCount = shortfallDays.filter((d) => isArticle(d.rawName, d)).length;
  const plantStaffCount = shortfallDays.filter((d) => isPlantStaff(d.rawName, d)).length;
  const backOfficeCount = shortfallDays.length - (partnersCount + seniorsCount + articlesCount + plantStaffCount);

  return {
    activeMonthSpec,
    kpis: {
      totalEmployeeDays: allDaysList.length,
      totalShortfallDays: shortfallDays.length,
      targetMonthShortfallDays: targetMonthShortfallDays.length,
      affectedEmployeesCount: staffSummary.length,
      targetMonthAffectedStaff: staffSummary.filter((s) => s.targetMonthShortfallCount > 0).length,
      totalShortfallMinutes,
      totalShortfallHours: (totalShortfallMinutes / 60).toFixed(1),
      targetMonthShortfallHours: (targetShortfallMinutes / 60).toFixed(1),
      todayShortfallCount: todayShortfallList.length,
      roleCounts: {
        partners: partnersCount,
        seniors: seniorsCount,
        articles: articlesCount,
        plantStaff: plantStaffCount,
        backOffice: Math.max(0, backOfficeCount),
      },
    },
    shortfallDays,
    targetMonthShortfallDays,
    staffSummary,
    todayShortfallList,
  };
};

/**
 * Export Employees with Less Than 9 Hours in Daily Working to Excel (.xlsx)
 */
export const exportLessThanNineHoursReportToExcel = async (workingLogs = [], profiles = [], targetMonthSpec = null) => {
  const audit = auditEmployeesLessThanNineHours(workingLogs, profiles, targetMonthSpec);
  const targetMonthLabel = audit.activeMonthSpec.label || "Current Month";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. - Executive ERP";
  workbook.created = new Date();

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // -------------------------------------------------------------
  // SHEET 1: TARGET MONTH SHORTFALL LOG (< 9 HOURS IN A DAY)
  // -------------------------------------------------------------
  const sheet1Name = `${targetMonthLabel.slice(0, 20)} (< 9 Hrs)`;
  const sheet1 = workbook.addWorksheet(sheet1Name, { views: [{ showGridLines: true }] });

  sheet1.addRow(["AGRAWAL JAIN & CO."]);
  sheet1.addRow([`EXECUTIVE AUDIT: EMPLOYEES LOGGED LESS THAN 9 HOURS IN A DAY (${targetMonthLabel.toUpperCase()})`]);
  sheet1.addRow([
    `Report Date: ${todayStr} | Audit Standard: Mandatory 9 Hours / Day (09:00) | Shortfall Days in Month: ${audit.kpis.targetMonthShortfallDays} | Total Deficit: ${audit.kpis.targetMonthShortfallHours} Hours`,
  ]);
  sheet1.addRow([]);

  sheet1.getRow(1).font = { name: "Arial", size: 15, bold: true, color: { argb: "991B1B" } }; // Deep Red
  sheet1.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const s1Headers = [
    "Sr.",
    "Date",
    "Employee Name (Doer)",
    "Role",
    "Department",
    "Logged Time (HH:MM)",
    "Logged Hours",
    "Mandatory Hours",
    "Shortfall / Deficit",
    "Tasks Count",
    "Status",
    "Client & Task Descriptions Summary",
  ];
  const s1HeaderRow = sheet1.addRow(s1Headers);
  s1HeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  s1HeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "B91C1C" } }; // Crimson
  s1HeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  s1HeaderRow.height = 28;

  const monthRows = audit.targetMonthShortfallDays.length > 0 ? audit.targetMonthShortfallDays : audit.shortfallDays.slice(0, 500);

  if (monthRows.length === 0) {
    sheet1.addRow([1, "-", "All staff met 9-hour requirement", "-", "-", "09:00", "9.0 hrs", "09:00", "0h 0m", 0, "100% Compliant", "No daily working shortfall found."]);
  } else {
    monthRows.forEach((r, idx) => {
      const dataRow = sheet1.addRow([
        idx + 1,
        r.date,
        r.rawName,
        r.categoryRole,
        r.department,
        r.loggedHoursStr,
        `${r.loggedHoursDecimal} hrs`,
        r.requiredHoursStr,
        r.shortfallDurationText,
        r.tasksCount,
        "Less than 9 Hours",
        r.taskSummaryText,
      ]);
      dataRow.alignment = { vertical: "middle" };
      dataRow.getCell(1).alignment = { horizontal: "center" };
      dataRow.getCell(2).alignment = { horizontal: "center" };
      dataRow.getCell(6).alignment = { horizontal: "center" };
      dataRow.getCell(7).alignment = { horizontal: "center" };
      dataRow.getCell(8).alignment = { horizontal: "center" };
      dataRow.getCell(9).alignment = { horizontal: "center" };
      dataRow.getCell(10).alignment = { horizontal: "center" };
      dataRow.getCell(11).alignment = { horizontal: "center" };

      // Highlight shortfall in soft red
      dataRow.getCell(9).font = { bold: true, color: { argb: "DC2626" } };
      if (idx % 2 === 1) {
        dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5" } };
      }
    });
  }

  sheet1.columns = [
    { width: 8 },
    { width: 14 },
    { width: 28 },
    { width: 18 },
    { width: 22 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
    { width: 14 },
    { width: 20 },
    { width: 60 },
  ];

  // -------------------------------------------------------------
  // SHEET 2: STAFF SHORTFALL SUMMARY
  // -------------------------------------------------------------
  const sheet2 = workbook.addWorksheet("Staff Shortfall Summary", { views: [{ showGridLines: true }] });
  sheet2.addRow(["AGRAWAL JAIN & CO."]);
  sheet2.addRow(["STAFF COMPLIANCE REGISTER: DAYS WITH LESS THAN 9 HOURS IN DAILY WORKING"]);
  sheet2.addRow([`Report Date: ${todayStr} | Total Staff with < 9 Hours: ${audit.staffSummary.length}`]);
  sheet2.addRow([]);

  sheet2.getRow(1).font = { name: "Arial", size: 14, bold: true, color: { argb: "1E3A8A" } };
  sheet2.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const s2Headers = [
    "Sr.",
    "Employee Name",
    "Role",
    "Department",
    "Total Shortfall Days (< 9 Hrs)",
    `Shortfall Days (${targetMonthLabel})`,
    "Average Logged Time on Shortfall Days",
    "Lowest Daily Hours Logged",
    "Cumulative Hours Deficit",
    "Audit Status",
  ];
  const s2HeaderRow = sheet2.addRow(s2Headers);
  s2HeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  s2HeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E3A8A" } };
  s2HeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  s2HeaderRow.height = 26;

  audit.staffSummary.forEach((s, idx) => {
    const row = sheet2.addRow([
      idx + 1,
      s.name,
      s.categoryRole,
      s.department,
      s.shortfallDaysCount,
      s.targetMonthShortfallCount,
      s.avgLoggedDuration,
      s.minLoggedHoursStr,
      s.totalShortfallDuration,
      s.shortfallDaysCount > 5 ? "Frequent Shortfall" : "Occasional Shortfall",
    ]);
    row.alignment = { vertical: "middle" };
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(5).alignment = { horizontal: "center" };
    row.getCell(6).alignment = { horizontal: "center" };
    row.getCell(7).alignment = { horizontal: "center" };
    row.getCell(8).alignment = { horizontal: "center" };
    row.getCell(9).alignment = { horizontal: "center" };
    row.getCell(10).alignment = { horizontal: "center" };

    if (s.shortfallDaysCount > 5) {
      row.getCell(10).font = { bold: true, color: { argb: "DC2626" } };
    }
    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
    }
  });

  sheet2.columns = [
    { width: 8 },
    { width: 28 },
    { width: 18 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
    { width: 24 },
    { width: 22 },
    { width: 22 },
    { width: 20 },
  ];

  // -------------------------------------------------------------
  // SHEET 3: TODAY'S LIVE ATTENDANCE VS LOGGED HOURS
  // -------------------------------------------------------------
  const sheet3 = workbook.addWorksheet("Today Punch vs Hours", { views: [{ showGridLines: true }] });
  sheet3.addRow(["AGRAWAL JAIN & CO."]);
  sheet3.addRow([`TODAY'S LIVE ATTENDANCE VS DAILY WORKING HOURS (${todayStr})`]);
  sheet3.addRow([`Total Staff with Under 9 Hours Today: ${audit.todayShortfallList.length}`]);
  sheet3.addRow([]);

  sheet3.getRow(1).font = { name: "Arial", size: 14, bold: true, color: { argb: "047857" } };
  sheet3.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const s3Headers = [
    "Sr.",
    "Employee Name",
    "Role",
    "Department",
    "Punch In Time",
    "Card Punch Status",
    "Today Logged Hours",
    "Shortfall from 9 Hours",
    "Tasks Submitted Today",
    "Daily Working Status",
  ];
  const s3HeaderRow = sheet3.addRow(s3Headers);
  s3HeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  s3HeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "047857" } };
  s3HeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  s3HeaderRow.height = 26;

  if (audit.todayShortfallList.length === 0) {
    sheet3.addRow([1, "All present staff have logged 9+ hours today", "-", "-", "-", "Present", "09:00+", "0h 0m", "-", "100% Compliant"]);
  } else {
    audit.todayShortfallList.forEach((t, idx) => {
      const row = sheet3.addRow([
        idx + 1,
        t.rawName,
        t.categoryRole,
        t.department,
        t.punchIn,
        t.punchStatus,
        t.loggedDuration,
        t.shortfallDuration,
        t.tasksCount,
        t.status,
      ]);
      row.alignment = { vertical: "middle" };
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(5).alignment = { horizontal: "center" };
      row.getCell(6).alignment = { horizontal: "center" };
      row.getCell(7).alignment = { horizontal: "center" };
      row.getCell(8).alignment = { horizontal: "center" };
      row.getCell(9).alignment = { horizontal: "center" };
      row.getCell(10).alignment = { horizontal: "center" };

      if (t.tasksCount === 0) {
        row.getCell(10).font = { bold: true, color: { argb: "DC2626" } };
      }
      if (idx % 2 === 1) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F0FDF4" } };
      }
    });
  }

  sheet3.columns = [
    { width: 8 },
    { width: 28 },
    { width: 18 },
    { width: 22 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 20 },
    { width: 18 },
    { width: 20 },
  ];

  // -------------------------------------------------------------
  // SHEET 4: ALL-TIME SHORTFALL REGISTER (UP TO 2000 ROWS)
  // -------------------------------------------------------------
  const sheet4 = workbook.addWorksheet("All-Time Shortfall Register", { views: [{ showGridLines: true }] });
  sheet4.addRow(["AGRAWAL JAIN & CO."]);
  sheet4.addRow(["EXECUTIVE AUDIT: ALL-TIME DAYS LOGGED LESS THAN 9 HOURS"]);
  sheet4.addRow([`Report Date: ${todayStr} | Total All-Time Shortfall Days: ${audit.shortfallDays.length}`]);
  sheet4.addRow([]);

  sheet4.getRow(1).font = { name: "Arial", size: 14, bold: true, color: { argb: "334155" } };
  sheet4.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const s4HeaderRow = sheet4.addRow(s1Headers);
  s4HeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  s4HeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "334155" } };
  s4HeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  s4HeaderRow.height = 26;

  audit.shortfallDays.slice(0, 2000).forEach((r, idx) => {
    const row = sheet4.addRow([
      idx + 1,
      r.date,
      r.rawName,
      r.categoryRole,
      r.department,
      r.loggedHoursStr,
      `${r.loggedHoursDecimal} hrs`,
      r.requiredHoursStr,
      r.shortfallDurationText,
      r.tasksCount,
      "Less than 9 Hours",
      r.taskSummaryText,
    ]);
    row.alignment = { vertical: "middle" };
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).alignment = { horizontal: "center" };
    row.getCell(6).alignment = { horizontal: "center" };
    row.getCell(7).alignment = { horizontal: "center" };
    row.getCell(8).alignment = { horizontal: "center" };
    row.getCell(9).alignment = { horizontal: "center" };
    row.getCell(10).alignment = { horizontal: "center" };
    row.getCell(11).alignment = { horizontal: "center" };

    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
    }
  });

  sheet4.columns = sheet1.columns;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(
    blob,
    `AJC_DailyWorking_LessThan9Hours_${audit.activeMonthSpec.key || "Report"}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
};

/**
 * -------------------------------------------------------------
 * AUDIT & EXPORT: SAME TASK ACROSS DIFFERENT EMPLOYEES
 * -------------------------------------------------------------
 * Condition:
 * 1. Work Location is the SAME
 * 2. Department is the SAME
 * 3. Group Name is the SAME
 * 4. Company Name is the SAME
 * 5. Task Description is the SAME
 * BUT 6. Different Employee Name (>= 2 distinct doers)
 */
export const auditCrossEmployeeDuplicateTasks = (workingLogs = [], profiles = [], targetMonthSpec = null) => {
  let resolvedMonth = null;
  if (typeof targetMonthSpec === "string") {
    if (/^\d{4}-\d{2}$/.test(targetMonthSpec.trim())) {
      const [y, m] = targetMonthSpec.trim().split("-").map(Number);
      resolvedMonth = {
        month: m,
        year: y,
        key: targetMonthSpec.trim(),
        label: `${MONTH_NAMES[m - 1]} ${y}`,
      };
    } else {
      resolvedMonth = parseTargetMonthFromQuery(targetMonthSpec);
    }
  } else if (targetMonthSpec && targetMonthSpec.month && targetMonthSpec.year) {
    resolvedMonth = targetMonthSpec;
  }

  const activeMonthSpec = resolvedMonth || {
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    key: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    label: getCurrentMonthLabel(),
  };

  const normalizeAbbreviations = (text = "") =>
    (text || "")
      .replace(/\bu\/s\b|\bu\.s\b/gi, "section")
      .replace(/\ba\/c\b|\ba\.c\b/gi, "account")
      .replace(/\bpvt\.?\b/gi, "private")
      .replace(/\bltd\.?\b/gi, "limited")
      .replace(/\bw\.?r\.?t\.?\b/gi, "with respect to")
      .replace(/\bw\/o\b/gi, "without");

  const STOP_WORDS = new Set([
    "of", "the", "and", "for", "in", "to", "with", "on", "at", "by", "a", "an",
    "is", "was", "were", "are", "from", "as", "per", "under", "etc", "done",
    "doing", "did", "work", "working", "worked", "task", "tasks", "entry",
    "entries", "daily", "day", "days"
  ]);

  const STEM_MAP = [
    [/vouching|vouched|vouchers/gi, "voucher"],
    [/checking|checked/gi, "check"],
    [/filing|filed/gi, "file"],
    [/reconciling|reconciled|reconciliation/gi, "reconcil"],
    [/preparing|prepared|preparation/gi, "prepar"],
    [/auditing|audited/gi, "audit"],
    [/reviewing|reviewed/gi, "review"],
    [/meeting|met/gi, "meet"],
    [/calculating|calculated|computation/gi, "comput"],
    [/verifying|verified|verification/gi, "verif"],
    [/updating|updated/gi, "updat"],
    [/filling|filled/gi, "fill"],
    [/submitting|submitted/gi, "submit"],
    [/analyzing|analyzed|analysis/gi, "analys"],
  ];

  const getTokens = (text = "") => {
    const clean = normalizeAbbreviations(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return [];

    return clean
      .split(" ")
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
      .map((w) => {
        for (const [re, rep] of STEM_MAP) {
          if (re.test(w)) return rep;
        }
        return w;
      });
  };

  const getSemanticSignature = (tokens = []) => {
    if (!tokens || tokens.length === 0) return "";
    return Array.from(new Set(tokens)).sort().join(" ");
  };

  const norm = (s = "") =>
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const clusterMap = new Map();

  workingLogs.forEach((entry, originalIndex) => {
    const rawTask = (entry.taskDescription || entry.task || "").trim();
    if (!rawTask || rawTask.length < 3) return;

    const doer = (entry.doerName || entry.employeeName || entry.name || "Unknown").trim();
    if (!doer) return;

    const location = (entry.location || entry.workLocation || "Office").trim();
    const dept = (entry.department || entry.dept || "General").trim();
    const groupName = (entry.groupName || entry.group || "General").trim();
    const company = (entry.companyName || entry.company || entry.client || "General").trim();

    const date = formatExcelOrStringDate(entry.date) || entry.date || "Unknown Date";
    const timeGiven = entry.timeGiven || "00:00";
    const period = entry.period || "General";

    const tokens = getTokens(rawTask);
    const taskSig = tokens.length > 0 ? getSemanticSignature(tokens) : rawTask.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();

    // 5-field condition key (DOER EXCLUDED)
    const locKey = norm(location) || "office";
    const deptKey = norm(dept) || "general";
    const groupKey = norm(groupName) || "general";
    const compKey = norm(company) || "general";

    const clusterKey = `${locKey}___${deptKey}___${groupKey}___${compKey}___${taskSig}`;

    const cat = getEmployeeCategoryInfo(doer, entry);
    const role = cat?.shortLabel || cat?.label || "Staff";

    const inTargetMonth = isEntryInMonth(entry, activeMonthSpec.month, activeMonthSpec.year);

    const lowerComp = company.toLowerCase();
    const lowerTask = rawTask.toLowerCase();
    const isLeaveOrHoliday =
      lowerComp.includes("sunday") ||
      lowerComp.includes("holiday") ||
      lowerComp.includes("leave") ||
      lowerTask === "sunday" ||
      lowerTask === "leave" ||
      lowerTask === "leave full day" ||
      lowerTask === "weekly off" ||
      lowerTask === "week off";

    const item = {
      originalIndex,
      entry,
      doer,
      cleanDoer: normalizeName(doer),
      role,
      category: cat,
      location,
      dept,
      groupName,
      company,
      date,
      timeGiven,
      period,
      rawTask,
      taskSig,
      clusterKey,
      inTargetMonth,
      isLeaveOrHoliday,
    };

    if (!clusterMap.has(clusterKey)) {
      clusterMap.set(clusterKey, {
        clusterKey,
        location,
        dept,
        groupName,
        company,
        representativeTask: rawTask,
        taskSig,
        isLeaveOrHoliday,
        items: [],
      });
    }

    const cluster = clusterMap.get(clusterKey);
    cluster.items.push(item);
    if (rawTask.length > cluster.representativeTask.length) {
      cluster.representativeTask = rawTask;
    }
    if (!item.isLeaveOrHoliday) {
      cluster.isLeaveOrHoliday = false;
    }
  });

  // Filter ONLY clusters that have >= 2 DISTINCT EMPLOYEES
  const crossClusters = Array.from(clusterMap.values())
    .map((cluster) => {
      const distinctEmployeesMap = new Map();
      cluster.items.forEach((it) => {
        if (!distinctEmployeesMap.has(it.cleanDoer)) {
          distinctEmployeesMap.set(it.cleanDoer, it.doer);
        }
      });
      const distinctEmployees = Array.from(distinctEmployeesMap.values());
      const distinctCount = distinctEmployees.length;

      return {
        ...cluster,
        distinctEmployees,
        distinctCount,
      };
    })
    .filter((cluster) => cluster.distinctCount >= 2)
    .sort((a, b) => b.items.length - a.items.length || b.distinctCount - a.distinctCount);

  // Row-by-row flat list with group metadata
  const allRows = [];
  const groups = [];
  const staffInvolvementMap = new Map();

  crossClusters.forEach((cluster, cIdx) => {
    const groupId = `XEMP-${String(cIdx + 1).padStart(3, "0")}`;
    const totalEntries = cluster.items.length;
    const employeesListStr = cluster.distinctEmployees.join(", ");

    const groupRows = [];

    cluster.items.forEach((item, itemIdx) => {
      const otherEmployees = cluster.distinctEmployees.filter((e) => normalizeName(e) !== item.cleanDoer);
      const otherEmployeesStr = otherEmployees.join(", ");

      const rowObj = {
        srNo: allRows.length + 1,
        groupId,
        occurrenceIndex: itemIdx + 1,
        occurrenceText: `${itemIdx + 1} of ${totalEntries}`,
        totalEntries,
        distinctCount: cluster.distinctCount,
        allEmployeesStr: employeesListStr,
        otherEmployeesStr,
        doer: item.doer,
        role: item.role,
        department: item.dept,
        location: item.location,
        groupName: item.groupName,
        company: item.company,
        date: item.date,
        timeGiven: item.timeGiven,
        period: item.period,
        taskDescription: item.rawTask,
        canonicalSig: item.taskSig,
        taskType: item.isLeaveOrHoliday ? "Leave / Off" : "Active Client Work",
        inTargetMonth: item.inTargetMonth,
        originalIndex: item.originalIndex,
      };

      groupRows.push(rowObj);
      allRows.push(rowObj);

      // Track staff involvement
      if (!staffInvolvementMap.has(item.cleanDoer)) {
        staffInvolvementMap.set(item.cleanDoer, {
          cleanDoer: item.cleanDoer,
          name: item.doer,
          role: item.role,
          department: item.dept,
          totalSharedEntries: 0,
          targetMonthSharedEntries: 0,
          clusterIds: new Set(),
          coWorkersMap: new Map(),
          companies: new Set(),
        });
      }
      const staff = staffInvolvementMap.get(item.cleanDoer);
      staff.totalSharedEntries += 1;
      if (item.inTargetMonth) staff.targetMonthSharedEntries += 1;
      staff.clusterIds.add(groupId);
      staff.companies.add(item.company);
      otherEmployees.forEach((co) => {
        staff.coWorkersMap.set(co, (staff.coWorkersMap.get(co) || 0) + 1);
      });
    });

    groups.push({
      groupId,
      clusterKey: cluster.clusterKey,
      location: cluster.location,
      department: cluster.dept,
      groupName: cluster.groupName,
      company: cluster.company,
      representativeTask: cluster.representativeTask,
      distinctCount: cluster.distinctCount,
      distinctEmployees: cluster.distinctEmployees,
      employeesListStr,
      totalEntries,
      isLeaveOrHoliday: cluster.isLeaveOrHoliday,
      hasTargetMonthEntries: cluster.items.some((i) => i.inTargetMonth),
      items: groupRows,
    });
  });

  const staffSummary = Array.from(staffInvolvementMap.values()).map((s) => {
    const topCoWorkers = Array.from(s.coWorkersMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${name} (${count})`)
      .join(", ");

    return {
      ...s,
      distinctClustersCount: s.clusterIds.size,
      distinctCompaniesCount: s.companies.size,
      topCoWorkers: topCoWorkers || "None",
      companiesList: Array.from(s.companies).slice(0, 5).join(", "),
    };
  });

  staffSummary.sort((a, b) => b.totalSharedEntries - a.totalSharedEntries);

  // Target month filtered rows & groups
  const targetMonthRows = allRows.filter((r) => r.inTargetMonth);
  const targetMonthGroups = groups.filter((g) => g.hasTargetMonthEntries);

  // Separate active work clusters from pure leaves/holidays
  const activeWorkClusters = crossClusters.filter((c) => !c.isLeaveOrHoliday);
  const activeWorkRows = allRows.filter((r) => r.taskType === "Active Client Work");

  const kpis = {
    totalClusters: crossClusters.length,
    activeWorkClustersCount: activeWorkClusters.length,
    targetMonthClusters: targetMonthGroups.length,
    totalSharedRows: allRows.length,
    activeWorkRowsCount: activeWorkRows.length,
    targetMonthSharedRows: targetMonthRows.length,
    staffInvolvedCount: staffSummary.length,
    targetMonthStaffInvolved: staffSummary.filter((s) => s.targetMonthSharedEntries > 0).length,
  };

  return {
    activeMonthSpec,
    kpis,
    allRows,
    targetMonthRows,
    groups,
    targetMonthGroups,
    staffSummary,
  };
};

/**
 * Export Same Task Across Different Employees to Excel (.xlsx)
 */
export const exportCrossEmployeeDuplicatesToExcel = async (workingLogs = [], profiles = [], targetMonthSpec = null) => {
  const audit = auditCrossEmployeeDuplicateTasks(workingLogs, profiles, targetMonthSpec);
  const targetMonthLabel = audit.activeMonthSpec.label || "Current Month";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. - Executive ERP";
  workbook.created = new Date();

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // -------------------------------------------------------------
  // SHEET 1: TARGET MONTH CROSS-EMPLOYEE TASKS (ROW-BY-ROW)
  // -------------------------------------------------------------
  const sheet1Name = `${targetMonthLabel.slice(0, 18)} Same Tasks`;
  const sheet1 = workbook.addWorksheet(sheet1Name, { views: [{ showGridLines: true }] });

  sheet1.addRow(["AGRAWAL JAIN & CO."]);
  sheet1.addRow([`EXECUTIVE AUDIT: SAME TASK ACROSS DIFFERENT EMPLOYEES (${targetMonthLabel.toUpperCase()})`]);
  sheet1.addRow([
    `Condition: Work Location, Department, Group Name, Company Name & Task Description are SAME | Different Employee Name | Clusters: ${audit.kpis.targetMonthClusters} | Shared Rows in Month: ${audit.kpis.targetMonthSharedRows}`,
  ]);
  sheet1.addRow([]);

  sheet1.getRow(1).font = { name: "Arial", size: 15, bold: true, color: { argb: "0F766E" } }; // Deep Teal
  sheet1.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const s1Headers = [
    "Sr.",
    "Cluster ID",
    "Date",
    "Employee (Doer)",
    "Role",
    "Department",
    "Work Location",
    "Group Name",
    "Client / Company Name",
    "Time Given",
    "Task Description",
    "Diff. Employees in Cluster",
    "Other Co-Employees Sharing Exact Task",
    "Task Type",
  ];
  const s1HeaderRow = sheet1.addRow(s1Headers);
  s1HeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  s1HeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F766E" } }; // Deep Teal
  s1HeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  s1HeaderRow.height = 28;

  const monthRows = audit.targetMonthRows.length > 0 ? audit.targetMonthRows : audit.allRows.slice(0, 500);

  if (monthRows.length === 0) {
    sheet1.addRow([1, "-", "-", "No cross-employee duplicate tasks found", "-", "-", "-", "-", "-", "-", "-", 0, "-", "100% Unique"]);
  } else {
    monthRows.forEach((r, idx) => {
      const dataRow = sheet1.addRow([
        idx + 1,
        r.groupId,
        r.date,
        r.doer,
        r.role,
        r.department,
        r.location,
        r.groupName,
        r.company,
        r.timeGiven,
        r.taskDescription,
        `${r.distinctCount} Employees`,
        r.otherEmployeesStr || "-",
        r.taskType,
      ]);
      dataRow.alignment = { vertical: "middle" };
      dataRow.getCell(1).alignment = { horizontal: "center" };
      dataRow.getCell(2).alignment = { horizontal: "center" };
      dataRow.getCell(3).alignment = { horizontal: "center" };
      dataRow.getCell(5).alignment = { horizontal: "center" };
      dataRow.getCell(10).alignment = { horizontal: "center" };
      dataRow.getCell(12).alignment = { horizontal: "center" };
      dataRow.getCell(14).alignment = { horizontal: "center" };

      dataRow.getCell(2).font = { bold: true, color: { argb: "0F766E" } };
      dataRow.getCell(4).font = { bold: true };

      if (idx % 2 === 1) {
        dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F0FDFA" } }; // Soft Teal
      }
    });
  }

  sheet1.columns = [
    { width: 8 },
    { width: 14 },
    { width: 14 },
    { width: 26 },
    { width: 16 },
    { width: 20 },
    { width: 20 },
    { width: 24 },
    { width: 28 },
    { width: 14 },
    { width: 55 },
    { width: 22 },
    { width: 40 },
    { width: 18 },
  ];

  // -------------------------------------------------------------
  // SHEET 2: CLUSTER SUMMARY (UNIQUE IDENTICAL TASKS)
  // -------------------------------------------------------------
  const sheet2 = workbook.addWorksheet("Task Clusters Summary", { views: [{ showGridLines: true }] });
  sheet2.addRow(["AGRAWAL JAIN & CO."]);
  sheet2.addRow(["CROSS-EMPLOYEE IDENTICAL TASK CLUSTERS SUMMARY"]);
  sheet2.addRow([`Report Date: ${todayStr} | Total Unique Shared Task Clusters: ${audit.groups.length}`]);
  sheet2.addRow([]);

  sheet2.getRow(1).font = { name: "Arial", size: 14, bold: true, color: { argb: "1E3A8A" } }; // Navy Blue
  sheet2.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const s2Headers = [
    "Sr.",
    "Cluster ID",
    "Client / Company Name",
    "Group Name",
    "Department",
    "Work Location",
    "Distinct Employees Count",
    "List of Different Employees Involved",
    "Total Repetitions",
    "Representative Task Description",
    "Task Type",
  ];
  const s2HeaderRow = sheet2.addRow(s2Headers);
  s2HeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  s2HeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E3A8A" } };
  s2HeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  s2HeaderRow.height = 26;

  audit.groups.forEach((g, idx) => {
    const row = sheet2.addRow([
      idx + 1,
      g.groupId,
      g.company,
      g.groupName,
      g.department,
      g.location,
      `${g.distinctCount} Employees`,
      g.employeesListStr,
      g.totalEntries,
      g.representativeTask,
      g.isLeaveOrHoliday ? "Leave / Off" : "Active Client Work",
    ]);
    row.alignment = { vertical: "middle" };
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).alignment = { horizontal: "center" };
    row.getCell(7).alignment = { horizontal: "center" };
    row.getCell(9).alignment = { horizontal: "center" };
    row.getCell(11).alignment = { horizontal: "center" };

    row.getCell(2).font = { bold: true, color: { argb: "1E3A8A" } };
    row.getCell(7).font = { bold: true };

    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
    }
  });

  sheet2.columns = [
    { width: 8 },
    { width: 14 },
    { width: 28 },
    { width: 24 },
    { width: 20 },
    { width: 20 },
    { width: 22 },
    { width: 45 },
    { width: 18 },
    { width: 55 },
    { width: 18 },
  ];

  // -------------------------------------------------------------
  // SHEET 3: STAFF INVOLVEMENT SUMMARY
  // -------------------------------------------------------------
  const sheet3 = workbook.addWorksheet("Staff Involvement Summary", { views: [{ showGridLines: true }] });
  sheet3.addRow(["AGRAWAL JAIN & CO."]);
  sheet3.addRow(["STAFF CROSS-TASK PARTICIPATION REGISTER"]);
  sheet3.addRow([`Report Date: ${todayStr} | Total Staff Members with Shared Tasks: ${audit.staffSummary.length}`]);
  sheet3.addRow([]);

  sheet3.getRow(1).font = { name: "Arial", size: 14, bold: true, color: { argb: "6D28D9" } }; // Purple
  sheet3.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const s3Headers = [
    "Sr.",
    "Employee Name",
    "Role",
    "Department",
    "Total Shared Task Entries",
    `Shared Entries (${targetMonthLabel})`,
    "Distinct Clusters Involved",
    "Frequent Co-Workers (Employees sharing same tasks)",
    "Top Companies / Clients Handled Together",
  ];
  const s3HeaderRow = sheet3.addRow(s3Headers);
  s3HeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  s3HeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "6D28D9" } };
  s3HeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  s3HeaderRow.height = 26;

  audit.staffSummary.forEach((s, idx) => {
    const row = sheet3.addRow([
      idx + 1,
      s.name,
      s.role,
      s.department,
      s.totalSharedEntries,
      s.targetMonthSharedEntries,
      s.distinctClustersCount,
      s.topCoWorkers,
      s.companiesList,
    ]);
    row.alignment = { vertical: "middle" };
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(5).alignment = { horizontal: "center" };
    row.getCell(6).alignment = { horizontal: "center" };
    row.getCell(7).alignment = { horizontal: "center" };

    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FAF5FF" } };
    }
  });

  sheet3.columns = [
    { width: 8 },
    { width: 28 },
    { width: 18 },
    { width: 20 },
    { width: 24 },
    { width: 24 },
    { width: 24 },
    { width: 45 },
    { width: 40 },
  ];

  // -------------------------------------------------------------
  // SHEET 4: ALL-TIME CROSS-EMPLOYEE REGISTER (UP TO 2000 ROWS)
  // -------------------------------------------------------------
  const sheet4 = workbook.addWorksheet("All-Time Cross-Employee Register", { views: [{ showGridLines: true }] });
  sheet4.addRow(["AGRAWAL JAIN & CO."]);
  sheet4.addRow(["EXECUTIVE AUDIT: ALL-TIME CROSS-EMPLOYEE SAME TASKS REGISTER"]);
  sheet4.addRow([`Report Date: ${todayStr} | Total All-Time Shared Rows: ${audit.allRows.length}`]);
  sheet4.addRow([]);

  sheet4.getRow(1).font = { name: "Arial", size: 14, bold: true, color: { argb: "334155" } };
  sheet4.getRow(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "1E293B" } };

  const s4HeaderRow = sheet4.addRow(s1Headers);
  s4HeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
  s4HeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "334155" } };
  s4HeaderRow.alignment = { vertical: "middle", horizontal: "center" };
  s4HeaderRow.height = 26;

  audit.allRows.slice(0, 2000).forEach((r, idx) => {
    const row = sheet4.addRow([
      idx + 1,
      r.groupId,
      r.date,
      r.doer,
      r.role,
      r.department,
      r.location,
      r.groupName,
      r.company,
      r.timeGiven,
      r.taskDescription,
      `${r.distinctCount} Employees`,
      r.otherEmployeesStr || "-",
      r.taskType,
    ]);
    row.alignment = { vertical: "middle" };
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).alignment = { horizontal: "center" };
    row.getCell(3).alignment = { horizontal: "center" };
    row.getCell(5).alignment = { horizontal: "center" };
    row.getCell(10).alignment = { horizontal: "center" };
    row.getCell(12).alignment = { horizontal: "center" };
    row.getCell(14).alignment = { horizontal: "center" };

    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
    }
  });

  sheet4.columns = sheet1.columns;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(
    blob,
    `AJC_Same_Task_Different_Employees_${audit.activeMonthSpec.key || "Report"}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
};

