// src/utils/pmsFmsService.js
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { normalizeName } from "./attendanceConfig";

// --- STORAGE KEYS FOR PMS API CONFIGURATION & LOCAL FALLBACK RECORDS ---
const PMS_STORAGE_KEYS = {
  fmsApi: "ajc_pms_fms_api_url",
  masterApi: "ajc_pms_master_api_url",
  detailsApi: "ajc_pms_details_api_url",
  formSubmitApi: "ajc_pms_form_submit_api_url",
  localRecords: "ajc_pms_local_records",
};

// Default endpoints (leave blank until user configures their live PMS Apps Script URLs)
export const DEFAULT_PMS_API_CONFIG = {
  fmsApi: "",
  masterApi: "",
  detailsApi: "",
  formSubmitApi: "",
};

// --- THE 17 OFFICIAL PMS FMS PROCESS STEPS ---
export const PMS_17_STEPS = [
  {
    stepNo: 1,
    title: "STEP-1: PMS Planning & Objective Setting",
    owner: "PARTNERS",
    method: "Expected Start & End Date Form",
    when: "Beginning Of Financial Year",
    description: "Annual PMS cycle scheduling, goal/KRA framework setup, and initial milestone target setting.",
    deliverable: "Annual PMS Calendar & Scope Definition",
  },
  {
    stepNo: 2,
    title: "STEP-2: Stakeholder Intimation & Data Request",
    owner: "SENIOR",
    method: "Phone Call / Mail / Whatsapp",
    when: "Before Cycle Kick-off",
    description: "Formal communication with stakeholders / client management and circulation of preliminary data checklist.",
    deliverable: "Data Requisition & Readiness Checklist",
  },
  {
    stepNo: 3,
    title: "STEP-3: Team Allocation & Role Alignment",
    owner: "PARTNERS",
    method: "Online",
    when: "1 Week Before Start",
    description: "Review of assignment readiness, team member allocation, responsibility matrix, and briefing.",
    deliverable: "PMS Team Roster & Responsibility Matrix",
  },
  {
    stepNo: 4,
    title: "STEP-4: Process Blueprint & KPI Matrix",
    owner: "PARTNERS",
    method: "PMS Work Programme",
    when: "Planning Stage",
    description: "Formulation of customized KPI/KRA benchmarks, process controls matrix, and evaluation methodology.",
    deliverable: "Approved PMS Blueprint & KPI Matrix",
  },
  {
    stepNo: 5,
    title: "STEP-5: Pre-Execution Confirmation",
    owner: "SENIOR",
    method: "Email / Whatsapp",
    when: "1 Day Before Start",
    description: "Final confirmation with the coordinator regarding schedules, team availability, and document readiness.",
    deliverable: "Pre-Execution Readiness Confirmation",
  },
  {
    stepNo: 6,
    title: "STEP-6: Entry / Kick-off Meeting with HODs",
    owner: "SENIOR",
    method: "Meet HODs",
    when: "Cycle Start Day",
    description: "Formal kick-off meeting with department heads to align targets, timelines, and primary touchpoints.",
    deliverable: "Kick-off Minutes & Point of Contacts",
  },
  {
    stepNo: 7,
    title: "STEP-7: Execution & Daily Review",
    owner: "SENIOR",
    method: "Daily Review",
    when: "Daily",
    description: "Continuous tracking of PMS milestones, daily progress logging, and operational query resolution.",
    deliverable: "Daily Progress Sheets & Issue Log",
  },
  {
    stepNo: 8,
    title: "STEP-8: Partner Weekly PMS Review",
    owner: "PARTNERS",
    method: "Weekly Discussion",
    when: "Tuesday Review Meeting",
    description: "Weekly structured review by Engagement Partner during Tuesday Review Meeting to evaluate bottlenecks.",
    deliverable: "Weekly Review Memo & Bottleneck Escalation",
  },
  {
    stepNo: 9,
    title: "STEP-9: Draft Scorecard / Review Discussion",
    owner: "SENIOR",
    method: "Discuss Draft Report",
    when: "Before Final Review",
    description: "Walk-through of draft PMS findings and performance metrics with process owners to validate facts.",
    deliverable: "Draft PMS Scorecard with Process Owner Notes",
  },
  {
    stepNo: 10,
    title: "STEP-10: HOD Responses & Action Plan",
    owner: "SENIOR",
    method: "Take HOD Responses",
    when: "Before Submission",
    description: "Collection of department responses, Action Taken Plans (ATP), and commitment target dates.",
    deliverable: "Management Response & Action Matrix",
  },
  {
    stepNo: 11,
    title: "STEP-11: Exit Review & Executive Summary",
    owner: "PARTNERS",
    method: "Physical Meeting",
    when: "Executive Summary",
    description: "Closing review conference with leadership presenting executive scorecard, key outcomes, and improvements.",
    deliverable: "Executive Summary Deck & Review Protocol",
  },
  {
    stepNo: 12,
    title: "STEP-12: Promoters / Management Briefing",
    owner: "CRM",
    method: "Physical Meeting",
    when: "Owner Discussion",
    description: "Strategic briefing with promoters, Managing Director, or management regarding governance and KPIs.",
    deliverable: "Promoter Briefing Note & Relationship Feedback",
  },
  {
    stepNo: 13,
    title: "STEP-13: Leadership / Board Sign-Off",
    owner: "PARTNERS",
    method: "Board Meeting",
    when: "Final Discussion",
    description: "Formal presentation of final PMS evaluation before Leadership / Board for resolution and sign-off.",
    deliverable: "Signed Board Pack & Formal Approval",
  },
  {
    stepNo: 14,
    title: "STEP-14: Final Report & Scorecard Upload",
    owner: "SENIOR",
    method: "Executive Summary Upload",
    when: "After Completion",
    description: "Final sign-off, archiving, and upload of the complete PMS documentation onto the portal repository.",
    deliverable: "Final Signed & Numbered PMS Report",
  },
  {
    stepNo: 15,
    title: "STEP-15: Impact & Value Benefit Chart",
    owner: "SENIOR",
    method: "Benefit Chart Update",
    when: "Post Review",
    description: "Quantification of productivity gains, process savings, control improvements, and value realization.",
    deliverable: "PMS Benefit Chart & Value Realization Report",
  },
  {
    stepNo: 16,
    title: "STEP-16: Billing, Invoicing & Collection",
    owner: "Accounts Department",
    method: "Billing & Receipt",
    when: "After Report",
    description: "Generation of commercial invoice aligned with engagement terms and tracking payment realization.",
    deliverable: "Tax Invoice, Ledger Note & Receipt Voucher",
  },
  {
    stepNo: 17,
    title: "STEP-17: Cost Sheet & Cycle Closure",
    owner: "HR Head",
    method: "Cost Sheet",
    when: "Final Closure",
    description: "Post-cycle profitability evaluation, man-hours reconciliation, budget vs actual cost, and archive.",
    deliverable: "PMS Cost Sheet & Formal Closure Note",
  },
];

