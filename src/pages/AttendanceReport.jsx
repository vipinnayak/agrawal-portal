import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AttendanceChatbot from "../components/AttendanceChatbot";
import {
  EMPLOYEE_MASTER_API,
  DEFAULT_SHIFT_POLICIES,
  getEmployeeCategoryInfo,
  normalizeName,
} from "../utils/attendanceConfig";
import {
  fetchMonthlyAttendance,
  MONTHLY_GOOGLE_SHEET_URL,
  getMonthlyWebAppUrl,
  setMonthlyWebAppUrl,
} from "../utils/monthlyAttendanceService";
import {
  exportAttendanceToExcel,
  exportAttendanceToPDF,
  exportWeeklyAttendanceToExcel,
  exportWeeklyAttendanceToPDF,
  exportMonthlyAttendanceToExcel,
  exportMonthlyAttendanceToPDF,
} from "../utils/exportAttendanceData";
import "./AttendanceReport.css";

const DAILY_API =
  "https://script.google.com/macros/s/AKfycbxp_-pPEH7FwJJu0o9AQHtklmRDfAqJ0SR-gqtJ5LPVsTDovyDtNnIwl1_p57yRSFSPyw/exec";

export default function AttendanceReport() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("daily"); // "daily" | "weekly" | "monthly"
  const [rows, setRows] = useState([]);
  const [isLoadingDaily, setIsLoadingDaily] = useState(true);
  const [dynamicDeptMap, setDynamicDeptMap] = useState(() => new Map());

  // Weekly & Monthly Data State
  const [weeklyData, setWeeklyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(true);
  const [isSheetLive, setIsSheetLive] = useState(false);
  const [sheetSource, setSheetSource] = useState("");
  const [showSheetNotice, setShowSheetNotice] = useState(true);
  const [showUrlConfig, setShowUrlConfig] = useState(false);
  const [customWebAppUrl, setCustomWebAppUrl] = useState(() => getMonthlyWebAppUrl());

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL"); // "ALL" | "MD" | "PARTNER" | "SENIOR" | "PLANT_AUDIT" | "ARTICLE" | "BACK_OFFICE"

  // Dropdown for download button
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedEmployeeForChat, setSelectedEmployeeForChat] = useState(null);

  // Fetch Employee Master
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
      .catch((err) => {
        console.warn("Could not fetch EmployeeMaster:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Daily Attendance
  useEffect(() => {
    setIsLoadingDaily(true);
    fetch(DAILY_API)
      .then((res) => res.json())
      .then((data) => {
        const validData = Array.isArray(data)
          ? data.filter((item) => item && item.Employee && item.Employee.trim() !== "")
          : [];
        setRows(validData);
      })
      .catch((err) => {
        console.error("Failed to load daily attendance:", err);
      })
      .finally(() => {
        setIsLoadingDaily(false);
      });
  }, []);

  // Fetch Monthly & Weekly Attendance (from Google Sheet service)
  const loadMonthlyAttendance = (force = false) => {
    setIsLoadingMonthly(true);
    fetchMonthlyAttendance({
      dailyRows: rows,
      dynamicDeptMap,
      shiftPolicies: DEFAULT_SHIFT_POLICIES,
      forceRefresh: force === true,
    })
      .then((res) => {
        setMonthlyData(res);
        setWeeklyData({
          list: res.weeklySummaries,
          weekRange: res.weeklyRange,
          weeklyLogs: res.weeklyLogs,
        });
        setIsSheetLive(res.isLive);
        setSheetSource(res.source || "");
      })
      .catch((err) => {
        console.error("Error loading monthly attendance:", err);
      })
      .finally(() => {
        setIsLoadingMonthly(false);
      });
  };

  const handleSaveWebAppUrl = () => {
    setMonthlyWebAppUrl(customWebAppUrl);
    setShowUrlConfig(false);
    loadMonthlyAttendance(true);
  };

  useEffect(() => {
    loadMonthlyAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, dynamicDeptMap.size]);

  // Format Time helper
  const formatTime = (time) => {
    if (!time) return "";
    if (typeof time === "string") {
      if (/^\d{2}:\d{2}$/.test(time)) return time;
      if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time.substring(0, 5);
      const d = new Date(time);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      }
    }
    return "";
  };

  // Enriched daily rows with department category info
  const enrichedDailyRows = useMemo(() => {
    return rows.map((r, idx) => {
      const rawName = (r.Employee || "").trim();
      const cat = getEmployeeCategoryInfo(rawName, r, dynamicDeptMap, DEFAULT_SHIFT_POLICIES);
      const isTodaySunday = new Date().getDay() === 0;
      const inTime = r.In ? r.In.trim() : "";
      const isPresent = !!inTime;
      // Sundays are weekly off, NOT absent!
      const isAbsent = !isPresent && !isTodaySunday;

      // Status check
      let status = "On Time";
      if (!isPresent) {
        status = isTodaySunday ? "Weekly Off" : "Absent";
      } else {
        const match = inTime.match(/^(\d{1,2}):(\d{2})/);
        if (match) {
          const inMins = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
          const graceParts = (cat.grace || "10:05").split(":");
          const graceMins = parseInt(graceParts[0], 10) * 60 + parseInt(graceParts[1], 10);
          const cutParts = (cat.cutoff || "10:00").split(":");
          const cutMins = parseInt(cutParts[0], 10) * 60 + parseInt(cutParts[1], 10);

          if (isTodaySunday) status = "Present (Sunday)";
          else if (inMins > graceMins) status = "Late";
          else if (inMins > cutMins) status = "Within Grace";
          else status = "Early Login";
        }
      }

      return {
        ...r,
        srNo: idx + 1,
        employeeName: rawName,
        categoryKey: cat.categoryKey || cat.key || "BACK_OFFICE",
        categoryLabel: cat.label,
        categoryShort: cat.shortLabel,
        categoryIcon: cat.icon,
        categoryColor: cat.color,
        cutoff: cat.cutoff,
        grace: cat.grace,
        inFormatted: formatTime(r.In),
        outFormatted: formatTime(r.Out),
        status,
        isPresent,
        isAbsent,
      };
    });
  }, [rows, dynamicDeptMap]);

  // Filtered rows for current tab
  const filteredDailyRows = useMemo(() => {
    return enrichedDailyRows.filter((r) => {
      const matchesSearch =
        searchQuery === "" ||
        r.employeeName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept =
        selectedDept === "ALL" || r.categoryKey === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [enrichedDailyRows, searchQuery, selectedDept]);

  const filteredWeeklyRows = useMemo(() => {
    if (!weeklyData || !weeklyData.list) return [];
    return weeklyData.list.filter((r) => {
      const matchesSearch =
        searchQuery === "" ||
        r.employee.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept =
        selectedDept === "ALL" || r.categoryKey === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [weeklyData, searchQuery, selectedDept]);

  const filteredMonthlyRows = useMemo(() => {
    if (!monthlyData || !monthlyData.monthlySummaries) return [];
    return monthlyData.monthlySummaries.filter((r) => {
      const matchesSearch =
        searchQuery === "" ||
        r.employee.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept =
        selectedDept === "ALL" || r.categoryKey === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [monthlyData, searchQuery, selectedDept]);

  // Compute KPI summaries for current tab
  const dailyKPIs = useMemo(() => {
    const isTodaySunday = new Date().getDay() === 0;
    const total = enrichedDailyRows.length;
    const present = enrichedDailyRows.filter((r) => r.isPresent).length;
    // Sundays are OFF, NOT absent!
    const absent = isTodaySunday ? 0 : enrichedDailyRows.filter((r) => r.isAbsent).length;
    const late = enrichedDailyRows.filter((r) => r.status === "Late").length;
    const early = enrichedDailyRows.filter((r) => r.status === "Early Login").length;
    return { total, present, absent, late, early, isTodaySunday };
  }, [enrichedDailyRows]);

  const weeklyKPIs = useMemo(() => {
    if (!weeklyData || !weeklyData.list || weeklyData.list.length === 0) {
      return { total: 0, avgPct: 0, totalLate: 0, totalAbsent: 0 };
    }
    const total = weeklyData.list.length;
    const avgPct = Math.round(
      weeklyData.list.reduce((acc, c) => acc + (c.attendancePct || 0), 0) / (total || 1)
    );
    const totalLate = weeklyData.list.reduce((acc, c) => acc + (c.lateDays || 0), 0);
    const totalAbsent = weeklyData.list.reduce((acc, c) => acc + (c.daysAbsent || 0), 0);
    return { total, avgPct, totalLate, totalAbsent };
  }, [weeklyData]);

  const monthlyKPIs = useMemo(() => {
    if (!monthlyData || !monthlyData.monthlySummaries || monthlyData.monthlySummaries.length === 0) {
      return { total: 0, workingDays: 27, avgPct: 0, totalLate: 0, totalAbsent: 0 };
    }
    const total = monthlyData.monthlySummaries.length;
    const workingDays = monthlyData.workingDaysCount || 27;
    const avgPct = Math.round(
      monthlyData.monthlySummaries.reduce((acc, c) => acc + (c.attendancePct || 0), 0) / (total || 1)
    );
    const totalLate = monthlyData.monthlySummaries.reduce((acc, c) => acc + (c.lateDays || 0), 0);
    const totalAbsent = monthlyData.monthlySummaries.reduce((acc, c) => acc + (c.daysAbsent || 0), 0);
    return { total, workingDays, avgPct, totalLate, totalAbsent };
  }, [monthlyData]);

  // Export handlers for current active tab
  const handleExportActiveExcel = async () => {
    setIsExporting(true);
    setShowDownloadMenu(false);
    try {
      if (activeTab === "daily") {
        await exportAttendanceToExcel({
          attendanceMetrics: {
            total: enrichedDailyRows.length,
            present: enrichedDailyRows.filter((r) => r.isPresent),
            absent: enrichedDailyRows.filter((r) => r.isAbsent),
            allEarly: enrichedDailyRows.filter((r) => r.status === "Early Login"),
            allLate: enrichedDailyRows.filter((r) => r.status === "Late"),
            allWithinGrace: enrichedDailyRows.filter((r) => r.status === "Within Grace"),
            evaluated: enrichedDailyRows.map((r) => ({
              name: r.employeeName,
              categoryLabel: r.categoryLabel,
              customNote: "",
              cutoff: r.cutoff,
              grace: r.grace,
              inTime: r.In,
              outTime: r.Out,
              isPresent: r.isPresent,
              isAbsent: r.isAbsent,
              isEarly: r.status === "Early Login",
              isWithinGrace: r.status === "Within Grace",
              isLate: r.status === "Late",
              earlyDuration: "Early",
              lateDuration: "Late",
              formattedWorkingHours: "Active",
              clientPlace: r.ClientPlace || "Office",
            })),
          },
          shiftPolicies: DEFAULT_SHIFT_POLICIES,
          messages: [],
        });
      } else if (activeTab === "weekly") {
        await exportWeeklyAttendanceToExcel({
          weeklyData,
          shiftPolicies: DEFAULT_SHIFT_POLICIES,
          messages: [],
        });
      } else if (activeTab === "monthly") {
        await exportMonthlyAttendanceToExcel({
          monthlyData,
          shiftPolicies: DEFAULT_SHIFT_POLICIES,
          messages: [],
        });
      }
    } catch (err) {
      console.error("Export Excel error:", err);
      alert("Failed to export Excel report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportActivePDF = () => {
    setIsExporting(true);
    setShowDownloadMenu(false);
    try {
      if (activeTab === "daily") {
        exportAttendanceToPDF({
          attendanceMetrics: {
            total: enrichedDailyRows.length,
            present: enrichedDailyRows.filter((r) => r.isPresent),
            absent: enrichedDailyRows.filter((r) => r.isAbsent),
            allEarly: enrichedDailyRows.filter((r) => r.status === "Early Login"),
            allLate: enrichedDailyRows.filter((r) => r.status === "Late"),
            allWithinGrace: enrichedDailyRows.filter((r) => r.status === "Within Grace"),
            evaluated: enrichedDailyRows.map((r) => ({
              name: r.employeeName,
              categoryLabel: r.categoryLabel,
              customNote: "",
              cutoff: r.cutoff,
              grace: r.grace,
              inTime: r.In,
              outTime: r.Out,
              isPresent: r.isPresent,
              isAbsent: r.isAbsent,
              isEarly: r.status === "Early Login",
              isWithinGrace: r.status === "Within Grace",
              isLate: r.status === "Late",
              earlyDuration: "Early",
              lateDuration: "Late",
              formattedWorkingHours: "Active",
              clientPlace: r.ClientPlace || "Office",
            })),
          },
          shiftPolicies: DEFAULT_SHIFT_POLICIES,
        });
      } else if (activeTab === "weekly") {
        exportWeeklyAttendanceToPDF({
          weeklyData,
          shiftPolicies: DEFAULT_SHIFT_POLICIES,
        });
      } else if (activeTab === "monthly") {
        exportMonthlyAttendanceToPDF({
          monthlyData,
          shiftPolicies: DEFAULT_SHIFT_POLICIES,
        });
      }
    } catch (err) {
      console.error("Export PDF error:", err);
      alert("Failed to export PDF report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const currentTabLabel =
    activeTab === "daily" ? "Daily" : activeTab === "weekly" ? "Weekly" : "Monthly";

  return (
    <div className="attendance-report-page">
      {/* Page Header */}
      <div className="report-header">
        <div>
          <div className="report-title-badge">Agrawal Jain &amp; Co. ERP</div>
          <h1>Attendance Report &amp; Analytics</h1>
          <p>Multi-period real-time attendance tracking with category shifts &amp; Google Sheet sync</p>
        </div>

        {/* Header Action Buttons */}
        <div className="header-actions">
          <button
            className="daily-working-link-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
              color: "#ffffff",
              border: "none",
              fontWeight: 700,
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(5, 150, 105, 0.3)",
            }}
            onClick={() => navigate("/daily-working")}
          >
            <span>💼</span> Daily Working Dashboard
          </button>

          <div className="download-dropdown-wrapper">
            <button
              className="download-btn"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              disabled={isExporting}
            >
              📥 Download {currentTabLabel} Report ▾
            </button>
            {showDownloadMenu && (
              <div className="header-download-dropdown">
                <div className="dropdown-title">Download {currentTabLabel}</div>
                <button
                  className="dropdown-item excel"
                  onClick={handleExportActiveExcel}
                  disabled={isExporting}
                >
                  <span className="dropdown-icon">📊</span>
                  <div>
                    <strong>Excel Format (.xlsx)</strong>
                    <small>Full {currentTabLabel.toLowerCase()} workbook with metrics</small>
                  </div>
                </button>
                <button
                  className="dropdown-item pdf"
                  onClick={handleExportActivePDF}
                  disabled={isExporting}
                >
                  <span className="dropdown-icon">📄</span>
                  <div>
                    <strong>PDF Document (.pdf)</strong>
                    <small>Landscape executive table</small>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Google Sheet Sync Notice Banner */}
      {showSheetNotice && (
        <div className={`sheet-sync-banner ${isSheetLive ? "live" : "notice"}`}>
          <div className="sheet-sync-content">
            <span className="sheet-sync-icon">{isSheetLive ? "🟢" : "🔗"}</span>
            <div>
              <strong>
                {isSheetLive
                  ? `Live Google Sheet Connection Active (${sheetSource || "Web App"})`
                  : "Google Sheet Backend (Monthly & Weekly Mode)"}
              </strong>
              <p>
                Source:{" "}
                <a
                  href={MONTHLY_GOOGLE_SHEET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sheet-link"
                >
                  Sheet ID: <code>16L5BoFAveSFJvwpgRnvYn8RH9CfLYQq_0sVeWIcNcyk</code> ↗
                </a>
                {customWebAppUrl ? (
                  <span>
                    {" "}• Apps Script: <code>{customWebAppUrl.length > 40 ? customWebAppUrl.substring(0, 40) + "..." : customWebAppUrl}</code>
                  </span>
                ) : (
                  <span>
                    {" "}• <i>Tip: Paste Google Apps Script Web App URL to pull real-time data directly from your sheet.</i>
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="sheet-sync-actions">
            <button
              className="sync-config-btn"
              onClick={() => setShowUrlConfig((prev) => !prev)}
              title="Configure Google Apps Script Web App URL"
            >
              {customWebAppUrl ? "⚙️ Apps Script" : "⚡ Connect Web App"}
            </button>
            <button className="sync-refresh-btn" onClick={() => loadMonthlyAttendance(true)} title="Re-sync Google Sheet">
              🔄 Sync
            </button>
            <button
              className="sync-dismiss-btn"
              onClick={() => setShowSheetNotice(false)}
              title="Dismiss Notice"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Inline Web App URL Configuration Box */}
      {showUrlConfig && (
        <div className="sheet-url-config-box">
          <div className="url-config-header">
            <h4>⚡ Connect Google Apps Script Web App</h4>
            <span className="url-config-help">
              Paste the deployed Web App URL from your Google Sheet (<code>https://script.google.com/macros/s/.../exec</code>)
            </span>
          </div>
          <div className="url-config-input-group">
            <input
              type="url"
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              value={customWebAppUrl}
              onChange={(e) => setCustomWebAppUrl(e.target.value)}
              className="url-config-input"
            />
            <button className="url-save-btn" onClick={handleSaveWebAppUrl}>
              Connect & Sync
            </button>
            {customWebAppUrl && (
              <button
                className="url-clear-btn"
                onClick={() => {
                  setCustomWebAppUrl("");
                  setMonthlyWebAppUrl("");
                  setShowUrlConfig(false);
                  loadMonthlyAttendance();
                }}
              >
                Clear
              </button>
            )}
            <button className="url-cancel-btn" onClick={() => setShowUrlConfig(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Modern Navigation Tabs (Daily Default, Weekly, Monthly) */}
      <div className="attendance-nav-tabs">
        <button
          className={`nav-tab-btn ${activeTab === "daily" ? "active" : ""}`}
          onClick={() => setActiveTab("daily")}
        >
          <span className="tab-icon">📅</span>
          <span className="tab-text">Daily Attendance</span>
          <span className="tab-pill-badge">{enrichedDailyRows.length} Today</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === "weekly" ? "active" : ""}`}
          onClick={() => setActiveTab("weekly")}
        >
          <span className="tab-icon">🗓️</span>
          <span className="tab-text">Weekly Attendance</span>
          <span className="tab-pill-badge">Mon - Sat (6 Days)</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === "monthly" ? "active" : ""}`}
          onClick={() => setActiveTab("monthly")}
        >
          <span className="tab-icon">📊</span>
          <span className="tab-text">Monthly Attendance</span>
          <span className="tab-pill-badge">
            {new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" })} • 27 Days
          </span>
        </button>
      </div>

      {/* KPI Cards Strip for Active Tab */}
      <div className="kpi-cards-grid">
        {activeTab === "daily" && (
          <>
            <div className="kpi-card blue">
              <span className="kpi-icon">👥</span>
              <div className="kpi-info">
                <h4>TOTAL REGISTERED</h4>
                <h2>{dailyKPIs.total}</h2>
                <small>Staff evaluated today</small>
              </div>
            </div>
            <div className="kpi-card green">
              <span className="kpi-icon">✅</span>
              <div className="kpi-info">
                <h4>PRESENT TODAY</h4>
                <h2>{dailyKPIs.present}</h2>
                <small>
                  {dailyKPIs.total > 0
                    ? Math.round((dailyKPIs.present / dailyKPIs.total) * 100)
                    : 0}
                  % turn-out
                </small>
              </div>
            </div>
            <div className="kpi-card cyan">
              <span className="kpi-icon">🌅</span>
              <div className="kpi-info">
                <h4>EARLY LOGINS</h4>
                <h2>{dailyKPIs.early}</h2>
                <small>Punched before cut-off</small>
              </div>
            </div>
            <div className="kpi-card orange">
              <span className="kpi-icon">⏰</span>
              <div className="kpi-info">
                <h4>LATE ARRIVALS</h4>
                <h2>{dailyKPIs.late}</h2>
                <small>Arrived after grace</small>
              </div>
            </div>
            <div className="kpi-card red">
              <span className="kpi-icon">❌</span>
              <div className="kpi-info">
                <h4>ABSENT TODAY</h4>
                <h2>{dailyKPIs.absent}</h2>
                <small>Not punched in</small>
              </div>
            </div>
          </>
        )}

        {activeTab === "weekly" && (
          <>
            <div className="kpi-card blue">
              <span className="kpi-icon">👥</span>
              <div className="kpi-info">
                <h4>ACTIVE EMPLOYEES</h4>
                <h2>{weeklyKPIs.total}</h2>
                <small>This week ({weeklyData?.weekRange || "Mon - Sat (6 Days)"})</small>
              </div>
            </div>
            <div className="kpi-card green">
              <span className="kpi-icon">📈</span>
              <div className="kpi-info">
                <h4>WEEKLY ATTENDANCE</h4>
                <h2>{weeklyKPIs.avgPct}%</h2>
                <small>Firm average rate</small>
              </div>
            </div>
            <div className="kpi-card orange">
              <span className="kpi-icon">⏰</span>
              <div className="kpi-info">
                <h4>LATE OCCURRENCES</h4>
                <h2>{weeklyKPIs.totalLate}</h2>
                <small>Across all categories</small>
              </div>
            </div>
            <div className="kpi-card red">
              <span className="kpi-icon">❌</span>
              <div className="kpi-info">
                <h4>TOTAL ABSENT DAYS</h4>
                <h2>{weeklyKPIs.totalAbsent}</h2>
                <small>This week (Mon - Sat)</small>
              </div>
            </div>
          </>
        )}

        {activeTab === "monthly" && (
          <>
            <div className="kpi-card blue">
              <span className="kpi-icon">👥</span>
              <div className="kpi-info">
                <h4>TOTAL STAFF</h4>
                <h2>{monthlyKPIs.total}</h2>
                <small>In monthly register</small>
              </div>
            </div>
            <div className="kpi-card cyan">
              <span className="kpi-icon">🗓️</span>
              <div className="kpi-info">
                <h4>WORKING DAYS</h4>
                <h2>{monthlyKPIs.workingDays}</h2>
                <small>Elapsed Working Days (out of 27 Total)</small>
              </div>
            </div>
            <div className="kpi-card green">
              <span className="kpi-icon">📈</span>
              <div className="kpi-info">
                <h4>MONTHLY ATTENDANCE</h4>
                <h2>{monthlyKPIs.avgPct}%</h2>
                <small>Overall compliance</small>
              </div>
            </div>
            <div className="kpi-card orange">
              <span className="kpi-icon">⏰</span>
              <div className="kpi-info">
                <h4>TOTAL LATE LOGS</h4>
                <h2>{monthlyKPIs.totalLate}</h2>
                <small>Recorded this month</small>
              </div>
            </div>
            <div className="kpi-card red">
              <span className="kpi-icon">❌</span>
              <div className="kpi-info">
                <h4>TOTAL ABSENT DAYS</h4>
                <h2>{monthlyKPIs.totalAbsent}</h2>
                <small>Recorded this month</small>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="filters-control-bar">
        <div className="search-box-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search employee by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="dept-filter-pills">
          <button
            className={`dept-pill ${selectedDept === "ALL" ? "active" : ""}`}
            onClick={() => setSelectedDept("ALL")}
          >
            All Departments
          </button>
          <button
            className={`dept-pill md ${selectedDept === "MD" ? "active" : ""}`}
            onClick={() => setSelectedDept("MD")}
          >
            👑 MD
          </button>
          <button
            className={`dept-pill partner ${selectedDept === "PARTNER" ? "active" : ""}`}
            onClick={() => setSelectedDept("PARTNER")}
          >
            🤝 Partners
          </button>
          <button
            className={`dept-pill senior ${selectedDept === "SENIOR" ? "active" : ""}`}
            onClick={() => setSelectedDept("SENIOR")}
          >
            👔 Seniors
          </button>
          <button
            className={`dept-pill plant ${selectedDept === "PLANT_AUDIT" ? "active" : ""}`}
            onClick={() => setSelectedDept("PLANT_AUDIT")}
          >
            🏭 Plant Audit
          </button>
          <button
            className={`dept-pill article ${selectedDept === "ARTICLE" ? "active" : ""}`}
            onClick={() => setSelectedDept("ARTICLE")}
          >
            📚 Articles
          </button>
          <button
            className={`dept-pill office ${selectedDept === "BACK_OFFICE" ? "active" : ""}`}
            onClick={() => setSelectedDept("BACK_OFFICE")}
          >
            🏢 Back Office
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="table-container">
        {/* TAB 1: DAILY ATTENDANCE */}
        {activeTab === "daily" && (
          <table>
            <thead>
              <tr>
                <th style={{ width: "60px", textAlign: "center" }}>SR.NO</th>
                <th>Employee Name</th>
                <th>Category / Shift</th>
                <th style={{ textAlign: "center" }}>Cut-off</th>
                <th style={{ textAlign: "center" }}>IN Time</th>
                <th style={{ textAlign: "center" }}>OUT Time</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th>Work Location / Site</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingDaily ? (
                <tr>
                  <td colSpan="8" className="loading-state">
                    <span className="spinner"></span> Loading real-time daily attendance...
                  </td>
                </tr>
              ) : filteredDailyRows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    No matching attendance records found.
                  </td>
                </tr>
              ) : (
                filteredDailyRows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: "center" }}>{row.srNo}</td>
                    <td
                      className="emp-name-cell clickable"
                      onClick={() => setSelectedEmployeeForChat(row.employeeName)}
                      title="Click to view individual attendance report in AI Chatbot"
                    >
                      <strong>{row.employeeName}</strong>
                    </td>
                    <td>
                      <span className={`cat-badge ${row.categoryKey.toLowerCase()}`}>
                        {row.categoryIcon} {row.categoryShort}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="time-badge cutoff">{row.cutoff}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {row.inFormatted ? (
                        <span className="time-badge in">{row.inFormatted}</span>
                      ) : (
                        <span className="dash-text">-</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {row.outFormatted ? (
                        <span className="time-badge out">{row.outFormatted}</span>
                      ) : row.isPresent ? (
                        <span className="active-tag">Active</span>
                      ) : (
                        <span className="dash-text">-</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`status-pill ${row.status.toLowerCase().replace(/\s+/g, "-")}`}>
                        {row.status === "Early Login" && "🌅 "}
                        {row.status === "Late" && "⏰ "}
                        {row.status === "Absent" && "❌ "}
                        {row.status === "Within Grace" && "🟡 "}
                        {row.status === "On Time" && "✅ "}
                        {row.status}
                      </span>
                    </td>
                    <td>
                      {row.ClientPlace && row.ClientPlace.toLowerCase() !== "office" ? (
                        <span className="site-badge client">🏢 Client ({row.ClientPlace})</span>
                      ) : (
                        <span className="site-badge office">🏢 AJC Office</span>
                      )}
                      {row.Location && <small className="loc-sub"> • {row.Location}</small>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* TAB 2: WEEKLY ATTENDANCE */}
        {activeTab === "weekly" && (
          <table>
            <thead>
              <tr>
                <th style={{ width: "60px", textAlign: "center" }}>SR.NO</th>
                <th>Employee Name</th>
                <th>Category</th>
                <th style={{ textAlign: "center" }}>Days Present</th>
                <th style={{ textAlign: "center" }}>Late Days</th>
                <th style={{ textAlign: "center" }}>Absent (Mon-Sat)</th>
                <th style={{ textAlign: "center" }}>Half Days</th>
                <th style={{ textAlign: "center" }}>Total Weekly Hours</th>
                <th style={{ textAlign: "center" }}>Avg Daily Hours</th>
                <th style={{ textAlign: "center", minWidth: "160px" }}>Attendance Rate</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingMonthly ? (
                <tr>
                  <td colSpan="10" className="loading-state">
                    <span className="spinner"></span> Loading weekly attendance analysis...
                  </td>
                </tr>
              ) : filteredWeeklyRows.length === 0 ? (
                <tr>
                  <td colSpan="10" className="empty-state">
                    No weekly records found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredWeeklyRows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: "center" }}>{idx + 1}</td>
                    <td
                      className="emp-name-cell clickable"
                      onClick={() => setSelectedEmployeeForChat(row.employee)}
                      title="Click to view individual attendance report in AI Chatbot"
                    >
                      <strong>{row.employee}</strong>
                    </td>
                    <td>
                      <span className={`cat-badge ${(row.categoryKey || "office").toLowerCase()}`}>
                        {row.categoryIcon || "🏢"} {row.categoryShort || "Staff"}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="badge-count green">{row.daysPresent}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {row.lateDays > 0 ? (
                        <span className="badge-count orange">{row.lateDays}</span>
                      ) : (
                        <span className="dash-text">0</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {row.daysAbsent > 0 ? (
                        <span className="badge-count red">{row.daysAbsent}</span>
                      ) : (
                        <span className="dash-text">0</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {row.halfDays > 0 ? (
                        <span className="badge-count yellow">{row.halfDays}</span>
                      ) : (
                        <span className="dash-text">0</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <strong>{row.totalWorkingHours}</strong>
                    </td>
                    <td style={{ textAlign: "center" }}>{row.avgWorkingHours}</td>
                    <td>
                      <div className="attendance-pct-cell">
                        <div className="pct-bar-wrapper">
                          <div
                            className={`pct-bar-fill ${
                              row.attendancePct >= 90
                                ? "high"
                                : row.attendancePct >= 75
                                ? "medium"
                                : "low"
                            }`}
                            style={{ width: `${row.attendancePct}%` }}
                          />
                        </div>
                        <span className="pct-text">{row.attendancePct}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* TAB 3: MONTHLY ATTENDANCE */}
        {activeTab === "monthly" && (
          <table>
            <thead>
              <tr>
                <th style={{ width: "60px", textAlign: "center" }}>SR.NO</th>
                <th>Employee Name</th>
                <th>Category</th>
                <th style={{ textAlign: "center" }}>Working Days (Excl. Sun)</th>
                <th style={{ textAlign: "center" }}>Present</th>
                <th style={{ textAlign: "center" }}>Absent (Excl. Sun)</th>
                <th style={{ textAlign: "center" }}>Late Days</th>
                <th style={{ textAlign: "center" }}>Half Days</th>
                <th style={{ textAlign: "center" }}>Total Worked Hours</th>
                <th style={{ textAlign: "center" }}>Avg Daily Hours</th>
                <th style={{ textAlign: "center", minWidth: "160px" }}>Monthly Compliance</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingMonthly ? (
                <tr>
                  <td colSpan="11" className="loading-state">
                    <span className="spinner"></span> Loading monthly attendance register from Google Sheet...
                  </td>
                </tr>
              ) : filteredMonthlyRows.length === 0 ? (
                <tr>
                  <td colSpan="11" className="empty-state">
                    No monthly records found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredMonthlyRows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: "center" }}>{idx + 1}</td>
                    <td
                      className="emp-name-cell clickable"
                      onClick={() => setSelectedEmployeeForChat(row.employee)}
                      title="Click to view individual attendance report in AI Chatbot"
                    >
                      <strong>{row.employee}</strong>
                    </td>
                    <td>
                      <span className={`cat-badge ${(row.categoryKey || "office").toLowerCase()}`}>
                        {row.categoryIcon || "🏢"} {row.categoryShort || "Staff"}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="badge-count neutral">{row.totalDays}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="badge-count green">{row.daysPresent}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {row.daysAbsent > 0 ? (
                        <span className="badge-count red">{row.daysAbsent}</span>
                      ) : (
                        <span className="dash-text">0</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {row.lateDays > 0 ? (
                        <span className="badge-count orange">{row.lateDays}</span>
                      ) : (
                        <span className="dash-text">0</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {row.halfDays > 0 ? (
                        <span className="badge-count yellow">{row.halfDays}</span>
                      ) : (
                        <span className="dash-text">0</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <strong>{row.totalWorkingHours}</strong>
                    </td>
                    <td style={{ textAlign: "center" }}>{row.avgWorkingHours}</td>
                    <td>
                      <div className="attendance-pct-cell">
                        <div className="pct-bar-wrapper">
                          <div
                            className={`pct-bar-fill ${
                              row.attendancePct >= 90
                                ? "high"
                                : row.attendancePct >= 75
                                ? "medium"
                                : "low"
                            }`}
                            style={{ width: `${row.attendancePct}%` }}
                          />
                        </div>
                        <span className="pct-text">{row.attendancePct}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* AI Attendance Chatbot (Aware of Daily, Weekly & Monthly) */}
      <AttendanceChatbot
        rows={rows}
        weeklyData={weeklyData}
        monthlyData={monthlyData}
        activeTab={activeTab}
        selectedEmployee={selectedEmployeeForChat}
        onClearSelectedEmployee={() => setSelectedEmployeeForChat(null)}
      />
    </div>
  );
}