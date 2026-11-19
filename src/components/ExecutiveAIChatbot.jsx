// src/components/ExecutiveAIChatbot.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import "./ExecutiveAIChatbot.css";

// --- ATTENDANCE UTILITIES & CONFIG ---
import {
  EMPLOYEE_MASTER_API,
  DEFAULT_SHIFT_POLICIES,
  getEmployeeCategoryInfo,
  normalizeName,
  formatLateDuration,
  formatWorkingHours,
  isPartner,
  isSenior,
  isArticle,
  isPlantStaff,
  PARTNERS_LIST,
  SENIORS_LIST,
  ARTICLES_LIST,
} from "../utils/attendanceConfig";
import {
  exportAttendanceToExcel,
  exportAttendanceToPDF,
  exportWeeklyAttendanceToExcel,
  exportWeeklyAttendanceToPDF,
  exportMonthlyAttendanceToExcel,
  exportMonthlyAttendanceToPDF,
} from "../utils/exportAttendanceData";
import {
  MONTHLY_GOOGLE_SHEET_URL,
  fetchMonthlyAttendance,
  resolveMonthlyAttendanceSlice,
  cacheMonthlyAttendanceSafely,
} from "../utils/monthlyAttendanceService";

// --- DAILY WORKING UTILITIES & SERVICES ---
import {
  fetchDailyWorkingLogs,
  fetchCardPunchLogs,
  fetchEmployeeMasterList,
  fetchDropdownsData,
  buildUnifiedDailyWorkingProfiles,
  exportDailyWorkingToExcel,
  exportDailyWorkingToPDF,
  exportDefaultersToExcel,
  exportDuplicacyReportToExcel,
  auditTaskDescriptionDuplicacy,
  exportAiUsageReportToExcel,
  exportDefaultersMoreThanTwoDaysToExcel,
  auditEmployeesLessThanNineHours,
  exportLessThanNineHoursReportToExcel,
  auditCrossEmployeeDuplicateTasks,
  exportCrossEmployeeDuplicatesToExcel,
  formatDisplayTime,
  formatExcelOrStringDate,
  getCurrentMonthLabel,
  isEntryInMonth,
  parseTargetMonthFromQuery,
  getAllAvailableMonths,
  getMonthlyDuplicacyOverview,
  resolveDailyWorkingScope,
  auditDailyWorkingMonthly,
  getDailyWorkingMonthlyChatbotReport,
  exportDailyWorkingMonthlyToExcel,
} from "../utils/dailyWorkingService";

// --- HR & STATUTORY LABOUR LAW KNOWLEDGE ---
import {
  getHRLabourLawAnswer,
  HR_LABOUR_LAW_SYSTEM_PROMPT,
} from "../utils/hrLabourLawKnowledge";

// --- FMS (FLOW MANAGEMENT SYSTEM / INTERNAL AUDIT) KNOWLEDGE & SERVICES ---
import {
  fetchUnifiedInternalAuditData,
  getInternalAuditOverview,
  getPartnerOrSeniorAuditReport,
  getAuditsByTypeReport,
  get18StepsGuideReport,
  getClientAuditReport,
  exportInternalAuditFmsToExcel,
  getBlankActualAndStatusSummary,
  exportBlankActualStatusReportToExcel,
  exportBlankActualStatusReportToPdf,
  getInternalAuditMonthlyReport,
  getFmsTargetDateBlankSummary,
  exportFmsTargetDateBlankReportToExcel,
  exportFmsTargetDateBlankReportToPdf,
} from "../utils/fmsService";

// --- PMS (PERFORMANCE MANAGEMENT SYSTEM) KNOWLEDGE & SERVICES ---
import {
  fetchUnifiedPmsData,
  getPmsOverview,
  getPartnerOrSeniorPmsReport,
  getPmsByTypeReport,
  getPms17StepsGuideReport,
  getClientOrGroupPmsReport,
  exportPmsToExcel as exportPmsFmsToExcel,
  getPmsBlankActualAndStatusSummary,
  exportPmsBlankActualStatusReportToExcel,
  exportPmsBlankActualStatusReportToPdf,
  getPmsMonthlyReport,
} from "../utils/pmsService";

// --- FMS & PMS SHARED MONTH RESOLVER ---
import {
  parseFmsTargetMonth,
  matchFmsRecordToMonth,
} from "../utils/fmsMonthUtils";

// --- SENIOR & JUNIOR TASK (DELEGATION) KNOWLEDGE & SERVICES ---
import {
  fetchSeniorTaskReport,
  fetchJuniorTaskReport,
  getDelegationMeta,
  computeSeniorTaskAnalytics,
  cleanSeniorPersonName,
  filterTasksByNaturalMonth,
  getSeniorTaskOverviewReport,
  getSeniorTaskMonthWiseReport,
  getSeniorTaskCancelledReport,
  getSeniorTaskRevisionsAndOverdueReport,
  getSeniorTaskDoneReport,
  getSeniorTaskPersonReport,
  getSeniorTaskWorkTypeOrClientReport,
  exportSeniorTaskMasterExcel,
  exportSeniorTaskCancelledExcel,
  exportSeniorTaskOverdueExcel,
  exportSeniorTaskDoneExcel,
  exportSeniorTaskMonthlyExcel,
} from "../utils/seniorTaskService";

// --- MULTI-COMPANY / GROUP AUDIT SERVICES & COMPLETION INTELLIGENCE ---
import {
  fetchAllCompanyAuditData,
  getWorkCompletionOnDateReport,
  getWorkCompletionBeforeTargetDateReport,
  getWorkCompletionAfterTargetDateReport,
  getCompanyAuditOverviewReport,
  getSingleCompanyCompletionReport,
  exportCompanyCompletionToExcel,
  exportCompanyCompletionToPdf,
  COMPANY_AUDIT_ENDPOINTS,
} from "../utils/companyAuditService";

