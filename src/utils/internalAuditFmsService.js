// src/utils/internalAuditFmsService.js
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

// --- API ENDPOINTS ---
export const INTERNAL_AUDIT_FMS_API =
  "https://script.google.com/macros/s/AKfycbzLrYemM772sgYveZ-P9o1hhPlM4wUds5HxCVbRdFlyOu_cr_M5g_DDWRJfY6QncCxNWw/exec";

export const INTERNAL_AUDIT_MASTER_API =
  "https://script.google.com/macros/s/AKfycbxpFa9JECyoDVSjtH7lfwNH7gAOxOUjr74vYb1n1dYG9YVsw7_veYlEPIz2ak-znDTH/exec";

export const INTERNAL_AUDIT_DETAILS_API =
  "https://script.google.com/macros/s/AKfycby8qaKsz1-FNGJthiK42oPR1Pm7d_TZ33r3wZj4ONyCCvsOGAfczwQPpt6_s4yLVWHDgQ/exec";

export const INTERNAL_AUDIT_FORM_SUBMIT_API =
  "https://script.google.com/macros/s/AKfycbyDHb4L61YI6F9tR_Urn1H5x6OW1R8kvSJgYt9oVZqfiWDOaglXZu2LaHQVMN7JEXzF/exec";

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

// Helper: In-memory cache for fast retrieval
let cachedUnifiedAuditData = null;
let lastFetchTimestamp = 0;
const CACHE_DURATION_MS = 60000; // 1 minute

/**
 * Fetch Master List of 89 Client Assignments from Google Apps Script API
 */
export async function fetchInternalAuditMasterList() {
  try {
    const res = await fetch(INTERNAL_AUDIT_MASTER_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.rows) ? data.rows : [];
  } catch (err) {
    console.warn("Error fetching Internal Audit Master List:", err);
    return [];
  }
}

/**
 * Fetch Live FMS 17-step Tracking Data from Google Apps Script API
 */