// --- IN-MEMORY CACHE ---
let cachedUnifiedPmsData = null;
let lastPmsFetchTimestamp = 0;
const CACHE_DURATION_MS = 60000;

export function invalidatePmsCache() {
  cachedUnifiedPmsData = null;
  lastPmsFetchTimestamp = 0;
}

/**
 * Retrieve persisted PMS Google Apps Script endpoints.
 */
export function getPmsApiConfig() {
  try {
    return {
      fmsApi: localStorage.getItem(PMS_STORAGE_KEYS.fmsApi) || DEFAULT_PMS_API_CONFIG.fmsApi,
      masterApi: localStorage.getItem(PMS_STORAGE_KEYS.masterApi) || DEFAULT_PMS_API_CONFIG.masterApi,
      detailsApi: localStorage.getItem(PMS_STORAGE_KEYS.detailsApi) || DEFAULT_PMS_API_CONFIG.detailsApi,
      formSubmitApi: localStorage.getItem(PMS_STORAGE_KEYS.formSubmitApi) || DEFAULT_PMS_API_CONFIG.formSubmitApi,
    };
  } catch {
    return { ...DEFAULT_PMS_API_CONFIG };
  }
}

/**
 * Persist PMS Google Apps Script endpoints and clear cache.
 */
export function savePmsApiConfig(config = {}) {
  const fields = ["fmsApi", "masterApi", "detailsApi", "formSubmitApi"];
  try {
    fields.forEach((field) => {
      const val = typeof config[field] === "string" ? config[field].trim() : "";
      if (val) {
        localStorage.setItem(PMS_STORAGE_KEYS[field], val);
      } else {
        localStorage.removeItem(PMS_STORAGE_KEYS[field]);
      }
    });
  } catch (err) {
    console.warn("Unable to save PMS API config to localStorage:", err);
  }
  invalidatePmsCache();
  return getPmsApiConfig();
}

/**
 * Clear all custom PMS API URLs.
 */
export function resetPmsApiConfig() {
  return savePmsApiConfig(DEFAULT_PMS_API_CONFIG);
}

/**
 * Check whether at least one live PMS Google Apps Script endpoint is configured.
 */
export function isPmsLiveApiConfigured() {
  const cfg = getPmsApiConfig();
  return Boolean(cfg.fmsApi || cfg.masterApi || cfg.detailsApi);
}

/**
 * Test connectivity to a Google Apps Script Web App URL.
 */
