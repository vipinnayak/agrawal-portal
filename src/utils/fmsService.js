// src/utils/fmsService.js
/**
 * Agrawal Jain & Co. — FMS (Flow Management System) Service
 * Dedicated service module solely for Flow Management System / Internal Audit FMS.
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { normalizeName } from "./attendanceConfig";
import {
  parseFmsTargetMonth,
  matchFmsRecordToMonth,
  groupFmsRecordsByPeriodAndMonth,
} from "./fmsMonthUtils";

// --- FMS DEFAULT API ENDPOINTS ---
export const FMS_API =
  "https://script.google.com/macros/s/AKfycbzLrYemM772sgYveZ-P9o1hhPlM4wUds5HxCVbRdFlyOu_cr_M5g_DDWRJfY6QncCxNWw/exec";

export const FMS_MASTER_API =
  "https://script.google.com/macros/s/AKfycbxpFa9JECyoDVSjtH7lfwNH7gAOxOUjr74vYb1n1dYG9YVsw7_veYlEPIz2ak-znDTH/exec";

export const FMS_DETAILS_API =
  "https://script.google.com/macros/s/AKfycby8qaKsz1-FNGJthiK42oPR1Pm7d_TZ33r3wZj4ONyCCvsOGAfczwQPpt6_s4yLVWHDgQ/exec";

export const FMS_FORM_SUBMIT_API =
  "https://script.google.com/macros/s/AKfycbyDHb4L61YI6F9tR_Urn1H5x6OW1R8kvSJgYt9oVZqfiWDOaglXZu2LaHQVMN7JEXzF/exec";

// Default FMS configuration object
export const DEFAULT_FMS_API_CONFIG = {
  fmsApi: FMS_API,
  masterApi: FMS_MASTER_API,
  detailsApi: FMS_DETAILS_API,
  formSubmitApi: FMS_FORM_SUBMIT_API,
};

// Aliases for Internal Audit nomenclature
export const INTERNAL_AUDIT_FMS_API = FMS_API;
export const INTERNAL_AUDIT_MASTER_API = FMS_MASTER_API;
export const INTERNAL_AUDIT_DETAILS_API = FMS_DETAILS_API;
export const INTERNAL_AUDIT_FORM_SUBMIT_API = FMS_FORM_SUBMIT_API;

// --- STORAGE KEYS FOR FMS (CONFIG OVERRIDES IF ANY) ---
const FMS_STORAGE_KEYS = {
  fmsApi: "ajc_fms_api_url",
  masterApi: "ajc_fms_master_api_url",
  detailsApi: "ajc_fms_details_api_url",
  formSubmitApi: "ajc_fms_form_submit_api_url",
};

export function getFmsApiConfig() {
  try {
    return {
      fmsApi: localStorage.getItem(FMS_STORAGE_KEYS.fmsApi) || DEFAULT_FMS_API_CONFIG.fmsApi,
      masterApi: localStorage.getItem(FMS_STORAGE_KEYS.masterApi) || DEFAULT_FMS_API_CONFIG.masterApi,
      detailsApi: localStorage.getItem(FMS_STORAGE_KEYS.detailsApi) || DEFAULT_FMS_API_CONFIG.detailsApi,
      formSubmitApi: localStorage.getItem(FMS_STORAGE_KEYS.formSubmitApi) || DEFAULT_FMS_API_CONFIG.formSubmitApi,
    };
  } catch {
    return { ...DEFAULT_FMS_API_CONFIG };
  }
}

// --- THE 17 OFFICIAL FMS PROCESS STEPS ---
export const FMS_17_STEPS = [
  {
    stepNo: 1,
    title: "STEP-1: Audit Scheduling & Planning",
    owner: "PARTNERS",
    method: "Expected Start & End Date Form",
    when: "Beginning Of Financial Year",
    description: "Annual scheduling of audit cycle, resource reservation, and initial start & completion target setting.",
    deliverable: "Annual Audit Calendar & Scope Definition",
  },
  {
    stepNo: 2,
    title: "STEP-2: Client Intimation & Requisition",
    owner: "SENIOR",
    method: "Phone Call / Mail / Whatsapp",
    when: "Before Audit",
    description: "Formal communication with client management and transmission of Preliminary Information Request (PIR) list.",
    deliverable: "Document Requisition & Data Checklist",
  },
  {
    stepNo: 3,
    title: "STEP-3: Team Allocation & Alignment",
    owner: "PARTNERS",
    method: "Online",
    when: "1 Week Before Audit",
    description: "Review of engagement readiness, team member allocation, and online briefing for the audit team.",
    deliverable: "Engagement Team Roster & Allocation Matrix",
  },
  {
    stepNo: 4,
    title: "STEP-4: Audit Programme & Risk Matrix",
    owner: "PARTNERS",
    method: "Audit Programme",
    when: "Planning Stage",
    description: "Formulation of customized risk-based audit programme, key process controls matrix, and sampling methodology.",
    deliverable: "Approved Audit Programme & Risk Register",
  },
  {
    stepNo: 5,
    title: "STEP-5: Pre-Audit Confirmation",
    owner: "SENIOR",
    method: "Email / Whatsapp",
    when: "1 Day Before Audit",
    description: "Final confirmation with the client coordinator regarding team arrival, logistics, and document readiness.",
    deliverable: "Pre-Audit Check & Logistics Confirmation",
  },
  {
    stepNo: 6,
    title: "STEP-6: Entry Conference with HODs",
    owner: "SENIOR",
    method: "Meet HODs",
    when: "Audit Start Day",
    description: "Formal kick-off meeting with auditee department heads to outline scope, timelines, and primary process touchpoints.",
    deliverable: "Entry Conference Minutes & Point of Contacts",
  },
  {
    stepNo: 7,
    title: "STEP-7: Fieldwork & Daily Review",
    owner: "SENIOR",
    method: "Daily Review",
    when: "Daily",
    description: "Execution of audit testing, transaction walkthroughs, daily observations recording, and internal query resolution.",
    deliverable: "Daily Working Sheets & Query Log",
  },
  {
    stepNo: 8,
    title: "STEP-8: Partner Weekly Review",
    owner: "PARTNERS",
    method: "Weekly Discussion",
    when: "Tuesday Review Meeting",
    description: "Weekly structured review by Engagement Partner during the firm's Tuesday Review Meeting to assess high-risk findings.",
    deliverable: "Weekly Review Memo & Critical Issue Escalation",
  },
  {
    stepNo: 9,
    title: "STEP-9: Draft Report Discussion",
    owner: "SENIOR",
    method: "Discuss Draft Report",
    when: "Before Final Report",
    description: "Detailed walk-through of draft audit observations with process owners to validate facts and root causes.",
    deliverable: "Draft Observation Sheet with Process Owner Comments",
  },
  {
    stepNo: 10,
    title: "STEP-10: HOD Responses & Action Plan",
    owner: "SENIOR",
    method: "Take HOD Responses",
    when: "Before Submission",
    description: "Receipt and incorporation of formal auditee department responses, Action Taken Plans (ATP), and implementation target dates.",
    deliverable: "Management Response Matrix (MRM)",
  },
  {
    stepNo: 11,
    title: "STEP-11: Exit Conference & Executive Summary",
    owner: "PARTNERS",
    method: "Physical Meeting",
    when: "Executive Summary",
    description: "Formal closing conference with executive leadership presenting the executive summary, key risk exposures, and recommendations.",
    deliverable: "Executive Summary Presentation & Exit Protocol",
  },
  {
    stepNo: 12,
    title: "STEP-12: Promoters / Owner Discussion",
    owner: "CRM",
    method: "Physical Meeting",
    when: "Owner Discussion",
    description: "High-level strategic briefing with business owners, MD, or promoters regarding governance and strategic observations.",
    deliverable: "Promoter Briefing Memo & CRM Relationship Feedback",
  },
  {
    stepNo: 13,
    title: "STEP-13: Audit Committee / Board Meeting",
    owner: "PARTNERS",
    method: "Board Meeting",
    when: "Final Discussion",
    description: "Formal presentation of statutory internal audit report before the Audit Committee or Board of Directors.",
    deliverable: "Audit Committee Pack & Board Resolution / Approval",
  },
  {
    stepNo: 14,
    title: "STEP-14: Final Signed Report Upload",
    owner: "SENIOR",
    method: "Executive Summary Upload",
    when: "After Completion",
    description: "Final sign-off, sealing, digital signature, and archiving of the complete audit report onto the portal / repository.",
    deliverable: "Final Signed & Numbered Internal Audit Report",
  },
  {
    stepNo: 15,
    title: "STEP-15: Benefit & Cost Savings Chart",
    owner: "SENIOR",
    method: "Benefit Chart Update",
    when: "Post Audit",
    description: "Quantification of audit value-addition, revenue leakage plugged, internal control cost savings, and operational efficiencies.",
    deliverable: "Audit Benefit Chart & Value Realization Report",
  },
  {
    stepNo: 16,
    title: "STEP-16: Billing, Invoicing & Collection",
    owner: "Accounts Department",
    method: "Billing & Receipt",
    when: "After Report",
    description: "Generation of professional fee invoice in alignment with agreed engagement letter terms and tracking payment receipt.",
    deliverable: "Tax Invoice, Ledger Debit Note & Receipt Voucher",
  },
  {
    stepNo: 17,
    title: "STEP-17: Cost Sheet & Engagement Closure",
    owner: "HR Head",
    method: "Cost Sheet",
    when: "Final Closure",
    description: "Post-audit profitability evaluation, audit team man-hours reconciliation, actual vs budgeted cost analysis, and assignment archive.",
    deliverable: "Engagement Profitability Cost Sheet & Formal Closure Note",
  },
  {
    stepNo: 18,
    title: "STEP-18: Client Feedback & Action Taken Report (ATR)",
    owner: "CRM / SENIOR",
    method: "Client Feedback Form / ATR Review",
    when: "Post Closure",
    description: "Collection of formal client feedback, satisfaction rating, and tracking implementation of Action Taken Report (ATR) recommendations.",
    deliverable: "Client Satisfaction Rating & ATR Implementation Memo",
  },
];

export const FMS_18_STEPS = FMS_17_STEPS;
export const FMS_STEPS = FMS_17_STEPS;

// --- IN-MEMORY CACHE FOR FMS ---
let cachedUnifiedFmsData = null;
let lastFmsFetchTimestamp = 0;
const CACHE_DURATION_MS = 60000;

export function invalidateFmsCache() {
  cachedUnifiedFmsData = null;
  lastFmsFetchTimestamp = 0;
}

/**
 * Fetch Master List of 89 Client Assignments from Google Apps Script API
 */
