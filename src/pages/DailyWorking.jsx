// src/pages/DailyWorking.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  fetchDailyWorkingLogs,
  fetchCardPunchLogs,
  fetchEmployeeMasterList,
  fetchDropdownsData,
  buildUnifiedDailyWorkingProfiles,
  exportDailyWorkingToExcel,
  exportDailyWorkingToPDF,
  exportLessThanNineHoursReportToExcel,
  auditEmployeesLessThanNineHours,
  exportCrossEmployeeDuplicatesToExcel,
  auditCrossEmployeeDuplicateTasks,
  formatDisplayTime,
  formatExcelOrStringDate,
  DAILY_WORKING_GOOGLE_SHEET_ID,
  DAILY_WORKING_GOOGLE_SHEET_URL,
  getDailyWorkingWebAppUrl,
  setDailyWorkingWebAppUrl,
  testDailyWorkingConnection,
  getDailyWorkingSourceStatus,
  getMonthYearInfo,
  getAllAvailableMonths,
} from "../utils/dailyWorkingService";
import {
  isPartnerOrSenior,
  isPartner,
  isSenior,
  isArticle,
  isPartnerSeniorOrArticle,
  getEmployeeCategoryInfo,
} from "../utils/attendanceConfig";
import "./DailyWorking.css";
import DailyWorkingChatbot from "../components/DailyWorkingChatbot";

