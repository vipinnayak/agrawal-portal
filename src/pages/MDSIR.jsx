// src/pages/MDSIR.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchDailyWorkingLogs,
  DAILY_WORKING_GOOGLE_SHEET_ID,
  DAILY_WORKING_GOOGLE_SHEET_URL,
  getDailyWorkingWebAppUrl,
  setDailyWorkingWebAppUrl,
  testDailyWorkingConnection,
  getDailyWorkingSourceStatus,
  formatExcelOrStringDate,
  getDedicatedDailyWorkingRoute,
  getMonthYearInfo,
  getAllAvailableMonths,
} from "../utils/dailyWorkingService";
import {
  isPartnerSeniorOrArticle,
  getEmployeeCategoryInfo,
  PARTNERS_LIST,
  SENIORS_LIST,
  ARTICLES_LIST,
} from "../utils/attendanceConfig";

export default function MDSIR() {
  const navigate = useNavigate();

  // Daily Working Live Data (Filtered strictly for Partners, Seniors & Articles)
  const [workingLogs, setWorkingLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [refreshingLogs, setRefreshingLogs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL"); // ALL | PARTNER | SENIOR | ARTICLE
  const [selectedDoer, setSelectedDoer] = useState("ALL");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedMonth, setSelectedMonth] = useState("ALL");
  const [sourceStatus, setSourceStatus] = useState(() => getDailyWorkingSourceStatus());
  const [activeViewMode, setActiveViewMode] = useState("cards"); // "cards" | "table"

  // Apps Script & API Modal
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiInputUrl, setApiInputUrl] = useState(() => getDailyWorkingWebAppUrl());
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState(null);

  // Load Daily Working logs strictly filtered to Partners, Seniors & Articles from attendanceConfig.js
  const loadDailyWorking = async (isRefresh = false) => {
    if (isRefresh) setRefreshingLogs(true);
    else setLoadingLogs(true);

    try {
      const allLogs = await fetchDailyWorkingLogs(isRefresh);
      // Strictly filter to Partners, Seniors, and Articles accurate data from attendanceConfig.js
      const psaLogs = (allLogs || [])
        .filter((item) => {
          const name = item.doerName || item.employeeName || "";
          return isPartnerSeniorOrArticle(name, item);
        })
        .map((item) => {
          const name = item.doerName || item.employeeName || "";
          const catInfo = getEmployeeCategoryInfo(name, item);
          const roleKey = catInfo.categoryKey || catInfo.key;
          const isPart = roleKey === "PARTNER";
          const isSen = roleKey === "SENIOR";
          const isArt = roleKey === "ARTICLE";
          const roleLabel = isPart ? "Partner" : isSen ? "Senior" : "Article";
          const roleIcon = isPart ? "🤝" : isSen ? "👔" : "📚";
          const roleColor = isPart ? "#7c3aed" : isSen ? "#0f766e" : "#0284c7";
          return {
            ...item,
            isPartner: isPart,
            isSenior: isSen,
            isArticle: isArt,
            categoryRole: roleLabel,
            roleIcon,
            roleColor,
            roleBadgeClass: isPart ? "badge-partner" : isSen ? "badge-senior" : "badge-article",
          };
        });

      setWorkingLogs(psaLogs);
      setSourceStatus(getDailyWorkingSourceStatus());
    } catch (err) {
      console.error("Error loading daily working in MDSIR:", err);
    } finally {
      setLoadingLogs(false);
      setRefreshingLogs(false);
    }
  };

  useEffect(() => {
    loadDailyWorking();
  }, []);
 
  const handleLogout = () => {
    localStorage.clear();
    navigate("/", { replace: true });
  };

  // Unique partners, seniors & articles in the logs with profile data for cards
  const activeStaffMembers = useMemo(() => {
    const map = new Map();
    workingLogs.forEach((l) => {
      const name = l.doerName || l.employeeName;
      if (name && name.trim()) {
        const cleanName = name.trim();
        if (!map.has(cleanName)) {
          map.set(cleanName, {
            name: cleanName,
            isPartner: l.isPartner,
            isSenior: l.isSenior,
            isArticle: l.isArticle,
            role: l.categoryRole,
            roleIcon: l.roleIcon,
            roleColor: l.roleColor,
            department: l.department || "General",
            count: 1,
            latestTask: l.taskDescription || "",
            latestCompany: l.companyName || l.groupName || "",
            latestDate: l.date || "",
            latestTimeGiven: l.timeGiven || "",
            dedicatedRoute: getDedicatedDailyWorkingRoute(cleanName),
          });
        } else {
          const existing = map.get(cleanName);
          existing.count += 1;
          if (!existing.latestDate && l.date) {
            existing.latestDate = l.date;
          }
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [workingLogs]);

  // Partners, Seniors & Articles log counts
  const partnerLogsCount = useMemo(() => {
    return workingLogs.filter((l) => l.isPartner).length;
  }, [workingLogs]);

  const seniorLogsCount = useMemo(() => {
    return workingLogs.filter((l) => l.isSenior).length;
  }, [workingLogs]);

  const articleLogsCount = useMemo(() => {
    return workingLogs.filter((l) => l.isArticle).length;
  }, [workingLogs]);

  const activePartnersCount = useMemo(() => {
    return activeStaffMembers.filter((s) => s.isPartner).length;
  }, [activeStaffMembers]);

  const activeSeniorsCount = useMemo(() => {
    return activeStaffMembers.filter((s) => s.isSenior).length;
  }, [activeStaffMembers]);

  const activeArticlesCount = useMemo(() => {
    return activeStaffMembers.filter((s) => s.isArticle).length;
  }, [activeStaffMembers]);

  // Unique departments among Partners, Seniors & Articles
  const departments = useMemo(() => {
    const set = new Set();
    workingLogs.forEach((l) => {
      if (l.department && l.department.trim()) set.add(l.department.trim());
    });
    return Array.from(set).sort();
  }, [workingLogs]);

  // Unique client companies serviced by Partners, Seniors & Articles
  const companyCount = useMemo(() => {
    const set = new Set();
    workingLogs.forEach((l) => {
      if (l.companyName && l.companyName.trim()) set.add(l.companyName.trim());
    });
    return set.size;
  }, [workingLogs]);

  // Available months across daily working logs
  const availableMonths = useMemo(() => {
    return getAllAvailableMonths(workingLogs);
  }, [workingLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return workingLogs.filter((item) => {
      // Month filter
      if (selectedMonth !== "ALL") {
        const my = getMonthYearInfo(item.date || item.timestamp);
        if (!my || my.key !== selectedMonth) return false;
      }

      // Role filter (Partner, Senior, Article)
      if (selectedRole === "PARTNER" && !item.isPartner) return false;
      if (selectedRole === "SENIOR" && !item.isSenior) return false;
      if (selectedRole === "ARTICLE" && !item.isArticle) return false;

      // Doer filter
      if (selectedDoer !== "ALL") {
        const name = (item.doerName || item.employeeName || "").toLowerCase().trim();
        if (name !== selectedDoer.toLowerCase().trim()) return false;
      }

      // Dept filter
      if (selectedDept !== "ALL") {
        if ((item.department || "").toLowerCase() !== selectedDept.toLowerCase()) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const nameMatch = (item.doerName || item.employeeName || "").toLowerCase().includes(q);
        const deptMatch = (item.department || "").toLowerCase().includes(q);
        const compMatch = (item.companyName || "").toLowerCase().includes(q);
        const taskMatch = (item.taskDescription || "").toLowerCase().includes(q);
        const locMatch = (item.location || "").toLowerCase().includes(q);
        if (!nameMatch && !deptMatch && !compMatch && !taskMatch && !locMatch) {
          return false;
        }
      }
      return true;
    });
  }, [workingLogs, selectedMonth, selectedRole, selectedDoer, selectedDept, searchQuery]);

  // Filtered active staff members for Daily Working Cards View
  const filteredStaffMembers = useMemo(() => {
    return activeStaffMembers.filter((member) => {
      // Month filter
      if (selectedMonth !== "ALL") {
        const hasLogInMonth = workingLogs.some((l) => {
          const lName = (l.doerName || l.employeeName || "").toLowerCase().trim();
          if (lName !== member.name.toLowerCase().trim()) return false;
          const my = getMonthYearInfo(l.date || l.timestamp);
          return my && my.key === selectedMonth;
        });
        if (!hasLogInMonth) return false;
      }

      // Role filter
      if (selectedRole === "PARTNER" && !member.isPartner) return false;
      if (selectedRole === "SENIOR" && !member.isSenior) return false;
      if (selectedRole === "ARTICLE" && !member.isArticle) return false;

      // Doer filter
      if (selectedDoer !== "ALL") {
        if (member.name.toLowerCase().trim() !== selectedDoer.toLowerCase().trim()) return false;
      }

      // Dept filter
      if (selectedDept !== "ALL") {
        if ((member.department || "").toLowerCase() !== selectedDept.toLowerCase()) return false;
      }

      // Search
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const nameMatch = member.name.toLowerCase().includes(q);
        const deptMatch = (member.department || "").toLowerCase().includes(q);
        const compMatch = (member.latestCompany || "").toLowerCase().includes(q);
        const taskMatch = (member.latestTask || "").toLowerCase().includes(q);
        if (!nameMatch && !deptMatch && !compMatch && !taskMatch) return false;
      }

      return true;
    });
  }, [activeStaffMembers, workingLogs, selectedMonth, selectedRole, selectedDoer, selectedDept, searchQuery]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDept, selectedRole, selectedDoer, selectedMonth]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Handle API Test
  const handleTestConnection = async () => {
    setIsTestingApi(true);
    setApiTestResult(null);
    try {
      const res = await testDailyWorkingConnection(apiInputUrl);
      setApiTestResult(res);
    } catch (err) {
      setApiTestResult({ success: false, error: err.message || String(err) });
    } finally {
      setIsTestingApi(false);
    }
  };

  // Handle Save API URL
  const handleSaveApiUrl = () => {
    setDailyWorkingWebAppUrl(apiInputUrl);
    setShowApiModal(false);
    loadDailyWorking(true);
  };

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
              <span style={{ fontSize: "36px" }}>👑</span>
              <h1 style={styles.heading}>MD Rajesh Agrawal</h1>
            </div>
            <p style={styles.subHeading}>Agrawal Jain &amp; Co. • Executive Management Dashboard</p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <a
              href={DAILY_WORKING_GOOGLE_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.sheetLinkBtn}
              title="Open Google Sheet in new tab"
            >
              <span>📊</span> Google Sheet ↗
            </a>

            <button
              style={styles.apiConfigBtn}
              onClick={() => setShowApiModal(true)}
              title="Configure Google Apps Script Live API"
            >
              <span>⚙️</span> Apps Script Sync
            </button>

            <button
              style={styles.refreshBtn}
              onClick={() => loadDailyWorking(true)}
              disabled={refreshingLogs}
              title="Refresh Daily Working Data"
            >
              <span>{refreshingLogs ? "⏳" : "🔄"}</span> {refreshingLogs ? "Syncing..." : "Refresh Logs"}
            </button>

            <button style={styles.logoutBtn} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* QUICK LAUNCH CARDS GRID */}
      <div style={styles.grid}>
        <div style={styles.card} onClick={() => navigate("/dailyMDSIR")}>
          <h2 style={styles.cardTitle}>Daily Attendance</h2>
          <p style={styles.cardText}>Check today attendance status &amp; biometric punches</p>
        </div>

        <div
          style={{
            ...styles.card,
            background: "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
            color: "#ffffff",
            position: "relative",
            boxShadow: "0 8px 24px rgba(15,118,110,0.3)",
          }}
          onClick={() => navigate("/daily-working", { state: { role: "PARTNERS_SENIORS_ARTICLES" } })}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <span style={{ fontSize: "28px" }}>💼</span>
              <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700" }}>
                {workingLogs.length} Verified Staff Logs
              </span>
            </div>
            <h2 style={{ ...styles.cardTitle, color: "#ffffff" }}>Daily Working Hub</h2>
            <p style={{ ...styles.cardText, color: "#ccfbf1", marginTop: "4px" }}>
              Partners (3), Seniors (10) &amp; Articles (31) Work Central
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.2)" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#a7f3d0" }}>
              📊 Open Complete Hub →
            </span>
            <span style={{ fontSize: "12px", background: "#059669", padding: "3px 8px", borderRadius: "6px" }}>
              Partners, Seniors &amp; Articles
            </span>
          </div>
        </div>

        <div style={styles.card} onClick={() => navigate("/employee-daily-working/CA%20Rajesh%20Agrawal")}>
          <h2 style={styles.cardTitle}>My Daily Working</h2>
          <p style={styles.cardText}>Submit and review your executive schedule &amp; diary</p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Delegation</h2>
          <p style={styles.cardText}>Manage delegated tasks and review deadlines</p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Checklist</h2>
          <p style={styles.cardText}>Complete assigned checklists &amp; quality controls</p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Pending CL</h2>
          <p style={styles.cardText}>View pending client deliverables and audits</p>
        </div>

        <div style={styles.card} onClick={() => navigate("/leave-form")}>
          <h2 style={styles.cardTitle}>Leave Form</h2>
          <p style={styles.cardText}>Review staff leave requests and approvals</p>
        </div>

        <div style={styles.card} onClick={() => navigate("/pending-approvals")}>
          <h2 style={styles.cardTitle}>Pending Approvals</h2>
          <p style={styles.cardText}>Review pending sign-offs &amp; compliance reports</p>
        </div>

        <div style={styles.card} onClick={() => navigate("/internal-audit-fms")}>
          <h2 style={styles.cardTitle}>Internal-Audit-FMS</h2>
          <p style={styles.cardText}>Track audit progress, schedules and fieldwork</p>
        </div>

        <div style={{ ...styles.card, background: "#0891b2" }} onClick={() => navigate("/client-master")}>
          <h2 style={styles.cardTitle}>Client Management</h2>
          <p style={styles.cardText}>Manage client directory, groups &amp; company masters</p>
        </div>
      </div>

      {/* DAILY WORKING LIVE EXECUTIVE MONITOR - PARTNERS, SENIORS & ARTICLES */}
      <div style={styles.monitorSection}>
        <div style={styles.monitorHeader}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "24px" }}>📋</span>
              <h2 style={styles.monitorTitle}>Daily Working — Executive Monitor</h2>
              <span style={styles.badgeLive} title={sourceStatus?.type ? `Connected via ${sourceStatus.type}` : "Live Integrated"}>
                ● Live ({workingLogs.length} Tasks Logged)
              </span>
            </div>
            <p style={styles.monitorSubtitle}>
              Verified live working cards for <strong>Partners (3)</strong>, <strong>Seniors (10)</strong> &amp; <strong>Articles (31)</strong> reference from <code>attendanceConfig.js</code>
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* View Switcher: Cards vs Table */}
            <div style={styles.viewSwitcher}>
              <button
                style={{
                  ...styles.viewSwitchBtn,
                  ...(activeViewMode === "cards" ? styles.viewSwitchBtnActive : {}),
                }}
                onClick={() => setActiveViewMode("cards")}
              >
                <span>🗂️</span> Cards View ({filteredStaffMembers.length})
              </button>
              <button
                style={{
                  ...styles.viewSwitchBtn,
                  ...(activeViewMode === "table" ? styles.viewSwitchBtnActive : {}),
                }}
                onClick={() => setActiveViewMode("table")}
              >
                <span>📋</span> All Logs Table ({filteredLogs.length})
              </button>
            </div>

            <button
              style={styles.openHubBtn}
              onClick={() => navigate("/daily-working", { state: { role: "PARTNERS_SENIORS_ARTICLES" } })}
            >
              <span>🚀</span> Open Full Hub ({workingLogs.length} Records) →
            </button>
          </div>
        </div>

        {/* METRICS STRIP */}
        <div style={styles.metricsGrid}>
          <div style={styles.metricCard}>
            <span style={styles.metricIcon}>📝</span>
            <div>
              <div style={styles.metricVal}>{loadingLogs ? "..." : workingLogs.length}</div>
              <div style={styles.metricLbl}>Total Tasks Logged</div>
            </div>
          </div>

          <div style={styles.metricCard}>
            <span style={styles.metricIcon}>👥</span>
            <div>
              <div style={styles.metricVal}>{loadingLogs ? "..." : `${activeStaffMembers.length} Active`}</div>
              <div style={styles.metricLbl}>Partners, Seniors &amp; Articles Logged</div>
            </div>
          </div>

          <div style={styles.metricCard}>
            <span style={styles.metricIcon}>🏢</span>
            <div>
              <div style={styles.metricVal}>{loadingLogs ? "..." : companyCount}</div>
              <div style={styles.metricLbl}>Client Companies Serviced</div>
            </div>
          </div>

          <div style={styles.metricCard}>
            <span style={styles.metricIcon}>📑</span>
            <div>
              <div style={styles.metricVal}>{loadingLogs ? "..." : departments.length}</div>
              <div style={styles.metricLbl}>Departments Active</div>
            </div>
          </div>
        </div>

        {/* ROLE SUMMARY CARDS: PARTNERS, SENIORS, ARTICLES */}
        <div style={styles.roleSummaryGrid}>
          {/* PARTNERS CARD */}
          <div
            style={{
              ...styles.roleSummaryCard,
              borderColor: selectedRole === "PARTNER" ? "#7c3aed" : "#e2e8f0",
              background: selectedRole === "PARTNER" ? "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)" : "#ffffff",
            }}
            onClick={() => setSelectedRole(selectedRole === "PARTNER" ? "ALL" : "PARTNER")}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: "28px" }}>🤝</span>
              <span style={styles.roleSummaryBadgePartner}>
                {activePartnersCount} / {PARTNERS_LIST.length} Active
              </span>
            </div>
            <h3 style={{ margin: "10px 0 2px", fontSize: "16px", color: "#1e1b4b" }}>Partners</h3>
            <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#6b7280" }}>
              CA Rupesh Vaid, CA Ankit Garg, CA Mukul Jain
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#7c3aed" }}>
                {partnerLogsCount} Tasks Logged
              </span>
              <span style={{ fontSize: "11px", color: "#6366f1", fontWeight: "600" }}>
                {selectedRole === "PARTNER" ? "Active Filter ✓" : "Click to Filter →"}
              </span>
            </div>
          </div>

          {/* SENIORS CARD */}
          <div
            style={{
              ...styles.roleSummaryCard,
              borderColor: selectedRole === "SENIOR" ? "#0f766e" : "#e2e8f0",
              background: selectedRole === "SENIOR" ? "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)" : "#ffffff",
            }}
            onClick={() => setSelectedRole(selectedRole === "SENIOR" ? "ALL" : "SENIOR")}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: "28px" }}>👔</span>
              <span style={styles.roleSummaryBadgeSenior}>
                {activeSeniorsCount} / {SENIORS_LIST.length} Active
              </span>
            </div>
            <h3 style={{ margin: "10px 0 2px", fontSize: "16px", color: "#042f2e" }}>Seniors</h3>
            <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#6b7280" }}>
              10 CAs &amp; CMAs (Harsh, Kanha, Chandan, Drishti, etc.)
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f766e" }}>
                {seniorLogsCount} Tasks Logged
              </span>
              <span style={{ fontSize: "11px", color: "#0f766e", fontWeight: "600" }}>
                {selectedRole === "SENIOR" ? "Active Filter ✓" : "Click to Filter →"}
              </span>
            </div>
          </div>

          {/* ARTICLES CARD */}
          <div
            style={{
              ...styles.roleSummaryCard,
              borderColor: selectedRole === "ARTICLE" ? "#0284c7" : "#e2e8f0",
              background: selectedRole === "ARTICLE" ? "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)" : "#ffffff",
            }}
            onClick={() => setSelectedRole(selectedRole === "ARTICLE" ? "ALL" : "ARTICLE")}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: "28px" }}>📚</span>
              <span style={styles.roleSummaryBadgeArticle}>
                {activeArticlesCount} / {ARTICLES_LIST.length} Active
              </span>
            </div>
            <h3 style={{ margin: "10px 0 2px", fontSize: "16px", color: "#082f49" }}>Articles</h3>
            <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#6b7280" }}>
              31 Articles (Aditya Raj, Akshita, Ankit, Moksh, etc.)
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#0284c7" }}>
                {articleLogsCount} Tasks Logged
              </span>
              <span style={{ fontSize: "11px", color: "#0284c7", fontWeight: "600" }}>
                {selectedRole === "ARTICLE" ? "Active Filter ✓" : "Click to Filter →"}
              </span>
            </div>
          </div>
        </div>

        {/* CONTROLS: ROLE FILTER, DOER SELECT, SEARCH & DEPT FILTER */}
        <div style={styles.filterBar}>
          {/* SEARCH BOX */}
          <div style={styles.searchBox}>
            <span style={{ fontSize: "16px" }}>🔍</span>
            <input
              type="text"
              placeholder="Search by staff name, client company, task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={styles.clearSearchBtn}
              >
                ✕
              </button>
            )}
          </div>

          {/* ROLE PILLS: ALL / PARTNERS / SENIORS / ARTICLES */}
          <div style={styles.roleFilterGroup}>
            <button
              style={{
                ...styles.rolePill,
                ...(selectedRole === "ALL" ? styles.rolePillActive : {}),
              }}
              onClick={() => setSelectedRole("ALL")}
            >
              All ({workingLogs.length})
            </button>
            <button
              style={{
                ...styles.rolePill,
                ...(selectedRole === "PARTNER" ? styles.rolePillPartnerActive : {}),
              }}
              onClick={() => setSelectedRole("PARTNER")}
            >
              🤝 Partners ({partnerLogsCount})
            </button>
            <button
              style={{
                ...styles.rolePill,
                ...(selectedRole === "SENIOR" ? styles.rolePillSeniorActive : {}),
              }}
              onClick={() => setSelectedRole("SENIOR")}
            >
              👔 Seniors ({seniorLogsCount})
            </button>
            <button
              style={{
                ...styles.rolePill,
                ...(selectedRole === "ARTICLE" ? styles.rolePillArticleActive : {}),
              }}
              onClick={() => setSelectedRole("ARTICLE")}
            >
              📚 Articles ({articleLogsCount})
            </button>
          </div>

          {/* MONTH DROPDOWN */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748b" }}>
              Month:
            </span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={styles.doerSelect}
            >
              <option value="ALL">All Months ({availableMonths.length})</option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>
                  📅 {m.label} ({m.count} logs)
                </option>
              ))}
            </select>
          </div>

          {/* DOER DROPDOWN */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748b" }}>
              Member:
            </span>
            <select
              value={selectedDoer}
              onChange={(e) => setSelectedDoer(e.target.value)}
              style={styles.doerSelect}
            >
              <option value="ALL">All Staff ({activeStaffMembers.length})</option>
              <optgroup label="🤝 Partners">
                {activeStaffMembers.filter(s => s.isPartner).map(s => (
                  <option key={s.name} value={s.name}>{s.name} ({s.count} logs)</option>
                ))}
              </optgroup>
              <optgroup label="👔 Seniors">
                {activeStaffMembers.filter(s => s.isSenior).map(s => (
                  <option key={s.name} value={s.name}>{s.name} ({s.count} logs)</option>
                ))}
              </optgroup>
              <optgroup label="📚 Articles">
                {activeStaffMembers.filter(s => s.isArticle).map(s => (
                  <option key={s.name} value={s.name}>{s.name} ({s.count} logs)</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* DEPT PILLS */}
          <div style={styles.deptFilterGroup}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748b" }}>
              Dept:
            </span>
            <button
              style={{
                ...styles.deptPill,
                ...(selectedDept === "ALL" ? styles.deptPillActive : {}),
              }}
              onClick={() => setSelectedDept("ALL")}
            >
              All Depts
            </button>
            {departments.map((dept) => {
              const count = workingLogs.filter((l) => (l.department || "").toLowerCase() === dept.toLowerCase()).length;
              return (
                <button
                  key={dept}
                  style={{
                    ...styles.deptPill,
                    ...(selectedDept === dept ? styles.deptPillActive : {}),
                  }}
                  onClick={() => setSelectedDept(dept)}
                >
                  {dept} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* CARDS VIEW */}
        {activeViewMode === "cards" && (
          <div style={styles.cardsContainer}>
            {loadingLogs ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>⏳</div>
                <h3 style={{ margin: 0, color: "#1e293b" }}>Loading Daily Working Cards...</h3>
                <p style={{ color: "#64748b", margin: "6px 0 0" }}>
                  Connecting to Google Sheet and Google Apps Script API...
                </p>
              </div>
            ) : filteredStaffMembers.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔍</div>
                <h3 style={{ margin: 0, color: "#1e293b" }}>No Members Found Matching Filter</h3>
                <p style={{ color: "#64748b", margin: "6px 0 0" }}>
                  Try resetting the role filter or clearing your search keywords.
                </p>
              </div>
            ) : (
              <div style={styles.cardsGrid}>
                {filteredStaffMembers.map((member) => {
                  const initials = member.name
                    .split(" ")
                    .map((w) => w[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  const roleBadgeStyle = member.isPartner
                    ? styles.partnerPill
                    : member.isSenior
                      ? styles.seniorPill
                      : styles.articlePill;

                  return (
                    <div key={member.name} style={styles.empCard}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                        <div
                          style={{
                            ...styles.cardAvatar,
                            background: member.isPartner
                              ? "linear-gradient(135deg, #7c3aed 0%, #4338ca 100%)"
                              : member.isSenior
                                ? "linear-gradient(135deg, #0f766e 0%, #115e59 100%)"
                                : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                          }}
                        >
                          {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <h4 style={styles.empCardName} title={member.name}>
                              {member.name}
                            </h4>
                            <span style={roleBadgeStyle}>
                              {member.roleIcon} {member.role}
                            </span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                            {member.department || "General"}
                          </div>
                        </div>
                      </div>

                      {/* STATS STRIP */}
                      <div style={styles.empCardStats}>
                        <div>
                          <div style={styles.empCardStatVal}>{member.count}</div>
                          <div style={styles.empCardStatLbl}>Tasks Logged</div>
                        </div>
                        {member.latestDate && (
                          <div>
                            <div style={styles.empCardStatVal}>
                              {formatExcelOrStringDate(member.latestDate) || member.latestDate}
                            </div>
                            <div style={styles.empCardStatLbl}>Latest Date</div>
                          </div>
                        )}
                        {member.latestTimeGiven && (
                          <div>
                            <div style={styles.empCardStatVal}>{member.latestTimeGiven}</div>
                            <div style={styles.empCardStatLbl}>Time Given</div>
                          </div>
                        )}
                      </div>

                      {/* LATEST TASK SNIPPET */}
                      {member.latestTask && (
                        <div style={styles.empCardTaskBox}>
                          <div style={styles.empCardTaskCompany}>
                            🏢 {member.latestCompany || "Work Entry"}
                          </div>
                          <div style={styles.empCardTaskDesc} title={member.latestTask}>
                            {member.latestTask}
                          </div>
                        </div>
                      )}

                      {/* ACTIONS */}
                      <div style={styles.empCardActions}>
                        <button
                          style={styles.cardDiaryBtn}
                          onClick={() => navigate(member.dedicatedRoute)}
                        >
                          <span>📖</span> Open Diary ↗
                        </button>
                        <button
                          style={styles.cardFilterBtn}
                          onClick={() => {
                            setSelectedDoer(member.name);
                            setActiveViewMode("table");
                          }}
                        >
                          <span>🔍</span> View Tasks
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TABLE VIEW */}
        {activeViewMode === "table" && (
          <div style={styles.tableCard}>
            {loadingLogs ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>⏳</div>
                <h3 style={{ margin: 0, color: "#1e293b" }}>Loading Partners, Seniors &amp; Articles Daily Working Data...</h3>
                <p style={{ color: "#64748b", margin: "6px 0 0" }}>
                  Connecting to Google Sheet and Google Apps Script API...
                </p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔍</div>
                <h3 style={{ margin: 0, color: "#1e293b" }}>No Work Logs Match Your Search</h3>
                <p style={{ color: "#64748b", margin: "6px 0 0" }}>
                  Try adjusting the role filter, member selector, or search keyword.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeadRow}>
                      <th style={{ ...styles.th, width: "100px" }}>Date</th>
                      <th style={{ ...styles.th, width: "220px" }}>Staff Member</th>
                      <th style={{ ...styles.th, width: "130px" }}>Department</th>
                      <th style={{ ...styles.th, width: "120px" }}>Location</th>
                      <th style={{ ...styles.th, width: "220px" }}>Client / Company</th>
                      <th style={styles.th}>Task Description</th>
                      <th style={{ ...styles.th, width: "100px", textAlign: "right" }}>Time Given</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.map((row, idx) => {
                      const doer = row.doerName || row.employeeName || "Unknown";
                      const isPart = row.isPartner;
                      const isSen = row.isSenior;
                      const roleBadgeStyle = isPart ? styles.partnerPill : isSen ? styles.seniorPill : styles.articlePill;
                      const avatarBg = isPart ? "#7c3aed" : isSen ? "#0f766e" : "#0284c7";
                      const roleIcon = isPart ? "🤝" : isSen ? "👔" : "📚";
                      const roleLabel = isPart ? "Partner" : isSen ? "Senior" : "Article";

                      return (
                        <tr
                          key={idx}
                          style={{
                            ...styles.tableRow,
                            background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                          }}
                        >
                          <td style={styles.td}>
                            <span style={styles.dateBadge}>
                              {formatExcelOrStringDate(row.date) || row.date || "-"}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span
                                style={{
                                  ...styles.avatarCircle,
                                  background: avatarBg,
                                }}
                              >
                                {roleIcon}
                              </span>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  <strong style={{ color: "#0f172a", fontSize: "14px" }}>
                                    {doer}
                                  </strong>
                                  <span
                                    style={roleBadgeStyle}
                                  >
                                    {roleLabel}
                                  </span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                                  {row.period && (
                                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                                      {row.period}
                                    </span>
                                  )}
                                  <button
                                    style={styles.diaryLinkBtn}
                                    onClick={() => navigate(getDedicatedDailyWorkingRoute(doer))}
                                    title="Open dedicated daily working diary"
                                  >
                                    View Diary ↗
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.deptBadge,
                                background:
                                  row.department === "Internal Audit"
                                    ? "#e0f2fe"
                                    : row.department === "Income Tax"
                                      ? "#fef3c7"
                                      : row.department === "AJC"
                                        ? "#dcfce7"
                                        : "#f1f5f9",
                                color:
                                  row.department === "Internal Audit"
                                    ? "#0369a1"
                                    : row.department === "Income Tax"
                                      ? "#b45309"
                                      : row.department === "AJC"
                                        ? "#15803d"
                                        : "#475569",
                              }}
                            >
                              {row.department || "General"}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontSize: "13px", color: "#475569" }}>
                              📍 {row.location || "Office"}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <div>
                              <strong style={{ color: "#1e293b", fontSize: "13px" }}>
                                {row.companyName || row.groupName || "-"}
                              </strong>
                              {row.groupName && row.groupName !== row.companyName && (
                                <div style={{ fontSize: "11px", color: "#64748b" }}>
                                  Group: {row.groupName}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={styles.td}>
                            <div style={{ color: "#334155", fontSize: "13px", lineHeight: "1.5" }}>
                              {row.taskDescription || "-"}
                            </div>
                          </td>
                          <td style={{ ...styles.td, textAlign: "right" }}>
                            <span style={styles.timeBadge}>
                              ⏱️ {row.timeGiven || "04:00"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* PAGINATION CONTROLS */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 20px",
                    background: "#f8fafc",
                    borderTop: "1px solid #e2e8f0",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div style={{ fontSize: "13px", color: "#475569" }}>
                    Showing{" "}
                    <strong>
                      {filteredLogs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
                    </strong>{" "}
                    to{" "}
                    <strong>
                      {Math.min(currentPage * pageSize, filteredLogs.length)}
                    </strong>{" "}
                    of <strong>{filteredLogs.length.toLocaleString()}</strong> total work logs
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label style={{ fontSize: "12px", color: "#64748b" }}>Rows per page:</label>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
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
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        background: currentPage === 1 ? "#f1f5f9" : "#fff",
                        color: currentPage === 1 ? "#94a3b8" : "#0f172a",
                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      « First
                    </button>

                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        background: currentPage === 1 ? "#f1f5f9" : "#fff",
                        color: currentPage === 1 ? "#94a3b8" : "#0f172a",
                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      ‹ Prev
                    </button>

                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b", margin: "0 6px" }}>
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        background: currentPage === totalPages ? "#f1f5f9" : "#fff",
                        color: currentPage === totalPages ? "#94a3b8" : "#0f172a",
                        cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      Next ›
                    </button>

                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        background: currentPage === totalPages ? "#f1f5f9" : "#fff",
                        color: currentPage === totalPages ? "#94a3b8" : "#0f172a",
                        cursor: currentPage === totalPages ? "not-allowed" : "pointer",
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
          </div>
        )}
      </div>

      {/* API CONFIG MODAL */}
      {showApiModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "22px" }}>⚙️</span>
                <h3 style={{ margin: 0, fontSize: "20px", color: "#0f172a" }}>
                  Google Apps Script &amp; Sheet Integration
                </h3>
              </div>
              <button
                onClick={() => setShowApiModal(false)}
                style={styles.closeBtn}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.infoAlert}>
                <strong>Target Google Sheet:</strong>
                <br />
                <a
                  href={DAILY_WORKING_GOOGLE_SHEET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#2563eb", wordBreak: "break-all" }}
                >
                  {DAILY_WORKING_GOOGLE_SHEET_URL}
                </a>
                <div style={{ marginTop: "6px", fontSize: "12px", color: "#475569" }}>
                  Sheet ID: <code>{DAILY_WORKING_GOOGLE_SHEET_ID}</code>
                </div>
              </div>

              <div style={{ marginTop: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                  Google Apps Script Web App Executable URL:
                </label>
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={apiInputUrl}
                  onChange={(e) => setApiInputUrl(e.target.value)}
                  style={styles.apiInput}
                />
                <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#64748b" }}>
                  Paste the Web App URL deployed from <code>GoogleAppsScript_DailyWorking.gs</code> (Must be deployed with &quot;Who has access: Anyone&quot;).
                </p>
              </div>

              {/* TEST RESULT */}
              {apiTestResult && (
                <div
                  style={{
                    marginTop: "14px",
                    padding: "12px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    background: apiTestResult.success ? "#ecfdf5" : "#fef2f2",
                    border: `1px solid ${apiTestResult.success ? "#a7f3d0" : "#fecaca"}`,
                    color: apiTestResult.success ? "#065f46" : "#991b1b",
                  }}
                >
                  {apiTestResult.success ? (
                    <div>
                      <strong>✅ Connection Successful!</strong>
                      <pre style={{ margin: "6px 0 0", fontSize: "11px", overflowX: "auto" }}>
                        {JSON.stringify(apiTestResult.data, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div>
                      <strong>❌ Connection Failed:</strong> {apiTestResult.error}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: "18px", padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "#0f172a" }}>
                  ⚡ How to connect in 2 simple steps:
                </h4>
                <ol style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#475569", lineHeight: "1.6" }}>
                  <li>
                    <strong>Option A (Direct &amp; Instant):</strong> In your Google Sheet, click <em>Share</em> &gt; Change <em>General Access</em> to &quot;Anyone with the link (Viewer)&quot;. The system will immediately read your sheet directly!
                  </li>
                  <li>
                    <strong>Option B (Apps Script Web App):</strong> Open Sheet &gt; Extensions &gt; Apps Script &gt; Paste code from <code>GoogleAppsScript_DailyWorking.gs</code> &gt; Deploy as Web App (&quot;Execute as: Me&quot;, &quot;Who has access: Anyone&quot;) &gt; Paste the generated URL above!
                  </li>
                </ol>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={handleTestConnection}
                disabled={isTestingApi || !apiInputUrl.trim()}
                style={styles.testBtn}
              >
                {isTestingApi ? "Testing..." : "📡 Test Live Connection"}
              </button>

              <button
                onClick={handleSaveApiUrl}
                style={styles.saveBtn}
              >
                💾 Save &amp; Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "25px",
    fontFamily: "Inter, sans-serif",
  },

  header: {
    background: "#ffffff",
    padding: "26px 30px",
    borderRadius: "20px",
    marginBottom: "25px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    borderLeft: "6px solid #1e3a8a",
  },

  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
  },

  heading: {
    margin: 0,
    fontSize: "38px",
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: "-0.5px",
  },

  subHeading: {
    marginTop: "4px",
    color: "#64748b",
    fontSize: "16px",
  },

  sheetLinkBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "#ecfdf5",
    color: "#059669",
    border: "1px solid #a7f3d0",
    padding: "10px 18px",
    borderRadius: "10px",
    textDecoration: "none",
    fontWeight: "600",
    fontSize: "14px",
    transition: "all 0.2s ease",
  },

  apiConfigBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #cbd5e1",
    padding: "10px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
  },

  refreshBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: "10px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
  },

  logoutBtn: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    padding: "10px 20px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "18px",
    marginBottom: "30px",
  },

  card: {
    background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
    borderRadius: "16px",
    padding: "22px",
    color: "#fff",
    minHeight: "160px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(37,99,235,0.15)",
    transition: "all 0.2s ease",
  },

  cardTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "700",
    lineHeight: "32px",
  },

  cardText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: "20px",
    opacity: "0.92",
  },

  // Daily Working Live Monitor
  monitorSection: {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "26px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    marginBottom: "35px",
    border: "1px solid #e2e8f0",
  },

  monitorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "20px",
    paddingBottom: "18px",
    borderBottom: "1px solid #f1f5f9",
  },

  monitorTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "800",
    color: "#0f172a",
  },

  monitorSubtitle: {
    margin: "4px 0 0",
    fontSize: "13px",
    color: "#64748b",
  },

  badgeLive: {
    background: "#ecfdf5",
    color: "#059669",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "700",
    border: "1px solid #a7f3d0",
  },

  openHubBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    background: "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
    color: "#ffffff",
    border: "none",
    padding: "10px 20px",
    borderRadius: "10px",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(15,118,110,0.25)",
  },

  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
    marginBottom: "22px",
  },

  metricCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  metricIcon: {
    fontSize: "28px",
    background: "#ffffff",
    padding: "8px",
    borderRadius: "10px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },

  metricVal: {
    fontSize: "26px",
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: "1.1",
  },

  metricLbl: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#64748b",
    marginTop: "2px",
  },

  filterBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "14px",
    marginBottom: "16px",
  },

  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "8px 14px",
    flex: "1 1 320px",
    maxWidth: "500px",
  },

  searchInput: {
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "14px",
    width: "100%",
    color: "#0f172a",
  },

  clearSearchBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: "14px",
  },

  deptFilterGroup: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
  },

  roleFilterGroup: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
  },

  rolePill: {
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    color: "#475569",
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },

  rolePillActive: {
    background: "#0f172a",
    color: "#ffffff",
    borderColor: "#0f172a",
  },

  rolePillPartnerActive: {
    background: "#7c3aed",
    color: "#ffffff",
    borderColor: "#7c3aed",
    boxShadow: "0 2px 8px rgba(124, 58, 237, 0.3)",
  },

  rolePillSeniorActive: {
    background: "#0f766e",
    color: "#ffffff",
    borderColor: "#0f766e",
    boxShadow: "0 2px 8px rgba(15, 118, 110, 0.3)",
  },

  partnerPill: {
    display: "inline-block",
    background: "#f3e8ff",
    color: "#7c3aed",
    border: "1px solid #d8b4fe",
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "10px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  seniorPill: {
    display: "inline-block",
    background: "#ccfbf1",
    color: "#0f766e",
    border: "1px solid #99f6e4",
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "10px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  rolePillArticleActive: {
    background: "#0284c7",
    color: "#ffffff",
    borderColor: "#0284c7",
    boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
  },

  articlePill: {
    display: "inline-block",
    background: "#e0f2fe",
    color: "#0284c7",
    border: "1px solid #bae6fd",
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "10px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  roleSummaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },

  roleSummaryCard: {
    border: "2px solid #e2e8f0",
    borderRadius: "14px",
    padding: "16px",
    background: "#ffffff",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
  },

  roleSummaryBadgePartner: {
    background: "#f3e8ff",
    color: "#7c3aed",
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "700",
  },

  roleSummaryBadgeSenior: {
    background: "#ccfbf1",
    color: "#0f766e",
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "700",
  },

  roleSummaryBadgeArticle: {
    background: "#e0f2fe",
    color: "#0284c7",
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "700",
  },

  viewSwitcher: {
    display: "flex",
    background: "#f1f5f9",
    padding: "4px",
    borderRadius: "10px",
    gap: "4px",
  },

  viewSwitchBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "transparent",
    border: "none",
    padding: "6px 14px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "600",
    color: "#64748b",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },

  viewSwitchBtnActive: {
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: "700",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },

  cardsContainer: {
    marginTop: "8px",
    marginBottom: "20px",
  },

  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
    gap: "16px",
  },

  empCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },

  cardAvatar: {
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: "700",
    flexShrink: 0,
  },

  empCardName: {
    margin: 0,
    fontSize: "15px",
    fontWeight: "700",
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  empCardStats: {
    display: "flex",
    justifyContent: "space-between",
    background: "#f8fafc",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #f1f5f9",
    margin: "12px 0",
  },

  empCardStatVal: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#0f172a",
  },

  empCardStatLbl: {
    fontSize: "10px",
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: "600",
  },

  empCardTaskBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "10px 12px",
    marginBottom: "14px",
    flex: 1,
  },

  empCardTaskCompany: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: "4px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  empCardTaskDesc: {
    fontSize: "12px",
    color: "#475569",
    lineHeight: "1.4",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },

  empCardActions: {
    display: "flex",
    gap: "8px",
    marginTop: "auto",
  },

  cardDiaryBtn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    background: "#0f766e",
    color: "#ffffff",
    border: "none",
    padding: "8px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },

  cardFilterBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    background: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cbd5e1",
    padding: "8px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },

  diaryLinkBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
    background: "transparent",
    color: "#2563eb",
    border: "none",
    padding: "0",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
    textDecoration: "underline",
  },

  doerSelect: {
    padding: "6px 12px",
    borderRadius: "20px",
    border: "1px solid #cbd5e1",
    fontSize: "12px",
    background: "#fff",
    color: "#1e293b",
    fontWeight: "600",
    cursor: "pointer",
    outline: "none",
  },

  deptPill: {
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    color: "#475569",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },

  deptPillActive: {
    background: "#1e3a8a",
    color: "#ffffff",
    borderColor: "#1e3a8a",
  },

  tableCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    overflow: "hidden",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: "13px",
  },

  tableHeadRow: {
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
  },

  th: {
    padding: "12px 16px",
    fontSize: "12px",
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  tableRow: {
    borderBottom: "1px solid #f1f5f9",
    transition: "background 0.15s ease",
  },

  td: {
    padding: "14px 16px",
    verticalAlign: "middle",
  },

  dateBadge: {
    display: "inline-block",
    background: "#f1f5f9",
    color: "#475569",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },

  avatarCircle: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "700",
    flexShrink: 0,
  },

  deptBadge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "700",
    whiteSpace: "nowrap",
  },

  timeBadge: {
    display: "inline-block",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#0f766e",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "700",
    whiteSpace: "nowrap",
  },

  emptyState: {
    padding: "40px 20px",
    textAlign: "center",
  },

  // Modal styles
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15, 23, 42, 0.6)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "20px",
  },

  modalBox: {
    background: "#ffffff",
    borderRadius: "20px",
    width: "100%",
    maxWidth: "580px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
    overflow: "hidden",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #e2e8f0",
  },

  closeBtn: {
    background: "none",
    border: "none",
    fontSize: "18px",
    color: "#94a3b8",
    cursor: "pointer",
  },

  modalBody: {
    padding: "20px 24px",
  },

  infoAlert: {
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    padding: "12px 16px",
    borderRadius: "10px",
    fontSize: "13px",
    color: "#0369a1",
  },

  apiInput: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  },

  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    padding: "16px 24px",
    borderTop: "1px solid #e2e8f0",
    background: "#f8fafc",
  },

  testBtn: {
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    color: "#334155",
    padding: "10px 16px",
    borderRadius: "8px",
    fontWeight: "600",
    fontSize: "13px",
    cursor: "pointer",
  },

  saveBtn: {
    background: "#059669",
    border: "none",
    color: "#ffffff",
    padding: "10px 18px",
    borderRadius: "8px",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
  },
};