export async function fetchFmsMasterList() {
  const { masterApi } = getFmsApiConfig();
  try {
    const res = await fetch(masterApi);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.rows) ? data.rows : [];
  } catch (err) {
    console.warn("Error fetching FMS Master List:", err);
    return [];
  }
}

export const fetchInternalAuditMasterList = fetchFmsMasterList;

/**
 * Fetch Live FMS 17-step Tracking Data from Google Apps Script API
 */
export async function fetchFMSData() {
  const { fmsApi } = getFmsApiConfig();
  try {
    const res = await fetch(fmsApi);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("Error fetching FMS Tracking Data:", err);
    return [];
  }
}

export const fetchInternalAuditFMSData = fetchFMSData;

/**
 * Fetch Registered Audit Details from Google Apps Script API
 */
export async function fetchFmsDetailsList() {
  const { detailsApi } = getFmsApiConfig();
  try {
    const res = await fetch(detailsApi);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("Error fetching FMS Details:", err);
    return [];
  }
}

export const fetchInternalAuditDetailsList = fetchFmsDetailsList;

function parseStepsFromFmsRow(row) {
  return FMS_17_STEPS.map((step) => {
    const start = 10 + (step.stepNo - 1) * 4;
    const planned = String(row[start] || "").trim();
    const rawActual = String(row[start + 1] || "").trim();
    const rawStatus = String(row[start + 2] || "").trim();
    const actual = rawActual;
    const status = rawStatus || (actual ? "Completed" : planned ? "Planned" : "Pending");
    const delay = String(row[start + 3] || "").trim();
    return {
      ...step,
      planned,
      actual,
      status,
      rawActual,
      rawStatus,
      delay,
    };
  });
}

/**
 * Build unified, structured assignments combining Master List, FMS Steps, and Details
 */
export async function fetchUnifiedFmsData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedUnifiedFmsData && now - lastFmsFetchTimestamp < CACHE_DURATION_MS) {
    return cachedUnifiedFmsData;
  }

  try {
    const [masterRows, fmsRows, detailsRows] = await Promise.all([
      fetchFmsMasterList(),
      fetchFMSData(),
      fetchFmsDetailsList(),
    ]);

    const assignmentsMap = new Map();

    // 1. Ingest Master List (89 Rows)
    masterRows.forEach((r, idx) => {
      if (!r || !r[1]) return;
      const groupName = (r[0] || "General").trim();
      const companyName = (r[1] || "").trim();
      const dept = (r[2] || "").trim();
      const period = (r[3] || "General").trim();
      const partner = (r[4] || "Unassigned").trim();
      const senior = (r[5] || "Unassigned").trim();
      const assignmentType = (r[6] || "City").trim();

      const key = `${normalizeName(companyName)}__${period.toLowerCase()}`;
      assignmentsMap.set(key, {
        id: `IA-M-${idx + 1}`,
        groupName,
        companyName,
        department: dept,
        iaPeriod: period,
        partner,
        senior,
        assignmentType,
        startDate: "",
        targetDate: "",
        timestamp: "",
        steps: FMS_17_STEPS.map((s) => ({
          ...s,
          planned: "",
          actual: "",
          status: "Pending",
          rawActual: "",
          rawStatus: "",
          delay: "",
        })),
        isLiveFms: false,
        source: "Master",
      });
    });

    // 2. Ingest Live FMS Tracking Rows
    fmsRows.forEach((row, idx) => {
      if (!row || !row[3] || String(row[3]).trim() === "") return;
      const uiId = (row[0] || `IA-${idx + 1}`).trim();
      const timestamp = (row[1] || "").trim();
      const groupName = (row[2] || "").trim();
      const companyName = (row[3] || "").trim();
      const period = (row[4] || "Q3-Oct To Dec").trim();
      const partner = (row[5] || "").trim();
      const senior = (row[6] || "").trim();
      const assignmentType = (row[7] || "City").trim();
      const startDate = (row[8] || "").trim();
      const targetDate = (row[9] || "").trim();

      const key = `${normalizeName(companyName)}__${period.toLowerCase()}`;
      assignmentsMap.set(key, {
        id: uiId,
        groupName,
        companyName,
        department: "Internal Audit",
        iaPeriod: period,
        partner,
        senior,
        assignmentType,
        startDate,
        targetDate,
        timestamp,
        steps: parseStepsFromFmsRow(row),
        isLiveFms: true,
        source: "Live FMS",
      });
    });

    // 3. Ingest Registered Details
    detailsRows.forEach((r, idx) => {
      if (!r || !r[2]) return;
      const timestamp = (r[0] || "").trim();
      const groupName = (r[1] || "").trim();
      const companyName = (r[2] || "").trim();
      const period = (r[3] || "").trim();
      const partner = (r[4] || "").trim();
      const senior = (r[5] || "").trim();
      const assignmentType = (r[6] || "").trim();
      const startDate = (r[7] || "").trim();
      const targetDate = (r[8] || "").trim();

      const key = `${normalizeName(companyName)}__${(period || "general").toLowerCase()}`;
      if (assignmentsMap.has(key)) {
        const existing = assignmentsMap.get(key);
        if (startDate && !existing.startDate) existing.startDate = startDate;
        if (targetDate && !existing.targetDate) existing.targetDate = targetDate;
        if (timestamp && !existing.timestamp) existing.timestamp = timestamp;
      } else {
        assignmentsMap.set(key, {
          id: `IA-D-${idx + 1}`,
          groupName,
          companyName,
          department: "Internal Audit",
          iaPeriod: period,
          partner,
          senior,
          assignmentType,
          startDate,
          targetDate,
          timestamp,
          steps: FMS_17_STEPS.map((s) => ({
            ...s,
            planned: "",
            actual: "",
            status: "Pending",
            rawActual: "",
            rawStatus: "",
            delay: "",
          })),
          isLiveFms: false,
          source: "Details",
        });
      }
    });

    const unifiedList = Array.from(assignmentsMap.values());
    cachedUnifiedFmsData = unifiedList;
    lastFmsFetchTimestamp = now;
    return unifiedList;
  } catch (err) {
    console.error("Error building unified FMS data:", err);
    return cachedUnifiedFmsData || [];
  }
}

export const fetchUnifiedInternalAuditData = fetchUnifiedFmsData;

/**
 * Convert unified FMS record back to the 2D array structure expected by FMS Master Grid
 */
export function recordToFmsArrayRow(rec) {
  const base = [
    rec.id || "",
    rec.timestamp || "",
    rec.groupName || "",
    rec.companyName || "",
    rec.iaPeriod || "",
    rec.partner || "",
    rec.senior || "",
    rec.assignmentType || "",
    rec.startDate || "",
    rec.targetDate || "",
  ];
  const steps = rec.steps || [];
  steps.forEach((s) => {
    base.push(s.planned || "", s.rawActual || s.actual || "", s.rawStatus || s.status || "", s.delay || "");
  });
  return base;
}

// --- FMS ANALYTICS & CHATBOT SUMMARY GENERATORS ---

/**
 * Firm-Wide Executive Overview of FMS
 */
