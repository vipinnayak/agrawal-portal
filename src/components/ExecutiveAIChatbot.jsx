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
} from "../utils/dailyWorkingService";

// --- HR & STATUTORY LABOUR LAW KNOWLEDGE ---
import {
  getHRLabourLawAnswer,
  HR_LABOUR_LAW_SYSTEM_PROMPT,
} from "../utils/hrLabourLawKnowledge";

// --- INTERNAL AUDIT FMS KNOWLEDGE & SERVICES ---
import {
  fetchUnifiedInternalAuditData,
  getInternalAuditOverview,
  getPartnerOrSeniorAuditReport,
  getAuditsByTypeReport,
  get17StepsGuideReport,
  getClientAuditReport,
  exportInternalAuditFmsToExcel,
  getBlankActualAndStatusSummary,
  exportBlankActualStatusReportToExcel,
} from "../utils/internalAuditFmsService";

// --- PMS FMS KNOWLEDGE & SERVICES ---
import {
  fetchUnifiedPmsData,
  getPmsOverview,
  getPartnerOrSeniorPmsReport,
  getPmsByTypeReport,
  getPms17StepsGuideReport,
  getClientOrGroupPmsReport,
  exportPmsFmsToExcel,
  getPmsBlankActualAndStatusSummary,
  exportPmsBlankActualStatusReportToExcel,
} from "../utils/pmsFmsService";

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
      text: `👋 Greetings MD Sir & Executive Team! I am your **AJC Unified Executive AI Assistant**.\n\nI provide unified executive intelligence across **Real-Time Attendance**, **Daily Working Submissions**, **Internal Audit FMS**, and **PMS FMS**:\n\n• ⏰ **Live Attendance & Shifts**: MD (10:00 AM), Partners (10:00 AM), Seniors (10:00 AM), Plant Audit (10:30 AM), Articles (11:00 AM), Office (10:00 AM).\n• 📝 **Daily Working & Audits**: Real-time task diary submissions, 6-parameter duplicate audits, missing date backlogs, and AI usage detection.\n• 📊 **Internal Audit FMS**: 89 Client Assignments, 17-Step Process SOP (Seniors & Partners), Plant vs City engagements, and milestone delivery tracking.\n• 📋 **PMS FMS (Process Management)**: 17-Step FMS tracking assignments, Partner & Senior ownership, Blank Actual & Status audits, and Google Sheet API sync.\n\n💡 **Top Queries You Can Ask**:\n- 📊 *"Internal audit FMS status"* or *"PMS FMS status"* or *"Explain the 17 steps of PMS"*\n- 👔 *"Audits assigned to CA Harsh Mittal"* or *"PMS of CA Harsh Mittal"*\n- 🏭 *"Show plant audit assignments"*\n- 🔍 *"Duplicacy in October"* or *"Monthly duplicacy overview"*\n- ⏰ *"Who is late today?"* or *"Who is absent today?"*\n- 🤖 *"Uses of AI or Claude in the task description of daily working"*\n- 🚨 *"The seniors/articles/plant staff/partners who have not filled their daily working more than 2 days"*\n- 👤 *"Show 360 report for CA Harsh Mittal"*\n- 📥 *"Download PMS report"* or *"Download internal audit FMS report"* or *"Download attendance report"*`,
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- DATA STATES ---
  const [internalAudits, setInternalAudits] = useState([]);
  const [pmsRecords, setPmsRecords] = useState([]);
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
            try {
              localStorage.setItem("ajc_cached_monthly_attendance", JSON.stringify(res));
            } catch (_) {}
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

  // 5. Internal Audit FMS & PMS FMS Assignments & SOP
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

  const handleDownloadMonthlyAttendanceExcel = async () => {
    setIsExporting(true);
    try {
      await exportMonthlyAttendanceToExcel({
        monthlyData: activeMonthlyData,
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
          text: `📊 **Monthly Attendance Register Excel Downloaded!**\n\n• Source: [Google Sheet Register](${MONTHLY_GOOGLE_SHEET_URL}).`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Monthly Attendance Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadMonthlyAttendancePDF = () => {
    setIsExporting(true);
    try {
      exportMonthlyAttendanceToPDF({
        monthlyData: activeMonthlyData,
        shiftPolicies,
      });
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📄 **Monthly Attendance Register PDF Downloaded!**\n\n• Source: [Google Sheet Register](${MONTHLY_GOOGLE_SHEET_URL}).`,
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

  const handleDownloadLessThan9HoursExcel = async (targetMonth = null) => {
    setIsExporting(true);
    try {
      await exportLessThanNineHoursReportToExcel(workingLogs, profiles, targetMonth);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `⏱️ **Employees < 9 Hours in Daily Working Report Downloaded!**\n\n• Multi-tab Excel workbook tracking all days where staff logged under 9 hours, employee shortfall summary, and today's live status.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Less Than 9 Hours Report.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCrossEmployeeDuplicatesExcel = async (targetMonth = null) => {
    setIsExporting(true);
    try {
      await exportCrossEmployeeDuplicatesToExcel(workingLogs, profiles, targetMonth);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `👥 **Same Task Across Different Employees Report Downloaded!**\n\n• Multi-tab Excel workbook tracking identical work logged across multiple employees with matching location, department, group, company, and task description.`,
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

  const handleDownloadInternalAuditExcel = async () => {
    setIsExporting(true);
    try {
      const filename = await exportInternalAuditFmsToExcel(internalAudits);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `📊 **Internal Audit FMS Register Excel Downloaded!** (${filename})\n\n• Includes all 89 client assignments across 46 corporate groups, lead CAs, partners, and the 17-step FMS standard protocol.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Internal Audit FMS Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadBlankActualStatusExcel = async () => {
    setIsExporting(true);
    try {
      const filename = await exportBlankActualStatusReportToExcel(internalAudits);
      setShowExportMenu(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `🚨 **Blank Actual & Status Audit Report Downloaded!** (${filename})\n\n• Multi-tab Excel workbook of all employees (Partners & Seniors) whose assignments have blank actual completion dates and blank status.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to export Blank Actual & Status Report.");
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Shared executor for PMS FMS workbook downloads so loading state and toast messages stay DRY.
   */
  const downloadPmsWorkbook = async (exporterFn, buildMessage, failureLabel) => {
    setIsExporting(true);
    try {
      const filename = await exporterFn(pmsRecords);
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

  const handleDownloadPmsExcel = () =>
    downloadPmsWorkbook(
      exportPmsFmsToExcel,
      (filename) =>
        `📋 **PMS FMS Register Excel Downloaded!** (${filename})\n\n• Includes PMS client/process assignments (${pmsRecords.length} live/local records), Partner & Lead CA ownership, and the 17-step PMS protocol.`,
      "PMS FMS Excel"
    );

  const handleDownloadPmsBlankActualStatusExcel = () =>
    downloadPmsWorkbook(
      exportPmsBlankActualStatusReportToExcel,
      (filename) =>
        `🚨 **PMS Blank Actual & Status Report Downloaded!** (${filename})\n\n• Multi-tab Excel workbook of PMS assignments where both Actual Completion Date and Status fields are blank.`,
      "PMS Blank Actual & Status Report"
    );

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

    const monthLogs = logs.filter((l) => isEntryInMonth(l, targetMonth.month, targetMonth.year));
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

  const generateAiAndClaudeUsageReport = (logs = []) => {
    if (!logs || logs.length === 0) {
      return `🤖 **AI & Claude Usage Audit Report**:\n\nNo task logs are currently available to analyze for AI usage.`;
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

    logs.forEach((entry) => {
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

    let response = `🤖 **AJC Executive Audit: Uses of AI & Claude in Daily Working**\n\n`;
    response += `• 📊 **Total Tasks Audited**: **${logs.length.toLocaleString()} Entries**\n`;
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
    response += `━━━━━━━━━━━━━━━━━━━━\n`;
    response += `### 📊 Department & Role Breakdown (< 9 Hours):\n`;
    response += `• 🤝 **Partners**: ${audit.kpis.roleCounts.partners} Days\n`;
    response += `• 👔 **Seniors**: ${audit.kpis.roleCounts.seniors} Days\n`;
    response += `• 📚 **Articles**: ${audit.kpis.roleCounts.articles} Days\n`;
    response += `• 🏭 **Plant Audit Staff**: ${audit.kpis.roleCounts.plantStaff} Days\n`;
    response += `• 🏢 **Back Office**: ${audit.kpis.roleCounts.backOffice} Days\n\n`;

    // Today's live check
    if (audit.todayShortfallList.length > 0) {
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
    response += `━━━━━━━━━━━━━━━━━━━━\n`;
    response += `### 👥 Staff with Frequent Shortfall Days:\n`;
    audit.staffSummary.slice(0, 8).forEach((s, idx) => {
      response += `${idx + 1}. **${s.name}** (${s.categoryRole} • ${s.department}) — **${s.shortfallDaysCount} Days < 9 hrs**\n`;
      response += `   • **Avg Daily Time**: ${s.avgLoggedDuration} | **Cumulative Deficit**: ${s.totalShortfallDuration} | **Lowest Day**: ${s.minLoggedHoursStr}\n`;
    });
    response += `\n`;

    // Recent instances
    response += `━━━━━━━━━━━━━━━━━━━━\n`;
    response += `### 📝 Recent Days Logged Under 9 Hours:\n`;
    activeList.slice(0, 6).forEach((r, idx) => {
      response += `${idx + 1}. **${r.rawName}** (${r.categoryRole}) — **${r.date}**\n`;
      response += `   • **Logged Time**: **${r.loggedHoursStr}** (${r.loggedDurationText}) | **Shortfall**: **${r.shortfallDurationText}**\n`;
      response += `   • **Tasks (${r.tasksCount})**: ${r.tasks.slice(0, 2).map((t) => `${t.company} (${t.timeGiven}): ${t.task.slice(0, 35)}`).join(" | ")}\n\n`;
    });

    response += `📥 **Report Download**: Click below to download the official Excel register with full row-by-row task breakdown, staff summary, and live status:\n\n`;
    response += `[DOWNLOAD_LESS_THAN_9_HOURS_EXCEL]`;
    return response;
  };

  const generateCrossEmployeeDuplicatesReport = (logs = [], profileList = [], queryText = "") => {
    const targetMonth = parseTargetMonthFromQuery(queryText);
    const audit = auditCrossEmployeeDuplicateTasks(logs, profileList, targetMonth ? targetMonth.key : "CURRENT");
    const monthLabel = targetMonth ? targetMonth.label : audit.activeMonthSpec.label;
    const isTargetMonthOnly = Boolean(targetMonth);

    const activeGroups = isTargetMonthOnly ? audit.targetMonthGroups : audit.groups;

    let response = `👥 **AJC Executive Audit: Same Task Logged Across Different Employees**\n\n`;
    response += `*Criteria: Same Work Location, Department, Group Name, Company Name, and Task Description logged by ≥ 2 different employees.*\n\n`;

    if (isTargetMonthOnly) {
      response += `• 📅 **Audit Period**: **${monthLabel}**\n`;
      response += `• 🏢 **Active Work Task Clusters**: **${audit.kpis.activeWorkClustersCount} Clusters**\n`;
      response += `• 📝 **Total Shared Task Entries**: **${audit.kpis.targetMonthSharedRows} Entries**\n`;
      response += `• 👥 **Staff Involved in ${monthLabel}**: **${audit.kpis.targetMonthStaffInvolved} Employees**\n\n`;
    } else {
      response += `• 📅 **Current Month (${monthLabel})**: **${audit.kpis.targetMonthClusters} Clusters** (${audit.kpis.targetMonthSharedRows} shared entries)\n`;
      response += `• 🏢 **Total All-Time Identical Clusters**: **${audit.kpis.totalClusters} Clusters** (${audit.kpis.activeWorkClustersCount} Active Client Work)\n`;
      response += `• 📝 **Total All-Time Shared Task Entries**: **${audit.kpis.totalSharedRows} Entries**\n`;
      response += `• 👥 **Total Distinct Staff Involved**: **${audit.kpis.staffInvolvedCount} Employees**\n\n`;
    }

    if (activeGroups.length === 0) {
      response += `🎉 **Zero Cross-Employee Duplicate Tasks Found!** No identical tasks were logged across different employees.\n\n`;
    } else {
      // Top Shared Task Clusters
      response += `━━━━━━━━━━━━━━━━━━━━\n`;
      response += `### 🏢 Top Shared Task Clusters (Same Task Logged by Multiple Staff):\n`;
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
      response += `━━━━━━━━━━━━━━━━━━━━\n`;
      response += `### 👥 Staff Involved in Shared Task Clusters:\n`;
      audit.staffSummary.slice(0, 6).forEach((s, idx) => {
        response += `${idx + 1}. **${s.name}** (${s.categoryRole} • ${s.department}) — **${s.totalSharedEntries} Shared Entries** across **${s.distinctClustersCount} Clusters**\n`;
        response += `   • 🤝 **Frequent Co-Workers**: ${s.topCoWorkers}\n`;
      });
      response += `\n`;
    }

    response += `📥 **Report Download**: Click below to download the official 4-sheet Excel workbook tracking Month Tasks, Cluster Overview, Staff Involvement, and All-Time Cross-Employee Register:\n\n`;
    response += `[DOWNLOAD_CROSS_EMPLOYEE_DUPLICATES_EXCEL]`;
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

    // Current month tasks
    const curMonthLabel = getCurrentMonthLabel();
    const curMonthEntries = empEntries.filter((e) => isEntryInMonth(e.date, curMonthLabel));
    const curMonthDays = new Set(curMonthEntries.map((e) => formatExcelOrStringDate(e.date))).size;

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
    res += `📊 **3. Monthly & Historical Work Profile**:\n`;
    res += `• 🗓️ **This Month (${curMonthLabel})**: **${curMonthEntries.length} tasks** logged across **${curMonthDays} days**\n`;
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

    // 2.4 PMS FMS SPECIALIZED INTELLIGENCE
    const isExplicitWorkingQuery =
      q.includes("daily working") ||
      q.includes("working sheet") ||
      q.includes("work log") ||
      q.includes("task description");
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

    // 2.5 INTERNAL AUDIT FMS SPECIALIZED INTELLIGENCE
    // A0. Employees with Blank Actual and Status fields
    const isBlankActualStatus =
      (q.includes("actual") && q.includes("status")) ||
      (q.includes("blank") && (q.includes("actual") || q.includes("status") || q.includes("audit") || q.includes("fms") || q.includes("field"))) ||
      (q.includes("both are blank") || q.includes("both blank"));

    if (isBlankActualStatus) {
      return getBlankActualAndStatusSummary(internalAudits);
    }

    // A. The 17 Steps SOP Protocol
    if (
      q.includes("17 step") ||
      q.includes("fms step") ||
      q.includes("steps of internal audit") ||
      q.includes("internal audit step") ||
      q.includes("audit step") ||
      q.includes("audit procedure") ||
      q.includes("fms sop") ||
      q.includes("ia step")
    ) {
      return get17StepsGuideReport();
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
      cleanQ === "fms" ||
      cleanQ === "internal audit fms" ||
      cleanQ === "ia" ||
      cleanQ === "audit"
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
      return generateAiAndClaudeUsageReport(workingLogs);
    }

    if (isMoreThanTwoDaysQuery(q)) {
      return generateUnsubmittedMoreThanTwoDaysReport(profiles);
    }

    if (isLessThanNineHoursQuery(q)) {
      return generateLessThanNineHoursReport(workingLogs, profiles, query);
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
      if (q.includes("pms") || q.includes("performance management") || q.includes("process management")) {
        if (q.includes("blank") || (q.includes("actual") && q.includes("status"))) {
          return `🚨 **PMS Blank Actual & Status Report Download**:\n\nClick below to download the Excel workbook of PMS assignments where actual completion date and status fields are both blank:\n\n[DOWNLOAD_PMS_BLANK_ACTUAL_STATUS_EXCEL]`;
        }
        return `📋 **PMS FMS Register Download**:\n\nClick below to download the complete multi-tab PMS Excel workbook with client/process assignments and the 17-step workflow:\n\n[DOWNLOAD_PMS_EXCEL]`;
      }
      if (q.includes("blank") || (q.includes("actual") && q.includes("status"))) {
        return `🚨 **Blank Actual & Status Report Download**:\n\nClick below to download the official Excel workbook of employees who have actual and status field both blank:\n\n[DOWNLOAD_BLANK_ACTUAL_STATUS_EXCEL]`;
      }
      if (
        isCrossEmployeeDuplicateQuery(q) ||
        (q.includes("different") && (q.includes("employee") || q.includes("staff") || q.includes("name")))
      ) {
        return `👥 **Same Task Across Different Employees Report Download**:\n\nClick below to download the official multi-tab Excel workbook tracking identical work logged across multiple employees with cluster breakdown, staff involvement register, and all-time log:\n\n[DOWNLOAD_CROSS_EMPLOYEE_DUPLICATES_EXCEL]`;
      }
      if (q.includes("audit") || q.includes("fms") || q.includes("ia")) {
        return `📥 **Internal Audit FMS Register Download**:\n\nClick below to download the complete multi-tab Excel workbook with all 89 client assignments across 46 corporate groups and the 17-step SOP:\n\n[DOWNLOAD_INTERNAL_AUDIT_EXCEL]`;
      }
      if (q.includes("duplic") || q.includes("repeat")) {
        return `📥 **Duplicacy Audit Report Download**:\n\nClick below to download the row-by-row Excel register:\n\n[DOWNLOAD_DUPLICACY_BUTTON:CURRENT]`;
      }
      if (q.includes("ai") || q.includes("claude")) {
        return `📥 **AI & Claude Usage Report Download**:\n\nClick below to download the AI usage audit workbook:\n\n[DOWNLOAD_AI_REPORT_BUTTON]`;
      }
      if (q.includes("2 day") || q.includes("two day") || q.includes("> 2")) {
        return `📥 **Staff Not Filled > 2 Days Report Download**:\n\nClick below to download the official defaulters report:\n\n[DOWNLOAD_TWO_DAYS_DEFAULTERS_BUTTON]`;
      }
      if (q.includes("9 hour") || q.includes("9 hr") || q.includes("less than 9") || q.includes("under 9")) {
        return `⏱️ **Employees with Less Than 9 Hours Report Download**:\n\nClick below to download the official Excel register with daily shortfall log, employee summary, and live status:\n\n[DOWNLOAD_LESS_THAN_9_HOURS_EXCEL]`;
      }
      if (q.includes("working") || q.includes("task") || q.includes("diary")) {
        return `📥 **Daily Working Reports Download**:\n\nChoose your desired format below:\n\n[DOWNLOAD_DAILY_WORKING_BUTTONS]`;
      }
      if (q.includes("weekly")) {
        return `📥 **Weekly Attendance Report Download (${activeWeeklyData?.weekRange || "Past 7 Days"})**:\n\n[DOWNLOAD_WEEKLY_BUTTONS]`;
      }
      if (q.includes("monthly")) {
        return `📥 **Monthly Attendance Register Download (${activeMonthlyData?.monthName || "Current Month"})**:\n\n[DOWNLOAD_MONTHLY_BUTTONS]`;
      }
      // General download card
      return `📥 **Download Executive Reports (Attendance & Daily Working)**:\n\nChoose any report to download immediately in Excel (.xlsx) or PDF (.pdf):\n\n[DOWNLOAD_ALL_BUTTONS]`;
    }

    // 6. Monthly Attendance Queries
    const isMonthlyQuery =
      /\b(monthly|month|october|this month|current month|whole month|entire month)\b/i.test(q) ||
      /\b(in\s+month|for\s+the\s+month|month's)\b/i.test(q);

    if (isMonthlyQuery && !q.includes("duplic") && !q.includes("working task")) {
      if (!activeMonthlyData || !activeMonthlyData.monthlySummaries || activeMonthlyData.monthlySummaries.length === 0) {
        return `📊 **Monthly Attendance Register is connecting to Google Sheet...**\n\nSyncing latest biometric and sheet records for current month. Please try again in 2-3 seconds or visit the **Attendance Report** page.`;
      }

      const summaries = activeMonthlyData.monthlySummaries;
      const workingDays = activeMonthlyData.workingDaysCount || 26;
      const totalStaff = summaries.length;
      const avgPct = Math.round(summaries.reduce((acc, cur) => acc + (cur.attendancePct || 0), 0) / (totalStaff || 1));
      const totalLateLogs = summaries.reduce((acc, cur) => acc + (cur.lateDays || 0), 0);
      const totalAbsentDays = summaries.reduce((acc, cur) => acc + (cur.daysAbsent || 0), 0);

      const allLateStaff = summaries.filter((e) => (e.lateDays || 0) > 0);
      const allAbsentStaff = summaries.filter((e) => (e.daysAbsent || 0) > 0);

      const top5 = [...summaries].sort((a, b) => (b.attendancePct || 0) - (a.attendancePct || 0)).slice(0, 5);
      const topStr = top5
        .map((e, idx) => `  ${idx + 1}. **${e.employee}** [${e.categoryShort}] — **${e.attendancePct}%** (${e.daysPresent} present / ${e.totalDays} days • ${e.totalWorkingHours})`)
        .join("\n");

      return `📊 **Monthly Attendance Register Overview (${workingDays} Working Days)**:\n\n• 👥 **Total Staff Evaluated**: **${totalStaff} employees**\n• 📈 **Firm Average Attendance Rate**: **${avgPct}%**\n• ⏰ **Total Late Logs Recorded**: **${totalLateLogs}** (${allLateStaff.length} employees with late logs)\n• ❌ **Total Absent Days Recorded**: **${totalAbsentDays}** (${allAbsentStaff.length} employees with absences)\n• 🔗 **Source**: [Monthly Google Sheet](${MONTHLY_GOOGLE_SHEET_URL})\n\n━━━━━━━━━━━━━━━━━━━━\n🏆 **Top Consistent Employees This Month**:\n${topStr}\n\n👇 **Download Monthly Reports:**\n[DOWNLOAD_MONTHLY_BUTTONS]`;
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

      return `👑 **AJC Executive Briefing for MD Sir**\n• 📅 **Date**: ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n\n### ⏰ 1. Live Attendance Status:\n• 👥 **Total Staff**: **${total} employees** | ✅ **Present**: **${present.length}** (🌅 ${allEarly.length} early, 🟡 ${allWithinGrace.length} in grace)\n• ⏰ **Late Arrivals (> Grace)**: **${allLate.length}** | ❌ **Absent**: **${absent.length}** | 🏢 **Client Sites**: **${atClient.length}**\n${allLate.length > 0 ? `\n**Top Late Arrivals**:\n${lateList}\n` : ""}\n• 👔 **Seniors**: ${senior.present.length}/${senior.total} In | 🤝 **Partners**: ${partner.present.length}/${partner.total} In | 📚 **Articles**: ${article.present.length}/${article.total} In | 🏭 **Plant**: ${plant.present.length}/${plant.total} In\n\n### 📝 2. Daily Working Submission Status:\n• 📊 **Work Submitted Today**: **${workingKpis.workSubmitted} staff** (${workingKpis.submissionRate}% of present staff)\n• ⚠️ **Present on Punch but Work Pending**: **${workingKpis.presentWithoutWork.length} staff**\n• 🚨 **Historical Missing Dates Backlog**: **${workingKpis.withMissingDates.length} staff** (${workingKpis.totalMissingInstances} total instances)\n\n### 📑 3. Internal Audit FMS & PMS FMS Intelligence:\n• 🏢 **Internal Audit FMS**: **${internalAudits.length || 89} engagements** across 46 corporate groups (**17-Step FMS**)\n• 📋 **PMS FMS (Process Management)**: **${pmsRecords.length} active entries** tracked across the **17-Step PMS Workflow** (${pmsRecords.length === 0 ? "connect live sheet via ⚙️ API Config or add entries in PMS Form" : "synced with Portal/Sheet"})\n• 🏭 **Coverage Split**: Plant vs City assignments tracked by Partner & Lead CA\n\n### 🔍 4. Executive Audit Shortcuts:\n• Ask: *"Internal audit FMS status"* or *"PMS status"* or *"Explain 17 steps of PMS"*\n• Ask: *"Duplicacy in October"* for row-by-row 6-field duplicate task check\n• Ask: *"Uses of AI or Claude in daily working"*\n• Ask: *"Staff not filled daily working > 2 days"*\n\n👇 **Download Today's Executive Reports:**\n[DOWNLOAD_ALL_BUTTONS]`;
    }

    // Fallback friendly answer
    return `🔍 **Executive Intelligence for "${query}"**:\n\n• **Total Registered Staff**: ${total}\n• **Present Today**: ${present.length} (🌅 ${allEarly.length} early, 🟡 ${allWithinGrace.length} in grace)\n• **Late Today**: ${allLate.length} (Counted from category grace time)\n• **Daily Working Submitted Today**: ${workingKpis.workSubmitted} staff\n• **Internal Audit Assignments**: ${internalAudits.length || 89} client engagements (17-Step FMS)\n• **PMS FMS Entries**: ${pmsRecords.length} active PMS entries (17-Step FMS)\n\n*💡 Try asking about specific audits:* \n- 📊 *"Internal audit FMS status"* or *"PMS FMS status"*\n- 📋 *"Explain the 17 steps of PMS"* or *"PMS blank actual and status"*\n- 👔 *"Audits assigned to CA Harsh Mittal"*\n- 🔍 *"Duplicacy in October"*\n- 🤖 *"AI or Claude usage"*\n- 🚨 *"Not filled > 2 days"*\n- ⏰ *"Who is late today?"*\n- 👤 *"Show 360 report for CA Harsh Mittal"*\n\n👇 **Download Reports:**\n[DOWNLOAD_ALL_BUTTONS]`;
  };

  // --- OPENAI API CALL (FALLS BACK TO LOCAL ON ERROR/TIMEOUT) ---
  const callOpenAI = async (userPrompt) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const systemPrompt = `You are an AI Executive Assistant for Agrawal Jain & Co. (a Chartered Accountancy firm) for the Managing Director.
You analyze real-time attendance report data, daily working submissions, duplicacy audits, missing date backlogs, statutory HR compliance, Internal Audit Flow Management System (FMS), and Process Management System (PMS FMS).

INTERNAL AUDIT FMS & PMS FMS PROTOCOL:
- Internal Audit FMS: 89 client assignments across 46 corporate groups (City audits and Plant audits).
- PMS FMS: ${pmsRecords.length} loaded assignments in the 17-Step PMS Flow Management System (configurable live Google Apps Script API + in-portal PMS entries), tracking Group, Client/Company, Dept, Period, Partner, Senior/Lead CA, Assignment Type, Start & Target Dates, and 17 execution steps (Planned, Actual, Status, Delay).
- Key Partners: CA Ankit Kumar Garg, CA Rupesh Vaid, CA Mukul Jain.
- Key Seniors / Lead CAs: CA Harsh Mittal, CA Chandan Singh, CA Kanha Kedia, CA Pankaj Agrawal, CMA Akash Choubey, CMA Pratibha Agrawal, CA Drishti Chandnani, CA Vikas Goyal, etc.
- 17-Step FMS SOP:
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
    const hasMonthlyButtons = text.includes("[DOWNLOAD_MONTHLY_BUTTONS]");
    const hasDailyWorkingButtons = text.includes("[DOWNLOAD_DAILY_WORKING_BUTTONS]");
    const hasAiUsageButton = text.includes("[DOWNLOAD_AI_REPORT_BUTTON]");
    const hasTwoDaysButton = text.includes("[DOWNLOAD_TWO_DAYS_DEFAULTERS_BUTTON]");
    const hasDefaultersButton = text.includes("[DOWNLOAD_DEFAULTERS_BUTTON]");
    const hasInternalAuditButton = text.includes("[DOWNLOAD_INTERNAL_AUDIT_EXCEL]");
    const hasBlankActualStatusButton = text.includes("[DOWNLOAD_BLANK_ACTUAL_STATUS_EXCEL]");
    const hasPmsButton = text.includes("[DOWNLOAD_PMS_EXCEL]");
    const hasPmsBlankActualStatusButton = text.includes("[DOWNLOAD_PMS_BLANK_ACTUAL_STATUS_EXCEL]");
    const hasLessThanNineHoursButton = text.includes("[DOWNLOAD_LESS_THAN_9_HOURS_EXCEL]");
    const hasCrossEmployeeDuplicatesButton = text.includes("[DOWNLOAD_CROSS_EMPLOYEE_DUPLICATES_EXCEL]");

    const dupeMatch = text.match(/\[DOWNLOAD_DUPLICACY_BUTTON:(.*?)\]/);
    const targetDupeMonth = dupeMatch ? dupeMatch[1] : null;

    const actionChipsMatch = text.match(/\[ACTION_CHIPS:(.*?)\]/);
    const actionChipsStr = actionChipsMatch ? actionChipsMatch[1] : null;

    const cleanText = text
      .replace(/\[DOWNLOAD_ALL_BUTTONS\]/g, "")
      .replace(/\[DOWNLOAD_DAILY_BUTTONS\]/g, "")
      .replace(/\[DOWNLOAD_WEEKLY_BUTTONS\]/g, "")
      .replace(/\[DOWNLOAD_MONTHLY_BUTTONS\]/g, "")
      .replace(/\[DOWNLOAD_DAILY_WORKING_BUTTONS\]/g, "")
      .replace(/\[DOWNLOAD_AI_REPORT_BUTTON\]/g, "")
      .replace(/\[DOWNLOAD_TWO_DAYS_DEFAULTERS_BUTTON\]/g, "")
      .replace(/\[DOWNLOAD_DEFAULTERS_BUTTON\]/g, "")
      .replace(/\[DOWNLOAD_INTERNAL_AUDIT_EXCEL\]/g, "")
      .replace(/\[DOWNLOAD_BLANK_ACTUAL_STATUS_EXCEL\]/g, "")
      .replace(/\[DOWNLOAD_PMS_EXCEL\]/g, "")
      .replace(/\[DOWNLOAD_PMS_BLANK_ACTUAL_STATUS_EXCEL\]/g, "")
      .replace(/\[DOWNLOAD_LESS_THAN_9_HOURS_EXCEL\]/g, "")
      .replace(/\[DOWNLOAD_CROSS_EMPLOYEE_DUPLICATES_EXCEL\]/g, "")
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
        {hasInternalAuditButton && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              onClick={handleDownloadInternalAuditExcel}
              disabled={isExporting}
            >
              📊 Download Internal Audit FMS Register (.xlsx)
            </button>
          </div>
        )}

        {/* Blank Actual & Status Button */}
        {hasBlankActualStatusButton && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              onClick={handleDownloadBlankActualStatusExcel}
              disabled={isExporting}
            >
              🚨 Download Blank Actual &amp; Status Report (.xlsx)
            </button>
          </div>
        )}

        {/* PMS FMS Button */}
        {hasPmsButton && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              style={{ background: "#4338ca", borderColor: "#4338ca", color: "#fff" }}
              onClick={handleDownloadPmsExcel}
              disabled={isExporting}
            >
              📋 Download PMS FMS Register (.xlsx)
            </button>
          </div>
        )}

        {/* PMS Blank Actual & Status Button */}
        {hasPmsBlankActualStatusButton && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              style={{ background: "#4338ca", borderColor: "#4338ca", color: "#fff" }}
              onClick={handleDownloadPmsBlankActualStatusExcel}
              disabled={isExporting}
            >
              🚨 Download PMS Blank Actual &amp; Status Report (.xlsx)
            </button>
          </div>
        )}

        {/* Less Than 9 Hours Button */}
        {hasLessThanNineHoursButton && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              onClick={handleDownloadLessThan9HoursExcel}
              disabled={isExporting}
            >
              ⏱️ Download Employees &lt; 9 Hours Report (.xlsx)
            </button>
          </div>
        )}

        {/* Cross-Employee Same Task Duplicate Button */}
        {hasCrossEmployeeDuplicatesButton && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              style={{ background: "#d97706", borderColor: "#d97706", color: "#fff" }}
              onClick={() => handleDownloadCrossEmployeeDuplicatesExcel()}
              disabled={isExporting}
            >
              👥 Download Same Task Across Employees Report (.xlsx)
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
        {hasMonthlyButtons && (
          <div className="chat-inline-download-buttons">
            <button className="chat-dl-btn excel" onClick={handleDownloadMonthlyAttendanceExcel} disabled={isExporting}>
              📈 Monthly Attendance Excel
            </button>
            <button className="chat-dl-btn pdf" onClick={handleDownloadMonthlyAttendancePDF} disabled={isExporting}>
              📄 Monthly Attendance PDF
            </button>
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
                  🚨 Blank Actual &amp; Status
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
                  🚨 PMS Blank Actual &amp; Status
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
                        <small>89 client engagements &amp; 17 FMS steps SOP</small>
                      </div>
                    </button>
                    <button className="export-dropdown-item excel" onClick={handleDownloadBlankActualStatusExcel} disabled={isExporting}>
                      <span className="export-item-icon">🚨</span>
                      <div className="export-item-info">
                        <strong>Blank Actual &amp; Status Report (.xlsx)</strong>
                        <small>Employees with pending fieldwork &amp; FMS updates</small>
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
                        <small>PMS assignments with blank actual &amp; status</small>
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
              onClick={() => handleSend("Explain the 17 steps of internal audit FMS")}
              className="chip-btn chip-audit"
            >
              📋 17 FMS Steps
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
          </div>

          {/* Input Box */}
          <div className="executive-input-container">
            <input
              type="text"
              placeholder="Ask about PMS FMS, Internal Audit FMS, 17 steps, duplicacy, AI usage, attendance..."
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