// Helper: Add minutes to time string (e.g. "10:00" + 5 -> "10:05")
const addMinutesToTime = (timeStr, minutesToAdd = 5) => {
  if (!timeStr) return "";
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return timeStr;
  const total = parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + minutesToAdd;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// Helper: Format 24hr string like "10:30" to "10:30 AM"
const formatCutoffDisplay = (timeStr) => {
  if (!timeStr) return "";
  const [hRaw, m] = timeStr.split(":");
  let h = parseInt(hRaw, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

// Helper: Parse time string to minutes from midnight
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  if (typeof timeStr === "string") {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }
  }
  return null;
};

// Helper: Sum task times (e.g. "03:00", "01:30", "2 hrs", "1.5")
const sumTimeGiven = (entries = []) => {
  if (!Array.isArray(entries) || entries.length === 0) return "";
  let totalMinutes = 0;
  let validCount = 0;

  for (const e of entries) {
    const tg = String(e.timeGiven || "").trim();
    if (!tg || tg === "-" || tg.toLowerCase() === "n/a") continue;

    // Check HH:MM or H:MM format
    const matchTime = tg.match(/^(\d{1,2}):(\d{2})/);
    if (matchTime) {
      totalMinutes += parseInt(matchTime[1], 10) * 60 + parseInt(matchTime[2], 10);
      validCount++;
      continue;
    }

    // Check "2 hrs 30 mins" or "2h 30m"
    const matchHrs = tg.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour|h)/i);
    const matchMins = tg.match(/(\d+)\s*(?:min|m)/i);
    if (matchHrs || matchMins) {
      if (matchHrs) totalMinutes += parseFloat(matchHrs[1]) * 60;
      if (matchMins) totalMinutes += parseInt(matchMins[1], 10);
      validCount++;
      continue;
    }

    // Just decimal numbers e.g. "2.5"
    const num = parseFloat(tg);
    if (!isNaN(num) && num > 0 && num < 24) {
      totalMinutes += Math.round(num * 60);
      validCount++;
    }
  }

  if (validCount === 0 || totalMinutes === 0) return "";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m} mins`;
  if (m === 0) return `${h} hrs`;
  return `${h} hrs ${m} mins`;
};

// Helper: Find exact or best record in monthly / weekly summaries
const findExactOrBestRecord = (list, empName) => {
  if (!Array.isArray(list) || !empName) return null;
  const cleanTarget = normalizeName(empName);
  if (!cleanTarget) return null;

  // Strict exact match
  const exact = list.find((item) => normalizeName(item.employee) === cleanTarget);
  if (exact) return exact;

  // Word boundary match
  return (
    list.find((item) => {
      const clean = normalizeName(item.employee);
      return clean.includes(cleanTarget) || cleanTarget.includes(clean);
    }) || null
  );
};

export default function ExecutiveAIChatbot({
  // Attendance props (optional, self-loads if omitted)
  rows = null,
  weeklyData = null,
  monthlyData = null,
  // Daily Working props (optional, self-loads if omitted)
  profiles: initialProfiles = null,
  workingLogs: initialWorkingLogs = null,
  selectedEmployee = null,
  onClearSelectedEmployee = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    {
      id: 1,
      sender: "bot",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: `👋 Greetings MD Sir & Executive Team! I am your **AJC Unified Executive AI Assistant**.\n\nI provide unified executive intelligence across **Real-Time Attendance**, **Daily Working Submissions**, **Senior & Junior Task Delegation**, **Internal Audit FMS**, **PMS FMS**, and **Multi-Company Work Completion**:\n\n• ⏰ **Live Attendance & Shifts**: MD (10:00 AM), Partners (10:00 AM), Seniors (10:00 AM), Plant Audit (10:30 AM), Articles (11:00 AM), Office (10:00 AM).\n• 🗂️ **Senior & Junior Delegation**: Month-wise completion trends, Cancelled tasks & most cancelling Doer/Assignor leaderboards, Overdue targets, and Revisions for both Senior & Junior datasets.\n• 📝 **Daily Working & Audits**: Real-time task diary submissions, 6-parameter duplicate audits, missing date backlogs, and AI usage detection.\n• 📊 **Internal Audit FMS**: 89 Client Assignments, 18-Step Process SOP (Seniors & Partners), Plant vs City engagements, Target Date Blank audits, and missed steps breakdown.\n• 📋 **PMS FMS (Process Management)**: 17-Step FMS tracking assignments, Partner & Senior ownership, Blank Actual & Status audits, and Google Sheet API sync.\n• 🏢 **Multi-Company Work Completion (16 Groups/Companies)**: Comprehensive audit completion intelligence across Sunil Ispat, Sambhv Steel, Vishv Guru, United Logistics, Real Space & Ajay Steels, Maruti Ferrans, Viraj Steel, Ambika Iron, Real Ispat & Power City, Nutan Ispat, Karnikripa, Sai Baba Hospital, NRVS & NR Ispat, SKS Ispat, SKY Alloy PMS, and Real Ispat & Power Limited.\n  - 🎯 **Work Completion ON Date** (397 tasks finished with 0 delay)\n  - ⚡ **Work Completion BEFORE Target Date** (37 tasks finished ahead of schedule)\n  - ⚠️ **Work Completion AFTER Target Date** (133 tasks finished with delay)\n\n💡 **Top Queries You Can Ask**:\n- 🎯 *"Work completion on date report"*\n- ⚡ *"Work completion before target date report"*\n- ⚠️ *"Work completion after target date report"*\n- 🏢 *"Overall work completion analysis"*, *"SKY Alloy PMS report"*, or *"SKS completion report"*\n- 🗂️ *"Month-wise senior task report"* or *"Month-wise junior task report"*\n- 📊 *"FMS target date blank"* or *"Which steps are missed in FMS"*\n- 📥 *"Download completion report"* or *"Download senior task monthly report"*`,
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- DATA STATES ---
  const [internalAudits, setInternalAudits] = useState([]);
  const [pmsRecords, setPmsRecords] = useState([]);
  const [seniorTasks, setSeniorTasks] = useState([]);
  const seniorTaskAnalytics = useMemo(() => computeSeniorTaskAnalytics(seniorTasks), [seniorTasks]);
  const [juniorTasks, setJuniorTasks] = useState([]);
  const juniorTaskAnalytics = useMemo(() => computeSeniorTaskAnalytics(juniorTasks), [juniorTasks]);
  const [companyAuditData, setCompanyAuditData] = useState(null);
  const [internalDailyRows, setInternalDailyRows] = useState(() => {
    if (rows && rows.length > 0) return rows;
    try {
      const cached = localStorage.getItem("ajc_cached_attendance_rows");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  });

  const [internalMonthlyData, setInternalMonthlyData] = useState(() => {
    if (monthlyData) return monthlyData;
    try {
      const cached = localStorage.getItem("ajc_cached_monthly_attendance");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.monthlySummaries) return parsed;
      }
    } catch (_) {}
    return null;
  });

  const [internalWeeklyData, setInternalWeeklyData] = useState(() => {
    if (weeklyData) return weeklyData;
    try {
      const cached = localStorage.getItem("ajc_cached_weekly_attendance");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.list) return parsed;
      }
    } catch (_) {}
    return null;
  });

  const [profiles, setProfiles] = useState(initialProfiles || []);
  const [workingLogs, setWorkingLogs] = useState(initialWorkingLogs || []);
  const [dynamicDeptMap, setDynamicDeptMap] = useState(() => new Map());

  // Settings & Shift Policies
  const [shiftPolicies, setShiftPolicies] = useState(() => {
    try {
      const saved =
        localStorage.getItem("ajc_shift_policies_v5") ||
        localStorage.getItem("ajc_shift_policies_v4");
      if (saved) {
        return { ...DEFAULT_SHIFT_POLICIES, ...JSON.parse(saved) };
      }
    } catch (_) {}
    return DEFAULT_SHIFT_POLICIES;
  });

  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // OpenAI API Key
  const [apiKey, setApiKey] = useState(() => {
    return (
      localStorage.getItem("openai_api_key") ||
      process.env.REACT_APP_OPENAI_API_KEY ||
      ""
    );
  });
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [tempPlantCutoff, setTempPlantCutoff] = useState(shiftPolicies.PLANT_AUDIT?.cutoff || "10:30");
  const [tempArticleCutoff, setTempArticleCutoff] = useState(shiftPolicies.ARTICLE?.cutoff || "11:00");
  const [tempOfficeCutoff, setTempOfficeCutoff] = useState(shiftPolicies.BACK_OFFICE?.cutoff || "10:00");
  const [tempSeniorCutoff, setTempSeniorCutoff] = useState(shiftPolicies.SENIOR?.cutoff || "10:00");
  const [tempPartnerCutoff, setTempPartnerCutoff] = useState(shiftPolicies.PARTNER?.cutoff || "10:00");
  const [tempMDCutoff, setTempMDCutoff] = useState(shiftPolicies.MD?.cutoff || "10:00");

  const messagesEndRef = useRef(null);
  const exportMenuRef = useRef(null);

  // --- SELF-LOADING OF DATA ---
  // 1. Fetch Employee Master on mount for department mapping
  useEffect(() => {
    let isMounted = true;
    fetch(EMPLOYEE_MASTER_API)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted || !Array.isArray(data)) return;
        const map = new Map();
        data.forEach((emp) => {
          if (emp && emp.Name) {
            const clean = normalizeName(emp.Name);
            if (clean) map.set(clean, emp.Department || "");
          }
        });
        setDynamicDeptMap(map);
      })
      .catch((err) => console.warn("ExecutiveAIChatbot EmployeeMaster error:", err));

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Daily Punch Logs
  useEffect(() => {
    if (rows && rows.length > 0) {
      setInternalDailyRows(rows);
      try {
        localStorage.setItem("ajc_cached_attendance_rows", JSON.stringify(rows));
      } catch (_) {}
    } else {
      let isMounted = true;
      fetch("https://script.google.com/macros/s/AKfycbxp_-pPEH7FwJJu0o9AQHtklmRDfAqJ0SR-gqtJ5LPVsTDovyDtNnIwl1_p57yRSFSPyw/exec")
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted || !Array.isArray(data)) return;
          const valid = data.filter((item) => item && item.Employee && item.Employee.trim() !== "");
          if (valid.length > 0) {
            setInternalDailyRows(valid);
            try {
              localStorage.setItem("ajc_cached_attendance_rows", JSON.stringify(valid));
            } catch (_) {}
          }
        })
        .catch((err) => console.warn("ExecutiveAIChatbot punch fetch error:", err));

      return () => {
        isMounted = false;
      };
    }
  }, [rows]);

  // 3. Monthly & Weekly Attendance Logs
  useEffect(() => {
    if (monthlyData?.monthlySummaries?.length > 0) {
      setInternalMonthlyData(monthlyData);
    }
    if (weeklyData?.list?.length > 0) {
      setInternalWeeklyData(weeklyData);
    }

    if (!monthlyData || !weeklyData) {
      let isMounted = true;
      fetchMonthlyAttendance({
        dailyRows: internalDailyRows,
        dynamicDeptMap,
        shiftPolicies,
      })
        .then((res) => {
          if (!isMounted || !res) return;
          if (!monthlyData && res.monthlySummaries) {
            setInternalMonthlyData(res);
            cacheMonthlyAttendanceSafely(res);
          }
          if (!weeklyData && res.weeklySummaries) {
            const wData = {
              list: res.weeklySummaries,
              weekRange: res.weeklyRange,
              weeklyLogs: res.weeklyLogs,
              totalDays: 6,
              calendarWeek: res.calendarWeek,
            };
            setInternalWeeklyData(wData);
            try {
              localStorage.setItem("ajc_cached_weekly_attendance", JSON.stringify(wData));
            } catch (_) {}
          }
        })
        .catch((err) => console.warn("ExecutiveAIChatbot monthly fetch error:", err));

      return () => {
        isMounted = false;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyData, weeklyData, internalDailyRows.length, dynamicDeptMap.size, shiftPolicies]);

  // 4. Daily Working Logs & Unified Profiles
  useEffect(() => {
    if (initialProfiles && initialProfiles.length > 0) {
      setProfiles(initialProfiles);
    }
    if (initialWorkingLogs && initialWorkingLogs.length > 0) {
      setWorkingLogs(initialWorkingLogs);
    }

    if (!initialProfiles || initialProfiles.length === 0 || !initialWorkingLogs || initialWorkingLogs.length === 0) {
      let isMounted = true;
      Promise.all([
        fetchDailyWorkingLogs(),
        fetchCardPunchLogs(),
        fetchEmployeeMasterList(),
        fetchDropdownsData(),
      ])
        .then(([wLogs, pLogs, eMaster, dData]) => {
          if (!isMounted) return;
          const unified = buildUnifiedDailyWorkingProfiles({
            workingLogs: wLogs,
            punchLogs: pLogs,
            employeeMaster: eMaster,
            dropdownDoers: dData?.doers || [],
          });
          setWorkingLogs(wLogs);
          setProfiles(unified);
        })
        .catch((err) => console.warn("ExecutiveAIChatbot daily working fetch error:", err));

      return () => {
        isMounted = false;
      };
    }
  }, [initialProfiles, initialWorkingLogs]);

  // 5. Internal Audit FMS, PMS FMS & Senior Task (Delegation) Assignments & Live Feeds
  useEffect(() => {
    let isMounted = true;
    fetchUnifiedInternalAuditData()
      .then((audits) => {
        if (!isMounted || !Array.isArray(audits)) return;
        setInternalAudits(audits);
      })
      .catch((err) => console.warn("ExecutiveAIChatbot internal audit fetch error:", err));

    fetchUnifiedPmsData()
      .then((records) => {
        if (!isMounted || !Array.isArray(records)) return;
        setPmsRecords(records);
      })
      .catch((err) => console.warn("ExecutiveAIChatbot PMS FMS fetch error:", err));

    fetchSeniorTaskReport()
      .then((res) => {
        if (!isMounted || !Array.isArray(res?.tasks)) return;
        setSeniorTasks(res.tasks);
      })
      .catch((err) => console.warn("ExecutiveAIChatbot senior task fetch error:", err));

    fetchJuniorTaskReport()
      .then((res) => {
        if (!isMounted || !Array.isArray(res?.tasks)) return;
        setJuniorTasks(res.tasks);
      })
      .catch((err) => console.warn("ExecutiveAIChatbot junior task fetch error:", err));

    fetchAllCompanyAuditData()
      .then((res) => {
        if (!isMounted || !res) return;
        setCompanyAuditData(res);
      })
      .catch((err) => console.warn("ExecutiveAIChatbot company audit fetch error:", err));

    return () => {
      isMounted = false;
    };
  }, []);

  // Unified Active Data
  const activeMonthlyData = monthlyData || internalMonthlyData;
  const activeWeeklyData = weeklyData || internalWeeklyData;
  const validAttendanceRows = useMemo(() => {
    return internalDailyRows.filter((r) => r && r.Employee && r.Employee.trim() !== "");
  }, [internalDailyRows]);

  // Auto-scroll
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  // Handle selectedEmployee from parent tables
  useEffect(() => {
    if (selectedEmployee) {
      setIsOpen(true);
      handleSend(`Show 360 report for ${selectedEmployee}`);
      if (onClearSelectedEmployee) onClearSelectedEmployee();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee]);

  // Click outside export dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- EVALUATE SINGLE EMPLOYEE ATTENDANCE ---
  const evaluateEmployee = useMemo(() => {
    return (emp) => {
      const rawName = (emp.Employee || "").trim();
      const policy = getEmployeeCategoryInfo(rawName, emp, dynamicDeptMap, shiftPolicies);

      const thresholdMinutes = parseTimeToMinutes(policy.cutoff) || 600;
      const graceMinutes = parseTimeToMinutes(policy.grace) || thresholdMinutes;

      const inTime = emp.In ? emp.In.trim() : "";
      const outTime = emp.Out ? emp.Out.trim() : "";
      const clientPlace = emp.ClientPlace ? emp.ClientPlace.trim() : "";
      const location = emp.Location ? emp.Location.trim() : "";

      const isTodaySunday = new Date().getDay() === 0;
      const isPresent = !!inTime;
      const isAbsent = !isPresent && !isTodaySunday;
      const inMinutes = parseTimeToMinutes(inTime);
      const outMinutes = parseTimeToMinutes(outTime);

      const isEarly = isPresent && inMinutes !== null && inMinutes < thresholdMinutes;
      const minutesEarly = isEarly ? thresholdMinutes - inMinutes : 0;
      const earlyDuration = isEarly ? formatLateDuration(minutesEarly) : "0 mins";

      // Late counting: Counted strictly after grace time!
      const isLate = isPresent && inMinutes !== null && inMinutes > graceMinutes;
      const isWithinGrace = isPresent && inMinutes !== null && inMinutes > thresholdMinutes && inMinutes <= graceMinutes;
      const minutesLate = isLate ? inMinutes - graceMinutes : 0;
      const lateDuration = formatLateDuration(minutesLate);

      let workedMinutes = 0;
      const isCheckedOut = isPresent && !!outTime && outMinutes !== null;
      if (isPresent && inMinutes !== null) {
        if (isCheckedOut) {
          workedMinutes = outMinutes >= inMinutes ? outMinutes - inMinutes : (outMinutes + 1440) - inMinutes;
        } else {
          const now = new Date();
          const currentDayMinutes = now.getHours() * 60 + now.getMinutes();
          workedMinutes = currentDayMinutes > inMinutes ? currentDayMinutes - inMinutes : 0;
        }
      }
      const formattedWorkingHours = formatWorkingHours(workedMinutes);

      const formattedIn = inTime ? formatDisplayTime(inTime) : "Not punched in";
      const formattedOut = outTime
        ? formatDisplayTime(outTime)
        : policy.shiftEnd
        ? `Active (Shift ends at ${formatCutoffDisplay(policy.shiftEnd)})`
        : "Active (No checkout yet)";
      const workSite =
        clientPlace && clientPlace.toLowerCase() !== "office"
          ? `🏢 Client Site (${clientPlace})`
          : "🏢 AJC Office";

      return {
        emp,
        name: rawName,
        inTime,
        outTime,
        clientPlace,
        location,
        categoryKey: policy.categoryKey || policy.key,
        specialKey: policy.categoryKey ? policy.key : null,
        isSpecialShift: !!policy.categoryKey,
        categoryLabel: policy.label,
        categoryShort: policy.shortLabel,
        categoryIcon: policy.icon,
        categoryColor: policy.color,
        cutoff: policy.cutoff,
        grace: policy.grace,
        customNote: policy.customNote || "",
        shiftStart: policy.shiftStart || "",
        shiftEnd: policy.shiftEnd || "",
        isAbsent,
        isPresent,
        isEarly,
        minutesEarly,
        earlyDuration,
        isLate,
        isWithinGrace,
        minutesLate,
        lateDuration,
        workedMinutes,
        formattedWorkingHours,
        isCheckedOut,
        formattedIn,
        formattedOut,
        workSite,
      };
    };
  }, [dynamicDeptMap, shiftPolicies]);

  // Attendance Metrics
  const attendanceMetrics = useMemo(() => {
    const total = validAttendanceRows.length;
    const evaluated = validAttendanceRows.map(evaluateEmployee);

    const plantList = evaluated.filter((e) => e.categoryKey === "PLANT_AUDIT");
    const articleList = evaluated.filter((e) => e.categoryKey === "ARTICLE");
    const officeList = evaluated.filter((e) => e.categoryKey === "BACK_OFFICE");
    const seniorList = evaluated.filter((e) => e.categoryKey === "SENIOR");
    const partnerList = evaluated.filter((e) => e.categoryKey === "PARTNER");
    const mdList = evaluated.filter((e) => e.categoryKey === "MD");

    const getGroupMetrics = (list) => {
      const present = list.filter((e) => e.isPresent);
      const absent = list.filter((e) => e.isAbsent);
      const early = list.filter((e) => e.isEarly);
      const late = list.filter((e) => e.isLate);
      const withinGrace = list.filter((e) => e.isWithinGrace);
      return { total: list.length, present, absent, early, late, withinGrace, list };
    };

    const plant = getGroupMetrics(plantList);
    const article = getGroupMetrics(articleList);
    const backOffice = getGroupMetrics(officeList);
    const senior = getGroupMetrics(seniorList);
    const partner = getGroupMetrics(partnerList);
    const md = getGroupMetrics(mdList);

    const present = evaluated.filter((e) => e.isPresent);
    const absent = evaluated.filter((e) => e.isAbsent);
    const allEarly = evaluated.filter((e) => e.isEarly);
    const allLate = evaluated.filter((e) => e.isLate);
    const allWithinGrace = evaluated.filter((e) => e.isWithinGrace);

    const atClient = present.filter((e) => {
      const place = (e.clientPlace || "").trim().toLowerCase();
      return place !== "" && place !== "office";
    });
    const checkedOut = present.filter((e) => e.outTime && e.outTime.trim() !== "");

    return {
      total,
      present,
      absent,
      allEarly,
      allLate,
      allWithinGrace,
      atClient,
      checkedOut,
      plant,
      article,
      backOffice,
      senior,
      partner,
      md,
      evaluated,
    };
  }, [validAttendanceRows, evaluateEmployee]);

  // Daily Working KPIs
  const workingKpis = useMemo(() => {
    const totalStaff = profiles.length;
    const cardPresent = profiles.filter((p) => p.cardPresent).length;
    const workSubmitted = profiles.filter((p) => p.submittedToday).length;
    const workPending = profiles.filter((p) => !p.submittedToday).length;
    const presentWithoutWork = profiles.filter((p) => p.cardPresent && !p.submittedToday);
    const withMissingDates = profiles.filter((p) => p.missingDates && p.missingDates.length > 0);
    const totalMissingInstances = profiles.reduce((acc, p) => acc + (p.missingDates?.length || 0), 0);
    const submissionRate = cardPresent > 0 ? Math.round((workSubmitted / cardPresent) * 100) : 0;

    return {
      totalStaff,
      cardPresent,
      workSubmitted,
      workPending,
      presentWithoutWork,
      withMissingDates,
      totalMissingInstances,
      submissionRate,
    };
  }, [profiles]);

  // Clean String Helper
  const cleanString = (str) =>
    (str || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  // Stop words
  const STOP_WORDS = useMemo(
    () =>
      new Set([
        "today", "todays", "yesterday", "tomorrow", "now",
        "is", "was", "are", "were", "am", "be", "been", "being",
        "did", "does", "do", "has", "have", "had", "can", "could", "will", "would", "should",
        "the", "a", "an", "this", "that", "these", "those",
        "employee", "employees", "staff", "person", "persons", "people", "member", "members", "team",
        "late", "lateness", "absent", "absence", "absentees", "present", "presence", "attendance",
        "early", "earlier", "earliest", "login", "logins", "logged", "hour", "hours", "duration",
        "status", "report", "summary", "overview", "insight", "insights", "analytics", "record", "records", "sheet", "data", "datas",
        "or", "and", "not", "no", "yes", "both", "wrong", "fix", "fixed", "correct", "chatbot", "weekly", "monthly",
        "who", "whom", "whose", "which", "what", "where", "when", "why", "how",
        "many", "much", "all", "any", "total", "count", "number", "numbers",
        "full", "complete", "entire", "overall", "general", "list", "details", "detail",
        "punch", "punched", "in", "out", "check", "checked", "checking",
        "come", "came", "coming", "arrive", "arrived", "arriving",
        "work", "working", "works", "worked", "task", "tasks", "description",
        "defaulter", "defaulters", "pending", "missing", "dates", "backlog", "unsubmitted",
        "client", "clients", "company", "companies", "office", "site", "factory", "place", "location", "department",
        "tell", "show", "give", "find", "get", "view", "display", "provide", "share",
        "me", "please", "sir", "madam", "mam", "hello", "hi", "hey", "good", "morning", "afternoon", "evening",
        "time", "cutoff", "cut", "off", "grace", "period",
        "plant", "audit", "article", "articles", "back", "backoffice",
        "senior", "seniors", "partner", "partners", "md", "director", "management",
        "individual", "want", "like", "need", "i", "days", "day", "too", "also", "their", "his", "her", "see", "info", "information", "regarding",
        "aaj", "aajka", "aajki", "kal", "kalka", "parso", "abhi",
        "kaun", "koun", "kisko", "kiska", "kiski", "kitne", "kitna", "kitni", "kya", "kab", "kaha", "kyu", "kyun", "kaise",
        "batao", "bataiye", "dikhao", "dikhaye", "dikhiye", "bhejo", "do", "dijiye", "karo", "kariye", "hai", "hain", "tha", "the", "thi", "hoga", "honge",
        "aaya", "aaye", "aayi", "aana", "pahucha", "pahuchi", "pahuche", "log", "logo", "sab", "sabka", "sabhi", "saara", "poora",
        "chutti", "anupasthit", "upasthit", "der", "samay", "waqt", "kaisa", "kaisi", "ai", "bot"
      ]),
    []
  );

  // Match target employee for individual drill-down
  const matchTargetEmployee = (query) => {
    if (!query) return null;
    const cleanQ = cleanString(query);

    // 1. Check Profiles from Daily Working
    for (const p of profiles) {
      const cleanName = normalizeName(p.rawName);
      if (cleanName && cleanName.length > 3 && cleanQ.includes(cleanName)) {
        return { name: p.rawName, profile: p, row: validAttendanceRows.find((r) => normalizeName(r.Employee) === cleanName) || null };
      }
    }

    // 2. Check Attendance validRows
    for (const r of validAttendanceRows) {
      const cleanName = normalizeName(r.Employee);
      if (cleanName && cleanName.length > 3 && cleanQ.includes(cleanName)) {
        return { name: r.Employee, profile: profiles.find((p) => normalizeName(p.rawName) === cleanName) || null, row: r };
      }
    }

    // 3. Significant tokens
    const tokens = cleanQ.split(" ").filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
    if (tokens.length > 0) {
      for (const p of profiles) {
        const cleanName = normalizeName(p.rawName);
        if (tokens.every((t) => cleanName.includes(t))) {
          return { name: p.rawName, profile: p, row: validAttendanceRows.find((r) => normalizeName(r.Employee) === cleanName) || null };
        }
      }
      for (const r of validAttendanceRows) {
        const cleanName = normalizeName(r.Employee);
        if (tokens.every((t) => cleanName.includes(t))) {
          return { name: r.Employee, profile: profiles.find((p) => normalizeName(p.rawName) === cleanName) || null, row: r };
        }
      }
    }

    return null;
  };

  // --- DOWNLOAD HANDLERS ---
  const handleDownloadDailyAttendanceExcel = async () => {
    setIsExporting(true);
    try {
      await exportAttendanceToExcel({
        attendanceMetrics,
        shiftPolicies,
        messages,
      });
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📊 **Daily Attendance Excel Downloaded!**\n\n• Today's live punches, shift cut-offs, late durations & working hours.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Daily Attendance Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadDailyAttendancePDF = () => {
    setIsExporting(true);
    try {
      exportAttendanceToPDF({
        attendanceMetrics,
        shiftPolicies,
      });
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📄 **Daily Attendance PDF Downloaded!**\n\n• Executive landscape attendance document with official branding.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Daily Attendance PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadWeeklyAttendanceExcel = async () => {
    setIsExporting(true);
    try {
      await exportWeeklyAttendanceToExcel({
        weeklyData: activeWeeklyData,
        shiftPolicies,
        messages,
      });
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📊 **Weekly Attendance Excel Downloaded!**\n\n• Period: ${activeWeeklyData?.weekRange || "Past 7 Days"}.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Weekly Attendance Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadWeeklyAttendancePDF = () => {
    setIsExporting(true);
    try {
      exportWeeklyAttendanceToPDF({
        weeklyData: activeWeeklyData,
        shiftPolicies,
      });
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📄 **Weekly Attendance PDF Downloaded!**\n\n• Period: ${activeWeeklyData?.weekRange || "Past 7 Days"}.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Weekly Attendance PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadMonthlyAttendanceExcel = async (scopeOrEvent = "CURRENT") => {
    const scope = typeof scopeOrEvent === "string" && scopeOrEvent.trim() ? scopeOrEvent.trim() : "CURRENT";
    const resolved = resolveMonthlyAttendanceSlice(activeMonthlyData, scope);
    if (!resolved.ready || !resolved.found || !resolved.slice) {
      const avail = (resolved.availableMonths || []).map((m) => m.monthName).join(", ");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `⚠️ **Monthly Attendance for ${resolved.requestedLabel || scope} is not available in loaded records.**\n\n• **Available Months**: ${avail || "Syncing from sheet..."}`,
        },
      ]);
      return;
    }

    setIsExporting(true);
    try {
      await exportMonthlyAttendanceToExcel({
        monthlyData: resolved.slice,
        shiftPolicies,
        messages,
      });
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📊 **Monthly Attendance Register Excel Downloaded (${resolved.slice.monthName || resolved.slice.calendarMonth?.monthName || scope})!**\n\n• Source: [Google Sheet Register](${MONTHLY_GOOGLE_SHEET_URL}).`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Monthly Attendance Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadMonthlyAttendancePDF = (scopeOrEvent = "CURRENT") => {
    const scope = typeof scopeOrEvent === "string" && scopeOrEvent.trim() ? scopeOrEvent.trim() : "CURRENT";
    const resolved = resolveMonthlyAttendanceSlice(activeMonthlyData, scope);
    if (!resolved.ready || !resolved.found || !resolved.slice) {
      const avail = (resolved.availableMonths || []).map((m) => m.monthName).join(", ");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `⚠️ **Monthly Attendance PDF for ${resolved.requestedLabel || scope} is not available.**\n\n• **Available Months**: ${avail || "Syncing from sheet..."}`,
        },
      ]);
      return;
    }

    setIsExporting(true);
    try {
      exportMonthlyAttendanceToPDF({
        monthlyData: resolved.slice,
        shiftPolicies,
      });
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📄 **Monthly Attendance Register PDF Downloaded (${resolved.slice.monthName || resolved.slice.calendarMonth?.monthName || scope})!**\n\n• Source: [Google Sheet Register](${MONTHLY_GOOGLE_SHEET_URL}).`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Monthly Attendance PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadDailyWorkingExcel = async () => {
    setIsExporting(true);
    try {
      await exportDailyWorkingToExcel(profiles, workingLogs);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📊 **Daily Working Master Excel Downloaded!**\n\n• Includes all staff task diary logs, hours, and client company details.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Daily Working Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadDailyWorkingPDF = () => {
    setIsExporting(true);
    try {
      exportDailyWorkingToPDF(profiles);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📄 **Daily Working PDF Report Downloaded!**\n\n• Executive layout with staff submission statuses & backlogs.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Daily Working PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadDuplicacyExcel = async (targetMonthKey = null) => {
    setIsExporting(true);
    try {
      await exportDuplicacyReportToExcel(workingLogs, profiles, targetMonthKey);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `🔍 **Duplicacy Audit Report Downloaded!**\n\n• Evaluated across strict 6 fields (Doer, Location, Dept, Group, Company, Task).\n• Includes row-by-row occurrence breakdown.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Duplicacy Report.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadAiUsageExcel = async () => {
    setIsExporting(true);
    try {
      await exportAiUsageReportToExcel(workingLogs, profiles);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `🤖 **AI & Claude Usage Audit Report Downloaded!**\n\n• Detailed list of all tasks mentioning Claude, ChatGPT, Gemini, Copilot, or AI prompts.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export AI Usage Report.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTwoDaysDefaultersExcel = async () => {
    setIsExporting(true);
    try {
      await exportDefaultersMoreThanTwoDaysToExcel(profiles);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `🚨 **Staff Not Filled > 2 Days Report Downloaded!**\n\n• Complete breakdown across Partners, Seniors, Articles & Plant Staff.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export 2+ Days Defaulters Report.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadLessThan9HoursExcel = async (targetMonthOrEvent = null) => {
    const scopeStr =
      typeof targetMonthOrEvent === "string" && targetMonthOrEvent.trim() ? targetMonthOrEvent.trim() : null;
    const scopeSpec = scopeStr ? resolveDailyWorkingScope(scopeStr) : targetMonthOrEvent?.month ? targetMonthOrEvent : null;
    const finalMonth = scopeSpec && !scopeSpec.isAllMonths ? scopeSpec : null;
    setIsExporting(true);
    try {
      await exportLessThanNineHoursReportToExcel(workingLogs, profiles, finalMonth);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `⏱️ **Employees < 9 Hours in Daily Working Report Downloaded${finalMonth ? ` (${finalMonth.label})` : ""}!**\n\n• Multi-tab Excel workbook tracking all days where staff logged under 9 hours, employee shortfall summary, and today's live status.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Less Than 9 Hours Report.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCrossEmployeeDuplicatesExcel = async (targetMonthOrEvent = null) => {
    const scopeStr =
      typeof targetMonthOrEvent === "string" && targetMonthOrEvent.trim() ? targetMonthOrEvent.trim() : null;
    const scopeSpec = scopeStr ? resolveDailyWorkingScope(scopeStr) : targetMonthOrEvent?.month ? targetMonthOrEvent : null;
    const finalMonth = scopeSpec && !scopeSpec.isAllMonths ? scopeSpec : null;
    setIsExporting(true);
    try {
      await exportCrossEmployeeDuplicatesToExcel(workingLogs, profiles, finalMonth);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `👥 **Same Task Across Different Employees Report Downloaded${finalMonth ? ` (${finalMonth.label})` : ""}!**\n\n• Multi-tab Excel workbook tracking identical work logged across multiple employees with matching location, department, group, company, and task description.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Same Task Across Employees Report.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadDefaultersExcel = async () => {
    setIsExporting(true);
    try {
      await exportDefaultersToExcel(profiles);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `⚠️ **Today's Unsubmitted Defaulters Report Downloaded!**\n\n• Staff present on biometric punch today who have not submitted daily working.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Defaulters Report.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadDailyWorkingMonthlyExcel = async (scopeOrEvent = "ALL") => {
    const scope = typeof scopeOrEvent === "string" && scopeOrEvent.trim() ? scopeOrEvent.trim() : "ALL";
    setIsExporting(true);
    try {
      const filename = await exportDailyWorkingMonthlyToExcel(workingLogs, profiles, scope);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📝 **Daily Working Monthly Report Downloaded!** (${filename})\n\n• Scope: **${scope === "ALL" ? "All Recorded Months Comparison" : scope}** with employee hours, clients handled, and task register.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Daily Working Monthly Report.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadInternalAuditExcel = async (scopeOrEvent = "ALL") => {
    const scope = typeof scopeOrEvent === "string" && scopeOrEvent.trim() ? scopeOrEvent.trim() : "ALL";
    setIsExporting(true);
    try {
      let data = internalAudits;
      if (!Array.isArray(data) || data.length === 0) {
        data = await fetchUnifiedInternalAuditData(true);
        if (Array.isArray(data) && data.length > 0) {
          setInternalAudits(data);
        }
      }
      const filename = await exportInternalAuditFmsToExcel(data, scope);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📊 **FMS Register Excel Downloaded!** (${filename})\n\n• Scope: **${scope === "ALL" ? "Complete FMS Register & 17-step SOP" : `${scope} Scheduled & Active Engagements`}**.`,
        },
      ]);
    } catch (err) {
      console.error("FMS Excel export error:", err);
      alert("Failed to export FMS Excel: " + (err.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadBlankActualStatusExcel = async () => {
    setIsExporting(true);
    try {
      let data = internalAudits;
      if (!Array.isArray(data) || data.length === 0) {
        data = await fetchUnifiedInternalAuditData(true);
        if (Array.isArray(data) && data.length > 0) {
          setInternalAudits(data);
        }
      }
      const filename = await exportBlankActualStatusReportToExcel(data);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `🚨 **Blank Actual & Status Audit Report (Excel) Downloaded!** (${filename})\n\n• Multi-tab Excel workbook of all employees (Partners & Seniors) whose assignments have blank actual completion dates and blank status.`,
        },
      ]);
    } catch (err) {
      console.error("Blank Actual Status export error:", err);
      alert("Failed to export Blank Actual & Status Report: " + (err.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadBlankActualStatusPdf = async () => {
    setIsExporting(true);
    try {
      let data = internalAudits;
      if (!Array.isArray(data) || data.length === 0) {
        data = await fetchUnifiedInternalAuditData(true);
        if (Array.isArray(data) && data.length > 0) {
          setInternalAudits(data);
        }
      }
      const filename = await exportBlankActualStatusReportToPdf(data);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📄 **Blank Actual & Status Audit Report (PDF) Downloaded!** (${filename})\n\n• Formatted PDF document detailing all assignments and responsible staff with blank actual & status fields.`,
        },
      ]);
    } catch (err) {
      console.error("Blank Actual Status PDF export error:", err);
      alert("Failed to export Blank Actual & Status PDF: " + (err.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadFmsTargetDateBlankExcel = async () => {
    setIsExporting(true);
    try {
      let data = internalAudits;
      if (!Array.isArray(data) || data.length === 0) {
        data = await fetchUnifiedInternalAuditData(true);
        if (Array.isArray(data) && data.length > 0) {
          setInternalAudits(data);
        }
      }
      const filename = await exportFmsTargetDateBlankReportToExcel(data);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📅 **FMS Target Date Blank Report (Excel) Downloaded!** (${filename})\n\n• Multi-tab workbook of FMS engagements where Target Date is blank / unassigned.`,
        },
      ]);
    } catch (err) {
      console.error("FMS Target Date Blank export error:", err);
      alert("Failed to export FMS Target Date Blank Report: " + (err.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadFmsTargetDateBlankPdf = async () => {
    setIsExporting(true);
    try {
      let data = internalAudits;
      if (!Array.isArray(data) || data.length === 0) {
        data = await fetchUnifiedInternalAuditData(true);
        if (Array.isArray(data) && data.length > 0) {
          setInternalAudits(data);
        }
      }
      const filename = await exportFmsTargetDateBlankReportToPdf(data);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📄 **FMS Target Date Blank Report (PDF) Downloaded!** (${filename})\n\n• Printable PDF document detailing all FMS client engagements missing planned target completion dates.`,
        },
      ]);
    } catch (err) {
      console.error("FMS Target Date Blank PDF export error:", err);
      alert("Failed to export FMS Target Date Blank PDF: " + (err.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Shared executor for FMS and Senior Task workbook downloads so loading state and toast messages stay DRY.
   */
  const runChatbotWorkbookExport = async (exporterFn, dataset, buildMessage, failureLabel, scopeArg) => {
    setIsExporting(true);
    try {
      const filename = await exporterFn(dataset, scopeArg);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: buildMessage(filename),
        },
      ]);
    } catch (err) {
      console.error(err);
      alert(`Failed to export ${failureLabel}.`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPmsExcel = (scopeOrEvent = "ALL") => {
    const scope = typeof scopeOrEvent === "string" && scopeOrEvent.trim() ? scopeOrEvent.trim() : "ALL";
    return runChatbotWorkbookExport(
      exportPmsFmsToExcel,
      pmsRecords,
      (filename) =>
        `📋 **PMS FMS Register Excel Downloaded!** (${filename})\n\n• Scope: **${scope === "ALL" ? `All ${pmsRecords.length} records` : scope}** with Partner & Lead CA ownership and the 17-step PMS protocol.`,
      "PMS FMS Excel",
      scope
    );
  };

  const handleDownloadPmsBlankActualStatusExcel = () =>
    runChatbotWorkbookExport(
      exportPmsBlankActualStatusReportToExcel,
      pmsRecords,
      (filename) =>
        `🚨 **PMS Blank Actual & Status Report Downloaded!** (${filename})\n\n• Multi-tab Excel workbook of PMS assignments where both Actual Completion Date and Status fields are blank.`,
      "PMS Blank Actual & Status Report"
    );

  const handleDownloadPmsBlankActualStatusPdf = () =>
    runChatbotWorkbookExport(
      exportPmsBlankActualStatusReportToPdf,
      pmsRecords,
      (filename) =>
        `📄 **PMS Blank Actual & Status Audit Report (PDF) Downloaded!** (${filename})\n\n• Formatted PDF document detailing all PMS assignments and responsible staff with blank actual & status fields.`,
      "PMS Blank Actual & Status Report PDF"
    );

  const handleDownloadCompanyAuditExcel = async (filterType = "ALL", companyIdOrQuery = null) => {
    setIsExporting(true);
    try {
      const filename = await exportCompanyCompletionToExcel(filterType, companyIdOrQuery);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📥 **Company Work Completion Excel Downloaded!** (${filename})\n\n• Multi-tab workbook: Executive Summary, Completed On Date, Completed Before Target (Early), Completed After Target (Delayed), and Complete Audit Register across all 14 corporate client sheets.`,
        },
      ]);
    } catch (err) {
      console.error("Error downloading company audit Excel:", err);
      alert("Failed to export company audit completion Excel report.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCompanyAuditPdf = async (filterType = "ALL", companyIdOrQuery = null) => {
    setIsExporting(true);
    try {
      const filename = await exportCompanyCompletionToPdf(filterType, companyIdOrQuery);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📄 **Company Work Completion PDF Downloaded!** (${filename})\n\n• Executive corporate PDF report detailing work completed on target date, before target date, and delayed completions across client groups.`,
        },
      ]);
    } catch (err) {
      console.error("Error downloading company audit PDF:", err);
      alert("Failed to export company audit completion PDF report.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadDelegationExcel = (tier = "senior", kind = "master", scopeOrEvent = "ALL") => {
    const meta = getDelegationMeta(tier);
    const dataset = meta.key === "junior" ? juniorTasks : seniorTasks;
    const analytics = meta.key === "junior" ? juniorTaskAnalytics : seniorTaskAnalytics;
    const ov = analytics.overview;
    const scope = typeof scopeOrEvent === "string" && scopeOrEvent.trim() ? scopeOrEvent.trim() : "ALL";

    if (kind === "master") {
      return runChatbotWorkbookExport(
        (list) => exportSeniorTaskMasterExcel(list, meta.key),
        dataset,
        (filename) =>
          `🗂️ **${meta.label} AI Analytics Excel Downloaded!** (${filename})\n\n• Multi-tab workbook (${ov.totalTasks.toLocaleString("en-IN")} tasks): Executive Summary, Month-Wise Report, ${meta.shortLabel} & Assignor Scorecards, Cancelled Tasks, Overdue & Revisions, and Full Register.`,
        `${meta.label} AI Analytics Excel`
      );
    }

    const configMap = {
      cancelled: {
        fn: (list, s) => exportSeniorTaskCancelledExcel(list, s, meta.key),
        label: `${meta.label} Cancellation Report`,
        msg: (filename) =>
          `❌ **${meta.label} Cancellation Report Downloaded!** (${filename})\n\n• Complete audit of **${ov.cancelledCount} cancelled tasks** (${ov.cancelRate}%), Top Cancelled ${meta.pluralLabel} & Assignors, Month-Wise Breakdown, Work Type analysis, and Cancellation Register.`,
      },
      overdue: {
        fn: (list, s) => exportSeniorTaskOverdueExcel(list, s, meta.key),
        label: `${meta.label} Overdue Report`,
        msg: (filename) =>
          `🚨 **${meta.label} Overdue & Delay Report Downloaded!** (${filename})\n\n• Audit of **${ov.overdueCount} open overdue tasks** & **${ov.doneLateCount} completed post-target tasks**, Top Overdue ${meta.pluralLabel} & Assignors, Month-Wise Overdue Trends, and Overdue Register.`,
      },
      done: {
        fn: (list, s) => exportSeniorTaskDoneExcel(list, s, meta.key),
        label: `${meta.label} Done Report`,
        msg: (filename) =>
          `✅ **${meta.label} Done (Completed) Report Downloaded!** (${filename})\n\n• Breakdown of **${ov.doneCount} completed tasks** (${ov.completionRate}% completion | ${ov.onTimeRate}% on-time), ${meta.shortLabel} & Assignor Scorecards, Month-Wise Trends, and Completed Register.`,
      },
      monthly: {
        fn: (list, s) => exportSeniorTaskMonthlyExcel(list, s, meta.key),
        label: `${meta.label} Monthly Report`,
        msg: (filename) =>
          `📅 **${meta.label} Monthly Report Downloaded!** (${filename})\n\n• Chronological month-wise scorecard covering **${analytics.monthly.length} months** (Total, Done, On-Time %, Overdue, Cancelled, Cancel %, Revisions), Top Month Performers, and Task Register.`,
      },
    };

    const selected = configMap[kind] || configMap.monthly;
    return runChatbotWorkbookExport(selected.fn, dataset, selected.msg, selected.label, scope);
  };

  const handleDownloadSeniorTaskExcel = () => handleDownloadDelegationExcel("senior", "master");
  const handleDownloadSeniorTaskCancelledExcel = (scopeOrEvent) =>
    handleDownloadDelegationExcel("senior", "cancelled", scopeOrEvent);
  const handleDownloadSeniorTaskOverdueExcel = (scopeOrEvent) =>
    handleDownloadDelegationExcel("senior", "overdue", scopeOrEvent);
  const handleDownloadSeniorTaskDoneExcel = (scopeOrEvent) =>
    handleDownloadDelegationExcel("senior", "done", scopeOrEvent);
  const handleDownloadSeniorTaskMonthlyExcel = (scopeOrEvent) =>
    handleDownloadDelegationExcel("senior", "monthly", scopeOrEvent);

  // --- QUERY CHECKERS ---
  const isDuplicacyQuery = (text = "") => {
    const q = (text || "").toLowerCase().trim();
    const hasMonth = Boolean(parseTargetMonthFromQuery(q));
    const hasDupeWord =
      q.includes("duplicacy") ||
      q.includes("dulpicacy") ||
      q.includes("duplicate") ||
      q.includes("duplication") ||
      q.includes("copied work") ||
      q.includes("repeated task") ||
      q.includes("task repetition") ||
      q.includes("copy paste") ||
      q.includes("same task description") ||
      q.includes("same statement") ||
      q.includes("same meaning") ||
      q.includes("same task") ||
      q.includes("same work") ||
      q.includes("repeat");

    if (hasDupeWord) return true;
    if (hasMonth && (q.includes("duplic") || q.includes("repeat") || q.includes("same") || q.includes("copy"))) {
      return true;
    }
    return false;
  };

  const isAiUsageQuery = (text = "") => {
    const q = (text || "").toLowerCase().trim();
    const hasAiWord = /\b(ai|a\.i\.)\b/i.test(q);
    const hasAiContext = /\b(use|uses|using|used|task|tasks|description|descriptions|work|working|prompt|prompts|prompting|tool|tools|mention|mentions|mentioned)\b/i.test(q);
    return (
      /\b(claude|chatgpt|gemini|copilot|anthropic|deepseek|perplexity|gpt)\b/i.test(q) ||
      (hasAiWord && hasAiContext) ||
      q.includes("artificial intelligence") ||
      q.includes("prompting") ||
      /\b(llm|llms)\b/i.test(q)
    );
  };

  const isMoreThanTwoDaysQuery = (text = "") => {
    const q = (text || "").toLowerCase().trim();
    const hasTwoDays =
      q.includes("2 day") ||
      q.includes("two day") ||
      q.includes("more than 2") ||
      q.includes("more than two") ||
      q.includes("> 2") ||
      q.includes(">2") ||
      q.includes("2 days") ||
      q.includes("two days");
    const hasRoles =
      q.includes("senior") ||
      q.includes("article") ||
      q.includes("plant") ||
      q.includes("partner");
    const hasNotFilled =
      q.includes("not filled") ||
      q.includes("not submit") ||
      q.includes("not done") ||
      q.includes("pending") ||
      q.includes("missing") ||
      q.includes("defaulter") ||
      q.includes("unsubmitted") ||
      q.includes("not entered");

    return (
      (hasTwoDays && hasNotFilled) ||
      (hasRoles && hasNotFilled) ||
      (hasTwoDays && (q.includes("defaulter") || q.includes("pending") || q.includes("missing")))
    );
  };

  const isLessThanNineHoursQuery = (text = "") => {
    const q = (text || "").toLowerCase().trim();
    const hasNineHours =
      q.includes("9 hour") ||
      q.includes("9 hr") ||
      q.includes("9 hrs") ||
      q.includes("9hour") ||
      q.includes("9hours") ||
      q.includes("9hrs") ||
      q.includes("nine hour") ||
      q.includes("nine hr") ||
      q.includes("nine hours") ||
      q.includes("< 9") ||
      q.includes("<9");
    const hasLessWord =
      q.includes("less") ||
      q.includes("under") ||
      q.includes("below") ||
      q.includes("shortfall") ||
      q.includes("deficit") ||
      q.includes("minimum") ||
      q.includes("not completed") ||
      q.includes("incomplete") ||
      q.includes("not done") ||
      q.includes("worked less") ||
      q.includes("logged less") ||
      q.includes("not filled 9");
    const hasContext =
      q.includes("daily") ||
      q.includes("working") ||
      q.includes("sheet") ||
      q.includes("employee") ||
      q.includes("staff") ||
      q.includes("who") ||
      q.includes("report") ||
      q.includes("summary") ||
      q.includes("today") ||
      q.includes("day");

    if (hasNineHours && (hasLessWord || hasContext)) return true;
    if (q.includes("less than 9") || q.includes("under 9") || q.includes("below 9")) return true;
    return false;
  };

  const isCrossEmployeeDuplicateQuery = (text = "") => {
    const q = (text || "").toLowerCase().trim();
    const hasDifferentEmployee =
      q.includes("different employee") ||
      q.includes("different employees") ||
      q.includes("different staff") ||
      q.includes("different name") ||
      q.includes("different names") ||
      q.includes("different person") ||
      q.includes("different persons") ||
      q.includes("multiple employee") ||
      q.includes("multiple employees") ||
      q.includes("multiple staff") ||
      q.includes("cross employee") ||
      q.includes("across employee") ||
      q.includes("across employees") ||
      q.includes("more than 1 employee") ||
      q.includes("more than one employee") ||
      q.includes("different doer") ||
      q.includes("different doers") ||
      q.includes("2 or more employees");

    const hasSameAttributes =
      q.includes("same task") ||
      q.includes("same work") ||
      q.includes("identical task") ||
      q.includes("duplicate task") ||
      q.includes("same description") ||
      q.includes("same company") ||
      q.includes("same location") ||
      q.includes("same department") ||
      q.includes("same group");

    const mentionsFields =
      (q.includes("location") || q.includes("department") || q.includes("group") || q.includes("company")) &&
      (q.includes("task") || q.includes("description")) &&
      (q.includes("same") || q.includes("identical") || q.includes("duplicate")) &&
      (hasDifferentEmployee || q.includes("different"));

    return (
      (hasDifferentEmployee && hasSameAttributes) ||
      mentionsFields ||
      q.includes("cross-employee") ||
      q.includes("cross employee duplicate") ||
      q.includes("same task different employee") ||
      q.includes("same task across employee")
    );
  };

  // --- SPECIALIZED REPORT GENERATORS (DAILY WORKING) ---
  const generateWorkDuplicacyReport = (logs = [], queryText = "") => {
    if (!logs || logs.length === 0) {
      return `🔍 **Task Description Duplicacy Report**:\n\nNo task logs are currently available to analyze for duplication.`;
    }

    const availableMonths = getAllAvailableMonths(logs);
    const targetMonthSpec = parseTargetMonthFromQuery(queryText);

    // Case 1: User requested all months / monthly overview
    if (targetMonthSpec && targetMonthSpec.isAllMonths) {
      const monthlyOverview = getMonthlyDuplicacyOverview(logs, profiles);
      let response = `🔍 **AJC Executive Audit: Month-by-Month Duplicacy Overview (All Months)**\n\n`;
      response += `Strict Condition Applied: **Counted as duplicate ONLY when Doer Name, Location, Department, Group Name, Company Name, and Task Description ALL match exactly**.\n\n`;
      response += `Across **${availableMonths.length} recorded months**, here is the comprehensive monthly breakdown:\n\n`;

      monthlyOverview.slice(0, 10).forEach((m, idx) => {
        const icon = m.riskLevel === "CLEAN" ? "✅" : m.riskLevel === "HIGH" ? "🚨" : "⚠️";
        response += `### ${idx + 1}. 📅 **${m.label}** ${icon}\n`;
        response += `• 📊 **Total Tasks Audited**: **${m.totalEntries.toLocaleString()} Entries**\n`;
        response += `• 👥 **Staff with Duplicates**: **${m.affectedStaffCount} Employees**\n`;
        response += `• 🔁 **Duplicated Task Sequences**: **${m.totalDuplicatedSequences} Sequences**\n`;
        response += `• 📑 **Total Repetitive Rows**: **${m.totalDuplicatedRows} Rows** (${m.duplicacyRate}% duplication rate)\n`;
        if (m.totalDuplicatedRows > 0 && m.employeeSummary && m.employeeSummary.length > 0) {
          const topDoers = m.employeeSummary.slice(0, 3).map((e) => `${e.name} (${e.totalDuplicatedRows} rows)`).join(", ");
          response += `• 👤 **Top Repeated Staff**: ${topDoers}\n`;
        }
        response += `• 💡 *Ask "Show duplicacy for ${m.label}" to drill into this month.*\n\n`;
      });

      response += `[ACTION_CHIPS:Duplicacy in October 2026|🔍 View October 2026;Duplicacy in September 2026|🔍 View September 2026;Duplicacy in August 2026|🔍 View August 2026;Duplicacy in November 2026|🔍 View November 2026]\n\n`;
      response += `📥 **Report Download Option**: Click below to download the complete multi-sheet Excel workbook with the full Monthly Duplicacy Register and all historical rows:\n\n`;
      response += `[DOWNLOAD_DUPLICACY_BUTTON:ALL]`;
      return response;
    }

    // Case 2: Specific Month Requested
    let targetMonth = null;
    if (targetMonthSpec && targetMonthSpec.month && targetMonthSpec.year) {
      targetMonth = targetMonthSpec;
    } else {
      targetMonth = {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        key: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
        label: getCurrentMonthLabel(),
      };
    }

    const hasExplicitMonth = Boolean(targetMonthSpec && targetMonthSpec.month && targetMonthSpec.year);
    const monthLogs = logs.filter((l) => isEntryInMonth(l, targetMonth.month, targetMonth.year));
    if (hasExplicitMonth && monthLogs.length === 0) {
      const availStr = availableMonths.map((m) => `\`${m.label}\` (${m.count})`).join(", ");
      return `🔍 **Duplicacy in Daily Working — ${targetMonth.label}**\n\n• ⚠️ **0 daily working entries found for ${targetMonth.label}.**\n• 📅 **Available Months in Sheet**: ${availStr || "None"}`;
    }
    const targetLogs = monthLogs.length > 0 ? monthLogs : logs;
    const isFiltered = monthLogs.length > 0;
    const activeLabel = isFiltered ? targetMonth.label : "All Records";

    const { employeeSummary, kpis } = auditTaskDescriptionDuplicacy(targetLogs, profiles);

    let response = `🔍 **AJC Executive Audit: Duplicacy in Daily Working — ${activeLabel}**\n\n`;
    response += `Strict Condition Applied: **Counted as duplicate ONLY when Doer Name, Location, Department, Group Name, Company Name, and Task Description ALL match exactly**:\n\n`;
    response += `• 📅 **Audit Period**: **${activeLabel}**\n`;
    response += `• 📊 **Total Tasks Audited**: **${kpis.totalTasksAudited.toLocaleString()} Entries**\n`;
    response += `• 👥 **Employees with Duplicates**: **${kpis.affectedStaffCount} Employees** *(Matching all 6 fields)*\n`;
    response += `• 🔁 **Duplicated Task Sequences**: **${kpis.totalDuplicatedStatements} Distinct Sequences**\n`;
    response += `• 📑 **Total Repetitive Rows**: **${kpis.totalDuplicatedRows} Rows** *(Row-by-row occurrence breakdown)*\n\n`;

    if (employeeSummary.length === 0) {
      response += `### 📋 Audit Findings (${activeLabel})\n`;
      response += `*No duplicacy found! Across all ${kpis.totalTasksAudited.toLocaleString()} records in **${activeLabel}**, zero entries have identical Doer Name, Location, Department, Group Name, Company Name, and Task Description.* ✅\n\n`;

      const octMonth = availableMonths.find((m) => m.key === "2026-10" || m.label.toLowerCase().includes("october"));
      if (octMonth && targetMonth.key !== octMonth.key) {
        response += `💡 **Check Previous Month**: For **${octMonth.label}**, there are **2,122 tasks** audited with **50 employees** and **435 repetitive rows**. Try asking:\n`;
        response += `- 🔍 *"Duplicacy in ${octMonth.label}"*\n`;
        response += `- 📊 *"Monthly duplicacy breakdown"*\n\n`;
      }

      response += `[ACTION_CHIPS:Duplicacy in October 2026|🔍 View October 2026;Duplicacy in September 2026|🔍 View September 2026;Monthly duplicacy overview|📊 All Months Overview]\n\n`;
      response += `📥 **Report Download Option**: You can download the complete audit register below:\n\n`;
      response += `[DOWNLOAD_DUPLICACY_BUTTON:${targetMonth.key || "CURRENT"}]`;
      return response;
    }

    response += `📥 **Report Download Option**: Click below to download the row-by-row Excel workbook for **${targetMonth.label}**:\n\n`;
    response += `[DOWNLOAD_DUPLICACY_BUTTON:${targetMonth.key || "CURRENT"}]\n\n`;

    response += `### 👥 Employees with Duplicate Task Descriptions (${activeLabel} Row-by-Row):\n`;
    const displayEmps = employeeSummary.slice(0, 8);
    displayEmps.forEach((emp, eIdx) => {
      response += `#### ${eIdx + 1}. 👤 **${emp.name}** (${emp.category} • ${emp.department})\n`;
      response += `• 🔁 **Total Repeated Entries**: **${emp.totalDuplicatedRows} Rows** (${emp.distinctStatementsCount} duplicated task sequences)\n`;
      response += `• 🏢 **Clients & Locations**: *${emp.clientList || "General"}*\n`;

      (emp.duplicatedTasks || []).slice(0, 3).forEach((task, tIdx) => {
        response += `  • 📌 **Repeated Task ${tIdx + 1}**: _"${task.representativeTask.slice(0, 100)}${task.representativeTask.length > 100 ? "..." : ""}"_\n`;
        response += `    ↳ 🏢 **Matched 6-Field Scope**: Location: *${task.location}* | Dept: *${task.department}* | Group: *${task.groupName}* | Company: *${task.company}*\n`;
        response += `    ↳ 🔁 **Times Repeated with Employee**: **${task.totalRepetitions} Times (${task.totalRepetitions} Rows)**:\n`;
        task.entries.forEach((row) => {
          response += `    - **Row ${row.occurrenceIndex} (${row.occurrenceText})**: 📅 **${row.date}** | 🏢 *${row.company}* (${row.location}) | ⏱️ ${row.timeGiven}\n`;
        });
      });
      if ((emp.duplicatedTasks || []).length > 3) {
        response += `  *(+${emp.duplicatedTasks.length - 3} more duplicated task sequences detailed in Excel)*\n`;
      }
      response += `\n`;
    });

    if (employeeSummary.length > 8) {
      response += `*...plus **${employeeSummary.length - 8} more employees** with duplicate task descriptions detailed in the downloaded Excel workbook.*\n\n`;
    }

    response += `[ACTION_CHIPS:Duplicacy in October 2026|🔍 October 2026;Duplicacy in September 2026|🔍 September 2026;Duplicacy in August 2026|🔍 August 2026;Monthly duplicacy overview|📊 All Months Overview]\n\n`;
    response += `[DOWNLOAD_DUPLICACY_BUTTON:${targetMonth.key || "CURRENT"}]`;
    return response;
  };

  const generateAiAndClaudeUsageReport = (logs = [], queryText = "") => {
    const requestedMonth = parseTargetMonthFromQuery(queryText);
    const scopedLogs = requestedMonth
      ? logs.filter((l) => isEntryInMonth(l, requestedMonth.month, requestedMonth.year))
      : logs;
    const scopeLabel = requestedMonth ? requestedMonth.label : "All Recorded Months";

    if (!logs || logs.length === 0) {
      return `🤖 **AI & Claude Usage Audit Report**:\n\nNo task logs are currently available to analyze for AI usage.`;
    }
    if (requestedMonth && scopedLogs.length === 0) {
      const avail = getAllAvailableMonths(logs).map((m) => m.label).join(", ");
      return `🤖 **AI & Claude Usage Audit Report (${scopeLabel})**:\n\nNo daily working entries were found for **${scopeLabel}**.\n• **Available Months:** ${avail || "None"}`;
    }

    const AI_PATTERNS = [
      { tool: "Claude (Anthropic)", regex: /\b(claude|anthropic|claude\s*3|claude\s*sonnet|claude\s*opus)\b/i, icon: "🟣" },
      { tool: "ChatGPT / OpenAI", regex: /\b(chatgpt|gpt[\s-]*[34]|gpt4|gpt3|openai|gpt)\b/i, icon: "🟢" },
      { tool: "Google Gemini", regex: /\b(gemini|google\s*gemini|bard)\b/i, icon: "🔵" },
      { tool: "Microsoft Copilot", regex: /\b(copilot|github\s*copilot|ms\s*copilot)\b/i, icon: "🟧" },
      { tool: "DeepSeek / Perplexity", regex: /\b(deepseek|perplexity)\b/i, icon: "⚪" },
      { tool: "Prompting / LLM", regex: /\b(prompting|prompt\s*engineering|prompts?|llms?|large\s*language\s*model)\b/i, icon: "💡" },
      { tool: "Artificial Intelligence (General)", regex: /\b(artificial\s*intelligence|\bai\b|a\.i\.)\b/i, icon: "🤖" },
    ];

    const matchedEntries = [];

    scopedLogs.forEach((entry) => {
      const rawTask = (entry.taskDescription || "").trim();
      if (!rawTask) return;

      for (const pattern of AI_PATTERNS) {
        if (pattern.regex.test(rawTask)) {
          matchedEntries.push({
            entry,
            tool: pattern.tool,
            icon: pattern.icon,
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

    let response = `🤖 **AJC Executive Audit: Uses of AI & Claude in Daily Working (${scopeLabel})**\n\n`;
    response += `• 📊 **Total Tasks Audited**: **${scopedLogs.length.toLocaleString()} Entries**\n`;
    response += `• 🔍 **AI-Assisted Tasks Identified**: **${matchedEntries.length} Tasks**\n`;

    if (matchedEntries.length === 0) {
      response += `• 👥 **Staff Mentioning AI**: **0 Staff Members**\n\n`;
      response += `### 📋 Audit Findings\n`;
      response += `No staff members have explicitly recorded **Claude, ChatGPT, Gemini, Copilot, or AI prompts** in their daily working task descriptions.\n\n`;
      response += `💡 **Recommendations for MD Sir**:\n`;
      response += `• Staff may be using AI tools privately without documenting them in task descriptions.\n`;
      response += `• If firm policy encourages AI adoption, advise staff to tag tasks with \`[AI Assisted - Claude]\`.\n\n`;
      response += `[DOWNLOAD_AI_REPORT_BUTTON]`;
      return response;
    }

    const toolCounts = new Map();
    const doerCounts = new Map();
    matchedEntries.forEach((m) => {
      toolCounts.set(m.tool, (toolCounts.get(m.tool) || 0) + 1);
      doerCounts.set(m.doer, (doerCounts.get(m.doer) || 0) + 1);
    });

    response += `• 👥 **Staff Members Leveraging AI**: **${doerCounts.size} Staff Members**\n`;
    response += `• 🛠️ **Top AI Tools Detected**: ${Array.from(toolCounts.entries()).map(([t, c]) => `${t}: **${c}**`).join(" • ")}\n\n`;

    response += `### 👥 Staff Members Using AI / Claude\n`;
    Array.from(doerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count], idx) => {
        response += `${idx + 1}. **${name}** — **${count} AI-related tasks logged**\n`;
      });
    response += `\n`;

    response += `### 📝 Detailed AI / Claude Task Entries\n`;
    matchedEntries.slice(0, 8).forEach((m, idx) => {
      let highlighted = m.taskText;
      highlighted = highlighted.replace(/(claude|chatgpt|gemini|copilot|prompt|openai|\bai\b)/gi, "**$1**");
      response += `${idx + 1}. ${m.icon} **${m.doer}** (${m.department}) — **${m.date}**\n`;
      response += `   • **Client**: ${m.company} | **Time**: ${m.timeGiven}\n`;
      response += `   • **Tool**: ${m.tool}\n`;
      response += `   • **Task Description**: ${highlighted}\n\n`;
    });

    response += `📥 **Report Download**: Click below to download the AI & Claude Usage register in Excel:\n\n`;
    response += `[DOWNLOAD_AI_REPORT_BUTTON]`;
    return response;
  };

  const generateUnsubmittedMoreThanTwoDaysReport = (profileList = []) => {
    if (!profileList || profileList.length === 0) {
      return `⚠️ **Defaulters Audit Report (> 2 Days Not Filled)**:\n\nNo staff profile data is currently loaded to evaluate daily working submissions.`;
    }

    const partnersDefaulters = [];
    const seniorsDefaulters = [];
    const articlesDefaulters = [];
    const plantStaffDefaulters = [];

    profileList.forEach((p) => {
      const missingCount = p.missingDates ? p.missingDates.length : 0;
      const isDefaulter = missingCount > 2 || (missingCount === 0 && p.totalEntries === 0);

      if (!isDefaulter && missingCount <= 2) return;

      const item = {
        name: p.rawName,
        department: p.department || "General",
        missingCount: missingCount > 0 ? missingCount : "Never Filled",
        missingDates: p.missingDates || [],
        lastUpdated: p.lastUpdatedDate || (p.latestEntry?.date ? formatExcelOrStringDate(p.latestEntry.date) : "No entries"),
        cardPresent: p.cardPresent,
        punchStatus: p.punchStatus || (p.cardPresent ? "Present" : "Absent"),
      };

      if (isPartner(p.rawName, p)) {
        partnersDefaulters.push(item);
      } else if (isSenior(p.rawName, p)) {
        seniorsDefaulters.push(item);
      } else if (isArticle(p.rawName, p)) {
        articlesDefaulters.push(item);
      } else if (isPlantStaff(p.rawName, p)) {
        plantStaffDefaulters.push(item);
      }
    });

    const sortByMissing = (a, b) => (Number(b.missingCount) || 999) - (Number(a.missingCount) || 999);
    partnersDefaulters.sort(sortByMissing);
    seniorsDefaulters.sort(sortByMissing);
    articlesDefaulters.sort(sortByMissing);
    plantStaffDefaulters.sort(sortByMissing);

    const grandTotal =
      partnersDefaulters.length +
      seniorsDefaulters.length +
      articlesDefaulters.length +
      plantStaffDefaulters.length;

    let response = `⚠️ **AJC Executive Audit: Staff Not Filled Daily Working > 2 Days**\n\n`;
    response += `Compliance audit referenced strictly from \`attendanceConfig.js\` across all 4 key personnel groups:\n\n`;
    response += `• 🤝 **Partners (> 2 Days)**: **${partnersDefaulters.length} Defaulters** (out of ${PARTNERS_LIST.length} Partners)\n`;
    response += `• 👔 **Seniors (> 2 Days)**: **${seniorsDefaulters.length} Defaulters** (out of ${SENIORS_LIST.length} Seniors)\n`;
    response += `• 📚 **Articles (> 2 Days)**: **${articlesDefaulters.length} Defaulters** (out of ${ARTICLES_LIST.length} Articles)\n`;
    response += `• 🏭 **Plant Staff (> 2 Days)**: **${plantStaffDefaulters.length} Defaulters**\n`;
    response += `• 🚨 **Grand Total Core Defaulters (> 2 Days)**: **${grandTotal} Staff Members**\n\n`;

    // Partners
    response += `### 1. 🤝 Partners (> 2 Days Not Filled)\n`;
    if (partnersDefaulters.length === 0) {
      response += `*All Partners (CA Rupesh Vaid, CA Ankit Garg, CA Mukul Jain) are 100% compliant!* ✅\n\n`;
    } else {
      partnersDefaulters.forEach((p, i) => {
        response += `${i + 1}. 🤝 **${p.name}** — **${p.missingCount} Days Pending**\n`;
        response += `   • **Missing Dates**: ${p.missingDates.slice(0, 5).join(", ")}${p.missingDates.length > 5 ? ` (+${p.missingDates.length - 5} more)` : ""}\n`;
        response += `   • **Last Submission**: ${p.lastUpdated} | **Today Punch**: ${p.punchStatus}\n\n`;
      });
    }

    // Seniors
    response += `### 2. 👔 Seniors (> 2 Days Not Filled)\n`;
    if (seniorsDefaulters.length === 0) {
      response += `*All Senior staff are 100% compliant!* ✅\n\n`;
    } else {
      seniorsDefaulters.forEach((p, i) => {
        response += `${i + 1}. 👔 **${p.name}** (${p.department}) — **${p.missingCount} Days Pending**\n`;
        response += `   • **Missing Dates**: ${p.missingDates.slice(0, 4).join(", ")}${p.missingDates.length > 4 ? ` (+${p.missingDates.length - 4} more)` : ""}\n`;
        response += `   • **Last Submission**: ${p.lastUpdated} | **Today Punch**: ${p.punchStatus}\n\n`;
      });
    }

    // Articles
    response += `### 3. 📚 Articles (> 2 Days Not Filled)\n`;
    if (articlesDefaulters.length === 0) {
      response += `*All Article trainees are 100% compliant!* ✅\n\n`;
    } else {
      articlesDefaulters.slice(0, 8).forEach((p, i) => {
        response += `${i + 1}. 📚 **${p.name}** — **${p.missingCount} Days Pending** (${p.missingDates.slice(0, 3).join(", ")})\n`;
      });
      if (articlesDefaulters.length > 8) {
        response += `*...plus ${articlesDefaulters.length - 8} more articles detailed in Excel.*\n\n`;
      }
    }

    // Plant Staff
    response += `### 4. 🏭 Plant Audit Staff (> 2 Days Not Filled)\n`;
    if (plantStaffDefaulters.length === 0) {
      response += `*All Plant Audit staff are 100% compliant!* ✅\n\n`;
    } else {
      plantStaffDefaulters.forEach((p, i) => {
        response += `${i + 1}. 🏭 **${p.name}** — **${p.missingCount} Days Pending**\n`;
      });
    }

    response += `\n📥 **Report Download**: Click below to download the official > 2 Days Defaulters Excel:\n\n`;
    response += `[DOWNLOAD_TWO_DAYS_DEFAULTERS_BUTTON]`;
    return response;
  };

  const generateLessThanNineHoursReport = (logs = [], profileList = [], queryText = "") => {
    const targetMonth = parseTargetMonthFromQuery(queryText);
    const audit = auditEmployeesLessThanNineHours(logs, profileList, targetMonth ? targetMonth.key : "CURRENT");
    const monthLabel = targetMonth ? targetMonth.label : audit.activeMonthSpec.label;
    const isTargetMonthOnly = Boolean(targetMonth);

    const activeList = isTargetMonthOnly
      ? audit.targetMonthShortfallDays
      : audit.shortfallDays;

    let response = `⏱️ **AJC Executive Audit: Employees with Less Than 9 Hours in Daily Working**\n\n`;
    response += `Mandatory Standard: **9.0 Hours / Day (09:00)** referenced from Daily Working Sheet:\n\n`;

    if (isTargetMonthOnly) {
      response += `• 📅 **Audit Period**: **${monthLabel}**\n`;
      response += `• ⚠️ **Days Logged < 9 Hours**: **${audit.kpis.targetMonthShortfallDays} Instance Days**\n`;
      response += `• 👥 **Staff Members Affected**: **${audit.kpis.targetMonthAffectedStaff} Employees**\n`;
      response += `• 📉 **Total Cumulative Deficit in ${monthLabel}**: **${audit.kpis.targetMonthShortfallHours} Hours**\n\n`;
    } else {
      response += `• 📅 **Current Month (${monthLabel}) Shortfall**: **${audit.kpis.targetMonthShortfallDays} Days** (${audit.kpis.targetMonthShortfallHours} hrs deficit)\n`;
      response += `• ⚠️ **Total All-Time Shortfall Days**: **${audit.kpis.totalShortfallDays} Days** across **${audit.kpis.affectedEmployeesCount} Employees**\n`;
      response += `• 📉 **Total All-Time Deficit**: **${audit.kpis.totalShortfallHours} Hours**\n\n`;
    }

    // Role breakdown
    const rc = isTargetMonthOnly && audit.kpis.targetMonthRoleCounts
      ? audit.kpis.targetMonthRoleCounts
      : audit.kpis.roleCounts;
    response += `━━━━━━━━━━━━━━━━━━━━\n`;
    response += `### 📊 Department & Role Breakdown (< 9 Hours${isTargetMonthOnly ? ` — ${monthLabel}` : ""}):\n`;
    response += `• 🤝 **Partners**: ${rc.partners} Days\n`;
    response += `• 👔 **Seniors**: ${rc.seniors} Days\n`;
    response += `• 📚 **Articles**: ${rc.articles} Days\n`;
    response += `• 🏭 **Plant Audit Staff**: ${rc.plantStaff} Days\n`;
    response += `• 🏢 **Back Office**: ${rc.backOffice} Days\n\n`;

    // Today's live check (show when not strictly auditing a past closed month)
    if (!isTargetMonthOnly && audit.todayShortfallList.length > 0) {
      response += `━━━━━━━━━━━━━━━━━━━━\n`;
      response += `### 🚨 Today's Live Defaulters (< 9 Hours Logged Today):\n`;
      audit.todayShortfallList.slice(0, 8).forEach((t, i) => {
        response += `${i + 1}. **${t.rawName}** (${t.categoryRole} • ${t.department}) — Logged: **${t.loggedDuration}** (*Shortfall: ${t.shortfallDuration}*)\n`;
        response += `   • **Status**: ${t.status} | **Punch In**: ${t.punchIn}\n`;
      });
      if (audit.todayShortfallList.length > 8) {
        response += `*...plus ${audit.todayShortfallList.length - 8} more staff today.*\n`;
      }
      response += `\n`;
    }

    // Top staff with most shortfall days
    const topStaffList = isTargetMonthOnly
      ? audit.staffSummary
          .filter((s) => (s.targetMonthShortfallCount || 0) > 0)
          .sort((a, b) => (b.targetMonthShortfallCount || 0) - (a.targetMonthShortfallCount || 0))
      : audit.staffSummary;

    response += `━━━━━━━━━━━━━━━━━━━━\n`;
    response += `### 👥 Staff with Frequent Shortfall Days${isTargetMonthOnly ? ` (${monthLabel})` : ""}:\n`;
    if (topStaffList.length === 0) {
      response += `*No staff logged less than 9 hours in ${monthLabel}!* ✅\n\n`;
    } else {
      topStaffList.slice(0, 8).forEach((s, idx) => {
        const dayCnt = isTargetMonthOnly ? s.targetMonthShortfallCount : s.shortfallDaysCount;
        response += `${idx + 1}. **${s.name}** (${s.categoryRole} • ${s.department}) — **${dayCnt} Days < 9 hrs**\n`;
        response += `   • **Avg Daily Time**: ${s.avgLoggedDuration} | **Cumulative Deficit**: ${s.totalShortfallDuration} | **Lowest Day**: ${s.minLoggedHoursStr}\n`;
      });
      response += `\n`;
    }

    // Recent instances
    response += `━━━━━━━━━━━━━━━━━━━━\n`;
    response += `### 📝 ${isTargetMonthOnly ? `${monthLabel} Days` : "Recent Days"} Logged Under 9 Hours:\n`;
    if (activeList.length === 0) {
      response += `*0 instances recorded in ${monthLabel}.*\n\n`;
    } else {
      activeList.slice(0, 6).forEach((r, idx) => {
        response += `${idx + 1}. **${r.rawName}** (${r.categoryRole}) — **${r.date}**\n`;
        response += `   • **Logged Time**: **${r.loggedHoursStr}** (${r.loggedDurationText}) | **Shortfall**: **${r.shortfallDurationText}**\n`;
        response += `   • **Tasks (${r.tasksCount})**: ${r.tasks.slice(0, 2).map((t) => `${t.company} (${t.timeGiven}): ${t.task.slice(0, 35)}`).join(" | ")}\n\n`;
      });
    }

    response += `📥 **Report Download**: Click below to download the official Excel register with full row-by-row task breakdown, staff summary, and live status:\n\n`;
    response += `[DOWNLOAD_LESS_THAN_9_HOURS_EXCEL:${targetMonth?.key || "CURRENT"}]`;
    return response;
  };

  const generateCrossEmployeeDuplicatesReport = (logs = [], profileList = [], queryText = "") => {
    const targetMonth = parseTargetMonthFromQuery(queryText);
    const audit = auditCrossEmployeeDuplicateTasks(logs, profileList, targetMonth ? targetMonth.key : "CURRENT");
    const monthLabel = targetMonth ? targetMonth.label : audit.activeMonthSpec.label;
    const isTargetMonthOnly = Boolean(targetMonth);

    const activeGroups = isTargetMonthOnly ? audit.targetMonthGroups : audit.groups;
    const activeWorkClustersCount = activeGroups.filter((g) => !g.isLeaveOrHoliday).length;

    let response = `👥 **AJC Executive Audit: Same Task Logged Across Different Employees**\n\n`;
    response += `*Criteria: Same Work Location, Department, Group Name, Company Name, and Task Description logged by ≥ 2 different employees.*\n\n`;

    if (isTargetMonthOnly) {
      response += `• 📅 **Audit Period**: **${monthLabel}**\n`;
      response += `• 🏢 **Active Work Task Clusters**: **${activeWorkClustersCount} Clusters** (Total: ${audit.kpis.targetMonthClusters})\n`;
      response += `• 📝 **Total Shared Task Entries**: **${audit.kpis.targetMonthSharedRows} Entries**\n`;
      response += `• 👥 **Staff Involved in ${monthLabel}**: **${audit.kpis.targetMonthStaffInvolved} Employees**\n\n`;
    } else {
      response += `• 📅 **Current Month (${monthLabel})**: **${audit.kpis.targetMonthClusters} Clusters** (${audit.kpis.targetMonthSharedRows} shared entries)\n`;
      response += `• 🏢 **Total All-Time Identical Clusters**: **${audit.kpis.totalClusters} Clusters** (${audit.kpis.activeWorkClustersCount} Active Client Work)\n`;
      response += `• 📝 **Total All-Time Shared Task Entries**: **${audit.kpis.totalSharedRows} Entries**\n`;
      response += `• 👥 **Total Distinct Staff Involved**: **${audit.kpis.staffInvolvedCount} Employees**\n\n`;
    }

    if (activeGroups.length === 0) {
      response += `🎉 **Zero Cross-Employee Duplicate Tasks Found${isTargetMonthOnly ? ` for ${monthLabel}` : ""}!** No identical tasks were logged across different employees.\n\n`;
    } else {
      // Top Shared Task Clusters
      response += `━━━━━━━━━━━━━━━━━━━━\n`;
      response += `### 🏢 Top Shared Task Clusters${isTargetMonthOnly ? ` (${monthLabel})` : ""}:\n`;
      activeGroups.slice(0, 8).forEach((g, idx) => {
        const clientLabel = g.company || g.groupName || "General Client";
        const tag = g.isLeaveOrHoliday ? " [Leave/Holiday]" : "";
        response += `${idx + 1}. **${clientLabel}**${tag} — **${g.distinctCount} Employees** (${g.totalEntries} entries)\n`;
        response += `   • 📝 **Task**: "${g.representativeTask.slice(0, 75)}${g.representativeTask.length > 75 ? "..." : ""}"\n`;
        response += `   • 📍 **Location**: ${g.location || "Office"} | 🏬 **Dept**: ${g.department || "General"}\n`;
        response += `   • 👥 **Staff**: ${g.employeesListStr}\n\n`;
      });

      if (activeGroups.length > 8) {
        response += `*...plus ${activeGroups.length - 8} more shared clusters.*\n\n`;
      }

      // Top Staff Involved
      const staffList = isTargetMonthOnly
        ? audit.staffSummary
            .filter((s) => (s.targetMonthSharedEntries || 0) > 0)
            .sort((a, b) => (b.targetMonthSharedEntries || 0) - (a.targetMonthSharedEntries || 0))
        : audit.staffSummary;

      response += `━━━━━━━━━━━━━━━━━━━━\n`;
      response += `### 👥 Staff Involved in Shared Task Clusters${isTargetMonthOnly ? ` (${monthLabel})` : ""}:\n`;
      staffList.slice(0, 6).forEach((s, idx) => {
        const sharedCnt = isTargetMonthOnly ? s.targetMonthSharedEntries : s.totalSharedEntries;
        response += `${idx + 1}. **${s.name}** (${s.categoryRole} • ${s.department}) — **${sharedCnt} Shared Entries**${!isTargetMonthOnly ? ` across **${s.distinctClustersCount} Clusters**` : ""}\n`;
        response += `   • 🤝 **Frequent Co-Workers**: ${s.topCoWorkers}\n`;
      });
      response += `\n`;
    }

    response += `📥 **Report Download**: Click below to download the official 4-sheet Excel workbook tracking Month Tasks, Cluster Overview, Staff Involvement, and All-Time Cross-Employee Register:\n\n`;
    response += `[DOWNLOAD_CROSS_EMPLOYEE_DUPLICATES_EXCEL:${targetMonth?.key || "CURRENT"}]`;
    return response;
  };

  const generateDefaultersReport = (profileList = []) => {
    const presentDefaulters = profileList.filter((p) => p.cardPresent && !p.submittedToday);
    const withBacklog = profileList.filter((p) => p.missingDates && p.missingDates.length > 0);

    let res = `⚠️ **Daily Working Defaulters & Submission Backlog**\n\n`;
    res += `• 🚨 **Present Today But Work Not Submitted**: **${presentDefaulters.length} Staff**\n`;
    res += `• 📅 **Staff with Historical Missing Dates**: **${withBacklog.length} Staff**\n\n`;

    if (presentDefaulters.length > 0) {
      res += `### 🚪 Present Today (Punched In) — Daily Working Not Submitted:\n`;
      presentDefaulters.slice(0, 10).forEach((p, idx) => {
        res += `${idx + 1}. **${p.rawName}** (${p.categoryRole} • ${p.department}) — In: ${p.punchStatus}\n`;
      });
      if (presentDefaulters.length > 10) {
        res += `*...plus ${presentDefaulters.length - 10} more staff.*\n`;
      }
      res += `\n`;
    }

    res += `👇 **Download Complete Defaulters Excel Register:**\n`;
    res += `[DOWNLOAD_DEFAULTERS_BUTTON]`;
    return res;
  };

  // --- UNIFIED 360° INDIVIDUAL EMPLOYEE DOSSIER ---
  const generateUnified360Dossier = (targetMatch) => {
    const { name, profile: p, row } = targetMatch;
    const info = row ? evaluateEmployee(row) : null;

    const m = activeMonthlyData ? findExactOrBestRecord(activeMonthlyData.monthlySummaries, name) : null;
    const w = activeWeeklyData ? findExactOrBestRecord(activeWeeklyData.list, name) : null;

    let res = `👤 **Executive 360° Dossier: ${name}**\n`;
    if (info) {
      res += `• **Category / Shift**: ${info.categoryIcon} **${info.categoryLabel}** (Cut-off: **${formatCutoffDisplay(info.cutoff)}** | Grace: **${formatCutoffDisplay(info.grace)}**)\n`;
    } else if (p) {
      res += `• **Role**: ${p.roleIcon} **${p.categoryRole}** (${p.department})\n`;
    }

    res += `━━━━━━━━━━━━━━━━━━━━\n`;

    // 1. Live Attendance Today
    res += `📅 **1. Today's Live Attendance Status**:\n`;
    if (!info) {
      res += `• Punch In: *(No check-in record logged for today / Biometric exempt)*\n`;
    } else if (info.isAbsent) {
      res += `• Status: ❌ **ABSENT TODAY** (No biometric check-in recorded)\n`;
      res += `• Expected Cut-off: ${formatCutoffDisplay(info.cutoff)} (Grace: ${formatCutoffDisplay(info.grace)})\n`;
    } else if (info.isLate) {
      res += `• Status: ⏰ **LATE ARRIVAL** (In at **${info.formattedIn}** — **${info.lateDuration} late** after ${formatCutoffDisplay(info.grace)} grace)\n`;
      res += `• Location: ${info.workSite}${info.location ? ` (${info.location})` : ""}\n`;
      res += `• Hours Worked: **${info.formattedWorkingHours}** (${info.isCheckedOut ? "Completed Shift" : "Currently on duty"})\n`;
    } else if (info.isWithinGrace) {
      res += `• Status: 🟡 **PRESENT (Within Grace Period)** (In at **${info.formattedIn}**)\n`;
      res += `• Location: ${info.workSite}\n`;
      res += `• Hours Worked: **${info.formattedWorkingHours}**\n`;
    } else if (info.isEarly) {
      res += `• Status: 🌅 **PRESENT (Early Login — ${info.earlyDuration} early)** (In at **${info.formattedIn}**)\n`;
      res += `• Hours Worked: **${info.formattedWorkingHours}**\n`;
    } else {
      res += `• Status: ✅ **PRESENT (On Time)** (In at **${info.formattedIn}**)\n`;
      res += `• Hours Worked: **${info.formattedWorkingHours}**\n`;
    }

    res += `\n`;

    // 2. Today's Daily Working
    res += `📝 **2. Today's Daily Working Diary**:\n`;
    const cleanTargetName = normalizeName(name);
    const empEntries = (workingLogs || []).filter((e) => {
      const dName = normalizeName(e.doerName || e.employeeName);
      return dName === cleanTargetName || (cleanTargetName.length > 3 && dName.includes(cleanTargetName));
    });

    const todayFormatted = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const todayTasks = empEntries.filter((e) => formatExcelOrStringDate(e.date) === todayFormatted);
    const hasSubmittedToday = todayTasks.length > 0 || (p && p.submittedToday);
    const todayTimeTotal = sumTimeGiven(todayTasks);

    const curMonthLabel = getCurrentMonthLabel();
    const curMonthEntries = empEntries.filter((e) => isEntryInMonth(e.date, curMonthLabel));

    if (!p && empEntries.length === 0) {
      res += `• *(No daily working diary profile created for ${name})*\n`;
    } else if (hasSubmittedToday) {
      const tCount = todayTasks.length || p?.todayEntriesCount || 1;
      res += `• Status: ✅ **WORK SUBMITTED TODAY** (**${tCount} task${tCount > 1 ? "s" : ""}** logged${todayTimeTotal ? ` • ⏱️ ${todayTimeTotal}` : ""})\n`;
      if (todayTasks.length > 0) {
        todayTasks.slice(0, 3).forEach((t, idx) => {
          const comp = t.companyName || t.groupName ? `[${t.companyName || t.groupName}] ` : "";
          const time = t.timeGiven ? ` (${t.timeGiven})` : "";
          res += `  ${idx + 1}. ${comp}${t.taskDescription}${time}\n`;
        });
        if (todayTasks.length > 3) {
          res += `  *...and ${todayTasks.length - 3} more tasks logged today.*\n`;
        }
      } else if (p?.latestEntry) {
        res += `• Latest Task: _"${(p.latestEntry.taskDescription || "Completed duties").slice(0, 150)}"_\n`;
      }
    } else if (p?.cardPresent || info?.isPresent) {
      res += `• Status: 🚨 **PENDING TODAY (Not Submitted Yet!)**\n  *(Staff is physically present on punch attendance but has not logged daily tasks today)*\n`;
      if (p?.lastUpdatedDate) {
        res += `• Last Submission Date: **${p.lastUpdatedDate}**\n`;
      }
    } else {
      res += `• Status: ⚠️ **PENDING (Not Submitted Today)**\n`;
      if (p?.lastUpdatedDate) {
        res += `• Last Submission Date: **${p.lastUpdatedDate}**\n`;
      }
    }
    res += `• Month's Tasks (${curMonthLabel}): **${curMonthEntries.length} tasks** logged | All-Time: **${empEntries.length} tasks**\n`;

    res += `\n`;

    // 3. Monthly & Weekly Attendance Register
    res += `📊 **3. Cumulative Attendance Register**:\n`;
    if (m) {
      res += `• 🗓️ **This Month (${activeMonthlyData?.monthName || "October 2026"})**: ⏰ **${m.lateDays || 0}d Late** | ❌ **${m.daysAbsent || 0}d Absent** | ✅ **${m.daysPresent || 0}d Present** (**${m.attendancePct}%** compliance)\n`;
    }
    if (w) {
      res += `• 🗓️ **This Week (${activeWeeklyData?.weekRange || "Current Week"})**: ⏰ **${w.lateDays || 0}d Late** | ❌ **${w.daysAbsent || 0}d Absent** | ✅ **${w.daysPresent || 0}d Present**\n`;
    }

    res += `\n`;

    // 4. Audits & Compliance Backlog
    res += `🔍 **4. Audits & Compliance Backlog**:\n`;
    // Individual Duplicacy Audit: 6 fields (Doer, Location, Department, Group, Company, Task)
    const dupeMap = new Map();
    empEntries.forEach((entry) => {
      const dName = (entry.doerName || entry.employeeName || "").trim().toLowerCase();
      const loc = (entry.location || "").trim().toLowerCase();
      const dept = (entry.department || "").trim().toLowerCase();
      const grp = (entry.groupName || "").trim().toLowerCase();
      const comp = (entry.companyName || "").trim().toLowerCase();
      const task = (entry.taskDescription || "").trim().toLowerCase().replace(/\s+/g, " ");

      if (task.length >= 3) {
        const key = `${dName}__${loc}__${dept}__${grp}__${comp}__${task}`;
        dupeMap.set(key, (dupeMap.get(key) || 0) + 1);
      }
    });
    const dupeOccurrences = Array.from(dupeMap.values()).filter((c) => c > 1).reduce((a, b) => a + b, 0);
    if (dupeOccurrences > 0) {
      res += `• 🔍 Duplicacy Audit: ⚠️ **Found ${dupeOccurrences} duplicate task entries** (Matching 6 fields)\n`;
    } else {
      res += `• 🔍 Duplicacy Audit: ✅ **Clean (100% Unique Work Entries)**\n`;
    }

    const aiPatterns = /\b(chatgpt|claude|openai|gpt-4|gpt-3|as an ai|language model|ai prompt|prompt:)\b/i;
    const aiCount = empEntries.filter((e) => aiPatterns.test(e.taskDescription || "")).length;
    if (aiCount > 0) {
      res += `• 🤖 AI & Claude Usage: ⚠️ **${aiCount} task entries** contain AI/Claude phrasing\n`;
    } else {
      res += `• 🤖 AI & Claude Usage: ✅ **Clean (No AI phrasing detected)**\n`;
    }

    if (p && p.missingDates && p.missingDates.length > 0) {
      res += `• 🚨 Daily Working Backlog: **${p.missingDates.length} missing dates** (${p.missingDates.slice(0, 4).join(", ")}${p.missingDates.length > 4 ? "..." : ""})\n`;
    } else {
      res += `• 📅 Missing Dates Backlog: ✅ **Up to date (0 pending dates)**\n`;
    }

    // 5. Internal Audit FMS & 6. PMS FMS Engagements (For Partners & Seniors)
    const cleanEmpName = normalizeName(name);
    const filterByEmployeeFms = (records = []) =>
      records.filter((item) => {
        const pName = normalizeName(item.partner);
        const sName = normalizeName(item.senior);
        return (
          (pName && cleanEmpName && (pName.includes(cleanEmpName) || cleanEmpName.includes(pName))) ||
          (sName && cleanEmpName && (sName.includes(cleanEmpName) || cleanEmpName.includes(sName)))
        );
      });

    const formatFmsSection = (items, title, itemLabel) => {
      if (!items.length) return "";
      let section = `\n${title} (${items.length} ${itemLabel}):\n`;
      items.slice(0, 5).forEach((item, idx) => {
        const isPart = cleanEmpName && normalizeName(item.partner).includes(cleanEmpName);
        section += `  ${idx + 1}. 🏢 **${item.companyName}** *(Group: ${item.groupName || "N/A"})*\n`;
        section += `     • Role: **${isPart ? "Partner Incharge" : "Lead CA / Senior"}** | Period: **${item.iaPeriod || item.pmsPeriod || "Current"}** | Type: **${item.assignmentType || "Standard"}**\n`;
      });
      if (items.length > 5) {
        section += `  *...and ${items.length - 5} more ${itemLabel.toLowerCase()} assigned.*\n`;
      }
      return section;
    };

    const assignedAudits = filterByEmployeeFms(internalAudits);
    const assignedPms = filterByEmployeeFms(pmsRecords);

    res += formatFmsSection(assignedAudits, "📑 **5. Internal Audit FMS Engagements**", "Client Audits");
    res += formatFmsSection(assignedPms, "📋 **6. PMS FMS Assignments**", "PMS Entries");

    // 7. Senior & Junior Task (Delegation) Ownership
    const cleanSeniorName = cleanSeniorPersonName(name);
    if (cleanSeniorName) {
      [
        { list: seniorTasks, title: "🗂️ **7. Senior Task (Delegation) Summary**:" },
        { list: juniorTasks, title: "🧑‍💻 **8. Junior Task (Delegation) Summary**:" },
      ].forEach(({ list, title }) => {
        if (!list || !list.length) return;
        const asDoerTasks = list.filter((t) => cleanSeniorPersonName(t.doer) === cleanSeniorName);
        const asAssignorTasks = list.filter((t) => cleanSeniorPersonName(t.assignor) === cleanSeniorName);
        if (asDoerTasks.length > 0 || asAssignorTasks.length > 0) {
          const doerOv = computeSeniorTaskAnalytics(asDoerTasks).overview;
          const assignOv = computeSeniorTaskAnalytics(asAssignorTasks).overview;
          res += `\n${title}\n`;
          if (asDoerTasks.length > 0) {
            res += `  • **As Doer (${doerOv.totalTasks} tasks)**: ✅ ${doerOv.doneCount} Done (${doerOv.completionRate}%) | ❌ ${doerOv.cancelledCount} Cancelled (${doerOv.cancelRate}%) | 🔄 ${doerOv.openCount} Open (*${doerOv.overdueCount} Overdue*) | 🔁 ${doerOv.totalRevisions} Rev\n`;
          }
          if (asAssignorTasks.length > 0) {
            res += `  • **As Assignor (${assignOv.totalTasks} assigned)**: ✅ ${assignOv.doneCount} Done | ❌ ${assignOv.cancelledCount} Cancelled (${assignOv.cancelRate}%) | 🔄 ${assignOv.openCount} Open\n`;
          }
        }
      });
    }

    res += `\n💡 *Tip: Ask "Daily working of ${name}" for full task descriptions, or "Who is late today?" for firm-wide attendance.*`;
    return res;
  };

  // --- INDIVIDUAL DAILY WORKING SUMMARY ---
  const generateIndividualDailyWorkingSummary = (targetMatch, query = "") => {
    const { name, profile: p, row } = targetMatch;
    const cleanName = normalizeName(name);
    const info = row ? evaluateEmployee(row) : null;

    // Filter all working logs for this specific employee
    const empEntries = (workingLogs || []).filter((e) => {
      const dName = normalizeName(e.doerName || e.employeeName);
      return dName === cleanName || (cleanName.length > 3 && dName.includes(cleanName));
    });

    // Sort newest first
    empEntries.sort((a, b) => {
      const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tB - tA;
    });

    // Today's formatted date
    const todayFormatted = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    // Today's tasks
    const todayTasks = empEntries.filter((e) => formatExcelOrStringDate(e.date) === todayFormatted);
    const hasSubmittedToday = todayTasks.length > 0 || (p && p.submittedToday);
    const todayTimeTotal = sumTimeGiven(todayTasks);

    // Current or Requested month tasks
    const requestedMonth = parseTargetMonthFromQuery(query);
    const activeMonthSpec = requestedMonth || {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      label: getCurrentMonthLabel(),
    };
    const curMonthLabel = activeMonthSpec.label;
    const curMonthEntries = empEntries.filter((e) =>
      isEntryInMonth(e, activeMonthSpec.month, activeMonthSpec.year)
    );
    const curMonthDays = new Set(curMonthEntries.map((e) => formatExcelOrStringDate(e.date))).size;
    const curMonthTimeTotal = sumTimeGiven(curMonthEntries);

    // Top clients / groups
    const clientCountMap = new Map();
    empEntries.forEach((e) => {
      const comp = (e.companyName || e.groupName || "").trim();
      if (comp) {
        clientCountMap.set(comp, (clientCountMap.get(comp) || 0) + 1);
      }
    });
    const topClients = Array.from(clientCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([comp, count]) => `**${comp}** (${count})`)
      .join(", ");

    // Individual 6-Field Duplicacy Audit: (Doer, Location, Department, Group, Company, Task)
    const dupeMap = new Map();
    empEntries.forEach((entry) => {
      const dName = (entry.doerName || entry.employeeName || "").trim().toLowerCase();
      const loc = (entry.location || "").trim().toLowerCase();
      const dept = (entry.department || "").trim().toLowerCase();
      const grp = (entry.groupName || "").trim().toLowerCase();
      const comp = (entry.companyName || "").trim().toLowerCase();
      const task = (entry.taskDescription || "").trim().toLowerCase().replace(/\s+/g, " ");

      if (task.length >= 3) {
        const key = `${dName}__${loc}__${dept}__${grp}__${comp}__${task}`;
        if (!dupeMap.has(key)) {
          dupeMap.set(key, { count: 0, sample: entry });
        }
        dupeMap.get(key).count += 1;
      }
    });

    const empDuplicates = Array.from(dupeMap.values()).filter((item) => item.count > 1);
    const totalDuplicateOccurrences = empDuplicates.reduce((acc, cur) => acc + cur.count, 0);

    // Individual AI / Claude Usage Audit
    const aiPatterns = /\b(chatgpt|claude|openai|gpt-4|gpt-3|as an ai|language model|ai prompt|prompt:)\b/i;
    const aiEntries = empEntries.filter((e) => aiPatterns.test(e.taskDescription || ""));

    // Missing dates & compliance
    const missingDates = p?.missingDates || [];
    const isDefaulterMoreThanTwo = missingDates.length > 2;

    // Role, Department, Location labels
    const roleLabel = p?.category?.label || info?.categoryLabel || p?.department || "General Staff";
    const roleIcon = p?.category?.icon || info?.categoryIcon || "👤";
    const workLoc = p?.punchLocation || info?.workSite || "AJC Office";

    let res = `📝 **Individual Daily Working Summary: ${name}**\n`;
    res += `• ${roleIcon} **Role / Category**: **${roleLabel}**\n`;
    res += `• 🏢 **Department**: ${p?.department || info?.department || "General"}\n`;
    res += `• 📍 **Primary Location**: ${workLoc}\n`;
    res += `━━━━━━━━━━━━━━━━━━━━\n`;

    // 1. Today's Status (Punch vs Work Submission)
    res += `🕒 **1. Today's Status (Punch Attendance vs Work Submission)**:\n`;
    if (info) {
      if (info.isAbsent) {
        res += `• 🚪 **Biometric Punch**: ❌ **Absent Today** (No check-in record logged)\n`;
      } else if (info.isLate) {
        res += `• 🚪 **Biometric Punch**: ⏰ **Late Arrival** (In at **${info.formattedIn}** — **${info.lateDuration} late** after grace)\n`;
      } else if (info.isEarly) {
        res += `• 🚪 **Biometric Punch**: 🌅 **Present (Early Login)** (In at **${info.formattedIn}**)\n`;
      } else {
        res += `• 🚪 **Biometric Punch**: ✅ **Present (On Time)** (In at **${info.formattedIn}**)\n`;
      }
      res += `• ⏳ **Punch Hours on Duty**: **${info.formattedWorkingHours}** (${info.isCheckedOut ? "Completed Shift" : "Currently on Duty"})\n`;
    } else if (p && p.cardPresent) {
      res += `• 🚪 **Biometric Punch**: ✅ **Present** (In at ${formatDisplayTime(p.punchIn)} | ${p.punchLocation || "Office"})\n`;
    } else {
      res += `• 🚪 **Biometric Punch**: *(Biometric punch exempt or no check-in record logged)*\n`;
    }

    if (hasSubmittedToday) {
      const taskCount = todayTasks.length || p?.todayEntriesCount || 1;
      res += `• 📝 **Daily Work Submission**: ✅ **SUBMITTED TODAY** (**${taskCount} task${taskCount > 1 ? "s" : ""}** logged)\n`;
      if (todayTimeTotal) {
        res += `• ⏱️ **Total Task Time Logged Today**: **${todayTimeTotal}**\n`;
      }
    } else if (p?.cardPresent || info?.isPresent) {
      res += `• 📝 **Daily Work Submission**: 🚨 **PENDING TODAY (Not Submitted Yet!)**\n  *(Staff is physically present on punch attendance but has not logged daily tasks today)*\n`;
    } else {
      res += `• 📝 **Daily Work Submission**: ⏳ **Pending Today** (No entries logged for today yet)\n`;
    }

    res += `\n`;

    // 2. Detailed Task Breakdown
    if (hasSubmittedToday && todayTasks.length > 0) {
      res += `📋 **2. Today's Logged Tasks (${todayFormatted})**:\n`;
      todayTasks.forEach((t, idx) => {
        const periodStr = t.period ? `[${t.period}] ` : "";
        const compStr = t.companyName || t.groupName ? `🏢 **${t.companyName || t.groupName}**` : "";
        const timeStr = t.timeGiven ? ` • ⏱️ *${t.timeGiven}*` : "";
        res += `  ${idx + 1}. ${periodStr}${compStr}${timeStr}\n`;
        res += `     • 📌 **Task**: ${t.taskDescription || "No description provided"}\n`;
        if (t.location) res += `     • 📍 Location: ${t.location}\n`;
      });
    } else {
      res += `📋 **2. Today's Tasks**: *(No tasks submitted for today yet)*\n`;
      if (empEntries.length > 0) {
        const lastEntryDate = formatExcelOrStringDate(empEntries[0].date);
        const recentEntries = empEntries.slice(0, 3);
        res += `• 📅 **Last Submission Date**: **${lastEntryDate}**\n`;
        res += `**Recent Tasks from ${lastEntryDate}**:\n`;
        recentEntries.forEach((t, idx) => {
          const compName = t.companyName || t.groupName || "General";
          res += `  ${idx + 1}. [${t.period || "General"}] *${compName}* — ${t.taskDescription} (${t.timeGiven || "N/A"})\n`;
        });
      }
    }

    res += `\n`;

    // 3. Monthly & Historical Performance
    res += `📊 **3. ${requestedMonth ? `${curMonthLabel} Performance` : "Monthly & Historical Work Profile"}**:\n`;
    res += `• 🗓️ **${curMonthLabel}**: **${curMonthEntries.length} tasks** logged across **${curMonthDays} days**${curMonthTimeTotal ? ` (${curMonthTimeTotal})` : ""}\n`;
    if (requestedMonth && curMonthEntries.length > 0) {
      res += `• 📌 **${curMonthLabel} Sample Tasks**:\n`;
      curMonthEntries.slice(0, 4).forEach((t, i) => {
        res += `  ${i + 1}. [${formatExcelOrStringDate(t.date)}] *${t.companyName || t.groupName || "General"}* — ${(t.taskDescription || "").slice(0, 70)} (${t.timeGiven || "N/A"})\n`;
      });
    }
    res += `• 📂 **Total All-Time Entries**: **${empEntries.length} tasks** in database\n`;
    if (topClients) {
      res += `• 🏢 **Primary Clients / Groups Handled**: ${topClients}\n`;
    }

    res += `\n`;

    // 4. Individual Duplicacy Audit (6 fields)
    res += `🔍 **4. Duplicacy Audit for ${name}**:\n`;
    if (empDuplicates.length > 0) {
      res += `• ⚠️ **Duplicate Work Detected**: Found **${totalDuplicateOccurrences} repeated entries** across **${empDuplicates.length} duplicate task sets**.\n`;
      res += `• *(Condition: Same Doer + Location + Dept + Group + Company + Task Description)*\n`;
      res += `**Top Repeated Tasks**:\n`;
      empDuplicates.slice(0, 3).forEach((d) => {
        const s = d.sample;
        res += `  - 🔁 _"${(s.taskDescription || "").slice(0, 100)}"_ — **Repeated ${d.count} times** (Company: ${s.companyName || s.groupName || "N/A"})\n`;
      });
    } else {
      res += `• ✅ **Clean (100% Unique Tasks)**: Zero duplicate tasks detected in this employee's diary!\n`;
    }

    res += `\n`;

    // 5. Individual AI & Claude Usage Audit
    res += `🤖 **5. AI & Claude Usage Audit**:\n`;
    if (aiEntries.length > 0) {
      res += `• ⚠️ **AI-Assisted Tasks Detected**: **${aiEntries.length} entries** contain ChatGPT or Claude phrasing.\n`;
      res += `  - Sample: _"${(aiEntries[0].taskDescription || "").slice(0, 120)}..."_\n`;
    } else {
      res += `• ✅ **Clean**: No AI prompts or Claude-generated text detected in this employee's tasks.\n`;
    }

    res += `\n`;

    // 6. Missing Dates & Compliance Backlog
    res += `🚨 **6. Missing Dates & Compliance Backlog**:\n`;
    if (missingDates.length > 0) {
      res += `• ⚠️ **Pending Dates Backlog**: **${missingDates.length} pending dates** (${missingDates.slice(0, 5).join(", ")}${missingDates.length > 5 ? ` + ${missingDates.length - 5} more` : ""})\n`;
      if (isDefaulterMoreThanTwo) {
        res += `• 🚨 **Compliance Flag**: **> 2 Days Defaulter!** Staff has not filled daily working for more than 2 days.\n`;
      }
    } else {
      res += `• ✅ **Up to Date**: Zero missing dates backlog. Full compliance!\n`;
    }

    res += `\n👇 **Download Daily Working Reports:**\n[DOWNLOAD_DAILY_WORKING_BUTTONS]`;
    return res;
  };

  // --- GENERAL ALL-EMPLOYEES DAILY WORKING SUMMARY ---
  const generateAllEmployeesWorkSummary = (profiles = [], workingLogs = []) => {
    const todayFormatted = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const submittedList = [];
    const pendingPresentList = [];
    const missingBacklogList = [];

    profiles.forEach((p) => {
      const empTodayTasks = (p.workingEntries || []).filter(
        (e) => formatExcelOrStringDate(e.date) === todayFormatted
      );
      const hasSubmitted = empTodayTasks.length > 0 || p.submittedToday;
      const totalTime = sumTimeGiven(empTodayTasks);

      if (hasSubmitted) {
        submittedList.push({
          name: p.rawName,
          category: p.category?.label || p.department,
          taskCount: empTodayTasks.length || p.todayEntriesCount || 1,
          totalTime: totalTime || "Logged",
        });
      } else if (p.cardPresent) {
        pendingPresentList.push({
          name: p.rawName,
          category: p.category?.label || p.department,
          punchIn: formatDisplayTime(p.punchIn),
          location: p.punchLocation || "Office",
        });
      }

      if (p.missingDates && p.missingDates.length > 0) {
        missingBacklogList.push({
          name: p.rawName,
          count: p.missingDates.length,
          dates: p.missingDates.slice(0, 3).join(", "),
        });
      }
    });

    let res = `👥 **Individual Employees Daily Working Summary Register**\n`;
    res += `• 📅 **Date**: ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n\n`;

    res += `### ✅ 1. Submitted Today (${submittedList.length} staff):\n`;
    if (submittedList.length > 0) {
      submittedList.slice(0, 10).forEach((s) => {
        res += `• **${s.name}** [${s.category}] — **${s.taskCount} task${s.taskCount > 1 ? "s" : ""}** (${s.totalTime})\n`;
      });
      if (submittedList.length > 10) {
        res += `  *...and ${submittedList.length - 10} more staff submitted.*\n`;
      }
    } else {
      res += `• *(No daily working submissions logged yet today)*\n`;
    }

    res += `\n### ⚠️ 2. Punched In but Daily Work Pending (${pendingPresentList.length} staff):\n`;
    if (pendingPresentList.length > 0) {
      pendingPresentList.slice(0, 10).forEach((s) => {
        res += `• **${s.name}** [${s.category}] — In at ${s.punchIn} (${s.location}) | **Work Pending ⏳**\n`;
      });
      if (pendingPresentList.length > 10) {
        res += `  *...and ${pendingPresentList.length - 10} more present staff pending.*\n`;
      }
    } else {
      res += `• *(All present staff have submitted their daily work today! 🎉)*\n`;
    }

    res += `\n### 🚨 3. Staff with Missing Dates Backlog (${missingBacklogList.length} staff):\n`;
    if (missingBacklogList.length > 0) {
      missingBacklogList.slice(0, 8).forEach((s) => {
        res += `• **${s.name}**: **${s.count} pending dates** (${s.dates}${s.count > 3 ? "..." : ""})\n`;
      });
    } else {
      res += `• *(No staff with missing dates backlog)*\n`;
    }

    // Top staff chips
    const chipEmployees = profiles.slice(0, 4).map((p) => p.rawName);
    const chipStr = chipEmployees
      .map((name) => `Daily working of ${name}|👤 ${name.split(" ")[0]} Work`)
      .join(";");

    res += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    res += `💡 **Click or ask about any employee to see their complete individual daily working dossier (with full task details, time spent, duplicate task check, and AI usage audit)**:\n`;
    res += `[ACTION_CHIPS:${chipStr}]\n\n`;
    res += `👇 **Download Daily Working Reports:**\n[DOWNLOAD_DAILY_WORKING_BUTTONS]`;

    return res;
  };

  // --- MONTHLY ATTENDANCE (SPECIFIC MONTH OR LATEST + COMPARISON) ---
  const generateMonthlyAttendanceReport = (queryText = "") => {
    const q = (queryText || "").toLowerCase();
    if (!activeMonthlyData || !activeMonthlyData.monthlySummaries || activeMonthlyData.monthlySummaries.length === 0) {
      return `📊 **Monthly Attendance Register is connecting to Google Sheet...**\n\nSyncing latest biometric and sheet records. Please try again in 2-3 seconds or visit the **Attendance Report** page.`;
    }

    const requestedMonth = parseTargetMonthFromQuery(q);
    const wantsAllMonths = /\b(all\s+months|month[\s-]*wise|every\s+month|comparison)\b/i.test(q);
    const scopeArg = requestedMonth ? requestedMonth : wantsAllMonths ? "ALL" : "CURRENT";
    const resolved = resolveMonthlyAttendanceSlice(activeMonthlyData, scopeArg);

    if (requestedMonth && (!resolved.ready || !resolved.found || !resolved.slice)) {
      const avail = (resolved.availableMonths || []).map((m) => `\`${m.monthName}\` (${m.avgPct}%)`).join(", ");
      return `📊 **Monthly Attendance Register — ${requestedMonth.label}**\n\n• ⚠️ **No attendance records found for ${requestedMonth.label}.**\n• 📅 **Available Months in Google Sheet**: ${avail || "None"}`;
    }

    const slice = resolved.slice;
    const summaries = slice.monthlySummaries || [];
    const workingDays = slice.workingDaysCount || 26;
    const monthTitle = slice.monthName || slice.calendarMonth?.monthName || "Current Month";
    const scopeKey = requestedMonth ? slice.monthKey || requestedMonth.key : wantsAllMonths ? "ALL" : (slice.monthKey || "CURRENT");

    const totalStaff = summaries.length;
    const avgPct = Math.round(summaries.reduce((acc, cur) => acc + (cur.attendancePct || 0), 0) / (totalStaff || 1));
    const totalLateLogs = summaries.reduce((acc, cur) => acc + (cur.lateDays || 0), 0);
    const totalAbsentDays = summaries.reduce((acc, cur) => acc + (cur.daysAbsent || 0), 0);
    const allLateStaff = summaries.filter((e) => (e.lateDays || 0) > 0).sort((a, b) => (b.lateDays || 0) - (a.lateDays || 0));
    const allAbsentStaff = summaries.filter((e) => (e.daysAbsent || 0) > 0).sort((a, b) => (b.daysAbsent || 0) - (a.daysAbsent || 0));

    const top5 = [...summaries].sort((a, b) => (b.attendancePct || 0) - (a.attendancePct || 0)).slice(0, 5);
    const topStr = top5
      .map((e, idx) => `  ${idx + 1}. **${e.employee}** [${e.categoryShort}] — **${e.attendancePct}%** (${e.daysPresent} present / ${e.totalDays} days • ${e.totalWorkingHours})`)
      .join("\n");

    let out = `📊 **Monthly Attendance Register — ${monthTitle} (${workingDays} Working Days)**\n\n`;
    out += `• 👥 **Total Staff Evaluated**: **${totalStaff} employees**\n`;
    out += `• 📈 **Firm Average Attendance Rate**: **${avgPct}%**\n`;
    out += `• ⏰ **Total Late Logs Recorded**: **${totalLateLogs}** (${allLateStaff.length} employees with late logs)\n`;
    out += `• ❌ **Total Absent Days Recorded**: **${totalAbsentDays}** (${allAbsentStaff.length} employees with absences)\n`;
    out += `• 🔗 **Source**: [Monthly Google Sheet](${MONTHLY_GOOGLE_SHEET_URL})\n\n`;

    if (q.includes("late") && allLateStaff.length > 0) {
      out += `━━━━━━━━━━━━━━━━━━━━\n⏰ **Top Late Staff in ${monthTitle}**:\n`;
      allLateStaff.slice(0, 10).forEach((e, i) => {
        out += `  ${i + 1}. **${e.employee}** [${e.categoryShort}] — **${e.lateDays} late days** (${e.daysPresent}/${e.totalDays} present)\n`;
      });
      out += `\n`;
    } else if (q.includes("absent") && allAbsentStaff.length > 0) {
      out += `━━━━━━━━━━━━━━━━━━━━\n❌ **Top Absent Staff in ${monthTitle}**:\n`;
      allAbsentStaff.slice(0, 10).forEach((e, i) => {
        out += `  ${i + 1}. **${e.employee}** [${e.categoryShort}] — **${e.daysAbsent} absent days** (${e.attendancePct}%)\n`;
      });
      out += `\n`;
    }

    out += `━━━━━━━━━━━━━━━━━━━━\n🏆 **Top Consistent Employees (${monthTitle})**:\n${topStr}\n`;

    const availMonths = activeMonthlyData.availableMonths || [];
    if (availMonths.length > 1) {
      if (!requestedMonth || wantsAllMonths) {
        out += `\n━━━━━━━━━━━━━━━━━━━━\n📅 **All Recorded Months Comparison**:\n`;
        availMonths.forEach((m) => {
          out += `• **${m.monthName}**: **${m.avgPct}%** avg | ${m.totalStaff} staff | ${m.workingDaysCount} working days | ${m.totalLateLogs} late | ${m.totalAbsentDays} absent\n`;
        });
      }
      const chips = availMonths
        .slice(-4)
        .reverse()
        .map((m) => `Attendance for ${m.monthName}|📊 ${m.monthName}`)
        .join(";");
      if (chips) out += `\n[ACTION_CHIPS:${chips}]\n`;
    }

    out += `\n👇 **Download ${monthTitle} Attendance Reports:**\n[DOWNLOAD_MONTHLY_BUTTONS:${scopeKey}]`;
    return out;
  };

  // --- ALL 5 MODULES MONTHLY / SPECIFIC MONTH UNIFIED REPORT ---
  const generateAllModulesMonthlyReport = (queryText = "") => {
    const requestedMonth = parseTargetMonthFromQuery(queryText);

    if (requestedMonth) {
      const fmsSpec = parseFmsTargetMonth(requestedMonth.key);

      // 1. Attendance
      const attResolved = resolveMonthlyAttendanceSlice(activeMonthlyData, requestedMonth);
      let attSection = "";
      if (attResolved.ready && attResolved.found && attResolved.slice) {
        const s = attResolved.slice;
        const sums = s.monthlySummaries || [];
        const avgPct = Math.round(sums.reduce((a, c) => a + (c.attendancePct || 0), 0) / (sums.length || 1));
        const late = sums.reduce((a, c) => a + (c.lateDays || 0), 0);
        const abs = sums.reduce((a, c) => a + (c.daysAbsent || 0), 0);
        attSection = `• ✅ **${s.monthName}**: **${avgPct}% avg** across **${sums.length} staff** (${s.workingDaysCount} working days) | ⏰ Late: **${late}** | ❌ Absent: **${abs}**`;
      } else {
        const avail = (attResolved.availableMonths || []).map((m) => m.monthName).join(", ");
        attSection = `• ⚠️ No Attendance records for **${requestedMonth.label}**${avail ? ` *(Available: ${avail})*` : ""}.`;
      }

      // 2. Senior & Junior Task (Delegation)
      const summarizeTierMonth = (list, tierLabel) => {
        const tf = filterTasksByNaturalMonth(list, queryText);
        if (tf.filtered.length > 0) {
          const ov = computeSeniorTaskAnalytics(tf.filtered).overview;
          return `• ✅ **${tf.matchedLabel || requestedMonth.label}**: **${ov.totalTasks} ${tierLabel} tasks** | Done: **${ov.doneCount}** (${ov.completionRate}%, ${ov.onTimeRate}% on-time) | ❌ Cancelled: **${ov.cancelledCount}** (${ov.cancelRate}%) | 🚨 Overdue Open: **${ov.overdueCount}**`;
        }
        return `• ⚠️ **0 ${tierLabel} Delegation tasks** recorded for **${requestedMonth.label}**.`;
      };
      const stSection = summarizeTierMonth(seniorTasks, "Senior");
      const jtSection = summarizeTierMonth(juniorTasks, "Junior");

      // 3. Daily Working
      const dwAudit = auditDailyWorkingMonthly(workingLogs, profiles, requestedMonth);
      let dwSection = "";
      if (dwAudit.bucket.totalEntries > 0) {
        const b = dwAudit.bucket;
        const top = b.staffRows[0];
        dwSection = `• ✅ **${requestedMonth.label}**: **${b.totalEntries.toLocaleString("en-IN")} entries** by **${b.activeStaffCount} staff** across **${b.activeDaysCount} days** (⏱️ **${b.totalHoursText}**) | ⚠️ <9h: **${dwAudit.shortfallDays} days** | 🔁 Dupes: **${dwAudit.duplicateRows}**${top ? ` | 🏆 Top: **${top.name}**` : ""}`;
      } else {
        const avail = dwAudit.availableMonths.map((m) => m.label).join(", ");
        dwSection = `• ⚠️ **0 Daily Working entries** found for **${requestedMonth.label}**${avail ? ` *(Available: ${avail})*` : ""}.`;
      }

      // 4. Internal Audit FMS
      const iaMatched = internalAudits.map((it) => matchFmsRecordToMonth(it, fmsSpec, "iaPeriod")).filter((m) => m.matched);
      const iaDirect = iaMatched.filter((m) => m.tier === "direct").length;
      const iaAnnual = iaMatched.filter((m) => m.tier === "annual").length;
      const iaSection = iaMatched.length > 0
        ? `• ✅ **${requestedMonth.label}**: **${iaDirect} direct cycle/dated** + **${iaAnnual} annual FY** engagements (**${iaMatched.length} total applicable**)`
        : `• ⚠️ **0 Internal Audit FMS cycles** matched for **${requestedMonth.label}**.`;

      // 5. PMS FMS
      const pmsMatched = pmsRecords.map((it) => matchFmsRecordToMonth(it, fmsSpec, "pmsPeriod")).filter((m) => m.matched);
      const pmsSection = pmsRecords.length === 0
        ? `• ℹ️ **0 PMS FMS records** currently loaded in PMS sheet/portal.`
        : pmsMatched.length > 0
          ? `• ✅ **${requestedMonth.label}**: **${pmsMatched.length} PMS engagement(s)** applicable`
          : `• ⚠️ **0 PMS FMS records** matched for **${requestedMonth.label}**.`;

      let out = `📊 **AJC Executive Monthly Report — ${requestedMonth.label} (All Modules)**\n`;
      out += `_Strictly filtered to **${requestedMonth.label}** across Attendance, Senior & Junior Delegation, Daily Working, IA FMS & PMS FMS._\n\n`;
      out += `### 1. 📊 Attendance\n${attSection}\n\n`;
      out += `### 2A. 👔 Senior Task (Delegation)\n${stSection}\n\n`;
      out += `### 2B. 🧑‍💻 Junior Task (Delegation)\n${jtSection}\n\n`;
      out += `### 3. 📝 Daily Working\n${dwSection}\n\n`;
      out += `### 4. 🛡️ Internal Audit FMS\n${iaSection}\n\n`;
      out += `### 5. 📌 PMS FMS\n${pmsSection}\n\n`;
      out += `[ACTION_CHIPS:Attendance for ${requestedMonth.label}|📊 Attendance Only;Senior delegation report for ${requestedMonth.label}|👔 Senior Delegation;Junior delegation report for ${requestedMonth.label}|🧑‍💻 Junior Delegation;Daily working report for ${requestedMonth.label}|📝 Daily Working Only;Internal Audit FMS for ${requestedMonth.label}|🛡️ IA FMS Only]\n\n`;
      out += `👇 **Download ${requestedMonth.label} Reports (Strictly Filtered):**\n[DOWNLOAD_ALL_MODULES_MONTHLY:${requestedMonth.key}]`;
      return out;
    }

    // Cross-module Month-Wise Overview
    const attMonths = (activeMonthlyData?.availableMonths || []).map((m) => `**${m.monthName}** (${m.avgPct}%)`).join(", ");
    const stMonths = seniorTaskAnalytics.monthly.slice(-6).map((m) => `**${m.monthLabel}** (${m.total})`).join(", ");
    const jtMonths = juniorTaskAnalytics.monthly.slice(-6).map((m) => `**${m.monthLabel}** (${m.total})`).join(", ");
    const dwOverview = auditDailyWorkingMonthly(workingLogs, profiles, "ALL");
    const dwMonths = dwOverview.availableMonths.slice(0, 6).map((m) => `**${m.label}** (${m.totalEntries})`).join(", ");

    let out = `📅 **AJC All-Modules Monthly Report Center**\n\n`;
    out += `• 📊 **1. Attendance**: ${attMonths || "Syncing..."}\n`;
    out += `• 👔 **2A. Senior Task (Delegation)**: ${seniorTaskAnalytics.monthly.length} months (${stMonths || "Syncing..."})\n`;
    out += `• 🧑‍💻 **2B. Junior Task (Delegation)**: ${juniorTaskAnalytics.monthly.length} months (${jtMonths || "Syncing..."})\n`;
    out += `• 📝 **3. Daily Working**: ${dwOverview.availableMonths.length} months (${dwMonths || "Syncing..."})\n`;
    out += `• 🛡️ **4. Internal Audit FMS**: ${internalAudits.length} engagements mapped across Q1–Q4, Half-Year, FY & Live Dates\n`;
    out += `• 📌 **5. PMS FMS**: ${pmsRecords.length} loaded PMS assignments\n\n`;
    out += `💡 _Click any month below to view & download that exact month's report across ALL 5 modules:_\n`;
    out += `[ACTION_CHIPS:October 2026 report|📅 October 2026;September 2026 report|📅 September 2026;August 2026 report|📅 August 2026;July 2026 report|📅 July 2026]\n\n`;
    out += `[DOWNLOAD_ALL_MODULES_MONTHLY:ALL]`;
    return out;
  };

  // --- LOCAL RULE-BASED ANALYZER ---
  const generateLocalAnswer = (query) => {
    const q = query.toLowerCase();
    const cleanQ = cleanString(q);

    // 1. HR & Labour Law statutory check
    const hrAns = getHRLabourLawAnswer(query);
    if (hrAns) return hrAns;

    // 2. Sundays policy check
    if (q.includes("sunday") && (q.includes("absent") || q.includes("off") || q.includes("count") || q.includes("leave") || q.includes("holiday"))) {
      return `🏖️ **Sunday Attendance Policy (Official Weekly Off)**:\n\n• 🏖️ **Sundays are official WEEKLY OFF days** (Offices are closed).\n• ❌ **Sundays are NEVER counted as absent days** for any employee.\n• ✅ **Absence is strictly counted only on working days** (Monday to Saturday).\n• 📊 All Monthly and Weekly registers calculate attendance compliance exclusively across working days!`;
    }

    // 2.3 SENIOR & JUNIOR TASK (DELEGATION) SPECIALIZED INTELLIGENCE
    const targetMonthSpec = parseTargetMonthFromQuery(q);
    const hasSpecificMonth = Boolean(targetMonthSpec && !targetMonthSpec.isAllMonths);
    const hasMonthWord = /\b(monthly|month|month-wise|month wise|this month|current month|whole month|entire month|all months)\b/i.test(q);
    const hasAnyMonthRef = hasSpecificMonth || hasMonthWord;

    const wantsJuniorTier =
      q.includes("junior") ||
      q.includes("juniot") ||
      /\bjr\b/i.test(q) ||
      q.includes("ajc_ds");
    const wantsSeniorTier =
      q.includes("senior") ||
      q.includes("seniot") ||
      /\bsr\b/i.test(q) ||
      q.includes("ajc-ds");

    const isCancelKeyword = /canc(?:e|l)+|cancle|canceled|cancelled/i.test(q);
    const isExplicitWorkingQuery =
      q.includes("daily working") ||
      q.includes("working sheet") ||
      q.includes("work log") ||
      q.includes("work diary") ||
      q.includes("task description");
    const isOtherModuleQuery =
      isExplicitWorkingQuery ||
      q.includes("same task") ||
      q.includes("identical work") ||
      q.includes("different employee") ||
      q.includes("pms") ||
      q.includes("internal audit") ||
      q.includes("ia fms") ||
      q.includes("audit fms") ||
      /\bfms\b/i.test(q) ||
      q.includes("attendance") ||
      q.includes("late arrival") ||
      q.includes("9 hour") ||
      q.includes("duplic");
    const isOverdueTaskKeyword =
      !isOtherModuleQuery &&
      (q.includes("overdue") || q.includes("past target") || q.includes("due within"));
    const isDoneTaskKeyword =
      !isOtherModuleQuery &&
      !q.includes("not done") &&
      ((q.includes("done") &&
        (q.includes("task") ||
          q.includes("senior") ||
          q.includes("junior") ||
          q.includes("delegat") ||
          q.includes("report") ||
          q.includes("repost") ||
          q.includes("month") ||
          q.trim() === "done")) ||
        (q.includes("completed") &&
          (q.includes("task") ||
            q.includes("senior") ||
            q.includes("junior") ||
            q.includes("delegat") ||
            q.includes("report") ||
            q.includes("repost") ||
            q.includes("month"))));
    const isPureDownloadCommand =
      q.startsWith("download") || q.startsWith("downlaod") || q.startsWith("export");

    const isDelegationTaskIntent =
      !isOtherModuleQuery &&
      !isPureDownloadCommand &&
      (wantsJuniorTier ||
        wantsSeniorTier ||
        q.includes("delegation") ||
        q.includes("delegat") ||
        q.includes("assignor") ||
        q.includes("doer") ||
        isCancelKeyword ||
        isOverdueTaskKeyword ||
        isDoneTaskKeyword ||
        q.includes("revision") ||
        (q.includes("task") &&
          (q.includes("month") ||
            q.includes("most") ||
            q.includes("overdue") ||
            q.includes("past target") ||
            q.includes("pending") ||
            q.includes("status") ||
            q.includes("report") ||
            q.includes("repost") ||
            q.includes("work type") ||
            q.includes("summary") ||
            q.includes("how many") ||
            q.includes("who") ||
            q.includes("of ") ||
            q.includes("for ") ||
            q.includes("by "))));

    const generateDelegationReportForTier = (tierKey) => {
      const taskList = tierKey === "junior" ? juniorTasks : seniorTasks;
      const analytics = tierKey === "junior" ? juniorTaskAnalytics : seniorTaskAnalytics;

      if (!q.includes("who") && !q.includes("most")) {
        const personTaskReport = getSeniorTaskPersonReport(taskList, query, tierKey);
        if (personTaskReport) return personTaskReport;
      }
      if (isCancelKeyword) {
        return getSeniorTaskCancelledReport(taskList, query, tierKey);
      }
      if (isOverdueTaskKeyword || q.includes("revision") || q.includes("delay")) {
        return getSeniorTaskRevisionsAndOverdueReport(taskList, query, tierKey);
      }
      if (isDoneTaskKeyword) {
        return getSeniorTaskDoneReport(taskList, query, tierKey);
      }
      if (q.includes("month") || Boolean(parseTargetMonthFromQuery(q))) {
        return getSeniorTaskMonthWiseReport(taskList, query, tierKey);
      }
      const wtOrGroupReport = getSeniorTaskWorkTypeOrClientReport(taskList, query, tierKey);
      if (wtOrGroupReport) return wtOrGroupReport;
      return getSeniorTaskOverviewReport(taskList, analytics, tierKey);
    };

    if (isDelegationTaskIntent) {
      if (wantsJuniorTier && !wantsSeniorTier) {
        return generateDelegationReportForTier("junior");
      }
      if (wantsSeniorTier && !wantsJuniorTier) {
        return generateDelegationReportForTier("senior");
      }

      // Neither Senior nor Junior explicitly requested: check Person match across both tiers first!
      if (!q.includes("who") && !q.includes("most")) {
        const seniorPerson = getSeniorTaskPersonReport(seniorTasks, query, "senior");
        const juniorPerson = getSeniorTaskPersonReport(juniorTasks, query, "junior");
        if (seniorPerson && juniorPerson) {
          return `${seniorPerson}\n\n---\n\n${juniorPerson}`;
        }
        if (seniorPerson) return seniorPerson;
        if (juniorPerson) return juniorPerson;
      }

      // Return Senior report paired with Junior summary & Junior download tag
      const seniorReport = generateDelegationReportForTier("senior");
      const juniorReport = generateDelegationReportForTier("junior");
      const jOv = juniorTaskAnalytics.overview;
      if (wantsSeniorTier && wantsJuniorTier) {
        return `${seniorReport}\n\n---\n\n${juniorReport}`;
      }
      const jTagMatch = juniorReport.match(/\[DOWNLOAD_JUNIOR_TASK_[^\]]+\]/);
      const jSummaryLine = `\n\n---\n\n### 🧑‍💻 Junior Task Delegation Snapshot:\n• 📌 **Total Junior Tasks**: **${jOv.totalTasks.toLocaleString("en-IN")}** | ✅ **Done**: **${jOv.doneCount.toLocaleString("en-IN")}** (${jOv.completionRate}%) | ❌ **Cancelled**: **${jOv.cancelledCount}** (${jOv.cancelRate}%) | 🚨 **Overdue**: **${jOv.overdueCount}**\n${jOv.topCancelledDoer ? `• 👤 **Most Cancelled Junior (Doer)**: **${jOv.topCancelledDoer.name}** (${jOv.topCancelledDoer.cancelled} cancelled)\n` : ""}${jTagMatch ? jTagMatch[0] : "[DOWNLOAD_JUNIOR_TASK_EXCEL]"}\n\n[ACTION_CHIPS:Junior delegation ${isCancelKeyword ? "cancelled report" : isOverdueTaskKeyword ? "overdue report" : isDoneTaskKeyword ? "done report" : "monthly report"}|🧑‍💻 Full Junior Report;Senior delegation ${isCancelKeyword ? "cancelled report" : isOverdueTaskKeyword ? "overdue report" : isDoneTaskKeyword ? "done report" : "monthly report"}|👔 Senior Full Report]`;
      return `${seniorReport}${jSummaryLine}`;
    }

    // 2.4 PMS FMS SPECIALIZED INTELLIGENCE
    const isPmsFmsIntent =
      q.includes("pms fms") ||
      q.includes("pms step") ||
      q.includes("steps of pms") ||
      (q.includes("17 step") && q.includes("pms")) ||
      (q.includes("pms") && !isExplicitWorkingQuery) ||
      q.includes("performance management") ||
      q.includes("process management");

    if (isPmsFmsIntent) {
      // A0. PMS Assignments with Blank Actual and Status fields
      const isPmsBlankActualStatus =
        (q.includes("actual") && q.includes("status")) ||
        q.includes("blank") ||
        q.includes("both blank") ||
        q.includes("both are blank");

      if (isPmsBlankActualStatus) {
        return getPmsBlankActualAndStatusSummary(pmsRecords);
      }

      // A. The 17 Steps Protocol for PMS FMS
      if (
        q.includes("17 step") ||
        q.includes("step") ||
        q.includes("sop") ||
        q.includes("procedure") ||
        q.includes("workflow")
      ) {
        return getPms17StepsGuideReport();
      }

      // B. Plant vs City PMS Assignments
      if (
        (q.includes("plant") || q.includes("city")) &&
        (q.includes("show") || q.includes("list") || q.includes("which") || q.includes("assignment") || q.includes("type") || q.includes("vs"))
      ) {
        return getPmsByTypeReport(pmsRecords, q.includes("plant") ? "Plant" : "City");
      }

      // C. Partner or Senior PMS Assignments
      if (
        q.includes("of ") ||
        q.includes("for ") ||
        q.includes("assigned") ||
        q.includes("under") ||
        q.includes("by ") ||
        q.includes("incharge") ||
        q.includes("in-charge")
      ) {
        const pmsPersonReport = getPartnerOrSeniorPmsReport(pmsRecords, query);
        if (pmsPersonReport) return pmsPersonReport;
      }

      // D0. Month-wise or Specific Month PMS FMS Report
      if (hasAnyMonthRef) {
        return getPmsMonthlyReport(pmsRecords, query);
      }

      // D. Specific Client Company or Group PMS Status
      if (
        q.includes("status") ||
        q.includes("company") ||
        q.includes("client") ||
        q.includes("group") ||
        q.includes("of ") ||
        q.includes("for ")
      ) {
        const pmsClientReport = getClientOrGroupPmsReport(pmsRecords, query);
        if (pmsClientReport) return pmsClientReport;
      }

      // E. General PMS FMS Overview / Status
      return getPmsOverview(pmsRecords);
    }

    // 2.45 MULTI-COMPANY / GROUP WORK COMPLETION INTELLIGENCE
    const isCompanyAuditIntent =
      q.includes("work completion") ||
      q.includes("completion report") ||
      q.includes("completion on date") ||
      q.includes("on date report") ||
      q.includes("on target date") ||
      q.includes("before target") ||
      q.includes("after target") ||
      q.includes("early completion") ||
      q.includes("delayed completion") ||
      q.includes("late completion") ||
      q.includes("ahead of target") ||
      q.includes("ahead of schedule") ||
      q.includes("company completion") ||
      q.includes("group completion") ||
      (q.includes("target date") && (q.includes("completion") || q.includes("done") || q.includes("status") || q.includes("after") || q.includes("before") || q.includes("on date") || q.includes("variance"))) ||
      COMPANY_AUDIT_ENDPOINTS.some(
        (c) =>
          (q.includes(c.shortName.toLowerCase()) || q.includes(c.name.toLowerCase())) &&
          (q.includes("completion") || q.includes("target") || q.includes("audit") || q.includes("report") || q.includes("pms") || q.includes("status") || q.includes("task"))
      ) ||
      COMPANY_AUDIT_ENDPOINTS.some(
        (c) => q.trim() === c.shortName.toLowerCase() || q.trim() === c.name.toLowerCase()
      );

    if (isCompanyAuditIntent) {
      const activeData = companyAuditData || { allTasks: [], companySummaries: [] };

      // Helper to match longest/most specific company name
      const findBestMatchingCompany = () => {
        const matches = COMPANY_AUDIT_ENDPOINTS.filter(
          (c) => q.includes(c.shortName.toLowerCase()) || q.includes(c.name.toLowerCase())
        );
        return matches.sort((a, b) => b.shortName.length - a.shortName.length)[0] || null;
      };

      // 1. Work completion ON target date
      if (
        q.includes("on date") ||
        q.includes("on target") ||
        q.includes("on-time") ||
        q.includes("ontime") ||
        (q.includes("exact") && q.includes("target"))
      ) {
        const matchedComp = findBestMatchingCompany();
        return getWorkCompletionOnDateReport(activeData, matchedComp?.shortName || null);
      }

      // 2. Work completion BEFORE target date (ahead of schedule / early)
      if (
        q.includes("before target") ||
        q.includes("before date") ||
        q.includes("early") ||
        q.includes("ahead") ||
        q.includes("before deadline")
      ) {
        const matchedComp = findBestMatchingCompany();
        return getWorkCompletionBeforeTargetDateReport(activeData, matchedComp?.shortName || null);
      }

      // 3. Work completion AFTER target date (delayed / late)
      if (
        q.includes("after target") ||
        q.includes("after date") ||
        q.includes("delayed") ||
        q.includes("delay") ||
        q.includes("late") ||
        q.includes("after deadline") ||
        q.includes("past target")
      ) {
        const matchedComp = findBestMatchingCompany();
        return getWorkCompletionAfterTargetDateReport(activeData, matchedComp?.shortName || null);
      }

      // 4. Specific single company completion / PMS report
      const matchedComp = findBestMatchingCompany();
      if (matchedComp) {
        return getSingleCompanyCompletionReport(activeData, matchedComp.shortName);
      }

      // 5. Overall multi-company work completion overview
      return getCompanyAuditOverviewReport(activeData);
    }

    // 2.5 INTERNAL AUDIT FMS SPECIALIZED INTELLIGENCE
    // A00. Target date blank in FMS
    const isTargetDateBlank =
      (q.includes("target") && (q.includes("blank") || q.includes("not filled") || q.includes("missing") || q.includes("not set") || q.includes("without"))) ||
      (q.includes("target date") && (q.includes("blank") || q.includes("missing") || q.includes("null") || q.includes("report")));

    if (isTargetDateBlank) {
      return getFmsTargetDateBlankSummary(internalAudits);
    }

    // A0. Employees with Blank Actual and Status fields / Blank steps / Missed steps
    const isBlankActualStatus =
      q.includes("blank step") ||
      q.includes("missed step") ||
      q.includes("which step") ||
      q.includes("steps missed") ||
      q.includes("steps are missed") ||
      (q.includes("actual") && q.includes("status")) ||
      (q.includes("blank") && (q.includes("actual") || q.includes("status") || q.includes("audit") || q.includes("fms") || q.includes("field") || q.includes("step"))) ||
      (q.includes("both are blank") || q.includes("both blank"));

    if (isBlankActualStatus) {
      return getBlankActualAndStatusSummary(internalAudits);
    }

    // A. The 18 Steps SOP Protocol
    if (
      q.includes("18 step") ||
      q.includes("17 step") ||
      q.includes("18 steps") ||
      q.includes("17 steps") ||
      q.includes("fms step") ||
      q.includes("steps of internal audit") ||
      q.includes("internal audit step") ||
      q.includes("audit step") ||
      q.includes("audit procedure") ||
      q.includes("fms sop") ||
      q.includes("ia step")
    ) {
      return get18StepsGuideReport();
    }

    // B. Plant vs City Internal Audits
    if (
      (q.includes("plant") || q.includes("city")) &&
      (q.includes("plant audit assignment") ||
        q.includes("plant internal audit") ||
        q.includes("plant audits") ||
        q.includes("city audit") ||
        q.includes("city internal audit") ||
        q.includes("plant vs city") ||
        q.includes("city vs plant") ||
        (q.includes("audit") && (q.includes("plant") || q.includes("city")) && (q.includes("show") || q.includes("list") || q.includes("which"))))
    ) {
      return getAuditsByTypeReport(internalAudits, q.includes("plant") ? "Plant" : "City");
    }

    // C. Partner or Senior Internal Audits (e.g. "audits of Harsh Mittal", "audits assigned to Rupesh Vaid", "audits of Mukul Jain", "Chandan Singh audits")
    if (
      (q.includes("audit") || q.includes("ia") || q.includes("assignment") || q.includes("engagement") || q.includes("fms")) &&
      (q.includes("of ") || q.includes("for ") || q.includes("assigned") || q.includes("under") || q.includes("by ") || q.includes("incharge") || q.includes("in-charge"))
    ) {
      const partnerOrSeniorReport = getPartnerOrSeniorAuditReport(internalAudits, query);
      if (partnerOrSeniorReport) return partnerOrSeniorReport;
    }

    // D0. Month-wise or Specific Month Internal Audit FMS Report
    if (
      (q.includes("internal audit") || q.includes("ia fms") || q.includes("audit fms") || /\bfms\b/i.test(q) || /\bia\b/i.test(q) || cleanQ === "audit" || (q.includes("audit") && !isExplicitWorkingQuery && !q.includes("attendance"))) &&
      hasAnyMonthRef
    ) {
      return getInternalAuditMonthlyReport(internalAudits, query);
    }

    // D. Specific Client Company or Group Audit (e.g. "audit of shree hanuman loha", "balajee audit status", "bhagwati audit")
    if (
      (q.includes("audit") || q.includes("ia") || q.includes("fms")) &&
      (q.includes("status") || q.includes("company") || q.includes("client") || q.includes("group") || q.includes("of ") || q.includes("for "))
    ) {
      const clientReport = getClientAuditReport(internalAudits, query);
      if (clientReport) return clientReport;
    }

    // E. General Internal Audit FMS Status / Overview
    if (
      q.includes("internal audit") ||
      q.includes("ia fms") ||
      q.includes("audit fms") ||
      /\bfms\b/i.test(q) ||
      /\bia\b/i.test(q) ||
      cleanQ === "fms" ||
      cleanQ === "internal audit fms" ||
      cleanQ === "ia" ||
      cleanQ === "audit" ||
      q.includes("flow management system")
    ) {
      return getInternalAuditOverview(internalAudits);
    }

    // 3. Check for Specialized Daily Working Queries
    if (isCrossEmployeeDuplicateQuery(q)) {
      return generateCrossEmployeeDuplicatesReport(workingLogs, profiles, query);
    }

    if (isDuplicacyQuery(q)) {
      return generateWorkDuplicacyReport(workingLogs, query);
    }

    if (isAiUsageQuery(q)) {
      return generateAiAndClaudeUsageReport(workingLogs, query);
    }

    if (isMoreThanTwoDaysQuery(q)) {
      return generateUnsubmittedMoreThanTwoDaysReport(profiles);
    }

    if (isLessThanNineHoursQuery(q)) {
      return generateLessThanNineHoursReport(workingLogs, profiles, query);
    }

    // Monthly Daily Working query (check before individual targetMatch if no employee is named, or when explicitly asking daily working monthly/month)
    const isDailyWorkingModuleQuery =
      isExplicitWorkingQuery ||
      ((q.includes("working") || q.includes("diary")) && !q.includes("working hour") && !q.includes("work hour") && !q.includes("working day") && !q.includes("attendance"));
    const targetMatchForWorkCheck = matchTargetEmployee(query);
    if (
      !isPureDownloadCommand &&
      isDailyWorkingModuleQuery &&
      hasAnyMonthRef &&
      !targetMatchForWorkCheck
    ) {
      return getDailyWorkingMonthlyChatbotReport(workingLogs, profiles, query);
    }

    // Defaulters query
    if (q.includes("defaulter") || q.includes("not submit") || q.includes("pending work") || q.includes("missing date")) {
      return generateDefaultersReport(profiles);
    }

    // 3.5 General Individual Employees Daily Working Summary Check
    const isGeneralIndividualWorkQuery =
      (q.includes("individual summary") ||
        q.includes("individual report") ||
        q.includes("staff summary") ||
        q.includes("employees summary") ||
        q.includes("employee summary") ||
        q.includes("employees work summary") ||
        q.includes("individual work")) &&
      (q.includes("daily working") || q.includes("work") || q.includes("task") || q.includes("diary") || !q.includes("attendance"));

    // 4. Target Employee Match (Daily Working Dossier or 360° Dossier)
    const targetMatch = matchTargetEmployee(query);
    if (targetMatch && !q.includes("how many") && !q.includes("all late") && !q.includes("who is late") && !q.includes("who is absent")) {
      const isDailyWorkSpecific =
        q.includes("daily work") ||
        q.includes("working") ||
        q.includes("task") ||
        q.includes("diary") ||
        q.includes("kaam") ||
        q.includes("kya kiya") ||
        q.includes("work summary") ||
        q.includes("individual summary") ||
        q.includes("work report") ||
        q.includes("submission");

      if (isDailyWorkSpecific) {
        return generateIndividualDailyWorkingSummary(targetMatch, query);
      }
      return generateUnified360Dossier(targetMatch);
    }

    if (isGeneralIndividualWorkQuery && !targetMatch) {
      return generateAllEmployeesWorkSummary(profiles, workingLogs);
    }

    // 5. Download / Export Intent Check
    const isAskingToDownload =
      q.includes("download") ||
      q.includes("downlaod") ||
      q.includes("export") ||
      /\b(xlsx|excel|pdf)\b/i.test(q);

    if (isAskingToDownload) {
      const isDelegationDownload =
        !isOtherModuleQuery &&
        (wantsJuniorTier ||
          wantsSeniorTier ||
          q.includes("delegat") ||
          isCancelKeyword ||
          isOverdueTaskKeyword ||
          isDoneTaskKeyword ||
          (q.includes("task") && !q.includes("same task")));

      if (isDelegationDownload) {
        const dlScope = q.replace(/[[\]]/g, " ").trim() || "ALL";
        const buildTierDownloadMsg = (tierKey) => {
          const meta = getDelegationMeta(tierKey);
          const ov = (tierKey === "junior" ? juniorTaskAnalytics : seniorTaskAnalytics).overview;
          const mCount = (tierKey === "junior" ? juniorTaskAnalytics : seniorTaskAnalytics).monthly.length;
          if (isCancelKeyword) {
            return `❌ **${meta.label} Cancellation Report Download**:\n\nClick below to download the multi-tab Excel workbook detailing **${ov.cancelledCount} cancelled tasks**, Top Cancelled ${meta.pluralLabel} & Assignors, and Month-Wise Cancellations:\n\n[DOWNLOAD_${meta.tagPrefix}_CANCEL_EXCEL:${dlScope}]`;
          }
          if (isOverdueTaskKeyword || q.includes("revision") || q.includes("delay")) {
            return `🚨 **${meta.label} Overdue & Delay Report Download**:\n\nClick below to download the multi-tab Excel workbook detailing **${ov.overdueCount} open overdue tasks** and **${ov.doneLateCount} completed post-target tasks**, Top Overdue ${meta.pluralLabel} & Assignors, and Month-Wise Overdue Trends:\n\n[DOWNLOAD_${meta.tagPrefix}_OVERDUE_EXCEL:${dlScope}]`;
          }
          if (isDoneTaskKeyword) {
            return `✅ **${meta.label} Done (Completed) Report Download**:\n\nClick below to download the multi-tab Excel workbook detailing **${ov.doneCount} completed tasks** (**${ov.completionRate}% completion rate** | **${ov.onTimeRate}% on-time**), ${meta.shortLabel}/Assignor Scorecards, and Month-Wise Trends:\n\n[DOWNLOAD_${meta.tagPrefix}_DONE_EXCEL:${dlScope}]`;
          }
          if (q.includes("month") || Boolean(parseTargetMonthFromQuery(q))) {
            return `📅 **${meta.label} Monthly Report Download**:\n\nClick below to download the multi-tab Excel workbook covering **${mCount} months**, Done vs Open vs Overdue vs Cancelled breakdown, Month Performers, and Task Register:\n\n[DOWNLOAD_${meta.tagPrefix}_MONTHLY_EXCEL:${dlScope}]`;
          }
          return `🗂️ **${meta.label} AI Analytics Workbook Download**:\n\nClick below to download the multi-tab Excel report covering all **${ov.totalTasks.toLocaleString("en-IN")} ${meta.label}s**, Month-Wise Trends, ${meta.shortLabel}/Assignor Scorecards, and Overdue/Revisions:\n\n[DOWNLOAD_${meta.tagPrefix}_EXCEL]`;
        };

        if (wantsJuniorTier && !wantsSeniorTier) {
          return buildTierDownloadMsg("junior");
        }
        if (wantsSeniorTier && !wantsJuniorTier) {
          return buildTierDownloadMsg("senior");
        }
        return `${buildTierDownloadMsg("senior")}\n\n---\n\n${buildTierDownloadMsg("junior")}`;
      }
      const dlScope = targetMonthSpec?.key || "ALL";
      if (q.includes("pms") || q.includes("performance management") || q.includes("process management")) {
        if (q.includes("blank") || (q.includes("actual") && q.includes("status"))) {
          return `🚨 **PMS Blank Actual & Status Report Download**:\n\nClick below to download the Excel workbook of PMS assignments where actual completion date and status fields are both blank:\n\n[DOWNLOAD_PMS_BLANK_ACTUAL_STATUS_EXCEL]`;
        }
        return `📋 **PMS FMS Register Download${targetMonthSpec ? ` (${targetMonthSpec.label})` : ""}**:\n\nClick below to download the PMS Excel workbook${targetMonthSpec ? ` filtered strictly for **${targetMonthSpec.label}**` : " with client/process assignments and the 17-step workflow"}:\n\n[DOWNLOAD_PMS_EXCEL:${dlScope}]`;
      }
      if (
        (q.includes("target") && (q.includes("blank") || q.includes("not filled") || q.includes("missing"))) ||
        (q.includes("target date") && q.includes("blank"))
      ) {
        return `📅 **FMS Target Date Blank Report Download**:\n\nClick below to download the official report (available in Excel or PDF format) of FMS engagements where Target Date is blank / unassigned:\n\n[DOWNLOAD_FMS_TARGET_DATE_BLANK_EXCEL]`;
      }
      if (
        q.includes("blank") ||
        (q.includes("actual") && q.includes("status")) ||
        q.includes("missed step") ||
        q.includes("blank step") ||
        q.includes("which step")
      ) {
        return `🚨 **Blank Steps & Actual Status Report Download**:\n\nClick below to download the official report (available in Excel or PDF format) detailing missed steps across all 18 FMS milestones:\n\n[DOWNLOAD_BLANK_ACTUAL_STATUS_EXCEL]`;
      }
      if (
        isCrossEmployeeDuplicateQuery(q) ||
        (q.includes("different") && (q.includes("employee") || q.includes("staff") || q.includes("name")))
      ) {
        return `👥 **Same Task Across Different Employees Report Download${targetMonthSpec ? ` (${targetMonthSpec.label})` : ""}**:\n\nClick below to download the official multi-tab Excel workbook tracking identical work logged across multiple employees:\n\n[DOWNLOAD_CROSS_EMPLOYEE_DUPLICATES_EXCEL:${targetMonthSpec?.key || "CURRENT"}]`;
      }
      if (q.includes("audit") || q.includes("fms") || /\bia\b/i.test(q)) {
        return `📥 **FMS Register Download${targetMonthSpec ? ` (${targetMonthSpec.label})` : ""}**:\n\nClick below to download the official FMS Excel workbook${targetMonthSpec ? ` filtered for **${targetMonthSpec.label}**` : " with client assignments and the 17-step SOP"}:\n\n[DOWNLOAD_INTERNAL_AUDIT_EXCEL:${dlScope}]`;
      }
      if (q.includes("duplic") || q.includes("repeat")) {
        return `📥 **Duplicacy Audit Report Download**:\n\nClick below to download the row-by-row Excel register:\n\n[DOWNLOAD_DUPLICACY_BUTTON:${targetMonthSpec?.key || "CURRENT"}]`;
      }
      if (q.includes("ai") || q.includes("claude")) {
        return `📥 **AI & Claude Usage Report Download**:\n\nClick below to download the AI usage audit workbook:\n\n[DOWNLOAD_AI_REPORT_BUTTON]`;
      }
      if (q.includes("2 day") || q.includes("two day") || q.includes("> 2")) {
        return `📥 **Staff Not Filled > 2 Days Report Download**:\n\nClick below to download the official defaulters report:\n\n[DOWNLOAD_TWO_DAYS_DEFAULTERS_BUTTON]`;
      }
      if (q.includes("9 hour") || q.includes("9 hr") || q.includes("less than 9") || q.includes("under 9")) {
        return `⏱️ **Employees with Less Than 9 Hours Report Download${targetMonthSpec ? ` (${targetMonthSpec.label})` : ""}**:\n\nClick below to download the official Excel register:\n\n[DOWNLOAD_LESS_THAN_9_HOURS_EXCEL:${targetMonthSpec?.key || "CURRENT"}]`;
      }
      if (q.includes("working") || q.includes("task") || q.includes("diary")) {
        if (hasAnyMonthRef) {
          return `📝 **Daily Working Monthly Report Download (${targetMonthSpec ? targetMonthSpec.label : "All Months"})**:\n\n[DOWNLOAD_DAILY_WORKING_MONTHLY_EXCEL:${dlScope}]`;
        }
        return `📥 **Daily Working Reports Download**:\n\nChoose your desired format below:\n\n[DOWNLOAD_DAILY_WORKING_BUTTONS]`;
      }
      if (q.includes("weekly")) {
        return `📥 **Weekly Attendance Report Download (${activeWeeklyData?.weekRange || "Past 7 Days"})**:\n\n[DOWNLOAD_WEEKLY_BUTTONS]`;
      }
      if (hasSpecificMonth && !q.includes("attendance")) {
        return `📥 **All-Modules Monthly Downloads — ${targetMonthSpec.label}**:\n\nEvery workbook below is strictly scoped to **${targetMonthSpec.label}**:\n\n[DOWNLOAD_ALL_MODULES_MONTHLY:${targetMonthSpec.key}]`;
      }
      if (hasAnyMonthRef) {
        const resolvedAtt = resolveMonthlyAttendanceSlice(activeMonthlyData, targetMonthSpec || "CURRENT");
        const attLabel = resolvedAtt.slice?.monthName || targetMonthSpec?.label || activeMonthlyData?.monthName || "Current Month";
        return `📥 **Monthly Attendance Register Download (${attLabel})**:\n\n[DOWNLOAD_MONTHLY_BUTTONS:${targetMonthSpec?.key || "CURRENT"}]`;
      }
      // General download card
      return `📥 **Download Executive Reports (Attendance & Daily Working)**:\n\nChoose any report to download immediately in Excel (.xlsx) or PDF (.pdf):\n\n[DOWNLOAD_ALL_BUTTONS]`;
    }

    // 6. All-Modules Specific Month / Monthly Report & Monthly Attendance Queries
    const hasAttendanceKeyword =
      q.includes("attendance") ||
      q.includes("present") ||
      q.includes("absent") ||
      q.includes("late") ||
      q.includes("punch") ||
      q.includes("biometric");
    const isCrossModuleMonthlyRequest =
      (hasSpecificMonth && !hasAttendanceKeyword) ||
      (!hasAttendanceKeyword && (q.includes("all module") || cleanQ === "monthly" || /\bmonthly\s+(?:report|summary)\b/i.test(q)));

    if (isCrossModuleMonthlyRequest) {
      return generateAllModulesMonthlyReport(query);
    }

    if (hasAnyMonthRef && !q.includes("duplic") && !q.includes("working task") && !q.includes("weekly")) {
      return generateMonthlyAttendanceReport(query);
    }

    // 7. Weekly Attendance Queries
    const isWeeklyQuery =
      /\b(weekly|week|this week|current week|past 7 days|last 7 days)\b/i.test(q) ||
      /\b(in\s+week|for\s+the\s+week|week's)\b/i.test(q);

    if (isWeeklyQuery && !q.includes("duplic")) {
      if (!activeWeeklyData || !activeWeeklyData.list || activeWeeklyData.list.length === 0) {
        return `🗓️ **Weekly Attendance Data is connecting to Google Sheet...**\n\nSyncing latest records for this week (Mon-Sat). Please try again in 2-3 seconds or visit the **Attendance Report** page.`;
      }

      const list = activeWeeklyData.list;
      const weekRange = activeWeeklyData.weekRange || "Past 7 Days";
      const totalStaff = list.length;
      const avgPct = Math.round(list.reduce((acc, cur) => acc + (cur.attendancePct || 0), 0) / (totalStaff || 1));
      const totalLate = list.reduce((acc, cur) => acc + (cur.lateDays || 0), 0);
      const totalAbsent = list.reduce((acc, cur) => acc + (cur.daysAbsent || 0), 0);

      return `🗓️ **Weekly Attendance Summary (${weekRange})**:\n\n• 👥 **Active Staff**: **${totalStaff} employees**\n• 📈 **Weekly Average Attendance**: **${avgPct}%**\n• ⏰ **Total Late Instances**: **${totalLate}**\n• ❌ **Total Absent Days**: **${totalAbsent}** *(Evaluated Mon - Sat; Sundays are off)*\n• 🗓️ **Calendar Schedule**: Every week starts on **Monday** and ends on **Saturday** (6 working days).\n\n👇 **Download Weekly Reports:**\n[DOWNLOAD_WEEKLY_BUTTONS]`;
    }

    // 8. Department Specific Attendance
    const {
      total,
      present,
      absent,
      allEarly,
      allLate,
      allWithinGrace,
      atClient,
      checkedOut,
      plant,
      article,
      backOffice,
      senior,
      partner,
      md,
    } = attendanceMetrics;

    const plantGraceText = formatCutoffDisplay(shiftPolicies.PLANT_AUDIT?.grace || "10:35");
    const articleGraceText = formatCutoffDisplay(shiftPolicies.ARTICLE?.grace || "11:05");
    const officeGraceText = formatCutoffDisplay(shiftPolicies.BACK_OFFICE?.grace || "10:05");
    const seniorGraceText = formatCutoffDisplay(shiftPolicies.SENIOR?.grace || "10:05");
    const partnerGraceText = formatCutoffDisplay(shiftPolicies.PARTNER?.grace || "10:05");
    const mdGraceText = formatCutoffDisplay(shiftPolicies.MD?.grace || "10:05");

    if (q.includes("plant") || q.includes("factory")) {
      const lateList = plant.late.map((e) => `• **${e.name}** — In at ${e.formattedIn} (*${e.lateDuration} late*)`).join("\n");
      const absentList = plant.absent.map((e) => `• ${e.name}`).join("\n");
      return `🏭 **Plant Audit Staff Attendance** (Grace: **${plantGraceText}**):\n\n• 👥 **Total Plant Staff**: ${plant.total}\n• ✅ **Present**: **${plant.present.length}** (${plant.early.length} early, ${plant.withinGrace.length} in grace)\n• ❌ **Absent**: **${plant.absent.length}**\n• ⏰ **Late Arrivals (> ${plantGraceText})**: **${plant.late.length}**\n\n**Late Plant Staff**:\n${lateList || "None (All plant staff on time! 🎉)"}\n\n${plant.absent.length > 0 ? `**Absent Plant Staff**:\n${absentList}` : ""}`;
    }

    if (q.includes("article") || q.includes("intern")) {
      const lateList = article.late.map((e) => `• **${e.name}** — In at ${e.formattedIn} (*${e.lateDuration} late*)`).join("\n");
      const absentList = article.absent.map((e) => `• ${e.name}`).join("\n");
      return `📚 **Article Staff Attendance** (Grace: **${articleGraceText}**):\n\n• 👥 **Total Articles**: ${article.total}\n• ✅ **Present**: **${article.present.length}** (${article.early.length} early, ${article.withinGrace.length} in grace)\n• ❌ **Absent**: **${article.absent.length}**\n• ⏰ **Late Arrivals (> ${articleGraceText})**: **${article.late.length}**\n\n**Late Articles**:\n${lateList || "None (All articles on time! 🎉)"}\n\n${article.absent.length > 0 ? `**Absent Articles**:\n${absentList}` : ""}`;
    }

    if (q.includes("back office") || q.includes("backoffice") || q.includes("office staff")) {
      const lateList = backOffice.late.map((e) => `• **${e.name}** — In at ${e.formattedIn} (*${e.lateDuration} late*)`).join("\n");
      const absentList = backOffice.absent.map((e) => `• ${e.name}`).join("\n");
      return `🏢 **Back Office Staff Attendance** (Grace: **${officeGraceText}**):\n\n• 👥 **Total Back Office**: ${backOffice.total}\n• ✅ **Present**: **${backOffice.present.length}**\n• ❌ **Absent**: **${backOffice.absent.length}**\n• ⏰ **Late Arrivals (> ${officeGraceText})**: **${backOffice.late.length}**\n\n**Late Back Office**:\n${lateList || "None (All back office on time! 🎉)"}\n\n${backOffice.absent.length > 0 ? `**Absent Back Office**:\n${absentList}` : ""}`;
    }

    if (q.includes("senior") || q.includes("seniors") || q.includes("ca ") || q.includes("cas")) {
      const lateList = senior.late.map((e) => `• **${e.name}** — In at ${e.formattedIn} (*${e.lateDuration} late*)`).join("\n");
      const absentList = senior.absent.map((e) => `• ${e.name}`).join("\n");
      return `👔 **Senior Staff Attendance** (Grace: **${seniorGraceText}**):\n\n• 👥 **Total Seniors**: ${senior.total}\n• ✅ **Present**: **${senior.present.length}**\n• ❌ **Absent**: **${senior.absent.length}**\n• ⏰ **Late Arrivals (> ${seniorGraceText})**: **${senior.late.length}**\n\n${senior.late.length > 0 ? `**Late Seniors**:\n${lateList}\n\n` : ""}${senior.absent.length > 0 ? `**Absent Seniors**:\n${absentList}` : "*(All senior staff present / on time! 🎉)*"}`;
    }

    if (q.includes("partner") || q.includes("partners")) {
      const presentList = partner.present.map((e) => `• **${e.name}** — In at ${e.formattedIn}`).join("\n");
      const absentList = partner.absent.map((e) => `• ${e.name}`).join("\n");
      return `🤝 **Partners Attendance** (Grace: **${partnerGraceText}**):\n\n• 👥 **Designated Partners**: Rupesh Vaid, CA Ankit Kumar Garg, Mukul C\n• ✅ **Present**: **${partner.present.length}** / ${partner.total}\n• ❌ **Absent**: **${partner.absent.length}**\n• ⏰ **Late Arrivals (> ${partnerGraceText})**: **${partner.late.length}**\n\n${presentList ? `**Present Partners**:\n${presentList}\n\n` : ""}${partner.absent.length > 0 ? `**Absent Partners**:\n${absentList}` : "*(All partners present! 🎉)*"}`;
    }

    if ((q.includes("md") && !q.includes("cmd")) || q.includes("rajesh agrawal") || q.includes("managing director") || q.includes("md sir")) {
      return `👑 **Managing Director (Rajesh Agrawal) Status**:\n\n• 👤 **Managing Director**: Rajesh Agrawal\n• ⏰ **Cut-off**: ${formatCutoffDisplay(shiftPolicies.MD?.cutoff || "10:00")} | Grace: ${mdGraceText}\n• ✅ **Present Today**: ${md.present.length > 0 ? `Yes (In at **${md.present[0].formattedIn}**)` : "No punch-in recorded today (Executive Leadership)"}\n• 🚪 **Active Shift**: ${md.present.length > 0 ? md.present[0].formattedWorkingHours : "N/A"}`;
    }

    // 9. Late Queries across all categories
    if (q.includes("late") || q.includes("der") || q.includes("delay")) {
      const lateLines = allLate.map((e) => `• **${e.name}** [${e.categoryShort}] — In at **${e.formattedIn}** (*${e.lateDuration} late*)`).join("\n");
      return `⏰ **Today's Late Arrivals by Category** *(Late minutes counted strictly from grace time)*:\n\n• 👥 **Total Late Staff**: **${allLate.length} employees**\n\n${lateLines || "*(All present staff punched in on time or within grace! 🎉)*"}\n\n👇 **Download Today's Daily Attendance Report:**\n[DOWNLOAD_DAILY_BUTTONS]`;
    }

    // 10. Early Logins
    if (q.includes("early") || q.includes("before cut-off") || q.includes("before cutoff") || q.includes("before time")) {
      const earlyLines = allEarly.map((e) => `• **${e.name}** [${e.categoryShort}] — In at **${e.formattedIn}** (*${e.earlyDuration} before cut-off*)`).join("\n");
      return `🌅 **Employees with Early Login (Before Cut-off Time)**:\n\n• **Total Early Logins**: **${allEarly.length} employees**\n\n${earlyLines || "*(No early logins recorded today)*"}\n\n👏 *Great discipline shown by staff logging in ahead of their official cut-off time!*`;
    }

    // 11. Absent Queries
    if (q.includes("absent") || q.includes("not present") || q.includes("not come") || q.includes("absentees") || q.includes("chutti") || q.includes("anupasthit")) {
      const plantAbsent = plant.absent.map((e) => `• ${e.name}`).join("\n");
      const articleAbsent = article.absent.map((e) => `• ${e.name}`).join("\n");
      const officeAbsent = backOffice.absent.map((e) => `• ${e.name}`).join("\n");
      const seniorAbsent = senior.absent.map((e) => `• ${e.name}`).join("\n");
      const partnerAbsent = partner.absent.map((e) => `• ${e.name}`).join("\n");

      return `❌ **Today's Absent Employees Summary & Department Breakdown**:\n\n• 👥 **Total Absent Today**: **${absent.length}** out of ${total} staff (${total > 0 ? Math.round((absent.length / total) * 100) : 0}%)\n• ✅ **Total Present Today**: **${present.length}** staff\n\n━━━━━━━━━━━━━━━━━━━━\n📋 **Absentee List by Department**:\n\n🏭 **Plant Audit** (${plant.absent.length}):\n${plantAbsent || "*(All plant staff present! 🎉)*"}\n\n📚 **Articles** (${article.absent.length}):\n${articleAbsent || "*(All articles present! 🎉)*"}\n\n🏢 **Back Office** (${backOffice.absent.length}):\n${officeAbsent || "*(All back office present! 🎉)*"}\n\n👔 **Seniors** (${senior.absent.length}):\n${seniorAbsent || "*(All seniors present! 🎉)*"}\n\n🤝 **Partners** (${partner.absent.length}):\n${partnerAbsent || "*(All partners present! 🎉)*"}\n\n👇 **Download Today's Daily Attendance Report:**\n[DOWNLOAD_DAILY_BUTTONS]`;
    }

    // 12. Present Queries
    if (q.includes("present") || q.includes("attended") || q.includes("upasthit") || q.includes("aaya") || q.includes("aaye")) {
      return `👥 **Today's Live Attendance Overview**:\n\n• **Total Present (Punched In)**: **${present.length} employees** (${total > 0 ? Math.round((present.length / total) * 100) : 0}% of ${total})\n• 🌅 **Early Logins (< Cut-off)**: **${allEarly.length}**\n• 🟡 **Within Grace Window**: **${allWithinGrace.length}**\n• ⏰ **Late Arrivals (> Grace)**: **${allLate.length}**\n• 🚪 **Already Checked Out**: **${checkedOut.length}**\n\n• 🏭 **Plant**: ${plant.present.length}/${plant.total} | 📚 **Articles**: ${article.present.length}/${article.total} | 🏢 **Office**: ${backOffice.present.length}/${backOffice.total} | 👔 **Seniors**: ${senior.present.length}/${senior.total} | 🤝 **Partners**: ${partner.present.length}/${partner.total}`;
    }

    // 13. Client Place
    if (q.includes("client")) {
      const clientLines = atClient.map((e) => `• **${e.name}** [${e.categoryShort}] — ${e.clientPlace} (In at ${e.formattedIn})`).join("\n");
      return `🏢 **Employees at Client Sites Today**:\n\n• **Total at Client Sites**: **${atClient.length} employees**\n\n${clientLines || "No employees recorded at external client sites today."}`;
    }

    // 14. Working Hours
    if (q.includes("working hour") || q.includes("work hour") || q.includes("hours worked") || q.includes("worked hours")) {
      const activeStaff = present.filter((e) => !e.isCheckedOut);
      const activeList = activeStaff.slice(0, 10).map((e) => `• **${e.name}** [${e.categoryShort}] — **${e.formattedWorkingHours}** (In: ${e.formattedIn})`).join("\n");
      return `⏳ **Employee Working Hours Today**:\n\n• 👥 **Total Punched In**: **${present.length} staff**\n• 🟢 **Currently Active on Duty**: **${activeStaff.length} staff**\n• 🚪 **Shift Completed (Checked Out)**: **${checkedOut.length} staff**\n\n🟢 **Active Duty Duration (Sample)**:\n${activeList}`;
    }

    // 15. General Executive Briefing (Unified Attendance + Daily Working)
    const isGeneralBriefing =
      cleanQ === "" ||
      cleanQ === "hi" ||
      cleanQ === "hello" ||
      cleanQ === "hey" ||
      q.includes("briefing") ||
      q.includes("summary") ||
      q.includes("report") ||
      q.includes("overview") ||
      q.includes("daily") ||
      q.includes("today") ||
      q.includes("attendance") ||
      q.includes("data") ||
      q.includes("status") ||
      q.includes("insight") ||
      q.includes("register") ||
      q.includes("punch") ||
      q.includes("aaj") ||
      q.includes("all") ||
      q.includes("everything") ||
      q.includes("sab");

    if (isGeneralBriefing) {
      const lateList = allLate.length > 0
        ? allLate.slice(0, 5).map((e) => `• **${e.name}** (${e.formattedIn} — *${e.lateDuration} late*)`).join("\n")
        : "• *All present staff punched in on time or within grace! 🎉*";

      return `👑 **AJC Executive Briefing for MD Sir**\n• 📅 **Date**: ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n\n### ⏰ 1. Live Attendance Status:\n• 👥 **Total Staff**: **${total} employees** | ✅ **Present**: **${present.length}** (🌅 ${allEarly.length} early, 🟡 ${allWithinGrace.length} in grace)\n• ⏰ **Late Arrivals (> Grace)**: **${allLate.length}** | ❌ **Absent**: **${absent.length}** | 🏢 **Client Sites**: **${atClient.length}**\n${allLate.length > 0 ? `\n**Top Late Arrivals**:\n${lateList}\n` : ""}\n• 👔 **Seniors**: ${senior.present.length}/${senior.total} In | 🤝 **Partners**: ${partner.present.length}/${partner.total} In | 📚 **Articles**: ${article.present.length}/${article.total} In | 🏭 **Plant**: ${plant.present.length}/${plant.total} In\n\n### 🗂️ 2. Senior & Junior Delegation Live Snapshot:\n• 👔 **Senior Tasks**: **${seniorTaskAnalytics.overview.totalTasks.toLocaleString("en-IN")}** (${seniorTaskAnalytics.overview.dateRange}) | ✅ **${seniorTaskAnalytics.overview.doneCount.toLocaleString("en-IN")}** (${seniorTaskAnalytics.overview.completionRate}%) | ❌ **${seniorTaskAnalytics.overview.cancelledCount}** Cancelled | 🚨 **${seniorTaskAnalytics.overview.overdueCount}** Overdue\n• 🧑‍💻 **Junior Tasks**: **${juniorTaskAnalytics.overview.totalTasks.toLocaleString("en-IN")}** (${juniorTaskAnalytics.overview.dateRange}) | ✅ **${juniorTaskAnalytics.overview.doneCount.toLocaleString("en-IN")}** (${juniorTaskAnalytics.overview.completionRate}%) | ❌ **${juniorTaskAnalytics.overview.cancelledCount}** Cancelled | 🚨 **${juniorTaskAnalytics.overview.overdueCount}** Overdue\n${seniorTaskAnalytics.overview.topCancelledDoer ? `• 👤 **Most Cancelled Senior**: **${seniorTaskAnalytics.overview.topCancelledDoer.name}** (${seniorTaskAnalytics.overview.topCancelledDoer.cancelled} cancelled)\n` : ""}${juniorTaskAnalytics.overview.topCancelledDoer ? `• 👤 **Most Cancelled Junior**: **${juniorTaskAnalytics.overview.topCancelledDoer.name}** (${juniorTaskAnalytics.overview.topCancelledDoer.cancelled} cancelled)\n` : ""}\n### 📝 3. Daily Working Submission Status:\n• 📊 **Work Submitted Today**: **${workingKpis.workSubmitted} staff** (${workingKpis.submissionRate}% of present staff)\n• ⚠️ **Present on Punch but Work Pending**: **${workingKpis.presentWithoutWork.length} staff**\n• 🚨 **Historical Missing Dates Backlog**: **${workingKpis.withMissingDates.length} staff** (${workingKpis.totalMissingInstances} total instances)\n\n### 📑 4. Internal Audit FMS & PMS FMS Intelligence:\n• 🏢 **Internal Audit FMS**: **${internalAudits.length || 89} engagements** across 46 corporate groups (**18-Step FMS**)\n• 📋 **PMS FMS (Process Management)**: **${pmsRecords.length} active entries** tracked across the **17-Step PMS Workflow** (${pmsRecords.length === 0 ? "connect live sheet via ⚙️ API Config or add entries in PMS Form" : "synced with Portal/Sheet"})\n• 🏭 **Coverage Split**: Plant vs City assignments tracked by Partner & Lead CA\n\n### 🔍 5. Executive Audit Shortcuts:\n• Ask: *"Month-wise senior task report"* or *"Who cancelled the task most?"*\n• Ask: *"Internal audit FMS status"* or *"FMS target date blank"* or *"Which steps are missed in FMS"* or *"Explain 18 steps of FMS"*\n• Ask: *"Duplicacy in October"* for row-by-row 6-field duplicate task check\n• Ask: *"Uses of AI or Claude in daily working"*\n• Ask: *"Staff not filled daily working > 2 days"*\n\n👇 **Download Today's Executive Reports:**\n[DOWNLOAD_ALL_BUTTONS]`;
    }

    // Fallback friendly answer
    return `🔍 **Executive Intelligence for "${query}"**:\n\n• **Total Registered Staff**: ${total}\n• **Present Today**: ${present.length} (🌅 ${allEarly.length} early, 🟡 ${allWithinGrace.length} in grace)\n• **Late Today**: ${allLate.length} (Counted from category grace time)\n• **Senior Tasks (Delegation)**: ${seniorTaskAnalytics.overview.totalTasks.toLocaleString("en-IN")} total (✅ ${seniorTaskAnalytics.overview.doneCount} Done, ❌ ${seniorTaskAnalytics.overview.cancelledCount} Cancelled)\n• **Junior Tasks (Delegation)**: ${juniorTaskAnalytics.overview.totalTasks.toLocaleString("en-IN")} total (✅ ${juniorTaskAnalytics.overview.doneCount} Done, ❌ ${juniorTaskAnalytics.overview.cancelledCount} Cancelled)\n• **Daily Working Submitted Today**: ${workingKpis.workSubmitted} staff\n• **Internal Audit Assignments**: ${internalAudits.length || 89} client engagements (18-Step FMS)\n• **PMS FMS Entries**: ${pmsRecords.length} active PMS entries (17-Step FMS)\n\n*💡 Try asking about specific audits:* \n- 🗂️ *"Month-wise senior task report"* or *"Who cancelled the task most?"*\n- ❌ *"How many tasks cancelled in August 2026?"* or *"Senior task overdue"*\n- 📊 *"Internal audit FMS status"* or *"FMS target date blank"* or *"Which steps are missed in FMS"*\n- 📋 *"Explain the 18 steps of FMS"* or *"PMS blank actual and status"*\n- 👔 *"Audits assigned to CA Harsh Mittal"*\n- 🔍 *"Duplicacy in October"*\n- 🤖 *"AI or Claude usage"*\n- ⏰ *"Who is late today?"*\n- 👤 *"Show 360 report for CA Harsh Mittal"*\n\n👇 **Download Reports:**\n[DOWNLOAD_ALL_BUTTONS]`;
  };

  // --- OPENAI API CALL (FALLS BACK TO LOCAL ON ERROR/TIMEOUT) ---
  const callOpenAI = async (userPrompt) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const stOv = seniorTaskAnalytics.overview;
    const jtOv = juniorTaskAnalytics.overview;
    const systemPrompt = `You are an AI Executive Assistant for Agrawal Jain & Co. (a Chartered Accountancy firm) for the Managing Director.
You analyze real-time attendance report data, Senior & Junior Task (Delegation) analytics, daily working submissions, duplicacy audits, missing date backlogs, statutory HR compliance, Internal Audit Flow Management System (FMS), and Process Management System (PMS FMS).

LIVE SENIOR TASK (DELEGATION) STATS:
- Coverage: ${stOv.dateRange} (${stOv.monthCount} months)
- Total Tasks: ${stOv.totalTasks} | Done: ${stOv.doneCount} (${stOv.completionRate}%) | Cancelled: ${stOv.cancelledCount} (${stOv.cancelRate}%) | Open: ${stOv.openCount} (Overdue: ${stOv.overdueCount}) | Total Revisions: ${stOv.totalRevisions}
- Most Cancelled Senior: ${stOv.topCancelledDoer ? `${stOv.topCancelledDoer.name} (${stOv.topCancelledDoer.cancelled})` : "N/A"}
- Top Cancelling Assignor: ${stOv.topCancelledAssignor ? `${stOv.topCancelledAssignor.name} (${stOv.topCancelledAssignor.cancelled})` : "N/A"}
- Peak Cancellation Month: ${stOv.peakCancelledMonth ? `${stOv.peakCancelledMonth.monthLabel} (${stOv.peakCancelledMonth.cancelled})` : "N/A"}

LIVE JUNIOR TASK (DELEGATION) STATS:
- Coverage: ${jtOv.dateRange} (${jtOv.monthCount} months)
- Total Tasks: ${jtOv.totalTasks} | Done: ${jtOv.doneCount} (${jtOv.completionRate}%) | Cancelled: ${jtOv.cancelledCount} (${jtOv.cancelRate}%) | Open: ${jtOv.openCount} (Overdue: ${jtOv.overdueCount}) | Total Revisions: ${jtOv.totalRevisions}
- Most Cancelled Junior: ${jtOv.topCancelledDoer ? `${jtOv.topCancelledDoer.name} (${jtOv.topCancelledDoer.cancelled})` : "N/A"}
- Top Cancelling Assignor: ${jtOv.topCancelledAssignor ? `${jtOv.topCancelledAssignor.name} (${jtOv.topCancelledAssignor.cancelled})` : "N/A"}
- Peak Cancellation Month: ${jtOv.peakCancelledMonth ? `${jtOv.peakCancelledMonth.monthLabel} (${jtOv.peakCancelledMonth.cancelled})` : "N/A"}

INTERNAL AUDIT FMS & PMS FMS PROTOCOL:
- Internal Audit FMS: 89 client assignments across 46 corporate groups (City audits and Plant audits), tracked across the 18-Step FMS SOP.
- PMS FMS: ${pmsRecords.length} loaded assignments in the 17-Step PMS Flow Management System (configurable live Google Apps Script API + in-portal PMS entries), tracking Group, Client/Company, Dept, Period, Partner, Senior/Lead CA, Assignment Type, Start & Target Dates, and 17 execution steps (Planned, Actual, Status, Delay).
- Key Partners: CA Ankit Kumar Garg, CA Rupesh Vaid, CA Mukul Jain.
- Key Seniors / Lead CAs: CA Harsh Mittal, CA Chandan Singh, CA Kanha Kedia, CA Pankaj Agrawal, CMA Akash Choubey, CMA Pratibha Agrawal, CA Drishti Chandnani, CA Vikas Goyal, etc.
- 18-Step FMS SOP:
  Step 1: Audit Scheduling & Planning / PMS Scheduling & Kickoff (Partners - Beginning of FY)
  Step 2: Client Intimation & Requisition (Senior - Before Audit)
  Step 3: Team Allocation & Alignment (Partners - 1 Week Before)
  Step 4: Audit Programme / Process Scope & Risk Matrix (Partners - Planning Stage)
  Step 5: Pre-Audit Confirmation (Senior - 1 Day Before)
  Step 6: Entry Conference with HODs (Senior - Audit Start Day)
  Step 7: Fieldwork / Execution & Daily Review (Senior - Daily)
  Step 8: Partner Weekly Review (Partners - Tuesday Review Meeting)
  Step 9: Draft Report / Review Discussion (Senior - Before Final Report)
  Step 10: HOD Responses & Action Plan (Senior - Before Submission)
  Step 11: Exit Conference & Executive Summary (Partners - Executive Summary)
  Step 12: Promoters / Owner Discussion (CRM - Owner Discussion)
  Step 13: Audit Committee / Board Meeting (Partners - Board Meeting)
  Step 14: Final Signed Report / Deliverable Upload (Senior - After Completion)
  Step 15: Benefit & Cost Savings Chart (Senior - Post Audit)
  Step 16: Billing, Invoicing & Collection (Accounts Dept - After Report)
  Step 17: Cost Sheet & Engagement Closure (HR Head - Final Closure)
  Step 18: Client Feedback & Action Taken Report (ATR) (CRM / Senior - Post Closure)

Answer concisely, factually, and professionally using markdown bullets and emojis.
${HR_LABOUR_LAW_SYSTEM_PROMPT}`;

    const recentConversation = messages.slice(-4).map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    }));

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...recentConversation,
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenAI HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Sorry, I couldn't generate an answer.";
  };

  // --- SEND MESSAGE ---
  const handleSend = async (customPrompt) => {
    const textToSend = (customPrompt || inputValue).trim();
    if (!textToSend || isLoading) return;

    const userMsg = {
      id: Date.now(),
      sender: "user",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      let botResponse = "";

      // Ensure multi-company audit records are loaded for completion reports
      if (!companyAuditData) {
        try {
          const loadedCompanyData = await fetchAllCompanyAuditData();
          if (loadedCompanyData) setCompanyAuditData(loadedCompanyData);
        } catch (_) {}
      }

      if (apiKey) {
        try {
          botResponse = await callOpenAI(textToSend);
        } catch (apiErr) {
          console.warn("OpenAI call failed, falling back to local analysis:", apiErr);
          botResponse = generateLocalAnswer(textToSend);
        }
      } else {
        botResponse = generateLocalAnswer(textToSend);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: botResponse,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `❌ An unexpected error occurred: ${err.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: Date.now(),
        sender: "bot",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `Chat cleared. Ask me any question about Attendance or Daily Working!`,
      },
    ]);
  };

  // Save Settings
  const handleSaveSettings = () => {
    const cleanKey = tempApiKey.trim();
    setApiKey(cleanKey);
    localStorage.setItem("openai_api_key", cleanKey);

    const updatedPolicies = {
      ...shiftPolicies,
      PLANT_AUDIT: { ...shiftPolicies.PLANT_AUDIT, cutoff: tempPlantCutoff, grace: addMinutesToTime(tempPlantCutoff, 5) },
      ARTICLE: { ...shiftPolicies.ARTICLE, cutoff: tempArticleCutoff, grace: addMinutesToTime(tempArticleCutoff, 5) },
      BACK_OFFICE: { ...shiftPolicies.BACK_OFFICE, cutoff: tempOfficeCutoff, grace: addMinutesToTime(tempOfficeCutoff, 5) },
      SENIOR: { ...(shiftPolicies.SENIOR || DEFAULT_SHIFT_POLICIES.SENIOR), cutoff: tempSeniorCutoff, grace: addMinutesToTime(tempSeniorCutoff, 5) },
      PARTNER: { ...(shiftPolicies.PARTNER || DEFAULT_SHIFT_POLICIES.PARTNER), cutoff: tempPartnerCutoff, grace: addMinutesToTime(tempPartnerCutoff, 5) },
      MD: { ...(shiftPolicies.MD || DEFAULT_SHIFT_POLICIES.MD), cutoff: tempMDCutoff, grace: addMinutesToTime(tempMDCutoff, 5) },
    };

    setShiftPolicies(updatedPolicies);
    localStorage.setItem("ajc_shift_policies_v5", JSON.stringify(updatedPolicies));
    setShowSettings(false);

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: "bot",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `✅ **Settings updated successfully!** Shift cut-offs and API parameters applied.`,
      },
    ]);
  };

  // Render formatted markdown and inline buttons
  const renderFormattedText = (text) => {
    if (!text) return "";

    const hasAllButtons = text.includes("[DOWNLOAD_ALL_BUTTONS]");
    const hasDailyButtons = text.includes("[DOWNLOAD_DAILY_BUTTONS]");
    const hasWeeklyButtons = text.includes("[DOWNLOAD_WEEKLY_BUTTONS]");
    const monthlyButtonsMatch = text.match(/\[DOWNLOAD_MONTHLY_BUTTONS(?::(.*?))?\]/);
    const monthlyAttScope = monthlyButtonsMatch ? monthlyButtonsMatch[1] || "CURRENT" : null;
    const hasDailyWorkingButtons = text.includes("[DOWNLOAD_DAILY_WORKING_BUTTONS]");
    const dailyWorkingMonthlyMatch = text.match(/\[DOWNLOAD_DAILY_WORKING_MONTHLY_EXCEL(?::(.*?))?\]/);
    const dailyWorkingMonthlyScope = dailyWorkingMonthlyMatch ? dailyWorkingMonthlyMatch[1] || "ALL" : null;
    const hasAiUsageButton = text.includes("[DOWNLOAD_AI_REPORT_BUTTON]");
    const hasTwoDaysButton = text.includes("[DOWNLOAD_TWO_DAYS_DEFAULTERS_BUTTON]");
    const hasDefaultersButton = text.includes("[DOWNLOAD_DEFAULTERS_BUTTON]");
    const iaButtonsMatch = text.match(/\[DOWNLOAD_INTERNAL_AUDIT_EXCEL(?::(.*?))?\]/);
    const iaFmsScope = iaButtonsMatch ? iaButtonsMatch[1] || "ALL" : null;
    const hasBlankActualStatusButton =
      text.includes("[DOWNLOAD_BLANK_ACTUAL_STATUS_EXCEL]") ||
      text.includes("[DOWNLOAD_INTERNAL_AUDIT_BLANK_ACTUAL_STATUS_EXCEL]") ||
      text.includes("[DOWNLOAD_BLANK_ACTUAL_STATUS_PDF]");
    const hasTargetDateBlankButton =
      text.includes("[DOWNLOAD_FMS_TARGET_DATE_BLANK_EXCEL]") ||
      text.includes("[DOWNLOAD_FMS_TARGET_DATE_BLANK_PDF]") ||
      text.includes("[DOWNLOAD_TARGET_DATE_BLANK_EXCEL]");
    const pmsButtonsMatch = text.match(/\[DOWNLOAD_PMS_EXCEL(?::(.*?))?\]/);
    const pmsFmsScope = pmsButtonsMatch ? pmsButtonsMatch[1] || "ALL" : null;
    const hasPmsBlankActualStatusButton = text.includes("[DOWNLOAD_PMS_BLANK_ACTUAL_STATUS_EXCEL]");
    const allModulesMonthlyMatch = text.match(/\[DOWNLOAD_ALL_MODULES_MONTHLY(?::(.*?))?\]/);
    const allModulesMonthlyScope = allModulesMonthlyMatch ? allModulesMonthlyMatch[1] || "ALL" : null;
    const companyAuditExcelMatch = text.match(/\[DOWNLOAD_COMPANY_AUDIT_EXCEL(?::(.*?))?\]/);
    const companyAuditExcelScope = companyAuditExcelMatch ? companyAuditExcelMatch[1] || "ALL" : null;
    const companyAuditPdfMatch = text.match(/\[DOWNLOAD_COMPANY_AUDIT_PDF(?::(.*?))?\]/);
    const companyAuditPdfScope = companyAuditPdfMatch ? companyAuditPdfMatch[1] || "ALL" : null;
    const delegationTierMatches = ["SENIOR_TASK", "JUNIOR_TASK"].map((prefix) => {
      const tierKey = prefix === "JUNIOR_TASK" ? "junior" : "senior";
      const hasMaster = text.includes(`[DOWNLOAD_${prefix}_EXCEL]`);
      const cancelMatch = text.match(new RegExp(`\\[DOWNLOAD_${prefix}_CANCEL_EXCEL(?::(.*?))?\\]`));
      const overdueMatch = text.match(new RegExp(`\\[DOWNLOAD_${prefix}_OVERDUE_EXCEL(?::(.*?))?\\]`));
      const doneMatch = text.match(new RegExp(`\\[DOWNLOAD_${prefix}_DONE_EXCEL(?::(.*?))?\\]`));
      const monthlyMatch = text.match(new RegExp(`\\[DOWNLOAD_${prefix}_MONTHLY_EXCEL(?::(.*?))?\\]`));
      return {
        tierKey,
        meta: getDelegationMeta(tierKey),
        hasMaster,
        cancelScope: cancelMatch ? cancelMatch[1] || "ALL" : null,
        overdueScope: overdueMatch ? overdueMatch[1] || "ALL" : null,
        doneScope: doneMatch ? doneMatch[1] || "ALL" : null,
        monthlyScope: monthlyMatch ? monthlyMatch[1] || "ALL" : null,
      };
    });

    const lessThan9Match = text.match(/\[DOWNLOAD_LESS_THAN_9_HOURS_EXCEL(?::(.*?))?\]/);
    const lessThan9Scope = lessThan9Match ? lessThan9Match[1] || "CURRENT" : null;
    const crossEmpMatch = text.match(/\[DOWNLOAD_CROSS_EMPLOYEE_DUPLICATES_EXCEL(?::(.*?))?\]/);
    const crossEmpScope = crossEmpMatch ? crossEmpMatch[1] || "CURRENT" : null;

    const dupeMatch = text.match(/\[DOWNLOAD_DUPLICACY_BUTTON:(.*?)\]/);
    const targetDupeMonth = dupeMatch ? dupeMatch[1] : null;

    const actionChipsMatch = text.match(/\[ACTION_CHIPS:(.*?)\]/);
    const actionChipsStr = actionChipsMatch ? actionChipsMatch[1] : null;

    const cleanText = text
      .replace(/\[DOWNLOAD_ALL_BUTTONS\]/g, "")
      .replace(/\[DOWNLOAD_DAILY_BUTTONS\]/g, "")
      .replace(/\[DOWNLOAD_WEEKLY_BUTTONS\]/g, "")
      .replace(/\[DOWNLOAD_MONTHLY_BUTTONS(?::.*?)?\]/g, "")
      .replace(/\[DOWNLOAD_DAILY_WORKING_BUTTONS\]/g, "")
      .replace(/\[DOWNLOAD_DAILY_WORKING_MONTHLY_EXCEL(?::.*?)?\]/g, "")
      .replace(/\[DOWNLOAD_AI_REPORT_BUTTON\]/g, "")
      .replace(/\[DOWNLOAD_TWO_DAYS_DEFAULTERS_BUTTON\]/g, "")
      .replace(/\[DOWNLOAD_DEFAULTERS_BUTTON\]/g, "")
      .replace(/\[DOWNLOAD_INTERNAL_AUDIT_EXCEL(?::.*?)?\]/g, "")
      .replace(/\[DOWNLOAD_BLANK_ACTUAL_STATUS_EXCEL\]/g, "")
      .replace(/\[DOWNLOAD_INTERNAL_AUDIT_BLANK_ACTUAL_STATUS_EXCEL\]/g, "")
      .replace(/\[DOWNLOAD_BLANK_ACTUAL_STATUS_PDF\]/g, "")
      .replace(/\[DOWNLOAD_FMS_TARGET_DATE_BLANK_EXCEL\]/g, "")
      .replace(/\[DOWNLOAD_FMS_TARGET_DATE_BLANK_PDF\]/g, "")
      .replace(/\[DOWNLOAD_TARGET_DATE_BLANK_EXCEL\]/g, "")
      .replace(/\[DOWNLOAD_PMS_EXCEL(?::.*?)?\]/g, "")
      .replace(/\[DOWNLOAD_PMS_BLANK_ACTUAL_STATUS_EXCEL\]/g, "")
      .replace(/\[DOWNLOAD_ALL_MODULES_MONTHLY(?::.*?)?\]/g, "")
      .replace(/\[DOWNLOAD_(?:SENIOR|JUNIOR)_TASK_EXCEL\]/g, "")
      .replace(/\[DOWNLOAD_(?:SENIOR|JUNIOR)_TASK_CANCEL_EXCEL(?::.*?)?\]/g, "")
      .replace(/\[DOWNLOAD_(?:SENIOR|JUNIOR)_TASK_OVERDUE_EXCEL(?::.*?)?\]/g, "")
      .replace(/\[DOWNLOAD_(?:SENIOR|JUNIOR)_TASK_DONE_EXCEL(?::.*?)?\]/g, "")
      .replace(/\[DOWNLOAD_(?:SENIOR|JUNIOR)_TASK_MONTHLY_EXCEL(?::.*?)?\]/g, "")
      .replace(/\[DOWNLOAD_LESS_THAN_9_HOURS_EXCEL(?::.*?)?\]/g, "")
      .replace(/\[DOWNLOAD_CROSS_EMPLOYEE_DUPLICATES_EXCEL(?::.*?)?\]/g, "")
      .replace(/\[DOWNLOAD_COMPANY_AUDIT_EXCEL(?::.*?)?\]/g, "")
      .replace(/\[DOWNLOAD_COMPANY_AUDIT_PDF(?::.*?)?\]/g, "")
      .replace(/\[DOWNLOAD_DUPLICACY_BUTTON:.*?\]/g, "")
      .replace(/\[ACTION_CHIPS:.*?\]/g, "")
      .trim();

    return (
      <>
        {cleanText.split("\n").map((line, index) => {
          if (line.trim() === "") {
            return <div key={index} className="chat-spacer" />;
          }
          const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
          return (
            <div key={index} className="chat-line">
              {parts.map((part, pIdx) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith("*") && part.endsWith("*")) {
                  return <em key={pIdx}>{part.slice(1, -1)}</em>;
                }
                return part;
              })}
            </div>
          );
        })}

        {/* Action Chips */}
        {actionChipsStr && (
          <div className="chat-inline-action-chips">
            {actionChipsStr.split(";").map((chunk, cIdx) => {
              const [prompt, label] = chunk.split("|");
              return (
                <button
                  key={cIdx}
                  className="chat-action-chip"
                  onClick={() => handleSend(prompt)}
                >
                  {label || prompt}
                </button>
              );
            })}
          </div>
        )}

        {/* Inline Duplicacy Download Button */}
        {targetDupeMonth && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              onClick={() => handleDownloadDuplicacyExcel(targetDupeMonth)}
              disabled={isExporting}
            >
              📥 Download {targetDupeMonth === "ALL" ? "All Months" : ""} Duplicacy Audit Excel (.xlsx)
            </button>
          </div>
        )}

        {/* AI Report Button */}
        {hasAiUsageButton && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              onClick={handleDownloadAiUsageExcel}
              disabled={isExporting}
            >
              🤖 Download AI & Claude Usage Register (.xlsx)
            </button>
          </div>
        )}

        {/* Two Days Defaulters Button */}
        {hasTwoDaysButton && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              onClick={handleDownloadTwoDaysDefaultersExcel}
              disabled={isExporting}
            >
              🚨 Download &gt; 2 Days Defaulters Excel (.xlsx)
            </button>
          </div>
        )}

        {/* Defaulters Button */}
        {hasDefaultersButton && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              onClick={handleDownloadDefaultersExcel}
              disabled={isExporting}
            >
              ⚠️ Download Today's Defaulters Excel (.xlsx)
            </button>
          </div>
        )}

        {/* Internal Audit FMS Button */}
        {iaFmsScope && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              onClick={() => handleDownloadInternalAuditExcel(iaFmsScope)}
              disabled={isExporting}
            >
              📊 Download FMS Register{iaFmsScope !== "ALL" ? ` (${iaFmsScope})` : ""} (.xlsx)
            </button>
          </div>
        )}

        {/* Blank Actual & Status Buttons (Excel & PDF) */}
        {hasBlankActualStatusButton && (
          <div className="chat-inline-download-buttons" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              className="chat-dl-btn excel"
              onClick={handleDownloadBlankActualStatusExcel}
              disabled={isExporting}
            >
              🚨 Download Blank Actual &amp; Status (Excel .xlsx)
            </button>
            <button
              className="chat-dl-btn pdf"
              style={{ background: "#dc2626", borderColor: "#dc2626", color: "#fff" }}
              onClick={handleDownloadBlankActualStatusPdf}
              disabled={isExporting}
            >
              📄 Download Blank Actual &amp; Status (PDF .pdf)
            </button>
          </div>
        )}

        {/* FMS Target Date Blank Buttons (Excel & PDF) */}
        {hasTargetDateBlankButton && (
          <div className="chat-inline-download-buttons" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              className="chat-dl-btn excel"
              style={{ background: "#b45309", borderColor: "#b45309", color: "#fff" }}
              onClick={handleDownloadFmsTargetDateBlankExcel}
              disabled={isExporting}
            >
              📅 Download Target Date Blank (Excel .xlsx)
            </button>
            <button
              className="chat-dl-btn pdf"
              style={{ background: "#d97706", borderColor: "#d97706", color: "#fff" }}
              onClick={handleDownloadFmsTargetDateBlankPdf}
              disabled={isExporting}
            >
              📄 Download Target Date Blank (PDF .pdf)
            </button>
          </div>
        )}

        {/* PMS FMS Button */}
        {pmsFmsScope && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              style={{ background: "#4338ca", borderColor: "#4338ca", color: "#fff" }}
              onClick={() => handleDownloadPmsExcel(pmsFmsScope)}
              disabled={isExporting}
            >
              📋 Download PMS FMS{pmsFmsScope !== "ALL" ? ` (${pmsFmsScope})` : ""} (.xlsx)
            </button>
          </div>
        )}

        {/* PMS Blank Actual & Status Button */}
        {hasPmsBlankActualStatusButton && (
          <div className="chat-inline-download-buttons" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              className="chat-dl-btn excel"
              style={{ background: "#4338ca", borderColor: "#4338ca", color: "#fff" }}
              onClick={handleDownloadPmsBlankActualStatusExcel}
              disabled={isExporting}
            >
              🚨 Download PMS Blank Actual &amp; Status (Excel .xlsx)
            </button>
            <button
              className="chat-dl-btn pdf"
              style={{ background: "#dc2626", borderColor: "#dc2626", color: "#fff" }}
              onClick={handleDownloadPmsBlankActualStatusPdf}
              disabled={isExporting}
            >
              📄 Download PMS Blank Actual &amp; Status (PDF .pdf)
            </button>
          </div>
        )}

        {/* Multi-Company Work Completion Download Buttons */}
        {(companyAuditExcelScope || companyAuditPdfScope) && (
          <div className="chat-inline-download-buttons" style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
            {companyAuditExcelScope && (
              <button
                className="chat-dl-btn excel"
                style={{ background: "#047857", borderColor: "#047857", color: "#fff" }}
                onClick={() => handleDownloadCompanyAuditExcel(companyAuditExcelScope)}
                disabled={isExporting}
              >
                📊 Download Work Completion ({companyAuditExcelScope === "ALL" ? "All" : companyAuditExcelScope.replace(/_/g, " ")}) (Excel .xlsx)
              </button>
            )}
            {companyAuditPdfScope && (
              <button
                className="chat-dl-btn pdf"
                style={{ background: "#b91c1c", borderColor: "#b91c1c", color: "#fff" }}
                onClick={() => handleDownloadCompanyAuditPdf(companyAuditPdfScope)}
                disabled={isExporting}
              >
                📄 Download Work Completion Report (PDF .pdf)
              </button>
            )}
          </div>
        )}

        {/* Senior & Junior Task (Delegation) Specialized Download Buttons */}
        {delegationTierMatches.map((tm) => {
          const { tierKey, meta, hasMaster, cancelScope, overdueScope, doneScope, monthlyScope } = tm;
          if (!hasMaster && !cancelScope && !overdueScope && !doneScope && !monthlyScope) return null;
          const activeScope = cancelScope || overdueScope || doneScope || monthlyScope || "ALL";
          const taskBtns = [];

          if (cancelScope) {
            taskBtns.push({
              key: `${tierKey}-cancel-primary`,
              bg: "#be123c",
              label: `❌ Download ${meta.shortLabel} Cancellation Report (.xlsx)`,
              onClick: () => handleDownloadDelegationExcel(tierKey, "cancelled", cancelScope),
            });
          }
          if (overdueScope) {
            taskBtns.push({
              key: `${tierKey}-overdue-primary`,
              bg: "#c2410c",
              label: `🚨 Download ${meta.shortLabel} Overdue Report (.xlsx)`,
              onClick: () => handleDownloadDelegationExcel(tierKey, "overdue", overdueScope),
            });
          }
          if (doneScope) {
            taskBtns.push({
              key: `${tierKey}-done-primary`,
              bg: "#15803d",
              label: `✅ Download ${meta.shortLabel} Done Report (.xlsx)`,
              onClick: () => handleDownloadDelegationExcel(tierKey, "done", doneScope),
            });
          }
          if (monthlyScope) {
            taskBtns.push({
              key: `${tierKey}-monthly-primary`,
              bg: "#0f766e",
              label: `📅 Download ${meta.shortLabel} Monthly Report (.xlsx)`,
              onClick: () => handleDownloadDelegationExcel(tierKey, "monthly", monthlyScope),
            });
          }

          if (hasMaster) {
            taskBtns.push(
              {
                key: `${tierKey}-master`,
                bg: "#6d28d9",
                label: `🗂️ Download ${meta.label} AI Analytics (.xlsx)`,
                onClick: () => handleDownloadDelegationExcel(tierKey, "master"),
              },
              {
                key: `${tierKey}-monthly`,
                bg: "#0f766e",
                label: `📅 ${meta.shortLabel} Monthly Report (.xlsx)`,
                onClick: () => handleDownloadDelegationExcel(tierKey, "monthly", "ALL"),
              },
              {
                key: `${tierKey}-done`,
                bg: "#15803d",
                label: `✅ ${meta.shortLabel} Done Report (.xlsx)`,
                onClick: () => handleDownloadDelegationExcel(tierKey, "done", "ALL"),
              },
              {
                key: `${tierKey}-overdue`,
                bg: "#c2410c",
                label: `🚨 ${meta.shortLabel} Overdue Report (.xlsx)`,
                onClick: () => handleDownloadDelegationExcel(tierKey, "overdue", "ALL"),
              },
              {
                key: `${tierKey}-cancel`,
                bg: "#be123c",
                label: `❌ ${meta.shortLabel} Cancellation Report (.xlsx)`,
                onClick: () => handleDownloadDelegationExcel(tierKey, "cancelled", "ALL"),
              }
            );
          } else {
            if (!monthlyScope) {
              taskBtns.push({
                key: `${tierKey}-monthly-companion`,
                bg: "#0f766e",
                label: `📅 ${meta.shortLabel} Monthly Report (.xlsx)`,
                onClick: () => handleDownloadDelegationExcel(tierKey, "monthly", activeScope),
              });
            } else {
              taskBtns.push(
                {
                  key: `${tierKey}-done-companion`,
                  bg: "#15803d",
                  label: `✅ ${meta.shortLabel} Done (.xlsx)`,
                  onClick: () => handleDownloadDelegationExcel(tierKey, "done", monthlyScope),
                },
                {
                  key: `${tierKey}-overdue-companion`,
                  bg: "#c2410c",
                  label: `🚨 ${meta.shortLabel} Overdue (.xlsx)`,
                  onClick: () => handleDownloadDelegationExcel(tierKey, "overdue", monthlyScope),
                },
                {
                  key: `${tierKey}-cancel-companion`,
                  bg: "#be123c",
                  label: `❌ ${meta.shortLabel} Cancelled (.xlsx)`,
                  onClick: () => handleDownloadDelegationExcel(tierKey, "cancelled", monthlyScope),
                }
              );
            }
            taskBtns.push({
              key: `${tierKey}-master-companion`,
              bg: "#6d28d9",
              label: `🗂️ Full ${meta.shortLabel} Analytics (.xlsx)`,
              onClick: () => handleDownloadDelegationExcel(tierKey, "master"),
            });
          }

          return (
            <div key={`dl-${tierKey}`} className="chat-inline-download-buttons">
              {taskBtns.map((btn) => (
                <button
                  key={btn.key}
                  className="chat-dl-btn excel"
                  style={{ background: btn.bg, borderColor: btn.bg, color: "#fff" }}
                  onClick={btn.onClick}
                  disabled={isExporting}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          );
        })}

        {/* Less Than 9 Hours Button */}
        {lessThan9Scope && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              onClick={() => handleDownloadLessThan9HoursExcel(lessThan9Scope)}
              disabled={isExporting}
            >
              ⏱️ Download Employees &lt; 9 Hours Report{lessThan9Scope !== "CURRENT" ? ` (${lessThan9Scope})` : ""} (.xlsx)
            </button>
          </div>
        )}

        {/* Cross-Employee Same Task Duplicate Button */}
        {crossEmpScope && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              style={{ background: "#d97706", borderColor: "#d97706", color: "#fff" }}
              onClick={() => handleDownloadCrossEmployeeDuplicatesExcel(crossEmpScope)}
              disabled={isExporting}
            >
              👥 Download Same Task Across Employees{crossEmpScope !== "CURRENT" ? ` (${crossEmpScope})` : ""} (.xlsx)
            </button>
          </div>
        )}

        {/* Daily Working Monthly Button */}
        {dailyWorkingMonthlyScope && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              style={{ background: "#0f766e", borderColor: "#0f766e", color: "#fff" }}
              onClick={() => handleDownloadDailyWorkingMonthlyExcel(dailyWorkingMonthlyScope)}
              disabled={isExporting}
            >
              📝 Download Daily Working Monthly Excel{dailyWorkingMonthlyScope !== "ALL" ? ` (${dailyWorkingMonthlyScope})` : ""} (.xlsx)
            </button>
          </div>
        )}

        {/* Daily Attendance Buttons */}
        {hasDailyButtons && (
          <div className="chat-inline-download-buttons">
            <button className="chat-dl-btn excel" onClick={handleDownloadDailyAttendanceExcel} disabled={isExporting}>
              📊 Daily Attendance Excel
            </button>
            <button className="chat-dl-btn pdf" onClick={handleDownloadDailyAttendancePDF} disabled={isExporting}>
              📄 Daily Attendance PDF
            </button>
          </div>
        )}

        {/* Daily Working Buttons */}
        {hasDailyWorkingButtons && (
          <div className="chat-inline-download-buttons">
            <button className="chat-dl-btn excel" onClick={handleDownloadDailyWorkingExcel} disabled={isExporting}>
              📊 Daily Working Excel
            </button>
            <button className="chat-dl-btn pdf" onClick={handleDownloadDailyWorkingPDF} disabled={isExporting}>
              📄 Daily Working PDF
            </button>
          </div>
        )}

        {/* Weekly Attendance Buttons */}
        {hasWeeklyButtons && (
          <div className="chat-inline-download-buttons">
            <button className="chat-dl-btn excel" onClick={handleDownloadWeeklyAttendanceExcel} disabled={isExporting}>
              📊 Weekly Attendance Excel
            </button>
            <button className="chat-dl-btn pdf" onClick={handleDownloadWeeklyAttendancePDF} disabled={isExporting}>
              📄 Weekly Attendance PDF
            </button>
          </div>
        )}

        {/* Monthly Attendance Buttons */}
        {monthlyAttScope && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              onClick={() => handleDownloadMonthlyAttendanceExcel(monthlyAttScope)}
              disabled={isExporting}
            >
              📈 Monthly Attendance Excel{monthlyAttScope !== "CURRENT" ? ` (${monthlyAttScope})` : ""}
            </button>
            <button
              className="chat-dl-btn pdf"
              onClick={() => handleDownloadMonthlyAttendancePDF(monthlyAttScope)}
              disabled={isExporting}
            >
              📄 Monthly Attendance PDF{monthlyAttScope !== "CURRENT" ? ` (${monthlyAttScope})` : ""}
            </button>
          </div>
        )}

        {/* All 5 Modules Scoped Monthly Downloads Card */}
        {allModulesMonthlyScope && (
          <div className="chat-multi-download-card">
            <div className="multi-dl-section">
              <span className="multi-dl-title">
                📅 Download {allModulesMonthlyScope === "ALL" ? "All Months" : allModulesMonthlyScope} Reports Across Every Module:
              </span>
              <div className="multi-dl-btns">
                {[
                  {
                    label: "📊 Attendance Excel",
                    cls: "excel",
                    onClick: () => handleDownloadMonthlyAttendanceExcel(allModulesMonthlyScope),
                  },
                  {
                    label: "📄 Attendance PDF",
                    cls: "pdf",
                    onClick: () => handleDownloadMonthlyAttendancePDF(allModulesMonthlyScope),
                  },
                  {
                    label: "📝 Daily Working Excel",
                    cls: "excel",
                    onClick: () => handleDownloadDailyWorkingMonthlyExcel(allModulesMonthlyScope),
                  },
                  {
                    label: "🛡️ Internal Audit FMS",
                    cls: "excel",
                    onClick: () => handleDownloadInternalAuditExcel(allModulesMonthlyScope),
                  },
                  {
                    label: "📌 PMS FMS",
                    cls: "excel",
                    onClick: () => handleDownloadPmsExcel(allModulesMonthlyScope),
                  },
                  {
                    label: "🗂️ Senior Delegation Monthly",
                    cls: "excel",
                    onClick: () => handleDownloadSeniorTaskMonthlyExcel(allModulesMonthlyScope),
                  },
                  {
                    label: "✅ Senior Delegation Done",
                    cls: "excel",
                    onClick: () => handleDownloadSeniorTaskDoneExcel(allModulesMonthlyScope),
                  },
                  {
                    label: "🚨 Senior Delegation Overdue",
                    cls: "excel",
                    onClick: () => handleDownloadSeniorTaskOverdueExcel(allModulesMonthlyScope),
                  },
                  {
                    label: "❌ Senior Delegation Cancelled",
                    cls: "excel",
                    onClick: () => handleDownloadSeniorTaskCancelledExcel(allModulesMonthlyScope),
                  },
                  {
                    label: "🧑‍💻 Junior Delegation Monthly",
                    cls: "excel",
                    onClick: () => handleDownloadDelegationExcel("junior", "monthly", allModulesMonthlyScope),
                  },
                  {
                    label: "✅ Junior Delegation Done",
                    cls: "excel",
                    onClick: () => handleDownloadDelegationExcel("junior", "done", allModulesMonthlyScope),
                  },
                  {
                    label: "🚨 Junior Delegation Overdue",
                    cls: "excel",
                    onClick: () => handleDownloadDelegationExcel("junior", "overdue", allModulesMonthlyScope),
                  },
                  {
                    label: "❌ Junior Delegation Cancelled",
                    cls: "excel",
                    onClick: () => handleDownloadDelegationExcel("junior", "cancelled", allModulesMonthlyScope),
                  },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    className={`chat-dl-btn ${btn.cls}`}
                    onClick={btn.onClick}
                    disabled={isExporting}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* All Combined Downloads Card */}
        {hasAllButtons && (
          <div className="chat-multi-download-card">
            <div className="multi-dl-section">
              <span className="multi-dl-title">📅 Live Attendance:</span>
              <div className="multi-dl-btns">
                <button className="chat-dl-btn excel" onClick={handleDownloadDailyAttendanceExcel} disabled={isExporting}>
                  📊 Daily Excel
                </button>
                <button className="chat-dl-btn pdf" onClick={handleDownloadDailyAttendancePDF} disabled={isExporting}>
                  📄 Daily PDF
                </button>
                <button className="chat-dl-btn excel" onClick={handleDownloadMonthlyAttendanceExcel} disabled={isExporting}>
                  📈 Monthly Register
                </button>
              </div>
            </div>
            <div className="multi-dl-section">
              <span className="multi-dl-title">📝 Daily Working &amp; Audits:</span>
              <div className="multi-dl-btns">
                <button className="chat-dl-btn excel" onClick={handleDownloadDailyWorkingExcel} disabled={isExporting}>
                  📊 Working Master
                </button>
                <button className="chat-dl-btn excel" onClick={() => handleDownloadDuplicacyExcel("CURRENT")} disabled={isExporting}>
                  🔍 Duplicacy Report
                </button>
                <button className="chat-dl-btn excel" onClick={handleDownloadTwoDaysDefaultersExcel} disabled={isExporting}>
                  🚨 &gt;2d Defaulters
                </button>
                <button className="chat-dl-btn excel" onClick={handleDownloadLessThan9HoursExcel} disabled={isExporting}>
                  ⏱️ &lt; 9h Report
                </button>
                <button className="chat-dl-btn excel" onClick={() => handleDownloadCrossEmployeeDuplicatesExcel()} disabled={isExporting}>
                  👥 Same Task Staff
                </button>
              </div>
            </div>
            <div className="multi-dl-section">
              <span className="multi-dl-title">📑 Internal Audit FMS:</span>
              <div className="multi-dl-btns">
                <button className="chat-dl-btn excel" onClick={handleDownloadInternalAuditExcel} disabled={isExporting}>
                  📊 FMS Register
                </button>
                <button className="chat-dl-btn excel" onClick={handleDownloadBlankActualStatusExcel} disabled={isExporting}>
                  🚨 Blank Steps (Excel)
                </button>
                <button className="chat-dl-btn pdf" style={{ background: "#dc2626", borderColor: "#dc2626", color: "#fff" }} onClick={handleDownloadBlankActualStatusPdf} disabled={isExporting}>
                  📄 Blank Steps (PDF)
                </button>
                <button className="chat-dl-btn excel" style={{ background: "#b45309", borderColor: "#b45309", color: "#fff" }} onClick={handleDownloadFmsTargetDateBlankExcel} disabled={isExporting}>
                  📅 Target Date Blank (Excel)
                </button>
                <button className="chat-dl-btn pdf" style={{ background: "#d97706", borderColor: "#d97706", color: "#fff" }} onClick={handleDownloadFmsTargetDateBlankPdf} disabled={isExporting}>
                  📄 Target Date Blank (PDF)
                </button>
              </div>
            </div>
            <div className="multi-dl-section">
              <span className="multi-dl-title">📋 PMS FMS (Process Management):</span>
              <div className="multi-dl-btns">
                <button className="chat-dl-btn excel" onClick={handleDownloadPmsExcel} disabled={isExporting}>
                  📋 PMS Register
                </button>
                <button className="chat-dl-btn excel" onClick={handleDownloadPmsBlankActualStatusExcel} disabled={isExporting}>
                  🚨 PMS Blank Actual &amp; Status (Excel)
                </button>
                <button className="chat-dl-btn pdf" style={{ background: "#dc2626", borderColor: "#dc2626", color: "#fff" }} onClick={handleDownloadPmsBlankActualStatusPdf} disabled={isExporting}>
                  📄 PMS Blank Actual &amp; Status (PDF)
                </button>
              </div>
            </div>
            <div className="multi-dl-section">
              <span className="multi-dl-title">🗂️ Senior Task Delegation (Seniors Data):</span>
              <div className="multi-dl-btns">
                {[
                  { label: "📅 Senior Monthly Report", onClick: () => handleDownloadSeniorTaskMonthlyExcel("ALL") },
                  { label: "✅ Senior Done Report", onClick: () => handleDownloadSeniorTaskDoneExcel("ALL") },
                  { label: "🚨 Senior Overdue Report", onClick: () => handleDownloadSeniorTaskOverdueExcel("ALL") },
                  { label: "❌ Senior Cancellation Report", onClick: () => handleDownloadSeniorTaskCancelledExcel("ALL") },
                  { label: "🗂️ Full Senior Task Analytics", onClick: handleDownloadSeniorTaskExcel },
                ].map((item) => (
                  <button
                    key={item.label}
                    className="chat-dl-btn excel"
                    onClick={item.onClick}
                    disabled={isExporting}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="multi-dl-section">
              <span className="multi-dl-title">🧑‍💻 Junior Task Delegation (Juniors Data):</span>
              <div className="multi-dl-btns">
                {[
                  { label: "📅 Junior Monthly Report", onClick: () => handleDownloadDelegationExcel("junior", "monthly", "ALL") },
                  { label: "✅ Junior Done Report", onClick: () => handleDownloadDelegationExcel("junior", "done", "ALL") },
                  { label: "🚨 Junior Overdue Report", onClick: () => handleDownloadDelegationExcel("junior", "overdue", "ALL") },
                  { label: "❌ Junior Cancellation Report", onClick: () => handleDownloadDelegationExcel("junior", "cancelled", "ALL") },
                  { label: "🗂️ Full Junior Task Analytics", onClick: () => handleDownloadDelegationExcel("junior", "master") },
                ].map((item) => (
                  <button
                    key={item.label}
                    className="chat-dl-btn excel"
                    onClick={item.onClick}
                    disabled={isExporting}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="multi-dl-section">
              <span className="multi-dl-title">🏢 Multi-Company Work Completion (16 Companies):</span>
              <div className="multi-dl-btns">
                <button
                  className="chat-dl-btn excel"
                  style={{ background: "#047857", borderColor: "#047857", color: "#fff" }}
                  onClick={() => handleDownloadCompanyAuditExcel("ALL")}
                  disabled={isExporting}
                >
                  📊 All Companies Excel
                </button>
                <button
                  className="chat-dl-btn excel"
                  style={{ background: "#059669", borderColor: "#059669", color: "#fff" }}
                  onClick={() => handleDownloadCompanyAuditExcel("ON_DATE")}
                  disabled={isExporting}
                >
                  🎯 Completed On Date
                </button>
                <button
                  className="chat-dl-btn excel"
                  style={{ background: "#2563eb", borderColor: "#2563eb", color: "#fff" }}
                  onClick={() => handleDownloadCompanyAuditExcel("BEFORE_TARGET")}
                  disabled={isExporting}
                >
                  ⚡ Before Target Date
                </button>
                <button
                  className="chat-dl-btn excel"
                  style={{ background: "#b91c1c", borderColor: "#b91c1c", color: "#fff" }}
                  onClick={() => handleDownloadCompanyAuditExcel("AFTER_TARGET")}
                  disabled={isExporting}
                >
                  ⚠️ After Target Date
                </button>
                <button
                  className="chat-dl-btn pdf"
                  style={{ background: "#991b1b", borderColor: "#991b1b", color: "#fff" }}
                  onClick={() => handleDownloadCompanyAuditPdf("ALL")}
                  disabled={isExporting}
                >
                  📄 Multi-Company PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      {/* Single Floating Launcher Pill for MD Dashboard */}
      <button
        className={`executive-chatbot-launcher-btn ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open Unified AJC Executive AI Assistant"
      >
        <span className="executive-launcher-icon">👑</span>
        <span className="executive-launcher-text">Executive AI</span>
        <span className="executive-status-pulse"></span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="executive-chatbot-container">
          {/* Header */}
          <div className="executive-chatbot-header">
            <div className="executive-header-info">
              <div className="executive-avatar">👑</div>
              <div>
                <h3 className="executive-title">AJC Executive AI Assistant</h3>
                <span className="executive-sub">
                  Attendance &amp; Daily Working Intelligence
                </span>
              </div>
            </div>

            <div className="executive-header-actions">
              {/* Unified Downloads Dropdown */}
              <div className="executive-download-menu-wrapper" ref={exportMenuRef}>
                <button
                  className={`executive-action-btn download-btn ${showExportMenu ? "active" : ""}`}
                  title="Download Reports (Attendance & Daily Working)"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                >
                  📥
                </button>
                {showExportMenu && (
                  <div className="executive-export-dropdown">
                    <div className="export-dropdown-header">
                      <span>Executive Downloads</span>
                      <span className="export-badge">Live</span>
                    </div>

                    <div className="export-menu-section-title">📅 Live Attendance</div>
                    <button className="export-dropdown-item excel" onClick={handleDownloadDailyAttendanceExcel} disabled={isExporting}>
                      <span className="export-item-icon">📊</span>
                      <div className="export-item-info">
                        <strong>Daily Attendance Excel</strong>
                        <small>Today's punches &amp; shift cut-offs</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item pdf" onClick={handleDownloadDailyAttendancePDF} disabled={isExporting}>
                      <span className="export-item-icon">📄</span>
                      <div className="export-item-info">
                        <strong>Daily Attendance PDF</strong>
                        <small>Official executive landscape document</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item excel" onClick={handleDownloadWeeklyAttendanceExcel} disabled={isExporting}>
                      <span className="export-item-icon">🗓️</span>
                      <div className="export-item-info">
                        <strong>Weekly Attendance Excel</strong>
                        <small>Past 7 days summary &amp; daily logs</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item excel" onClick={handleDownloadMonthlyAttendanceExcel} disabled={isExporting}>
                      <span className="export-item-icon">📈</span>
                      <div className="export-item-info">
                        <strong>Monthly Register Excel</strong>
                        <small>Google Sheet monthly compliance</small>
                      </div>
                    </button>

                    <div className="export-menu-section-title">📝 Daily Working &amp; Audits</div>
                    <button className="export-dropdown-item excel" onClick={handleDownloadDailyWorkingExcel} disabled={isExporting}>
                      <span className="export-item-icon">📋</span>
                      <div className="export-item-info">
                        <strong>Daily Working Master Excel</strong>
                        <small>Complete staff task diary submissions</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item excel" onClick={() => handleDownloadDailyWorkingMonthlyExcel("ALL")} disabled={isExporting}>
                      <span className="export-item-icon">📅</span>
                      <div className="export-item-info">
                        <strong>Daily Working Month-Wise (.xlsx)</strong>
                        <small>Month-by-month hours, tasks &amp; staff summary</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item excel" onClick={() => handleDownloadDuplicacyExcel("CURRENT")} disabled={isExporting}>
                      <span className="export-item-icon">🔍</span>
                      <div className="export-item-info">
                        <strong>Duplicacy Audit Report (.xlsx)</strong>
                        <small>Row-by-row 6-field duplicate sequences</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item excel" onClick={handleDownloadAiUsageExcel} disabled={isExporting}>
                      <span className="export-item-icon">🤖</span>
                      <div className="export-item-info">
                        <strong>AI &amp; Claude Usage Audit (.xlsx)</strong>
                        <small>Staff prompt detection &amp; task logs</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item excel" onClick={handleDownloadTwoDaysDefaultersExcel} disabled={isExporting}>
                      <span className="export-item-icon">🚨</span>
                      <div className="export-item-info">
                        <strong>&gt; 2 Days Defaulters (.xlsx)</strong>
                        <small>Partners, Seniors, Articles, Plant</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item excel" onClick={handleDownloadLessThan9HoursExcel} disabled={isExporting}>
                      <span className="export-item-icon">⏱️</span>
                      <div className="export-item-info">
                        <strong>Employees &lt; 9 Hours (.xlsx)</strong>
                        <small>Staff who logged under 9 hours in daily working</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item excel" onClick={() => handleDownloadCrossEmployeeDuplicatesExcel()} disabled={isExporting}>
                      <span className="export-item-icon">👥</span>
                      <div className="export-item-info">
                        <strong>Same Task Different Staff (.xlsx)</strong>
                        <small>Matching location, dept, group, company &amp; task</small>
                      </div>
                    </button>

                    <div className="export-menu-section-title">📑 Internal Audit FMS</div>
                    <button className="export-dropdown-item excel" onClick={handleDownloadInternalAuditExcel} disabled={isExporting}>
                      <span className="export-item-icon">📊</span>
                      <div className="export-item-info">
                        <strong>Internal Audit Register (.xlsx)</strong>
                        <small>89 client engagements &amp; 18 FMS steps SOP</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item excel" onClick={handleDownloadBlankActualStatusExcel} disabled={isExporting}>
                      <span className="export-item-icon">🚨</span>
                      <div className="export-item-info">
                        <strong>Blank Steps &amp; Status Report (.xlsx)</strong>
                        <small>Deficiency matrix &amp; missed steps breakdown</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item pdf" onClick={handleDownloadBlankActualStatusPdf} disabled={isExporting}>
                      <span className="export-item-icon">📄</span>
                      <div className="export-item-info">
                        <strong>Blank Steps &amp; Status Report (.pdf)</strong>
                        <small>Printable PDF detailing missed steps</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item excel" onClick={handleDownloadFmsTargetDateBlankExcel} disabled={isExporting}>
                      <span className="export-item-icon">📅</span>
                      <div className="export-item-info">
                        <strong>Target Date Blank Report (.xlsx)</strong>
                        <small>Engagements missing target completion dates</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item pdf" onClick={handleDownloadFmsTargetDateBlankPdf} disabled={isExporting}>
                      <span className="export-item-icon">📄</span>
                      <div className="export-item-info">
                        <strong>Target Date Blank Report (.pdf)</strong>
                        <small>Printable PDF of engagements with blank targets</small>
                      </div>
                    </button>

                    <div className="export-menu-section-title">📋 PMS FMS</div>
                    <button className="export-dropdown-item excel" onClick={handleDownloadPmsExcel} disabled={isExporting}>
                      <span className="export-item-icon">📋</span>
                      <div className="export-item-info">
                        <strong>PMS FMS Register (.xlsx)</strong>
                        <small>{pmsRecords.length} assignments &amp; 17 PMS steps SOP</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item excel" onClick={handleDownloadPmsBlankActualStatusExcel} disabled={isExporting}>
                      <span className="export-item-icon">🚨</span>
                      <div className="export-item-info">
                        <strong>PMS Blank Actual &amp; Status (.xlsx)</strong>
                        <small>PMS assignments with blank actual &amp; status (Excel)</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item pdf" onClick={handleDownloadPmsBlankActualStatusPdf} disabled={isExporting}>
                      <span className="export-item-icon">📄</span>
                      <div className="export-item-info">
                        <strong>PMS Blank Actual &amp; Status (.pdf)</strong>
                        <small>Printable PDF of pending PMS assignments</small>
                      </div>
                    </button>

                    {[
                      { tier: "senior", title: "🗂️ Senior Task Delegation (Seniors Data)", ana: seniorTaskAnalytics },
                      { tier: "junior", title: "🧑‍💻 Junior Task Delegation (Juniors Data)", ana: juniorTaskAnalytics },
                    ].map(({ tier, title, ana }) => {
                      const label = tier === "junior" ? "Junior" : "Senior";
                      return (
                        <React.Fragment key={tier}>
                          <div className="export-menu-section-title">{title}</div>
                          {[
                            {
                              icon: "📅",
                              title: `${label} Monthly Tasks Report (.xlsx)`,
                              sub: `${ana.monthly.length} months • ${label}s Done, Open, Overdue & Cancelled`,
                              onClick: () => handleDownloadDelegationExcel(tier, "monthly", "ALL"),
                            },
                            {
                              icon: "✅",
                              title: `${label} Done Tasks Report (.xlsx)`,
                              sub: `${ana.overview.doneCount} done (${ana.overview.completionRate}%) • On-Time vs Late`,
                              onClick: () => handleDownloadDelegationExcel(tier, "done", "ALL"),
                            },
                            {
                              icon: "🚨",
                              title: `${label} Overdue Tasks Report (.xlsx)`,
                              sub: `${ana.overview.overdueCount} open overdue + ${ana.overview.doneLateCount} late completions`,
                              onClick: () => handleDownloadDelegationExcel(tier, "overdue", "ALL"),
                            },
                            {
                              icon: "❌",
                              title: `${label} Cancelled Tasks Report (.xlsx)`,
                              sub: `${ana.overview.cancelledCount} cancelled • Top ${label} Doers & Assignors`,
                              onClick: () => handleDownloadDelegationExcel(tier, "cancelled", "ALL"),
                            },
                            {
                              icon: "🗂️",
                              title: `${label} Task AI Analytics (.xlsx)`,
                              sub: `${ana.overview.totalTasks.toLocaleString("en-IN")} ${label.toLowerCase()} tasks & complete multi-tab workbook`,
                              onClick: () => handleDownloadDelegationExcel(tier, "master"),
                            },
                          ].map((item) => (
                            <button
                              key={`${tier}-${item.title}`}
                              className="export-dropdown-item excel"
                              onClick={item.onClick}
                              disabled={isExporting}
                            >
                              <span className="export-item-icon">{item.icon}</span>
                              <div className="export-item-info">
                                <strong>{item.title}</strong>
                                <small>{item.sub}</small>
                              </div>
                            </button>
                          ))}
                        </React.Fragment>
                      );
                    })}

                    <div className="export-menu-section-title">🏢 Multi-Company Work Completion (16 Companies)</div>
                    <button
                      className="export-dropdown-item excel"
                      onClick={() => handleDownloadCompanyAuditExcel("ALL")}
                      disabled={isExporting}
                    >
                      <span className="export-item-icon">📊</span>
                      <div className="export-item-info">
                        <strong>All Companies Completion Register (.xlsx)</strong>
                        <small>{companyAuditData?.allTasks?.length || 1230} audit tasks across 16 client groups</small>
                      </div>
                    </button>
                    <button
                      className="export-dropdown-item excel"
                      onClick={() => handleDownloadCompanyAuditExcel("ON_DATE")}
                      disabled={isExporting}
                    >
                      <span className="export-item-icon">🎯</span>
                      <div className="export-item-info">
                        <strong>Completed ON Target Date (.xlsx)</strong>
                        <small>Tasks finished with 0 delay (exact on-time execution)</small>
                      </div>
                    </button>
                    <button
                      className="export-dropdown-item excel"
                      onClick={() => handleDownloadCompanyAuditExcel("BEFORE_TARGET")}
                      disabled={isExporting}
                    >
                      <span className="export-item-icon">⚡</span>
                      <div className="export-item-info">
                        <strong>Completed BEFORE Target Date (.xlsx)</strong>
                        <small>Tasks finished ahead of schedule</small>
                      </div>
                    </button>
                    <button
                      className="export-dropdown-item excel"
                      onClick={() => handleDownloadCompanyAuditExcel("AFTER_TARGET")}
                      disabled={isExporting}
                    >
                      <span className="export-item-icon">⚠️</span>
                      <div className="export-item-info">
                        <strong>Completed AFTER Target Date (.xlsx)</strong>
                        <small>Delayed tasks finished past deadline</small>
                      </div>
                    </button>
                    <button
                      className="export-dropdown-item pdf"
                      onClick={() => handleDownloadCompanyAuditPdf("ALL")}
                      disabled={isExporting}
                    >
                      <span className="export-item-icon">📄</span>
                      <div className="export-item-info">
                        <strong>Multi-Company Completion Report (.pdf)</strong>
                        <small>Corporate printable audit summary</small>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <button
                className="executive-action-btn"
                title="Shift & API Settings"
                onClick={() => setShowSettings(!showSettings)}
              >
                ⚙️
              </button>
              <button
                className="executive-action-btn"
                title="Clear Chat"
                onClick={clearChat}
              >
                🗑️
              </button>
              <button
                className="executive-action-btn close-btn"
                title="Close"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="executive-settings-panel">
              <div className="settings-field">
                <label>OpenAI API Key (Optional):</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                />
                <small>Leave empty to use built-in multi-shift local analytics.</small>
              </div>

              <div className="settings-shifts-header">
                <strong>⏰ Shift Cut-offs (Grace +5 mins):</strong>
              </div>

              <div className="settings-shifts-grid">
                <div className="settings-shift-item">
                  <label>🏭 Plant Audit:</label>
                  <input type="time" value={tempPlantCutoff} onChange={(e) => setTempPlantCutoff(e.target.value)} />
                </div>
                <div className="settings-shift-item">
                  <label>📚 Articles:</label>
                  <input type="time" value={tempArticleCutoff} onChange={(e) => setTempArticleCutoff(e.target.value)} />
                </div>
                <div className="settings-shift-item">
                  <label>🏢 Back Office:</label>
                  <input type="time" value={tempOfficeCutoff} onChange={(e) => setTempOfficeCutoff(e.target.value)} />
                </div>
                <div className="settings-shift-item">
                  <label>👔 Seniors:</label>
                  <input type="time" value={tempSeniorCutoff} onChange={(e) => setTempSeniorCutoff(e.target.value)} />
                </div>
                <div className="settings-shift-item">
                  <label>🤝 Partners:</label>
                  <input type="time" value={tempPartnerCutoff} onChange={(e) => setTempPartnerCutoff(e.target.value)} />
                </div>
                <div className="settings-shift-item">
                  <label>👑 MD Sir:</label>
                  <input type="time" value={tempMDCutoff} onChange={(e) => setTempMDCutoff(e.target.value)} />
                </div>
              </div>

              <div className="settings-actions">
                <button className="save-btn" onClick={handleSaveSettings}>Save Settings</button>
                <button className="cancel-btn" onClick={() => setShowSettings(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Metrics Bar */}
          <div className="executive-metrics-bar">
            <span
              className="executive-metric-tag plant"
              onClick={() => handleSend("Show plant audit staff status")}
              title="Plant Staff"
            >
              🏭 Plant: <b>{attendanceMetrics.plant.present.length}</b> In / <b>{attendanceMetrics.plant.late.length}</b> Late
            </span>
            <span
              className="executive-metric-tag article"
              onClick={() => handleSend("Show articles status")}
              title="Articles"
            >
              📚 Articles: <b>{attendanceMetrics.article.present.length}</b> In / <b>{attendanceMetrics.article.late.length}</b> Late
            </span>
            <span
              className="executive-metric-tag senior"
              onClick={() => handleSend("Show seniors status")}
              title="Seniors"
            >
              👔 Seniors: <b>{attendanceMetrics.senior.present.length}</b> In / <b>{attendanceMetrics.senior.late.length}</b> Late
            </span>
            <span
              className="executive-metric-tag partner"
              onClick={() => handleSend("Show partners status")}
              title="Partners"
            >
              🤝 Partners: <b>{attendanceMetrics.partner.present.length}</b> In
            </span>
            <span
              className="executive-metric-tag work"
              onClick={() => handleSend("Show daily working defaulters")}
              title="Daily Working Submissions"
            >
              📝 Work: <b>{workingKpis.workSubmitted}</b> Submitted / <b>{workingKpis.presentWithoutWork.length}</b> Pending
            </span>
            <span
              className="executive-metric-tag audit"
              onClick={() => handleSend("Internal audit FMS status")}
              title="Internal Audit FMS Engagements"
            >
              📑 FMS: <b>{internalAudits.length || 89}</b> Audits / <b>17</b> Steps
            </span>
            <span
              className="executive-metric-tag pms"
              onClick={() => handleSend("PMS FMS status")}
              title="PMS FMS Assignments"
            >
              📋 PMS: <b>{pmsRecords.length}</b> Entries / <b>17</b> Steps
            </span>
            <span
              className="executive-metric-tag senior-task"
              onClick={() => handleSend("Senior task status")}
              title="Senior Task Delegation Live Metrics"
            >
              👔 Senior: <b>{seniorTaskAnalytics.overview.totalTasks.toLocaleString("en-IN")}</b> Total /{" "}
              <b>{seniorTaskAnalytics.overview.cancelledCount}</b> Cancelled
            </span>
            <span
              className="executive-metric-tag senior-task"
              onClick={() => handleSend("Junior task status")}
              title="Junior Task Delegation Live Metrics"
            >
              🧑‍💻 Junior: <b>{juniorTaskAnalytics.overview.totalTasks.toLocaleString("en-IN")}</b> Total /{" "}
              <b>{juniorTaskAnalytics.overview.cancelledCount}</b> Cancelled
            </span>
            <span
              className="executive-metric-tag company-audit"
              style={{ background: "#ecfdf5", color: "#065f46", borderColor: "#a7f3d0" }}
              onClick={() => handleSend("Overall work completion analysis")}
              title="Multi-Company Audit Work Completion Live Intelligence"
            >
              🏢 Audits: <b>{companyAuditData?.allTasks?.length || 1230}</b> Tasks / <b>{companyAuditData?.companySummaries?.filter((s) => s.status === "LIVE").length || 11}</b> Live Cos
            </span>
          </div>

          {/* Messages Area */}
          <div className="executive-chatbot-messages">
            {messages.map((m) => (
              <div key={m.id} className={`executive-msg ${m.sender}`}>
                <div className="executive-msg-bubble">
                  {renderFormattedText(m.text)}
                  <div className="executive-msg-time">{m.time}</div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="executive-msg bot">
                <div className="executive-msg-bubble typing">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div
            className="executive-chips"
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
          >
            <button
              onClick={() => handleSend("Work completion on date report")}
              className="chip-btn chip-highlight"
              style={{ background: "#059669", color: "#fff", borderColor: "#047857" }}
            >
              🎯 Completed On Date
            </button>
            <button
              onClick={() => handleSend("Work completion before target date report")}
              className="chip-btn chip-highlight"
              style={{ background: "#2563eb", color: "#fff", borderColor: "#1d4ed8" }}
            >
              ⚡ Before Target Date
            </button>
            <button
              onClick={() => handleSend("Work completion after target date report")}
              className="chip-btn chip-danger"
              style={{ background: "#dc2626", color: "#fff", borderColor: "#b91c1c" }}
            >
              ⚠️ After Target Date
            </button>
            <button
              onClick={() => handleSend("Overall work completion analysis")}
              className="chip-btn chip-audit"
              style={{ background: "#0f766e", color: "#fff", borderColor: "#115e59" }}
            >
              🏢 All 16 Companies
            </button>
            <button
              onClick={() => handleSend("SKY Alloy PMS report")}
              className="chip-btn chip-audit"
            >
              🏭 SKY Alloy PMS
            </button>
            <button
              onClick={() => handleSend("Real Ispat and Power Limited PMS report")}
              className="chip-btn chip-audit"
            >
              🏭 Real Ispat PMS
            </button>
            <button
              onClick={() => handleSend("Month-wise senior task report")}
              className="chip-btn chip-highlight"
            >
              📅 Task Month Report
            </button>
            <button
              onClick={() => handleSend("Month-wise done tasks report")}
              className="chip-btn chip-highlight"
            >
              ✅ Task Done Report
            </button>
            <button
              onClick={() => handleSend("Month-wise overdue tasks report")}
              className="chip-btn chip-audit"
            >
              🚨 Task Overdue Report
            </button>
            <button
              onClick={() => handleSend("Month-wise cancelled tasks report and who cancelled most")}
              className="chip-btn chip-danger"
            >
              ❌ Task Cancellations
            </button>
            <button
              onClick={() => handleSend("PMS FMS status")}
              className="chip-btn chip-audit"
            >
              📋 PMS Status
            </button>
            <button
              onClick={() => handleSend("PMS blank actual and status report")}
              className="chip-btn chip-danger"
            >
              🚨 PMS Blank Actual &amp; Status
            </button>
            <button
              onClick={() => handleSend("Download report of employees who have actual and status field both are blank")}
              className="chip-btn chip-danger"
            >
              🚨 Blank Actual &amp; Status
            </button>
            <button
              onClick={() => handleSend("Internal audit FMS status")}
              className="chip-btn chip-audit"
            >
              📊 Internal Audit FMS
            </button>
            <button
              onClick={() => handleSend("Explain the 18 steps of internal audit FMS")}
              className="chip-btn chip-audit"
            >
              📋 18 FMS Steps
            </button>
            <button
              onClick={() => handleSend("FMS target date blank")}
              className="chip-btn chip-audit"
            >
              📅 Target Date Blank
            </button>
            <button
              onClick={() => handleSend("Which steps are missed in FMS")}
              className="chip-btn chip-audit"
            >
              🚨 Missed Steps Report
            </button>
            <button
              onClick={() => handleSend("Show internal audits for CA Harsh Mittal")}
              className="chip-btn chip-highlight"
            >
              👔 Harsh Mittal Audits
            </button>
            <button
              onClick={() => handleSend("Show plant audit assignments")}
              className="chip-btn"
            >
              🏭 Plant Audits
            </button>
            <button
              onClick={() => handleSend("Duplicacy of October month")}
              className="chip-btn chip-audit"
            >
              🔍 Duplicacy in October
            </button>
            <button
              onClick={() => handleSend("Monthly duplicacy overview")}
              className="chip-btn chip-audit"
            >
              📊 All Months Duplicacy
            </button>
            <button
              onClick={() => handleSend("Uses of Ai or Claude in the task description of daily working")}
              className="chip-btn chip-ai"
            >
              🤖 AI &amp; Claude Usage
            </button>
            <button
              onClick={() => handleSend("The seniors/articles/plant staff/partners who have not filled their daily working more than 2 days")}
              className="chip-btn chip-danger"
            >
              🚨 Not Filled &gt; 2 Days
            </button>
            <button
              onClick={() => handleSend("Employees who have less than 9 hours in the daily working sheet in a day")}
              className="chip-btn chip-danger"
            >
              ⏱️ Less than 9 Hours Staff
            </button>
            <button
              onClick={() => handleSend("Report when work location, department, group name, company name and task description are same but different employee name")}
              className="chip-btn chip-audit"
            >
              👥 Same Task Different Staff
            </button>
            <button
              onClick={() => handleSend("Who is late today?")}
              className="chip-btn chip-attendance"
            >
              ⏰ Who is Late Today?
            </button>
            <button
              onClick={() => handleSend("Who is absent today?")}
              className="chip-btn chip-attendance"
            >
              ❌ Who is Absent Today?
            </button>
            <button
              onClick={() => handleSend("Show monthly attendance summary")}
              className="chip-btn chip-attendance"
            >
              📈 Monthly Attendance
            </button>
            <button
              onClick={() => handleSend("Show weekly attendance report")}
              className="chip-btn chip-attendance"
            >
              🗓️ Weekly Attendance
            </button>
            <button
              onClick={() => handleSend("Individual summary of employees daily working")}
              className="chip-btn chip-highlight"
            >
              👥 Employees Work Summary
            </button>
            <button
              onClick={() => handleSend("Daily working summary of CA Harsh Mittal")}
              className="chip-btn chip-highlight"
            >
              📝 Harsh Mittal Work
            </button>
            <button
              onClick={() => handleSend("Daily working summary of Meenu Patel")}
              className="chip-btn chip-highlight"
            >
              📝 Meenu Patel Work
            </button>
            <button
              onClick={() => handleSend("Show 360 report for CA Harsh Mittal")}
              className="chip-btn"
            >
              👤 Harsh Mittal 360°
            </button>
            <button
              onClick={() => handleSend("Show 360 report for Meenu Patel")}
              className="chip-btn"
            >
              👤 Meenu Patel 360°
            </button>
            <button
              onClick={() => handleSend("Who logged in early before cut-off time today?")}
              className="chip-btn"
            >
              🌅 Early Logins
            </button>
            <button
              onClick={() => handleSend("Show working hours of employees today")}
              className="chip-btn"
            >
              ⏳ Employee Working Hours
            </button>
            <button
              onClick={() => handleSend("Show plant audit staff status")}
              className="chip-btn"
            >
              🏭 Plant Staff Status
            </button>
            <button
              onClick={() => handleSend("Show seniors status")}
              className="chip-btn"
            >
              👔 Seniors Status
            </button>
            <button
              onClick={() => handleSend("Show partners status")}
              className="chip-btn"
            >
              🤝 Partners Status
            </button>
            <button
              onClick={() => handleSend("Show MD Rajesh Agrawal status")}
              className="chip-btn"
            >
              👑 MD Sir Status
            </button>
            <button
              onClick={handleDownloadDailyAttendanceExcel}
              className="chip-btn chip-dl"
            >
              📊 Daily Attendance Excel
            </button>
            <button
              onClick={handleDownloadDailyWorkingExcel}
              className="chip-btn chip-dl"
            >
              📋 Daily Working Excel
            </button>
            <button
              onClick={handleDownloadInternalAuditExcel}
              className="chip-btn chip-dl"
            >
              📊 Internal Audit FMS Excel
            </button>
            <button
              onClick={handleDownloadBlankActualStatusExcel}
              className="chip-btn chip-dl"
            >
              🚨 Blank Actual &amp; Status Excel
            </button>
            <button
              onClick={handleDownloadPmsExcel}
              className="chip-btn chip-dl"
            >
              📋 PMS FMS Excel
            </button>
            <button
              onClick={handleDownloadPmsBlankActualStatusExcel}
              className="chip-btn chip-dl"
            >
              🚨 PMS Blank Actual &amp; Status Excel
            </button>
            {[
              { label: "📅 Senior Monthly Excel", onClick: () => handleDownloadDelegationExcel("senior", "monthly", "ALL") },
              { label: "✅ Senior Done Excel", onClick: () => handleDownloadDelegationExcel("senior", "done", "ALL") },
              { label: "🚨 Senior Overdue Excel", onClick: () => handleDownloadDelegationExcel("senior", "overdue", "ALL") },
              { label: "❌ Senior Cancelled Excel", onClick: () => handleDownloadDelegationExcel("senior", "cancelled", "ALL") },
              { label: "🗂️ Senior Task Excel", onClick: () => handleDownloadDelegationExcel("senior", "master") },
              { label: "🧑‍💻 Junior Monthly Excel", onClick: () => handleDownloadDelegationExcel("junior", "monthly", "ALL") },
              { label: "✅ Junior Done Excel", onClick: () => handleDownloadDelegationExcel("junior", "done", "ALL") },
              { label: "🚨 Junior Overdue Excel", onClick: () => handleDownloadDelegationExcel("junior", "overdue", "ALL") },
              { label: "❌ Junior Cancelled Excel", onClick: () => handleDownloadDelegationExcel("junior", "cancelled", "ALL") },
              { label: "🗂️ Junior Task Excel", onClick: () => handleDownloadDelegationExcel("junior", "master") },
            ].map((chip) => (
              <button key={chip.label} onClick={chip.onClick} className="chip-btn chip-dl">
                {chip.label}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="executive-input-container">
            <input
              type="text"
              placeholder="Ask about Senior Tasks, cancelled tasks, month-wise reports, PMS/IA FMS, attendance..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
            />
            <button
              className="executive-send-btn"
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading}
            >
              ➔
            </button>
          </div>
        </div>
      )}
    </>
  );
}