export async function testPmsConnection(url = "") {
  const cleanUrl = (url || "").trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    return { success: false, error: "URL must start with https:// or http://" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(cleanUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status} (${res.statusText || "Request failed"})` };
    }
    const data = await res.json();
    const rowCount = Array.isArray(data?.data)
      ? data.data.length
      : Array.isArray(data?.rows)
      ? data.rows.length
      : Array.isArray(data)
      ? data.length
      : 0;
    return { success: true, rowCount, data };
  } catch (err) {
    clearTimeout(timeout);
    return {
      success: false,
      error: err.name === "AbortError" ? "Connection timed out after 12s" : err.message,
    };
  }
}

// --- LOCAL STORAGE RECORDS (ALLOWS CREATING/UPDATING PMS ITEMS IMMEDIATELY EVEN BEFORE SHEET API IS CONNECTED) ---
export function getLocalPmsRecords() {
  try {
    const raw = localStorage.getItem(PMS_STORAGE_KEYS.localRecords);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createEmptySteps() {
  return PMS_17_STEPS.map((s) => ({
    ...s,
    planned: "",
    actual: "",
    status: "Pending",
    rawActual: "",
    rawStatus: "",
    delay: "",
  }));
}

/**
 * Save a new PMS assignment created via PmsForm into local storage and clear cache.
 */
export function addLocalPmsRecord(formData = {}) {
  const existing = getLocalPmsRecords();
  const timestamp = new Date().toISOString();
  const nextIndex = existing.length + 1;
  const record = {
    id: `PMS-L-${nextIndex}`,
    timestamp,
    groupName: (formData.groupName || "General").trim(),
    companyName: (formData.companyName || "").trim(),
    department: (formData.department || "PMS").trim(),
    pmsPeriod: (formData.pmsPeriod || "").trim(),
    partner: (formData.partner || "Unassigned").trim(),
    senior: (formData.senior || "Unassigned").trim(),
    assignmentType: (formData.assignmentType || "City").trim(),
    startDate: (formData.startDate || "").trim(),
    targetDate: (formData.targetDate || "").trim(),
    steps: createEmptySteps(),
    isLiveFms: false,
    source: "Local Portal",
  };

  try {
    localStorage.setItem(PMS_STORAGE_KEYS.localRecords, JSON.stringify([...existing, record]));
  } catch (err) {
    console.warn("Unable to save local PMS record:", err);
  }
  invalidatePmsCache();
  return record;
}

/**
 * Update step fields on a local PMS record so tracking can be maintained in-portal.
 */
export function updateLocalPmsStep(recordId, stepNo, stepPatch = {}) {
  const existing = getLocalPmsRecords();
  const updated = existing.map((rec) => {
    if (rec.id !== recordId) return rec;
    const steps = (rec.steps || createEmptySteps()).map((s) => {
      if (s.stepNo !== stepNo) return s;
      const rawActual = stepPatch.actual !== undefined ? String(stepPatch.actual).trim() : s.rawActual;
      const rawStatus = stepPatch.status !== undefined ? String(stepPatch.status).trim() : s.rawStatus;
      const planned = stepPatch.planned !== undefined ? String(stepPatch.planned).trim() : s.planned;
      const delay = stepPatch.delay !== undefined ? String(stepPatch.delay).trim() : s.delay;
      return {
        ...s,
        planned,
        actual: rawActual,
        rawActual,
        rawStatus,
        status: rawStatus || (rawActual ? "Completed" : planned ? "Planned" : "Pending"),
        delay,
      };
    });
    return { ...rec, steps };
  });

  try {
    localStorage.setItem(PMS_STORAGE_KEYS.localRecords, JSON.stringify(updated));
  } catch (err) {
    console.warn("Unable to update local PMS record:", err);
  }
  invalidatePmsCache();
  return updated.find((r) => r.id === recordId) || null;
}

// --- RAW ARRAY / OBJECT PARSING ---
async function safeFetchEndpoint(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Error fetching PMS endpoint:", err);
    return null;
  }
}

export async function fetchPmsMasterList() {
  const { masterApi } = getPmsApiConfig();
  const data = await safeFetchEndpoint(masterApi);
  if (!data) return [];
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.data)) return data.data;
  return Array.isArray(data) ? data : [];
}

export async function fetchPmsFMSData() {
  const { fmsApi } = getPmsApiConfig();
  const data = await safeFetchEndpoint(fmsApi);
  if (!data) return [];
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.rows)) return data.rows;
  return Array.isArray(data) ? data : [];
}

export async function fetchPmsDetailsList() {
  const { detailsApi } = getPmsApiConfig();
  const data = await safeFetchEndpoint(detailsApi);
  if (!data) return [];
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.rows)) return data.rows;
  return Array.isArray(data) ? data : [];
}

function parseStepsFromFmsRow(row) {
  return PMS_17_STEPS.map((step) => {
    const start = 11 + (step.stepNo - 1) * 4;
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

function normalizeObjectRecord(obj, idx, defaultSource = "Live FMS") {
  const pick = (...keys) => {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
        return String(obj[k]).trim();
      }
    }
    return "";
  };

  const companyName = pick("companyName", "CompanyName", "Company Name", "company", "clientName", "title");
  if (!companyName) return null;

  const steps = Array.isArray(obj.steps) && obj.steps.length > 0
    ? PMS_17_STEPS.map((base, sIdx) => {
        const match = obj.steps.find((s) => Number(s.stepNo) === base.stepNo) || obj.steps[sIdx] || {};
        const planned = String(match.planned || "").trim();
        const rawActual = String(match.rawActual ?? match.actual ?? "").trim();
        const rawStatus = String(match.rawStatus ?? match.status ?? "").trim();
        const delay = String(match.delay || "").trim();
        return {
          ...base,
          planned,
          actual: rawActual,
          rawActual,
          rawStatus,
          status: rawStatus || (rawActual ? "Completed" : planned ? "Planned" : "Pending"),
          delay,
        };
      })
    : createEmptySteps();

  return {
    id: pick("id", "ui", "UI", "pmsId") || `PMS-${idx + 1}`,
    timestamp: pick("timestamp", "Timestamp", "Time Stamp"),
    groupName: pick("groupName", "GroupName", "Group Name", "group") || "General",
    companyName,
    department: pick("department", "Department", "dept") || "PMS",
    pmsPeriod: pick("pmsPeriod", "period", "Period", "PMS Period", "iaPeriod") || "FY 2026-27",
    partner: pick("partner", "Partner", "Partner Incharge", "owner") || "Unassigned",
    senior: pick("senior", "Senior", "otherCA", "Other CA", "lead") || "Unassigned",
    assignmentType: pick("assignmentType", "AssignmentType", "Assignment Type", "type") || "City",
    startDate: pick("startDate", "StartDate", "Start Date"),
    targetDate: pick("targetDate", "TargetDate", "Target Date"),
    steps,
    isLiveFms: defaultSource === "Live FMS",
    source: defaultSource,
  };
}

/**
 * Convert unified PMS record back to the 2D array structure expected by FMS Master Grid & Step Cards.
 */
export function recordToFmsArrayRow(rec) {
  const base = [
    rec.id || "",
    rec.timestamp || "",
    rec.groupName || "",
    rec.companyName || "",
    rec.department || "",
    rec.pmsPeriod || "",
    rec.partner || "",
    rec.senior || "",
    rec.assignmentType || "",
    rec.startDate || "",
    rec.targetDate || "",
  ];
  const steps = rec.steps || createEmptySteps();
  steps.forEach((s) => {
    base.push(s.planned || "", s.rawActual || s.actual || "", s.rawStatus || s.status || "", s.delay || "");
  });
  return base;
}

/**
 * Build unified, structured PMS assignments combining Master List, Live FMS Steps, Details, and Local records.
 */
export async function fetchUnifiedPmsData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedUnifiedPmsData && now - lastPmsFetchTimestamp < CACHE_DURATION_MS) {
    return cachedUnifiedPmsData;
  }

  try {
    const [masterRows, fmsRows, detailsRows] = await Promise.all([
      fetchPmsMasterList(),
      fetchPmsFMSData(),
      fetchPmsDetailsList(),
    ]);

    const assignmentsMap = new Map();
    const makeKey = (company, period) => `${normalizeName(company)}__${(period || "general").toLowerCase()}`;

    // 1. Ingest Master Rows
    masterRows.forEach((r, idx) => {
      if (!r) return;
      if (!Array.isArray(r) && typeof r === "object") {
        const normalized = normalizeObjectRecord(r, idx, "Master");
        if (normalized) assignmentsMap.set(makeKey(normalized.companyName, normalized.pmsPeriod), normalized);
        return;
      }
      if (!r[1]) return;
      const groupName = String(r[0] || "General").trim();
      const companyName = String(r[1] || "").trim();
      const dept = String(r[2] || "PMS").trim();
      const period = String(r[3] || "General").trim();
      const partner = String(r[4] || "Unassigned").trim();
      const senior = String(r[5] || "Unassigned").trim();
      const assignmentType = String(r[6] || "City").trim();

      assignmentsMap.set(makeKey(companyName, period), {
        id: `PMS-M-${idx + 1}`,
        groupName,
        companyName,
        department: dept,
        pmsPeriod: period,
        partner,
        senior,
        assignmentType,
        startDate: "",
        targetDate: "",
        timestamp: "",
        steps: createEmptySteps(),
        isLiveFms: false,
        source: "Master",
      });
    });

    // 2. Ingest Live FMS Tracking Rows
    fmsRows.forEach((row, idx) => {
      if (!row) return;
      if (!Array.isArray(row) && typeof row === "object") {
        const normalized = normalizeObjectRecord(row, idx, "Live FMS");
        if (normalized) assignmentsMap.set(makeKey(normalized.companyName, normalized.pmsPeriod), normalized);
        return;
      }
      if (!row[3] || String(row[3]).trim() === "") return;

      const uiId = String(row[0] || `PMS-${idx + 1}`).trim();
      const timestamp = String(row[1] || "").trim();
      const groupName = String(row[2] || "General").trim();
      const companyName = String(row[3] || "").trim();
      const department = String(row[4] || "PMS").trim();
      const period = String(row[5] || "FY 2026-27").trim();
      const partner = String(row[6] || "Unassigned").trim();
      const senior = String(row[7] || "Unassigned").trim();
      const assignmentType = String(row[8] || "City").trim();
      const startDate = String(row[9] || "").trim();
      const targetDate = String(row[10] || "").trim();

      assignmentsMap.set(makeKey(companyName, period), {
        id: uiId,
        groupName,
        companyName,
        department,
        pmsPeriod: period,
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

    // 3. Ingest Details Rows
    detailsRows.forEach((r, idx) => {
      if (!r) return;
      if (!Array.isArray(r) && typeof r === "object") {
        const normalized = normalizeObjectRecord(r, idx, "Details");
        if (!normalized) return;
        const k = makeKey(normalized.companyName, normalized.pmsPeriod);
        if (assignmentsMap.has(k)) {
          const existing = assignmentsMap.get(k);
          if (normalized.startDate && !existing.startDate) existing.startDate = normalized.startDate;
          if (normalized.targetDate && !existing.targetDate) existing.targetDate = normalized.targetDate;
          if (normalized.timestamp && !existing.timestamp) existing.timestamp = normalized.timestamp;
        } else {
          assignmentsMap.set(k, normalized);
        }
        return;
      }
      if (!r[2]) return;
      const timestamp = String(r[0] || "").trim();
      const groupName = String(r[1] || "General").trim();
      const companyName = String(r[2] || "").trim();
      const period = String(r[3] || "FY 2026-27").trim();
      const partner = String(r[4] || "Unassigned").trim();
      const senior = String(r[5] || "Unassigned").trim();
      const assignmentType = String(r[6] || "City").trim();
      const startDate = String(r[7] || "").trim();
      const targetDate = String(r[8] || "").trim();

      const key = makeKey(companyName, period);
      if (assignmentsMap.has(key)) {
        const existing = assignmentsMap.get(key);
        if (startDate && !existing.startDate) existing.startDate = startDate;
        if (targetDate && !existing.targetDate) existing.targetDate = targetDate;
        if (timestamp && !existing.timestamp) existing.timestamp = timestamp;
      } else {
        assignmentsMap.set(key, {
          id: `PMS-D-${idx + 1}`,
          groupName,
          companyName,
          department: "PMS",
          pmsPeriod: period,
          partner,
          senior,
          assignmentType,
          startDate,
          targetDate,
          timestamp,
          steps: createEmptySteps(),
          isLiveFms: false,
          source: "Details",
        });
      }
    });

    // 4. Merge Local Records submitted in portal
    getLocalPmsRecords().forEach((localRec, idx) => {
      const normalized = normalizeObjectRecord(localRec, idx, "Local Portal");
      if (!normalized) return;
      const key = makeKey(normalized.companyName, normalized.pmsPeriod);
      if (!assignmentsMap.has(key)) {
        assignmentsMap.set(key, normalized);
      }
    });

    const unifiedList = Array.from(assignmentsMap.values());
    cachedUnifiedPmsData = unifiedList;
    lastPmsFetchTimestamp = now;
    return unifiedList;
  } catch (err) {
    console.error("Error building unified PMS data:", err);
    return cachedUnifiedPmsData || [];
  }
}

// --- ANALYTICS & CHATBOT SUMMARY GENERATORS ---
function buildNotConfiguredMessage(contextLabel = "PMS FMS") {
  return (
    `📊 **Agrawal Jain & Co. — ${contextLabel}**\n\n` +
    `• ⚠️ **No PMS Records Loaded Yet**: Live Google Apps Script URLs are not configured yet and no entries have been added locally.\n` +
    `• 🔧 **Quick Setup**: Open the **PMS** card on Admin MD Dashboard → click **⚙️ API Config** to connect your PMS Google Sheet Web App URLs, OR submit an assignment via **📝 PMS Form**.\n` +
    `• 📋 You can also ask *"Explain 17 steps of PMS FMS"* anytime to review the standard operating procedure!`
  );
}

/**
 * Firm-Wide Executive Overview of PMS FMS
 */
export function getPmsOverview(unifiedList = []) {
  if (!unifiedList || unifiedList.length === 0) {
    return (
      buildNotConfiguredMessage("PMS FMS Intelligence") +
      `\n\n[ACTION_CHIPS:Explain 17 steps of PMS FMS|📋 17 PMS Steps;Download PMS Blank Actual & Status Report|📥 Blank Report]\n\n[DOWNLOAD_PMS_EXCEL]`
    );
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
    if (item.pmsPeriod) {
      periodMap.set(item.pmsPeriod, (periodMap.get(item.pmsPeriod) || 0) + 1);
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

  let res = `📊 **Agrawal Jain & Co. — PMS FMS Intelligence**\n`;
  res += `• 🏢 **Total PMS Engagements**: **${total} assignments** across **${groupMap.size} corporate groups**\n`;
  res += `• 🏭 **Assignment Split**: **${cityCount} City** | **${plantCount} Plant** | **${otherCount} Other**\n`;
  res += `• 🔄 **Workflow System**: Structured **17-Step PMS Flow Management System (FMS)** from planning to cost sheet closure.\n\n`;

  if (partnerMap.size > 0) {
    res += `━━━━━━━━━━━━━━━━━━━━\n`;
    res += `👔 **1. Partner In-Charge Distribution**:\n`;
    Array.from(partnerMap.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([partner, count]) => {
        res += `• **${partner}**: **${count} PMS assignments**\n`;
      });
  }

  if (seniorMap.size > 0) {
    res += `\n👔 **2. Seniors & CA In-Charge (Top Leads)**:\n`;
    Array.from(seniorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .forEach(([senior, count]) => {
        res += `• **${senior}**: **${count} PMS assignments**\n`;
      });
  }

  if (periodMap.size > 0) {
    res += `\n📅 **3. PMS Cycle & Period Breakdown**:\n`;
    Array.from(periodMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([p, count]) => {
        res += `• **${p}**: **${count} assignments**\n`;
      });
  }

  res += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  res += `[ACTION_CHIPS:Explain 17 steps of PMS FMS|📋 17 PMS Steps;PMS blank actual and status report|🚨 PMS Blank Status;Download PMS FMS Report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_PMS_EXCEL]`;
  return res;
}

/**
 * Filter PMS Assignments Assigned to a specific Partner or Senior
 */
export function getPartnerOrSeniorPmsReport(unifiedList = [], nameQuery = "") {
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

  let res = `📋 **PMS FMS Engagements: ${displayName}**\n`;
  res += `• 📊 **Total Assigned PMS Items**: **${matched.length} engagements**\n`;
  if (partnerItems.length > 0) res += `• 👔 **Partner In-Charge**: ${partnerItems.length}\n`;
  if (seniorItems.length > 0) res += `• 👔 **Senior / Lead CA In-Charge**: ${seniorItems.length}\n`;
  res += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  matched.slice(0, 15).forEach((item, idx) => {
    const roleTag = partnerItems.includes(item) ? "Partner Incharge" : "Lead CA / Senior";
    res += `  ${idx + 1}. 🏢 **${item.companyName}** *(Group: ${item.groupName})*\n`;
    res += `     • 🗓️ Period: **${item.pmsPeriod}** | 📍 Type: **${item.assignmentType}**\n`;
    res += `     • 👤 Role: *${roleTag}* (Co-lead: ${roleTag === "Partner Incharge" ? item.senior : item.partner})\n`;
    if (item.startDate || item.targetDate) {
      res += `     • 📅 Dates: Start: ${item.startDate || "-"} | Target: ${item.targetDate || "-"}\n`;
    }
  });

  if (matched.length > 15) {
    res += `\n*...and ${matched.length - 15} more PMS engagements.*`;
  }

  res += `\n\n[ACTION_CHIPS:PMS FMS status|📊 All PMS;Explain 17 steps of PMS FMS|📋 17 PMS Steps;Download PMS FMS Report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_PMS_EXCEL]`;
  return res;
}

/**
 * Filter PMS Assignments by Type (Plant vs City)
 */
export function getPmsByTypeReport(unifiedList = [], typeQuery = "Plant") {
  const isPlant = /plant/i.test(typeQuery);
  const targetType = isPlant ? "Plant" : "City";
  const matched = unifiedList.filter((item) => (item.assignmentType || "").toLowerCase() === targetType.toLowerCase());

  if (unifiedList.length === 0) {
    return buildNotConfiguredMessage(`${targetType} PMS Assignments`);
  }

  let res = `🏭 **${targetType} PMS FMS Engagements** (${matched.length} Records)\n\n`;
  if (matched.length === 0) {
    res += `No **${targetType}** PMS records found in the current register.\n`;
  } else {
    matched.slice(0, 12).forEach((item, idx) => {
      res += `  ${idx + 1}. 🏢 **${item.companyName}** *(Group: ${item.groupName})*\n`;
      res += `     • 🗓️ Period: **${item.pmsPeriod}** | 👔 Partner: ${item.partner} | Senior: ${item.senior}\n`;
    });
    if (matched.length > 12) {
      res += `\n*...and ${matched.length - 12} more ${targetType} PMS engagements.*`;
    }
  }

  res += `\n\n[ACTION_CHIPS:PMS FMS status|📊 All PMS;PMS blank actual and status report|🚨 PMS Blank Status;Download PMS FMS Report|📥 Download Excel]`;
  return res;
}

/**
 * Detailed 17-Step SOP Guide for PMS FMS
 */
export function getPms17StepsGuideReport() {
  let res = `📋 **The Official 17-Step PMS Flow Management System (FMS)**\n`;
  res += `*Agrawal Jain & Co. Standard Operating Procedure (SOP)*\n\n`;
  res += `━━━━━━━━━━━━━━━━━━━━\n`;

  PMS_17_STEPS.forEach((s) => {
    res += `**${s.title}**\n`;
    res += `• 👤 **Owner**: **${s.owner}** | ⏰ **Timeline**: *${s.when}*\n`;
    res += `• 🛠️ **Method**: *${s.method}*\n`;
    res += `• 📌 **Description**: ${s.description}\n`;
    res += `• 📑 **Deliverable**: ${s.deliverable}\n\n`;
  });

  res += `━━━━━━━━━━━━━━━━━━━━\n`;
  res += `💡 *Every PMS cycle is tracked across these 17 milestones to monitor Planned vs Actual completion, status, and delays.*`;
  return res;
}

/**
 * Search PMS Assignment by Company or Group Name
 */
export function getClientOrGroupPmsReport(unifiedList = [], clientQuery = "") {
  const cleanQ = normalizeName(clientQuery);
  if (!cleanQ) return null;

  const matched = unifiedList.filter((item) => {
    const cleanComp = normalizeName(item.companyName);
    const cleanGroup = normalizeName(item.groupName);
    return (cleanComp && cleanComp.includes(cleanQ)) || (cleanGroup && cleanGroup.includes(cleanQ));
  });

  if (matched.length === 0) return null;

  const first = matched[0];
  let res = `🏢 **PMS Assignment: ${first.companyName}**\n`;
  res += `• 🏷️ **Group Name**: **${first.groupName}**\n`;
  res += `• 🗓️ **PMS Period**: **${first.pmsPeriod}**\n`;
  res += `• 📍 **Assignment Type**: **${first.assignmentType}**\n`;
  res += `• 👔 **Partner In-Charge**: **${first.partner}**\n`;
  res += `• 👔 **Lead CA / Senior**: **${first.senior}**\n`;
  if (first.startDate || first.targetDate) {
    res += `• 📅 **Schedule**: Start: **${first.startDate || "TBD"}** | Target: **${first.targetDate || "TBD"}**\n`;
  }

  res += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  res += `📊 **17-Step PMS Tracking Status**:\n`;
  const activeSteps = (first.steps || []).filter((s) => s.planned || s.actual || s.status !== "Pending");
  if (activeSteps.length > 0) {
    activeSteps.forEach((s) => {
      res += `• **${s.title}** [${s.owner}]: Status: **${s.status}** (Planned: ${s.planned || "-"}, Actual: ${s.actual || "-"}${s.delay ? `, Delay: ${s.delay}` : ""})\n`;
    });
  } else {
    res += `• 🚀 Initial PMS setup recorded. All 17 steps are currently awaiting Actual & Status updates.\n`;
  }

  res += `\n[ACTION_CHIPS:Explain 17 steps of PMS FMS|📋 17 PMS Steps;PMS FMS status|📊 All PMS;Download PMS FMS Report|📥 Download Excel]`;
  return res;
}

/**
 * Identify employees and PMS engagements where both "Actual" and "Status" fields are blank.
 */
export function auditPmsBlankActualAndStatus(unifiedList = []) {
  const employeesMap = new Map();
  const blankEngagements = [];

  unifiedList.forEach((item) => {
    const blankSteps = (item.steps || []).filter(
      (s) => (!s.rawActual || s.rawActual === "") && (!s.rawStatus || s.rawStatus === "")
    );
    if (blankSteps.length === 0) return;

    const record = {
      id: item.id,
      groupName: item.groupName,
      companyName: item.companyName,
      pmsPeriod: item.pmsPeriod,
      assignmentType: item.assignmentType,
      partner: item.partner || "Unassigned",
      senior: item.senior || "Unassigned",
      startDate: item.startDate || "-",
      targetDate: item.targetDate || "-",
      blankStepsCount: blankSteps.length,
      totalStepsCount: (item.steps || []).length || 17,
    };

    blankEngagements.push(record);

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
  };
}

/**
 * Chatbot summary for PMS engagements where Actual & Status are both blank.
 */
export function getPmsBlankActualAndStatusSummary(unifiedList = []) {
  if (!unifiedList || unifiedList.length === 0) {
    return (
      buildNotConfiguredMessage("PMS Blank Actual & Status Audit") +
      `\n\n[ACTION_CHIPS:PMS FMS status|📊 PMS Overview;Explain 17 steps of PMS FMS|📋 17 PMS Steps]\n\n[DOWNLOAD_PMS_BLANK_ACTUAL_STATUS_EXCEL]`
    );
  }

  const {
    totalEngagementsAudited,
    totalEngagementsBlank,
    totalEmployeesAffected,
    partners,
    seniors,
    blankEngagements,
  } = auditPmsBlankActualAndStatus(unifiedList);

  if (blankEngagements.length === 0) {
    return `✅ **PMS FMS Compliance Audit: All Actual & Status Fields Updated!**\n\n• Across all **${totalEngagementsAudited} PMS assignments**, all steps have recorded Actual and Status updates. 🎉`;
  }

  let res = `🚨 **PMS FMS: Blank Actual & Status Audit Report**\n`;
  res += `*Condition: Both "Actual" and "Status" fields are completely blank*\n\n`;
  res += `• 🏢 **PMS Assignments with Blank Actual & Status**: **${totalEngagementsBlank} of ${totalEngagementsAudited}** (${Math.round((totalEngagementsBlank / (totalEngagementsAudited || 1)) * 100)}% backlog)\n`;
  res += `• 👥 **Responsible Staff**: **${totalEmployeesAffected} Employees** (**${partners.length} Partners** + **${seniors.length} Seniors**)\n\n`;

  const formatOwnerGroup = (title, list) => {
    let out = `${title}\n`;
    if (list.length === 0) return out + `  *(None pending)*\n`;
    list.forEach((emp, idx) => {
      const sample = emp.engagements.slice(0, 3).map((e) => `**${e.companyName}** (${e.pmsPeriod})`).join(", ");
      out += `  ${idx + 1}. **${emp.name}** — **${emp.engagements.length} assignments** pending\n`;
      out += `     ↳ Clients: ${sample}${emp.engagements.length > 3 ? ` *(+${emp.engagements.length - 3} more)*` : ""}\n`;
    });
    return out;
  };

  res += `━━━━━━━━━━━━━━━━━━━━\n`;
  res += formatOwnerGroup("👔 **1. Partner In-Charge Backlog (Actual & Status Blank)**:", partners);
  res += `\n` + formatOwnerGroup("👔 **2. Seniors & Lead CAs Backlog (Actual & Status Blank)**:", seniors);

  res += `\n[ACTION_CHIPS:PMS FMS status|📊 PMS Overview;Explain 17 steps of PMS FMS|📋 17 PMS Steps;Download PMS Blank Actual & Status Report|📥 Download Excel]\n\n`;
  res += `[DOWNLOAD_PMS_BLANK_ACTUAL_STATUS_EXCEL]`;
  return res;
}

// --- SHARED EXCEL STYLING HELPER ---
function setupWorksheetBannerAndHeader(sheet, titleText, subtitleText, lastColLetter, bannerColorHex, headerColorHex) {
  sheet.spliceRows(1, 0, [[titleText], [subtitleText], []]);
  sheet.mergeCells(`A1:${lastColLetter}1`);
  sheet.mergeCells(`A2:${lastColLetter}2`);

  sheet.getCell("A1").font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: bannerColorHex } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 28;

  sheet.getCell("A2").font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "FFFFFF" } };
  sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: bannerColorHex } };
  sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

  const headerRow = sheet.getRow(4);
  headerRow.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColorHex } };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 26;
}

function appendStepsProtocolSheet(workbook) {
  const sheet = workbook.addWorksheet("17 Steps PMS Protocol", {
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
    "PMS FLOW MANAGEMENT SYSTEM (FMS) — 17 STEPS STANDARD PROTOCOL",
    "Agrawal Jain & Co. Standard Operating Procedure (SOP)",
    "G",
    "312E81",
    "4338CA"
  );

  PMS_17_STEPS.forEach((s) => sheet.addRow(s));
}

/**
 * Export complete PMS FMS register to Excel (.xlsx)
 */
export async function exportPmsFmsToExcel(unifiedList = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. ERP";
  workbook.created = new Date();

  const sheet1 = workbook.addWorksheet("PMS Assignments", {
    views: [{ showGridLines: true }],
  });

  sheet1.columns = [
    { header: "Sr.", key: "sr", width: 6 },
    { header: "PMS ID", key: "id", width: 16 },
    { header: "Group Name", key: "groupName", width: 22 },
    { header: "Company Name", key: "companyName", width: 34 },
    { header: "Department", key: "department", width: 18 },
    { header: "PMS Period", key: "pmsPeriod", width: 20 },
    { header: "Partner Incharge", key: "partner", width: 24 },
    { header: "Lead CA / Senior", key: "senior", width: 24 },
    { header: "Type", key: "assignmentType", width: 12 },
    { header: "Start Date", key: "startDate", width: 14 },
    { header: "Target Date", key: "targetDate", width: 14 },
  ];

  setupWorksheetBannerAndHeader(
    sheet1,
    "AGRAWAL JAIN & CO. — PMS FMS REGISTER",
    `Generated: ${new Date().toLocaleString("en-IN")} | Total PMS Engagements: ${unifiedList.length}`,
    "K",
    "4338CA",
    "1E3A8A"
  );

  unifiedList.forEach((item, idx) => {
    const row = sheet1.addRow({
      sr: idx + 1,
      id: item.id || `PMS-${idx + 1}`,
      groupName: item.groupName,
      companyName: item.companyName,
      department: item.department || "PMS",
      pmsPeriod: item.pmsPeriod,
      partner: item.partner,
      senior: item.senior,
      assignmentType: item.assignmentType,
      startDate: item.startDate || "-",
      targetDate: item.targetDate || "-",
    });
    row.font = { name: "Segoe UI", size: 10 };
    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EEF2FF" } };
    }
  });

  appendStepsProtocolSheet(workbook);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `AJC_PMS_FMS_Register_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), filename);
  return filename;
}