export async function fetchInternalAuditFMSData() {
  try {
    const res = await fetch(INTERNAL_AUDIT_FMS_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rows = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
    return rows;
  } catch (err) {
    console.warn("Error fetching Internal Audit FMS Data:", err);
    return [];
  }
}

/**
 * Fetch Registered Audit Details from Google Apps Script API
 */
export async function fetchInternalAuditDetailsList() {
  try {
    const res = await fetch(INTERNAL_AUDIT_DETAILS_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("Error fetching Internal Audit Details:", err);
    return [];
  }
}

/**
 * Build unified, structured assignments combining Master List, FMS Steps, and Details
 */
export async function fetchUnifiedInternalAuditData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedUnifiedAuditData && now - lastFetchTimestamp < CACHE_DURATION_MS) {
    return cachedUnifiedAuditData;
  }

  try {
    const [masterRows, fmsRows, detailsRows] = await Promise.all([
      fetchInternalAuditMasterList(),
      fetchInternalAuditFMSData(),
      fetchInternalAuditDetailsList(),
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

      const parsedSteps = FMS_17_STEPS.map((step) => {
        const start = 11 + (step.stepNo - 1) * 4;
        const planned = (row[start] || "").trim();
        const rawActual = (row[start + 1] || "").trim();
        const rawStatus = (row[start + 2] || "").trim();
        const actual = rawActual;
        const status = rawStatus || (actual ? "Completed" : planned ? "Planned" : "Pending");
        const delay = (row[start + 3] || "").trim();
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

      const key = `${normalizeName(companyName)}__${period.toLowerCase()}`;
      assignmentsMap.set(key, {
        id: uiId,
        groupName: groupName || "MKSPL",
        companyName,
        department: "Internal Audit",
        iaPeriod: period,
        partner: partner || "CA Rupesh Vaid",
        senior: senior || "CA Kanha Kedia",
        assignmentType,
        startDate,
        targetDate,
        timestamp,
        steps: parsedSteps,
        isLiveFms: true,
        source: "Live FMS",
      });
    });

    // 3. Ingest Details Rows
    detailsRows.forEach((r, idx) => {
      if (!r || !r[2]) return;
      const timestamp = r[0] || "";
      const groupName = (r[1] || "").trim();
      const companyName = (r[2] || "").trim();
      const period = (r[3] || "").trim();
      const partner = (r[4] || "").trim();
      const senior = (r[5] || "").trim();
      const assignmentType = (r[6] || "City").trim();
      const startDate = r[7] || "";
      const targetDate = r[8] || "";

      const key = `${normalizeName(companyName)}__${period.toLowerCase()}`;
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
    cachedUnifiedAuditData = unifiedList;
    lastFetchTimestamp = now;
    return unifiedList;
  } catch (err) {
    console.error("Error building unified Internal Audit data:", err);
    return cachedUnifiedAuditData || [];
  }
}

/**
 * Firm-Wide Executive Overview of Internal Audit FMS
 */
export function getInternalAuditOverview(unifiedList = []) {
  const total = unifiedList.length;

  // Breakdown by Partner
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
  const otherCount = typeMap.get("Other") || 0;

  let res = `📊 **Agrawal Jain & Co. — Internal Audit FMS Intelligence**\n`;
  res += `• 🏢 **Total Audit Engagements**: **${total} client assignments** across **${groupMap.size} corporate groups**\n`;
  res += `• 🏭 **Assignment Locations**: **${cityCount} City Audits** | **${plantCount} Plant Audits** | **${otherCount} Specialized Audits**\n`;
  res += `• 🔄 **Workflow System**: Structured **17-Step Flow Management System (FMS)** from annual planning to cost sheet closure.\n\n`;

  res += `━━━━━━━━━━━━━━━━━━━━\n`;
  res += `👔 **1. Partner In-Charge Distribution**:\n`;
  Array.from(partnerMap.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([partner, count]) => {
      res += `• **${partner}**: **${count} assignments**\n`;
    });

  res += `\n👔 **2. Seniors & CA In-Charge (Top Lead Auditors)**:\n`;
  Array.from(seniorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .forEach(([senior, count]) => {
      res += `• **${senior}**: **${count} audits**\n`;
    });

  res += `\n📅 **3. Audit Cycle & Period Breakdown**:\n`;
  Array.from(periodMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([p, count]) => {
      res += `• **${p}**: **${count} audits**\n`;
    });

  res += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  res += `💡 *Tip: Try asking:* \n`;
  res += `• *"Show internal audits for CA Harsh Mittal"*\n`;
  res += `• *"Explain the 17 steps of internal audit FMS"*\n`;
  res += `• *"Show plant audit assignments"*\n`;
  res += `• *"Status of Shree Hanuman Loha audit"*\n\n`;
  res += `[ACTION_CHIPS:Explain 17 steps of Internal Audit FMS|📋 17 FMS Steps;Show internal audits of CA Harsh Mittal|👤 Harsh Mittal Audits;Show plant audit assignments|🏭 Plant Audits;Download Internal Audit FMS Report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_INTERNAL_AUDIT_EXCEL]`;

  return res;
}

/**
 * Filter Internal Audits Assigned to a specific Partner or Senior
 */
export function getPartnerOrSeniorAuditReport(unifiedList = [], nameQuery = "") {
  const cleanTarget = normalizeName(nameQuery);
  if (!cleanTarget) return null;

  const matched = unifiedList.filter((item) => {
    const cleanPartner = normalizeName(item.partner);
    const cleanSenior = normalizeName(item.senior);
    return (
      cleanPartner.includes(cleanTarget) ||
      cleanTarget.includes(cleanPartner) ||
      cleanSenior.includes(cleanTarget) ||
      cleanTarget.includes(cleanSenior)
    );
  });

  if (matched.length === 0) return null;

  const partnerEngagements = matched.filter((i) => normalizeName(i.partner).includes(cleanTarget) || cleanTarget.includes(normalizeName(i.partner)));
  const seniorEngagements = matched.filter((i) => normalizeName(i.senior).includes(cleanTarget) || cleanTarget.includes(normalizeName(i.senior)));

  const displayName = partnerEngagements.length > 0 ? partnerEngagements[0].partner : seniorEngagements[0].senior;

  let res = `📋 **Internal Audit Engagements: ${displayName}**\n`;
  res += `• 📊 **Total Assigned Audits**: **${matched.length} client engagements**\n`;
  if (partnerEngagements.length > 0) {
    res += `• 👔 **Partner In-Charge**: ${partnerEngagements.length} assignments\n`;
  }
  if (seniorEngagements.length > 0) {
    res += `• 👔 **Senior / Lead CA In-Charge**: ${seniorEngagements.length} assignments\n`;
  }
  res += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  res += `**Assigned Client Engagements**:\n`;
  matched.slice(0, 15).forEach((item, idx) => {
    const roleTag = normalizeName(item.partner).includes(cleanTarget) ? "Partner Incharge" : "Lead CA / Senior";
    res += `  ${idx + 1}. 🏢 **${item.companyName}** *(Group: ${item.groupName})*\n`;
    res += `     • 🗓️ Period: **${item.iaPeriod}** | 📍 Type: **${item.assignmentType}**\n`;
    res += `     • 👤 Assigned As: *${roleTag}* (With: ${roleTag === "Partner Incharge" ? item.senior : item.partner})\n`;
    if (item.startDate) {
      res += `     • 📅 Dates: Start: ${item.startDate} | Target: ${item.targetDate || "TBD"}\n`;
    }
  });

  if (matched.length > 15) {
    res += `\n*...and ${matched.length - 15} more client audit engagements.*`;
  }

  res += `\n\n[ACTION_CHIPS:Explain 17 steps of Internal Audit FMS|📋 17 FMS Steps;Show Internal Audit FMS status|📊 All Audits;Download Internal Audit FMS Report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_INTERNAL_AUDIT_EXCEL]`;

  return res;
}

/**
 * Filter Internal Audits by Assignment Type (City vs Plant vs Other)
 */
export function getAuditsByTypeReport(unifiedList = [], typeQuery = "Plant") {
  const isPlant = /plant/i.test(typeQuery);
  const targetType = isPlant ? "Plant" : "City";

  const matched = unifiedList.filter((item) => (item.assignmentType || "").toLowerCase() === targetType.toLowerCase());

  let res = `🏭 **${targetType} Internal Audit Engagements** (${matched.length} Audits)\n\n`;
  res += `• 📍 **Assignment Classification**: ${targetType} Audits require on-site process verification, physical verification of stock/fixed assets, and operational risk controls.\n\n`;

  matched.slice(0, 12).forEach((item, idx) => {
    res += `  ${idx + 1}. 🏢 **${item.companyName}** *(Group: ${item.groupName})*\n`;
    res += `     • 🗓️ Period: **${item.iaPeriod}**\n`;
    res += `     • 👔 Partner: ${item.partner} | Senior: ${item.senior}\n`;
  });

  if (matched.length > 12) {
    res += `\n*...and ${matched.length - 12} more ${targetType} engagements.*`;
  }

  res += `\n\n[ACTION_CHIPS:Show City internal audits|🏙️ City Audits;Show Plant internal audits|🏭 Plant Audits;Download Internal Audit FMS Report|📥 Download Excel]`;
  return res;
}

/**
 * Detailed 17-Step Process Guide for Internal Audit FMS
 */
export function get17StepsGuideReport() {
  let res = `📋 **The Official 17-Step Internal Audit Flow Management System (FMS)**\n`;
  res += `*Agrawal Jain & Co. Standard Operating Procedure (SOP)*\n\n`;
  res += `━━━━━━━━━━━━━━━━━━━━\n`;

  FMS_17_STEPS.forEach((s) => {
    res += `**${s.title}**\n`;
    res += `• 👤 **Owner**: **${s.owner}** | ⏰ **Timeline**: *${s.when}*\n`;
    res += `• 🛠️ **Method**: *${s.method}*\n`;
    res += `• 📌 **Description**: ${s.description}\n`;
    res += `• 📑 **Deliverable**: ${s.deliverable}\n\n`;
  });

  res += `━━━━━━━━━━━━━━━━━━━━\n`;
  res += `💡 *Every assignment in the firm is tracked across these 17 milestones to ensure zero compliance gaps, timely reporting, and high audit quality!*`;
  return res;
}

/**
 * Search Audit by Company or Group Name
 */
export function getClientAuditReport(unifiedList = [], clientQuery = "") {
  const cleanQ = normalizeName(clientQuery);
  if (!cleanQ) return null;

  const matched = unifiedList.filter((item) => {
    const cleanComp = normalizeName(item.companyName);
    const cleanGroup = normalizeName(item.groupName);
    return cleanComp.includes(cleanQ) || cleanGroup.includes(cleanQ);
  });

  if (matched.length === 0) return null;

  let res = `🏢 **Internal Audit Assignment: ${matched[0].companyName}**\n`;
  res += `• 🏷️ **Group Name**: **${matched[0].groupName}**\n`;
  res += `• 🗓️ **Audit Period**: **${matched[0].iaPeriod}**\n`;
  res += `• 📍 **Assignment Type**: **${matched[0].assignmentType}**\n`;
  res += `• 👔 **Partner In-Charge**: **${matched[0].partner}**\n`;
  res += `• 👔 **Lead CA / Senior**: **${matched[0].senior}**\n`;

  if (matched[0].startDate || matched[0].targetDate) {
    res += `• 📅 **Schedule**: Start: **${matched[0].startDate || "TBD"}** | Target: **${matched[0].targetDate || "TBD"}**\n`;
  }

  res += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  res += `📊 **17-Step FMS Tracking Status**:\n`;

  const activeOrDoneSteps = matched[0].steps.filter((s) => s.planned || s.actual || s.status !== "Pending");
  if (activeOrDoneSteps.length > 0) {
    activeOrDoneSteps.forEach((s) => {
      res += `• **${s.title}** [${s.owner}]: Status: **${s.status}** (Planned: ${s.planned || "-"}, Actual: ${s.actual || "-"}${s.delay ? `, Delay: ${s.delay}` : ""})\n`;
    });
  } else {
    res += `• 🚀 Initial setup recorded. First milestones: \n`;
    res += `  1. STEP-1 [PARTNERS]: Expected Start & End Date Form (Year start)\n`;
    res += `  2. STEP-2 [SENIOR]: Requisition List & Client Call (Before Audit)\n`;
    res += `  3. STEP-6 [SENIOR]: Entry Conference with HODs (Audit Start Day)\n`;
  }

  res += `\n[ACTION_CHIPS:Explain 17 steps of Internal Audit FMS|📋 17 FMS Steps;Show Internal Audit FMS status|📊 All Audits;Download Internal Audit FMS Report|📥 Download Excel]`;
  return res;
}

const toArgb = (hex = "FFFFFF") => {
  const clean = String(hex).replace(/^#/, "");
  return clean.length === 6 ? `FF${clean}` : clean;
};

function setupIaWorksheetBannerAndHeader(
  sheet,
  titleText,
  subtitleText,
  lastColLetter,
  titleColorHex = "0F766E",
  subColorHex = "115E59",
  headerColorHex = "1E3A8A"
) {
  sheet.spliceRows(1, 0, [titleText], [subtitleText], []);

  sheet.mergeCells(`A1:${lastColLetter}1`);
  sheet.mergeCells(`A2:${lastColLetter}2`);

  sheet.getCell("A1").font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(titleColorHex) } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 28;

  sheet.getCell("A2").font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(subColorHex) } };
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

function appendIaStepsProtocolSheet(workbook) {
  const sheet = workbook.addWorksheet("17 Steps FMS Protocol", {
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

  setupIaWorksheetBannerAndHeader(
    sheet,
    "INTERNAL AUDIT FLOW MANAGEMENT SYSTEM (FMS) — 17 STEPS STANDARD PROTOCOL",
    "Agrawal Jain & Co. Standard Operating Procedure (SOP)",
    "G",
    "1E3A8A",
    "1E40AF",
    "0F766E"
  );

  FMS_17_STEPS.forEach((s) => {
    sheet.addRow({
      stepNo: s.stepNo,
      title: s.title,
      owner: s.owner,
      method: s.method,
      when: s.when,
      description: s.description,
      deliverable: s.deliverable,
    });
  });
}

/**
 * Export complete or month-filtered Internal Audit FMS dataset to multi-tab Excel
 */
export async function exportInternalAuditFmsToExcel(unifiedList = [], scopeOrQuery = "ALL") {
  let list = Array.isArray(unifiedList) && unifiedList.length > 0 ? unifiedList : await fetchUnifiedInternalAuditData();
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

  // Tab 1: Master / Filtered Engagements Register
  const sheet1 = workbook.addWorksheet(
    isMonthScoped ? `IA FMS - ${targetMonth.shortLabel}` : "Internal Audit Engagements",
    { views: [{ showGridLines: true }] }
  );

  const baseColumns = [
    { header: "Sr.", key: "sr", width: 6 },
    { header: "Assignment ID", key: "id", width: 16 },
    { header: "Group Name", key: "groupName", width: 22 },
    { header: "Company Name", key: "companyName", width: 34 },
    { header: "IA Period", key: "iaPeriod", width: 22 },
    { header: "Partner Incharge", key: "partner", width: 24 },
    { header: "Lead CA / Senior", key: "senior", width: 24 },
    { header: "Type", key: "assignmentType", width: 12 },
    { header: "Start Date", key: "startDate", width: 14 },
    { header: "Target Date", key: "targetDate", width: 14 },
  ];
  if (isMonthScoped) {
    baseColumns.push({ header: "Month Match Basis", key: "matchReason", width: 34 });
  }
  sheet1.columns = baseColumns;

  const lastCol = isMonthScoped ? "K" : "J";
  setupIaWorksheetBannerAndHeader(
    sheet1,
    isMonthScoped
      ? `AGRAWAL JAIN & CO. — INTERNAL AUDIT FMS (${targetMonth.label.toUpperCase()})`
      : "AGRAWAL JAIN & CO. — INTERNAL AUDIT FMS REGISTER",
    `Generated: ${new Date().toLocaleString("en-IN")} | Engagements: ${enrichedRows.length}${
      isMonthScoped ? ` (Filtered strictly for ${targetMonth.label})` : ""
    }`,
    lastCol,
    "0F766E",
    "115E59",
    "1E3A8A"
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

  // Tab 2: Month & Cycle Breakdown
  const summarySheet = workbook.addWorksheet("Period & Month Breakdown", {
    views: [{ showGridLines: true }],
  });
  summarySheet.columns = [
    { header: "Cycle / Period", key: "period", width: 28 },
    { header: "Total Engagements", key: "total", width: 20 },
    { header: "Live FMS Records", key: "liveCount", width: 20 },
    { header: "Companies", key: "companies", width: 55 },
  ];
  setupIaWorksheetBannerAndHeader(
    summarySheet,
    "INTERNAL AUDIT FMS — PERIOD & CYCLE SUMMARY",
    isMonthScoped ? `Scoped to ${targetMonth.label}` : "Complete Register Cycle Distribution",
    "D",
    "0F766E",
    "115E59",
    "1E3A8A"
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

  // Tab 3: The 17 FMS Process Steps SOP
  appendIaStepsProtocolSheet(workbook);

  const buffer = await workbook.xlsx.writeBuffer();
  const scopeSlug = isMonthScoped ? targetMonth.label.replace(/\s+/g, "_") : "Register";
  const filename = `AJC_Internal_Audit_FMS_${scopeSlug}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), filename);
  return filename;
}

/**
 * Audit all internal audit engagements and identify employees who have
 * "actual and status field" both blank.
 */
export function auditBlankActualAndStatus(unifiedList = []) {
  const employeesMap = new Map();
  const blankEngagements = [];

  unifiedList.forEach((item) => {
    // A step is considered blank if both rawActual and rawStatus are empty
    const blankSteps = (item.steps || []).filter(
      (s) => (!s.rawActual || s.rawActual === "") && (!s.rawStatus || s.rawStatus === "")
    );
    const hasBlankFields = blankSteps.length > 0;

    if (!hasBlankFields) return;

    const engagementRecord = {
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
      totalStepsCount: (item.steps || []).length || 17,
      allStepsBlank: blankSteps.length === ((item.steps || []).length || 17),
      blankStepTitles: blankSteps.slice(0, 3).map((s) => `Step-${s.stepNo}`),
    };

    blankEngagements.push(engagementRecord);

    // Track Partner
    if (item.partner && item.partner !== "Unassigned") {
      const pKey = `Partner__${normalizeName(item.partner)}`;
      if (!employeesMap.has(pKey)) {
        employeesMap.set(pKey, {
          name: item.partner,
          role: "Partner Incharge",
          category: "PARTNER",
          engagements: [],
          totalBlankSteps: 0,
        });
      }
      const pRecord = employeesMap.get(pKey);
      pRecord.engagements.push(engagementRecord);
      pRecord.totalBlankSteps += blankSteps.length;
    }

    // Track Senior
    if (item.senior && item.senior !== "Unassigned") {
      const sKey = `Senior__${normalizeName(item.senior)}`;
      if (!employeesMap.has(sKey)) {
        employeesMap.set(sKey, {
          name: item.senior,
          role: "Lead CA / Senior",
          category: "SENIOR",
          engagements: [],
          totalBlankSteps: 0,
        });
      }
      const sRecord = employeesMap.get(sKey);
      sRecord.engagements.push(engagementRecord);
      sRecord.totalBlankSteps += blankSteps.length;
    }
  });

  const employeeList = Array.from(employeesMap.values()).sort(
    (a, b) => b.engagements.length - a.engagements.length
  );

  const partners = employeeList.filter((e) => e.category === "PARTNER");
  const seniors = employeeList.filter((e) => e.category === "SENIOR");

  return {
    totalEngagementsAudited: unifiedList.length,
    totalEngagementsBlank: blankEngagements.length,
    totalEmployeesAffected: employeeList.length,
    partners,
    seniors,
    allEmployees: employeeList,
    blankEngagements,
  };
}

/**
 * Generate comprehensive executive summary in Chatbot for employees
 * who have both actual and status fields blank.
 */
export function getBlankActualAndStatusSummary(unifiedList = []) {
  const auditResult = auditBlankActualAndStatus(unifiedList);
  const {
    totalEngagementsAudited,
    totalEngagementsBlank,
    totalEmployeesAffected,
    partners,
    seniors,
    blankEngagements,
  } = auditResult;

  if (blankEngagements.length === 0) {
    return `✅ **Internal Audit FMS Compliance Audit: All Actual & Status Fields Updated!**\n\n• Across all **${totalEngagementsAudited} client audit assignments**, all milestones have recorded actual completion dates and statuses.\n• Zero backlog detected! 🎉`;
  }

  // Count plant vs city
  let cityCount = 0;
  let plantCount = 0;
  let otherCount = 0;
  blankEngagements.forEach((e) => {
    if (/plant/i.test(e.assignmentType)) plantCount++;
    else if (/city/i.test(e.assignmentType)) cityCount++;
    else otherCount++;
  });

  let res = `🚨 **Internal Audit FMS: Blank Actual & Status Audit Report**\n`;
  res += `*Condition: Both "Actual" and "Status" fields are completely blank in the tracking system*\n\n`;
  res += `• 🏢 **Client Engagements with Blank Actual & Status**: **${totalEngagementsBlank} of ${totalEngagementsAudited} audits** (${Math.round((totalEngagementsBlank / (totalEngagementsAudited || 1)) * 100)}% backlog)\n`;
  res += `• 👥 **Employees Responsible**: **${totalEmployeesAffected} Employees** (**${partners.length} Partners** + **${seniors.length} Seniors / Lead CAs**)\n`;
  res += `• 🏭 **Location Split**: **${cityCount} City Audits** | **${plantCount} Plant Audits**${otherCount > 0 ? ` | **${otherCount} Other Audits**` : ""}\n`;
  res += `• ⏳ **Milestone Progress**: All **17 FMS steps** are currently awaiting actual completion sign-off and status updates.\n\n`;

  res += `━━━━━━━━━━━━━━━━━━━━\n`;
  res += `👔 **1. Partner In-Charge Backlog (Actual & Status Blank)**:\n`;
  if (partners.length > 0) {
    partners.forEach((p, idx) => {
      const clientNames = p.engagements.slice(0, 3).map((e) => `**${e.companyName}** (${e.iaPeriod})`).join(", ");
      res += `  ${idx + 1}. **${p.name}** — **${p.engagements.length} assignments** pending\n`;
      res += `     ↳ Clients: ${clientNames}${p.engagements.length > 3 ? ` *(+${p.engagements.length - 3} more)*` : ""}\n`;
    });
  } else {
    res += `  *(No partners assigned to blank audits)*\n`;
  }

  res += `\n👔 **2. Seniors & Lead CAs Backlog (Fieldwork Actual & Status Blank)**:\n`;
  if (seniors.length > 0) {
    seniors.forEach((s, idx) => {
      const clientNames = s.engagements.slice(0, 3).map((e) => `**${e.companyName}** (${e.iaPeriod})`).join(", ");
      res += `  ${idx + 1}. **${s.name}** — **${s.engagements.length} assignments** pending\n`;
      res += `     ↳ Clients: ${clientNames}${s.engagements.length > 3 ? ` *(+${s.engagements.length - 3} more)*` : ""}\n`;
    });
  } else {
    res += `  *(No seniors assigned to blank audits)*\n`;
  }

  res += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  res += `📋 **3. High-Priority Client Assignments Pending Update (Sample)**:\n`;
  blankEngagements.slice(0, 8).forEach((item, idx) => {
    res += `  ${idx + 1}. 🏢 **${item.companyName}** *(Group: ${item.groupName})*\n`;
    res += `     • Period: **${item.iaPeriod}** | Type: **${item.assignmentType}**\n`;
    res += `     • Incharge: **${item.partner}** (Partner) • **${item.senior}** (Lead CA)\n`;
    res += `     • Status: ❌ Both Actual Date & Status are **BLANK** (Pending Step-1 Planning to Step-17 Closure)\n`;
  });
  if (blankEngagements.length > 8) {
    res += `  *...and ${blankEngagements.length - 8} more client audit assignments with blank actual & status fields.*\n`;
  }

  res += `\n💡 **Actionable Recommendation for MD Sir**:\n`;
  res += `• Instruct assigned Seniors and Partners to initiate **Step-1 (Audit Scheduling)** and **Step-2 (Requisition List)** and fill in the **Actual Date** and **Status** in the portal to ensure workflow visibility.\n\n`;

  res += `[ACTION_CHIPS:Show internal audits for CA Harsh Mittal|👤 Harsh Mittal;Show internal audits for CA Rupesh Vaid|👤 Rupesh Vaid;Explain 17 steps of Internal Audit FMS|📋 17 FMS Steps;Download Blank Actual & Status Report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_BLANK_ACTUAL_STATUS_EXCEL]`;

  return res;
}

/**
 * Export official Excel workbook of employees who have both actual and status fields blank.
 */
export async function exportBlankActualStatusReportToExcel(unifiedList = []) {
  let list = Array.isArray(unifiedList) && unifiedList.length > 0 ? unifiedList : await fetchUnifiedInternalAuditData();
  const auditResult = auditBlankActualAndStatus(list);
  const { blankEngagements, partners, seniors } = auditResult;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. ERP";
  workbook.created = new Date();

  // Tab 1: Blank Actual & Status Engagements
  const sheet1 = workbook.addWorksheet("Blank Actual & Status Audits", {
    views: [{ showGridLines: true }],
  });

  sheet1.columns = [
    { header: "Sr.", key: "sr", width: 6 },
    { header: "Assignment ID", key: "id", width: 16 },
    { header: "Partner Incharge", key: "partner", width: 24 },
    { header: "Lead CA / Senior", key: "senior", width: 24 },
    { header: "Group Name", key: "groupName", width: 22 },
    { header: "Company Name", key: "companyName", width: 34 },
    { header: "IA Period", key: "iaPeriod", width: 22 },
    { header: "Type", key: "assignmentType", width: 12 },
    { header: "Start Date", key: "startDate", width: 14 },
    { header: "Target Date", key: "targetDate", width: 14 },
    { header: "Blank Steps", key: "blankStepsCount", width: 14 },
    { header: "Actual Field Status", key: "actualField", width: 20 },
    { header: "Status Field Status", key: "statusField", width: 20 },
    { header: "Action Required", key: "actionRequired", width: 34 },
  ];

  // Header Banners
  setupIaWorksheetBannerAndHeader(
    sheet1,
    "AGRAWAL JAIN & CO. — INTERNAL AUDIT FMS BLANK ACTUAL & STATUS REPORT",
    `Generated: ${new Date().toLocaleString("en-IN")} | Total Engagements with Blank Actual & Status: ${blankEngagements.length}`,
    "N",
    "991B1B",
    "B91C1C",
    "1E3A8A"
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
      blankStepsCount: `${item.blankStepsCount} / 17 Steps`,
      actualField: "BLANK [No Date]",
      statusField: "BLANK [No Status]",
      actionRequired: "Fieldwork Actual & Status Update Required",
    });

    row.font = { name: "Segoe UI", size: 10 };
    row.getCell("actualField").font = { color: { argb: "DC2626" }, bold: true };
    row.getCell("statusField").font = { color: { argb: "DC2626" }, bold: true };

    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF2F2" } };
    }
  });

  // Tab 2: Employee Summary (Partners & Seniors)
  const sheet2 = workbook.addWorksheet("Employees Summary (Backlog)", {
    views: [{ showGridLines: true }],
  });

  sheet2.columns = [
    { header: "Sr.", key: "sr", width: 6 },
    { header: "Employee Name", key: "name", width: 28 },
    { header: "Role", key: "role", width: 22 },
    { header: "Total Blank Engagements", key: "count", width: 24 },
    { header: "Total Blank Steps", key: "stepsCount", width: 18 },
    { header: "Client Engagements Handled", key: "clients", width: 50 },
    { header: "Compliance Status", key: "status", width: 22 },
  ];

  setupIaWorksheetBannerAndHeader(
    sheet2,
    "EMPLOYEE SUMMARY — RESPONSIBLE PARTNERS & SENIORS WITH BLANK ACTUAL & STATUS",
    `Generated: ${new Date().toLocaleString("en-IN")} | Total Employees Affected: ${partners.length + seniors.length}`,
    "G",
    "0F766E",
    "115E59",
    "1E3A8A"
  );

  let empIdx = 1;
  // Partners first
  partners.forEach((p) => {
    const clientsStr = p.engagements.map((e) => e.companyName).join(", ");
    const row = sheet2.addRow({
      sr: empIdx++,
      name: p.name,
      role: p.role,
      count: `${p.engagements.length} Client Audits`,
      stepsCount: `${p.totalBlankSteps} Steps`,
      clients: clientsStr,
      status: "⚠️ Actual & Status Blank",
    });
    row.font = { name: "Segoe UI", size: 10 };
    row.getCell("status").font = { color: { argb: "DC2626" }, bold: true };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F5F3FF" } };
  });

  // Seniors
  seniors.forEach((s) => {
    const clientsStr = s.engagements.map((e) => e.companyName).join(", ");
    const row = sheet2.addRow({
      sr: empIdx++,
      name: s.name,
      role: s.role,
      count: `${s.engagements.length} Client Audits`,
      stepsCount: `${s.totalBlankSteps} Steps`,
      clients: clientsStr,
      status: "⚠️ Actual & Status Blank",
    });
    row.font = { name: "Segoe UI", size: 10 };
    row.getCell("status").font = { color: { argb: "DC2626" }, bold: true };
  });

  // Tab 3: The 17 FMS Process Steps SOP
  appendIaStepsProtocolSheet(workbook);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `AJC_Internal_Audit_Blank_Actual_Status_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), filename);
  return filename;
}

/**
 * Export Blank Actual & Status Audit Report to PDF (.pdf)
 */
export async function exportBlankActualStatusReportToPdf(unifiedList = []) {
  let list = Array.isArray(unifiedList) && unifiedList.length > 0 ? unifiedList : await fetchUnifiedInternalAuditData();
  const auditResult = auditBlankActualAndStatus(list);
  const { blankEngagements, partners, seniors, totalEngagementsAudited, totalEngagementsBlank } = auditResult;

  const doc = new jsPDF({ orientation: "landscape" });

  // Title Banner
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, 297, 22, "F");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("AGRAWAL JAIN & CO. — BLANK ACTUAL & STATUS AUDIT REPORT", 14, 11);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${new Date().toLocaleString("en-IN")} | Backlog: ${totalEngagementsBlank} of ${totalEngagementsAudited} Engagements (${partners.length} Partners + ${seniors.length} Seniors)`,
    14,
    18
  );

  // Table 1: Engagements with Blank Actual & Status
  const body1 = blankEngagements.map((item, idx) => [
    idx + 1,
    item.id || "-",
    item.partner || "-",
    item.senior || "-",
    item.groupName || "-",
    item.companyName || "-",
    item.iaPeriod || "-",
    item.startDate || "-",
    item.targetDate || "-",
    `${item.blankStepsCount} / ${item.totalStepsCount}`,
    "BLANK [No Date]",
    "BLANK [No Status]",
  ]);

  autoTable(doc, {
    startY: 26,
    head: [["#", "ID", "Partner", "Senior", "Group", "Company", "Period", "Start", "Target", "Blank Steps", "Actual Field", "Status Field"]],
    body: body1,
    theme: "striped",
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      10: { textColor: [220, 38, 38], fontStyle: "bold" },
      11: { textColor: [220, 38, 38], fontStyle: "bold" },
    },
  });

  // Table 2: Employee Summary (Backlog by Staff)
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 30;
  if (finalY > 165) {
    doc.addPage();
  }

  const startY2 = finalY > 165 ? 20 : finalY;
  doc.setFontSize(12);
  doc.setTextColor(15, 118, 110);
  doc.setFont("helvetica", "bold");
  doc.text("RESPONSIBLE EMPLOYEES SUMMARY (BACKLOG)", 14, startY2);

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
    startY: startY2 + 4,
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
      fontSize: 7.5,
      cellPadding: 2,
    },
  });

  const filename = `AJC_Blank_Actual_Status_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}

export const exportInternalAuditBlankActualStatusReportToPdf = exportBlankActualStatusReportToPdf;

/**
 * Generates Month-Wise or Specific-Month Internal Audit FMS Report for the AI Chatbot.
 */
export function getInternalAuditMonthlyReport(unifiedList = [], queryText = "") {
  const targetMonth = parseFmsTargetMonth(queryText);

  if (!unifiedList || unifiedList.length === 0) {
    return `🛡️ **Internal Audit FMS — Monthly Report**\n\nNo Internal Audit FMS engagements are currently loaded.`;
  }

  // Specific month requested (e.g., October, September, August, July)
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
        .slice(0, 8)
        .map((p) => `\`${p.period}\` (${p.total})`)
        .join(", ");
      const availDates = grouped.datedMonths
        .slice(0, 6)
        .map((m) => `\`${m.label}\` (${m.count})`)
        .join(", ");
      return (
        `🛡️ **Internal Audit FMS — ${targetMonth.label}**\n\n` +
        `No Internal Audit FMS engagements or scheduled cycles were found matching **${targetMonth.label}**.\n` +
        (availDates ? `\n• **Live Recorded Months:** ${availDates}` : "") +
        (availPeriods ? `\n• **Configured Audit Periods:** ${availPeriods}` : "")
      );
    }

    const matchedBlankAudit = auditBlankActualAndStatus(allMatched.map((x) => x.item));
    const partnerTally = {};
    allMatched.forEach(({ item }) => {
      const p = item.partner || "Unassigned";
      partnerTally[p] = (partnerTally[p] || 0) + 1;
    });
    const partnerLines = Object.entries(partnerTally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, cnt]) => `• **${name}**: ${cnt} engagement(s)`)
      .join("\n");

    let out = `🛡️ **Internal Audit FMS Report — ${targetMonth.label}**\n\n`;
    out += `• **Direct Cycle / Live-Date Matches (${targetMonth.label}):** ${directMatches.length} engagement(s)\n`;
    if (annualMatches.length > 0) {
      out += `• **Annual FY Retainers Covering ${targetMonth.shortLabel}:** ${annualMatches.length} engagement(s)\n`;
    }
    out += `• **Total Applicable in ${targetMonth.label}:** ${allMatched.length} (Blank Actual & Status: **${matchedBlankAudit.blankEngagements.length}**)\n`;

    if (directMatches.length > 0) {
      out += `\n**Active / Scheduled in ${targetMonth.label} (Direct & Cycle Matches):**\n`;
      directMatches.slice(0, 15).forEach(({ item, match }, i) => {
        out += `${i + 1}. **${item.companyName}** (${item.groupName || "-"}) — ${item.senior || "Lead CA"} | Partner: ${item.partner || "-"} • _${match.reasons.join(", ")}_\n`;
      });
      if (directMatches.length > 15) {
        out += `• _...and ${directMatches.length - 15} more direct matches in the Excel download._\n`;
      }
    } else {
      out += `\n**Annual FY Retainers Covering ${targetMonth.label}:**\n`;
      annualMatches.slice(0, 10).forEach(({ item, match }, i) => {
        out += `${i + 1}. **${item.companyName}** — ${item.senior || "Lead CA"} (${match.reasons.join(", ")})\n`;
      });
    }

    if (partnerLines) {
      out += `\n**Partner Distribution (${targetMonth.label}):**\n${partnerLines}\n`;
    }
    out += `\n[DOWNLOAD_INTERNAL_AUDIT_EXCEL:${targetMonth.key}]`;
    return out;
  }

  // General Month-Wise & Period Breakdown
  const grouped = groupFmsRecordsByPeriodAndMonth(unifiedList, "iaPeriod");
  const { quarterTotals, periodGroups, datedMonths } = grouped;
  const blankAudit = auditBlankActualAndStatus(unifiedList);

  let out = `🛡️ **Internal Audit FMS — Month & Cycle Wise Report**\n\n`;
  out += `• **Total Engagements:** ${unifiedList.length} | **Blank Actual & Status:** ${blankAudit.blankEngagements.length}\n`;
  out += `• **Cycle Distribution:** Q1 Apr-Jun (**${quarterTotals.Q1}**), Q2 Jul-Sep (**${quarterTotals.Q2}**), Q3 Oct-Dec (**${quarterTotals.Q3}**), Q4 Jan-Mar (**${quarterTotals.Q4}**), Half-Year (**${quarterTotals.HalfYear}**), Annual FY (**${quarterTotals.AnnualFY}**), Custom Ranges (**${quarterTotals.Range}**), General/Unscheduled (**${quarterTotals.General}**)\n`;

  if (datedMonths.length > 0) {
    out += `\n**Live Recorded Activity Months:**\n`;
    datedMonths.slice(0, 8).forEach((m) => {
      out += `• **${m.label}**: ${m.count} engagement(s) with Start/Target/Log date\n`;
    });
  }

  out += `\n**Top Configured Audit Periods:**\n`;
  periodGroups
    .filter((g) => g.period !== "General")
    .slice(0, 8)
    .forEach((g) => {
      out += `• **${g.period}**: ${g.total} engagement(s) (${g.liveCount} live)\n`;
    });

  out += `\n💡 _Tip: Ask **"October Internal Audit FMS"** or **"September IA FMS"** to export only that month's applicable engagements._\n[DOWNLOAD_INTERNAL_AUDIT_EXCEL:ALL]`;
  return out;
}

// Re-exports for 18 steps & Target Date Blank
export {
  auditFmsTargetDateBlank,
  auditTargetDateBlank,
  getFmsTargetDateBlankSummary,
  exportFmsTargetDateBlankReportToExcel,
  exportTargetDateBlankReportToExcel,
  exportFmsTargetDateBlankReportToPdf,
  exportTargetDateBlankReportToPdf,
  getFms18StepsGuideReport,
  get18StepsGuideReport,
} from "./fmsService";