export function getFmsOverview(unifiedList = []) {
  if (!unifiedList || unifiedList.length === 0) {
    return "No FMS engagement records currently loaded.";
  }

  const total = unifiedList.length;
  const partnerMap = new Map();
  const seniorMap = new Map();
  const periodMap = new Map();
  const typeMap = new Map();
  const groupMap = new Map();

  unifiedList.forEach((item) => {
    if (item.partner && item.partner !== "Unassigned") {
      partnerMap.set(item.partner, (partnerMap.get(item.partner) || 0) + 1);
    }
    if (item.senior && item.senior !== "Unassigned") {
      seniorMap.set(item.senior, (seniorMap.get(item.senior) || 0) + 1);
    }
    if (item.iaPeriod) {
      periodMap.set(item.iaPeriod, (periodMap.get(item.iaPeriod) || 0) + 1);
    }
    if (item.assignmentType) {
      typeMap.set(item.assignmentType, (typeMap.get(item.assignmentType) || 0) + 1);
    }
    if (item.groupName) {
      groupMap.set(item.groupName, (groupMap.get(item.groupName) || 0) + 1);
    }
  });

  const cityCount = typeMap.get("City") || 0;
  const plantCount = typeMap.get("Plant") || 0;
  const otherCount = Math.max(0, total - cityCount - plantCount);

  let res = `📊 **Agrawal Jain & Co. — FMS Intelligence Overview**\n`;
  res += `• 🏢 **Total Engagements**: **${total} client assignments** across **${groupMap.size} corporate groups**\n`;
  res += `• 🏭 **Assignment Split**: **${cityCount} City** | **${plantCount} Plant** | **${otherCount} Other**\n`;
  res += `• 🔄 **Workflow System**: Structured **18-Step Flow Management System (FMS)**\n\n`;

  if (partnerMap.size > 0) {
    res += `━━━━━━━━━━━━━━━━━━━━\n`;
    res += `👔 **1. Partner In-Charge Distribution**:\n`;
    Array.from(partnerMap.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([partner, count]) => {
        res += `• **${partner}**: **${count} assignments**\n`;
      });
  }

  if (seniorMap.size > 0) {
    res += `\n👔 **2. Seniors & CA In-Charge (Top Leads)**:\n`;
    Array.from(seniorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .forEach(([senior, count]) => {
        res += `• **${senior}**: **${count} assignments**\n`;
      });
  }

  if (periodMap.size > 0) {
    res += `\n📅 **3. Audit Cycle & Period Breakdown**:\n`;
    Array.from(periodMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([p, count]) => {
        res += `• **${p}**: **${count} assignments**\n`;
      });
  }

  res += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  res += `[ACTION_CHIPS:Explain 18 steps of FMS|📋 18 FMS Steps;Blank actual and status report|🚨 Blank Steps Report;Target date blank report|📅 Target Date Blank;Download FMS Report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_INTERNAL_AUDIT_EXCEL]`;
  return res;
}

export const getInternalAuditOverview = getFmsOverview;

/**
 * Filter FMS Assignments Assigned to a specific Partner or Senior
 */
export function getPartnerOrSeniorFmsReport(unifiedList = [], nameQuery = "") {
  const cleanTarget = normalizeName(nameQuery);
  if (!cleanTarget) return null;

  const matched = unifiedList.filter((item) => {
    const cleanPartner = normalizeName(item.partner);
    const cleanSenior = normalizeName(item.senior);
    return (
      (cleanPartner && (cleanPartner.includes(cleanTarget) || cleanTarget.includes(cleanPartner))) ||
      (cleanSenior && (cleanSenior.includes(cleanTarget) || cleanTarget.includes(cleanSenior)))
    );
  });

  if (matched.length === 0) return null;

  const partnerItems = matched.filter((i) => {
    const p = normalizeName(i.partner);
    return p && (p.includes(cleanTarget) || cleanTarget.includes(p));
  });
  const seniorItems = matched.filter((i) => {
    const s = normalizeName(i.senior);
    return s && (s.includes(cleanTarget) || cleanTarget.includes(s));
  });
  const displayName = partnerItems.length > 0 ? partnerItems[0].partner : seniorItems[0].senior;

  let res = `📋 **FMS Engagements: ${displayName}**\n`;
  res += `• 📊 **Total Assigned FMS Items**: **${matched.length} assignments**\n`;
  if (partnerItems.length > 0) res += `• 👔 **Partner In-Charge**: ${partnerItems.length}\n`;
  if (seniorItems.length > 0) res += `• 👔 **Senior / Lead CA In-Charge**: ${seniorItems.length}\n`;
  res += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  matched.slice(0, 15).forEach((item, idx) => {
    const roleTag = partnerItems.includes(item) ? "Partner Incharge" : "Lead CA / Senior";
    res += `  ${idx + 1}. 🏢 **${item.companyName}** *(Group: ${item.groupName})*\n`;
    res += `     • 🗓️ Period: **${item.iaPeriod}** | 📍 Type: **${item.assignmentType}**\n`;
    res += `     • 👤 Role: *${roleTag}* (Co-lead: ${roleTag === "Partner Incharge" ? item.senior : item.partner})\n`;
    if (item.startDate || item.targetDate) {
      res += `     • 📅 Dates: Start: ${item.startDate || "-"} | Target: ${item.targetDate || "-"}\n`;
    }
  });

  if (matched.length > 15) {
    res += `\n*...and ${matched.length - 15} more assignments.*`;
  }

  res += `\n\n[ACTION_CHIPS:FMS status|📊 All FMS;Explain 17 steps of FMS|📋 17 FMS Steps;Download FMS Report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_INTERNAL_AUDIT_EXCEL]`;
  return res;
}

export const getPartnerOrSeniorAuditReport = getPartnerOrSeniorFmsReport;

/**
 * Filter FMS Assignments by Type (Plant vs City)
 */
export function getFmsByTypeReport(unifiedList = [], typeQuery = "Plant") {
  const isPlant = /plant/i.test(typeQuery);
  const targetType = isPlant ? "Plant" : "City";
  const matched = unifiedList.filter((item) => (item.assignmentType || "").toLowerCase() === targetType.toLowerCase());

  let res = `🏭 **${targetType} FMS Engagements** (${matched.length} Records)\n\n`;
  if (matched.length === 0) {
    res += `No **${targetType}** FMS records found in the current register.\n`;
  } else {
    matched.slice(0, 12).forEach((item, idx) => {
      res += `  ${idx + 1}. 🏢 **${item.companyName}** *(Group: ${item.groupName})*\n`;
      res += `     • 🗓️ Period: **${item.iaPeriod}** | 👔 Partner: ${item.partner} | Senior: ${item.senior}\n`;
    });
    if (matched.length > 12) {
      res += `\n*...and ${matched.length - 12} more ${targetType} engagements.*`;
    }
  }

  res += `\n\n[ACTION_CHIPS:FMS status|📊 All FMS;Blank actual and status report|🚨 Blank Status Report;Download FMS Report|📥 Download Excel]`;
  return res;
}

export const getAuditsByTypeReport = getFmsByTypeReport;

/**
 * Detailed 18-Step SOP Guide for FMS
 */
export function getFms18StepsGuideReport() {
  let res = `📋 **The Official 18-Step Flow Management System (FMS)**\n`;
  res += `*Agrawal Jain & Co. Standard Operating Procedure (SOP)*\n\n`;
  res += `━━━━━━━━━━━━━━━━━━━━\n`;

  FMS_18_STEPS.forEach((s) => {
    res += `**${s.title}**\n`;
    res += `• 👤 **Owner**: **${s.owner}** | ⏰ **Timeline**: *${s.when}*\n`;
    res += `• 🛠️ **Method**: *${s.method}*\n`;
    res += `• 📌 **Description**: ${s.description}\n`;
    res += `• 📑 **Deliverable**: ${s.deliverable}\n\n`;
  });

  res += `━━━━━━━━━━━━━━━━━━━━\n`;
  res += `💡 *Every cycle is tracked across these 18 milestones to monitor Planned vs Actual completion, status, and delays.*`;
  return res;
}

export const getFms17StepsGuideReport = getFms18StepsGuideReport;
export const get18StepsGuideReport = getFms18StepsGuideReport;
export const get17StepsGuideReport = getFms18StepsGuideReport;

/**
 * Search FMS Assignment by Company or Group Name
 */
export function getClientOrGroupFmsReport(unifiedList = [], clientQuery = "") {
  const cleanQ = normalizeName(clientQuery);
  if (!cleanQ) return null;

  const matched = unifiedList.filter((item) => {
    const cleanComp = normalizeName(item.companyName);
    const cleanGroup = normalizeName(item.groupName);
    return (cleanComp && cleanComp.includes(cleanQ)) || (cleanGroup && cleanGroup.includes(cleanQ));
  });

  if (matched.length === 0) return null;

  const first = matched[0];
  let res = `🏢 **FMS Assignment: ${first.companyName}**\n`;
  res += `• 🏷️ **Group Name**: **${first.groupName}**\n`;
  res += `• 🗓️ **Audit Period**: **${first.iaPeriod}**\n`;
  res += `• 📍 **Assignment Type**: **${first.assignmentType}**\n`;
  res += `• 👔 **Partner In-Charge**: **${first.partner}**\n`;
  res += `• 👔 **Lead CA / Senior**: **${first.senior}**\n`;
  if (first.startDate || first.targetDate) {
    res += `• 📅 **Schedule**: Start: **${first.startDate || "TBD"}** | Target: **${first.targetDate || "TBD"}**\n`;
  }

  res += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  res += `📊 **17-Step FMS Tracking Status**:\n`;
  const activeSteps = (first.steps || []).filter((s) => s.planned || s.actual || s.status !== "Pending");
  if (activeSteps.length > 0) {
    activeSteps.forEach((s) => {
      res += `• **${s.title}** [${s.owner}]: Status: **${s.status}** (Planned: ${s.planned || "-"}, Actual: ${s.actual || "-"}${s.delay ? `, Delay: ${s.delay}` : ""})\n`;
    });
  } else {
    res += `• 🚀 Initial setup recorded. 17 steps awaiting Actual & Status updates.\n`;
  }

  res += `\n[ACTION_CHIPS:Explain 17 steps of FMS|📋 17 FMS Steps;FMS status|📊 All FMS;Download FMS Report|📥 Download Excel]`;
  return res;
}

export const getClientAuditReport = getClientOrGroupFmsReport;

/**
 * Identify employees and FMS engagements where steps are blank, capturing EXACTLY which steps are missed.
 */
export function auditFmsBlankActualAndStatus(unifiedList = []) {
  const employeesMap = new Map();
  const blankEngagements = [];

  const stepDeficiencyTally = FMS_18_STEPS.map((s) => ({
    stepNo: s.stepNo,
    title: s.title,
    owner: s.owner,
    method: s.method,
    when: s.when,
    missedCount: 0,
    engagements: [],
  }));

  unifiedList.forEach((item) => {
    const totalStepsCount = (item.steps || []).length || 18;
    const blankSteps = (item.steps || []).filter(
      (s) => (!s.rawActual || s.rawActual === "") && (!s.rawStatus || s.rawStatus === "")
    );
    if (blankSteps.length === 0) return;

    const missedStepNos = blankSteps.map((s) => s.stepNo);
    const missedStepTitles = blankSteps.map((s) => s.title || `STEP-${s.stepNo}`);
    const isAllMissed = blankSteps.length === totalStepsCount;
    const missedSummary = isAllMissed
      ? `All ${totalStepsCount} Steps Missed (Step-1 Planning to Step-${totalStepsCount} ATR)`
      : blankSteps.length > 5
      ? `${blankSteps.length} Steps Missed: Steps ${missedStepNos.slice(0, 5).join(", ")} (+${blankSteps.length - 5} more)`
      : `Steps ${missedStepNos.join(", ")} Missed`;

    const record = {
      id: item.id,
      groupName: item.groupName,
      companyName: item.companyName,
      iaPeriod: item.iaPeriod,
      assignmentType: item.assignmentType,
      partner: item.partner || "Unassigned",
      senior: item.senior || "Unassigned",
      startDate: item.startDate || "-",
      targetDate: item.targetDate || "-",
      blankStepsCount: blankSteps.length,
      totalStepsCount,
      missedSteps: blankSteps,
      missedStepNos,
      missedStepTitles,
      missedSummary,
      detailedMissedList: blankSteps
        .map((s) => `Step ${s.stepNo}: ${s.title.split(": ")[1] || s.title}`)
        .join("; "),
    };

    blankEngagements.push(record);

    missedStepNos.forEach((no) => {
      const tally = stepDeficiencyTally.find((t) => t.stepNo === no);
      if (tally) {
        tally.missedCount++;
        tally.engagements.push(record);
      }
    });

    const trackOwner = (name, role, category) => {
      if (!name || name === "Unassigned") return;
      const key = `${category}__${normalizeName(name)}`;
      if (!employeesMap.has(key)) {
        employeesMap.set(key, { name, role, category, engagements: [], totalBlankSteps: 0 });
      }
      const entry = employeesMap.get(key);
      entry.engagements.push(record);
      entry.totalBlankSteps += blankSteps.length;
    };

    trackOwner(item.partner, "Partner Incharge", "PARTNER");
    trackOwner(item.senior, "Lead CA / Senior", "SENIOR");
  });

  const allEmployees = Array.from(employeesMap.values()).sort(
    (a, b) => b.engagements.length - a.engagements.length
  );

  return {
    totalEngagementsAudited: unifiedList.length,
    totalEngagementsBlank: blankEngagements.length,
    totalEmployeesAffected: allEmployees.length,
    partners: allEmployees.filter((e) => e.category === "PARTNER"),
    seniors: allEmployees.filter((e) => e.category === "SENIOR"),
    allEmployees,
    blankEngagements,
    stepDeficiencyTally,
  };
}

export const auditBlankActualAndStatus = auditFmsBlankActualAndStatus;
export const auditFmsBlankSteps = auditFmsBlankActualAndStatus;

/**
 * Chatbot summary for FMS engagements with blank steps, detailing EXACTLY which steps are missed.
 */
export function getFmsBlankActualAndStatusSummary(unifiedList = []) {
  if (!unifiedList || unifiedList.length === 0) {
    return (
      `📊 **Agrawal Jain & Co. — FMS Blank Steps & Actual Status Audit**\n\n` +
      `No FMS records loaded yet.` +
      `\n\n[ACTION_CHIPS:FMS status|📊 FMS Overview;Explain 18 steps of FMS|📋 18 FMS Steps]\n\n[DOWNLOAD_BLANK_ACTUAL_STATUS_EXCEL]`
    );
  }

  const {
    totalEngagementsAudited,
    totalEngagementsBlank,
    totalEmployeesAffected,
    partners,
    seniors,
    blankEngagements,
    stepDeficiencyTally,
  } = auditFmsBlankActualAndStatus(unifiedList);

  if (blankEngagements.length === 0) {
    return `✅ **FMS Compliance Audit: All 18 Steps Updated!**\n\n• Across all **${totalEngagementsAudited} FMS assignments**, all 18 steps have recorded Actual and Status updates. 🎉`;
  }

  let res = `🚨 **FMS: Blank Steps & Actual Status Audit Report (18-Step SOP)**\n`;
  res += `*Analysis of incomplete FMS milestones and detailed listing of missed steps*\n\n`;
  res += `• 🏢 **Assignments with Blank Steps**: **${totalEngagementsBlank} of ${totalEngagementsAudited}** (${Math.round(
    (totalEngagementsBlank / (totalEngagementsAudited || 1)) * 100
  )}% pending)\n`;
  res += `• 👥 **Responsible Staff**: **${totalEmployeesAffected} Employees** (**${partners.length} Partners** + **${seniors.length} Seniors**)\n\n`;

  // Explicit Section: Which Steps Are Missed?
  res += `📋 **Deficiency Breakdown: Which Steps Are Missed?**:\n`;
  const highDeficiencySteps = stepDeficiencyTally.filter((s) => s.missedCount > 0);
  if (
    highDeficiencySteps.length === 18 &&
    highDeficiencySteps.every((s) => s.missedCount === totalEngagementsBlank)
  ) {
    res += `• ❌ **All 18 Steps (Step-1 Planning through Step-18 Client Feedback & ATR)** are currently blank/pending across all ${totalEngagementsBlank} recorded engagements.\n`;
    res += `• Critical pending milestones include:\n`;
    res += `  - **Step 1 (Audit Scheduling & Planning)**: 0/${totalEngagementsBlank} completed\n`;
    res += `  - **Step 4 (Audit Programme & Risk Matrix)**: 0/${totalEngagementsBlank} completed\n`;
    res += `  - **Step 7 (Fieldwork & Daily Review)**: 0/${totalEngagementsBlank} completed\n`;
    res += `  - **Step 11 (Exit Conference & Executive Summary)**: 0/${totalEngagementsBlank} completed\n`;
    res += `  - **Step 14 (Final Signed Report Upload)**: 0/${totalEngagementsBlank} completed\n`;
    res += `  - **Step 18 (Client Feedback & ATR)**: 0/${totalEngagementsBlank} completed\n\n`;
  } else {
    highDeficiencySteps.slice(0, 8).forEach((s) => {
      res += `• **Step ${s.stepNo}: ${s.title.split(": ")[1] || s.title}** (${s.owner}) — **${s.missedCount} audits missed**\n`;
    });
    if (highDeficiencySteps.length > 8) {
      res += `• *...and ${highDeficiencySteps.length - 8} other steps have missed entries (see Excel/PDF).*\n\n`;
    } else {
      res += `\n`;
    }
  }

  // Sample Engagements with EXACT Missed Steps Listed
  res += `🔍 **Sample Engagements & Specific Missed Steps**:\n`;
  blankEngagements.slice(0, 5).forEach((rec, idx) => {
    res += `${idx + 1}. **${rec.companyName}** (${rec.iaPeriod}) — Partner: **${rec.partner}** | Senior: **${rec.senior}**\n`;
    res += `   ↳ ⚠️ **Missed Steps**: ${rec.missedSummary}\n`;
  });
  if (blankEngagements.length > 5) {
    res += `• _...and ${blankEngagements.length - 5} more client engagements with missed steps in the full export._\n\n`;
  } else {
    res += `\n`;
  }

  const formatOwnerGroup = (title, list) => {
    let out = `${title}\n`;
    if (list.length === 0) return out + `  *(None pending)*\n`;
    list.forEach((emp, idx) => {
      const sample = emp.engagements
        .slice(0, 3)
        .map((e) => `**${e.companyName}** (${e.iaPeriod})`)
        .join(", ");
      out += `  ${idx + 1}. **${emp.name}** — **${emp.engagements.length} assignments** pending\n`;
      out += `     ↳ Clients: ${sample}${
        emp.engagements.length > 3 ? ` *(+${emp.engagements.length - 3} more)*` : ""
      }\n`;
    });
    return out;
  };

  res += `━━━━━━━━━━━━━━━━━━━━\n`;
  res += formatOwnerGroup("👔 **1. Partner In-Charge Backlog (Missed Steps)**:", partners);
  res += `\n` + formatOwnerGroup("👔 **2. Seniors & Lead CAs Backlog (Missed Steps)**:", seniors);

  res += `\n[ACTION_CHIPS:FMS status|📊 FMS Overview;Explain 18 steps of FMS|📋 18 FMS Steps;Target date blank report|📅 Target Date Blank;Download Blank Actual & Status Report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_BLANK_ACTUAL_STATUS_EXCEL]`;
  return res;
}

export const getBlankActualAndStatusSummary = getFmsBlankActualAndStatusSummary;
export const getFmsBlankStepsReport = getFmsBlankActualAndStatusSummary;

/**
 * Audit FMS records where Target Date is blank, not set, or missing.
 */
export function auditFmsTargetDateBlank(unifiedList = []) {
  const employeesMap = new Map();
  const blankTargetEngagements = [];

  unifiedList.forEach((item) => {
    const rawTarget = String(item.targetDate || "").trim();
    const isTargetBlank =
      !rawTarget ||
      rawTarget === "-" ||
      rawTarget.toLowerCase() === "blank" ||
      rawTarget.toLowerCase() === "undefined";
    if (!isTargetBlank) return;

    const record = {
      id: item.id,
      groupName: item.groupName,
      companyName: item.companyName,
      iaPeriod: item.iaPeriod,
      assignmentType: item.assignmentType,
      partner: item.partner || "Unassigned",
      senior: item.senior || "Unassigned",
      startDate: item.startDate || "-",
      targetDate: "BLANK [Not Set]",
      blankStepsCount: (item.steps || []).filter((s) => !s.rawActual && !s.rawStatus).length,
      totalStepsCount: (item.steps || []).length || 18,
    };

    blankTargetEngagements.push(record);

    const trackOwner = (name, role, category) => {
      if (!name || name === "Unassigned") return;
      const key = `${category}__${normalizeName(name)}`;
      if (!employeesMap.has(key)) {
        employeesMap.set(key, { name, role, category, engagements: [] });
      }
      employeesMap.get(key).engagements.push(record);
    };

    trackOwner(item.partner, "Partner Incharge", "PARTNER");
    trackOwner(item.senior, "Lead CA / Senior", "SENIOR");
  });

  const allEmployees = Array.from(employeesMap.values()).sort(
    (a, b) => b.engagements.length - a.engagements.length
  );

  return {
    totalEngagementsAudited: unifiedList.length,
    totalTargetDateBlank: blankTargetEngagements.length,
    totalEmployeesAffected: allEmployees.length,
    partners: allEmployees.filter((e) => e.category === "PARTNER"),
    seniors: allEmployees.filter((e) => e.category === "SENIOR"),
    allEmployees,
    blankTargetEngagements,
  };
}

export const auditTargetDateBlank = auditFmsTargetDateBlank;

/**
 * Chatbot summary for FMS engagements where Target Date is blank.
 */
export function getFmsTargetDateBlankSummary(unifiedList = []) {
  if (!unifiedList || unifiedList.length === 0) {
    return (
      `📅 **Agrawal Jain & Co. — FMS Target Date Blank Audit**\n\n` +
      `No FMS records loaded yet.` +
      `\n\n[ACTION_CHIPS:FMS status|📊 FMS Overview;Explain 18 steps of FMS|📋 18 FMS Steps]\n\n[DOWNLOAD_FMS_TARGET_DATE_BLANK_EXCEL]`
    );
  }

  const {
    totalEngagementsAudited,
    totalTargetDateBlank,
    totalEmployeesAffected,
    partners,
    seniors,
    blankTargetEngagements,
  } = auditFmsTargetDateBlank(unifiedList);

  if (totalTargetDateBlank === 0) {
    return `✅ **FMS Target Date Audit: 100% Target Dates Configured!**\n\n• All **${totalEngagementsAudited} FMS engagements** have an active, planned Target Date recorded. 🎯`;
  }

  let res = `🚨 **FMS: Target Date Blank Audit Report**\n`;
  res += `*Condition: "Target Date" field is completely blank / not yet assigned*\n\n`;
  res += `• 🏢 **Engagements with Target Date Blank**: **${totalTargetDateBlank} of ${totalEngagementsAudited}** (${Math.round(
    (totalTargetDateBlank / (totalEngagementsAudited || 1)) * 100
  )}% pending target assignment)\n`;
  res += `• 👥 **Responsible Staff**: **${totalEmployeesAffected} Employees** (**${partners.length} Partners** + **${seniors.length} Seniors**)\n\n`;

  res += `⚠️ **Key Compliance Risk**: Without target completion dates, engagements cannot be monitored for SLA delays, milestone deadlines, or audit team scheduling.\n\n`;

  res += `🔍 **Sample Engagements Missing Target Date**:\n`;
  blankTargetEngagements.slice(0, 5).forEach((rec, idx) => {
    res += `${idx + 1}. **${rec.companyName}** (${rec.iaPeriod}) — Partner: **${rec.partner}** | Senior: **${rec.senior}** (Start Date: ${rec.startDate})\n`;
  });
  if (blankTargetEngagements.length > 5) {
    res += `• _...and ${blankTargetEngagements.length - 5} more engagements pending target date assignment._\n\n`;
  } else {
    res += `\n`;
  }

  const formatOwnerGroup = (title, list) => {
    let out = `${title}\n`;
    if (list.length === 0) return out + `  *(None pending)*\n`;
    list.forEach((emp, idx) => {
      const sample = emp.engagements
        .slice(0, 3)
        .map((e) => `**${e.companyName}** (${e.iaPeriod})`)
        .join(", ");
      out += `  ${idx + 1}. **${emp.name}** — **${emp.engagements.length} assignments** without target date\n`;
      out += `     ↳ Clients: ${sample}${
        emp.engagements.length > 3 ? ` *(+${emp.engagements.length - 3} more)*` : ""
      }\n`;
    });
    return out;
  };

  res += `━━━━━━━━━━━━━━━━━━━━\n`;
  res += formatOwnerGroup("👔 **1. Partner In-Charge Backlog (Target Date Blank)**:", partners);
  res += `\n` + formatOwnerGroup("👔 **2. Seniors & Lead CAs Backlog (Target Date Blank)**:", seniors);

  res += `\n[ACTION_CHIPS:FMS status|📊 FMS Overview;Blank actual and status report|🚨 Blank Steps Report;Explain 18 steps of FMS|📋 18 FMS Steps;Download Target Date Blank Report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_FMS_TARGET_DATE_BLANK_EXCEL]`;
  return res;
}

// --- SHARED EXCEL STYLING HELPER ---
const toArgb = (hex = "FFFFFF") => {
  const clean = String(hex).replace(/^#/, "");
  return clean.length === 6 ? `FF${clean}` : clean;
};

function setupWorksheetBannerAndHeader(sheet, titleText, subtitleText, lastColLetter, bannerColorHex, headerColorHex) {
  sheet.spliceRows(1, 0, [titleText], [subtitleText], []);
  sheet.mergeCells(`A1:${lastColLetter}1`);
  sheet.mergeCells(`A2:${lastColLetter}2`);

  sheet.getCell("A1").font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(bannerColorHex) } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 28;

  sheet.getCell("A2").font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(bannerColorHex) } };
  sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 20;

  const headerRow = sheet.getRow(4);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(headerColorHex) } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
}