/**
 * Export PMS Blank Actual & Status Audit Report to Excel (.xlsx)
 */
export async function exportPmsBlankActualStatusReportToExcel(unifiedList = []) {
  const { blankEngagements, partners, seniors } = auditPmsBlankActualAndStatus(unifiedList);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. ERP";
  workbook.created = new Date();

  const sheet1 = workbook.addWorksheet("Blank Actual & Status PMS", {
    views: [{ showGridLines: true }],
  });

  sheet1.columns = [
    { header: "Sr.", key: "sr", width: 6 },
    { header: "PMS ID", key: "id", width: 16 },
    { header: "Partner Incharge", key: "partner", width: 24 },
    { header: "Lead CA / Senior", key: "senior", width: 24 },
    { header: "Group Name", key: "groupName", width: 22 },
    { header: "Company Name", key: "companyName", width: 34 },
    { header: "PMS Period", key: "pmsPeriod", width: 20 },
    { header: "Type", key: "assignmentType", width: 12 },
    { header: "Start Date", key: "startDate", width: 14 },
    { header: "Target Date", key: "targetDate", width: 14 },
    { header: "Blank Steps", key: "blankStepsCount", width: 14 },
    { header: "Actual Field Status", key: "actualField", width: 20 },
    { header: "Status Field Status", key: "statusField", width: 20 },
    { header: "Action Required", key: "actionRequired", width: 34 },
  ];

  setupWorksheetBannerAndHeader(
    sheet1,
    "AGRAWAL JAIN & CO. — PMS FMS BLANK ACTUAL & STATUS REPORT",
    `Generated: ${new Date().toLocaleString("en-IN")} | Engagements with Blank Actual & Status: ${blankEngagements.length}`,
    "N",
    "991B1B",
    "1E3A8A"
  );

  blankEngagements.forEach((item, idx) => {
    const row = sheet1.addRow({
      sr: idx + 1,
      id: item.id || `PMS-${idx + 1}`,
      partner: item.partner,
      senior: item.senior,
      groupName: item.groupName,
      companyName: item.companyName,
      pmsPeriod: item.pmsPeriod,
      assignmentType: item.assignmentType,
      startDate: item.startDate || "-",
      targetDate: item.targetDate || "-",
      blankStepsCount: `${item.blankStepsCount} / ${item.totalStepsCount} Steps`,
      actualField: "BLANK [No Date]",
      statusField: "BLANK [No Status]",
      actionRequired: "Actual Date & Status Update Required",
    });
    row.font = { name: "Segoe UI", size: 10 };
    row.getCell("actualField").font = { color: { argb: "DC2626" }, bold: true };
    row.getCell("statusField").font = { color: { argb: "DC2626" }, bold: true };
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
    { header: "Total Blank PMS Items", key: "count", width: 22 },
    { header: "Total Blank Steps", key: "stepsCount", width: 18 },
    { header: "Clients Handled", key: "clients", width: 50 },
    { header: "Compliance Status", key: "status", width: 22 },
  ];

  setupWorksheetBannerAndHeader(
    sheet2,
    "PMS EMPLOYEE SUMMARY — BLANK ACTUAL & STATUS",
    `Generated: ${new Date().toLocaleString("en-IN")} | Employees Affected: ${partners.length + seniors.length}`,
    "G",
    "4338CA",
    "1E3A8A"
  );

  let empIdx = 1;
  [...partners, ...seniors].forEach((emp) => {
    const row = sheet2.addRow({
      sr: empIdx++,
      name: emp.name,
      role: emp.role,
      count: `${emp.engagements.length} PMS Items`,
      stepsCount: `${emp.totalBlankSteps} Steps`,
      clients: emp.engagements.map((e) => e.companyName).join(", "),
      status: "⚠️ Actual & Status Blank",
    });
    row.font = { name: "Segoe UI", size: 10 };
    row.getCell("status").font = { color: { argb: "DC2626" }, bold: true };
    if (emp.category === "PARTNER") {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F5F3FF" } };
    }
  });

  appendStepsProtocolSheet(workbook);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `AJC_PMS_Blank_Actual_Status_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), filename);
  return filename;
}

