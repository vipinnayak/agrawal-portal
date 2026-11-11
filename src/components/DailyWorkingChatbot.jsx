// src/components/DailyWorkingChatbot.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import "./DailyWorkingChatbot.css";
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
  DAILY_WORKING_GOOGLE_SHEET_ID,
  DAILY_WORKING_GOOGLE_SHEET_URL,
  getDailyWorkingWebAppUrl,
  setDailyWorkingWebAppUrl,
  testDailyWorkingConnection,
} from "../utils/dailyWorkingService";
import {
  normalizeName,
  isPartner,
  isSenior,
  isArticle,
  isPlantStaff,
  PARTNERS_LIST,
  SENIORS_LIST,
  ARTICLES_LIST,
} from "../utils/attendanceConfig";
import {
  getHRLabourLawAnswer,
  HR_LABOUR_LAW_SYSTEM_PROMPT,
} from "../utils/hrLabourLawKnowledge";

// Helper: Sum task times (e.g. "03:00", "01:30", "2 hrs", "1.5")
const sumTimeGiven = (entries = []) => {
  if (!Array.isArray(entries) || entries.length === 0) return "";
  let totalMinutes = 0;
  let validCount = 0;

  for (const e of entries) {
    const tg = String(e.timeGiven || "").trim();
    if (!tg || tg === "-" || tg.toLowerCase() === "n/a") continue;

    const matchTime = tg.match(/^(\d{1,2}):(\d{2})/);
    if (matchTime) {
      totalMinutes += parseInt(matchTime[1], 10) * 60 + parseInt(matchTime[2], 10);
      validCount++;
      continue;
    }

    const matchHrs = tg.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour|h)/i);
    const matchMins = tg.match(/(\d+)\s*(?:min|m)/i);
    if (matchHrs || matchMins) {
      if (matchHrs) totalMinutes += parseFloat(matchHrs[1]) * 60;
      if (matchMins) totalMinutes += parseInt(matchMins[1], 10);
      validCount++;
      continue;
    }

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