export default function DailyWorking() {
  const navigate = useNavigate();
  const location = useLocation();

  // Raw data states
  const [workingLogs, setWorkingLogs] = useState([]);
  const [punchLogs, setPunchLogs] = useState([]);
  const [employeeMaster, setEmployeeMaster] = useState([]);
  const [dropdowns, setDropdowns] = useState({ doers: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active view: 'cards' | 'table' | 'defaulters'
  const [activeView, setActiveView] = useState("cards");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState(() => location.state?.role || "ALL"); // ALL | PARTNERS_SENIORS | PARTNER | SENIOR | ARTICLE | PLANT_AUDIT | BACK_OFFICE
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedMonth, setSelectedMonth] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL"); // ALL | PRESENT | WORK_DONE | WORK_PENDING | MISSING_DATES
  const [sortBy, setSortBy] = useState("recent"); // recent | entries | name | missing

  // Export dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Google Sheet & API Config Modal
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiInputUrl, setApiInputUrl] = useState(() => getDailyWorkingWebAppUrl());
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState(null);
  const [sourceStatus, setSourceStatus] = useState(() => getDailyWorkingSourceStatus());

  // Selected employee for detail modal
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [chatSelectedEmp, setChatSelectedEmp] = useState(null);

  // Load all data
  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [wLogs, pLogs, eMaster, dData] = await Promise.all([
        fetchDailyWorkingLogs(),
        fetchCardPunchLogs(),
        fetchEmployeeMasterList(),
        fetchDropdownsData(),
      ]);

      setWorkingLogs(wLogs);
      setPunchLogs(pLogs);
      setEmployeeMaster(eMaster);
      setDropdowns(dData || { doers: [], departments: [] });
      setSourceStatus(getDailyWorkingSourceStatus());
    } catch (err) {
      console.error("Error loading daily working dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Build unified employee profiles
  const profiles = useMemo(() => {
    return buildUnifiedDailyWorkingProfiles({
      workingLogs,
      punchLogs,
      employeeMaster,
      dropdownDoers: dropdowns.doers || [],
    });
  }, [workingLogs, punchLogs, employeeMaster, dropdowns]);

  // Available months across daily working logs
  const availableMonths = useMemo(() => {
    return getAllAvailableMonths(workingLogs);
  }, [workingLogs]);

  // Extract unique departments for filter dropdown
  const departmentOptions = useMemo(() => {
    const set = new Set();
    profiles.forEach((p) => {
      if (p.department && p.department !== "General") set.add(p.department);
      if (p.category?.label) set.add(p.category.label);
    });
    return Array.from(set).sort();
  }, [profiles]);

  // Filtered & Sorted Profiles
  const filteredProfiles = useMemo(() => {
    let result = profiles.filter((p) => {
      // Month filter
      if (selectedMonth !== "ALL") {
        const hasEntryInMonth = (p.workingEntries || []).some((e) => {
          const my = getMonthYearInfo(e.date || e.timestamp);
          return my && my.key === selectedMonth;
        });
        if (!hasEntryInMonth) return false;
      }

      // Search filter
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesName = p.rawName.toLowerCase().includes(query);
        const matchesDept = (p.department || "").toLowerCase().includes(query);
        const matchesCompany = p.latestEntry?.companyName?.toLowerCase().includes(query);
        const matchesTask = p.latestEntry?.taskDescription?.toLowerCase().includes(query);
        if (!matchesName && !matchesDept && !matchesCompany && !matchesTask) {
          return false;
        }
      }

      // Role filter (Partners, Seniors & Articles accurate data from attendanceConfig.js)
      if (selectedRole === "PARTNERS_SENIORS_ARTICLES") {
        if (!isPartnerSeniorOrArticle(p.rawName, p)) return false;
      } else if (selectedRole === "PARTNERS_SENIORS") {
        if (!isPartnerOrSenior(p.rawName, p)) return false;
      } else if (selectedRole === "PARTNER") {
        if (!isPartner(p.rawName, p)) return false;
      } else if (selectedRole === "SENIOR") {
        if (!isSenior(p.rawName, p)) return false;
      } else if (selectedRole === "ARTICLE") {
        if (!isArticle(p.rawName, p)) return false;
      } else if (selectedRole === "PLANT_AUDIT") {
        if (p.category?.categoryKey !== "PLANT_AUDIT") return false;
      } else if (selectedRole === "BACK_OFFICE") {
        if (p.category?.categoryKey !== "BACK_OFFICE") return false;
      }

      // Department filter
      if (selectedDept !== "ALL") {
        const matchesDept = p.department === selectedDept || p.category?.label === selectedDept;
        if (!matchesDept) return false;
      }

      // Status filter
      if (selectedStatus === "PRESENT" && !p.cardPresent) return false;
      if (selectedStatus === "WORK_DONE" && !p.submittedToday) return false;
      if (selectedStatus === "WORK_PENDING" && p.submittedToday) return false;
      if (selectedStatus === "MISSING_DATES" && p.missingDates.length === 0) return false;

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "name") {
        return a.rawName.localeCompare(b.rawName);
      }
      if (sortBy === "entries") {
        return b.totalEntries - a.totalEntries;
      }
      if (sortBy === "missing") {
        return b.missingDates.length - a.missingDates.length;
      }
      // default: recent
      const timeA = a.lastUpdatedTimestamp ? new Date(a.lastUpdatedTimestamp).getTime() : 0;
      const timeB = b.lastUpdatedTimestamp ? new Date(b.lastUpdatedTimestamp).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return b.totalEntries - a.totalEntries;
    });

    return result;
  }, [profiles, selectedMonth, searchQuery, selectedRole, selectedDept, selectedStatus, sortBy]);

  // Tab 2 (Table) Pagination & Filters
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(50);

  const filteredWorkingLogs = useMemo(() => {
    return workingLogs.filter((entry) => {
      // Month filter
      if (selectedMonth !== "ALL") {
        const my = getMonthYearInfo(entry.date || entry.timestamp);
        if (!my || my.key !== selectedMonth) return false;
      }

      // Role filter
      const doer = entry.doerName || entry.employeeName || "";
      if (selectedRole === "PARTNERS_SENIORS_ARTICLES") {
        if (!isPartnerSeniorOrArticle(doer, entry)) return false;
      } else if (selectedRole === "PARTNERS_SENIORS") {
        if (!isPartnerOrSenior(doer, entry)) return false;
      } else if (selectedRole === "PARTNER") {
        if (!isPartner(doer, entry)) return false;
      } else if (selectedRole === "SENIOR") {
        if (!isSenior(doer, entry)) return false;
      } else if (selectedRole === "ARTICLE") {
        if (!isArticle(doer, entry)) return false;
      } else if (selectedRole === "PLANT_AUDIT") {
        const cat = getEmployeeCategoryInfo(doer, entry);
        if ((cat.categoryKey || cat.key) !== "PLANT_AUDIT") return false;
      } else if (selectedRole === "BACK_OFFICE") {
        const cat = getEmployeeCategoryInfo(doer, entry);
        if ((cat.categoryKey || cat.key) !== "BACK_OFFICE") return false;
      }

      if (selectedDept !== "ALL") {
        if ((entry.department || "").toLowerCase() !== selectedDept.toLowerCase()) {
          return false;
        }
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const d = doer.toLowerCase();
        const comp = (entry.companyName || "").toLowerCase();
        const task = (entry.taskDescription || "").toLowerCase();
        const dept = (entry.department || "").toLowerCase();
        if (!d.includes(q) && !comp.includes(q) && !task.includes(q) && !dept.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [workingLogs, selectedMonth, selectedRole, selectedDept, searchQuery]);

  useEffect(() => {
    setTablePage(1);
  }, [searchQuery, selectedRole, selectedDept, selectedMonth]);

  const totalTablePages = Math.max(1, Math.ceil(filteredWorkingLogs.length / tablePageSize));
  const paginatedWorkingLogs = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return filteredWorkingLogs.slice(start, start + tablePageSize);
  }, [filteredWorkingLogs, tablePage, tablePageSize]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const totalStaff = profiles.length;
    const cardPresent = profiles.filter((p) => p.cardPresent).length;
    const workSubmitted = profiles.filter((p) => p.submittedToday).length;
    const workPending = profiles.filter((p) => !p.submittedToday).length;
    const totalMissingInstances = profiles.reduce((acc, p) => acc + p.missingDates.length, 0);
    const presentRate = totalStaff > 0 ? Math.round((cardPresent / totalStaff) * 100) : 0;
    const submissionRate = cardPresent > 0 ? Math.round((workSubmitted / cardPresent) * 100) : 0;

    return {
      totalStaff,
      cardPresent,
      workSubmitted,
      workPending,
      totalMissingInstances,
      presentRate,
      submissionRate,
    };
  }, [profiles]);

  // Defaulters lists
  const presentWithoutWork = useMemo(() => {
    return profiles.filter((p) => p.cardPresent && !p.submittedToday);
  }, [profiles]);

  const staffWithMissingDates = useMemo(() => {
    return profiles.filter((p) => p.missingDates.length > 0).sort((a, b) => b.missingDates.length - a.missingDates.length);
  }, [profiles]);

  const underNineHoursAudit = useMemo(() => {
    return auditEmployeesLessThanNineHours(workingLogs, profiles);
  }, [workingLogs, profiles]);

  const crossEmployeeAudit = useMemo(() => {
    return auditCrossEmployeeDuplicateTasks(workingLogs, profiles);
  }, [workingLogs, profiles]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".dw-export-dropdown-wrapper")) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="dw-dashboard-page">
      {/* TOP NAVIGATION / BREADCRUMB */}
      <div className="dw-top-bar">
        <button className="dw-back-btn" onClick={() => navigate(-1)}>
          <span>←</span> Back to Dashboard
        </button>

        <div className="dw-portal-pill">
          <span className="pulse-dot"></span>
          Agrawal Jain & Co. • Daily Working System
        </div>
      </div>

      {/* HERO HEADER */}
      <div className="dw-header-card">
        <div className="dw-header-info">
          <h1>
            <span>💼</span> Daily Working & Card Present Portal
          </h1>
          <p>
            Consolidated daily work submissions, real-time Card Punch (In/Out) attendance, and pending dates tracker
            for all employees.
          </p>
        </div>

        <div className="dw-header-actions">
          {/* REFRESH */}
          <button
            className={`dw-action-btn dw-btn-refresh ${refreshing ? "spinning" : ""}`}
            onClick={() => loadData(true)}
            title="Refresh Live Data"
          >
            <span className="spin-icon">🔄</span> {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          {/* EXPORT DROPDOWN */}
          <div className="dw-export-dropdown-wrapper">
            <button
              className="dw-action-btn dw-btn-export"
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              <span>📥</span> Export Report ▾
            </button>

            {showExportMenu && (
              <div className="dw-export-menu">
                <button
                  className="dw-export-item"
                  onClick={() => {
                    setShowExportMenu(false);
                    exportDailyWorkingToExcel(profiles, workingLogs);
                  }}
                >
                  <span>📊</span> Export to Excel (.xlsx)
                </button>
                <button
                  className="dw-export-item"
                  onClick={() => {
                    setShowExportMenu(false);
                    exportDailyWorkingToPDF(profiles);
                  }}
                >
                  <span>📄</span> Export Summary PDF
                </button>
                <button
                  className="dw-export-item"
                  onClick={() => {
                    setShowExportMenu(false);
                    exportLessThanNineHoursReportToExcel(workingLogs, profiles);
                  }}
                >
                  <span>⏱️</span> Export Employees &lt; 9 Hours (.xlsx)
                </button>
                <button
                  className="dw-export-item"
                  onClick={() => {
                    setShowExportMenu(false);
                    exportCrossEmployeeDuplicatesToExcel(workingLogs, profiles);
                  }}
                >
                  <span>👥</span> Export Same Task Across Employees (.xlsx)
                </button>
              </div>
            )}
          </div>

          {/* GOOGLE SHEET DIRECT LINK */}
          <a
            className="dw-action-btn dw-btn-sheet-link"
            href={DAILY_WORKING_GOOGLE_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Open Live Daily Working Google Sheet"
          >
            <span>📊</span> Google Sheet ↗
          </a>

          {/* API CONFIG / SETTINGS */}
          <button
            className="dw-action-btn dw-btn-config"
            onClick={() => {
              setApiInputUrl(getDailyWorkingWebAppUrl());
              setApiTestResult(null);
              setShowApiModal(true);
            }}
            title="Configure Live Google Apps Script API URL"
          >
            <span>⚙️</span> API Config
          </button>

          {/* ATTENDANCE ANALYSIS LINK */}
          <button
            className="dw-action-btn dw-btn-secondary"
            onClick={() => navigate("/attendance-report")}
          >
            <span>📇</span> Attendance Analysis
          </button>

          {/* ADD DAILY WORK BUTTON */}
          <button
            className="dw-action-btn dw-btn-primary"
            onClick={() => navigate("/daily-working-form")}
          >
            <span>➕</span> Add Daily Work
          </button>
        </div>
      </div>

      {/* GOOGLE SHEET STATUS BANNER (if restricted) */}
      {sourceStatus.isSheetRestricted && (
        <div className="dw-sheet-status-banner">
          <div className="dw-sheet-status-left">
            <span className="dw-status-indicator warn">⚠️</span>
            <div>
              <div className="dw-sheet-status-title">
                Google Sheet Access Required to Show All Live Data
              </div>
              <p className="dw-sheet-status-desc">
                Your sheet (ID: <code>{DAILY_WORKING_GOOGLE_SHEET_ID}</code>) is currently <strong>Restricted (Private)</strong>, so only {workingLogs.length} sample entries are loaded. Choose either quick step to view all live sheet entries:
              </p>
            </div>
          </div>
          <div className="dw-sheet-status-actions">
            <a
              href={DAILY_WORKING_GOOGLE_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="dw-banner-btn green"
            >
              ⚡ Fast (10s): Share &gt; "Anyone with link" ↗
            </a>
            <button
              onClick={() => {
                setApiInputUrl(getDailyWorkingWebAppUrl());
                setApiTestResult(null);
                setShowApiModal(true);
              }}
              className="dw-banner-btn indigo"
            >
              ⚙️ Deploy Web App &amp; Paste URL
            </button>
          </div>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="dw-kpi-grid">
        {/* TOTAL EMPLOYEES */}
        <div className="dw-kpi-card blue">
          <div className="dw-kpi-info">
            <h4>Total Staff Tracked</h4>
            <div className="dw-kpi-number">{loading ? "..." : kpis.totalStaff}</div>
            <p className="dw-kpi-subtext">Across All Departments</p>
          </div>
          <div className="dw-kpi-icon-box">👥</div>
        </div>

        {/* CARD PRESENT TODAY */}
        <div className="dw-kpi-card green">
          <div className="dw-kpi-info">
            <h4>Card Present (Punched In)</h4>
            <div className="dw-kpi-number">{loading ? "..." : kpis.cardPresent}</div>
            <p className="dw-kpi-subtext">
              {kpis.presentRate}% Attendance Turnout Today
            </p>
          </div>
          <div className="dw-kpi-icon-box">📇</div>
        </div>

        {/* WORK SUBMITTED TODAY */}
        <div className="dw-kpi-card emerald">
          <div className="dw-kpi-info">
            <h4>Work Done Today</h4>
            <div className="dw-kpi-number">{loading ? "..." : kpis.workSubmitted}</div>
            <p className="dw-kpi-subtext">
              {kpis.submissionRate}% Of Present Staff Submitted
            </p>
          </div>
          <div className="dw-kpi-icon-box">✅</div>
        </div>

        {/* WORK PENDING TODAY */}
        <div className="dw-kpi-card amber">
          <div className="dw-kpi-info">
            <h4>Work Pending Today</h4>
            <div className="dw-kpi-number">{loading ? "..." : kpis.workPending}</div>
            <p className="dw-kpi-subtext">
              {presentWithoutWork.length} Present But Not Submitted
            </p>
          </div>
          <div className="dw-kpi-icon-box">⏳</div>
        </div>

        {/* MISSING DATES INSTANCES */}
        <div className="dw-kpi-card rose">
          <div className="dw-kpi-info">
            <h4>Total Missing Dates</h4>
            <div className="dw-kpi-number">{loading ? "..." : kpis.totalMissingInstances}</div>
            <p className="dw-kpi-subtext">
              {staffWithMissingDates.length} Staff Have Backlogs
            </p>
          </div>
          <div className="dw-kpi-icon-box">⚠️</div>
        </div>
      </div>

      {/* CONTROLS CARD: SEARCH, TABS, FILTERS */}
      <div className="dw-controls-card">
        <div className="dw-controls-top">
          {/* SEARCH BAR */}
          <div className="dw-search-box">
            <span className="dw-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by employee name, department, company, or task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* VIEW SWITCHER TABS */}
          <div className="dw-view-tabs">
            <button
              className={`dw-tab-btn ${activeView === "cards" ? "active" : ""}`}
              onClick={() => setActiveView("cards")}
            >
              <span>🗂️</span> Cards View ({filteredProfiles.length})
            </button>
            <button
              className={`dw-tab-btn ${activeView === "table" ? "active" : ""}`}
              onClick={() => setActiveView("table")}
            >
              <span>📋</span> All Logs Table ({workingLogs.length})
            </button>
            <button
              className={`dw-tab-btn ${activeView === "defaulters" ? "active" : ""}`}
              onClick={() => setActiveView("defaulters")}
            >
              <span>⚠️</span> Pending & Defaulters ({presentWithoutWork.length})
            </button>
          </div>
        </div>

        {/* ROLE FILTER STRIP */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "10px 16px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>Role Filter:</span>
          <button
            className={`dw-filter-pill ${selectedRole === "ALL" ? "active" : ""}`}
            onClick={() => setSelectedRole("ALL")}
          >
            All Staff ({profiles.length})
          </button>
          <button
            className={`dw-filter-pill ${selectedRole === "PARTNERS_SENIORS_ARTICLES" ? "active" : ""}`}
            style={selectedRole === "PARTNERS_SENIORS_ARTICLES" ? { background: "#0f766e", color: "#fff", borderColor: "#0f766e", fontWeight: "700" } : {}}
            onClick={() => setSelectedRole("PARTNERS_SENIORS_ARTICLES")}
          >
            🤝👔📚 Core (Partners, Seniors &amp; Articles)
          </button>
          <button
            className={`dw-filter-pill ${selectedRole === "PARTNERS_SENIORS" ? "active" : ""}`}
            style={selectedRole === "PARTNERS_SENIORS" ? { background: "#0f766e", color: "#fff", borderColor: "#0f766e", fontWeight: "700" } : {}}
            onClick={() => setSelectedRole("PARTNERS_SENIORS")}
          >
            🤝👔 Partners &amp; Seniors
          </button>
          <button
            className={`dw-filter-pill ${selectedRole === "PARTNER" ? "active" : ""}`}
            style={selectedRole === "PARTNER" ? { background: "#7c3aed", color: "#fff", borderColor: "#7c3aed", fontWeight: "700" } : {}}
            onClick={() => setSelectedRole("PARTNER")}
          >
            🤝 Partners
          </button>
          <button
            className={`dw-filter-pill ${selectedRole === "SENIOR" ? "active" : ""}`}
            style={selectedRole === "SENIOR" ? { background: "#0f766e", color: "#fff", borderColor: "#0f766e", fontWeight: "700" } : {}}
            onClick={() => setSelectedRole("SENIOR")}
          >
            👔 Seniors
          </button>
          <button
            className={`dw-filter-pill ${selectedRole === "ARTICLE" ? "active" : ""}`}
            onClick={() => setSelectedRole("ARTICLE")}
          >
            📚 Articles
          </button>
          <button
            className={`dw-filter-pill ${selectedRole === "PLANT_AUDIT" ? "active" : ""}`}
            onClick={() => setSelectedRole("PLANT_AUDIT")}
          >
            🏭 Plant Audit
          </button>
          <button
            className={`dw-filter-pill ${selectedRole === "BACK_OFFICE" ? "active" : ""}`}
            onClick={() => setSelectedRole("BACK_OFFICE")}
          >
            🏢 Back Office
          </button>
        </div>

        {/* FILTERS ROW */}
        <div className="dw-filters-row">
          <span className="dw-filter-label">Filter By:</span>

          {/* MONTH SELECT */}
          <select
            className="dw-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="ALL">All Months ({availableMonths.length})</option>
            {availableMonths.map((m) => (
              <option key={m.key} value={m.key}>
                📅 {m.label} ({m.count} logs)
              </option>
            ))}
          </select>

          {/* DEPARTMENT SELECT */}
          <select
            className="dw-select"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            {departmentOptions.map((dept, i) => (
              <option key={i} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* STATUS SELECT */}
          <select
            className="dw-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="PRESENT">Card Present (Punched In)</option>
            <option value="WORK_DONE">Work Logged Today</option>
            <option value="WORK_PENDING">Work Pending Today</option>
            <option value="MISSING_DATES">Has Missing Dates</option>
          </select>

          {/* SORT BY */}
          <select
            className="dw-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="recent">Sort by: Recent Activity</option>
            <option value="entries">Sort by: Most Entries</option>
            <option value="missing">Sort by: Most Missing Dates</option>
            <option value="name">Sort by: Name (A-Z)</option>
          </select>

          {/* QUICK PILLS */}
          <div className="dw-pill-filter-group">
            <button
              className={`dw-filter-pill ${selectedStatus === "PRESENT" ? "active" : ""}`}
              onClick={() => setSelectedStatus(selectedStatus === "PRESENT" ? "ALL" : "PRESENT")}
            >
              🟢 Present Today ({kpis.cardPresent})
            </button>
            <button
              className={`dw-filter-pill ${selectedStatus === "WORK_DONE" ? "active" : ""}`}
              onClick={() => setSelectedStatus(selectedStatus === "WORK_DONE" ? "ALL" : "WORK_DONE")}
            >
              ✅ Work Done ({kpis.workSubmitted})
            </button>
            <button
              className={`dw-filter-pill ${selectedStatus === "WORK_PENDING" ? "active" : ""}`}
              onClick={() => setSelectedStatus(selectedStatus === "WORK_PENDING" ? "ALL" : "WORK_PENDING")}
            >
              ⏳ Work Pending ({kpis.workPending})
            </button>
            <button
              className={`dw-filter-pill ${selectedStatus === "MISSING_DATES" ? "active" : ""}`}
              onClick={() => setSelectedStatus(selectedStatus === "MISSING_DATES" ? "ALL" : "MISSING_DATES")}
            >
              ⚠️ Missing Dates ({staffWithMissingDates.length})
            </button>
          </div>
        </div>
      </div>

      {/* LOADING STATE */}
      {loading ? (
        <div className="dw-loading-state">
          <div className="dw-spinner"></div>
          <p>Loading real-time Daily Working and Card Attendance data...</p>
        </div>
      ) : null}

      {/* TAB 1: CARDS VIEW */}
      {!loading && activeView === "cards" && (
        <>
          {filteredProfiles.length === 0 ? (
            <div className="dw-empty-state">
              <div className="dw-empty-icon">🔍</div>
              <h3>No employees found matching the filters</h3>
              <p>Try resetting the search keyword or selecting "All Departments".</p>
            </div>
          ) : (
            <div className="dw-cards-grid">
              {filteredProfiles.map((emp) => {
                const initials = emp.rawName
                  .split(" ")
                  .map((w) => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                const categoryColor = emp.category?.color || "#3b82f6";
                const dedicatedRoute = emp.dedicatedRoute;

                return (
                  <div key={emp.id} className="dw-emp-card">
                    {/* CARD HEADER */}
                    <div className="dw-card-header">
                      <div
                        className="dw-avatar"
                        style={{
                          background: `linear-gradient(135deg, ${categoryColor} 0%, #0f172a 100%)`,
                        }}
                      >
                        {initials}
                      </div>

                      <div className="dw-emp-meta">
                        <h3 className="dw-emp-name" title={emp.rawName}>
                          {emp.rawName}
                        </h3>
                        <div className="dw-emp-badges">
                          <span className="dw-badge dw-badge-dept">
                            {emp.department || "Staff"}
                          </span>
                          {emp.category?.shortLabel && (
                            <span
                              className="dw-badge dw-badge-cat"
                              style={{ borderColor: categoryColor, color: categoryColor }}
                            >
                              {emp.category.icon} {emp.category.shortLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* STATUS CHIPS: ATTENDANCE & WORK */}
                    <div className="dw-status-chips-row">
                      {/* CARD PUNCH */}
                      {emp.cardPresent ? (
                        <div className="dw-chip card-present" title={`In Time: ${emp.punchIn || "Present"}`}>
                          <span>🟢</span>
                          <span>Card Present ({emp.punchIn ? formatDisplayTime(emp.punchIn) : "In"})</span>
                        </div>
                      ) : (
                        <div className="dw-chip card-absent">
                          <span>⚪</span>
                          <span>Card Absent</span>
                        </div>
                      )}

                      {/* WORK SUBMISSION */}
                      {emp.submittedToday ? (
                        <div className="dw-chip work-done">
                          <span>✅</span>
                          <span>Work Done Today ({emp.todayEntriesCount})</span>
                        </div>
                      ) : (
                        <div className="dw-chip work-pending">
                          <span>⏳</span>
                          <span>Work Pending</span>
                        </div>
                      )}
                    </div>

                    {/* CARD STATS SUMMARY BAR */}
                    <div className="dw-card-stats-bar">
                      <div className="dw-card-stat-item">
                        <span className="stat-label">Total Entries</span>
                        <span className="stat-val">{emp.totalEntries}</span>
                      </div>

                      <div className="dw-card-stat-item">
                        <span className="stat-label">Last Updated</span>
                        <span className="stat-val">
                          {emp.lastUpdatedDate ? emp.lastUpdatedDate.slice(0, 5) : "--"}
                        </span>
                      </div>

                      <div
                        className={`dw-card-stat-item ${
                          emp.missingDates.length > 0 ? "missing-warn" : ""
                        }`}
                      >
                        <span className="stat-label">Pending Dates</span>
                        <span className="stat-val">
                          {emp.missingDates.length > 0
                            ? `${emp.missingDates.length} Days`
                            : "0 Days"}
                        </span>
                      </div>
                    </div>

                    {/* LATEST TASK PREVIEW */}
                    {emp.latestEntry ? (
                      <div className="dw-task-box">
                        <div className="dw-task-header">
                          <span className="dw-task-company">
                            🏢 {emp.latestEntry.companyName || emp.latestEntry.groupName || "Work Entry"}
                          </span>
                          <span>{emp.latestEntry.department || ""}</span>
                        </div>

                        <p className="dw-task-desc">
                          {emp.latestEntry.taskDescription || "No detailed description."}
                        </p>

                        <div className="dw-task-footer">
                          <span>⏱️ {emp.latestEntry.timeGiven || "Logged"}</span>
                          <span>📅 {emp.latestEntry.formattedDate || emp.latestEntry.date}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="dw-no-task">
                        No daily work entries submitted yet.
                      </div>
                    )}

                    {/* CARD ACTIONS */}
                    <div className="dw-card-actions">
                      <button
                        className="dw-btn-view-details"
                        onClick={() => setSelectedEmp(emp)}
                      >
                        <span>👁️</span> View History ({emp.totalEntries})
                      </button>

                      {dedicatedRoute && (
                        <button
                          className="dw-btn-sheet"
                          onClick={() => navigate(dedicatedRoute)}
                          title="Open Employee's Dedicated Daily Working Page"
                        >
                          <span>📄</span> Sheet
                        </button>
                      )}

                      <button
                        className="dw-btn-add-work"
                        onClick={() => navigate("/daily-working-form")}
                        title="Add New Daily Work for Employee"
                      >
                        <span>➕</span> Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: CONSOLIDATED MASTER TABLE */}
      {!loading && activeView === "table" && (
        <div className="dw-table-container">
          <div className="dw-table-wrapper">
            <table className="dw-data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Period</th>
                  <th>Location</th>
                  <th>Group / Client</th>
                  <th>Company Name</th>
                  <th>Task Description</th>
                  <th>Time Given</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkingLogs.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: "center", padding: "40px" }}>
                      No daily work logs match your filter.
                    </td>
                  </tr>
                ) : (
                  paginatedWorkingLogs.map((entry, idx) => {
                    const absIdx = (tablePage - 1) * tablePageSize + idx + 1;
                    return (
                      <tr key={idx}>
                        <td className="mono-cell">{absIdx}</td>
                        <td className="mono-cell">
                          {formatExcelOrStringDate(entry.date)}
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          {entry.doerName || entry.employeeName || "-"}
                        </td>
                        <td>
                          <span className="dw-badge dw-badge-dept">
                            {entry.department || "-"}
                          </span>
                        </td>
                        <td>{entry.period || "-"}</td>
                        <td>{entry.location || "-"}</td>
                        <td>{entry.groupName || "-"}</td>
                        <td style={{ fontWeight: 600 }}>{entry.companyName || "-"}</td>
                        <td style={{ maxWidth: 350 }}>{entry.taskDescription || "-"}</td>
                        <td className="mono-cell" style={{ fontWeight: 700 }}>
                          {entry.timeGiven || "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE PAGINATION BAR */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              background: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ fontSize: "13px", color: "#475569" }}>
              Showing{" "}
              <strong>
                {filteredWorkingLogs.length > 0 ? (tablePage - 1) * tablePageSize + 1 : 0}
              </strong>{" "}
              to{" "}
              <strong>
                {Math.min(tablePage * tablePageSize, filteredWorkingLogs.length)}
              </strong>{" "}
              of <strong>{filteredWorkingLogs.length.toLocaleString()}</strong> total entries
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "12px", color: "#64748b" }}>Rows per page:</label>
              <select
                value={tablePageSize}
                onChange={(e) => {
                  setTablePageSize(Number(e.target.value));
                  setTablePage(1);
                }}
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "12px",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>

              <button
                onClick={() => setTablePage(1)}
                disabled={tablePage === 1}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: tablePage === 1 ? "#f1f5f9" : "#fff",
                  color: tablePage === 1 ? "#94a3b8" : "#0f172a",
                  cursor: tablePage === 1 ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                « First
              </button>

              <button
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                disabled={tablePage === 1}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: tablePage === 1 ? "#f1f5f9" : "#fff",
                  color: tablePage === 1 ? "#94a3b8" : "#0f172a",
                  cursor: tablePage === 1 ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                ‹ Prev
              </button>

              <span style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b", margin: "0 6px" }}>
                Page {tablePage} of {totalTablePages}
              </span>

              <button
                onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                disabled={tablePage === totalTablePages}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: tablePage === totalTablePages ? "#f1f5f9" : "#fff",
                  color: tablePage === totalTablePages ? "#94a3b8" : "#0f172a",
                  cursor: tablePage === totalTablePages ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                Next ›
              </button>

              <button
                onClick={() => setTablePage(totalTablePages)}
                disabled={tablePage === totalTablePages}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: tablePage === totalTablePages ? "#f1f5f9" : "#fff",
                  color: tablePage === totalTablePages ? "#94a3b8" : "#0f172a",
                  cursor: tablePage === totalTablePages ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                Last »
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DEFAULTERS & PENDING VIEW */}
      {!loading && activeView === "defaulters" && (
        <div className="dw-defaulters-grid">
          {/* SECTION 1: CARD PRESENT TODAY BUT NO DAILY WORK */}
          <div className="dw-defaulter-section-card">
            <div className="dw-defaulter-header">
              <h3>
                <span>🔴</span> Card Present Today but Work Pending
              </h3>
              <span className="dw-badge" style={{ background: "#fee2e2", color: "#991b1b" }}>
                {presentWithoutWork.length} Employees
              </span>
            </div>

            {presentWithoutWork.length === 0 ? (
              <div className="dw-empty-state" style={{ padding: "30px" }}>
                <p>🎉 Excellent! All employees who punched in today have submitted their daily work!</p>
              </div>
            ) : (
              <div className="dw-defaulter-list">
                {presentWithoutWork.map((emp) => (
                  <div key={emp.id} className="dw-defaulter-row">
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "14px" }}>{emp.rawName}</div>
                      <div style={{ fontSize: "12px", color: "var(--dw-text-muted)" }}>
                        {emp.department} • Punched in at {formatDisplayTime(emp.punchIn)}
                      </div>
                    </div>
                    <button
                      className="dw-btn-add-work"
                      onClick={() => navigate("/daily-working-form")}
                    >
                      Remind / Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: STAFF WITH MISSING PAST DATES */}
          <div className="dw-defaulter-section-card">
            <div className="dw-defaulter-header">
              <h3>
                <span>⚠️</span> Staff with Missing Past Dates
              </h3>
              <span className="dw-badge" style={{ background: "#fef3c7", color: "#b45309" }}>
                {staffWithMissingDates.length} Employees
              </span>
            </div>

            {staffWithMissingDates.length === 0 ? (
              <div className="dw-empty-state" style={{ padding: "30px" }}>
                <p>All employee submission dates are 100% up to date!</p>
              </div>
            ) : (
              <div className="dw-defaulter-list">
                {staffWithMissingDates.map((emp) => (
                  <div key={emp.id} className="dw-defaulter-row">
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "14px" }}>{emp.rawName}</div>
                      <div style={{ fontSize: "12px", color: "#e11d48", fontWeight: 700 }}>
                        {emp.missingDates.length} dates missing
                      </div>
                    </div>
                    <button
                      className="dw-btn-view-details"
                      onClick={() => setSelectedEmp(emp)}
                    >
                      View Dates
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 3: STAFF LOGGED LESS THAN 9 HOURS */}
          <div className="dw-defaulter-section-card">
            <div className="dw-defaulter-header">
              <h3>
                <span>⏱️</span> Employees Logged &lt; 9 Hours in a Day
              </h3>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span className="dw-badge" style={{ background: "#fee2e2", color: "#991b1b" }}>
                  {underNineHoursAudit.kpis.totalShortfallDays} Days &lt; 9h
                </span>
                <button
                  className="dw-action-btn dw-btn-export"
                  style={{ padding: "4px 10px", fontSize: "12px", background: "#b91c1c", color: "#fff", borderColor: "#b91c1c" }}
                  onClick={() => exportLessThanNineHoursReportToExcel(workingLogs, profiles)}
                  title="Download Less Than 9 Hours Excel Report"
                >
                  📥 Download Report (.xlsx)
                </button>
              </div>
            </div>

            {underNineHoursAudit.todayShortfallList.length === 0 ? (
              <div className="dw-empty-state" style={{ padding: "30px" }}>
                <p>All active employees logged 9+ hours today!</p>
              </div>
            ) : (
              <div className="dw-defaulter-list">
                {underNineHoursAudit.todayShortfallList.map((emp) => (
                  <div key={emp.cleanDoer} className="dw-defaulter-row">
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "14px" }}>
                        {emp.rawName} <span style={{ fontSize: "11px", fontWeight: "normal", color: "#64748b" }}>({emp.categoryRole})</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "#b91c1c", fontWeight: 700 }}>
                        Logged: {emp.loggedDuration} (Shortfall: {emp.shortfallDuration}) • {emp.status}
                      </div>
                    </div>
                    <button
                      className="dw-btn-add-work"
                      onClick={() => exportLessThanNineHoursReportToExcel(workingLogs, profiles)}
                    >
                      Export Report
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 4: SAME TASK ACROSS DIFFERENT EMPLOYEES */}
          <div className="dw-defaulter-section-card">
            <div className="dw-defaulter-header">
              <h3>
                <span>👥</span> Same Task Logged Across Different Employees
              </h3>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <span className="dw-badge" style={{ background: "#fef3c7", color: "#92400e" }}>
                  {crossEmployeeAudit.kpis.activeWorkClustersCount} Work Clusters ({crossEmployeeAudit.kpis.totalClusters} Total)
                </span>
                <button
                  className="dw-action-btn dw-btn-export"
                  style={{ padding: "4px 10px", fontSize: "12px", background: "#d97706", color: "#fff", borderColor: "#d97706" }}
                  onClick={() => exportCrossEmployeeDuplicatesToExcel(workingLogs, profiles)}
                  title="Download Same Task Across Different Employees Excel Report"
                >
                  📥 Download Report (.xlsx)
                </button>
              </div>
            </div>

            {crossEmployeeAudit.groups.length === 0 ? (
              <div className="dw-empty-state" style={{ padding: "30px" }}>
                <p>No identical tasks logged across multiple employees found.</p>
              </div>
            ) : (
              <div className="dw-defaulter-list">
                {crossEmployeeAudit.groups.slice(0, 15).map((group) => (
                  <div key={group.groupId} className="dw-defaulter-row" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1, paddingRight: "10px" }}>
                      <div style={{ fontWeight: 800, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span>🏢 {group.company || group.groupName || "General Client"}</span>
                        <span className="dw-badge" style={{ background: "#e0f2fe", color: "#0369a1", fontSize: "10px", padding: "2px 6px" }}>
                          {group.distinctCount} Employees
                        </span>
                        {group.isLeaveOrHoliday && (
                          <span className="dw-badge" style={{ background: "#f1f5f9", color: "#64748b", fontSize: "10px", padding: "2px 6px" }}>
                            Leave / Holiday
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--dw-text-main)", fontWeight: 500, margin: "4px 0" }}>
                        📝 {group.representativeTask}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--dw-text-muted)" }}>
                        📍 {group.location || "Office"} • 🏬 {group.department || "General"} • 👥 Staff: <strong style={{ color: "var(--dw-text-main)" }}>{group.employeesListStr}</strong> ({group.totalEntries} entries)
                      </div>
                    </div>
                    <button
                      className="dw-btn-add-work"
                      style={{ whiteSpace: "nowrap" }}
                      onClick={() => exportCrossEmployeeDuplicatesToExcel(workingLogs, profiles)}
                    >
                      Export Report
                    </button>
                  </div>
                ))}
                {crossEmployeeAudit.groups.length > 15 && (
                  <div style={{ textAlign: "center", padding: "10px", fontSize: "12px", color: "var(--dw-text-muted)" }}>
                    Showing top 15 of {crossEmployeeAudit.groups.length} clusters. Click &quot;Download Report (.xlsx)&quot; for full multi-tab register.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DETAIL MODAL DRAWER */}
      {selectedEmp && (
        <div className="dw-modal-overlay" onClick={() => setSelectedEmp(null)}>
          <div className="dw-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* MODAL HEADER */}
            <div className="dw-modal-header">
              <div className="dw-modal-header-left">
                <div
                  className="dw-modal-avatar"
                  style={{
                    background: `linear-gradient(135deg, ${
                      selectedEmp.category?.color || "#3b82f6"
                    } 0%, #0f172a 100%)`,
                  }}
                >
                  {selectedEmp.rawName
                    .split(" ")
                    .map((w) => w[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <h2>{selectedEmp.rawName}</h2>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span className="dw-badge dw-badge-dept">
                      🏢 {selectedEmp.department}
                    </span>
                    {selectedEmp.mobile && (
                      <span className="dw-badge dw-badge-dept">
                        📱 {selectedEmp.mobile}
                      </span>
                    )}
                    <span
                      className="dw-chip"
                      style={{
                        background: selectedEmp.cardPresent ? "#ecfdf5" : "#fef2f2",
                        color: selectedEmp.cardPresent ? "#047857" : "#991b1b",
                        fontSize: "11px",
                        padding: "3px 8px",
                      }}
                    >
                      {selectedEmp.cardPresent
                        ? `Card Present (In: ${formatDisplayTime(selectedEmp.punchIn)})`
                        : "Card Absent Today"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                className="dw-modal-close-btn"
                onClick={() => setSelectedEmp(null)}
              >
                ✕
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="dw-modal-body">
              {/* MISSING DATES SECTION IF ANY */}
              {selectedEmp.missingDates.length > 0 && (
                <div className="dw-missing-dates-section">
                  <h4>
                    <span>⚠️</span> Missing / Unsubmitted Dates ({selectedEmp.missingDates.length})
                  </h4>
                  <div className="dw-dates-chips-group">
                    {selectedEmp.missingDates.map((dateStr, i) => (
                      <span key={i} className="dw-date-chip">
                        {dateStr}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ENTRIES LIST */}
              <div>
                <div className="dw-modal-entries-title">
                  <h3>
                    Submissions History ({selectedEmp.workingEntries.length} Entries)
                  </h3>
                </div>

                <div className="dw-table-wrapper" style={{ marginTop: "12px", maxHeight: "350px" }}>
                  <table className="dw-data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Period</th>
                        <th>Company Name</th>
                        <th>Task Description</th>
                        <th>Time Given</th>
                        <th>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEmp.workingEntries.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: "center", padding: "30px" }}>
                            No work records found for {selectedEmp.rawName}.
                          </td>
                        </tr>
                      ) : (
                        selectedEmp.workingEntries.map((item, idx) => (
                          <tr key={idx}>
                            <td className="mono-cell">{item.formattedDate || item.date}</td>
                            <td>{item.period || "-"}</td>
                            <td style={{ fontWeight: 700 }}>{item.companyName || "-"}</td>
                            <td>{item.taskDescription || "-"}</td>
                            <td className="mono-cell" style={{ fontWeight: 700 }}>
                              {item.timeGiven || "-"}
                            </td>
                            <td>{item.location || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="dw-modal-footer">
              {selectedEmp.dedicatedRoute && (
                <button
                  className="dw-action-btn dw-btn-secondary"
                  onClick={() => {
                    navigate(selectedEmp.dedicatedRoute);
                    setSelectedEmp(null);
                  }}
                >
                  <span>📄</span> Open Dedicated Page
                </button>
              )}

              <button
                className="dw-action-btn"
                style={{ background: "#059669", color: "#ffffff" }}
                onClick={() => {
                  setChatSelectedEmp(selectedEmp.rawName);
                  setSelectedEmp(null);
                }}
              >
                <span>💬</span> Ask AI Analyst
              </button>

              <button
                className="dw-action-btn dw-btn-primary"
                onClick={() => {
                  navigate("/daily-working-form");
                  setSelectedEmp(null);
                }}
              >
                <span>➕</span> Add Work
              </button>
            </div>
          </div>
        </div>
      )}
      {/* API CONFIGURATION & GOOGLE SHEET MODAL */}
      {showApiModal && (
        <div className="dw-modal-overlay" onClick={() => setShowApiModal(false)}>
          <div className="dw-modal-card dw-api-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dw-modal-header">
              <div className="dw-modal-header-left">
                <div className="dw-modal-avatar" style={{ background: "linear-gradient(135deg, #059669 0%, #0f172a 100%)" }}>
                  📊
                </div>
                <div>
                  <h2>Google Sheet & Live API Integration</h2>
                  <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>
                    Configure and connect live Daily Working data from your Google Sheet
                  </p>
                </div>
              </div>
              <button className="dw-modal-close-btn" onClick={() => setShowApiModal(false)}>
                ✕
              </button>
            </div>

            <div className="dw-modal-body" style={{ padding: "24px 30px" }}>
              {/* CONNECTED GOOGLE SHEET INFO BOX */}
              <div className="dw-sheet-info-box">
                <div className="dw-sheet-info-header">
                  <div>
                    <span className="dw-sheet-badge">Connected Google Sheet</span>
                    <h4 style={{ margin: "6px 0 2px 0", fontSize: "15px", color: "var(--dw-text-main)" }}>
                      Daily Working Master Register
                    </h4>
                    <span style={{ fontSize: "12px", color: "var(--dw-text-muted)", fontFamily: "monospace" }}>
                      Sheet ID: {DAILY_WORKING_GOOGLE_SHEET_ID}
                    </span>
                  </div>
                  <a
                    href={DAILY_WORKING_GOOGLE_SHEET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dw-action-btn dw-btn-sheet-link"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    Open Google Sheet ↗
                  </a>
                </div>
              </div>

              {/* LIVE WEB APP URL INPUT */}
              <div style={{ marginTop: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
                  Google Apps Script Web App URL:
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="url"
                    className="dw-select"
                    style={{ flex: 1, padding: "10px 14px", fontSize: "13px", fontFamily: "monospace" }}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={apiInputUrl}
                    onChange={(e) => setApiInputUrl(e.target.value)}
                  />
                  <button
                    className="dw-action-btn"
                    style={{ background: "#4f46e5", color: "#ffffff", whiteSpace: "nowrap" }}
                    disabled={isTestingApi || !apiInputUrl.trim()}
                    onClick={async () => {
                      setIsTestingApi(true);
                      setApiTestResult(null);
                      const res = await testDailyWorkingConnection(apiInputUrl);
                      setIsTestingApi(false);
                      setApiTestResult(res);
                    }}
                  >
                    {isTestingApi ? "Testing..." : "⚡ Test Link"}
                  </button>
                </div>
                <small style={{ display: "block", marginTop: "6px", color: "var(--dw-text-muted)", fontSize: "12px" }}>
                  This URL is deployed from the Apps Script code in your Google Sheet. It feeds live entries into the Dashboard and Chatbot AI.
                </small>
              </div>

              {/* TEST RESULT ALERT */}
              {apiTestResult && (
                <div
                  style={{
                    marginTop: "14px",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    background: apiTestResult.success ? "#ecfdf5" : "#fef2f2",
                    border: `1px solid ${apiTestResult.success ? "#a7f3d0" : "#fecaca"}`,
                    color: apiTestResult.success ? "#065f46" : "#991b1b",
                  }}
                >
                  {apiTestResult.success ? (
                    <div>
                      <strong>✅ Connection Successful!</strong>
                      <div style={{ marginTop: "4px", fontSize: "12px" }}>
                        {apiTestResult.data?.message || `Found ${apiTestResult.data?.data?.length || apiTestResult.data?.totalRows || 0} rows from sheet.`}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <strong>❌ Connection Failed:</strong> {apiTestResult.error}
                      <div style={{ marginTop: "4px", fontSize: "12px" }}>
                        Ensure the Web App is deployed with <strong>Who has access: Anyone</strong> and execute as <strong>Me</strong>.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SETUP STEPS CHEATSHEET */}
              <div style={{ marginTop: "24px", padding: "16px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: 800, color: "#1e293b" }}>
                  📋 Quick 3-Step Deployment Guide:
                </h4>
                <ol style={{ margin: 0, paddingLeft: "20px", fontSize: "12px", color: "#475569", lineHeight: 1.6 }}>
                  <li>Open the Google Sheet & click <strong>Extensions &gt; Apps Script</strong>.</li>
                  <li>Paste the code from <code>GoogleAppsScript_DailyWorking.gs</code> into the editor and save (Ctrl+S).</li>
                  <li>Click <strong>Deploy &gt; New deployment</strong>, select <strong>Web app</strong>, set <em>Who has access</em> to <strong>Anyone</strong>, click <strong>Deploy</strong>, and paste the generated URL above!</li>
                </ol>
              </div>
            </div>

            <div className="dw-modal-footer">
              <button
                className="dw-action-btn dw-btn-secondary"
                onClick={() => {
                  setDailyWorkingWebAppUrl("");
                  setApiInputUrl(getDailyWorkingWebAppUrl());
                  setApiTestResult(null);
                  loadData(true);
                }}
              >
                Reset to Default
              </button>
              <button
                className="dw-action-btn dw-btn-primary"
                onClick={() => {
                  setDailyWorkingWebAppUrl(apiInputUrl.trim());
                  setShowApiModal(false);
                  loadData(true);
                }}
              >
                💾 Save & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Daily Working Chatbot (Aware of Logs, Punch & Defaulters) */}
      <DailyWorkingChatbot
        profiles={profiles}
        workingLogs={workingLogs}
        punchLogs={punchLogs}
        selectedEmployee={chatSelectedEmp}
        onClearSelectedEmployee={() => setChatSelectedEmp(null)}
      />
    </div>
  );
}