function appendFmsStepsProtocolSheet(workbook) {
  const sheet = workbook.addWorksheet("18 Steps FMS Protocol", {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [
    { header: "Step #", key: "stepNo", width: 8 },
    { header: "Step Title", key: "title", width: 34 },
    { header: "Owner", key: "owner", width: 22 },
    { header: "Method", key: "method", width: 28 },
    { header: "When / Timeline", key: "when", width: 26 },
    { header: "Description / Objectives", key: "description", width: 44 },
    { header: "Key Deliverable", key: "deliverable", width: 36 },
  ];

  setupWorksheetBannerAndHeader(
    sheet,
    "FLOW MANAGEMENT SYSTEM (FMS) — 18 STEPS STANDARD PROTOCOL",
    "Agrawal Jain & Co. Standard Operating Procedure (SOP)",
    "G",
    "0f766e",
    "115e59"
  );

  FMS_18_STEPS.forEach((s) => sheet.addRow(s));
}

/**
 * Export complete or month-filtered FMS register to Excel (.xlsx)
 */
export async function exportFmsToExcel(unifiedList = [], scopeOrQuery = "ALL") {
  let list = Array.isArray(unifiedList) && unifiedList.length > 0 ? unifiedList : await fetchUnifiedFmsData();
  const targetMonth = parseFmsTargetMonth(scopeOrQuery);
  const isMonthScoped = Boolean(targetMonth && !targetMonth.isAllMonths);

  const enrichedRows = isMonthScoped
    ? list
        .map((item) => ({ item, match: matchFmsRecordToMonth(item, targetMonth, "iaPeriod") }))
        .filter((x) => x.match.matched)
    : list.map((item) => ({ item, match: null }));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. ERP";
  workbook.created = new Date();

  const sheet1 = workbook.addWorksheet(
    isMonthScoped ? `FMS - ${targetMonth.shortLabel}` : "FMS Register",
    { views: [{ showGridLines: true }] }
  );

  const columns = [
    { header: "Sr.", key: "sr", width: 6 },
    { header: "FMS ID", key: "id", width: 16 },
    { header: "Group Name", key: "groupName", width: 22 },
    { header: "Company Name", key: "companyName", width: 34 },
    { header: "Period", key: "iaPeriod", width: 20 },
    { header: "Partner Incharge", key: "partner", width: 24 },
    { header: "Lead CA / Senior", key: "senior", width: 24 },
    { header: "Type", key: "assignmentType", width: 12 },
    { header: "Start Date", key: "startDate", width: 14 },
    { header: "Target Date", key: "targetDate", width: 14 },
  ];
  if (isMonthScoped) {
    columns.push({ header: "Month Match Basis", key: "matchReason", width: 32 });
  }
  sheet1.columns = columns;

  setupWorksheetBannerAndHeader(
    sheet1,
    isMonthScoped
      ? `AGRAWAL JAIN & CO. — FMS REGISTER (${targetMonth.label.toUpperCase()})`
      : "AGRAWAL JAIN & CO. — FMS REGISTER",
    `Generated: ${new Date().toLocaleString("en-IN")} | Engagements: ${enrichedRows.length}${
      isMonthScoped ? ` (Filtered strictly for ${targetMonth.label})` : ""
    }`,
    isMonthScoped ? "K" : "J",
    "0f766e",
    "115e59"
  );

  enrichedRows.forEach(({ item, match }, idx) => {
    const rowData = {
      sr: idx + 1,
      id: item.id || `IA-${idx + 1}`,
      groupName: item.groupName,
      companyName: item.companyName,
      iaPeriod: item.iaPeriod,
      partner: item.partner,
      senior: item.senior,
      assignmentType: item.assignmentType,
      startDate: item.startDate || "-",
      targetDate: item.targetDate || "-",
    };
    if (isMonthScoped) {
      rowData.matchReason = match?.reasons?.join(" | ") || "-";
    }
    const row = sheet1.addRow(rowData);
    row.font = { name: "Segoe UI", size: 10 };
    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F0FDFA" } };
    }
  });

  // Tab 2: Period & Month Summary
  const summarySheet = workbook.addWorksheet("Period & Month Breakdown", {
    views: [{ showGridLines: true }],
  });
  summarySheet.columns = [
    { header: "Cycle / Period", key: "period", width: 28 },
    { header: "Total Items", key: "total", width: 20 },
    { header: "Live FMS Records", key: "liveCount", width: 20 },
    { header: "Companies", key: "companies", width: 55 },
  ];
  setupWorksheetBannerAndHeader(
    summarySheet,
    "FMS — PERIOD & CYCLE SUMMARY",
    isMonthScoped ? `Scoped to ${targetMonth.label}` : "Complete Cycle Distribution",
    "D",
    "0f766e",
    "115e59"
  );
  const grouped = groupFmsRecordsByPeriodAndMonth(
    enrichedRows.map((x) => x.item),
    "iaPeriod"
  );
  grouped.periodGroups.forEach((g) => {
    summarySheet.addRow({
      period: g.period,
      total: g.total,
      liveCount: g.liveCount,
      companies: g.items.map((i) => i.companyName).join(", "),
    });
  });

  appendFmsStepsProtocolSheet(workbook);

  const buffer = await workbook.xlsx.writeBuffer();
  const scopeSlug = isMonthScoped ? targetMonth.label.replace(/\s+/g, "_") : "Register";
  const filename = `AJC_FMS_${scopeSlug}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), filename);
  return filename;
}

export const exportInternalAuditFmsToExcel = exportFmsToExcel;

/**
 * Export FMS Blank Actual & Status Audit Report to Excel (.xlsx)
 * Explicitly detailing missed steps count, numbers, detailed names, and a Step-Wise Deficiency Matrix.
 */
export async function exportFmsBlankActualStatusReportToExcel(unifiedList = []) {
  let list = Array.isArray(unifiedList) && unifiedList.length > 0 ? unifiedList : await fetchUnifiedFmsData();
  const { blankEngagements, partners, seniors, stepDeficiencyTally } = auditFmsBlankActualAndStatus(list);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. ERP";
  workbook.created = new Date();

  const sheet1 = workbook.addWorksheet("Blank Actual & Status FMS", {
    views: [{ showGridLines: true }],
  });

  sheet1.columns = [
    { header: "Sr.", key: "sr", width: 6 },
    { header: "FMS ID", key: "id", width: 16 },
    { header: "Partner Incharge", key: "partner", width: 24 },
    { header: "Lead CA / Senior", key: "senior", width: 24 },
    { header: "Group Name", key: "groupName", width: 22 },
    { header: "Company Name", key: "companyName", width: 34 },
    { header: "Period", key: "iaPeriod", width: 20 },
    { header: "Type", key: "assignmentType", width: 12 },
    { header: "Start Date", key: "startDate", width: 14 },
    { header: "Target Date", key: "targetDate", width: 14 },
    { header: "Blank Steps", key: "blankStepsCount", width: 16 },
    { header: "Missed Steps Summary", key: "missedSummary", width: 36 },
    { header: "Missed Step #s", key: "missedStepNos", width: 24 },
    { header: "Detailed Missed Steps List", key: "detailedMissedList", width: 55 },
    { header: "Actual Field Status", key: "actualField", width: 20 },
    { header: "Status Field Status", key: "statusField", width: 20 },
    { header: "Action Required", key: "actionRequired", width: 34 },
  ];

  setupWorksheetBannerAndHeader(
    sheet1,
    "AGRAWAL JAIN & CO. — FMS BLANK ACTUAL & STATUS REPORT",
    `Generated: ${new Date().toLocaleString("en-IN")} | Engagements with Blank Actual & Status: ${blankEngagements.length}`,
    "Q",
    "991B1B",
    "115e59"
  );

  blankEngagements.forEach((item, idx) => {
    const row = sheet1.addRow({
      sr: idx + 1,
      id: item.id || `IA-${idx + 1}`,
      partner: item.partner,
      senior: item.senior,
      groupName: item.groupName,
      companyName: item.companyName,
      iaPeriod: item.iaPeriod,
      assignmentType: item.assignmentType,
      startDate: item.startDate || "-",
      targetDate: item.targetDate || "-",
      blankStepsCount: `${item.blankStepsCount} / ${item.totalStepsCount} Steps`,
      missedSummary: item.missedSummary,
      missedStepNos: item.missedStepNos.join(", "),
      detailedMissedList: item.detailedMissedList,
      actualField: "BLANK [No Date]",
      statusField: "BLANK [No Status]",
      actionRequired: "Actual Date & Status Update Required",
    });
    row.font = { name: "Segoe UI", size: 10 };
    row.getCell("actualField").font = { color: { argb: "DC2626" }, bold: true };
    row.getCell("statusField").font = { color: { argb: "DC2626" }, bold: true };
    row.getCell("missedSummary").font = { color: { argb: "991B1B" }, bold: true };
    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF2F2" } };
    }
  });

  // Tab 2: Responsible Employee Summary
  const sheet2 = workbook.addWorksheet("Employees Summary (Backlog)", {
    views: [{ showGridLines: true }],
  });

  sheet2.columns = [
    { header: "Sr.", key: "sr", width: 6 },
    { header: "Employee Name", key: "name", width: 28 },
    { header: "Role", key: "role", width: 22 },
    { header: "Total Blank Items", key: "count", width: 22 },
    { header: "Total Blank Steps", key: "stepsCount", width: 18 },
    { header: "Clients Handled", key: "clients", width: 50 },
    { header: "Compliance Status", key: "status", width: 22 },
  ];

  setupWorksheetBannerAndHeader(
    sheet2,
    "FMS EMPLOYEE SUMMARY — BLANK ACTUAL & STATUS",
    `Generated: ${new Date().toLocaleString("en-IN")} | Employees Affected: ${partners.length + seniors.length}`,
    "G",
    "0f766e",
    "115e59"
  );

  let empIdx = 1;
  [...partners, ...seniors].forEach((emp) => {
    const row = sheet2.addRow({
      sr: empIdx++,
      name: emp.name,
      role: emp.role,
      count: `${emp.engagements.length} Items`,
      stepsCount: `${emp.totalBlankSteps} Steps`,
      clients: emp.engagements.map((e) => e.companyName).join(", "),
      status: "⚠️ Actual & Status Blank",
    });
    row.font = { name: "Segoe UI", size: 10 };
    row.getCell("status").font = { color: { argb: "DC2626" }, bold: true };
    if (emp.category === "PARTNER") {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F0FDFA" } };
    }
  });

  // Tab 3: Step-Wise Deficiency Matrix (Which Steps Are Missed)
  const sheet3 = workbook.addWorksheet("Step-Wise Missed Breakdown", {
    views: [{ showGridLines: true }],
  });

  sheet3.columns = [
    { header: "Step #", key: "stepNo", width: 8 },
    { header: "Step Title", key: "title", width: 38 },
    { header: "Owner", key: "owner", width: 24 },
    { header: "Method", key: "method", width: 28 },
    { header: "Timeline / When", key: "when", width: 26 },
    { header: "Total Audits Missing Step", key: "missedCount", width: 26 },
    { header: "Sample Clients Pending", key: "clients", width: 60 },
  ];

  setupWorksheetBannerAndHeader(
    sheet3,
    "FMS STEP-WISE DEFICIENCY BREAKDOWN — MISSED MILESTONES",
    `Detailed analysis showing which of the 18 FMS steps are currently blank across client engagements`,
    "G",
    "991B1B",
    "1E3A8A"
  );

  stepDeficiencyTally.forEach((s) => {
    const row = sheet3.addRow({
      stepNo: s.stepNo,
      title: s.title,
      owner: s.owner,
      method: s.method,
      when: s.when,
      missedCount: `${s.missedCount} Audits Missing`,
      clients:
        s.engagements.slice(0, 5).map((e) => e.companyName).join(", ") +
        (s.engagements.length > 5 ? ` (+${s.engagements.length - 5} more)` : ""),
    });
    row.font = { name: "Segoe UI", size: 10 };
    if (s.missedCount > 0) {
      row.getCell("missedCount").font = { color: { argb: "DC2626" }, bold: true };
    }
  });

  appendFmsStepsProtocolSheet(workbook);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `AJC_FMS_Blank_Actual_Status_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), filename);
  return filename;
}

