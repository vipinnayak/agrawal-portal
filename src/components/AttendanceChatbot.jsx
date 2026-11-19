import React, { useState, useEffect, useRef, useMemo } from "react";
import "./AttendanceChatbot.css";
import {
  EMPLOYEE_MASTER_API,
  DEFAULT_SHIFT_POLICIES,
  INDIVIDUAL_EMPLOYEE_SHIFTS,
  getEmployeeCategoryInfo,
  normalizeName,
  formatLateDuration,
  formatWorkingHours,
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
import { parseTargetMonthFromQuery } from "../utils/dailyWorkingService";
import {
  getHRLabourLawAnswer,
  HR_LABOUR_LAW_SYSTEM_PROMPT,
} from "../utils/hrLabourLawKnowledge";

// Helper to add minutes to 24-hr time string (e.g. "10:00" + 5 -> "10:05")
const addMinutesToTime = (timeStr, minutesToAdd = 5) => {
  if (!timeStr) return "";
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return timeStr;
  const total = parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + minutesToAdd;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// Helper: Accurately lookup employee record in Monthly or Weekly summaries
// Prioritizes strict exact match to avoid collisions between identically or partially named staff
// (e.g. "Akshita" in Back Office vs "Akshita Agrawal" in Articles)
export const findExactOrBestRecord = (list, empName) => {
  if (!Array.isArray(list) || !empName) return null;
  const cleanTarget = normalizeName(empName);
  if (!cleanTarget) return null;

  // 1. Strict exact match (Highest Priority)
  const exact = list.find((item) => normalizeName(item.employee) === cleanTarget);
  if (exact) return exact;

  // 2. Strict single-word vs multi-word boundary check
  // Single word target (e.g. "akshita") must NOT match multi-word names like "Akshita Agrawal"
  const targetWords = cleanTarget.split(" ").filter(Boolean);
  if (targetWords.length === 1) {
    const singleMatch = list.find((item) => {
      const itemWords = normalizeName(item.employee).split(" ").filter(Boolean);
      return itemWords.length === 1 && itemWords[0] === targetWords[0];
    });
    if (singleMatch) return singleMatch;
  } else {
    // Multi-word target (e.g. "akshita agrawal")
    const allWordsMatch = list.find((item) => {
      const itemClean = normalizeName(item.employee);
      return targetWords.every((w) => itemClean.includes(w));
    });
    if (allWordsMatch) return allWordsMatch;
  }

  // 3. Fallback: only if no collision between distinct known staff with shared names
  return list.find((item) => {
    const clean = normalizeName(item.employee);
    // Explicit protection: Never cross-match "Akshita Agrawal" if target is strictly "Akshita"
    if (cleanTarget === "akshita" && (clean.includes("agrawal") || clean.includes("agrwal"))) {
      return false;
    }
    return clean === cleanTarget || clean.includes(cleanTarget) || cleanTarget.includes(clean);
  });
};

export default function AttendanceChatbot({
  rows = [],
  weeklyData = null,
  monthlyData = null,
  activeTab = "daily",
  selectedEmployee = null,
  onClearSelectedEmployee = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    {
      id: 1,
      sender: "bot",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: `👋 Hello! I am your **AJC Attendance AI Assistant**.\n\nI monitor and analyze attendance across **Daily, Weekly & Monthly** periods:\n- 👑 **MD (Rajesh Agrawal)**: Cut-off **10:00 AM** (Grace: **10:05 AM**)\n- 🤝 **Partners**: Cut-off **10:00 AM** (Grace: **10:05 AM**)\n- 👔 **Seniors**: Cut-off **10:00 AM** (Grace: **10:05 AM**)\n- 🏭 **Plant Audit Staff**: Cut-off **10:30 AM** (Grace: **10:35 AM**)\n- 📚 **Articles**: Cut-off **11:00 AM** (Grace: **11:05 AM**)\n- 🏢 **Back Office**: Cut-off **10:00 AM** (Grace: **10:05 AM**)\n\nTry asking:\n- *"Who is late today?"*\n- *"Show monthly attendance summary"*\n- *"Show plant audit staff status"*\n- *"Who logged in early before cut-off time today?"*\n- *"Show weekly absent employees list"*`,
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // OpenAI API Key
  const [apiKey, setApiKey] = useState(() => {
    return (
      localStorage.getItem("openai_api_key") ||
      process.env.REACT_APP_OPENAI_API_KEY ||
      ""
    );
  });

  // Category Shift Policies (Keyed to v5 to ensure separate MD, Partners and Seniors take effect immediately)
  const [shiftPolicies, setShiftPolicies] = useState(() => {
    try {
      const saved =
        localStorage.getItem("ajc_shift_policies_v5") ||
        localStorage.getItem("ajc_shift_policies_v4") ||
        localStorage.getItem("ajc_shift_policies_v3");
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SHIFT_POLICIES, ...parsed };
      }
    } catch (e) {
      console.warn("Could not load saved shift policies, using defaults", e);
    }
    return DEFAULT_SHIFT_POLICIES;
  });

  // Settings Panel state
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [tempPlantCutoff, setTempPlantCutoff] = useState(shiftPolicies.PLANT_AUDIT?.cutoff || "10:30");
  const [tempArticleCutoff, setTempArticleCutoff] = useState(shiftPolicies.ARTICLE?.cutoff || "11:00");
  const [tempOfficeCutoff, setTempOfficeCutoff] = useState(shiftPolicies.BACK_OFFICE?.cutoff || "10:00");
  const [tempSeniorCutoff, setTempSeniorCutoff] = useState(
    shiftPolicies.SENIOR?.cutoff || shiftPolicies.SENIOR_PARTNER_MD?.cutoff || "10:00"
  );
  const [tempPartnerCutoff, setTempPartnerCutoff] = useState(shiftPolicies.PARTNER?.cutoff || "10:00");
  const [tempMDCutoff, setTempMDCutoff] = useState(shiftPolicies.MD?.cutoff || "10:00");

  // Dynamic Employee-to-Department mapping fetched from EmployeeMaster API
  const [dynamicDeptMap, setDynamicDeptMap] = useState(() => new Map());

  // Download / Export dropdown & status states
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef(null);

  const messagesEndRef = useRef(null);

  // Fetch Employee Master on mount to keep category mapping auto-updated
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
            if (clean) {
              map.set(clean, emp.Department || "");
            }
          }
        });
        setDynamicDeptMap(map);
      })
      .catch((err) => {
        console.warn("Could not fetch EmployeeMaster for dynamic categorization, using seeds:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const [internalRows, setInternalRows] = useState(() => {
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
        if (parsed && parsed.monthlySummaries && parsed.monthlySummaries.length > 0) return parsed;
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
        if (parsed && parsed.list && parsed.list.length > 0) return parsed;
      }
    } catch (_) {}
    return null;
  });

  // Sync daily rows from props or fetch from daily card punch API
  useEffect(() => {
    if (rows && rows.length > 0) {
      setInternalRows(rows);
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
            setInternalRows(valid);
            try {
              localStorage.setItem("ajc_cached_attendance_rows", JSON.stringify(valid));
            } catch (_) {}
          }
        })
        .catch((err) => console.warn("AttendanceChatbot self-fetch error:", err));
      return () => {
        isMounted = false;
      };
    }
  }, [rows]);

  // Sync or auto-fetch monthly & weekly attendance data when not passed via props
  useEffect(() => {
    if (monthlyData && monthlyData.monthlySummaries && monthlyData.monthlySummaries.length > 0) {
      setInternalMonthlyData(monthlyData);
    }
    if (weeklyData && weeklyData.list && weeklyData.list.length > 0) {
      setInternalWeeklyData(weeklyData);
    }

    if (!monthlyData || !weeklyData) {
      let isMounted = true;
      fetchMonthlyAttendance({
        dailyRows: internalRows,
        dynamicDeptMap,
        shiftPolicies,
      })
        .then((res) => {
          if (!isMounted || !res) return;
          if (!monthlyData && res.monthlySummaries && res.monthlySummaries.length > 0) {
            setInternalMonthlyData(res);
            cacheMonthlyAttendanceSafely(res);
          }
          if (!weeklyData && res.weeklySummaries && res.weeklySummaries.length > 0) {
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
        .catch((err) => console.warn("AttendanceChatbot self-fetch monthly/weekly error:", err));

      return () => {
        isMounted = false;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyData, weeklyData, internalRows.length, dynamicDeptMap.size, shiftPolicies]);

  const activeMonthlyData = monthlyData || internalMonthlyData;
  const activeWeeklyData = weeklyData || internalWeeklyData;

  // Filter valid employee records
  const validRows = useMemo(() => {
    return internalRows.filter((r) => r && r.Employee && r.Employee.trim() !== "");
  }, [internalRows]);

  // Stop words for identifying whether query targets an individual employee
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
        "work", "working", "works", "worked",
        "client", "clients", "office", "site", "sites", "place", "places", "location", "locations",
        "at", "to", "for", "from", "of", "with", "by", "on", "about", "into", "onto",
        "tell", "show", "give", "find", "get", "view", "display", "provide", "share",
        "me", "please", "sir", "madam", "mam", "hello", "hi", "hey", "good", "morning", "afternoon", "evening",
        "time", "cutoff", "cut", "off", "grace", "period",
        "plant", "audit", "article", "articles", "back", "backoffice",
        "senior", "seniors", "partner", "partners", "md", "director", "management",
        "individual", "want", "like", "need", "i", "namy", "days", "day", "too", "also", "their", "his", "her", "see", "info", "information", "regarding",
        // Hinglish & Hindi common keywords
        "aaj", "aajka", "aajki", "kal", "kalka", "parso", "abhi",
        "kaun", "koun", "kisko", "kiska", "kiski", "kitne", "kitna", "kitni", "kya", "kab", "kaha", "kyu", "kyun", "kaise",
        "batao", "bataiye", "dikhao", "dikhaye", "dikhiye", "bhejo", "do", "dijiye", "karo", "kariye", "hai", "hain", "tha", "the", "thi", "hoga", "honge",
        "aaya", "aaye", "aayi", "aana", "pahucha", "pahuchi", "pahuche", "log", "logo", "sab", "sabka", "sabhi", "saara", "poora",
        "chutti", "anupasthit", "upasthit", "der", "samay", "waqt", "kaisa", "kaisi", "kaise", "ai", "bot"
      ]),
    []
  );

  // Helper: Normalize string
  const cleanString = (str) =>
    (str || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  // Helper: Remove professional designation prefixes
  const removeDesignation = (str) =>
    str.replace(/^(ca|cma|cs|adv|mr|mrs|ms|dr|sr)\b[\s-]*/i, "").trim();

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

  // Helper: Format time to readable 12-hour format with AM/PM
  const formatDisplayTime = (timeStr) => {
    if (!timeStr) return "";
    if (typeof timeStr === "string") {
      const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2];
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        const hStr = h < 10 ? `0${h}` : `${h}`;
        return `${hStr}:${m} ${ampm}`;
      }
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return timeStr;
    }
    return String(timeStr);
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

  // Evaluate single employee record with category policy (LATE MINUTES COUNTED FROM GRACE TIME)
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
      // Sundays are weekly off, NOT absent!
      const isAbsent = !isPresent && !isTodaySunday;
      const inMinutes = parseTimeToMinutes(inTime);
      const outMinutes = parseTimeToMinutes(outTime);

      // Early login before official cut-off time
      const isEarly = isPresent && inMinutes !== null && inMinutes < thresholdMinutes;
      const minutesEarly = isEarly ? thresholdMinutes - inMinutes : 0;
      const earlyDuration = isEarly ? formatLateDuration(minutesEarly) : "0 mins";

      // Late counting rule: An employee is late only if punched after grace time.
      // Late minutes are counted from the grace time!
      const isLate = isPresent && inMinutes !== null && inMinutes > graceMinutes;
      const isWithinGrace = isPresent && inMinutes !== null && inMinutes > thresholdMinutes && inMinutes <= graceMinutes;
      const minutesLate = isLate ? inMinutes - graceMinutes : 0;
      const lateDuration = formatLateDuration(minutesLate);

      // Working hours calculation
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

  // Intelligent Employee Matcher
  const findMatchingEmployees = (query, rows) => {
    const cleanQ = cleanString(query);

    // Extract any negated phrases like "not akshita agrawal", "except xyz", "without abc"
    const negatedPhrases = [];
    const negRegex = /\b(?:not|except|excluding|other than|without)\s+([a-z0-9]+(?:\s+[a-z0-9]+)*?)(?=\s+(?:in|for|the|both|and|datas|data|is|are|weekly|monthly|late|absent)|$)/gi;
    let match;
    while ((match = negRegex.exec(cleanQ)) !== null) {
      if (match[1] && match[1].trim()) {
        negatedPhrases.push(cleanString(match[1]));
      }
    }

    // Build positive query by removing negated phrases
    let positiveQ = cleanQ;
    negatedPhrases.forEach((neg) => {
      positiveQ = positiveQ.replace(
        new RegExp(`\\b(?:not|except|excluding|other than|without)\\s+${neg}\\b`, "gi"),
        " "
      );
    });
    positiveQ = positiveQ.replace(/\s+/g, " ").trim();

    const qWords = positiveQ.split(" ").filter(Boolean);
    const contentWords = Array.from(new Set(qWords.filter((w) => !STOP_WORDS.has(w) && w !== "not")));

    const results = [];

    const isEmployeeNegated = (cleanEmp) => {
      return negatedPhrases.some((neg) => {
        if (cleanEmp === neg || cleanEmp.includes(neg)) return true;
        if (
          (neg.includes("agrawal") || neg.includes("agrwal")) &&
          (cleanEmp.includes("agrawal") || cleanEmp.includes("agrwal"))
        ) {
          return true;
        }
        return false;
      });
    };

    const scoreEmployee = (rawName) => {
      const cleanEmp = cleanString(rawName);
      if (isEmployeeNegated(cleanEmp)) return 0;

      const noTitleEmp = removeDesignation(cleanEmp);
      const empWords = noTitleEmp.split(" ").filter((w) => w.length >= 2);
      const contentStr = contentWords.join(" ");

      let score = 0;

      if (positiveQ === cleanEmp || positiveQ === noTitleEmp || contentStr === cleanEmp || contentStr === noTitleEmp) {
        score = 100;
      } else if (empWords.length === 1 && contentWords.length === 1 && contentWords[0] === empWords[0]) {
        score = 100;
      } else if (empWords.length > 0 && empWords.every((w) => contentWords.includes(w))) {
        const extraWords = contentWords.length - empWords.length;
        if (extraWords === 0) {
          score = 98;
        } else {
          score = Math.max(60, 75 - extraWords * 10);
        }
      } else if (positiveQ.includes(cleanEmp) && cleanEmp.length > 3) {
        const isWordBoundary = new RegExp(`\\b${cleanEmp}\\b`).test(positiveQ);
        const hasUnmatchedContent = contentWords.some((w) => !empWords.includes(w));
        if (hasUnmatchedContent && empWords.length < contentWords.length) {
          score = 70;
        } else {
          score = (isWordBoundary ? 92 : 88) + Math.min(cleanEmp.length, 8);
        }
      } else if (positiveQ.includes(noTitleEmp) && noTitleEmp.length > 3) {
        const isWordBoundary = new RegExp(`\\b${noTitleEmp}\\b`).test(positiveQ);
        const hasUnmatchedContent = contentWords.some((w) => !empWords.includes(w));
        if (hasUnmatchedContent && empWords.length < contentWords.length) {
          score = 65;
        } else {
          score = (isWordBoundary ? 87 : 83) + Math.min(noTitleEmp.length, 8);
        }
      } else if (contentWords.length > 0 && contentWords.every((w) => empWords.includes(w))) {
        score = 75;
      } else {
        let matchedCount = 0;
        for (const cw of contentWords) {
          if (empWords.includes(cw)) {
            matchedCount++;
          }
        }
        if (matchedCount > 0) {
          score = 50 + matchedCount * 10;
        }
      }
      return score;
    };

    for (const row of rows) {
      if (!row || !row.Employee) continue;
      const rawName = row.Employee.trim();
      if (!rawName) continue;

      const score = scoreEmployee(rawName);
      if (score >= 50) {
        results.push({ row, score });
      }
    }

    if (results.length === 0 && activeMonthlyData?.monthlySummaries?.length > 0) {
      for (const m of activeMonthlyData.monthlySummaries) {
        const rawName = (m.employee || "").trim();
        if (!rawName) continue;

        const score = scoreEmployee(rawName);
        if (score >= 70) {
          results.push({
            row: {
              Employee: m.employee,
              Department: m.department || m.categoryLabel,
              Category: m.categoryKey,
              In: "",
              Out: "",
              ClientPlace: "",
              Location: "",
            },
            score,
          });
        }
      }
    }

    if (results.length > 0) {
      results.sort((a, b) => b.score - a.score);
      const topScore = results[0].score;
      const filtered = results
        .filter((r) => r.score >= topScore - 5)
        .map((r) => r.row);

      const unique = [];
      const seen = new Set();
      for (const r of filtered) {
        const k = r.Employee.trim().toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          unique.push(r);
        }
      }
      return { matches: unique, isQueryTargeted: true, queryName: contentWords.join(" ") };
    }

    const GENERAL_INQUIRY_WORDS = new Set([
      "attendance", "data", "report", "summary", "overview", "status", "insight",
      "today", "todays", "daily", "weekly", "monthly", "aaj", "aajka", "aajki",
      "staff", "employee", "employees", "everyone", "all", "sab", "sabhi", "log", "logo",
      "present", "absent", "late", "early", "work", "hours", "office", "plant",
      "article", "articles", "senior", "seniors", "partner", "partners", "md",
      "download", "excel", "pdf", "sheet", "batao", "dikhao", "karo", "do"
    ]);

    const hasRealNameWord = contentWords.some((w) => !GENERAL_INQUIRY_WORDS.has(w) && w.length >= 3);

    const isExplicitTargetedSyntax =
      /^(tell\s+me\s+about|report\s+for|report\s+of|attendance\s+of|details\s+of|status\s+of|who\s+is|is|where\s+is)\s+[a-z]{3,}/i.test(query.trim());

    const isQueryTargeted = results.length > 0 || (hasRealNameWord && isExplicitTargetedSyntax);

    return { matches: [], isQueryTargeted, queryName: contentWords.join(" ") };
  };

  // Compute metrics from current valid rows
  const attendanceMetrics = useMemo(() => {
    const total = validRows.length;
    const evaluated = validRows.map(evaluateEmployee);

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
    const seniorPartnerMD = getGroupMetrics([...seniorList, ...partnerList, ...mdList]);

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
      seniorPartnerMD,
      evaluated,
    };
  }, [validRows, evaluateEmployee]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Save Settings (API Key & Cutoffs with auto 5-min grace)
  const handleSaveSettings = () => {
    const cleanKey = tempApiKey.trim();
    setApiKey(cleanKey);
    localStorage.setItem("openai_api_key", cleanKey);

    const updatedPolicies = {
      ...shiftPolicies,
      PLANT_AUDIT: {
        ...shiftPolicies.PLANT_AUDIT,
        cutoff: tempPlantCutoff,
        grace: addMinutesToTime(tempPlantCutoff, 5),
      },
      ARTICLE: {
        ...shiftPolicies.ARTICLE,
        cutoff: tempArticleCutoff,
        grace: addMinutesToTime(tempArticleCutoff, 5),
      },
      BACK_OFFICE: {
        ...shiftPolicies.BACK_OFFICE,
        cutoff: tempOfficeCutoff,
        grace: addMinutesToTime(tempOfficeCutoff, 5),
      },
      SENIOR: {
        ...(shiftPolicies.SENIOR || DEFAULT_SHIFT_POLICIES.SENIOR),
        cutoff: tempSeniorCutoff,
        grace: addMinutesToTime(tempSeniorCutoff, 5),
      },
      PARTNER: {
        ...(shiftPolicies.PARTNER || DEFAULT_SHIFT_POLICIES.PARTNER),
        cutoff: tempPartnerCutoff,
        grace: addMinutesToTime(tempPartnerCutoff, 5),
      },
      MD: {
        ...(shiftPolicies.MD || DEFAULT_SHIFT_POLICIES.MD),
        cutoff: tempMDCutoff,
        grace: addMinutesToTime(tempMDCutoff, 5),
      },
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
        text: `✅ **Settings updated successfully!**\n\n• 🏭 **Plant Audit**: Cut-off ${formatCutoffDisplay(tempPlantCutoff)} (Grace: ${formatCutoffDisplay(addMinutesToTime(tempPlantCutoff, 5))})\n• 📚 **Articles**: Cut-off ${formatCutoffDisplay(tempArticleCutoff)} (Grace: ${formatCutoffDisplay(addMinutesToTime(tempArticleCutoff, 5))})\n• 🏢 **Back Office**: Cut-off ${formatCutoffDisplay(tempOfficeCutoff)} (Grace: ${formatCutoffDisplay(addMinutesToTime(tempOfficeCutoff, 5))})\n• 👔 **Seniors**: Cut-off ${formatCutoffDisplay(tempSeniorCutoff)} (Grace: ${formatCutoffDisplay(addMinutesToTime(tempSeniorCutoff, 5))})\n• 🤝 **Partners**: Cut-off ${formatCutoffDisplay(tempPartnerCutoff)} (Grace: ${formatCutoffDisplay(addMinutesToTime(tempPartnerCutoff, 5))})\n• 👑 **MD**: Cut-off ${formatCutoffDisplay(tempMDCutoff)} (Grace: ${formatCutoffDisplay(addMinutesToTime(tempMDCutoff, 5))})\n*(Late minutes are counted from grace time)*\n• ⚡ **AI Engine**: ${cleanKey ? "OpenAI GPT-4o" : "Real-time Local Analytics"}`,
      },
    ]);
  };

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Download Daily Excel (.xlsx)
  const handleDownloadDailyExcel = async () => {
    try {
      setIsExporting(true);
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
          text: `📊 **Daily Excel Report Downloaded!**\n\n• **Format**: Microsoft Excel Workbook (\`.xlsx\`)\n• **Includes**: Real-time KPI summary, category shift cut-offs, today's employee attendance table with working hours, and AI chat log.`,
        },
      ]);
    } catch (err) {
      console.error("Failed to export Daily Excel:", err);
      alert("Failed to export Daily Excel report.");
    } finally {
      setIsExporting(false);
    }
  };

  // Download Daily PDF (.pdf)
  const handleDownloadDailyPDF = () => {
    try {
      setIsExporting(true);
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
          text: `📄 **Daily PDF Report Downloaded!**\n\n• **Format**: Executive Landscape Document (\`.pdf\`)\n• **Includes**: Official Agrawal Jain & Co. branding, KPI cards, category shift reference, and styled employee attendance table.`,
        },
      ]);
    } catch (err) {
      console.error("Failed to export Daily PDF:", err);
      alert("Failed to export Daily PDF report.");
    } finally {
      setIsExporting(false);
    }
  };

  // Download Weekly Excel (.xlsx)
  const handleDownloadWeeklyExcel = async () => {
    try {
      setIsExporting(true);
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
          text: `📊 **Weekly Excel Report Downloaded!**\n\n• **Format**: Microsoft Excel Workbook (\`.xlsx\`)\n• **Period**: ${activeWeeklyData?.weekRange || "Past 7 Days"}\n• **Includes**: Weekly summary metrics (Days Present, Late Days, Absent Days, Hours) and complete Day-by-Day punch log.`,
        },
      ]);
    } catch (err) {
      console.error("Failed to export Weekly Excel:", err);
      alert("Failed to export Weekly Excel report.");
    } finally {
      setIsExporting(false);
    }
  };

  // Download Weekly PDF (.pdf)
  const handleDownloadWeeklyPDF = () => {
    try {
      setIsExporting(true);
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
          text: `📄 **Weekly PDF Report Downloaded!**\n\n• **Format**: Executive Landscape Document (\`.pdf\`)\n• **Period**: ${activeWeeklyData?.weekRange || "Past 7 Days"}\n• **Includes**: Weekly attendance rate %, days present, late instances, and styled executive summary table.`,
        },
      ]);
    } catch (err) {
      console.error("Failed to export Weekly PDF:", err);
      alert("Failed to export Weekly PDF report.");
    } finally {
      setIsExporting(false);
    }
  };

  // Download Monthly Excel (.xlsx)
  const handleDownloadMonthlyExcel = async (scopeOrEvent = "CURRENT") => {
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
          text: `⚠️ **Monthly Excel for ${resolved.requestedLabel || scope} is not available in loaded records.**\n\n• **Available Months**: ${avail || "Syncing from sheet..."}`,
        },
      ]);
      return;
    }

    try {
      setIsExporting(true);
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
          text: `📊 **Monthly Excel Register Downloaded (${resolved.slice.monthName || resolved.slice.calendarMonth?.monthName || scope})!**\n\n• **Format**: Microsoft Excel Workbook (\`.xlsx\`)\n• **Source**: [Monthly Google Sheet](${MONTHLY_GOOGLE_SHEET_URL})\n• **Includes**: Scoped monthly attendance register, working days count, attendance rates %, and daily punch logs.`,
        },
      ]);
    } catch (err) {
      console.error("Failed to export Monthly Excel:", err);
      alert("Failed to export Monthly Excel report.");
    } finally {
      setIsExporting(false);
    }
  };

  // Download Monthly PDF (.pdf)
  const handleDownloadMonthlyPDF = (scopeOrEvent = "CURRENT") => {
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
          text: `⚠️ **Monthly PDF for ${resolved.requestedLabel || scope} is not available in loaded records.**\n\n• **Available Months**: ${avail || "Syncing from sheet..."}`,
        },
      ]);
      return;
    }

    try {
      setIsExporting(true);
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
          text: `📄 **Monthly PDF Register Downloaded (${resolved.slice.monthName || resolved.slice.calendarMonth?.monthName || scope})!**\n\n• **Format**: Executive Landscape Document (\`.pdf\`)\n• **Source**: [Monthly Google Sheet](${MONTHLY_GOOGLE_SHEET_URL})\n• **Includes**: Scoped monthly executive summary KPIs and employee attendance compliance table.`,
        },
      ]);
    } catch (err) {
      console.error("Failed to export Monthly PDF:", err);
      alert("Failed to export Monthly PDF report.");
    } finally {
      setIsExporting(false);
    }
  };

  // Generate answer for individual employee
  const generateIndividualAnswer = (query, matchedEmployees, queryName) => {
    const q = query.toLowerCase();
    const asksLate = /\blate\b/i.test(q);
    const asksAbsent = /\b(absent|not present|not come|didn't come|did not come)\b/i.test(q);
    const asksClient = /\b(client|place|site|location|where)\b/i.test(q);
    const asksEarly = /\b(early|earlier|before cutoff|before cut-off|before time)\b/i.test(q);
    const asksWorkingHours = /\b(working hour|work hour|working hours|work hours|hours worked|worked hours|how long|duration)\b/i.test(q);

    // Helper: Lookup monthly summary record
    const getMonthRecord = (empName) => {
      return findExactOrBestRecord(activeMonthlyData?.monthlySummaries, empName);
    };

    // Helper: Lookup weekly summary record
    const getWeekRecord = (empName) => {
      return findExactOrBestRecord(activeWeeklyData?.list, empName);
    };

    // Helper: Format Late & Absent Summary Block across Month and Week
    const formatSummaryBlock = (empName) => {
      const m = getMonthRecord(empName);
      const w = getWeekRecord(empName);
      const elapsedWorkingDays = activeMonthlyData?.workingDaysCount || 23;
      const totalMonthWorkingDays = activeMonthlyData?.monthCapacityDays || activeMonthlyData?.calendarMonth?.totalWorkingDays || 27;
      const weekRange = activeWeeklyData?.weekRange || "Mon to Sat (Current Week)";
      const weekElapsedDays = activeWeeklyData?.calendarWeek?.elapsedWorkingDays || 2;

      const cleanTarget = normalizeName(empName);
      const isLeadership =
        cleanTarget.includes("rajesh agrawal") ||
        cleanTarget.includes("rupesh vaid") ||
        cleanTarget.includes("ankit kumar garg") ||
        cleanTarget.includes("mukul");

      const monthSection = m
        ? `• 🗓️ **This Month (${activeMonthlyData?.monthName || "October 2026"} - ${m.totalDays || elapsedWorkingDays} Working Days Elapsed so far, out of ${totalMonthWorkingDays} Total)**:\n  - ⏰ **Late Days**: **${m.lateDays || 0} days late**\n  - ❌ **Absent Days**: **${m.daysAbsent || 0} days absent** *(Sundays excluded - Weekly Off)*\n  - ✅ **Days Present**: **${m.daysPresent || 0} days** (${m.attendancePct}% compliance so far)\n  - ⏳ **Hours Worked**: **${m.totalWorkingHours || "N/A"}** (Avg: ${m.avgWorkingHours || "N/A"}/day)`
        : isLeadership
        ? `• 🗓️ **This Month**: *(Executive Leadership — Biometric punch exempt)*`
        : `• 🗓️ **This Month**: *(No punch records found in sheet for this month)*`;

      const weekSection = w
        ? `• 🗓️ **This Week (${weekRange} - ${w.totalDays || weekElapsedDays} Working Days Elapsed so far, out of 6 Days Mon-Sat)**:\n  - ⏰ **Late Days**: **${w.lateDays || 0} days late**\n  - ❌ **Absent Days**: **${w.daysAbsent || 0} days absent** *(Sundays excluded - Weekly Off)*\n  - ✅ **Days Present**: **${w.daysPresent || 0} days** (${w.attendancePct}% weekly compliance)\n  - ⏳ **Hours Worked**: **${w.totalWorkingHours || "N/A"}**`
        : isLeadership
        ? `• 🗓️ **This Week**: *(Executive Leadership — Biometric punch exempt)*`
        : `• 🗓️ **This Week**: *(No punch records found in sheet for this week)*`;

      return `━━━━━━━━━━━━━━━━━━━━\n📊 **Late & Absent Summary (Monthly & Weekly)**:\n\n${monthSection}\n\n${weekSection}\n\n*📌 Note: Evaluated strictly across elapsed working days up to today (Monday to Saturday). Sundays are weekly off and future unworked days are never counted as absent.*`;
    };

    // Helper: Format Today's Live Status Block
    const formatTodayStatusBlock = (info) => {
      const cutoffText = formatCutoffDisplay(info.cutoff);
      const graceText = formatCutoffDisplay(info.grace);

      const isTodaySunday = new Date().getDay() === 0;
      if (isTodaySunday && !info.isPresent) {
        return `📅 **Today's Attendance Status**:\n• Status: 🏖️ **WEEKLY OFF (Sunday)**\n• Note: Today is Sunday (Weekly off day — Offices are closed). Sunday is NOT counted as absent!\n• Expected Shift: None (Weekly Holiday)`;
      }

      if (info.isAbsent) {
        return `📅 **Today's Live Attendance Details**:\n• Status: ❌ **ABSENT (Not Punched In Today)**\n• Expected Shift: Cut-off **${cutoffText}** (Grace until **${graceText}**)\n• Punch In: *(No check-in record logged for today)*\n• Punch Out: N/A\n• Work Site: N/A`;
      }
      if (info.isLate) {
        const lateByText = info.minutesLate >= 60 ? `**${info.lateDuration}** (${info.minutesLate} mins)` : `**${info.lateDuration}**`;
        return `📅 **Today's Attendance Status**:\n• Status: ⏰ **LATE ARRIVAL**\n• Punch In Time: **${info.formattedIn}**\n• Late By: ${lateByText} *(counted strictly after ${graceText} grace)*\n• Official Cut-off: **${cutoffText}** (Grace: **${graceText}**)\n• Working Hours Today: **${info.formattedWorkingHours}** (${info.isCheckedOut ? "Completed Shift" : "Active / Currently on Duty"})\n• Work Location: ${info.workSite}${info.location ? `\n• Punch Location: ${info.location}` : ""}\n• Punch Out Time: ${info.formattedOut}`;
      }
      if (info.isWithinGrace) {
        return `📅 **Today's Attendance Status**:\n• Status: 🟡 **PRESENT (Within Grace Period)**\n• Punch In Time: **${info.formattedIn}** (0 mins late; arrived before ${graceText} grace limit)\n• Official Cut-off: **${cutoffText}** (Grace: **${graceText}**)\n• Working Hours Today: **${info.formattedWorkingHours}** (${info.isCheckedOut ? "Completed Shift" : "Active / Currently on Duty"})\n• Work Location: ${info.workSite}${info.location ? `\n• Punch Location: ${info.location}` : ""}\n• Punch Out Time: ${info.formattedOut}`;
      }
      return `📅 **Today's Attendance Status**:\n• Status: ${info.isEarly ? `🌅 **PRESENT (Early Login — ${info.earlyDuration} early)**` : "✅ **PRESENT (On Time)**"}\n• Punch In Time: **${info.formattedIn}** (Arrived before ${cutoffText} cut-off)\n• Official Cut-off: **${cutoffText}** (Grace: **${graceText}**)\n• Working Hours Today: **${info.formattedWorkingHours}** (${info.isCheckedOut ? "Completed Shift" : "Active / Currently on Duty"})\n• Work Location: ${info.workSite}${info.location ? `\n• Punch Location: ${info.location}` : ""}\n• Punch Out Time: ${info.formattedOut}`;
    };

    // If multiple employees match
    if (matchedEmployees.length > 1) {
      const summaries = matchedEmployees.slice(0, 5).map((e, idx) => {
        const info = evaluateEmployee(e);
        const tag = `${info.categoryIcon} ${info.categoryShort}`;
        const m = getMonthRecord(info.name);
        const mStr = m ? `\n• Month Record: ⏰ **${m.lateDays}d late**, ❌ **${m.daysAbsent}d absent** (${m.attendancePct}% compliance)` : "";
        if (info.isAbsent) {
          return `${idx + 1}️⃣ **${info.name}** [${tag}]\n• Today: ❌ **Absent (Not Punched In)**\n• Expected Cut-off: ${formatCutoffDisplay(info.cutoff)} (Grace: ${formatCutoffDisplay(info.grace)})${mStr}`;
        }
        if (info.isLate) {
          return `${idx + 1}️⃣ **${info.name}** [${tag}]\n• Today: ⏰ **Late Arrival** (In at **${info.formattedIn}** — **${info.lateDuration} late**)\n• Hours Today: ${info.formattedWorkingHours} (${info.isCheckedOut ? "Completed" : "Active"})${mStr}`;
        }
        if (info.isEarly) {
          return `${idx + 1}️⃣ **${info.name}** [${tag}]\n• Today: 🌅 **Present (Early Login)** (In at **${info.formattedIn}** — **${info.earlyDuration} early**)\n• Hours Today: ${info.formattedWorkingHours}${mStr}`;
        }
        if (info.isWithinGrace) {
          return `${idx + 1}️⃣ **${info.name}** [${tag}]\n• Today: 🟡 **Present (Within Grace)** (In at **${info.formattedIn}**)\n• Hours Today: ${info.formattedWorkingHours}${mStr}`;
        }
        return `${idx + 1}️⃣ **${info.name}** [${tag}]\n• Today: ✅ **Present (On Time)** (In at **${info.formattedIn}**)\n• Hours Today: ${info.formattedWorkingHours}${mStr}`;
      });

      return `🔍 Found **${matchedEmployees.length} employees** matching **"${queryName || "your query"}"**:\n\n${summaries.join("\n\n")}\n\n*💡 Tip: Type an employee's full name for complete individual report.*`;
    }

    // Exactly 1 employee matched
    const info = evaluateEmployee(matchedEmployees[0]);
    const tag = `${info.categoryIcon} **${info.categoryLabel}**`;
    const cutoffText = formatCutoffDisplay(info.cutoff);
    const graceText = formatCutoffDisplay(info.grace);
    const shiftTimingLine = info.customNote ? `\n• **Assigned Shift**: ${info.customNote}` : "";
    const m = getMonthRecord(info.name);

    // Scenario 0: User specifically asked if the employee is LATE OR ABSENT (Both queried)
    if (asksLate && asksAbsent) {
      let verdict = "";
      if (info.isAbsent) {
        verdict = `❌ **${info.name} is ABSENT today** (No check-in record logged).`;
      } else if (info.isLate) {
        verdict = `⏰ **${info.name} is PRESENT today, but arrived LATE.** Punched in at **${info.formattedIn}** (**${info.lateDuration} late** after ${graceText} grace).`;
      } else if (info.isWithinGrace) {
        verdict = `🟡 **${info.name} is PRESENT today within grace** (In at **${info.formattedIn}** — 0m late, before ${graceText} grace limit).`;
      } else if (info.isEarly) {
        verdict = `🌅 **${info.name} is PRESENT and ON TIME today (Early Login)** (In at **${info.formattedIn}** — ${info.earlyDuration} before cut-off).`;
      } else {
        verdict = `✅ **${info.name} is PRESENT and ON TIME today** (Neither late nor absent; punched in at **${info.formattedIn}**).`;
      }

      return `👤 **Individual Attendance Report: ${info.name}** [${tag}]\n• **Official Shift**: Cut-off **${cutoffText}** | Grace: **${graceText}**${shiftTimingLine}\n\n👉 **${verdict}**\n\n━━━━━━━━━━━━━━━━━━━━\n${formatTodayStatusBlock(info)}\n\n${formatSummaryBlock(info.name)}`;
    }

    // Scenario 1: User specifically asked if the employee is LATE
    if (asksLate && !asksAbsent) {
      let verdict = "";
      if (info.isAbsent) {
        verdict = `❌ **${info.name} has NOT punched in today (ABSENT).**\n\n*(Cannot determine lateness because they have not punched in today)*`;
      } else if (info.isLate) {
        verdict = `⏰ **Yes, ${info.name} is LATE today.** Arrived at **${info.formattedIn}** (**${info.lateDuration} late** after ${graceText} grace).`;
      } else if (info.isWithinGrace) {
        verdict = `🟡 **No, ${info.name} is NOT late today.** Punched at **${info.formattedIn}** (within ${graceText} grace, 0m late).`;
      } else {
        verdict = `✅ **No, ${info.name} is NOT late today.** Arrived on time at **${info.formattedIn}** before cut-off.`;
      }

      return `👤 **Individual Attendance Report: ${info.name}** [${tag}]\n• **Official Shift**: Cut-off **${cutoffText}** | Grace: **${graceText}**${shiftTimingLine}\n\n👉 **${verdict}**\n\n━━━━━━━━━━━━━━━━━━━━\n${formatTodayStatusBlock(info)}\n\n${formatSummaryBlock(info.name)}`;
    }

    // Scenario 2: User specifically asked if the employee is ABSENT
    if (asksAbsent && !asksLate) {
      let verdict = "";
      if (info.isAbsent) {
        verdict = `❌ **Yes, ${info.name} is ABSENT today.** No check-in record found for today.`;
      } else if (info.isLate) {
        verdict = `⏰ **No, ${info.name} is NOT absent today.** They are **PRESENT**, but arrived **LATE** at **${info.formattedIn}** (**${info.lateDuration} late**).`;
      } else {
        verdict = `✅ **No, ${info.name} is NOT absent today.** They are **PRESENT** and on time (In at **${info.formattedIn}**).`;
      }

      return `👤 **Individual Attendance Report: ${info.name}** [${tag}]\n• **Official Shift**: Cut-off **${cutoffText}** | Grace: **${graceText}**${shiftTimingLine}\n\n👉 **${verdict}**\n\n━━━━━━━━━━━━━━━━━━━━\n${formatTodayStatusBlock(info)}\n\n${formatSummaryBlock(info.name)}`;
    }

    // Scenario 3: User specifically asked about WORKING HOURS
    if (asksWorkingHours) {
      const whText = info.isAbsent
        ? `❌ **0 hrs** (${info.name} is Absent today)`
        : `⏳ **${info.formattedWorkingHours}** (${info.isCheckedOut ? "Completed Shift" : "Active / Working Now"})`;

      return `👤 **Individual Attendance Report: ${info.name}** [${tag}]\n• **Official Shift**: Cut-off **${cutoffText}** | Grace: **${graceText}**${shiftTimingLine}\n\n• **Today's Working Hours**: ${whText}\n\n━━━━━━━━━━━━━━━━━━━━\n${formatTodayStatusBlock(info)}\n\n${formatSummaryBlock(info.name)}`;
    }

    // Scenario 4: User specifically asked if employee arrived EARLY
    if (asksEarly && !asksAbsent && !asksLate) {
      let earlyVerdict = "";
      if (info.isAbsent) {
        earlyVerdict = `❌ **No, ${info.name} is ABSENT today** (No check-in record).`;
      } else if (info.isEarly) {
        earlyVerdict = `🌅 **Yes! ${info.name} logged in EARLY today.** Arrived at **${info.formattedIn}** (**${info.earlyDuration} early** before ${cutoffText} cut-off).`;
      } else {
        earlyVerdict = `⏰ **No, ${info.name} did not log in early today.** Punched at **${info.formattedIn}** (${info.isLate ? `Late by ${info.lateDuration}` : "On time"}).`;
      }

      return `👤 **Individual Attendance Report: ${info.name}** [${tag}]\n• **Official Shift**: Cut-off **${cutoffText}** | Grace: **${graceText}**${shiftTimingLine}\n\n👉 **${earlyVerdict}**\n\n━━━━━━━━━━━━━━━━━━━━\n${formatTodayStatusBlock(info)}\n\n${formatSummaryBlock(info.name)}`;
    }

    // Scenario 5: User specifically asked if employee is at CLIENT PLACE
    if (asksClient && !asksLate && !asksAbsent) {
      if (info.isAbsent) {
        return `❌ **${info.name} (${tag}) is ABSENT today** and has not punched in anywhere yet.\n\n${formatSummaryBlock(info.name)}`;
      }
      return `🏢 **Location details for ${info.name}** (${tag}):\n\n• **Work Site**: ${info.workSite}${shiftTimingLine}\n• **Reported Location**: ${info.location || "Location not recorded"}\n• **Punch In**: **${info.formattedIn}**\n• **Working Hours**: **${info.formattedWorkingHours}**\n• **Punch Out**: ${info.formattedOut}\n\n${formatSummaryBlock(info.name)}`;
    }

    // Scenario 6: General enquiry about individual employee (Full Comprehensive Report)
    let todayHeadline = "";
    if (info.isAbsent) {
      todayHeadline = `❌ **ABSENT TODAY** (No punch-in recorded)`;
    } else if (info.isLate) {
      todayHeadline = `⏰ **LATE TODAY** (In at **${info.formattedIn}** — **${info.lateDuration} late**)`;
    } else if (info.isWithinGrace) {
      todayHeadline = `🟡 **PRESENT TODAY (Within Grace)** (In at **${info.formattedIn}**)`;
    } else if (info.isEarly) {
      todayHeadline = `🌅 **PRESENT TODAY (Early Login)** (In at **${info.formattedIn}** — **${info.earlyDuration} early**)`;
    } else {
      todayHeadline = `✅ **PRESENT TODAY (On Time)** (In at **${info.formattedIn}**)`;
    }

    const performanceEval =
      m && m.attendancePct >= 90
        ? "🏆 Exemplary attendance compliance with consistent punctuality!"
        : m && m.attendancePct >= 75
        ? "✅ Good overall attendance rate this month."
        : m && m.attendancePct >= 50
        ? "🟡 Moderate attendance rate — several absences recorded."
        : "⚠️ Attendance compliance requires management attention.";

    return `👤 **Individual Attendance Report: ${info.name}**\n• **Department / Category**: ${tag}${shiftTimingLine}\n• **Shift Cut-off**: **${cutoffText}** | Grace: **${graceText}** *(Late counted from grace time)*\n• **Today's Status**: ${todayHeadline}\n\n━━━━━━━━━━━━━━━━━━━━\n${formatTodayStatusBlock(info)}\n\n${formatSummaryBlock(info.name)}\n\n👉 **Overall Standing**: ${performanceEval}`;
  };

  // Local rule-based analyzer when OpenAI key is not set or fails
  const generateLocalAnswer = (query) => {
    const q = query.toLowerCase();

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

    const plantCutoffText = formatCutoffDisplay(shiftPolicies.PLANT_AUDIT?.cutoff || "10:30");
    const plantGraceText = formatCutoffDisplay(shiftPolicies.PLANT_AUDIT?.grace || "10:35");

    const articleCutoffText = formatCutoffDisplay(shiftPolicies.ARTICLE?.cutoff || "11:00");
    const articleGraceText = formatCutoffDisplay(shiftPolicies.ARTICLE?.grace || "11:05");

    const officeCutoffText = formatCutoffDisplay(shiftPolicies.BACK_OFFICE?.cutoff || "10:00");
    const officeGraceText = formatCutoffDisplay(shiftPolicies.BACK_OFFICE?.grace || "10:05");

    const seniorCutoffText = formatCutoffDisplay(shiftPolicies.SENIOR?.cutoff || shiftPolicies.SENIOR_PARTNER_MD?.cutoff || "10:00");
    const seniorGraceText = formatCutoffDisplay(shiftPolicies.SENIOR?.grace || shiftPolicies.SENIOR_PARTNER_MD?.grace || "10:05");

    const partnerCutoffText = formatCutoffDisplay(shiftPolicies.PARTNER?.cutoff || "10:00");
    const partnerGraceText = formatCutoffDisplay(shiftPolicies.PARTNER?.grace || "10:05");

    const mdCutoffText = formatCutoffDisplay(shiftPolicies.MD?.cutoff || "10:00");
    const mdGraceText = formatCutoffDisplay(shiftPolicies.MD?.grace || "10:05");

    // Check if query is asking about Sundays or weekly off policy
    if (
      q.includes("sunday") &&
      (q.includes("absent") || q.includes("off") || q.includes("count") || q.includes("leave") || q.includes("holiday") || q.includes("working day"))
    ) {
      return `🏖️ **Sunday Attendance Policy (Official Weekly Off)**:\n\n• 🏖️ **Sundays are official WEEKLY OFF days** (Offices are closed).\n• ❌ **Sundays are NEVER counted as absent days** for any employee.\n• ✅ **Absence is strictly counted only on working days** (Monday to Saturday).\n• 📊 All Monthly and Weekly registers calculate attendance compliance exclusively across working days!`;
    }

    // 1. Check for individual employee queries first
    const matchResult = findMatchingEmployees(query, validRows);
    if (matchResult.isQueryTargeted && matchResult.matches.length > 0) {
      return generateIndividualAnswer(query, matchResult.matches, matchResult.queryName);
    }

    const isAskingAboutIndividualReport =
      /\b(individual report|individual attendance|individual summary|employee report|employee summary|report of employees|reports of employees)\b/i.test(q) ||
      (q.includes("individual") && (q.includes("report") || q.includes("summary") || q.includes("details")));

    if (isAskingAboutIndividualReport && matchResult.matches.length === 0) {
      return `👤 **Individual Employee Attendance Reports & Summaries**:\n\nYou can view complete individual attendance insights for any employee by typing their name (e.g., *"CA Harsh Mittal"*, *"Meenu Patel"*, *"Rajesh Agrawal"*, *"Dayalu Dewangan"*).\n\n📌 **Every individual report provides**:\n1. 📅 **Today's Live Attendance Details**: States immediately if the employee is **LATE** (with in-time, late duration counted strictly after grace, shift cut-off, and work location) or **ABSENT** (no check-in record logged) or **Within Grace** / **On Time**.\n2. 📊 **Late & Absent Summary**: Total count of **Late Days** and **Absent Days** across **This Month (October 2026 - 27 Calendar Working Days, Excl. Sundays)** and **This Week (Current Week: Mon - Sat, 6 Working Days)**, along with days present and attendance compliance %.\n3. ⏳ **Working Hours**: Active worked duration today and checkout status.\n\n*📌 Calendar Schedule: Every week starts on Monday and ends on Saturday (6 working days). Sundays are weekly off and never counted as absent.*\n\n💡 *Tip: Click any employee name in the Attendance Report table, or type their name in chat!*`;
    }

    if (matchResult.isQueryTargeted && matchResult.matches.length === 0) {
      return `🔍 **Employee Not Found**:\n\nCould not find any employee matching **"${matchResult.queryName}"** in today's attendance records.\n\n*💡 Tip: Please check the spelling or ask about registered employees like "CA Harsh Mittal", "Dayalu Dewangan", etc.*`;
    }

    // ============================================================
    // 1.45 EXPLICIT DOWNLOAD / EXPORT QUERY INTENT CHECK
    // ============================================================
    const isAskingToDownload =
      q.includes("download") ||
      q.includes("downlaod") ||
      q.includes("export") ||
      /\b(xlsx|excel|pdf)\b/i.test(q);

    if (isAskingToDownload) {
      const asksDaily = /\b(daily|today|today's|todays)\b/i.test(q);
      const asksWeekly = /\b(weekly|week|this week|past 7 days)\b/i.test(q);
      const asksMonthly = /\b(monthly|month|this month|google sheet)\b/i.test(q);

      // If user asks specifically for Daily attendance download
      if (asksDaily && !asksWeekly && !asksMonthly) {
        return `📥 **Daily Attendance Report Download (Today's Live Records)**:\n\nYou can download today's real-time attendance report in both **Excel (.xlsx)** and **PDF (.pdf)** formats (just like Weekly and Monthly reports):\n\n• 👥 **Total Registered Staff**: **${total} employees**\n• ✅ **Present Today**: **${present.length}** (🌅 ${allEarly.length} early logins, 🟡 ${allWithinGrace.length} within grace)\n• ⏰ **Late Arrivals Today**: **${allLate.length}** *(calculated strictly against category shift grace times)*\n• ❌ **Absent Today**: **${absent.length}**\n• 🏢 **At Client Sites**: **${atClient.length}**\n• ⏱️ **Category Shift Reference**: Plant (${plantGraceText}), Articles (${articleGraceText}), Back Office (${officeGraceText}), Seniors (${seniorGraceText}), Partners (${partnerGraceText}), MD (${mdGraceText})\n\n👇 **Download Today's Daily Attendance Report:**\n[DOWNLOAD_DAILY_BUTTONS]`;
      }

      // If user asks for daily along with weekly/monthly (e.g. "download daily attendance in excel and pdf as same as weekly and monthly")
      if (asksDaily) {
        return `📥 **Daily Attendance Report Download (Today's Live Records)**:\n\nYou can download today's real-time attendance report in both **Excel (.xlsx)** and **PDF (.pdf)** formats (the same as Weekly and Monthly reports):\n\n• 👥 **Total Registered Staff**: **${total} employees**\n• ✅ **Present Today**: **${present.length}** (🌅 ${allEarly.length} early logins, 🟡 ${allWithinGrace.length} within grace)\n• ⏰ **Late Arrivals Today**: **${allLate.length}** *(calculated strictly against category shift grace times)*\n• ❌ **Absent Today**: **${absent.length}**\n• 🏢 **At Client Sites**: **${atClient.length}**\n• ⏱️ **Category Shift Reference**: Plant (${plantGraceText}), Articles (${articleGraceText}), Back Office (${officeGraceText}), Seniors (${seniorGraceText}), Partners (${partnerGraceText}), MD (${mdGraceText})\n\n👇 **Download Today's Daily Attendance Report:**\n[DOWNLOAD_DAILY_BUTTONS]\n\n💡 *Need Weekly or Monthly instead? You can also download them below:*\n[DOWNLOAD_BUTTONS]`;
      }

      // If user asks specifically for Weekly
      if (asksWeekly && !asksDaily && !asksMonthly) {
        return `📥 **Weekly Attendance Report Download (${activeWeeklyData?.weekRange || "Past 7 Days"})**:\n\nYou can download the complete weekly attendance summary in both **Excel (.xlsx)** and **PDF (.pdf)** formats:\n\n• 👥 **Active Staff**: ${activeWeeklyData?.list?.length || 0} employees\n• 📈 **Average Compliance**: ${Math.round((activeWeeklyData?.list || []).reduce((acc, cur) => acc + (cur.attendancePct || 0), 0) / ((activeWeeklyData?.list?.length) || 1))}%\n• 🗓️ **Includes**: Weekly attendance rate %, days present, late instances & hours worked.\n\n👇 **Download Weekly Attendance Report:**\n[DOWNLOAD_WEEKLY_BUTTONS]`;
      }

      // If user asks specifically for Monthly (including a named month like October, September, August, July)
      const requestedMonthDl = parseTargetMonthFromQuery(q);
      if ((asksMonthly || requestedMonthDl) && !asksDaily && !asksWeekly) {
        const resolvedDl = resolveMonthlyAttendanceSlice(activeMonthlyData, requestedMonthDl || "CURRENT");
        if (requestedMonthDl && !resolvedDl.found) {
          const avail = (resolvedDl.availableMonths || []).map((m) => `\`${m.monthName}\``).join(", ");
          return `📥 **Monthly Attendance Download — ${requestedMonthDl.label}**\n\n• ⚠️ No attendance records found for **${requestedMonthDl.label}**.\n• 📅 **Available Months**: ${avail || "Syncing..."}`;
        }
        const dlSlice = resolvedDl.slice || activeMonthlyData;
        const dlScope = requestedMonthDl ? dlSlice?.monthKey || requestedMonthDl.key : "CURRENT";
        return `📥 **Monthly Attendance Register Download (${dlSlice?.monthName || requestedMonthDl?.label || "Current Month"})**:\n\nYou can download the monthly attendance register in both **Excel (.xlsx)** and **PDF (.pdf)** formats:\n\n• 👥 **Total Evaluated**: ${dlSlice?.monthlySummaries?.length || 0} employees\n• 🗓️ **Working Days**: ${dlSlice?.workingDaysCount || 26} days\n• 🔗 **Source**: Google Sheet Register\n\n👇 **Download Monthly Attendance Register:**\n[DOWNLOAD_MONTHLY_BUTTONS:${dlScope}]`;
      }

      // General download card (all periods)
      return `📥 **Download Attendance Reports (Daily, Weekly & Monthly)**:\n\nYou can download real-time attendance reports in both **Excel (.xlsx)** and **PDF (.pdf)** formats for any time period:\n\n• 📅 **Daily Report**: Today's live punches, shift cut-offs, late durations & working hours.\n• 🗓️ **Weekly Report**: Past 7 days summary, working hours & day-by-day logs.\n• 📊 **Monthly Register**: Full month attendance register, compliance % & logs from Google Sheet.\n\n👇 **Choose your desired report below:**\n[DOWNLOAD_BUTTONS]`;
    }

    // ============================================================
    // 1.5 PERIOD-AWARE CHECK: Monthly & Weekly Queries
    // ============================================================
    const requestedMonth = parseTargetMonthFromQuery(q);
    const wantsAllMonths = /\b(all\s+months|month[\s-]*wise|every\s+month|comparison)\b/i.test(q);
    const isMonthlyQuery =
      Boolean(requestedMonth) ||
      wantsAllMonths ||
      /\b(monthly|month|this month|current month|whole month|entire month)\b/i.test(q) ||
      /\b(in\s+month|for\s+the\s+month|month's)\b/i.test(q);

    const isWeeklyQuery =
      /\b(weekly|week|this week|current week|past 7 days|last 7 days)\b/i.test(q) ||
      /\b(in\s+week|for\s+the\s+week|week's)\b/i.test(q);

    // --- A. MONTHLY REPORT & ATTENDANCE INTELLIGENCE ---
    if (isMonthlyQuery) {
      if (!activeMonthlyData || !activeMonthlyData.monthlySummaries || activeMonthlyData.monthlySummaries.length === 0) {
        // Trigger self-fetch in background
        fetchMonthlyAttendance({
          dailyRows: validRows,
          dynamicDeptMap,
          shiftPolicies,
        })
          .then((res) => {
            if (res && res.monthlySummaries) {
              setInternalMonthlyData(res);
              setInternalWeeklyData({
                list: res.weeklySummaries,
                weekRange: res.weeklyRange,
                weeklyLogs: res.weeklyLogs,
                totalDays: 6,
                calendarWeek: res.calendarWeek,
              });
            }
          })
          .catch(() => {});
        return `📊 **Monthly Attendance Register is connecting to Google Sheet...**\n\nSyncing latest biometric and sheet records. Please try again in 2-3 seconds or visit the **Attendance Report** page.`;
      }

      const resolved = resolveMonthlyAttendanceSlice(
        activeMonthlyData,
        requestedMonth || (wantsAllMonths ? "ALL" : "CURRENT")
      );
      if (requestedMonth && (!resolved.ready || !resolved.found || !resolved.slice)) {
        const avail = (resolved.availableMonths || []).map((m) => `\`${m.monthName}\` (${m.avgPct}%)`).join(", ");
        return `📊 **Monthly Attendance Register — ${requestedMonth.label}**\n\n• ⚠️ **No attendance records found for ${requestedMonth.label}.**\n• 📅 **Available Months in Google Sheet**: ${avail || "None"}`;
      }

      const slice = resolved.slice;
      const monthTitle = slice.monthName || slice.calendarMonth?.monthName || "Current Month";
      const scopeKey = requestedMonth ? (slice.monthKey || requestedMonth.key) : wantsAllMonths ? "ALL" : (slice.monthKey || "CURRENT");

      const summaries = slice.monthlySummaries;
      const workingDays = slice.workingDaysCount || 26;
      const totalStaff = summaries.length;
      const avgPct = Math.round(summaries.reduce((acc, cur) => acc + (cur.attendancePct || 0), 0) / (totalStaff || 1));
      const totalLateLogs = summaries.reduce((acc, cur) => acc + (cur.lateDays || 0), 0);
      const totalAbsentDays = summaries.reduce((acc, cur) => acc + (cur.daysAbsent || 0), 0);

      const groups = {
        MD: summaries.filter((e) => e.categoryKey === "MD"),
        PARTNER: summaries.filter((e) => e.categoryKey === "PARTNER"),
        SENIOR: summaries.filter((e) => e.categoryKey === "SENIOR"),
        PLANT_AUDIT: summaries.filter((e) => e.categoryKey === "PLANT_AUDIT"),
        ARTICLE: summaries.filter((e) => e.categoryKey === "ARTICLE"),
        BACK_OFFICE: summaries.filter((e) => e.categoryKey === "BACK_OFFICE"),
      };

      const deptConfigs = [
        { key: "MD", label: "Managing Director (MD - Rajesh Agrawal)", icon: "👑" },
        { key: "PARTNER", label: "Partners (Rupesh Vaid, CA Ankit Garg, Mukul C)", icon: "🤝" },
        { key: "SENIOR", label: "Seniors (Chartered Accountants / Senior Staff)", icon: "👔" },
        { key: "PLANT_AUDIT", label: "Plant Audit Staff", icon: "🏭" },
        { key: "ARTICLE", label: "Articles", icon: "📚" },
        { key: "BACK_OFFICE", label: "Back Office Staff", icon: "🏢" },
      ];

      const formatLateSection = (list, label, icon) => {
        if (list.length === 0) return `${icon} **${label}**: *(Executive Leadership — Biometric punch exempt)*`;
        const late = list.filter((e) => (e.lateDays || 0) > 0).sort((a, b) => b.lateDays - a.lateDays);
        if (late.length === 0) return `${icon} **${label}**: *(None — 0 late days recorded this month! 🎉)*`;
        const lines = late.map((e) => `  • **${e.employee}** — **${e.lateDays} late days** (${e.daysPresent} present / ${e.totalDays || workingDays} days)`).join("\n");
        return `${icon} **${label}** — **${late.length} staff late**:\n${lines}`;
      };

      const formatAbsentSection = (list, label, icon) => {
        if (list.length === 0) return `${icon} **${label}**: *(Executive Leadership — Biometric punch exempt)*`;
        const absent = list.filter((e) => (e.daysAbsent || 0) > 0).sort((a, b) => b.daysAbsent - a.daysAbsent);
        if (absent.length === 0) return `${icon} **${label}**: *(None — 100% full attendance this month! 🎉)*`;
        const lines = absent.map((e) => `  • **${e.employee}** — **${e.daysAbsent} days absent** (${e.daysPresent} present / ${e.totalDays || workingDays} days — **${e.attendancePct}%**)`).join("\n");
        return `${icon} **${label}** — **${absent.length} staff with absences**:\n${lines}`;
      };

      const allLateStaff = summaries.filter((e) => (e.lateDays || 0) > 0);
      const allAbsentStaff = summaries.filter((e) => (e.daysAbsent || 0) > 0);

      const lateBreakdownText = deptConfigs.map((d) => formatLateSection(groups[d.key] || [], d.label, d.icon)).join("\n\n");
      const absentBreakdownText = deptConfigs.map((d) => formatAbsentSection(groups[d.key] || [], d.label, d.icon)).join("\n\n");

      const asksLate = /\b(late|delay|tardy)\b/i.test(q);
      const asksAbsent = /\b(absent|absence|absentees|leave|leaves|not present|not come)\b/i.test(q);

      // 1. Department-specific Monthly query
      const targetDept =
        q.includes("plant") || q.includes("factory") ? "PLANT_AUDIT" :
        q.includes("article") || q.includes("intern") ? "ARTICLE" :
        q.includes("back office") || q.includes("backoffice") || q.includes("office staff") ? "BACK_OFFICE" :
        q.includes("senior") || q.includes("seniors") ? "SENIOR" :
        q.includes("partner") || q.includes("partners") ? "PARTNER" :
        (q.includes("md") && !q.includes("cmd")) || q.includes("rajesh agrawal") ? "MD" : null;

      if (targetDept) {
        const dConf = deptConfigs.find((c) => c.key === targetDept);
        const dList = groups[targetDept] || [];
        const dLate = dList.filter((e) => (e.lateDays || 0) > 0);
        const dAbsent = dList.filter((e) => (e.daysAbsent || 0) > 0);
        const dAvg = Math.round(dList.reduce((acc, c) => acc + (c.attendancePct || 0), 0) / (dList.length || 1));

        if (asksLate && !asksAbsent) {
          return `⏰ **Monthly Late Staff (${monthTitle}): ${dConf.icon} ${dConf.label}**:\n\n• **Total Staff**: ${dList.length}\n• ⏰ **Staff With Late Days**: **${dLate.length}**\n\n${formatLateSection(dList, dConf.label, dConf.icon)}\n\n👇 **Download ${monthTitle} Register:**\n[DOWNLOAD_MONTHLY_BUTTONS:${scopeKey}]`;
        }
        if (asksAbsent && !asksLate) {
          return `❌ **Monthly Absent Staff (${monthTitle}): ${dConf.icon} ${dConf.label}**:\n\n• **Total Staff**: ${dList.length}\n• ❌ **Staff With Absences**: **${dAbsent.length}**\n\n${formatAbsentSection(dList, dConf.label, dConf.icon)}\n\n👇 **Download ${monthTitle} Register:**\n[DOWNLOAD_MONTHLY_BUTTONS:${scopeKey}]`;
        }
        return `📊 **Monthly Attendance (${monthTitle}): ${dConf.icon} ${dConf.label}**:\n\n• 👥 **Total Staff**: ${dList.length}\n• 📈 **Average Compliance**: **${dAvg}%**\n• ⏰ **Staff With Late Arrivals**: **${dLate.length}**\n• ❌ **Staff With Absences**: **${dAbsent.length}**\n\n━━━━━━━━━━━━━━━━━━━━\n⏰ **Late Arrivals (${monthTitle})**:\n${formatLateSection(dList, dConf.label, dConf.icon)}\n\n━━━━━━━━━━━━━━━━━━━━\n❌ **Absences (${monthTitle})**:\n${formatAbsentSection(dList, dConf.label, dConf.icon)}\n\n👇 **Download ${monthTitle} Register:**\n[DOWNLOAD_MONTHLY_BUTTONS:${scopeKey}]`;
      }

      // 2. User specifically asks for Monthly LATE arrivals
      if (asksLate && !asksAbsent) {
        return `⏰ **Monthly Late Arrivals Report & Department Breakdown (${monthTitle})**:\n\n• 👥 **Total Employees with Late Logs**: **${allLateStaff.length}** out of ${totalStaff} staff (${Math.round((allLateStaff.length / (totalStaff || 1)) * 100)}%)\n• ⏰ **Total Late Punch Instances**: **${totalLateLogs} logs** recorded across ${workingDays} working days\n• 🔗 **Source**: [Monthly Google Sheet](${MONTHLY_GOOGLE_SHEET_URL})\n\n━━━━━━━━━━━━━━━━━━━━\n📌 **Department-Wise Late Staff List**:\n\n${lateBreakdownText}\n\n👇 **Download ${monthTitle} Register:**\n[DOWNLOAD_MONTHLY_BUTTONS:${scopeKey}]`;
      }

      // 3. User specifically asks for Monthly ABSENT employees
      if (asksAbsent && !asksLate) {
        return `❌ **Monthly Absent Employees Report & Department Breakdown (${monthTitle})**:\n\n• 👥 **Total Employees with Absences**: **${allAbsentStaff.length}** out of ${totalStaff} staff\n• ❌ **Total Absent Days Recorded**: **${totalAbsentDays} days** across ${workingDays} working days\n• 📈 **Firm Average Attendance Rate**: **${avgPct}%**\n• 🔗 **Source**: [Monthly Google Sheet](${MONTHLY_GOOGLE_SHEET_URL})\n\n━━━━━━━━━━━━━━━━━━━━\n📋 **Department-Wise Absent Staff List**:\n\n${absentBreakdownText}\n\n👇 **Download ${monthTitle} Register:**\n[DOWNLOAD_MONTHLY_BUTTONS:${scopeKey}]`;
      }

      // 4. General Monthly Attendance Report
      const top5 = [...summaries].sort((a, b) => (b.attendancePct || 0) - (a.attendancePct || 0)).slice(0, 5);
      const topStr = top5
        .map((e, idx) => `  ${idx + 1}. **${e.employee}** [${e.categoryShort}] — **${e.attendancePct}%** (${e.daysPresent} present / ${e.totalDays} days • ${e.totalWorkingHours})`)
        .join("\n");

      const availMonths = activeMonthlyData.availableMonths || [];
      const monthCompText =
        availMonths.length > 1 && (!requestedMonth || wantsAllMonths)
          ? `\n\n━━━━━━━━━━━━━━━━━━━━\n📅 **All Recorded Months Comparison**:\n${availMonths
              .map(
                (m) =>
                  `• **${m.monthName}**: **${m.avgPct}%** avg | ${m.totalStaff} staff | ${m.workingDaysCount} working days | ${m.totalLateLogs} late | ${m.totalAbsentDays} absent`
              )
              .join("\n")}`
          : "";

      return `📊 **Monthly Attendance Register — ${monthTitle} (${workingDays} Working Days)**:\n\n• 👥 **Total Staff Evaluated**: **${totalStaff} employees**\n• 📈 **Firm Average Attendance Rate**: **${avgPct}%**\n• ⏰ **Total Late Logs Recorded**: **${totalLateLogs}**\n• ❌ **Total Absent Days Recorded**: **${totalAbsentDays}**\n• 🔗 **Source**: [Monthly Google Sheet](${MONTHLY_GOOGLE_SHEET_URL})\n\n━━━━━━━━━━━━━━━━━━━━\n⏰ **Department-Wise Late Arrivals (${monthTitle})**:\n${lateBreakdownText}\n\n━━━━━━━━━━━━━━━━━━━━\n❌ **Department-Wise Absent Employees (${monthTitle})**:\n${absentBreakdownText}\n\n━━━━━━━━━━━━━━━━━━━━\n🏆 **Top Consistent Employees (${monthTitle})**:\n${topStr}${monthCompText}\n\n👇 **Download ${monthTitle} Reports:**\n[DOWNLOAD_MONTHLY_BUTTONS:${scopeKey}]`;
    }

    // --- B. WEEKLY REPORT & ATTENDANCE INTELLIGENCE ---
    if (isWeeklyQuery) {
      if (!activeWeeklyData || !activeWeeklyData.list || activeWeeklyData.list.length === 0) {
        // Trigger self-fetch in background
        fetchMonthlyAttendance({
          dailyRows: validRows,
          dynamicDeptMap,
          shiftPolicies,
        })
          .then((res) => {
            if (res && res.weeklySummaries) {
              setInternalMonthlyData(res);
              setInternalWeeklyData({
                list: res.weeklySummaries,
                weekRange: res.weeklyRange,
                weeklyLogs: res.weeklyLogs,
                totalDays: 6,
                calendarWeek: res.calendarWeek,
              });
            }
          })
          .catch(() => {});
        return `🗓️ **Weekly Attendance Data is connecting to Google Sheet...**\n\nSyncing latest biometric and sheet records for this week (Mon-Sat). Please try again in 2-3 seconds or visit the **Attendance Report** page.`;
      }

      const list = activeWeeklyData.list;
      const weekRange = activeWeeklyData.weekRange || "Past 7 Days";
      const totalStaff = list.length;
      const totalDays = activeWeeklyData.totalDays || 6;
      const avgPct = Math.round(list.reduce((acc, cur) => acc + (cur.attendancePct || 0), 0) / (totalStaff || 1));
      const totalLate = list.reduce((acc, cur) => acc + (cur.lateDays || 0), 0);
      const totalAbsent = list.reduce((acc, cur) => acc + (cur.daysAbsent || 0), 0);

      const groups = {
        MD: list.filter((e) => e.categoryKey === "MD"),
        PARTNER: list.filter((e) => e.categoryKey === "PARTNER"),
        SENIOR: list.filter((e) => e.categoryKey === "SENIOR"),
        PLANT_AUDIT: list.filter((e) => e.categoryKey === "PLANT_AUDIT"),
        ARTICLE: list.filter((e) => e.categoryKey === "ARTICLE"),
        BACK_OFFICE: list.filter((e) => e.categoryKey === "BACK_OFFICE"),
      };

      const deptConfigs = [
        { key: "MD", label: "Managing Director (MD - Rajesh Agrawal)", icon: "👑" },
        { key: "PARTNER", label: "Partners (Rupesh Vaid, CA Ankit Garg, Mukul C)", icon: "🤝" },
        { key: "SENIOR", label: "Seniors (Chartered Accountants / Senior Staff)", icon: "👔" },
        { key: "PLANT_AUDIT", label: "Plant Audit Staff", icon: "🏭" },
        { key: "ARTICLE", label: "Articles", icon: "📚" },
        { key: "BACK_OFFICE", label: "Back Office Staff", icon: "🏢" },
      ];

      const formatLateSection = (items, label, icon) => {
        if (items.length === 0) return `${icon} **${label}**: *(Executive Leadership — Biometric punch exempt)*`;
        const late = items.filter((e) => (e.lateDays || 0) > 0).sort((a, b) => b.lateDays - a.lateDays);
        if (late.length === 0) return `${icon} **${label}**: *(None — 0 late days this week! 🎉)*`;
        const lines = late.map((e) => `  • **${e.employee}** — **${e.lateDays} late days** (${e.daysPresent} present / ${e.totalDays || totalDays} days)`).join("\n");
        return `${icon} **${label}** — **${late.length} staff late**:\n${lines}`;
      };

      const formatAbsentSection = (items, label, icon) => {
        if (items.length === 0) return `${icon} **${label}**: *(Executive Leadership — Biometric punch exempt)*`;
        const absent = items.filter((e) => (e.daysAbsent || 0) > 0).sort((a, b) => b.daysAbsent - a.daysAbsent);
        if (absent.length === 0) return `${icon} **${label}**: *(None — 100% full attendance this week! 🎉)*`;
        const lines = absent.map((e) => `  • **${e.employee}** — **${e.daysAbsent} days absent** (${e.daysPresent} present / ${e.totalDays || totalDays} days — **${e.attendancePct}%**)`).join("\n");
        return `${icon} **${label}** — **${absent.length} staff with absences**:\n${lines}`;
      };

      const allLateStaff = list.filter((e) => (e.lateDays || 0) > 0);
      const allAbsentStaff = list.filter((e) => (e.daysAbsent || 0) > 0);

      const lateBreakdownText = deptConfigs.map((d) => formatLateSection(groups[d.key] || [], d.label, d.icon)).join("\n\n");
      const absentBreakdownText = deptConfigs.map((d) => formatAbsentSection(groups[d.key] || [], d.label, d.icon)).join("\n\n");

      const asksLate = /\b(late|delay|tardy)\b/i.test(q);
      const asksAbsent = /\b(absent|absence|absentees|leave|leaves|not present|not come)\b/i.test(q);

      const targetDept =
        q.includes("plant") || q.includes("factory") ? "PLANT_AUDIT" :
        q.includes("article") || q.includes("intern") ? "ARTICLE" :
        q.includes("back office") || q.includes("backoffice") || q.includes("office staff") ? "BACK_OFFICE" :
        q.includes("senior") || q.includes("seniors") ? "SENIOR" :
        q.includes("partner") || q.includes("partners") ? "PARTNER" :
        (q.includes("md") && !q.includes("cmd")) || q.includes("rajesh agrawal") ? "MD" : null;

      if (targetDept) {
        const dConf = deptConfigs.find((c) => c.key === targetDept);
        const dList = groups[targetDept] || [];
        const dLate = dList.filter((e) => (e.lateDays || 0) > 0);
        const dAbsent = dList.filter((e) => (e.daysAbsent || 0) > 0);
        const dAvg = Math.round(dList.reduce((acc, c) => acc + (c.attendancePct || 0), 0) / (dList.length || 1));

        if (asksLate && !asksAbsent) {
          return `⏰ **Weekly Late Staff: ${dConf.icon} ${dConf.label}**:\n\n• **Total Staff**: ${dList.length}\n• ⏰ **Staff With Late Days**: **${dLate.length}**\n\n${formatLateSection(dList, dConf.label, dConf.icon)}\n\n👇 **Download Weekly Report:**\n[DOWNLOAD_WEEKLY_BUTTONS]`;
        }
        if (asksAbsent && !asksLate) {
          return `❌ **Weekly Absent Staff: ${dConf.icon} ${dConf.label}**:\n\n• **Total Staff**: ${dList.length}\n• ❌ **Staff With Absences**: **${dAbsent.length}**\n\n${formatAbsentSection(dList, dConf.label, dConf.icon)}\n\n👇 **Download Weekly Report:**\n[DOWNLOAD_WEEKLY_BUTTONS]`;
        }
        return `🗓️ **Weekly Attendance: ${dConf.icon} ${dConf.label}**:\n\n• 👥 **Total Staff**: ${dList.length}\n• 📈 **Average Compliance**: **${dAvg}%**\n• ⏰ **Staff With Late Arrivals**: **${dLate.length}**\n• ❌ **Staff With Absences**: **${dAbsent.length}**\n\n━━━━━━━━━━━━━━━━━━━━\n⏰ **Late Arrivals This Week**:\n${formatLateSection(dList, dConf.label, dConf.icon)}\n\n━━━━━━━━━━━━━━━━━━━━\n❌ **Absences This Week**:\n${formatAbsentSection(dList, dConf.label, dConf.icon)}\n\n👇 **Download Weekly Report:**\n[DOWNLOAD_WEEKLY_BUTTONS]`;
      }

      if (asksLate && !asksAbsent) {
        return `⏰ **Weekly Late Arrivals Report & Department Breakdown (${weekRange})**:\n\n• 👥 **Total Employees with Late Arrivals**: **${allLateStaff.length}** out of ${totalStaff} staff (${Math.round((allLateStaff.length / totalStaff) * 100)}%)\n• ⏰ **Total Late Instances Recorded**: **${totalLate}**\n• 🗓️ **Week Cycle**: Starts **Monday** to **Saturday** (6 working days; new week every Monday!)\n\n━━━━━━━━━━━━━━━━━━━━\n📌 **Department-Wise Late Staff List**:\n\n${lateBreakdownText}\n\n👇 **Download Weekly Report:**\n[DOWNLOAD_WEEKLY_BUTTONS]`;
      }

      if (asksAbsent && !asksLate) {
        return `❌ **Weekly Absent Employees Report & Department Breakdown (${weekRange})**:\n\n• 👥 **Total Employees with Absences**: **${allAbsentStaff.length}** out of ${totalStaff} staff\n• ❌ **Total Absent Days Recorded**: **${totalAbsent} days** *(Evaluated Mon - Sat; Sundays are off)*\n• 📈 **Weekly Average Attendance Compliance**: **${avgPct}%**\n• 🗓️ **Week Cycle**: Starts **Monday** to **Saturday** (6 working days; new week every Monday!)\n\n━━━━━━━━━━━━━━━━━━━━\n📋 **Department-Wise Absent Staff List**:\n\n${absentBreakdownText}\n\n👇 **Download Weekly Report:**\n[DOWNLOAD_WEEKLY_BUTTONS]`;
      }

      // General weekly report
      return `🗓️ **Weekly Attendance Summary (${weekRange})**:\n\n• 👥 **Active Staff**: **${totalStaff} employees**\n• 📈 **Weekly Average Attendance**: **${avgPct}%**\n• ⏰ **Total Late Instances**: **${totalLate}**\n• ❌ **Total Absent Days**: **${totalAbsent}** *(Evaluated Mon - Sat; Sundays are off)*\n• 🗓️ **Calendar Schedule**: Every week starts on **Monday** and ends on **Saturday** (6 working days). Every Monday marks a brand new week!\n\n━━━━━━━━━━━━━━━━━━━━\n⏰ **Department-Wise Late Arrivals (This Week)**:\n${lateBreakdownText}\n\n━━━━━━━━━━━━━━━━━━━━\n❌ **Department-Wise Absent Employees (This Week)**:\n${absentBreakdownText}\n\n👇 **Download Weekly Reports:**\n[DOWNLOAD_WEEKLY_BUTTONS]`;
    }

    // (Metrics and cutoff texts already extracted at the beginning of generateLocalAnswer)

    // 2. Query targeting PLANT AUDIT STAFF
    if (q.includes("plant") || q.includes("factory")) {
      const lateList = plant.late
        .map((e) => `• **${e.name}** — In at ${e.formattedIn} (*${e.lateDuration} late*)`)
        .join("\n");
      const absentList = plant.absent.map((e) => `• ${e.name}`).join("\n");

      return `🏭 **Plant Audit Staff Attendance** (Cut-off: **${plantCutoffText}** | Grace: **${plantGraceText}**):\n\n• 👥 **Total Plant Staff**: ${plant.total}\n• ✅ **Present**: **${plant.present.length}**\n• ❌ **Absent**: **${plant.absent.length}**\n• ⏰ **Late Arrivals (> ${plantGraceText})**: **${plant.late.length}**\n• 🟡 **Within Grace**: **${plant.withinGrace.length}**\n\n**Late Plant Staff**:\n${lateList || "None (All plant staff on time! 🎉)"}\n\n${plant.absent.length > 0 ? `**Absent Plant Staff**:\n${absentList}` : ""}`;
    }

    // 3. Query targeting ARTICLES
    if (q.includes("article") || q.includes("intern")) {
      const lateList = article.late
        .map((e) => `• **${e.name}** — In at ${e.formattedIn} (*${e.lateDuration} late*)`)
        .join("\n");
      const absentList = article.absent.map((e) => `• ${e.name}`).join("\n");

      return `📚 **Article Staff Attendance** (Cut-off: **${articleCutoffText}** | Grace: **${articleGraceText}**):\n\n• 👥 **Total Articles**: ${article.total}\n• ✅ **Present**: **${article.present.length}**\n• ❌ **Absent**: **${article.absent.length}**\n• ⏰ **Late Arrivals (> ${articleGraceText})**: **${article.late.length}**\n• 🟡 **Within Grace**: **${article.withinGrace.length}**\n\n**Late Articles**:\n${lateList || "None (All articles on time! 🎉)"}\n\n${article.absent.length > 0 ? `**Absent Articles**:\n${absentList}` : ""}`;
    }

    // 4. Query targeting BACK OFFICE
    if (q.includes("back office") || q.includes("backoffice") || q.includes("office staff")) {
      const lateList = backOffice.late
        .map((e) => `• **${e.name}** — In at ${e.formattedIn} (*${e.lateDuration} late*)`)
        .join("\n");
      const absentList = backOffice.absent.map((e) => `• ${e.name}`).join("\n");

      return `🏢 **Back Office Staff Attendance** (Cut-off: **${officeCutoffText}** | Grace: **${officeGraceText}**):\n\n• 👥 **Total Back Office**: ${backOffice.total}\n• ✅ **Present**: **${backOffice.present.length}**\n• ❌ **Absent**: **${backOffice.absent.length}**\n• ⏰ **Late Arrivals (> ${officeGraceText})**: **${backOffice.late.length}**\n• 🟡 **Within Grace**: **${backOffice.withinGrace.length}**\n\n**Late Back Office**:\n${lateList || "None (All back office on time! 🎉)"}\n\n${backOffice.absent.length > 0 ? `**Absent Back Office**:\n${absentList}` : ""}`;
    }

    // 4.1 Query targeting SENIORS, PARTNERS & MD COMBINED
    if (
      (q.includes("senior") && q.includes("partner")) ||
      (q.includes("senior") && q.includes("md")) ||
      (q.includes("partner") && q.includes("md")) ||
      q.includes("leadership") ||
      q.includes("management")
    ) {
      const renderGroup = (grp, label, icon, cutoffStr, graceStr) => {
        if (!grp || !grp.total) return `\n${icon} **${label}**: No records today`;
        const pres = grp.present.length;
        const lt = grp.late.length;
        const ab = grp.absent.length;
        let str = `\n${icon} **${label}** (Cut-off: ${cutoffStr} | Grace: ${graceStr}):\n• Present: ${pres}/${grp.total} | Late: ${lt} | Absent: ${ab}`;
        if (grp.late.length > 0) {
          str += `\n• Late: ` + grp.late.map((e) => `**${e.name}** (${e.formattedIn} — ${e.lateDuration} late)`).join(", ");
        }
        if (grp.absent.length > 0) {
          str += `\n• Absent: ` + grp.absent.map((e) => e.name).join(", ");
        }
        return str;
      };

      return `👔 **Seniors, Partners & MD Attendance Status**:\n${renderGroup(md, "Managing Director (MD - Rajesh Agrawal)", "👑", mdCutoffText, mdGraceText)}\n${renderGroup(partner, "Partners (Rupesh Vaid, CA Ankit Garg, Mukul C)", "🤝", partnerCutoffText, partnerGraceText)}\n${renderGroup(senior, "Seniors (Chartered Accountants / Senior Staff)", "👔", seniorCutoffText, seniorGraceText)}\n\n💡 *Tip: Ask specifically about "MD", "Partners", or "Seniors" for individual drill-down.*`;
    }

    // 4.2 Query targeting MD (Managing Director Rajesh Agrawal)
    if (
      (q.includes("md") && !q.includes("cmd")) ||
      q.includes("rajesh agrawal") ||
      q.includes("managing director") ||
      q.includes("md sir")
    ) {
      const lateList = md.late
        .map((e) => `• **${e.name}** — In at ${e.formattedIn} (*${e.lateDuration} late*)`)
        .join("\n");
      const absentList = md.absent.map((e) => `• ${e.name}`).join("\n");
      const presentList = md.present
        .map((e) => `• **${e.name}** — In at ${e.formattedIn} (${e.isEarly ? `🌅 ${e.earlyDuration} early` : e.isWithinGrace ? "🟡 Within grace" : "✅ On time"}) • Hours: ${e.formattedWorkingHours}`)
        .join("\n");

      return `👑 **MD (Managing Director) Attendance** (Cut-off: **${mdCutoffText}** | Grace: **${mdGraceText}**):\n\n• 👤 **Managing Director**: Rajesh Agrawal\n• ✅ **Present**: **${md.present.length}**\n• ❌ **Absent**: **${md.absent.length}**\n• ⏰ **Late Arrivals (> ${mdGraceText})**: **${md.late.length}**\n\n${presentList ? `**Present Status**:\n${presentList}\n\n` : ""}${md.late.length > 0 ? `**Late**:\n${lateList}\n\n` : ""}${md.absent.length > 0 ? `**Absent**:\n${absentList}` : ""}`;
    }

    // 4.3 Query targeting PARTNERS (Rupesh Vaid, CA Ankit Kumar Garg, Mukul C)
    if (q.includes("partner") || q.includes("partners")) {
      const lateList = partner.late
        .map((e) => `• **${e.name}** — In at ${e.formattedIn} (*${e.lateDuration} late*)`)
        .join("\n");
      const absentList = partner.absent.map((e) => `• ${e.name}`).join("\n");
      const presentList = partner.present
        .map((e) => `• **${e.name}** — In at ${e.formattedIn} (${e.isEarly ? `🌅 ${e.earlyDuration} early` : e.isWithinGrace ? "🟡 Within grace" : "✅ On time"}) • Hours: ${e.formattedWorkingHours}`)
        .join("\n");

      return `🤝 **Partners Attendance** (Cut-off: **${partnerCutoffText}** | Grace: **${partnerGraceText}**):\n\n• 👥 **Designated Partners**: Rupesh Vaid, CA Ankit Kumar Garg, Mukul C\n• 👥 **Total Partners**: ${partner.total}\n• ✅ **Present**: **${partner.present.length}**\n• ❌ **Absent**: **${partner.absent.length}**\n• ⏰ **Late Arrivals (> ${partnerGraceText})**: **${partner.late.length}**\n• 🟡 **Within Grace**: **${partner.withinGrace.length}**\n\n${presentList ? `**Present Partners**:\n${presentList}\n\n` : ""}${partner.late.length > 0 ? `**Late Partners**:\n${lateList}\n\n` : ""}${partner.absent.length > 0 ? `**Absent Partners**:\n${absentList}` : "*(All partners present / on time! 🎉)*"}`;
    }

    // 4.4 Query targeting SENIORS (Chartered Accountants / Senior Staff)
    if (
      q.includes("senior") ||
      q.includes("seniors") ||
      q.includes("senior staff") ||
      q.includes("ca ") ||
      q.includes("cas")
    ) {
      const lateList = senior.late
        .map((e) => `• **${e.name}** — In at ${e.formattedIn} (*${e.lateDuration} late*)`)
        .join("\n");
      const absentList = senior.absent.map((e) => `• ${e.name}`).join("\n");

      return `👔 **Senior Staff Attendance** (Cut-off: **${seniorCutoffText}** | Grace: **${seniorGraceText}**):\n\n• 👥 **Total Seniors**: ${senior.total}\n• ✅ **Present**: **${senior.present.length}**\n• ❌ **Absent**: **${senior.absent.length}**\n• ⏰ **Late Arrivals (> ${seniorGraceText})**: **${senior.late.length}**\n• 🟡 **Within Grace**: **${senior.withinGrace.length}**\n\n${senior.late.length > 0 ? `**Late Seniors**:\n${lateList}\n\n` : ""}${senior.absent.length > 0 ? `**Absent Seniors**:\n${absentList}` : "*(All senior staff present / on time! 🎉)*"}`;
    }

    // 5. Query asking for LATE ARRIVALS across all categories
    if (q.includes("late")) {
      const plantLateStr = plant.late.length
        ? plant.late.map((e) => `  • **${e.name}** (${e.formattedIn} — *${e.lateDuration} late*)`).join("\n")
        : "  *(None)*";

      const articleLateStr = article.late.length
        ? article.late.map((e) => `  • **${e.name}** (${e.formattedIn} — *${e.lateDuration} late*)`).join("\n")
        : "  *(None)*";

      const officeLateStr = backOffice.late.length
        ? backOffice.late.map((e) => `  • **${e.name}** (${e.formattedIn} — *${e.lateDuration} late*)`).join("\n")
        : "  *(None)*";

      const seniorLateStr = senior.late.length
        ? senior.late.map((e) => `  • **${e.name}** (${e.formattedIn} — *${e.lateDuration} late*)`).join("\n")
        : "  *(None)*";

      const partnerLateStr = partner.late.length
        ? partner.late.map((e) => `  • **${e.name}** (${e.formattedIn} — *${e.lateDuration} late*)`).join("\n")
        : "  *(None)*";

      const mdLateStr = md.late.length
        ? md.late.map((e) => `  • **${e.name}** (${e.formattedIn} — *${e.lateDuration} late*)`).join("\n")
        : "  *(None)*";

      return `⏰ **Today's Late Arrivals by Category** *(Late minutes counted from grace time)*:\n\n• **Total Late Across Categories**: **${allLate.length} employees**\n\n🏭 **Plant Audit Staff (Cut-off: ${plantCutoffText} | Grace: ${plantGraceText})** — **${plant.late.length} late**:\n${plantLateStr}\n\n📚 **Articles (Cut-off: ${articleCutoffText} | Grace: ${articleGraceText})** — **${article.late.length} late**:\n${articleLateStr}\n\n🏢 **Back Office (Cut-off: ${officeCutoffText} | Grace: ${officeGraceText})** — **${backOffice.late.length} late**:\n${officeLateStr}\n\n👔 **Seniors (Cut-off: ${seniorCutoffText} | Grace: ${seniorGraceText})** — **${senior.late.length} late**:\n${seniorLateStr}\n\n🤝 **Partners (Cut-off: ${partnerCutoffText} | Grace: ${partnerGraceText})** — **${partner.late.length} late**:\n${partnerLateStr}\n\n👑 **MD (Cut-off: ${mdCutoffText} | Grace: ${mdGraceText})** — **${md.late.length} late**:\n${mdLateStr}\n\n👇 **Download Today's Daily Attendance Report:**\n[DOWNLOAD_DAILY_BUTTONS]`;
    }

    // 6. Query asking for EARLY LOGINS before cut-off
    if (q.includes("early") || q.includes("before cut-off") || q.includes("before cutoff") || q.includes("before time")) {
      const plantEarlyStr = plant.early.length
        ? plant.early.map((e) => `  • **${e.name}** ${e.isSpecialShift ? `[${e.categoryShort}]` : ""} — In at **${e.formattedIn}** (*${e.earlyDuration} before ${formatCutoffDisplay(e.cutoff)} cut-off*)`).join("\n")
        : "  *(None)*";

      const articleEarlyStr = article.early.length
        ? article.early.map((e) => `  • **${e.name}** ${e.isSpecialShift ? `[${e.categoryShort}]` : ""} — In at **${e.formattedIn}** (*${e.earlyDuration} before ${formatCutoffDisplay(e.cutoff)} cut-off*)`).join("\n")
        : "  *(None)*";

      const officeEarlyStr = backOffice.early.length
        ? backOffice.early.map((e) => `  • **${e.name}** ${e.isSpecialShift ? `[${e.categoryShort}]` : ""} — In at **${e.formattedIn}** (*${e.earlyDuration} before ${formatCutoffDisplay(e.cutoff)} cut-off*)`).join("\n")
        : "  *(None)*";

      const seniorEarlyStr = senior.early.length
        ? senior.early.map((e) => `  • **${e.name}** ${e.isSpecialShift ? `[${e.categoryShort}]` : ""} — In at **${e.formattedIn}** (*${e.earlyDuration} before ${formatCutoffDisplay(e.cutoff)} cut-off*)`).join("\n")
        : "  *(None)*";

      const partnerEarlyStr = partner.early.length
        ? partner.early.map((e) => `  • **${e.name}** ${e.isSpecialShift ? `[${e.categoryShort}]` : ""} — In at **${e.formattedIn}** (*${e.earlyDuration} before ${formatCutoffDisplay(e.cutoff)} cut-off*)`).join("\n")
        : "  *(None)*";

      const mdEarlyStr = md.early.length
        ? md.early.map((e) => `  • **${e.name}** ${e.isSpecialShift ? `[${e.categoryShort}]` : ""} — In at **${e.formattedIn}** (*${e.earlyDuration} before ${formatCutoffDisplay(e.cutoff)} cut-off*)`).join("\n")
        : "  *(None)*";

      return `🌅 **Employees with Early Login (Before Cut-off Time)**:\n\n• **Total Early Logins**: **${allEarly.length} employees** (Arrived ahead of official shift cut-off)\n\n🏭 **Plant Audit Staff (Cut-off: ${plantCutoffText})** — **${plant.early.length} early**:\n${plantEarlyStr}\n\n📚 **Articles (Cut-off: ${articleCutoffText})** — **${article.early.length} early**:\n${articleEarlyStr}\n\n🏢 **Back Office (Cut-off: ${officeCutoffText})** — **${backOffice.early.length} early**:\n${officeEarlyStr}\n\n👔 **Seniors (Cut-off: ${seniorCutoffText})** — **${senior.early.length} early**:\n${seniorEarlyStr}\n\n🤝 **Partners (Cut-off: ${partnerCutoffText})** — **${partner.early.length} early**:\n${partnerEarlyStr}\n\n👑 **MD (Cut-off: ${mdCutoffText})** — **${md.early.length} early**:\n${mdEarlyStr}\n\n👏 *Great discipline shown by employees logging in ahead of their cut-off time!*`;
    }

    // 7. Query asking for WORKING HOURS of employees
    if (q.includes("working hour") || q.includes("work hour") || q.includes("hours worked") || q.includes("worked hours") || q.includes("working time") || q.includes("work time")) {
      const sortedByHours = [...present].sort((a, b) => (b.workedMinutes || 0) - (a.workedMinutes || 0));
      const completed = sortedByHours.filter((e) => e.isCheckedOut);
      const active = sortedByHours.filter((e) => !e.isCheckedOut);

      const activeListStr = active.length
        ? active.map((e) => `  • **${e.name}** [${e.categoryShort}] — **${e.formattedWorkingHours}** (In at ${e.formattedIn} • *Active*)`).join("\n")
        : "  *(None)*";

      const completedListStr = completed.length
        ? completed.map((e) => `  • **${e.name}** [${e.categoryShort}] — **${e.formattedWorkingHours}** (In: ${e.formattedIn} ➔ Out: ${e.formattedOut})`).join("\n")
        : "  *(No employees have checked out yet today)*";

      return `⏳ **Employee Working Hours Today**:\n\n• 👥 **Total Punched In**: **${present.length} employees**\n• 🚪 **Shift Completed (Punched Out)**: **${completed.length} employees**\n• 🟢 **Currently Working (Active)**: **${active.length} employees**\n\n🟢 **Currently Active Employees (Working Duration So Far)**:\n${activeListStr}\n\n🚪 **Shift Completed (Total Hours Worked)**:\n${completedListStr}\n\n💡 *Tip: Ask about any individual employee (e.g. "What are the working hours of CA Harsh Mittal?") for their personal shift breakdown.*`;
    }

    // 8. Query asking for ABSENT
    if (
      q.includes("absent") ||
      q.includes("not present") ||
      q.includes("not come") ||
      q.includes("didn't come") ||
      q.includes("did not come") ||
      q.includes("absentees") ||
      q.includes("absence")
    ) {
      const plantAbsentStr = plant.absent.length
        ? plant.absent.map((e) => `  • **${e.name}**`).join("\n")
        : "  *(None — All plant audit staff present! 🎉)*";

      const articleAbsentStr = article.absent.length
        ? article.absent.map((e) => `  • **${e.name}**`).join("\n")
        : "  *(None — All articles present! 🎉)*";

      const officeAbsentStr = backOffice.absent.length
        ? backOffice.absent.map((e) => `  • **${e.name}** ${e.isSpecialShift ? `[${e.categoryShort}]` : ""}`).join("\n")
        : "  *(None — All back office staff present! 🎉)*";

      const seniorAbsentStr = senior.absent.length
        ? senior.absent.map((e) => `  • **${e.name}** ${e.isSpecialShift ? `[${e.categoryShort}]` : ""}`).join("\n")
        : "  *(None — All seniors present! 🎉)*";

      const partnerAbsentStr = partner.absent.length
        ? partner.absent.map((e) => `  • **${e.name}**`).join("\n")
        : "  *(None — All partners present! 🎉)*";

      const mdAbsentStr = md.absent.length
        ? md.absent.map((e) => `  • **${e.name}**`).join("\n")
        : "  *(None — MD Rajesh Agrawal present! 🎉)*";

      return `❌ **Today's Absent Employees Summary & Department List**:\n\n• 👥 **Total Absent**: **${absent.length}** out of ${total} registered employees (${total > 0 ? Math.round((absent.length / total) * 100) : 0}%)\n• ✅ **Total Present**: **${present.length}** employees\n\n━━━━━━━━━━━━━━━━━━━━\n📋 **Department Breakdown & Absentee List**:\n\n🏭 **Plant Audit Staff** — **${plant.absent.length} absent** (out of ${plant.total}):\n${plantAbsentStr}\n\n📚 **Articles** — **${article.absent.length} absent** (out of ${article.total}):\n${articleAbsentStr}\n\n🏢 **Back Office** — **${backOffice.absent.length} absent** (out of ${backOffice.total}):\n${officeAbsentStr}\n\n👔 **Seniors** — **${senior.absent.length} absent** (out of ${senior.total}):\n${seniorAbsentStr}\n\n🤝 **Partners** — **${partner.absent.length} absent** (out of ${partner.total}):\n${partnerAbsentStr}\n\n👑 **MD** — **${md.absent.length} absent** (out of ${md.total}):\n${mdAbsentStr}\n\n👇 **Download Today's Daily Attendance Report:**\n[DOWNLOAD_DAILY_BUTTONS]\n\n💡 *Tip: Ask about any individual employee (e.g. "Is Akshita Agrawal absent?") for personal punch records.*`;
    }
    // 9. Query asking for PRESENT
    if (q.includes("present") || q.includes("attended")) {
      return `👥 **Today's Attendance Status**:\n\n• **Total Present (Punched In)**: **${present.length} employees** (${total > 0 ? Math.round((present.length / total) * 100) : 0}% of ${total})\n\n• 🏭 **Plant Audit**: **${plant.present.length}** / ${plant.total} present (${plant.early.length} early, ${plant.withinGrace.length} in grace)\n• 📚 **Articles**: **${article.present.length}** / ${article.total} present (${article.early.length} early, ${article.withinGrace.length} in grace)\n• 🏢 **Back Office**: **${backOffice.present.length}** / ${backOffice.total} present (${backOffice.early.length} early, ${backOffice.withinGrace.length} in grace)\n• 👔 **Seniors**: **${senior.present.length}** / ${senior.total} present (${senior.early.length} early, ${senior.withinGrace.length} in grace)\n• 🤝 **Partners**: **${partner.present.length}** / ${partner.total} present (${partner.early.length} early, ${partner.withinGrace.length} in grace)\n• 👑 **MD**: **${md.present.length}** / ${md.total} present (${md.early.length} early, ${md.withinGrace.length} in grace)\n• 🚪 **Already Checked Out**: ${checkedOut.length} employees`;
    }

    // 10. Query asking for CLIENT PLACE
    if (q.includes("client")) {
      const clientList = atClient
        .slice(0, 10)
        .map((e) => `• **${e.name}** [${e.categoryShort}] - ${e.clientPlace} (In: ${e.formattedIn || "N/A"})`)
        .join("\n");

      return `🏢 **Employees at Client Places**:\n\n• **Total at Client Sites**: **${atClient.length} employees**\n\n${clientList || "No employees registered at client place today."}`;
    }

    // 11. Query asking to DOWNLOAD / EXPORT in Excel or PDF
    if (
      q.includes("download") ||
      q.includes("downlaod") ||
      q.includes("export") ||
      (q.includes("excel") && (q.includes("pdf") || q.includes("format") || q.includes("sheet") || q.includes("file") || q.includes("get") || q.includes("give"))) ||
      (q.includes("pdf") && (q.includes("excel") || q.includes("format") || q.includes("sheet") || q.includes("file") || q.includes("get") || q.includes("give")))
    ) {
      if (q.includes("daily") || q.includes("today")) {
        return `📥 **Daily Attendance Report Download (Today's Live Records)**:\n\nYou can download today's real-time attendance report in both **Excel (.xlsx)** and **PDF (.pdf)** formats:\n\n• 👥 **Total Registered Staff**: **${total} employees**\n• ✅ **Present Today**: **${present.length}** (🌅 ${allEarly.length} early logins, 🟡 ${allWithinGrace.length} within grace)\n• ⏰ **Late Arrivals Today**: **${allLate.length}** *(calculated strictly against category shift grace times)*\n• ❌ **Absent Today**: **${absent.length}**\n• 🏢 **At Client Sites**: **${atClient.length}**\n• ⏱️ **Category Shift Reference**: Plant (${plantGraceText}), Articles (${articleGraceText}), Back Office (${officeGraceText}), Seniors (${seniorGraceText}), Partners (${partnerGraceText}), MD (${mdGraceText})\n\n👇 **Download Today's Daily Attendance Report:**\n[DOWNLOAD_DAILY_BUTTONS]`;
      }
      if (q.includes("weekly") || q.includes("week")) {
        return `📥 **Weekly Attendance Report Download (${activeWeeklyData?.weekRange || "Past 7 Days"})**:\n\nYou can download the complete weekly attendance summary in both **Excel (.xlsx)** and **PDF (.pdf)** formats:\n\n• 👥 **Active Staff**: ${activeWeeklyData?.list?.length || 0} employees\n• 📈 **Average Compliance**: ${Math.round((activeWeeklyData?.list || []).reduce((acc, cur) => acc + (cur.attendancePct || 0), 0) / ((activeWeeklyData?.list?.length) || 1))}%\n• 🗓️ **Includes**: Weekly attendance rate, days present, late instances & hours worked.\n\n👇 **Download Weekly Attendance Report:**\n[DOWNLOAD_WEEKLY_BUTTONS]`;
      }
      if (q.includes("monthly") || q.includes("month")) {
        return `📥 **Monthly Attendance Register Download (${activeMonthlyData?.monthName || "Current Month"})**:\n\nYou can download the full monthly attendance register in both **Excel (.xlsx)** and **PDF (.pdf)** formats:\n\n• 👥 **Total Evaluated**: ${activeMonthlyData?.monthlySummaries?.length || 0} employees\n• 🗓️ **Working Days**: ${activeMonthlyData?.workingDaysCount || 27} days\n• 🔗 **Source**: Google Sheet Register\n\n👇 **Download Monthly Attendance Register:**\n[DOWNLOAD_MONTHLY_BUTTONS]`;
      }

      return `📥 **Download Attendance Reports (Daily, Weekly & Monthly)**:\n\nYou can download real-time attendance reports in both **Excel (.xlsx)** and **PDF (.pdf)** formats for any time period:\n\n• 📅 **Daily Report**: Today's live punches, shift cut-offs, late durations & working hours.\n• 🗓️ **Weekly Report**: Past 7 days summary, working hours & day-by-day logs.\n• 📊 **Monthly Register**: Full month attendance register, compliance % & logs from Google Sheet.\n\n👇 **Choose your desired report below:**\n[DOWNLOAD_BUTTONS]`;
    }

    // 12. Full Summary / Daily Attendance Report & General Attendance Inquiries
    const cleanQ = cleanString(q);
    const isGeneralAttendanceQuery =
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
      q.includes("log") ||
      q.includes("punch") ||
      q.includes("aaj") ||
      q.includes("sab") ||
      q.includes("all") ||
      q.includes("detail") ||
      q.includes("info") ||
      q.includes("kaise") ||
      q.includes("dikhao") ||
      q.includes("batao") ||
      cleanQ === "" ||
      cleanQ === "hi" ||
      cleanQ === "hello" ||
      cleanQ === "hey";

    if (isGeneralAttendanceQuery) {
      const lateList = allLate.length > 0
        ? allLate.map((e) => `• **${e.name}** [${e.categoryShort}] — In at **${e.formattedIn}** (*${e.lateDuration} late*)`).join("\n")
        : "• *All present staff punched in on time or within grace period! 🎉*";

      const clientList = atClient.length > 0
        ? atClient.map((e) => `• **${e.name}** [${e.categoryShort}] — ${e.clientPlace} (In at ${e.formattedIn})`).join("\n")
        : "";

      return `📊 **Today's Live Attendance Report & Executive Summary**\n• 📅 **Date**: ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n\n• 👥 **Total Registered Staff**: **${total} employees**\n• ✅ **Present Today**: **${present.length}** (🌅 ${allEarly.length} early logins, 🟡 ${allWithinGrace.length} within grace)\n• ⏰ **Late Arrivals Today**: **${allLate.length}** *(calculated strictly against category shift grace times)*\n• ❌ **Absent Today**: **${absent.length}**\n• 🏢 **At Client Sites**: **${atClient.length}**\n\n━━━━━━━━━━━━━━━━━━━━\n📌 **Department Attendance Breakdown**:\n\n👑 **MD (Rajesh Agrawal)** (Cut-off: ${mdCutoffText} | Grace: ${mdGraceText}):\n• Present: ${md.present.length} / ${md.total} | Late: ${md.late.length} | Absent: ${md.absent.length}\n\n🤝 **Partners (Rupesh Vaid, CA Ankit Garg, Mukul C)** (Cut-off: ${partnerCutoffText} | Grace: ${partnerGraceText}):\n• Present: ${partner.present.length} / ${partner.total} | Late: ${partner.late.length} | Absent: ${partner.absent.length}\n\n👔 **Seniors (Chartered Accountants / Senior Staff)** (Cut-off: ${seniorCutoffText} | Grace: ${seniorGraceText}):\n• Present: ${senior.present.length} / ${senior.total} | Early: ${senior.early.length} | Late: ${senior.late.length} | Absent: ${senior.absent.length}\n\n🏭 **Plant Audit Staff** (Cut-off: ${plantCutoffText} | Grace: ${plantGraceText}):\n• Present: ${plant.present.length} / ${plant.total} | Early: ${plant.early.length} | Late: ${plant.late.length} | Absent: ${plant.absent.length}\n\n📚 **Articles** (Cut-off: ${articleCutoffText} | Grace: ${articleGraceText}):\n• Present: ${article.present.length} / ${article.total} | Early: ${article.early.length} | Late: ${article.late.length} | Absent: ${article.absent.length}\n\n🏢 **Back Office** (Cut-off: ${officeCutoffText} | Grace: ${officeGraceText}):\n• Present: ${backOffice.present.length} / ${backOffice.total} | Early: ${backOffice.early.length} | Late: ${backOffice.late.length} | Absent: ${backOffice.absent.length}\n\n━━━━━━━━━━━━━━━━━━━━\n⏰ **Today's Late Arrivals List**:\n${lateList}\n\n${clientList ? `━━━━━━━━━━━━━━━━━━━━\n🏢 **Staff At Client Sites**:\n${clientList}\n\n` : ""}👇 **Download Today's Daily Attendance Report:**\n[DOWNLOAD_DAILY_BUTTONS]\n\n💡 *Tip: Ask about any specific employee (e.g. "CA Harsh Mittal") or department (e.g. "Seniors status", "Plant audit staff") for deeper insights!*`;
    }

    // Default friendly answer
    return `🔍 **Attendance Insight for "${query}"**:\n\n• **Total Registered**: ${total}\n• **Present**: ${present.length} (🌅 ${allEarly.length} early, 🟡 ${allWithinGrace.length} within grace)\n• **Absent**: ${absent.length}\n• **Late Across Categories**: ${allLate.length}\n\n*💡 Shifts & Grace Times:* \n🏭 Plant: ${plantGraceText} | 📚 Articles: ${articleGraceText} | 🏢 Office: ${officeGraceText} | 👔 Seniors: ${seniorGraceText} | 🤝 Partners: ${partnerGraceText} | 👑 MD: ${mdGraceText}\n\n👇 **Download Today's Daily Attendance Report:**\n[DOWNLOAD_DAILY_BUTTONS]`;
  };

  // Call OpenAI API with Category-Aware Context
  const callOpenAI = async (userPrompt) => {
    const {
      total,
      present,
      absent,
      allEarly,
      allLate,
      plant,
      article,
      backOffice,
      senior,
      partner,
      md,
    } = attendanceMetrics;

    const plantCutoffText = formatCutoffDisplay(shiftPolicies.PLANT_AUDIT?.cutoff || "10:30");
    const plantGraceText = formatCutoffDisplay(shiftPolicies.PLANT_AUDIT?.grace || "10:35");

    const articleCutoffText = formatCutoffDisplay(shiftPolicies.ARTICLE?.cutoff || "11:00");
    const articleGraceText = formatCutoffDisplay(shiftPolicies.ARTICLE?.grace || "11:05");

    const officeCutoffText = formatCutoffDisplay(shiftPolicies.BACK_OFFICE?.cutoff || "10:00");
    const officeGraceText = formatCutoffDisplay(shiftPolicies.BACK_OFFICE?.grace || "10:05");

    const seniorCutoffText = formatCutoffDisplay(shiftPolicies.SENIOR?.cutoff || shiftPolicies.SENIOR_PARTNER_MD?.cutoff || "10:00");
    const seniorGraceText = formatCutoffDisplay(shiftPolicies.SENIOR?.grace || shiftPolicies.SENIOR_PARTNER_MD?.grace || "10:05");

    const partnerCutoffText = formatCutoffDisplay(shiftPolicies.PARTNER?.cutoff || "10:00");
    const partnerGraceText = formatCutoffDisplay(shiftPolicies.PARTNER?.grace || "10:05");

    const mdCutoffText = formatCutoffDisplay(shiftPolicies.MD?.cutoff || "10:00");
    const mdGraceText = formatCutoffDisplay(shiftPolicies.MD?.grace || "10:05");

    const mSummaries = activeMonthlyData?.monthlySummaries || [];
    const wSummaries = activeWeeklyData?.list || [];

    const matchedInfo = findMatchingEmployees(userPrompt, validRows);
    const matchedContext =
      matchedInfo.matches.length > 0
        ? `\nSPECIFIC MATCHED EMPLOYEES FOR THIS QUERY (TODAY'S STATUS + MONTHLY & WEEKLY LATE/ABSENT SUMMARY):\n${matchedInfo.matches
            .map((e) => {
              const info = evaluateEmployee(e);
              const mRec = findExactOrBestRecord(mSummaries, info.name);
              const wRec = findExactOrBestRecord(wSummaries, info.name);

              const todayStr = info.isAbsent
                ? `TODAY'S LIVE STATUS: ABSENT (No check-in record logged | Shift Cut-off: ${formatCutoffDisplay(info.cutoff)}, Grace: ${formatCutoffDisplay(info.grace)})`
                : info.isLate
                ? `TODAY'S LIVE STATUS: LATE (Punched in at ${info.formattedIn} | Late by: ${info.lateDuration} after ${formatCutoffDisplay(info.grace)} grace | Shift Cut-off: ${formatCutoffDisplay(info.cutoff)} | Location: ${info.workSite} | Worked: ${info.formattedWorkingHours})`
                : info.isWithinGrace
                ? `TODAY'S LIVE STATUS: PRESENT Within Grace (In at ${info.formattedIn} | 0m late | Grace: ${formatCutoffDisplay(info.grace)} | Worked: ${info.formattedWorkingHours})`
                : `TODAY'S LIVE STATUS: PRESENT On Time (In at ${info.formattedIn} | Early: ${info.isEarly ? info.earlyDuration : "No"} | Worked: ${info.formattedWorkingHours})`;

              const mStr = mRec
                ? `MONTHLY SUMMARY (October 2026 - ${mRec.totalDays || monthlyData?.workingDaysCount || 26} days): ${mRec.lateDays || 0} Late Days, ${mRec.daysAbsent || 0} Absent Days, ${mRec.daysPresent || 0} Days Present (${mRec.attendancePct}% compliance), Hours Worked: ${mRec.totalWorkingHours || "N/A"}`
                : `MONTHLY SUMMARY: (Monthly data syncing)`;

              const wStr = wRec
                ? `WEEKLY SUMMARY (${weeklyData?.weekRange || "Past 7 Days"} - ${wRec.totalDays || 6} days): ${wRec.lateDays || 0} Late Days, ${wRec.daysAbsent || 0} Absent Days, ${wRec.daysPresent || 0} Days Present (${wRec.attendancePct}% compliance), Hours Worked: ${wRec.totalWorkingHours || "N/A"}`
                : `WEEKLY SUMMARY: (Weekly data syncing)`;

              return `- ${info.name} [${info.categoryLabel}]:\n  * ${todayStr}\n  * ${mStr}\n  * ${wStr}`;
            })
            .join("\n")}\n`
        : "";

    const formatDeptGroupedLate = (items) => {
      if (!items || items.length === 0) return "None";
      const cats = [
        { key: "MD", label: "👑 MD" },
        { key: "PARTNER", label: "🤝 Partners" },
        { key: "SENIOR", label: "👔 Seniors" },
        { key: "PLANT_AUDIT", label: "🏭 Plant Audit" },
        { key: "ARTICLE", label: "📚 Articles" },
        { key: "BACK_OFFICE", label: "🏢 Back Office" },
      ];
      return cats
        .map((c) => {
          const inCat = items.filter((e) => e.categoryKey === c.key && (e.lateDays || 0) > 0);
          if (inCat.length === 0) return null;
          return `  ${c.label} (${inCat.length} late): ` + inCat.map((e) => `${e.employee} (${e.lateDays}d late)`).join(", ");
        })
        .filter(Boolean)
        .join("\n");
    };

    const formatDeptGroupedAbsent = (items) => {
      if (!items || items.length === 0) return "None";
      const cats = [
        { key: "MD", label: "👑 MD" },
        { key: "PARTNER", label: "🤝 Partners" },
        { key: "SENIOR", label: "👔 Seniors" },
        { key: "PLANT_AUDIT", label: "🏭 Plant Audit" },
        { key: "ARTICLE", label: "📚 Articles" },
        { key: "BACK_OFFICE", label: "🏢 Back Office" },
      ];
      return cats
        .map((c) => {
          const inCat = items.filter((e) => e.categoryKey === c.key && (e.daysAbsent || 0) > 0);
          if (inCat.length === 0) return null;
          return `  ${c.label} (${inCat.length} absent): ` + inCat.map((e) => `${e.employee} (${e.daysAbsent}d absent, ${e.attendancePct}%)`).join(", ");
        })
        .filter(Boolean)
        .join("\n");
    };

    const monthlyLateBreakdownPrompt = formatDeptGroupedLate(mSummaries);
    const monthlyAbsentBreakdownPrompt = formatDeptGroupedAbsent(mSummaries);
    const weeklyLateBreakdownPrompt = formatDeptGroupedLate(wSummaries);
    const weeklyAbsentBreakdownPrompt = formatDeptGroupedAbsent(wSummaries);

    const systemPrompt = `You are an AI Attendance Analyst for Agrawal Jain & Co. (a Chartered Accountancy firm).
You analyze real-time attendance report data for today, this week, and this month, and answer questions accurately, concisely, and professionally.

CRITICAL DIFFERENTIATION & CALENDAR RULES:
0. SUNDAYS ARE WEEKLY OFF (NOT ABSENT) & CALENDAR CYCLES:
   - Sundays are non-working weekly off days (offices are closed).
   - NEVER count Sundays as absent days for any employee. Sunday absence count is always 0.
   - ACCURATE CALENDAR WORKING DAYS: Month working days are determined by actual calendar days excluding Sundays (e.g., October 2026 has 31 days - 4 Sundays = 27 working days).
   - WEEK CYCLE: Every week strictly starts on Monday and ends on Saturday (6 working days). Every Monday marks a brand new week!
   - Monthly and weekly absence calculations count ONLY working days (Monday to Saturday).
1. PLANT AUDIT STAFF (🏭): Official Cut-off is ${plantCutoffText}, Grace is ${plantGraceText}.
   - LATE MINUTES ARE COUNTED STRICTLY FROM THE GRACE TIME (${plantGraceText}).
   - Punched at or before ${plantGraceText} = NOT LATE (0 minutes late).
   - Punched after ${plantGraceText} = LATE (Minutes Late = Arrival Time minus ${plantGraceText}).
2. ARTICLES (📚): Official Cut-off is ${articleCutoffText}, Grace is ${articleGraceText}.
   - LATE MINUTES ARE COUNTED STRICTLY FROM THE GRACE TIME (${articleGraceText}).
   - Punched at or before ${articleGraceText} = NOT LATE (0 minutes late).
   - Punched after ${articleGraceText} = LATE (Minutes Late = Arrival Time minus ${articleGraceText}).
3. BACK OFFICE (🏢): Official Cut-off is ${officeCutoffText}, Grace is ${officeGraceText}.
   - LATE MINUTES ARE COUNTED STRICTLY FROM THE GRACE TIME (${officeGraceText}).
   - Punched at or before ${officeGraceText} = NOT LATE (0 minutes late).
   - Punched after ${officeGraceText} = LATE (Minutes Late = Arrival Time minus ${officeGraceText}).
4. SENIORS (👔): Official Cut-off is ${seniorCutoffText}, Grace is ${seniorGraceText}. Senior CAs and remaining senior employees.
   - LATE MINUTES ARE COUNTED STRICTLY FROM THE GRACE TIME (${seniorGraceText}).
   - Punched at or before ${seniorGraceText} = NOT LATE (0 minutes late).
   - Punched after ${seniorGraceText} = LATE (Minutes Late = Arrival Time minus ${seniorGraceText}).
5. PARTNERS (🤝): Official Cut-off is ${partnerCutoffText}, Grace is ${partnerGraceText}.
   - Designated Partners: Rupesh Vaid, CA Ankit Kumar Garg, Mukul C.
   - LATE MINUTES ARE COUNTED STRICTLY FROM THE GRACE TIME (${partnerGraceText}).
   - Punched at or before ${partnerGraceText} = NOT LATE (0 minutes late).
   - Punched after ${partnerGraceText} = LATE (Minutes Late = Arrival Time minus ${partnerGraceText}).
6. MD (👑): Official Cut-off is ${mdCutoffText}, Grace is ${mdGraceText}.
   - Managing Director: Rajesh Agrawal.
   - LATE MINUTES ARE COUNTED STRICTLY FROM THE GRACE TIME (${mdGraceText}).
   - Punched at or before ${mdGraceText} = NOT LATE (0 minutes late).
   - Punched after ${mdGraceText} = LATE (Minutes Late = Arrival Time minus ${mdGraceText}).
7. SPECIAL INDIVIDUAL EMPLOYEE SHIFTS (⭐):
${Object.values(INDIVIDUAL_EMPLOYEE_SHIFTS).map((s) => `   - ${s.displayName}: Shift ${s.customNote} (Cut-off: ${formatCutoffDisplay(s.cutoff)}, Grace: ${formatCutoffDisplay(s.grace)}). Late minutes start counting after ${formatCutoffDisplay(s.grace)} grace!`).join("\n")}

TODAY'S SUMMARY METRICS:
- Total Registered: ${total}
- Total Present: ${present.length} | Early Logins (< Cutoff): ${allEarly.length} | Total Absent: ${absent.length} | Total Late: ${allLate.length}

MONTHLY ATTENDANCE REGISTER (Current Month - October 2026):
- Google Sheet URL: ${MONTHLY_GOOGLE_SHEET_URL}
- Total Working Days: ${activeMonthlyData?.workingDaysCount || 26}
- Total Employees in Register: ${mSummaries.length}
- Average Monthly Attendance Rate: ${mSummaries.length ? Math.round(mSummaries.reduce((a, b) => a + (b.attendancePct || 0), 0) / mSummaries.length) : 0}%
- Total Late Punches This Month: ${mSummaries.reduce((acc, c) => acc + (c.lateDays || 0), 0)}
- Total Absent Days This Month: ${mSummaries.reduce((acc, c) => acc + (c.daysAbsent || 0), 0)}
- Monthly Late Employees by Department:
${monthlyLateBreakdownPrompt || "  None"}
- Monthly Absent Employees by Department:
${monthlyAbsentBreakdownPrompt || "  None"}

WEEKLY ATTENDANCE (Period: ${activeWeeklyData?.weekRange || "Past 7 Days"}):
- Active Staff: ${wSummaries.length}
- Total Late Days This Week: ${wSummaries.reduce((acc, c) => acc + (c.lateDays || 0), 0)}
- Total Absent Days This Week: ${wSummaries.reduce((acc, c) => acc + (c.daysAbsent || 0), 0)}
- Weekly Late Employees by Department:
${weeklyLateBreakdownPrompt || "  None"}
- Weekly Absent Employees by Department:
${weeklyAbsentBreakdownPrompt || "  None"}

CATEGORY-WISE STATS:
- Plant Audit Staff: ${plant.present.length} Present (${plant.early.length} Early) | ${plant.absent.length} Absent | ${plant.late.length} Late (> ${plantGraceText})
- Articles: ${article.present.length} Present (${article.early.length} Early) | ${article.absent.length} Absent | ${article.late.length} Late (> ${articleGraceText})
- Back Office: ${backOffice.present.length} Present (${backOffice.early.length} Early) | ${backOffice.absent.length} Absent | ${backOffice.late.length} Late (> ${officeGraceText})
- Seniors: ${senior.present.length} Present (${senior.early.length} Early) | ${senior.absent.length} Absent | ${senior.late.length} Late (> ${seniorGraceText})
- Partners: ${partner.present.length} Present (${partner.early.length} Early) | ${partner.absent.length} Absent | ${partner.late.length} Late (> ${partnerGraceText})
- MD: ${md.present.length} Present (${md.early.length} Early) | ${md.absent.length} Absent | ${md.late.length} Late (> ${mdGraceText})
${matchedContext}
DETAILS OF ALL EMPLOYEES TODAY (Grouped):
[PLANT AUDIT STAFF - CUTOFF ${plantCutoffText} | GRACE ${plantGraceText}]:
${plant.list.map((e) => `- ${e.name} | Status: ${e.isAbsent ? "ABSENT" : e.isLate ? `LATE (${e.lateDuration} late after grace / ${e.minutesLate}m)` : e.isWithinGrace ? "WITHIN GRACE (0m)" : e.isEarly ? `EARLY (${e.earlyDuration} before cut-off)` : "ON TIME"} | In: ${e.inTime || "N/A"} | Out: ${e.outTime || "N/A"} | Work Hours: ${e.formattedWorkingHours} (${e.isCheckedOut ? "Completed" : "Active"}) | Site: ${e.workSite}`).join("\n")}

[ARTICLES - CUTOFF ${articleCutoffText} | GRACE ${articleGraceText}]:
${article.list.map((e) => `- ${e.name} | Status: ${e.isAbsent ? "ABSENT" : e.isLate ? `LATE (${e.lateDuration} late after grace / ${e.minutesLate}m)` : e.isWithinGrace ? "WITHIN GRACE (0m)" : e.isEarly ? `EARLY (${e.earlyDuration} before cut-off)` : "ON TIME"} | In: ${e.inTime || "N/A"} | Out: ${e.outTime || "N/A"} | Work Hours: ${e.formattedWorkingHours} (${e.isCheckedOut ? "Completed" : "Active"}) | Site: ${e.workSite}`).join("\n")}

[BACK OFFICE - CUTOFF ${officeCutoffText} | GRACE ${officeGraceText}]:
${backOffice.list.map((e) => `- ${e.name} | Status: ${e.isAbsent ? "ABSENT" : e.isLate ? `LATE (${e.lateDuration} late after grace / ${e.minutesLate}m)` : e.isWithinGrace ? "WITHIN GRACE (0m)" : e.isEarly ? `EARLY (${e.earlyDuration} before cut-off)` : "ON TIME"} | In: ${e.inTime || "N/A"} | Out: ${e.outTime || "N/A"} | Work Hours: ${e.formattedWorkingHours} (${e.isCheckedOut ? "Completed" : "Active"}) | Site: ${e.workSite}`).join("\n")}

[SENIORS - CUTOFF ${seniorCutoffText} | GRACE ${seniorGraceText}]:
${senior.list.map((e) => `- ${e.name} | Status: ${e.isAbsent ? "ABSENT" : e.isLate ? `LATE (${e.lateDuration} late after grace / ${e.minutesLate}m)` : e.isWithinGrace ? "WITHIN GRACE (0m)" : e.isEarly ? `EARLY (${e.earlyDuration} before cut-off)` : "ON TIME"} | In: ${e.inTime || "N/A"} | Out: ${e.outTime || "N/A"} | Work Hours: ${e.formattedWorkingHours} (${e.isCheckedOut ? "Completed" : "Active"}) | Site: ${e.workSite}`).join("\n")}

[PARTNERS - CUTOFF ${partnerCutoffText} | GRACE ${partnerGraceText}]:
${partner.list.map((e) => `- ${e.name} | Status: ${e.isAbsent ? "ABSENT" : e.isLate ? `LATE (${e.lateDuration} late after grace / ${e.minutesLate}m)` : e.isWithinGrace ? "WITHIN GRACE (0m)" : e.isEarly ? `EARLY (${e.earlyDuration} before cut-off)` : "ON TIME"} | In: ${e.inTime || "N/A"} | Out: ${e.outTime || "N/A"} | Work Hours: ${e.formattedWorkingHours} (${e.isCheckedOut ? "Completed" : "Active"}) | Site: ${e.workSite}`).join("\n")}

[MD - CUTOFF ${mdCutoffText} | GRACE ${mdGraceText}]:
${md.list.map((e) => `- ${e.name} | Status: ${e.isAbsent ? "ABSENT" : e.isLate ? `LATE (${e.lateDuration} late after grace / ${e.minutesLate}m)` : e.isWithinGrace ? "WITHIN GRACE (0m)" : e.isEarly ? `EARLY (${e.earlyDuration} before cut-off)` : "ON TIME"} | In: ${e.inTime || "N/A"} | Out: ${e.outTime || "N/A"} | Work Hours: ${e.formattedWorkingHours} (${e.isCheckedOut ? "Completed" : "Active"}) | Site: ${e.workSite}`).join("\n")}

INSTRUCTIONS:
1. Always evaluate lateness using the employee's SPECIFIC CATEGORY grace time.
2. If employee punched in during the grace window, clearly mention they are within grace (NOT late, 0 mins late).
3. If employee is late, state lateness counted strictly FROM THE GRACE TIME. If late by 60 minutes or more, ALWAYS format and display it in hours and minutes (e.g. "1 hr 15 mins late", "2 hrs late", with optional total minutes like "(75 mins)"). If under 60 minutes, state "X mins late".
4. EARLY LOGINS (🌅): If user asks about early logins, list employees whose punch-in time is strictly BEFORE their official cut-off time, along with how many minutes or hours they arrived early.
5. WORKING HOURS (⏳): If user asks about working hours, state their total worked hours (between punch in and punch out if completed, or active hours logged so far if active).
6. ABSENT EMPLOYEES (❌): If user asks how many employees are absent or who is absent, ALWAYS provide both the summary metrics (total absent and department counts) AND the full list of absent employees grouped by their names and respective departments (Plant Audit Staff, Articles, Back Office, Seniors, Partners & MD).
7. MONTHLY & WEEKLY ENQUIRIES: If user asks about monthly or weekly attendance, who is late, or who is absent, ALWAYS provide the exact list of employees who are late (with their late days) and absent (with their absent days and attendance %) grouped by their departments (👑 MD, 🤝 Partners, 👔 Seniors, 🏭 Plant Audit, 📚 Articles, 🏢 Back Office), matching the layout of the daily attendance report!
8. Keep responses structured, concise, and polite with markdown bullet points and emojis.
9. DOWNLOAD & EXPORTS (📥):
   - For daily reports, today's attendance summary, or when user asks to download daily attendance (in Excel or PDF), append [DOWNLOAD_DAILY_BUTTONS].
   - For weekly reports or when user asks for weekly attendance / download weekly, append [DOWNLOAD_WEEKLY_BUTTONS].
   - For monthly reports or when user asks for monthly attendance / download monthly, append [DOWNLOAD_MONTHLY_BUTTONS].
   - If user asks generally to download all reports or multiple periods, append [DOWNLOAD_BUTTONS].
10. INDIVIDUAL EMPLOYEE REPORTS & SUMMARIES (👤):
    - When user asks about an individual employee (e.g. "report of CA Harsh Mittal", "tell me about Meenu Patel", "is an employee late or absent", or asks for employee summary):
      a. State TODAY'S LIVE STATUS FIRST:
         - If LATE: clearly report they are LATE today, their exact punch in time, late duration counted strictly after grace, shift cut-off, location, and hours worked.
         - If ABSENT: clearly report they are ABSENT today (no check-in record logged), with expected shift cut-off and grace time.
         - If ON TIME or WITHIN GRACE: state they are present and on time/within grace with punch-in time and hours worked.
      b. State CUMULATIVE LATE & ABSENT SUMMARY:
         - This Month (October 2026 - 27 Calendar Working Days, Excl. Sundays): Exact count of Late Days, Absent Days (Sundays excluded - Weekly Off), Days Present, and compliance rate %.
         - This Week (Current Week: Mon - Sat, 6 Working Days): Exact count of Late Days, Absent Days (Sundays excluded), Days Present, and compliance rate %.
      c. Provide a brief overall compliance evaluation.

${HR_LABOUR_LAW_SYSTEM_PROMPT}`;

    const recentConversation = messages.slice(-6).map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || `API error (${response.status})`;
      throw new Error(errMsg);
    }

    const data = await response.json();
    return (
      data.choices?.[0]?.message?.content ||
      "Sorry, I couldn't generate a response."
    );
  };

  // Send message
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

      // 1. Check HR & Labour Law statutory policies first
      const hrPolicyAnswer = getHRLabourLawAnswer(textToSend);
      if (hrPolicyAnswer) {
        botResponse = hrPolicyAnswer;
      } else if (apiKey) {
        try {
          botResponse = await callOpenAI(textToSend);
        } catch (apiErr) {
          console.warn("OpenAI API call failed, falling back to local analysis:", apiErr);
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

  // Trigger individual report when an employee is clicked from tables
  useEffect(() => {
    if (selectedEmployee) {
      setIsOpen(true);
      handleSend(`Show individual report for ${selectedEmployee}`);
      if (onClearSelectedEmployee) {
        onClearSelectedEmployee();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee]);

  const clearChat = () => {
    setMessages([
      {
        id: Date.now(),
        sender: "bot",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `Chat cleared. Ask me any question about today's attendance!`,
      },
    ]);
  };

  // Format markdown helper (bolding, bullets, line breaks, inline action buttons)
  const renderFormattedText = (text) => {
    if (!text) return "";
    const hasDownloadButtons = text.includes("[DOWNLOAD_BUTTONS]") || text.includes("[DOWNLOAD_ALL_BUTTONS]");
    const hasDailyButtons = text.includes("[DOWNLOAD_DAILY_BUTTONS]");
    const hasWeeklyButtons = text.includes("[DOWNLOAD_WEEKLY_BUTTONS]");
    const monthlyButtonsMatch = text.match(/\[DOWNLOAD_MONTHLY_BUTTONS(?::(.*?))?\]/);
    const monthlyAttScope = monthlyButtonsMatch ? monthlyButtonsMatch[1] || "CURRENT" : null;

    const cleanText = text
      .replace("[DOWNLOAD_BUTTONS]", "")
      .replace("[DOWNLOAD_ALL_BUTTONS]", "")
      .replace("[DOWNLOAD_DAILY_BUTTONS]", "")
      .replace("[DOWNLOAD_WEEKLY_BUTTONS]", "")
      .replace(/\[DOWNLOAD_MONTHLY_BUTTONS(?::.*?)?\]/g, "")
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

        {/* Inline Multi-Period Download Action Buttons */}
        {hasDownloadButtons && (
          <div className="chat-multi-download-card">
            <div className="multi-dl-section">
              <span className="multi-dl-title">📅 Daily Report:</span>
              <div className="multi-dl-btns">
                <button
                  className="chat-dl-btn excel"
                  onClick={handleDownloadDailyExcel}
                  disabled={isExporting}
                  title="Download Daily Excel (.xlsx)"
                >
                  📊 Daily Excel
                </button>
                <button
                  className="chat-dl-btn pdf"
                  onClick={handleDownloadDailyPDF}
                  disabled={isExporting}
                  title="Download Daily PDF (.pdf)"
                >
                  📄 Daily PDF
                </button>
              </div>
            </div>

            <div className="multi-dl-section">
              <span className="multi-dl-title">🗓️ Weekly Report:</span>
              <div className="multi-dl-btns">
                <button
                  className="chat-dl-btn excel"
                  onClick={handleDownloadWeeklyExcel}
                  disabled={isExporting}
                  title="Download Weekly Excel (.xlsx)"
                >
                  📊 Weekly Excel
                </button>
                <button
                  className="chat-dl-btn pdf"
                  onClick={handleDownloadWeeklyPDF}
                  disabled={isExporting}
                  title="Download Weekly PDF (.pdf)"
                >
                  📄 Weekly PDF
                </button>
              </div>
            </div>

            <div className="multi-dl-section">
              <span className="multi-dl-title">📈 Monthly Register (Google Sheet):</span>
              <div className="multi-dl-btns">
                <button
                  className="chat-dl-btn excel"
                  onClick={handleDownloadMonthlyExcel}
                  disabled={isExporting}
                  title="Download Monthly Excel (.xlsx)"
                >
                  📊 Monthly Excel
                </button>
                <button
                  className="chat-dl-btn pdf"
                  onClick={handleDownloadMonthlyPDF}
                  disabled={isExporting}
                  title="Download Monthly PDF (.pdf)"
                >
                  📄 Monthly PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inline Daily Download Action Buttons */}
        {hasDailyButtons && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              onClick={handleDownloadDailyExcel}
              disabled={isExporting}
              title="Download Daily Attendance as Excel (.xlsx)"
            >
              📊 Download Daily Excel (.xlsx)
            </button>
            <button
              className="chat-dl-btn pdf"
              onClick={handleDownloadDailyPDF}
              disabled={isExporting}
              title="Download Daily Attendance as PDF (.pdf)"
            >
              📄 Download Daily PDF (.pdf)
            </button>
          </div>
        )}

        {hasWeeklyButtons && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              onClick={handleDownloadWeeklyExcel}
              disabled={isExporting}
              title="Download Weekly Attendance as Excel (.xlsx)"
            >
              📊 Download Weekly Excel (.xlsx)
            </button>
            <button
              className="chat-dl-btn pdf"
              onClick={handleDownloadWeeklyPDF}
              disabled={isExporting}
              title="Download Weekly Attendance as PDF (.pdf)"
            >
              📄 Download Weekly PDF (.pdf)
            </button>
          </div>
        )}

        {monthlyAttScope && (
          <div className="chat-inline-download-buttons">
            <button
              className="chat-dl-btn excel"
              onClick={() => handleDownloadMonthlyExcel(monthlyAttScope)}
              disabled={isExporting}
              title="Download Monthly Register as Excel (.xlsx)"
            >
              📊 Download Monthly Excel{monthlyAttScope !== "CURRENT" ? ` (${monthlyAttScope})` : ""} (.xlsx)
            </button>
            <button
              className="chat-dl-btn pdf"
              onClick={() => handleDownloadMonthlyPDF(monthlyAttScope)}
              disabled={isExporting}
              title="Download Monthly Register as PDF (.pdf)"
            >
              📄 Download Monthly PDF{monthlyAttScope !== "CURRENT" ? ` (${monthlyAttScope})` : ""} (.pdf)
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        className={`chatbot-launcher-btn ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open Attendance AI Assistant"
      >
        <span className="chatbot-launcher-icon">✨</span>
        <span className="chatbot-launcher-text">Attendance AI</span>
        <span className="chatbot-status-pulse"></span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-container">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar">🤖</div>
              <div>
                <h3 className="chatbot-title">Attendance AI Analyst</h3>
                <span className="chatbot-sub">
                  {apiKey ? "⚡ OpenAI GPT-4o Connected" : "📊 Multi-Shift Analytics"}
                </span>
              </div>
            </div>

            <div className="chatbot-header-actions">
              {/* Download Dropdown (Daily, Weekly, Monthly) */}
              <div className="chatbot-download-menu-wrapper" ref={exportMenuRef}>
                <button
                  className={`chatbot-action-btn download-btn ${showExportMenu ? "active" : ""}`}
                  title="Download Reports (Daily, Weekly & Monthly Excel / PDF)"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                >
                  📥
                </button>
                {showExportMenu && (
                  <div className="chatbot-export-dropdown">
                    <div className="export-dropdown-header">
                      <span>Download Reports</span>
                      <span className="export-badge">Live</span>
                    </div>

                    {/* Section 1: Daily */}
                    <div className="export-menu-section-title">📅 Daily Attendance</div>
                    <button
                      className="export-dropdown-item excel"
                      onClick={handleDownloadDailyExcel}
                      disabled={isExporting}
                    >
                      <span className="export-item-icon">📊</span>
                      <div className="export-item-info">
                        <strong>Daily Excel (.xlsx)</strong>
                        <small>Today's punches &amp; shift cut-offs</small>
                      </div>
                    </button>
                    <button
                      className="export-dropdown-item pdf"
                      onClick={handleDownloadDailyPDF}
                      disabled={isExporting}
                    >
                      <span className="export-item-icon">📄</span>
                      <div className="export-item-info">
                        <strong>Daily PDF (.pdf)</strong>
                        <small>Landscape executive table</small>
                      </div>
                    </button>

                    {/* Section 2: Weekly */}
                    <div className="export-menu-section-title">🗓️ Weekly Attendance</div>
                    <button
                      className="export-dropdown-item excel"
                      onClick={handleDownloadWeeklyExcel}
                      disabled={isExporting}
                    >
                      <span className="export-item-icon">📊</span>
                      <div className="export-item-info">
                        <strong>Weekly Excel (.xlsx)</strong>
                        <small>7 days summary &amp; daily logs</small>
                      </div>
                    </button>
                    <button
                      className="export-dropdown-item pdf"
                      onClick={handleDownloadWeeklyPDF}
                      disabled={isExporting}
                    >
                      <span className="export-item-icon">📄</span>
                      <div className="export-item-info">
                        <strong>Weekly PDF (.pdf)</strong>
                        <small>Weekly attendance rates &amp; hours</small>
                      </div>
                    </button>

                    {/* Section 3: Monthly */}
                    <div className="export-menu-section-title">📈 Monthly Register</div>
                    <button
                      className="export-dropdown-item excel"
                      onClick={handleDownloadMonthlyExcel}
                      disabled={isExporting}
                    >
                      <span className="export-item-icon">📊</span>
                      <div className="export-item-info">
                        <strong>Monthly Excel (.xlsx)</strong>
                        <small>Google Sheet register &amp; punch logs</small>
                      </div>
                    </button>
                    <button
                      className="export-dropdown-item pdf"
                      onClick={handleDownloadMonthlyPDF}
                      disabled={isExporting}
                    >
                      <span className="export-item-icon">📄</span>
                      <div className="export-item-info">
                        <strong>Monthly PDF (.pdf)</strong>
                        <small>Monthly executive attendance report</small>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <button
                className="chatbot-action-btn"
                title="Shift & API Settings"
                onClick={() => setShowSettings(!showSettings)}
              >
                ⚙️
              </button>
              <button
                className="chatbot-action-btn"
                title="Clear Chat"
                onClick={clearChat}
              >
                🗑️
              </button>
              <button
                className="chatbot-action-btn close-btn"
                title="Close"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Settings Modal / Panel */}
          {showSettings && (
            <div className="chatbot-settings-panel">
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
                  <input
                    type="time"
                    value={tempPlantCutoff}
                    onChange={(e) => setTempPlantCutoff(e.target.value)}
                  />
                  <small style={{ fontSize: "10px", color: "#64748b" }}>
                    Grace: {formatCutoffDisplay(addMinutesToTime(tempPlantCutoff, 5))}
                  </small>
                </div>
                <div className="settings-shift-item">
                  <label>📚 Articles:</label>
                  <input
                    type="time"
                    value={tempArticleCutoff}
                    onChange={(e) => setTempArticleCutoff(e.target.value)}
                  />
                  <small style={{ fontSize: "10px", color: "#64748b" }}>
                    Grace: {formatCutoffDisplay(addMinutesToTime(tempArticleCutoff, 5))}
                  </small>
                </div>
                <div className="settings-shift-item">
                  <label>🏢 Back Office:</label>
                  <input
                    type="time"
                    value={tempOfficeCutoff}
                    onChange={(e) => setTempOfficeCutoff(e.target.value)}
                  />
                  <small style={{ fontSize: "10px", color: "#64748b" }}>
                    Grace: {formatCutoffDisplay(addMinutesToTime(tempOfficeCutoff, 5))}
                  </small>
                </div>
                <div className="settings-shift-item">
                  <label>👔 Seniors:</label>
                  <input
                    type="time"
                    value={tempSeniorCutoff}
                    onChange={(e) => setTempSeniorCutoff(e.target.value)}
                  />
                  <small style={{ fontSize: "10px", color: "#64748b" }}>
                    Grace: {formatCutoffDisplay(addMinutesToTime(tempSeniorCutoff, 5))}
                  </small>
                </div>
                <div className="settings-shift-item">
                  <label>🤝 Partners:</label>
                  <input
                    type="time"
                    value={tempPartnerCutoff}
                    onChange={(e) => setTempPartnerCutoff(e.target.value)}
                  />
                  <small style={{ fontSize: "10px", color: "#64748b" }}>
                    Grace: {formatCutoffDisplay(addMinutesToTime(tempPartnerCutoff, 5))}
                  </small>
                </div>
                <div className="settings-shift-item">
                  <label>👑 MD (Rajesh Agrawal):</label>
                  <input
                    type="time"
                    value={tempMDCutoff}
                    onChange={(e) => setTempMDCutoff(e.target.value)}
                  />
                  <small style={{ fontSize: "10px", color: "#64748b" }}>
                    Grace: {formatCutoffDisplay(addMinutesToTime(tempMDCutoff, 5))}
                  </small>
                </div>
              </div>

              <div className="settings-actions">
                <button className="save-btn" onClick={handleSaveSettings}>
                  Save Settings
                </button>
                <button
                  className="cancel-btn"
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Category Metrics Bar */}
          <div className="chatbot-metrics-bar">
            <span
              className="metric-tag plant"
              title={`Plant Staff: ${attendanceMetrics.plant.present.length} Present, ${attendanceMetrics.plant.late.length} Late (> ${shiftPolicies.PLANT_AUDIT?.grace})`}
              onClick={() => handleSend("Show plant audit staff status")}
            >
              🏭 Plant: <b>{attendanceMetrics.plant.present.length}</b> In / <b>{attendanceMetrics.plant.late.length}</b> Late
            </span>
            <span
              className="metric-tag article"
              title={`Articles: ${attendanceMetrics.article.present.length} Present, ${attendanceMetrics.article.late.length} Late (> ${shiftPolicies.ARTICLE?.grace})`}
              onClick={() => handleSend("Show articles status")}
            >
              📚 Articles: <b>{attendanceMetrics.article.present.length}</b> In / <b>{attendanceMetrics.article.late.length}</b> Late
            </span>
            <span
              className="metric-tag office"
              title={`Back Office: ${attendanceMetrics.backOffice.present.length} Present, ${attendanceMetrics.backOffice.late.length} Late (> ${shiftPolicies.BACK_OFFICE?.grace})`}
              onClick={() => handleSend("Show back office status")}
            >
              🏢 Office: <b>{attendanceMetrics.backOffice.present.length}</b> In / <b>{attendanceMetrics.backOffice.late.length}</b> Late
            </span>
            <span
              className="metric-tag senior"
              title={`Seniors: ${attendanceMetrics.senior.present.length} Present, ${attendanceMetrics.senior.late.length} Late (> ${shiftPolicies.SENIOR?.grace || "10:05"})`}
              onClick={() => handleSend("Show seniors status")}
            >
              👔 Seniors: <b>{attendanceMetrics.senior.present.length}</b> In / <b>{attendanceMetrics.senior.late.length}</b> Late
            </span>
            <span
              className="metric-tag partner"
              title={`Partners: ${attendanceMetrics.partner.present.length} Present, ${attendanceMetrics.partner.late.length} Late (> ${shiftPolicies.PARTNER?.grace || "10:05"})`}
              onClick={() => handleSend("Show partners status")}
            >
              🤝 Partners: <b>{attendanceMetrics.partner.present.length}</b> In / <b>{attendanceMetrics.partner.late.length}</b> Late
            </span>
            <span
              className="metric-tag md"
              title={`MD (Rajesh Agrawal): ${attendanceMetrics.md.present.length} Present, ${attendanceMetrics.md.late.length} Late (> ${shiftPolicies.MD?.grace || "10:05"})`}
              onClick={() => handleSend("Show MD status")}
            >
              👑 MD: <b>{attendanceMetrics.md.present.length}</b> In / <b>{attendanceMetrics.md.late.length}</b> Late
            </span>
          </div>

          {/* Download Bar (Daily, Weekly & Monthly with Excel and PDF) */}
          <div className="chatbot-download-bar">
            <div className="download-bar-label">
              <span className="download-pulse"></span>
              <span>Downloads:</span>
            </div>
            <div className="download-bar-btns">
              <div className="download-period-group">
                <span className="download-group-label">Daily:</span>
                <button
                  className="download-pill-btn excel-pill"
                  onClick={handleDownloadDailyExcel}
                  disabled={isExporting}
                  title="Download Daily Attendance as Excel (.xlsx)"
                >
                  📊 Excel
                </button>
                <button
                  className="download-pill-btn pdf-pill"
                  onClick={handleDownloadDailyPDF}
                  disabled={isExporting}
                  title="Download Daily Attendance as PDF (.pdf)"
                >
                  📄 PDF
                </button>
              </div>

              <div className="download-period-group">
                <span className="download-group-label">Weekly:</span>
                <button
                  className="download-pill-btn excel-pill"
                  onClick={handleDownloadWeeklyExcel}
                  disabled={isExporting}
                  title="Download Weekly Attendance as Excel (.xlsx)"
                >
                  🗓️ Excel
                </button>
                <button
                  className="download-pill-btn pdf-pill"
                  onClick={handleDownloadWeeklyPDF}
                  disabled={isExporting}
                  title="Download Weekly Attendance as PDF (.pdf)"
                >
                  📄 PDF
                </button>
              </div>

              <div className="download-period-group">
                <span className="download-group-label">Monthly:</span>
                <button
                  className="download-pill-btn excel-pill"
                  onClick={handleDownloadMonthlyExcel}
                  disabled={isExporting}
                  title="Download Monthly Register as Excel (.xlsx)"
                >
                  📈 Excel
                </button>
                <button
                  className="download-pill-btn pdf-pill"
                  onClick={handleDownloadMonthlyPDF}
                  disabled={isExporting}
                  title="Download Monthly Register as PDF (.pdf)"
                >
                  📄 PDF
                </button>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="chatbot-messages">
            {messages.map((m) => (
              <div key={m.id} className={`chatbot-msg ${m.sender}`}>
                <div className="chatbot-msg-bubble">
                  {renderFormattedText(m.text)}
                  <div className="chatbot-msg-time">{m.time}</div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="chatbot-msg bot">
                <div className="chatbot-msg-bubble typing">
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
            className="chatbot-chips"
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
          >
            <button
              onClick={() => handleSend("Show individual report for CA Harsh Mittal")}
              className="chip-btn chip-highlight"
            >
              👤 Harsh Mittal Summary
            </button>
            <button
              onClick={() => handleSend("Show individual report for Meenu Patel")}
              className="chip-btn"
            >
              🏢 Meenu Patel Summary
            </button>
            <button
              onClick={() => handleSend("Show monthly attendance summary from google sheet")}
              className="chip-btn chip-highlight"
            >
              📈 Monthly Summary
            </button>
            <button
              onClick={() => handleSend("Show monthly late employees list with department breakdown")}
              className="chip-btn"
            >
              ⏰ Monthly Late Staff
            </button>
            <button
              onClick={() => handleSend("Show monthly absent employees list with department breakdown")}
              className="chip-btn"
            >
              ❌ Monthly Absentees
            </button>
            <button
              onClick={() => handleSend("Show weekly attendance report")}
              className="chip-btn chip-highlight"
            >
              🗓️ Weekly Report
            </button>
            <button
              onClick={() => handleSend("Show weekly late employees list with department breakdown")}
              className="chip-btn"
            >
              ⏰ Weekly Late Staff
            </button>
            <button
              onClick={() => handleSend("Show weekly absent employees list with department breakdown")}
              className="chip-btn"
            >
              ❌ Weekly Absentees
            </button>
            <button
              onClick={handleDownloadDailyExcel}
              className="chip-btn chip-download-excel"
              title="Download Daily Attendance in Excel (.xlsx)"
            >
              📊 Daily Excel (.xlsx)
            </button>
            <button
              onClick={handleDownloadDailyPDF}
              className="chip-btn chip-download-pdf"
              title="Download Daily Attendance in PDF (.pdf)"
            >
              📄 Daily PDF (.pdf)
            </button>
            <button
              onClick={handleDownloadWeeklyExcel}
              className="chip-btn chip-download-excel"
              title="Download Weekly Attendance in Excel (.xlsx)"
            >
              🗓️ Weekly Excel (.xlsx)
            </button>
            <button
              onClick={handleDownloadWeeklyPDF}
              className="chip-btn chip-download-pdf"
              title="Download Weekly Attendance in PDF (.pdf)"
            >
              📄 Weekly PDF (.pdf)
            </button>
            <button
              onClick={handleDownloadMonthlyExcel}
              className="chip-btn chip-download-excel"
              title="Download Monthly Attendance Register in Excel (.xlsx)"
            >
              📊 Monthly Excel (.xlsx)
            </button>
            <button
              onClick={handleDownloadMonthlyPDF}
              className="chip-btn chip-download-pdf"
              title="Download Monthly Attendance Register in PDF (.pdf)"
            >
              📄 Monthly PDF (.pdf)
            </button>
            <button
              onClick={() => handleSend("Who has the highest monthly attendance?")}
              className="chip-btn"
            >
              🏆 Top Monthly Attendance
            </button>
            <button
              onClick={() => handleSend("Show MD Rajesh Agrawal attendance status")}
              className="chip-btn"
            >
              👑 Check MD Sir
            </button>
            <button
              onClick={() => handleSend("Show partners attendance status")}
              className="chip-btn"
            >
              🤝 Check Partners
            </button>
            <button
              onClick={() => handleSend("Show senior staff attendance status")}
              className="chip-btn"
            >
              👔 Check Seniors
            </button>
            <button
              onClick={() => handleSend("Who logged in early before cut-off time today?")}
              className="chip-btn"
            >
              🌅 Early Logins (&lt; Cut-off)
            </button>
            <button
              onClick={() => handleSend("Show working hours of employees today")}
              className="chip-btn"
            >
              ⏳ Employee Working Hours
            </button>
            <button
              onClick={() => handleSend("How many employees are absent today and list them by department?")}
              className="chip-btn"
            >
              ❌ Absent Employees List
            </button>
            <button
              onClick={() => handleSend("Today who is late across all categories?")}
              className="chip-btn"
            >
              ⏰ All Late Arrivals
            </button>
          </div>

          {/* Input Box */}
          <div className="chatbot-input-container">
            <input
              type="text"
              placeholder="Ask about plant staff, articles, back office, seniors, partners, MD..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
            />
            <button
              className="chatbot-send-btn"
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