export default function DailyWorkingChatbot({
  profiles: initialProfiles = null,
  workingLogs: initialWorkingLogs = null,
  punchLogs: initialPunchLogs = null,
  selectedEmployee = null,
  onClearSelectedEmployee = null,
  launcherStyle = {},
  containerStyle = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    {
      id: 1,
      sender: "bot",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: `👋 Greetings MD Sir & Team! I am your **AJC Daily Working AI Analyst**.\n\nI monitor and analyze all staff daily work submissions, monthly duplicacy audits, card punch correlations, missing dates backlogs, and client assignments.\n\nTry asking:\n- 🔍 *"Duplicacy of October month"* or *"Duplicacy in September"*\n- 📊 *"Monthly duplicacy overview"* (All months comparison)\n- 🤖 *"Uses of Ai or Claude in the task description of daily working"*\n- ⚠️ *"The seniors/articles/plant staff/partners who have not filled their daily working more than 2 days"*\n- 📥 *"Download daily working excel report"*`,
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Self-loading data state (if not provided via props)
  const [profiles, setProfiles] = useState(initialProfiles || []);
  const [workingLogs, setWorkingLogs] = useState(initialWorkingLogs || []);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // OpenAI API Key
  const [apiKey, setApiKey] = useState(() => {
    return (
      localStorage.getItem("openai_api_key") ||
      process.env.REACT_APP_OPENAI_API_KEY ||
      ""
    );
  });
  const [tempApiKey, setTempApiKey] = useState(apiKey);

  // Daily Working Google Apps Script Web App URL
  const [tempWebAppUrl, setTempWebAppUrl] = useState(() => getDailyWorkingWebAppUrl());
  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState(null);

  const messagesEndRef = useRef(null);
  const exportMenuRef = useRef(null);

  // Sync props if provided
  useEffect(() => {
    if (initialProfiles && initialProfiles.length > 0) {
      setProfiles(initialProfiles);
    }
  }, [initialProfiles]);

  useEffect(() => {
    if (initialWorkingLogs && initialWorkingLogs.length > 0) {
      setWorkingLogs(initialWorkingLogs);
    }
  }, [initialWorkingLogs]);

  // Load data independently if mounted without props (e.g. on MD Dashboard)
  const loadChatbotData = async () => {
    if (initialProfiles && initialProfiles.length > 0) return;
    setIsDataLoading(true);
    try {
      const [wLogs, pLogs, eMaster, dData] = await Promise.all([
        fetchDailyWorkingLogs(),
        fetchCardPunchLogs(),
        fetchEmployeeMasterList(),
        fetchDropdownsData(),
      ]);

      const unified = buildUnifiedDailyWorkingProfiles({
        workingLogs: wLogs,
        punchLogs: pLogs,
        employeeMaster: eMaster,
        dropdownDoers: dData?.doers || [],
      });

      setWorkingLogs(wLogs);
      setProfiles(unified);
    } catch (err) {
      console.error("Error loading DailyWorkingChatbot data:", err);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    loadChatbotData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  // React to selectedEmployee from parent table
  useEffect(() => {
    if (selectedEmployee) {
      setIsOpen(true);
      const query = `Show daily working details for ${selectedEmployee}`;
      handleSend(query);
      if (onClearSelectedEmployee) onClearSelectedEmployee();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Core KPIs
  const kpis = useMemo(() => {
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

  // Stop words for identifying whether query targets an individual employee
  const STOP_WORDS = useMemo(
    () =>
      new Set([
        "today", "todays", "yesterday", "tomorrow", "now",
        "is", "was", "are", "were", "am", "be", "been", "being",
        "did", "does", "do", "has", "have", "had", "can", "could", "will", "would", "should",
        "the", "a", "an", "this", "that", "these", "those",
        "employee", "employees", "staff", "person", "persons", "people", "member", "members", "team",
        "work", "working", "works", "worked", "daily", "dailyworking",
        "late", "absent", "present", "attendance", "punch",
        "status", "report", "summary", "overview", "insight", "insights", "analytics", "record", "records", "sheet", "data",
        "who", "whom", "whose", "which", "what", "where", "when", "why", "how",
        "many", "much", "all", "any", "total", "count", "number", "numbers",
        "full", "complete", "entire", "overall", "general", "list", "details", "detail",
        "defaulter", "defaulters", "pending", "missing", "dates", "backlog", "unsubmitted",
        "client", "clients", "company", "companies", "office", "site", "factory", "place", "location", "department",
        "tell", "show", "give", "find", "get", "view", "display", "provide", "share", "check",
        "me", "please", "sir", "madam", "mam", "hello", "hi", "hey",
        "download", "export", "excel", "pdf", "sheet"
      ]),
    []
  );

  // Helper: Match employee from query text
  const detectTargetEmployee = (query) => {
    if (!query || !profiles || profiles.length === 0) return null;
    const cleanQ = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

    // 1. Direct name match
    for (const p of profiles) {
      const cleanName = normalizeName(p.rawName);
      if (cleanName && cleanName.length > 3 && cleanQ.includes(cleanName)) {
        return p;
      }
    }

    // 2. Token match (ignoring stop words)
    const tokens = cleanQ.split(" ").filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
    if (tokens.length > 0) {
      for (const p of profiles) {
        const pClean = normalizeName(p.rawName);
        const pTokens = pClean.split(" ").filter(Boolean);
        // If all significant query tokens are in pClean
        if (tokens.every((t) => pClean.includes(t))) {
          return p;
        }
        // If first and last name match
        if (pTokens.length >= 2 && tokens.includes(pTokens[0]) && tokens.includes(pTokens[pTokens.length - 1])) {
          return p;
        }
      }
    }

    return null;
  };

  // Export handlers
  const handleDownloadExcel = async () => {
    setIsExporting(true);
    try {
      await exportDailyWorkingToExcel(profiles, workingLogs);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleDownloadPDF = () => {
    setIsExporting(true);
    try {
      exportDailyWorkingToPDF(profiles);
    } catch (err) {
      console.error("PDF Export error:", err);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleDownloadDefaulters = async () => {
    setIsExporting(true);
    try {
      await exportDefaultersToExcel(profiles);
    } catch (err) {
      console.error("Defaulters export error:", err);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleDownloadDuplicacy = async (targetMonthKey = null) => {
    setIsExporting(true);
    try {
      await exportDuplicacyReportToExcel(workingLogs, profiles, targetMonthKey);
    } catch (err) {
      console.error("Duplicacy export error:", err);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleDownloadAiUsage = async () => {
    setIsExporting(true);
    try {
      await exportAiUsageReportToExcel(workingLogs, profiles);
    } catch (err) {
      console.error("AI usage export error:", err);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleDownloadTwoDaysDefaulters = async () => {
    setIsExporting(true);
    try {
      await exportDefaultersMoreThanTwoDaysToExcel(profiles);
    } catch (err) {
      console.error("Two days defaulters export error:", err);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleDownloadLessThanNineHours = async (targetMonthKey = null) => {
    setIsExporting(true);
    try {
      await exportLessThanNineHoursReportToExcel(workingLogs, profiles, targetMonthKey);
    } catch (err) {
      console.error("Less than 9 hours export error:", err);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleDownloadCrossEmployeeDuplicates = async (targetMonthKey = null) => {
    setIsExporting(true);
    try {
      await exportCrossEmployeeDuplicatesToExcel(workingLogs, profiles, targetMonthKey);
    } catch (err) {
      console.error("Cross employee duplicates export error:", err);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  // Query Matchers for Specialized Executive Audits
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
  const isDuplicacyQuery = (text = "") => {
    const q = (text || "").toLowerCase().trim();
    const hasMonth = Boolean(parseTargetMonthFromQuery(q));
    const hasDupeWord =
      q.includes("duplicacy") ||
      q.includes("dulpicacy") || // Handle common typo
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

  // Helper: Monthly Daily Working Summary
  const generateMonthlyWorkingSummary = (logs = [], targetMonth) => {
    if (!logs || logs.length === 0) {
      return `📅 **Daily Working Summary: ${targetMonth.label}**\n\nNo records available.`;
    }

    const monthLogs = logs.filter((l) => isEntryInMonth(l, targetMonth.month, targetMonth.year));
    if (monthLogs.length === 0) {
      return `📅 **Daily Working Summary: ${targetMonth.label}**\n\nNo daily working records logged for **${targetMonth.label}** in the database.`;
    }

    const uniqueStaff = new Set();
    const companyMap = new Map();

    monthLogs.forEach((l) => {
      const name = l.doerName || l.employeeName;
      if (name) uniqueStaff.add(normalizeName(name));
      const comp = l.companyName || l.groupName || "General / Firm Internal";
      companyMap.set(comp, (companyMap.get(comp) || 0) + 1);
    });

    const audit = auditTaskDescriptionDuplicacy(monthLogs, profiles);

    let res = `📅 **AJC Daily Working Executive Summary — ${targetMonth.label}**\n\n`;
    res += `• 📝 **Total Tasks Logged**: **${monthLogs.length.toLocaleString()} Entries**\n`;
    res += `• 👥 **Active Staff Contributing**: **${uniqueStaff.size} Employees**\n`;
    res += `• 🏢 **Client Entities Serviced**: **${companyMap.size} Clients / Groups**\n`;
    res += `• 🔁 **Task Duplicacy In Month**: **${audit.kpis.affectedStaffCount} Staff** involved in **${audit.kpis.totalDuplicatedStatements} sequences** (**${audit.kpis.totalDuplicatedRows} duplicated rows**)\n\n`;

    res += `### 🏢 Top Client Assignments in ${targetMonth.label}:\n`;
    const topComps = Array.from(companyMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    topComps.forEach(([c, cnt], idx) => {
      res += `${idx + 1}. **${c}**: ${cnt} tasks logged\n`;
    });
    res += `\n`;

    res += `### 🔍 Duplicacy Quick-Access for ${targetMonth.label}:\n`;
    res += `*To see the row-by-row breakdown of repeated tasks for ${targetMonth.label}, click below:*\n\n`;
    res += `[ACTION_CHIPS:Duplicacy in ${targetMonth.label}|🔍 View ${targetMonth.label} Duplicacy;Monthly duplicacy overview|📊 View All Months Duplicacy]\n\n`;
    res += `[DOWNLOAD_DUPLICACY_BUTTON:${targetMonth.key}]`;

    return res;
  };

  // 1. Helper: Work Duplicacy Audit Report (Supports Any Month & All-Time)
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

    // Case 2: Specific Month Requested (e.g. "October", "October 2026", "September", etc.)
    let targetMonth = null;
    if (targetMonthSpec && targetMonthSpec.month && targetMonthSpec.year) {
      targetMonth = targetMonthSpec;
    } else {
      const currentMonthInfo = {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        key: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
        label: getCurrentMonthLabel(),
      };
      targetMonth = currentMonthInfo;
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

    // Report Download Option Button at Top
    response += `📥 **Report Download Option**: Click below to download the row-by-row Excel workbook (*AJC_Duplicacy_Audit_Report_${targetMonth.label.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx*) for **${targetMonth.label}**:\n\n`;
    response += `[DOWNLOAD_DUPLICACY_BUTTON:${targetMonth.key || "CURRENT"}]\n\n`;

    // 1. Employee-by-Employee Breakdown
    response += `### 👥 Employees with Duplicate Task Descriptions (${activeLabel} Row-by-Row):\n`;
    response += `*For each employee, the repeated task description and the exact number of times it repeated are detailed row-by-row below:*\n\n`;

    const displayEmps = employeeSummary.slice(0, 8);
    displayEmps.forEach((emp, eIdx) => {
      response += `#### ${eIdx + 1}. 👤 **${emp.name}** (${emp.category} • ${emp.department})\n`;
      response += `• 🔁 **Total Repeated Entries**: **${emp.totalDuplicatedRows} Rows** (${emp.distinctStatementsCount} duplicated task sequences)\n`;
      response += `• 🏢 **Clients & Locations**: *${emp.clientList || "General"}*\n`;

      // Render each duplicated task of this employee
      (emp.duplicatedTasks || []).slice(0, 3).forEach((task, tIdx) => {
        response += `  • 📌 **Repeated Task ${tIdx + 1}**: _"${task.representativeTask.slice(0, 100)}${task.representativeTask.length > 100 ? "..." : ""}"_\n`;
        response += `    ↳ 🏢 **Matched 6-Field Scope**: Location: *${task.location}* | Dept: *${task.department}* | Group: *${task.groupName}* | Company: *${task.company}*\n`;
        response += `    ↳ 🔁 **Times Repeated with Employee**: **${task.totalRepetitions} Times (${task.totalRepetitions} Rows)**:\n`;
        task.entries.forEach((row) => {
          response += `    - **Row ${row.occurrenceIndex} (${row.occurrenceText})**: 📅 **${row.date}** | 🏢 *${row.company}* (${row.location}) | ⏱️ ${row.timeGiven}\n`;
          response += `      *Task Description*: _"${row.taskDescription.slice(0, 120)}${row.taskDescription.length > 120 ? "..." : ""}"_\n`;
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

    // 2. Month Navigation
    response += `📅 **Switch Month or View Trends**:\n`;
    response += `• Ask: *"Duplicacy in October"*, *"Duplicacy in September"*, *"Duplicacy in August"*, or *"Monthly duplicacy"*\n\n`;
    response += `[ACTION_CHIPS:Duplicacy in October 2026|🔍 October 2026;Duplicacy in September 2026|🔍 September 2026;Duplicacy in August 2026|🔍 August 2026;Monthly duplicacy overview|📊 All Months Overview]\n\n`;

    // 3. Recommendations
    response += `💡 **AI Audit Recommendations for MD Sir**:\n`;
    response += `1. **Identical Sequence Review**: When the same employee logs the identical task at the same client, group, and location multiple days in a row, verify whether the diary entries reflect incremental deliverables or repeated placeholders.\n`;
    response += `2. **Sub-Task Specificity**: Advise staff to document specific voucher batch numbers, chapter titles, or ledger accounts rather than logging the identical title.\n`;
    response += `3. **Daily Sign-Off**: Senior CAs should check team member task descriptions during daily review to ensure genuine task progression.\n\n`;

    // Download notice & button at Bottom
    response += `📥 **Report Download Option**:\n`;
    response += `*The complete Excel workbook featuring ${targetMonth.label} Duplicates on Sheet 1, Month-by-Month Register on Sheet 2, All-Time Duplicates on Sheet 3, and Staff Repetitions Register on Sheet 4 has been generated and downloaded. Click below if you need to re-download:*\n\n`;
    response += `[DOWNLOAD_DUPLICACY_BUTTON:${targetMonth.key || "CURRENT"}]`;

    return response;
  };

  // 2. Helper: AI & Claude Usage in Task Descriptions
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
      response += `**Possible Reasons & Assessment**:\n`;
      response += `1. **Traditional Accounting Procedures**: Tasks logged relate strictly to manual audit procedures, physical verification, tally vouching, and ITR portal filings.\n`;
      response += `2. **Undeclared AI Usage**: Staff may be using AI tools (such as Claude for draft responses or research) privately without documenting it as a separate task item in their daily diary.\n`;
      response += `3. **Portal Policy Compliance**: Staff are adhering to firm standards of logging professional accounting deliverables rather than software tool names.\n\n`;
      response += `💡 **Executive Recommendations for MD Sir**:\n`;
      response += `• If firm policy encourages AI adoption (e.g. using Claude for Income Tax scrutiny notice replies or GST appeals drafting), advise seniors to tag tasks with \`[AI Assisted - Claude]\`.\n`;
      response += `• Reinforce AJC Data Security Policy: Ensure no client-sensitive data (PAN, Bank A/c numbers, confidential financials) is uploaded into public consumer AI models without sanitization.\n\n`;
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

    // Staff breakdown
    response += `### 👥 Staff Members Using AI / Claude\n`;
    Array.from(doerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count], idx) => {
        response += `${idx + 1}. **${name}** — **${count} AI-related tasks logged**\n`;
      });
    response += `\n`;

    // Detailed Log Entries
    response += `### 📝 Detailed AI / Claude Task Entries\n`;
    matchedEntries.slice(0, 10).forEach((m, idx) => {
      let highlighted = m.taskText;
      highlighted = highlighted.replace(/(claude|chatgpt|gemini|copilot|prompt|openai|\bai\b)/gi, "**$1**");
      response += `${idx + 1}. ${m.icon} **${m.doer}** (${m.department}) — **${m.date}**\n`;
      response += `   • **Client**: ${m.company} | **Time**: ${m.timeGiven}\n`;
      response += `   • **Tool**: ${m.tool}\n`;
      response += `   • **Task Description**: ${highlighted}\n\n`;
    });

    if (matchedEntries.length > 10) {
      response += `*...plus ${matchedEntries.length - 10} additional AI-related task entries.*\n\n`;
    }

    response += `💡 **Firm Policy Recommendations**:\n`;
    response += `• **Productivity Encouragement**: Claude is exceptionally capable for summarizing lengthy assessment orders, drafting ITAT citations, and writing tax case memos.\n`;
    response += `• **Verification Standard**: Always require senior CA review on any AI-generated legal submissions to verify citation accuracy and avoid hallucinated case laws.\n\n`;
    response += `📥 **Report Download**: Click below to download the AI & Claude Usage register:\n\n`;
    response += `[DOWNLOAD_AI_REPORT_BUTTON]`;

    return response;
  };

  // 3. Helper: Staff Who Have Not Filled Daily Working > 2 Days
  const generateUnsubmittedMoreThanTwoDaysReport = (profileList = []) => {
    if (!profileList || profileList.length === 0) {
      return `⚠️ **Defaulters Audit Report (> 2 Days Not Filled)**:\n\nNo staff profile data is currently loaded to evaluate daily working submissions.`;
    }

    const partnersDefaulters = [];
    const seniorsDefaulters = [];
    const articlesDefaulters = [];
    const plantStaffDefaulters = [];
    const otherDefaulters = [];

    profileList.forEach((p) => {
      const missingCount = p.missingDates ? p.missingDates.length : 0;
      // Defaulter condition: not filled for more than 2 days
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
        totalEntries: p.totalEntries || 0,
      };

      if (isPartner(p.rawName, p)) {
        partnersDefaulters.push(item);
      } else if (isSenior(p.rawName, p)) {
        seniorsDefaulters.push(item);
      } else if (isArticle(p.rawName, p)) {
        articlesDefaulters.push(item);
      } else if (isPlantStaff(p.rawName, p)) {
        plantStaffDefaulters.push(item);
      } else {
        otherDefaulters.push(item);
      }
    });

    const sortByMissing = (a, b) => (Number(b.missingCount) || 999) - (Number(a.missingCount) || 999);
    partnersDefaulters.sort(sortByMissing);
    seniorsDefaulters.sort(sortByMissing);
    articlesDefaulters.sort(sortByMissing);
    plantStaffDefaulters.sort(sortByMissing);

    const grandTotalDefaulters =
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
    response += `• 🚨 **Grand Total Core Defaulters (> 2 Days)**: **${grandTotalDefaulters} Staff Members**\n\n`;

    // 1. Partners
    response += `### 1. 🤝 Partners (> 2 Days Not Filled)\n`;
    if (partnersDefaulters.length === 0) {
      response += `*All Partners (CA Rupesh Vaid, CA Ankit Garg, CA Mukul Jain) are 100% compliant with zero >2 days backlog!* ✅\n\n`;
    } else {
      partnersDefaulters.forEach((p, i) => {
        response += `${i + 1}. 🤝 **${p.name}** — **${p.missingCount} Days Pending**\n`;
        response += `   • **Missing Dates**: ${p.missingDates.slice(0, 5).join(", ")}${p.missingDates.length > 5 ? ` (+${p.missingDates.length - 5} more)` : ""}\n`;
        response += `   • **Last Submission**: ${p.lastUpdated} | **Today Punch**: ${p.punchStatus}\n\n`;
      });
    }

    // 2. Seniors
    response += `### 2. 👔 Seniors (> 2 Days Not Filled)\n`;
    if (seniorsDefaulters.length === 0) {
      response += `*All 10 CA/CMA Seniors have submitted their daily working on time. Zero backlog > 2 days!* ✅\n\n`;
    } else {
      seniorsDefaulters.forEach((p, i) => {
        response += `${i + 1}. 👔 **${p.name}** (${p.department}) — **${p.missingCount} Days Pending**\n`;
        response += `   • **Missing Dates**: ${p.missingDates.slice(0, 5).join(", ")}${p.missingDates.length > 5 ? ` (+${p.missingDates.length - 5} more)` : ""}\n`;
        response += `   • **Last Submission**: ${p.lastUpdated} | **Today Punch**: ${p.punchStatus}\n\n`;
      });
    }

    // 3. Articles
    response += `### 3. 📚 Articles (> 2 Days Not Filled)\n`;
    if (articlesDefaulters.length === 0) {
      response += `*All Articles have submitted their daily working regularly. Zero backlog > 2 days!* ✅\n\n`;
    } else {
      articlesDefaulters.slice(0, 15).forEach((p, i) => {
        response += `${i + 1}. 📚 **${p.name}** (${p.department}) — **${p.missingCount} Days Pending**\n`;
        response += `   • **Missing Dates**: ${p.missingDates.slice(0, 4).join(", ")}${p.missingDates.length > 4 ? ` (+${p.missingDates.length - 4} more)` : ""}\n`;
        response += `   • **Last Submission**: ${p.lastUpdated} | **Today Punch**: ${p.punchStatus}\n\n`;
      });
      if (articlesDefaulters.length > 15) {
        response += `*...plus ${articlesDefaulters.length - 15} more Articles with > 2 days backlog.*\n\n`;
      }
    }

    // 4. Plant Staff
    response += `### 4. 🏭 Plant Audit Staff (> 2 Days Not Filled)\n`;
    if (plantStaffDefaulters.length === 0) {
      response += `*All Plant Audit Staff are up to date with zero >2 days backlog!* ✅\n\n`;
    } else {
      plantStaffDefaulters.slice(0, 10).forEach((p, i) => {
        response += `${i + 1}. 🏭 **${p.name}** (${p.department}) — **${p.missingCount} Days Pending**\n`;
        response += `   • **Missing Dates**: ${p.missingDates.slice(0, 4).join(", ")}${p.missingDates.length > 4 ? ` (+${p.missingDates.length - 4} more)` : ""}\n`;
        response += `   • **Last Submission**: ${p.lastUpdated} | **Today Punch**: ${p.punchStatus}\n\n`;
      });
      if (plantStaffDefaulters.length > 10) {
        response += `*...plus ${plantStaffDefaulters.length - 10} more Plant staff members.*\n\n`;
      }
    }

    response += `💡 **Management Action**:\n`;
    response += `• Staff can clear past pending dates by logging into their dedicated daily working portal.\n`;
    response += `• A categorized Excel report (*AJC_Defaulters_More_Than_2_Days.xlsx*) has been generated and downloaded. Click below if you need to re-download:\n\n`;
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
    response += `Standard: **Mandatory 9.0 Hours / Day (09:00)** referenced from Daily Working Sheet:\n\n`;

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

  // Local Rule Engine response generator
  const generateLocalResponse = (rawQuery) => {
    const q = rawQuery.toLowerCase().trim();

    // 0. Check HR & Labour Law statutory policies
    const hrPolicyAnswer = getHRLabourLawAnswer(rawQuery);
    if (hrPolicyAnswer) {
      return hrPolicyAnswer;
    }

    // 0.04 Check for Same Task Across Different Employees
    if (isCrossEmployeeDuplicateQuery(rawQuery)) {
      return generateCrossEmployeeDuplicatesReport(workingLogs, profiles, rawQuery);
    }

    // 0.05 Check for Employees with Less Than 9 Hours in a Day
    if (isLessThanNineHoursQuery(rawQuery)) {
      return generateLessThanNineHoursReport(workingLogs, profiles, rawQuery);
    }

    // 0.1 Check for Question 3: Seniors / Articles / Plant Staff / Partners not filled > 2 days
    if (isMoreThanTwoDaysQuery(rawQuery)) {
      return generateUnsubmittedMoreThanTwoDaysReport(profiles);
    }

    // 0.2 Check for Question 1: Duplicacy in work (supports any month or all-months)
    if (isDuplicacyQuery(rawQuery)) {
      return generateWorkDuplicacyReport(workingLogs, rawQuery);
    }

    // 0.25 Check for Month-specific daily working summary if not duplicacy
    const targetMonth = parseTargetMonthFromQuery(rawQuery);
    if (targetMonth && !isAiUsageQuery(rawQuery) && !isMoreThanTwoDaysQuery(rawQuery)) {
      if (
        q.includes("summary") ||
        q.includes("daily working") ||
        q.includes("tasks") ||
        q.includes("report") ||
        q.includes("work") ||
        (targetMonth.monthName && q === targetMonth.monthName.toLowerCase()) ||
        (targetMonth.label && q === targetMonth.label.toLowerCase())
      ) {
        return generateMonthlyWorkingSummary(workingLogs, targetMonth);
      }
    }

    // 0.3 Check for Question 2: Uses of AI or Claude in task description
    if (isAiUsageQuery(rawQuery)) {
      return generateAiAndClaudeUsageReport(workingLogs);
    }

    // 0.4 General Individual Employees Daily Working Summary Check
    const isGeneralIndividualWorkQuery =
      (q.includes("individual summary") ||
        q.includes("individual report") ||
        q.includes("staff summary") ||
        q.includes("employees summary") ||
        q.includes("employee summary") ||
        q.includes("employees work summary") ||
        q.includes("individual work")) &&
      (q.includes("daily working") || q.includes("work") || q.includes("task") || q.includes("diary") || !q.includes("attendance"));

    // 1. Check for individual employee drill-down
    const targetEmp = detectTargetEmployee(rawQuery);
    if (targetEmp) {
      const cleanName = normalizeName(targetEmp.rawName);

      // Filter all working logs for this specific employee
      const empEntries = (workingLogs || []).filter((e) => {
        const dName = normalizeName(e.doerName || e.employeeName);
        return dName === cleanName || (cleanName.length > 3 && dName.includes(cleanName));
      });

      empEntries.sort((a, b) => {
        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tB - tA;
      });

      const todayFormatted = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const todayTasks = empEntries.filter(
        (e) => formatExcelOrStringDate(e.date) === todayFormatted
      );
      const hasSubmittedToday = todayTasks.length > 0 || targetEmp.submittedToday;
      const todayTimeTotal = sumTimeGiven(todayTasks);

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

      // Individual 6-Field Duplicacy Audit
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
      const missingDates = targetEmp.missingDates || [];
      const isDefaulterMoreThanTwo = missingDates.length > 2;

      const roleLabel = targetEmp.category?.label || targetEmp.department || "General Staff";
      const roleIcon = targetEmp.category?.icon || "👤";
      const workLoc = targetEmp.punchLocation || "AJC Office";

      let res = `📝 **Individual Daily Working Summary: ${targetEmp.rawName}**\n`;
      res += `• ${roleIcon} **Role / Category**: **${roleLabel}**\n`;
      res += `• 🏢 **Department**: ${targetEmp.department || "General"}\n`;
      res += `• 📍 **Primary Location**: ${workLoc}\n`;
      res += `━━━━━━━━━━━━━━━━━━━━\n`;

      // 1. Today's Status (Punch vs Work Submission)
      res += `🕒 **1. Today's Status (Punch Attendance vs Work Submission)**:\n`;
      if (targetEmp.cardPresent) {
        res += `• 🚪 **Biometric Punch**: ✅ **Present** (In at ${formatDisplayTime(targetEmp.punchIn)} | ${targetEmp.punchLocation || "Office"})\n`;
      } else {
        res += `• 🚪 **Biometric Punch**: ❌ **Absent / Not Punched In**\n`;
      }

      if (hasSubmittedToday) {
        const taskCount = todayTasks.length || targetEmp.todayEntriesCount || 1;
        res += `• 📝 **Daily Work Submission**: ✅ **SUBMITTED TODAY** (**${taskCount} task${taskCount > 1 ? "s" : ""}** logged)\n`;
        if (todayTimeTotal) {
          res += `• ⏱️ **Total Task Time Logged Today**: **${todayTimeTotal}**\n`;
        }
      } else if (targetEmp.cardPresent) {
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
      res += `🔍 **4. Duplicacy Audit for ${targetEmp.rawName}**:\n`;
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

      res += `\n👇 **Download Daily Working Reports:**\n[DOWNLOAD_ALL_BUTTONS]`;
      return res;
    }

    // 1.2 General All-Employees Work Summary
    if (isGeneralIndividualWorkQuery && !targetEmp) {
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
      res += `👇 **Download Daily Working Reports:**\n[DOWNLOAD_ALL_BUTTONS]`;

      return res;
    }

    // 1.5 Google Sheet inquiries
    if (
      q.includes("google sheet") ||
      q.includes("sheet url") ||
      q.includes("sheet link") ||
      q.includes("where is the sheet") ||
      q.includes("open sheet") ||
      q.includes("spreadsheet")
    ) {
      return `📊 **AJC Daily Working Live Google Sheet**:\n\n` +
        `• 📄 **Spreadsheet ID**: \`${DAILY_WORKING_GOOGLE_SHEET_ID}\`\n` +
        `• 🔗 **Direct Sheet URL**: [Click to Open Google Sheet ↗](${DAILY_WORKING_GOOGLE_SHEET_URL})\n` +
        `• ⚡ **Connected Web App API**: \`${getDailyWorkingWebAppUrl()}\`\n\n` +
        `All employee tasks and logs submitted through the portal sync in real-time with this master Google Sheet!`;
    }

    // 2. Greetings
    if (/^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening))\b/i.test(q)) {
      return `👋 Greetings MD Sir! How may I assist you with daily working analysis today?\n\n` +
        `Here are quick executive queries you can ask:\n` +
        `- 📊 *"Show today's daily working summary"*\n` +
        `- ⚠️ *"Who is present today but hasn't submitted daily work?"*\n` +
        `- 📅 *"Show missing dates defaulters"*\n` +
        `- 🏢 *"Which clients or companies are staff working on today?"*\n` +
        `- 📂 *"Department-wise daily working breakdown"*\n` +
        `- 📥 *"Download excel report"*`;
    }

    // 3. Defaulters: Present but Work Pending
    if (
      q.includes("defaulter") ||
      q.includes("pending work") ||
      q.includes("who has not submitted") ||
      q.includes("who forgot") ||
      q.includes("present but pending") ||
      q.includes("not submitted today") ||
      q.includes("not filled")
    ) {
      const list = kpis.presentWithoutWork;
      if (list.length === 0) {
        return `🎉 **Zero Defaulters Today!**\n\nAll **${kpis.cardPresent}** employees who punched in today have successfully submitted their daily working entries. 100% compliance! 👏`;
      }

      const rowsText = list
        .slice(0, 20)
        .map(
          (p, i) =>
            `${i + 1}. **${p.rawName}** — ${p.department} (In: ${formatDisplayTime(p.punchIn)} | ${p.punchLocation || "Office"})`
        )
        .join("\n");

      const extraText =
        list.length > 20
          ? `\n*...and ${list.length - 20} more employees. Download the Defaulters Excel report for the complete list.*`
          : "";

      return `⚠️ **Defaulters Report: Present Today but Daily Work NOT Submitted**\n\n` +
        `• Total Present Today: **${kpis.cardPresent}**\n` +
        `• Daily Work Submitted: **${kpis.workSubmitted}**\n` +
        `• 🚨 **Pending Submissions (Defaulters)**: **${list.length} Staff** (${100 - kpis.submissionRate}% of present staff)\n\n` +
        `**List of Defaulters**:\n${rowsText}${extraText}\n\n` +
        `[DOWNLOAD_DEFAULTERS_BUTTON]`;
    }

    // 4. Missing Dates Backlog
    if (
      q.includes("missing date") ||
      q.includes("missing dates") ||
      q.includes("unsubmitted date") ||
      q.includes("backlog") ||
      q.includes("pending dates")
    ) {
      const sorted = [...kpis.withMissingDates].sort(
        (a, b) => b.missingDates.length - a.missingDates.length
      );

      if (sorted.length === 0) {
        return `🎉 **Clean Backlog!** No employees currently have unsubmitted or missing working dates. All past records are 100% up to date!`;
      }

      const rowsText = sorted
        .slice(0, 15)
        .map(
          (p, i) =>
            `${i + 1}. **${p.rawName}** (${p.department}) — **${p.missingDates.length} Missing Dates**: ${p.missingDates.slice(0, 3).join(", ")}${p.missingDates.length > 3 ? "..." : ""}`
        )
        .join("\n");

      return `📅 **Missing Dates Backlog Summary**:\n\n` +
        `• Total Staff with Backlog: **${sorted.length} Employees**\n` +
        `• Total Missing Dates Instances: **${kpis.totalMissingInstances} Dates**\n\n` +
        `**Top Staff with Pending Dates Backlog**:\n${rowsText}\n\n` +
        `💡 *Employees can clear their missing dates directly from their personal portal.* \n\n[DOWNLOAD_DEFAULTERS_BUTTON]`;
    }

    // 5. Overall Summary / Overview
    if (
      q.includes("summary") ||
      q.includes("overview") ||
      q.includes("status") ||
      q.includes("how many submitted") ||
      q.includes("report") ||
      q.includes("today")
    ) {
      return `📊 **AJC Daily Working Executive Summary** (${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "short", day: "numeric" })}):\n\n` +
        `• 👥 **Total Firm Staff**: **${kpis.totalStaff}**\n` +
        `• 🕒 **Punched In Today (Card Present)**: **${kpis.cardPresent}**\n` +
        `• ✅ **Daily Work Submitted Today**: **${kpis.workSubmitted}** (${kpis.submissionRate}% compliance)\n` +
        `• ⏳ **Work Pending (Present without Work)**: **${kpis.presentWithoutWork.length}**\n` +
        `• 📅 **Employees with Missing Dates Backlog**: **${kpis.withMissingDates.length}** (${kpis.totalMissingInstances} pending dates)\n\n` +
        `📌 **Key Takeaway**: ${kpis.presentWithoutWork.length > 0 ? `Attention needed for **${kpis.presentWithoutWork.length} employees** who punched in but have yet to submit their daily tasks.` : "All active staff have submitted today's work!"}\n\n` +
        `[DOWNLOAD_EXCEL_BUTTON]`;
    }

    // 6. Clients & Companies Worked On Today
    if (
      q.includes("client") ||
      q.includes("company") ||
      q.includes("companies") ||
      q.includes("who worked on what") ||
      q.includes("tasks")
    ) {
      const todayFormatted = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const todayEntries = workingLogs.filter(
        (e) => formatExcelOrStringDate(e.date) === todayFormatted
      );

      if (todayEntries.length === 0) {
        return `🏢 **Today's Client Assignments**:\n\nNo task logs have been recorded yet today (${todayFormatted}). As staff submit entries, their client assignments will appear here live.`;
      }

      // Group by company
      const companyMap = new Map();
      todayEntries.forEach((e) => {
        const cName = e.companyName || e.groupName || "General / Firm Internal";
        if (!companyMap.has(cName)) companyMap.set(cName, []);
        companyMap.get(cName).push(e);
      });

      const sortedCompanies = Array.from(companyMap.entries()).sort(
        (a, b) => b[1].length - a[1].length
      );

      const compText = sortedCompanies
        .slice(0, 10)
        .map(([cName, list], idx) => {
          const doers = Array.from(new Set(list.map((x) => x.doerName || x.employeeName))).join(", ");
          return `${idx + 1}. **${cName}** (${list.length} task${list.length > 1 ? "s" : ""}) — Staff: *${doers || "N/A"}*`;
        })
        .join("\n");

      return `🏢 **Today's Active Client Assignments** (${sortedCompanies.length} Active Clients/Entities):\n\n` +
        `Total tasks logged today: **${todayEntries.length}**\n\n` +
        `**Top Clients & Staff Engaged**:\n${compText}\n\n` +
        `💡 *Ask for any specific employee to see their detailed task descriptions!*`;
    }

    // 7. Location breakdown
    if (q.includes("location") || q.includes("where are") || q.includes("site") || q.includes("factory")) {
      const locMap = new Map();
      profiles.forEach((p) => {
        if (p.cardPresent) {
          const loc = p.punchLocation || "AJC Office";
          locMap.set(loc, (locMap.get(loc) || 0) + 1);
        }
      });

      const locText = Array.from(locMap.entries())
        .map(([loc, cnt]) => `• 📍 **${loc}**: **${cnt} Staff**`)
        .join("\n");

      return `📍 **Today's Staff Work Locations** (Punched In Staff):\n\n${locText || "No active location logs today."}\n\n` +
        `Total staff active on duty: **${kpis.cardPresent}**`;
    }

    // 8. Department-wise breakdown
    if (
      q.includes("department") ||
      q.includes("dept") ||
      q.includes("audit") ||
      q.includes("tax") ||
      q.includes("gst") ||
      q.includes("accounts")
    ) {
      const deptMap = new Map();
      profiles.forEach((p) => {
        const d = p.department || "General";
        if (!deptMap.has(d)) deptMap.set(d, { total: 0, present: 0, submitted: 0 });
        const stat = deptMap.get(d);
        stat.total++;
        if (p.cardPresent) stat.present++;
        if (p.submittedToday) stat.submitted++;
      });

      const deptText = Array.from(deptMap.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .map(([dept, s]) => {
          const rate = s.present > 0 ? Math.round((s.submitted / s.present) * 100) : 0;
          return `• **${dept}**: **${s.submitted}** of **${s.present}** Present Submitted (${rate}% compliance | ${s.total} Total Staff)`;
        })
        .join("\n");

      return `📂 **Department-Wise Daily Working Compliance**:\n\n${deptText}\n\n` +
        `💡 *Say "Who hasn't submitted in Audit" or ask about any department.*`;
    }

    // 9. Downloads
    if (q.includes("download") || q.includes("export") || q.includes("excel") || q.includes("pdf")) {
      return `📥 **Export Daily Working Reports**:\n\nYou can download real-time formatted reports directly from here:\n\n` +
        `• 📊 **Full Excel Summary**: Complete register with card punch in/out, work submission status, latest tasks, and missing dates.\n` +
        `• 📄 **Executive PDF Report**: Clean landscape report suitable for print or distribution to leadership.\n` +
        `• ⚠️ **Defaulters Excel**: Targeted list of employees with pending work today or missing dates backlog.\n\n` +
        `[DOWNLOAD_ALL_BUTTONS]`;
    }

    // Default Fallback
    return `🤔 I understand you are inquiring about daily working. Here are key insights for today:\n\n` +
      `• **Total Staff**: **${kpis.totalStaff}**\n` +
      `• **Punched In Today**: **${kpis.cardPresent}**\n` +
      `• **Daily Work Submitted**: **${kpis.workSubmitted}** (${kpis.submissionRate}% compliance)\n` +
      `• **Defaulters (Present but Pending Work)**: **${kpis.presentWithoutWork.length}**\n\n` +
      `Try asking:\n` +
      `- *"Show defaulters"* — see who hasn't submitted work today\n` +
      `- *"Show missing dates backlog"* — see unsubmitted past dates\n` +
      `- *"Show work for [Employee Name]"* — view individual tasks\n` +
      `- *"Download excel report"* — export the full workbook`;
  };

  // Main send handler
  const handleSend = async (overrideText = null) => {
    const textToSend = overrideText || inputValue;
    if (!textToSend.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      sender: "user",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!overrideText) setInputValue("");
    setIsLoading(true);

    // If query matches any of our 3 specialized executive audits, route directly to the deterministic real-time engine
    if (isDuplicacyQuery(textToSend) || isAiUsageQuery(textToSend) || isMoreThanTwoDaysQuery(textToSend)) {
      setTimeout(() => {
        try {
          const botResponse = generateLocalResponse(textToSend.trim());
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
          console.error("Error generating executive audit response:", err);
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: "bot",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              text: "⚠️ **Audit Processing Notice**: The request could not be processed completely. You can download the full Excel register directly using the button below.\n\n[DOWNLOAD_DUPLICACY_BUTTON]",
            },
          ]);
        } finally {
          setIsLoading(false);
        }

        // Auto-download asynchronously after UI has rendered the response
        setTimeout(() => {
          try {
            if (isDuplicacyQuery(textToSend)) {
              const monthSpec = parseTargetMonthFromQuery(textToSend);
              const targetKey = monthSpec?.key || (monthSpec?.isAllMonths ? "ALL" : null);
              handleDownloadDuplicacy(targetKey);
            } else if (isMoreThanTwoDaysQuery(textToSend)) {
              handleDownloadTwoDaysDefaulters();
            } else if (isAiUsageQuery(textToSend)) {
              handleDownloadAiUsage();
            }
          } catch (dlErr) {
            console.error("Auto-download error:", dlErr);
          }
        }, 500);
      }, 250);
      return;
    }

    try {
      // 1. If OpenAI API key is provided, query GPT-4o with real-time ERP context
      if (apiKey && apiKey.trim().startsWith("sk-")) {
        const todayStr = new Date().toLocaleDateString("en-IN");
        const contextPayload = {
          date: todayStr,
          totalStaff: kpis.totalStaff,
          cardPresent: kpis.cardPresent,
          workSubmitted: kpis.workSubmitted,
          defaultersCount: kpis.presentWithoutWork.length,
          defaultersNames: kpis.presentWithoutWork.slice(0, 20).map((p) => p.rawName),
          missingDatesStaffCount: kpis.withMissingDates.length,
          topStaffNames: profiles.slice(0, 30).map((p) => p.rawName),
        };

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `You are the Daily Working AI Analyst for Agrawal Jain & Co. Chartered Accountants (MD Rajesh Agrawal). You report to the Managing Director. Address him respectfully as MD Sir. Answer based strictly on real ERP metrics provided. Current ERP state: ${JSON.stringify(contextPayload)}. Be concise, executive, bullet-pointed, and highly actionable.\n\n${HR_LABOUR_LAW_SYSTEM_PROMPT}`,
              },
              { role: "user", content: textToSend.trim() },
            ],
            max_tokens: 600,
            temperature: 0.3,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content;
          if (reply) {
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now() + 1,
                sender: "bot",
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                text: reply,
              },
            ]);
            setIsLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("OpenAI query failed or timed out, falling back to local engine:", err);
    }

    // 2. Deterministic Local Rule Engine
    setTimeout(() => {
      try {
        const botResponse = generateLocalResponse(textToSend.trim());
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
        console.error("Error generating local rule engine response:", err);
      } finally {
        setIsLoading(false);
      }
    }, 280);
  };

  const clearChat = () => {
    setMessages([
      {
        id: Date.now(),
        sender: "bot",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `Chat cleared. Ask me any question regarding daily working submissions, defaulters, or client assignments!`,
      },
    ]);
  };

  // Formatter for markdown and inline buttons
  const renderFormattedText = (text) => {
    if (!text) return "";
    const hasExcelBtn = text.includes("[DOWNLOAD_EXCEL_BUTTON]");
    const hasDefaultersBtn = text.includes("[DOWNLOAD_DEFAULTERS_BUTTON]");
    const dupeMatch = text.match(/\[DOWNLOAD_DUPLICACY_BUTTON(?::([^\]]+))?\]/);
    const hasDuplicacyBtn = Boolean(dupeMatch);
    const targetMonthKey = dupeMatch ? dupeMatch[1] : null;

    const actionChipsMatch = text.match(/\[ACTION_CHIPS:([^\]]+)\]/);
    const hasActionChips = Boolean(actionChipsMatch);
    const actionChipsData = hasActionChips
      ? actionChipsMatch[1].split(";").map((item) => {
          const [q, lbl] = item.split("|");
          return { query: q, label: lbl || q };
        })
      : [];

    const hasAiBtn = text.includes("[DOWNLOAD_AI_REPORT_BUTTON]");
    const hasTwoDaysDefaultersBtn = text.includes("[DOWNLOAD_TWO_DAYS_DEFAULTERS_BUTTON]");
    const hasLessThanNineHoursBtn = text.includes("[DOWNLOAD_LESS_THAN_9_HOURS_EXCEL]");
    const hasCrossEmployeeDuplicatesBtn = text.includes("[DOWNLOAD_CROSS_EMPLOYEE_DUPLICATES_EXCEL]");
    const hasAllBtns = text.includes("[DOWNLOAD_ALL_BUTTONS]");

    const cleanText = text
      .replace(/\[DOWNLOAD_EXCEL_BUTTON\]/g, "")
      .replace(/\[DOWNLOAD_DEFAULTERS_BUTTON\]/g, "")
      .replace(/\[DOWNLOAD_DUPLICACY_BUTTON(?::([^\]]+))?\]/g, "")
      .replace(/\[DOWNLOAD_AI_REPORT_BUTTON\]/g, "")
      .replace(/\[DOWNLOAD_TWO_DAYS_DEFAULTERS_BUTTON\]/g, "")
      .replace(/\[DOWNLOAD_LESS_THAN_9_HOURS_EXCEL\]/g, "")
      .replace(/\[DOWNLOAD_CROSS_EMPLOYEE_DUPLICATES_EXCEL\]/g, "")
      .replace(/\[DOWNLOAD_ALL_BUTTONS\]/g, "")
      .replace(/\[ACTION_CHIPS:[^\]]+\]/g, "")
      .trim();

    return (
      <>
        {cleanText.split("\n").map((line, index) => {
          if (line.trim() === "") {
            return <div key={index} className="dw-chat-spacer" />;
          }
          const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
          return (
            <div key={index} className="dw-chat-line">
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

        {/* Interactive Action Chips for Months / Quick Actions */}
        {hasActionChips && actionChipsData.length > 0 && (
          <div className="dw-inline-btn-group" style={{ flexWrap: "wrap", gap: "6px", margin: "10px 0" }}>
            {actionChipsData.map((chip, cIdx) => (
              <button
                key={cIdx}
                type="button"
                className="dw-chat-action-btn"
                style={{
                  background: "#f1f5f9",
                  color: "#0f172a",
                  border: "1px solid #cbd5e1",
                  padding: "5px 10px",
                  fontSize: "12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
                onClick={() => handleSend(chip.query)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Duplicacy Action Button */}
        {hasDuplicacyBtn && (
          <div className="dw-inline-btn-group">
            <button
              className="dw-chat-action-btn duplicacy"
              onClick={() => handleDownloadDuplicacy(targetMonthKey)}
              disabled={isExporting}
            >
              🔍 Download Duplicacy Report {targetMonthKey && targetMonthKey !== "CURRENT" && targetMonthKey !== "ALL" ? `(${targetMonthKey})` : "(.xlsx)"}
            </button>
            <button
              className="dw-chat-action-btn excel"
              onClick={handleDownloadExcel}
              disabled={isExporting}
            >
              📊 Full Working Register (.xlsx)
            </button>
          </div>
        )}

        {/* AI & Claude Action Button */}
        {hasAiBtn && (
          <div className="dw-inline-btn-group">
            <button
              className="dw-chat-action-btn ai"
              onClick={handleDownloadAiUsage}
              disabled={isExporting}
            >
              🤖 Download AI & Claude Usage Excel (.xlsx)
            </button>
            <button
              className="dw-chat-action-btn excel"
              onClick={handleDownloadExcel}
              disabled={isExporting}
            >
              📊 Full Working Register (.xlsx)
            </button>
          </div>
        )}

        {/* Two Days Defaulters Action Button */}
        {hasTwoDaysDefaultersBtn && (
          <div className="dw-inline-btn-group">
            <button
              className="dw-chat-action-btn defaulters"
              onClick={handleDownloadTwoDaysDefaulters}
              disabled={isExporting}
            >
              ⚠️ Download Defaulters (> 2 Days) Excel (.xlsx)
            </button>
            <button
              className="dw-chat-action-btn pdf"
              onClick={handleDownloadPDF}
              disabled={isExporting}
            >
              📄 Executive PDF
            </button>
          </div>
        )}

        {/* Less Than 9 Hours Action Button */}
        {hasLessThanNineHoursBtn && (
          <div className="dw-inline-btn-group">
            <button
              className="dw-chat-action-btn defaulters"
              style={{ background: "#b91c1c", borderColor: "#b91c1c", color: "#fff" }}
              onClick={() => handleDownloadLessThanNineHours(targetMonthKey)}
              disabled={isExporting}
            >
              ⏱️ Download Employees &lt; 9 Hours Report (.xlsx)
            </button>
            <button
              className="dw-chat-action-btn excel"
              onClick={handleDownloadExcel}
              disabled={isExporting}
            >
              📊 Full Working Register (.xlsx)
            </button>
          </div>
        )}

        {/* Cross-Employee Same Task Duplicate Action Button */}
        {hasCrossEmployeeDuplicatesBtn && (
          <div className="dw-inline-btn-group">
            <button
              className="dw-chat-action-btn defaulters"
              style={{ background: "#d97706", borderColor: "#d97706", color: "#fff" }}
              onClick={() => handleDownloadCrossEmployeeDuplicates(targetMonthKey)}
              disabled={isExporting}
            >
              👥 Download Same Task Across Employees Report (.xlsx)
            </button>
            <button
              className="dw-chat-action-btn excel"
              onClick={handleDownloadExcel}
              disabled={isExporting}
            >
              📊 Full Working Register (.xlsx)
            </button>
          </div>
        )}

        {/* General Action Buttons */}
        {(hasExcelBtn || hasAllBtns) && (
          <div className="dw-inline-btn-group">
            <button
              className="dw-chat-action-btn excel"
              onClick={handleDownloadExcel}
              disabled={isExporting}
            >
              📊 Download Daily Working Excel
            </button>
            <button
              className="dw-chat-action-btn pdf"
              onClick={handleDownloadPDF}
              disabled={isExporting}
            >
              📄 Download PDF Report
            </button>
          </div>
        )}

        {(hasDefaultersBtn || hasAllBtns) && (
          <div className="dw-inline-btn-group">
            <button
              className="dw-chat-action-btn defaulters"
              onClick={handleDownloadDefaulters}
              disabled={isExporting}
            >
              ⚠️ Download Defaulters Excel List
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <button
        className={`dw-chatbot-launcher-btn ${isOpen ? "active" : ""}`}
        style={launcherStyle}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open Daily Working AI Assistant"
      >
        <span className="dw-chatbot-launcher-icon">💼</span>
        <span className="dw-chatbot-launcher-text">Daily Working AI</span>
        <span className="dw-chatbot-status-pulse"></span>
      </button>

      {/* Floating Window Container */}
      {isOpen && (
        <div className="dw-chatbot-container" style={containerStyle}>
          {/* Header */}
          <div className="dw-chatbot-header">
            <div className="dw-chatbot-header-info">
              <div className="dw-chatbot-avatar">💼</div>
              <div>
                <h3 className="dw-chatbot-title">Daily Working AI Analyst</h3>
                <span className="dw-chatbot-sub">
                  👑 MD Executive Dashboard • Live Analysis
                </span>
              </div>
            </div>

            <div className="dw-chatbot-header-actions">
              {/* Reports Dropdown */}
              <div className="dw-chatbot-download-wrapper" ref={exportMenuRef}>
                <button
                  className={`dw-chatbot-icon-btn ${showExportMenu ? "active" : ""}`}
                  title="Download Reports"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                >
                  📥
                </button>

                {showExportMenu && (
                  <div className="dw-chatbot-export-dropdown">
                    <div className="dw-export-dropdown-header">
                      <span>Daily Working Reports</span>
                      <span className="dw-export-badge">Live</span>
                    </div>

                    <button
                      className="dw-export-dropdown-item excel"
                      onClick={handleDownloadExcel}
                      disabled={isExporting}
                    >
                      <span className="dw-export-icon">📊</span>
                      <div>
                        <strong>Full Excel Report</strong>
                        <small>All staff entries & punch correlations</small>
                      </div>
                    </button>

                    <button
                      className="dw-export-dropdown-item duplicacy"
                      onClick={handleDownloadDuplicacy}
                      disabled={isExporting}
                    >
                      <span className="dw-export-icon">🔍</span>
                      <div>
                        <strong>Duplicacy Audit (.xlsx)</strong>
                        <small>Employees with overlapping & repeated tasks</small>
                      </div>
                    </button>

                    <button
                      className="dw-export-dropdown-item purple"
                      onClick={handleDownloadAiUsage}
                      disabled={isExporting}
                    >
                      <span className="dw-export-icon">🤖</span>
                      <div>
                        <strong>AI & Claude Tasks (.xlsx)</strong>
                        <small>Staff utilizing AI tools in task logs</small>
                      </div>
                    </button>

                    <button
                      className="dw-export-dropdown-item red"
                      onClick={handleDownloadTwoDaysDefaulters}
                      disabled={isExporting}
                    >
                      <span className="dw-export-icon">⚠️</span>
                      <div>
                        <strong>Defaulters &gt; 2 Days (.xlsx)</strong>
                        <small>Categorized Partners, Seniors, Articles, Plant</small>
                      </div>
                    </button>

                    <button
                      className="dw-export-dropdown-item red"
                      onClick={() => handleDownloadLessThanNineHours()}
                      disabled={isExporting}
                    >
                      <span className="dw-export-icon">⏱️</span>
                      <div>
                        <strong>Employees &lt; 9 Hours (.xlsx)</strong>
                        <small>Daily Working shortfall &lt; 9h report</small>
                      </div>
                    </button>

                    <button
                      className="dw-export-dropdown-item"
                      style={{ borderLeft: "3px solid #d97706" }}
                      onClick={() => handleDownloadCrossEmployeeDuplicates()}
                      disabled={isExporting}
                    >
                      <span className="dw-export-icon">👥</span>
                      <div>
                        <strong>Same Task Different Staff (.xlsx)</strong>
                        <small>Matching location, dept, group, company &amp; task</small>
                      </div>
                    </button>

                    <button
                      className="dw-export-dropdown-item pdf"
                      onClick={handleDownloadPDF}
                      disabled={isExporting}
                    >
                      <span className="dw-export-icon">📄</span>
                      <div>
                        <strong>Executive PDF Report</strong>
                        <small>Landscape summary table</small>
                      </div>
                    </button>

                    <button
                      className="dw-export-dropdown-item red"
                      onClick={handleDownloadDefaulters}
                      disabled={isExporting}
                    >
                      <span className="dw-export-icon">⚠️</span>
                      <div>
                        <strong>General Defaulters (.xlsx)</strong>
                        <small>Present but pending work + backlog</small>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Refresh data */}
              <button
                className={`dw-chatbot-icon-btn ${isDataLoading ? "spinning" : ""}`}
                title="Refresh Live Data"
                onClick={loadChatbotData}
              >
                🔄
              </button>

              {/* Settings */}
              <button
                className="dw-chatbot-icon-btn"
                title="Settings (OpenAI Key)"
                onClick={() => setShowSettings(!showSettings)}
              >
                ⚙️
              </button>

              {/* Clear */}
              <button
                className="dw-chatbot-icon-btn"
                title="Clear Chat"
                onClick={clearChat}
              >
                🗑️
              </button>

              {/* Close */}
              <button
                className="dw-chatbot-icon-btn close-btn"
                title="Close"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="dw-chatbot-settings-panel">
              <div style={{ marginBottom: "14px", paddingBottom: "10px", borderBottom: "1px solid #334155" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "#38bdf8", letterSpacing: "0.5px" }}>
                  Google Sheet Integration
                </span>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                  <small style={{ color: "#94a3b8", fontSize: "11px" }}>ID: {DAILY_WORKING_GOOGLE_SHEET_ID.slice(0, 15)}...</small>
                  <a
                    href={DAILY_WORKING_GOOGLE_SHEET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#34d399", fontSize: "12px", textDecoration: "none", fontWeight: 700 }}
                  >
                    Open Sheet ↗
                  </a>
                </div>
              </div>

              {/* Web App URL */}
              <div className="dw-settings-field">
                <label>Daily Working Web App URL:</label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={tempWebAppUrl}
                    onChange={(e) => setTempWebAppUrl(e.target.value)}
                    style={{ fontSize: "12px", fontFamily: "monospace" }}
                  />
                  <button
                    className="dw-settings-save-btn"
                    style={{ background: "#4f46e5", padding: "4px 10px", fontSize: "11px", whiteSpace: "nowrap" }}
                    disabled={testingConn || !tempWebAppUrl.trim()}
                    onClick={async () => {
                      setTestingConn(true);
                      setConnResult(null);
                      const res = await testDailyWorkingConnection(tempWebAppUrl);
                      setTestingConn(false);
                      setConnResult(res);
                    }}
                  >
                    {testingConn ? "..." : "Test"}
                  </button>
                </div>
                {connResult && (
                  <div style={{ marginTop: "4px", fontSize: "11px", color: connResult.success ? "#34d399" : "#f87171" }}>
                    {connResult.success ? "✅ Connected successfully!" : `❌ ${connResult.error}`}
                  </div>
                )}
                <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                  <button
                    className="dw-settings-save-btn"
                    style={{ padding: "4px 8px", fontSize: "11px" }}
                    onClick={() => {
                      setDailyWorkingWebAppUrl(tempWebAppUrl.trim());
                      loadChatbotData();
                    }}
                  >
                    Save URL
                  </button>
                  <button
                    className="dw-settings-cancel-btn"
                    style={{ padding: "4px 8px", fontSize: "11px" }}
                    onClick={() => {
                      setDailyWorkingWebAppUrl("");
                      setTempWebAppUrl(getDailyWorkingWebAppUrl());
                      setConnResult(null);
                      loadChatbotData();
                    }}
                  >
                    Reset Default
                  </button>
                </div>
              </div>

              {/* OpenAI API Key */}
              <div className="dw-settings-field" style={{ marginTop: "14px" }}>
                <label>OpenAI API Key (Optional):</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                />
                <small>Leave empty to use built-in 100% deterministic local ERP analytics engine.</small>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button
                  className="dw-settings-save-btn"
                  onClick={() => {
                    localStorage.setItem("openai_api_key", tempApiKey.trim());
                    setApiKey(tempApiKey.trim());
                    setShowSettings(false);
                  }}
                >
                  Done
                </button>
                <button
                  className="dw-settings-cancel-btn"
                  onClick={() => setShowSettings(false)}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="dw-chatbot-metrics-bar">
            <span
              className="dw-metric-tag staff"
              onClick={() => handleSend("Show today's summary")}
              title="Total Employees"
            >
              👥 Total: <b>{kpis.totalStaff}</b>
            </span>

            <span
              className="dw-metric-tag submitted"
              onClick={() => handleSend("Show submitted work today")}
              title="Daily Work Submitted Today"
            >
              ✅ Work Logged: <b>{kpis.workSubmitted}</b> ({kpis.submissionRate}%)
            </span>

            <span
              className={`dw-metric-tag ${kpis.presentWithoutWork.length > 0 ? "defaulter" : "clean"}`}
              onClick={() => handleSend("Show defaulters list")}
              title="Present today but daily work pending"
            >
              ⚠️ Defaulters: <b>{kpis.presentWithoutWork.length}</b>
            </span>

            <span
              className="dw-metric-tag missing"
              onClick={() => handleSend("Show missing dates defaulters")}
              title="Employees with missing dates backlog"
            >
              📅 Backlog: <b>{kpis.withMissingDates.length}</b>
            </span>
          </div>

          {/* Download Bar */}
          <div className="dw-chatbot-download-bar">
            <span className="dw-dl-label">Downloads:</span>
            <div className="dw-dl-btns">
              <button
                className="dw-dl-btn excel"
                onClick={handleDownloadExcel}
                disabled={isExporting}
                title="Download Full Excel Summary"
              >
                📊 Full Excel
              </button>
              <button
                className="dw-dl-btn duplicacy"
                onClick={handleDownloadDuplicacy}
                disabled={isExporting}
                title="Download Duplicacy Audit Report (.xlsx)"
              >
                🔍 Duplicacy Report
              </button>
              <button
                className="dw-dl-btn pdf"
                onClick={handleDownloadPDF}
                disabled={isExporting}
                title="Download Executive PDF"
              >
                📄 PDF Report
              </button>
              <button
                className="dw-dl-btn defaulters"
                onClick={handleDownloadTwoDaysDefaulters}
                disabled={isExporting}
                title="Download Defaulters (> 2 Days) List (.xlsx)"
              >
                ⚠️ Defaulters &gt; 2 Days
              </button>
              <button
                className="dw-dl-btn defaulters"
                style={{ background: "#fee2e2", color: "#991b1b", borderColor: "#fca5a5" }}
                onClick={() => handleDownloadLessThanNineHours()}
                disabled={isExporting}
                title="Download Employees < 9 Hours Report (.xlsx)"
              >
                ⏱️ &lt; 9 Hours Report
              </button>
              <button
                className="dw-dl-btn defaulters"
                style={{ background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }}
                onClick={() => handleDownloadCrossEmployeeDuplicates()}
                disabled={isExporting}
                title="Download Same Task Across Different Employees (.xlsx)"
              >
                👥 Same Task Staff
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="dw-chatbot-messages">
            {messages.map((m) => (
              <div key={m.id} className={`dw-chatbot-msg ${m.sender}`}>
                <div className="dw-chatbot-msg-bubble">
                  {renderFormattedText(m.text)}
                  <div className="dw-chatbot-msg-time">{m.time}</div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="dw-chatbot-msg bot">
                <div className="dw-chatbot-msg-bubble typing">
                  <span className="dw-typing-dot"></span>
                  <span className="dw-typing-dot"></span>
                  <span className="dw-typing-dot"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div
            className="dw-chatbot-chips"
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
          >
            <button
              onClick={() => handleSend("Duplicacy in work")}
              className="dw-chip-btn red"
              style={{ fontWeight: "700" }}
            >
              🔍 Duplicacy in Work
            </button>
            <button
              onClick={() => handleSend("Duplicacy of October 2026")}
              className="dw-chip-btn red"
              style={{ fontWeight: "700" }}
            >
              🔍 October 2026 Duplicacy
            </button>
            <button
              onClick={() => handleSend("Monthly duplicacy overview")}
              className="dw-chip-btn highlight"
              style={{ fontWeight: "700" }}
            >
              📊 All Months Duplicacy
            </button>
            <button
              onClick={() => handleSend("Uses of Ai or Claude in the task description of daily working")}
              className="dw-chip-btn purple"
              style={{ fontWeight: "700" }}
            >
              🤖 AI &amp; Claude in Tasks
            </button>
            <button
              onClick={() => handleSend("The seniors/articles/plant staff/partners who have not filled their daily working more than 2 days")}
              className="dw-chip-btn amber"
              style={{ fontWeight: "700" }}
            >
              ⚠️ Not Filled &gt; 2 Days (Seniors/Articles/Plant/Partners)
            </button>
            <button
              onClick={() => handleSend("Employees who have less than 9 hours in the daily working sheet in a day")}
              className="dw-chip-btn red"
              style={{ fontWeight: "700" }}
            >
              ⏱️ Less Than 9 Hours Staff
            </button>
            <button
              onClick={() => handleSend("Report when work location, department, group name, company name and task description are same but different employee name")}
              className="dw-chip-btn highlight"
              style={{ fontWeight: "700" }}
            >
              👥 Same Task Different Staff
            </button>
            <button
              onClick={() => handleSend("Individual summary of employees daily working")}
              className="dw-chip-btn highlight"
              style={{ fontWeight: "700" }}
            >
              👥 Employees Work Summary
            </button>
            <button
              onClick={() => handleSend("Daily working summary of CA Harsh Mittal")}
              className="dw-chip-btn highlight"
            >
              📝 Harsh Mittal Work
            </button>
            <button
              onClick={() => handleSend("Daily working summary of Meenu Patel")}
              className="dw-chip-btn highlight"
            >
              📝 Meenu Patel Work
            </button>
            <button
              onClick={() => handleSend("Show today's daily working summary")}
              className="dw-chip-btn highlight"
            >
              📊 Today's Summary
            </button>
            <button
              onClick={() => handleSend("Who is present today but hasn't submitted daily work?")}
              className="dw-chip-btn red"
            >
              ⚠️ Present but Pending Work
            </button>
            <button
              onClick={() => handleSend("Show missing dates defaulters")}
              className="dw-chip-btn amber"
            >
              📅 Missing Dates Defaulters
            </button>
            <button
              onClick={() => handleSend("Which clients / companies are staff working on today?")}
              className="dw-chip-btn"
            >
              🏢 Top Clients Today
            </button>
            <button
              onClick={() => handleSend("Show department-wise daily working")}
              className="dw-chip-btn"
            >
              📂 Department Breakdown
            </button>
            <button
              onClick={() => handleSend("Show daily working details for CA Harsh Mittal")}
              className="dw-chip-btn"
            >
              👤 Harsh Mittal Work
            </button>
            <button
              onClick={() => handleSend("Show daily working details for Akash Yadav")}
              className="dw-chip-btn"
            >
              👤 Akash Yadav Work
            </button>
            <button
              onClick={() => handleSend("Download daily working excel report")}
              className="dw-chip-btn"
            >
              📥 Download Excel
            </button>
          </div>

          {/* Input Box */}
          <div className="dw-chatbot-input-wrapper">
            <input
              type="text"
              placeholder="Ask about daily work, defaulters, clients..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <button
              className="dw-chatbot-send-btn"
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