export const exportBlankActualStatusReportToExcel = exportFmsBlankActualStatusReportToExcel;

/**
 * Export FMS Blank Actual & Status Audit Report to PDF (.pdf)
 */
export async function exportFmsBlankActualStatusReportToPdf(unifiedList = []) {
  let list = Array.isArray(unifiedList) && unifiedList.length > 0 ? unifiedList : await fetchUnifiedFmsData();
  const {
    blankEngagements,
    partners,
    seniors,
    totalEngagementsAudited,
    totalEngagementsBlank,
    stepDeficiencyTally,
  } = auditFmsBlankActualAndStatus(list);

  const doc = new jsPDF({ orientation: "landscape" });

  // Title Banner
  doc.setFillColor(15, 118, 110); // #0f766e
  doc.rect(0, 0, 297, 22, "F");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("AGRAWAL JAIN & CO. — FMS BLANK ACTUAL & STATUS AUDIT REPORT", 14, 11);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${new Date().toLocaleString("en-IN")} | Backlog: ${totalEngagementsBlank} of ${totalEngagementsAudited} Engagements (${partners.length} Partners + ${seniors.length} Seniors)`,
    14,
    18
  );

  // Table 1: Engagements with Blank Actual & Status (including which steps are missed)
  const body1 = blankEngagements.map((item, idx) => [
    idx + 1,
    item.id || "-",
    item.partner || "-",
    item.senior || "-",
    item.groupName || "-",
    item.companyName || "-",
    item.iaPeriod || "-",
    item.targetDate || "-",
    `${item.blankStepsCount} / ${item.totalStepsCount}`,
    item.missedSummary,
    "BLANK [Actual & Status]",
  ]);

  autoTable(doc, {
    startY: 26,
    head: [["#", "ID", "Partner", "Senior", "Group", "Company", "Period", "Target Date", "Blank Steps", "Missed Steps Summary", "Field Status"]],
    body: body1,
    theme: "striped",
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
    },
    columnStyles: {
      9: { textColor: [153, 27, 27], fontStyle: "bold" },
      10: { textColor: [220, 38, 38], fontStyle: "bold" },
    },
  });

  // Table 2: Step-Wise Deficiency Breakdown (Which Steps Are Missed)
  const finalY1 = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 30;
  if (finalY1 > 165) {
    doc.addPage();
  }
  const startY2 = finalY1 > 165 ? 20 : finalY1;
  doc.setFontSize(12);
  doc.setTextColor(153, 27, 27);
  doc.setFont("helvetica", "bold");
  doc.text("STEP-WISE DEFICIENCY BREAKDOWN (WHICH STEPS ARE MISSED)", 14, startY2);

  const stepTallyData = stepDeficiencyTally.map((s) => [
    s.stepNo,
    s.title,
    s.owner,
    s.when,
    `${s.missedCount} Audits Missing`,
    s.engagements.slice(0, 3).map((e) => e.companyName).join(", ") + (s.engagements.length > 3 ? "..." : ""),
  ]);

  autoTable(doc, {
    startY: startY2 + 4,
    head: [["Step #", "Step Title", "Owner", "Timeline", "Total Audits Missing", "Sample Clients Pending"]],
    body: stepTallyData,
    theme: "striped",
    headStyles: {
      fillColor: [153, 27, 27],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
    },
  });

  // Table 3: Employee Summary (Backlog by Staff)
  const finalY2 = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 30;
  if (finalY2 > 165) {
    doc.addPage();
  }

  const startY3 = finalY2 > 165 ? 20 : finalY2;
  doc.setFontSize(12);
  doc.setTextColor(15, 118, 110);
  doc.setFont("helvetica", "bold");
  doc.text("RESPONSIBLE EMPLOYEES SUMMARY (BACKLOG)", 14, startY3);

  const empData = [...partners, ...seniors].map((emp, i) => [
    i + 1,
    emp.name,
    emp.role,
    `${emp.engagements.length} Items`,
    `${emp.totalBlankSteps} Steps`,
    emp.engagements.map((e) => e.companyName).slice(0, 3).join(", ") + (emp.engagements.length > 3 ? "..." : ""),
    "Actual & Status Blank",
  ]);

  autoTable(doc, {
    startY: startY3 + 4,
    head: [["#", "Employee Name", "Role", "Blank Engagements", "Total Blank Steps", "Clients Handled", "Compliance Status"]],
    body: empData,
    theme: "striped",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
    },
  });

  const filename = `AJC_FMS_Blank_Actual_Status_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}

export const exportBlankActualStatusReportToPdf = exportFmsBlankActualStatusReportToPdf;

/**
 * Export FMS Target Date Blank Report to Excel (.xlsx)
 */
export async function exportFmsTargetDateBlankReportToExcel(unifiedList = []) {
  let list = Array.isArray(unifiedList) && unifiedList.length > 0 ? unifiedList : await fetchUnifiedFmsData();
  const { blankTargetEngagements, partners, seniors } = auditFmsTargetDateBlank(list);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. ERP";
  workbook.created = new Date();

  const sheet1 = workbook.addWorksheet("Target Date Blank FMS", {
    views: [{ showGridLines: true }],
  });

  sheet1.columns = [
    { header: "Sr.", key: "sr", width: 6 },
    { header: "FMS ID", key: "id", width: 16 },
    { header: "Partner Incharge", key: "partner", width: 24 },
    { header: "Lead CA / Senior", key: "senior", width: 24 },
    { header: "Group Name", key: "groupName", width: 22 },
    { header: "Company Name", key: "companyName", width: 34 },
    { header: "Period", key: "iaPeriod", width: 20 },
    { header: "Type", key: "assignmentType", width: 12 },
    { header: "Start Date", key: "startDate", width: 14 },
    { header: "Target Date", key: "targetDate", width: 20 },
    { header: "Blank Steps", key: "blankStepsCount", width: 16 },
    { header: "Target Date Status", key: "statusField", width: 22 },
    { header: "Action Required", key: "actionRequired", width: 36 },
  ];

  setupWorksheetBannerAndHeader(
    sheet1,
    "AGRAWAL JAIN & CO. — FMS TARGET DATE BLANK AUDIT REPORT",
    `Generated: ${new Date().toLocaleString("en-IN")} | Engagements with Target Date Blank: ${blankTargetEngagements.length}`,
    "M",
    "B45309",
    "1E3A8A"
  );

  blankTargetEngagements.forEach((item, idx) => {
    const row = sheet1.addRow({
      sr: idx + 1,
      id: item.id || `IA-${idx + 1}`,
      partner: item.partner,
      senior: item.senior,
      groupName: item.groupName,
      companyName: item.companyName,
      iaPeriod: item.iaPeriod,
      assignmentType: item.assignmentType,
      startDate: item.startDate || "-",
      targetDate: "BLANK [Not Set]",
      blankStepsCount: `${item.blankStepsCount} / ${item.totalStepsCount} Steps`,
      statusField: "🚨 Target Date Missing",
      actionRequired: "Assign Target Completion Date",
    });
    row.font = { name: "Segoe UI", size: 10 };
    row.getCell("targetDate").font = { color: { argb: "DC2626" }, bold: true };
    row.getCell("statusField").font = { color: { argb: "DC2626" }, bold: true };
    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEB" } };
    }
  });

  // Tab 2: Responsible Staff Summary
  const sheet2 = workbook.addWorksheet("Responsible Staff Summary", {
    views: [{ showGridLines: true }],
  });

  sheet2.columns = [
    { header: "Sr.", key: "sr", width: 6 },
    { header: "Employee Name", key: "name", width: 28 },
    { header: "Role", key: "role", width: 22 },
    { header: "Engagements Without Target Date", key: "count", width: 32 },
    { header: "Clients Handled", key: "clients", width: 50 },
    { header: "Compliance Status", key: "status", width: 24 },
  ];

  setupWorksheetBannerAndHeader(
    sheet2,
    "STAFF SUMMARY — TARGET DATE BLANK BACKLOG",
    `Generated: ${new Date().toLocaleString("en-IN")} | Responsible Employees: ${partners.length + seniors.length}`,
    "F",
    "B45309",
    "0f766e"
  );

  let empIdx = 1;
  [...partners, ...seniors].forEach((emp) => {
    const row = sheet2.addRow({
      sr: empIdx++,
      name: emp.name,
      role: emp.role,
      count: `${emp.engagements.length} Engagements`,
      clients: emp.engagements.map((e) => e.companyName).join(", "),
      status: "🚨 Target Date Required",
    });
    row.font = { name: "Segoe UI", size: 10 };
    row.getCell("status").font = { color: { argb: "DC2626" }, bold: true };
    if (emp.category === "PARTNER") {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEB" } };
    }
  });

  appendFmsStepsProtocolSheet(workbook);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `AJC_FMS_Target_Date_Blank_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), filename);
  return filename;
}

export const exportTargetDateBlankReportToExcel = exportFmsTargetDateBlankReportToExcel;

/**
 * Export FMS Target Date Blank Report to PDF (.pdf)
 */
export async function exportFmsTargetDateBlankReportToPdf(unifiedList = []) {
  let list = Array.isArray(unifiedList) && unifiedList.length > 0 ? unifiedList : await fetchUnifiedFmsData();
  const {
    blankTargetEngagements,
    partners,
    seniors,
    totalEngagementsAudited,
    totalTargetDateBlank,
  } = auditFmsTargetDateBlank(list);

  const doc = new jsPDF({ orientation: "landscape" });

  // Title Banner
  doc.setFillColor(180, 83, 9); // Dark Amber/Orange
  doc.rect(0, 0, 297, 22, "F");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("AGRAWAL JAIN & CO. — FMS TARGET DATE BLANK AUDIT REPORT", 14, 11);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${new Date().toLocaleString("en-IN")} | Backlog: ${totalTargetDateBlank} of ${totalEngagementsAudited} Engagements Without Target Date (${partners.length} Partners + ${seniors.length} Seniors)`,
    14,
    18
  );

  // Table 1: Engagements with Blank Target Date
  const body1 = blankTargetEngagements.map((item, idx) => [
    idx + 1,
    item.id || `IA-${idx + 1}`,
    item.partner || "-",
    item.senior || "-",
    item.groupName || "-",
    item.companyName || "-",
    item.iaPeriod || "-",
    item.assignmentType || "-",
    item.startDate || "-",
    "BLANK [Not Set]",
    `${item.blankStepsCount} / ${item.totalStepsCount} Steps`,
    "Target Date Required",
  ]);

  autoTable(doc, {
    startY: 26,
    head: [["#", "ID", "Partner", "Senior", "Group", "Company", "Period", "Type", "Start Date", "Target Date", "Blank Steps", "Action Required"]],
    body: body1,
    theme: "striped",
    headStyles: {
      fillColor: [180, 83, 9],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
    },
    columnStyles: {
      9: { textColor: [220, 38, 38], fontStyle: "bold" },
      11: { textColor: [220, 38, 38], fontStyle: "bold" },
    },
  });

  // Table 2: Responsible Staff Summary
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 30;
  if (finalY > 165) {
    doc.addPage();
  }

  const startY2 = finalY > 165 ? 20 : finalY;
  doc.setFontSize(12);
  doc.setTextColor(180, 83, 9);
  doc.setFont("helvetica", "bold");
  doc.text("RESPONSIBLE EMPLOYEES SUMMARY (TARGET DATE BLANK)", 14, startY2);

  const empData = [...partners, ...seniors].map((emp, i) => [
    i + 1,
    emp.name,
    emp.role,
    `${emp.engagements.length} Engagements`,
    emp.engagements.map((e) => e.companyName).slice(0, 3).join(", ") + (emp.engagements.length > 3 ? "..." : ""),
    "Target Date Blank",
  ]);

  autoTable(doc, {
    startY: startY2 + 4,
    head: [["#", "Employee Name", "Role", "Blank Target Engagements", "Clients Handled", "Compliance Status"]],
    body: empData,
    theme: "striped",
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
    },
  });

  const filename = `AJC_FMS_Target_Date_Blank_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}

export const exportTargetDateBlankReportToPdf = exportFmsTargetDateBlankReportToPdf;

/**
 * Generates Month-Wise or Specific-Month FMS Report for the AI Chatbot.
 */
export function getFmsMonthlyReport(unifiedList = [], queryText = "") {
  const targetMonth = parseFmsTargetMonth(queryText);

  if (!unifiedList || unifiedList.length === 0) {
    return (
      `📌 **FMS — ${targetMonth.isAllMonths ? "Monthly Report" : targetMonth.label}**\n\n` +
      `0 FMS client engagements are currently configured/logged.`
    );
  }

  if (!targetMonth.isAllMonths) {
    const evaluated = unifiedList.map((item) => ({
      item,
      match: matchFmsRecordToMonth(item, targetMonth, "iaPeriod"),
    }));
    const directMatches = evaluated.filter((x) => x.match.matched && x.match.tier === "direct");
    const annualMatches = evaluated.filter((x) => x.match.matched && x.match.tier === "annual");
    const allMatched = [...directMatches, ...annualMatches];

    if (allMatched.length === 0) {
      const grouped = groupFmsRecordsByPeriodAndMonth(unifiedList, "iaPeriod");
      const availPeriods = grouped.periodGroups
        .slice(0, 6)
        .map((p) => `\`${p.period}\` (${p.total})`)
        .join(", ");
      const availDates = grouped.datedMonths
        .slice(0, 6)
        .map((m) => `\`${m.label}\` (${m.count})`)
        .join(", ");
      return (
        `📌 **FMS Report — ${targetMonth.label}**\n\n` +
        `No FMS engagements were found specifically scheduled for **${targetMonth.label}**.\n` +
        (availDates ? `\n• **Recorded Months:** ${availDates}` : "") +
        (availPeriods ? `\n• **Configured Audit Periods:** ${availPeriods}` : "") +
        `\n\nClick below to download the FMS Register with all engagements:\n\n[DOWNLOAD_INTERNAL_AUDIT_EXCEL:ALL]`
      );
    }

    const matchedBlankAudit = auditFmsBlankActualAndStatus(allMatched.map((x) => x.item));
    let out = `📌 **FMS Report — ${targetMonth.label}**\n\n`;
    out += `• **Direct Matches (${targetMonth.label}):** ${directMatches.length} | **Annual Retainers:** ${annualMatches.length}\n`;
    out += `• **Total Applicable:** ${allMatched.length} (Blank Actual & Status: **${matchedBlankAudit.blankEngagements.length}**)\n\n`;

    allMatched.slice(0, 15).forEach(({ item, match }, i) => {
      out += `${i + 1}. **${item.companyName}** (${item.iaPeriod}) — ${item.senior || "Lead CA"} | Partner: ${item.partner || "-"} • _${match.reasons.join(", ")}_\n`;
    });
    if (allMatched.length > 15) {
      out += `• _...and ${allMatched.length - 15} more items in Excel._\n`;
    }
    out += `\n[DOWNLOAD_INTERNAL_AUDIT_EXCEL:${targetMonth.key}]`;
    return out;
  }

  const grouped = groupFmsRecordsByPeriodAndMonth(unifiedList, "iaPeriod");
  const { quarterTotals, periodGroups, datedMonths } = grouped;
  const blankAudit = auditFmsBlankActualAndStatus(unifiedList);

  let out = `📌 **FMS — Month & Cycle Wise Report**\n\n`;
  out += `• **Total FMS Engagements:** ${unifiedList.length} | **Blank Actual & Status:** ${blankAudit.blankEngagements.length}\n`;
  out += `• **Cycle Distribution:** Q1 (${quarterTotals.Q1}), Q2 (${quarterTotals.Q2}), Q3 (${quarterTotals.Q3}), Q4 (${quarterTotals.Q4}), Half-Year (${quarterTotals.HalfYear}), Annual FY (${quarterTotals.AnnualFY}), General (${quarterTotals.General})\n`;

  if (datedMonths.length > 0) {
    out += `\n**Live Recorded Activity Months:**\n`;
    datedMonths.slice(0, 8).forEach((m) => {
      out += `• **${m.label}**: ${m.count} FMS item(s)\n`;
    });
  }

  if (periodGroups.length > 0) {
    out += `\n**FMS Period Breakdown:**\n`;
    periodGroups.slice(0, 8).forEach((g) => {
      out += `• **${g.period}**: ${g.total} item(s)\n`;
    });
  }

  out += `\n[DOWNLOAD_INTERNAL_AUDIT_EXCEL:ALL]`;
  return out;
}

export const getInternalAuditMonthlyReport = getFmsMonthlyReport;

