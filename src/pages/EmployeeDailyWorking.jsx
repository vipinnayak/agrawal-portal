// src/pages/EmployeeDailyWorking.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  fetchDailyWorkingLogs,
  DAILY_WORKING_API,
  DROPDOWN_API,
  formatExcelOrStringDate,
  parseMissingDates,
} from "../utils/dailyWorkingService";
import { normalizeName, getEmployeeCategoryInfo } from "../utils/attendanceConfig";
import "./EmployeeDailyWorking.css";

const RESPONSE_API =
  DAILY_WORKING_API ||
  "https://script.google.com/macros/s/AKfycbyVRDZmhX_nApCD5RPIlNNcP5xKRGQuJDQof0x2QvCxtUNeozMggmXAw-aX7fH-gjq1kQ/exec";

export default function EmployeeDailyWorking() {
  const { empName: paramEmpName } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Determine current employee name
  const rawEmpName = useMemo(() => {
    if (paramEmpName) return decodeURIComponent(paramEmpName).trim();
    const queryEmp = searchParams.get("emp");
    if (queryEmp) return decodeURIComponent(queryEmp).trim();
    const localEmp = localStorage.getItem("employeeName") || localStorage.getItem("loggedInUser");
    if (localEmp) return localEmp.trim();
    return "Employee";
  }, [paramEmpName, searchParams]);

  const normalizedCurrentEmp = useMemo(() => normalizeName(rawEmpName), [rawEmpName]);
  const empCategory = useMemo(() => getEmployeeCategoryInfo(rawEmpName), [rawEmpName]);

  // Data states
  const [allData, setAllData] = useState([]);
  const [dropdowns, setDropdowns] = useState({
    periods: [],
    departments: [],
    locations: [],
    masterData: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states (Pre-locked for this employee)
  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [formDate, setFormDate] = useState(getTodayDateString());
  const [formLocation, setFormLocation] = useState("AJC Office");
  const [rows, setRows] = useState([
    {
      period: "",
      department: "",
      groupName: "",
      companyName: "",
      taskDescription: "",
      timeGiven: "",
    },
  ]);

  // History search & filter
  const [historySearch, setHistorySearch] = useState("");

  // Load Data
  const loadEmployeeData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [list, dropRes] = await Promise.all([
        fetchDailyWorkingLogs(),
        fetch(DROPDOWN_API).then((r) => r.json()),
      ]);

      setAllData(list || []);

      setDropdowns({
        periods: dropRes.periods || [],
        departments: dropRes.departments || [],
        locations: dropRes.locations || [
          "AJC Office",
          "Client City Office",
          "Client Factory",
          "Any Other Place",
          "Leave",
          "Sunday",
          "Holiday",
        ],
        masterData: dropRes.masterData || [],
      });
    } catch (err) {
      console.error("Error loading employee daily working data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadEmployeeData();
  }, []);

  // Filter ONLY this employee's records
  const myRecords = useMemo(() => {
    if (!normalizedCurrentEmp) return [];

    return allData
      .filter((entry) => {
        if (!entry) return false;
        const doer = normalizeName(entry.doerName || entry.employeeName || "");
        if (!doer) return false;
        return (
          doer === normalizedCurrentEmp ||
          doer.includes(normalizedCurrentEmp) ||
          normalizedCurrentEmp.includes(doer)
        );
      })
      .map((entry) => ({
        ...entry,
        formattedDate: formatExcelOrStringDate(entry.date),
      }))
      .sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      });
  }, [allData, normalizedCurrentEmp]);

  // Extract missing dates strictly for this employee
  const myMissingDates = useMemo(() => {
    const datesSet = new Set();
    myRecords.forEach((entry) => {
      if (entry.missingDate) {
        const dates = parseMissingDates(entry.missingDate);
        dates.forEach((d) => datesSet.add(d));
      }
    });
    return Array.from(datesSet);
  }, [myRecords]);

  // Stats for this employee
  const myStats = useMemo(() => {
    const totalEntries = myRecords.length;

    // Check today submission
    const todayFormatted = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const todaySubmissions = myRecords.filter((r) => r.formattedDate === todayFormatted);
    const submittedToday = todaySubmissions.length > 0;

    const latest = myRecords[0];
    const lastUpdateDate = latest ? latest.formattedDate : "--";

    return {
      totalEntries,
      submittedToday,
      todayCount: todaySubmissions.length,
      lastUpdateDate,
      missingCount: myMissingDates.length,
    };
  }, [myRecords, myMissingDates]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return myRecords;
    const q = historySearch.toLowerCase();
    return myRecords.filter((r) => {
      return (
        (r.formattedDate || "").toLowerCase().includes(q) ||
        (r.companyName || "").toLowerCase().includes(q) ||
        (r.groupName || "").toLowerCase().includes(q) ||
        (r.department || "").toLowerCase().includes(q) ||
        (r.taskDescription || "").toLowerCase().includes(q) ||
        (r.period || "").toLowerCase().includes(q)
      );
    });
  }, [myRecords, historySearch]);

  // Cascading options for Row
  const getGroupsForDepartment = (dept) => {
    if (!dept) return [];
    const groups = dropdowns.masterData
      .filter((m) => m.department === dept && m.groupName)
      .map((m) => m.groupName);
    return Array.from(new Set(groups)).sort();
  };

  const getCompaniesForGroup = (dept, group) => {
    if (!dept || !group) return [];
    const companies = dropdowns.masterData
      .filter((m) => m.department === dept && m.groupName === group && m.companyName)
      .map((m) => m.companyName);
    return Array.from(new Set(companies)).sort();
  };

  // Form Row handlers
  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;

    if (field === "department") {
      updated[index].groupName = "";
      updated[index].companyName = "";
    }
    if (field === "groupName") {
      updated[index].companyName = "";
    }

    setRows(updated);
  };

  const addRow = () => {
    setRows([
      ...rows,
      {
        period: rows[rows.length - 1]?.period || "",
        department: "",
        groupName: "",
        companyName: "",
        taskDescription: "",
        timeGiven: "",
      },
    ]);
  };

  const removeRow = (index) => {
    if (rows.length === 1) return;
    const updated = [...rows];
    updated.splice(index, 1);
    setRows(updated);
  };

  // Submit Daily Work
  const handleSubmitWork = async (e) => {
    e.preventDefault();

    // Validation
    if (!formDate) {
      alert("Please select a date for daily working.");
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.period || !r.department || !r.taskDescription) {
        alert(`Please fill Period, Department and Task Description for row #${i + 1}.`);
        return;
      }
    }

    // Format date as DD/MM/YYYY for Google Script
    const parts = formDate.split("-");
    const formattedDateForSheet = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : formDate;

    setSubmitting(true);

    try {
      for (const row of rows) {
        const payload = {
          date: formattedDateForSheet,
          doerName: rawEmpName,
          location: formLocation,
          period: row.period,
          department: row.department,
          groupName: row.groupName || row.companyName || "General",
          companyName: row.companyName || row.groupName || "General",
          taskDescription: row.taskDescription,
          timeGiven: row.timeGiven || "01:00",
        };

        await fetch(RESPONSE_API, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      alert("🎉 Your Daily Working entries have been submitted successfully!");

      // Reset rows
      setRows([
        {
          period: "",
          department: "",
          groupName: "",
          companyName: "",
          taskDescription: "",
          timeGiven: "",
        },
      ]);

      // Reload fresh data
      loadEmployeeData(true);
    } catch (err) {
      console.error("Submission error:", err);
      alert("Submission encountered an issue. Please try again or check your network.");
    } finally {
      setSubmitting(false);
    }
  };

  // Export this employee's records to Excel
  const handleExportMyExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Agrawal Jain & Co.";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`${rawEmpName} - Daily Working`, {
      views: [{ showGridLines: true }],
    });

    sheet.addRow(["AGRAWAL JAIN & CO."]);
    sheet.addRow([`EMPLOYEE DAILY WORKING REPORT: ${rawEmpName.toUpperCase()}`]);
    sheet.addRow([`Generated on: ${new Date().toLocaleString("en-IN")}`]);
    sheet.addRow([]);

    sheet.getRow(1).font = { name: "Arial", size: 16, bold: true, color: { argb: "065F46" } };
    sheet.getRow(2).font = { name: "Arial", size: 12, bold: true, color: { argb: "1E293B" } };
    sheet.getRow(3).font = { name: "Arial", size: 10, italic: true, color: { argb: "64748B" } };

    const headers = [
      "Sr No",
      "Date",
      "Period",
      "Location",
      "Department",
      "Group Name",
      "Company Name",
      "Task Description",
      "Time Given",
    ];

    const hRow = sheet.addRow(headers);
    hRow.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFF" } };
    hRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "059669" },
    };
    hRow.height = 28;

    myRecords.forEach((item, idx) => {
      sheet.addRow([
        idx + 1,
        item.formattedDate || item.date,
        item.period || "-",
        item.location || "-",
        item.department || "-",
        item.groupName || "-",
        item.companyName || "-",
        item.taskDescription || "-",
        item.timeGiven || "-",
      ]);
    });

    sheet.columns = [
      { width: 8 },
      { width: 14 },
      { width: 18 },
      { width: 16 },
      { width: 18 },
      { width: 22 },
      { width: 26 },
      { width: 45 },
      { width: 14 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `${rawEmpName.replace(/\s+/g, "_")}_Daily_Working.xlsx`);
  };

  // Export to PDF
  const handleExportMyPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.setTextColor(6, 95, 70);
    doc.text(`Daily Working Report - ${rawEmpName}`, 14, 15);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Agrawal Jain & Co. • Generated: ${new Date().toLocaleDateString("en-IN")}`, 14, 22);

    const bodyData = myRecords.map((r, i) => [
      i + 1,
      r.formattedDate || r.date,
      r.period || "-",
      r.department || "-",
      r.companyName || r.groupName || "-",
      r.taskDescription || "-",
      r.timeGiven || "-",
    ]);

    autoTable(doc, {
      startY: 28,
      head: [["#", "Date", "Period", "Department", "Company", "Task Description", "Time"]],
      body: bodyData,
      theme: "striped",
      headStyles: {
        fillColor: [5, 150, 105],
        textColor: 255,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
    });

    doc.save(`${rawEmpName.replace(/\s+/g, "_")}_Daily_Working.pdf`);
  };

  const initials = rawEmpName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="edw-page">
      {/* TOP NAVIGATION */}
      <div className="edw-top-bar">
        <button className="edw-back-btn" onClick={() => navigate(-1)}>
          <span>←</span> Back to My Dashboard
        </button>

        <div className="edw-privacy-pill">
          <span className="lock-icon">🔒</span>
          Private Portal: Showing Only {rawEmpName}'s Records
        </div>
      </div>

      {/* HERO HEADER */}
      <div className="edw-header-card">
        <div className="edw-header-left">
          <div className="edw-avatar-large">{initials}</div>
          <div className="edw-header-info">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h1 style={{ margin: 0 }}>{rawEmpName}'s Daily Working</h1>
              {empCategory && (
                <span
                  className="edw-badge-tag"
                  style={{
                    textTransform: "capitalize",
                    background: empCategory.color ? `${empCategory.color}18` : "#d1fae5",
                    color: empCategory.color || "#065f46",
                    border: `1px solid ${empCategory.color ? `${empCategory.color}50` : "#6ee7b7"}`,
                    fontWeight: 700,
                  }}
                >
                  {empCategory.icon ? `${empCategory.icon} ` : ""}{empCategory.label || empCategory.shortLabel || "Staff"}
                </span>
              )}
            </div>
            <p>
              Log your daily assignments, clear pending dates, and review your complete work history.
              Entries submitted here are private to your profile.
            </p>
          </div>
        </div>

        <div className="edw-header-actions">
          <button
            className={`edw-action-btn edw-btn-refresh ${refreshing ? "spinning" : ""}`}
            onClick={() => loadEmployeeData(true)}
          >
            <span className="spin-icon">🔄</span> {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button className="edw-action-btn edw-btn-export" onClick={handleExportMyExcel}>
            <span>📊</span> Export Excel
          </button>

          <button className="edw-action-btn edw-btn-export" onClick={handleExportMyPDF}>
            <span>📄</span> PDF Report
          </button>

          <a href="#add-work-section" className="edw-action-btn edw-btn-primary">
            <span>➕</span> Add Daily Work
          </a>
        </div>
      </div>

      {/* STATS SUMMARY GRID */}
      <div className="edw-stats-grid">
        <div className="edw-stat-card blue">
          <div className="edw-stat-info">
            <h4>Total Entries Logged</h4>
            <div className="edw-stat-number">{loading ? "..." : myStats.totalEntries}</div>
            <p className="edw-stat-subtext">All-time submissions</p>
          </div>
          <div className="edw-stat-icon">📋</div>
        </div>

        <div className="edw-stat-card emerald">
          <div className="edw-stat-info">
            <h4>Today's Work Status</h4>
            <div className="edw-stat-number" style={{ fontSize: "20px" }}>
              {loading ? "..." : myStats.submittedToday ? "✅ Done" : "⏳ Pending"}
            </div>
            <p className="edw-stat-subtext">
              {myStats.submittedToday
                ? `${myStats.todayCount} tasks logged today`
                : "Not yet submitted for today"}
            </p>
          </div>
          <div className="edw-stat-icon">🕒</div>
        </div>

        <div className="edw-stat-card purple">
          <div className="edw-stat-info">
            <h4>Last Updated Date</h4>
            <div className="edw-stat-number" style={{ fontSize: "22px" }}>
              {loading ? "..." : myStats.lastUpdateDate}
            </div>
            <p className="edw-stat-subtext">Most recent submission date</p>
          </div>
          <div className="edw-stat-icon">📅</div>
        </div>

        <div className={`edw-stat-card ${myStats.missingCount > 0 ? "rose" : "amber"}`}>
          <div className="edw-stat-info">
            <h4>Pending Dates Backlog</h4>
            <div className="edw-stat-number">{loading ? "..." : myStats.missingCount}</div>
            <p className="edw-stat-subtext">
              {myStats.missingCount > 0 ? "Action required to clear backlog" : "100% Up to date"}
            </p>
          </div>
          <div className="edw-stat-icon">⚠️</div>
        </div>
      </div>

      {/* MISSING DATES BANNER */}
      {myMissingDates.length > 0 && (
        <div className="edw-missing-banner">
          <div className="edw-missing-banner-header">
            <h3>
              <span>⚠️</span> Unsubmitted / Missing Dates ({myMissingDates.length})
            </h3>
            <span style={{ fontSize: "12px", color: "#9f1239" }}>
              Click any date to prefill and submit work for that day:
            </span>
          </div>

          <div className="edw-missing-chips-group">
            {myMissingDates.map((dateStr, i) => {
              // Convert DD/MM/YYYY to YYYY-MM-DD for input
              const parts = dateStr.split("/");
              const yyyyMmDd =
                parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;

              return (
                <button
                  key={i}
                  type="button"
                  className="edw-missing-date-btn"
                  onClick={() => {
                    setFormDate(yyyyMmDd);
                    const el = document.getElementById("add-work-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  title="Click to fill work for this date"
                >
                  <span>📅</span> {dateStr}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION: ADD DAILY WORK */}
      <div id="add-work-section" className="edw-form-section">
        <div className="edw-section-title">
          <div>
            <h2>
              <span>📝</span> Add Daily Work Entry
            </h2>
            <p>
              Submit your work log. Your name is locked so entries are submitted securely to your profile.
            </p>
          </div>

          <button
            type="button"
            className="edw-btn-add-row"
            onClick={addRow}
          >
            <span>➕</span> Add Another Task Row
          </button>
        </div>

        <form onSubmit={handleSubmitWork}>
          {/* COMMON METADATA */}
          <div className="edw-form-meta-grid">
            {/* DATE */}
            <div className="edw-form-group">
              <label>
                <span>📅</span> Working Date *
              </label>
              <input
                type="date"
                className="edw-input"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>

            {/* DOER NAME (LOCKED) */}
            <div className="edw-form-group">
              <label>
                <span>👤</span> Employee Name (Locked)
              </label>
              <input
                type="text"
                className="edw-input locked"
                value={rawEmpName}
                readOnly
                title="Employee name is fixed to your account."
              />
            </div>

            {/* LOCATION */}
            <div className="edw-form-group">
              <label>
                <span>📍</span> Location *
              </label>
              <select
                className="edw-select"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                required
              >
                {dropdowns.locations.map((loc, i) => (
                  <option key={i} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* TASKS TABLE */}
          <div className="edw-tasks-table-wrapper">
            <table className="edw-tasks-table">
              <thead>
                <tr>
                  <th style={{ width: "16%" }}>Period *</th>
                  <th style={{ width: "18%" }}>Department *</th>
                  <th style={{ width: "18%" }}>Group / Client</th>
                  <th style={{ width: "20%" }}>Company Name</th>
                  <th style={{ width: "28%" }}>Task Description *</th>
                  <th style={{ width: "12%" }}>Time Given</th>
                  <th style={{ width: "5%" }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const groups = getGroupsForDepartment(row.department);
                  const companies = getCompaniesForGroup(row.department, row.groupName);

                  return (
                    <tr key={index}>
                      {/* PERIOD */}
                      <td>
                        <select
                          className="edw-table-select"
                          value={row.period}
                          onChange={(e) => handleRowChange(index, "period", e.target.value)}
                          required
                        >
                          <option value="">Select Period</option>
                          {dropdowns.periods.map((p, pi) => (
                            <option key={pi} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* DEPARTMENT */}
                      <td>
                        <select
                          className="edw-table-select"
                          value={row.department}
                          onChange={(e) => handleRowChange(index, "department", e.target.value)}
                          required
                        >
                          <option value="">Select Dept</option>
                          {dropdowns.departments.map((d, di) => (
                            <option key={di} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* GROUP NAME */}
                      <td>
                        {groups.length > 0 ? (
                          <select
                            className="edw-table-select"
                            value={row.groupName}
                            onChange={(e) => handleRowChange(index, "groupName", e.target.value)}
                          >
                            <option value="">Select Group</option>
                            {groups.map((g, gi) => (
                              <option key={gi} value={g}>
                                {g}
                              </option>
                            ))}
                            <option value="Other">Other</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="edw-table-input"
                            placeholder="Enter group"
                            value={row.groupName}
                            onChange={(e) => handleRowChange(index, "groupName", e.target.value)}
                          />
                        )}
                      </td>

                      {/* COMPANY NAME */}
                      <td>
                        {companies.length > 0 ? (
                          <select
                            className="edw-table-select"
                            value={row.companyName}
                            onChange={(e) => handleRowChange(index, "companyName", e.target.value)}
                          >
                            <option value="">Select Company</option>
                            {companies.map((c, ci) => (
                              <option key={ci} value={c}>
                                {c}
                              </option>
                            ))}
                            <option value="Other">Other</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="edw-table-input"
                            placeholder="Enter company"
                            value={row.companyName}
                            onChange={(e) => handleRowChange(index, "companyName", e.target.value)}
                          />
                        )}
                      </td>

                      {/* TASK DESCRIPTION */}
                      <td>
                        <textarea
                          className="edw-table-textarea"
                          placeholder="What tasks did you work on?"
                          value={row.taskDescription}
                          onChange={(e) => handleRowChange(index, "taskDescription", e.target.value)}
                          required
                        />
                      </td>

                      {/* TIME GIVEN */}
                      <td>
                        <input
                          type="text"
                          className="edw-table-input"
                          placeholder="e.g. 03:30"
                          value={row.timeGiven}
                          onChange={(e) => handleRowChange(index, "timeGiven", e.target.value)}
                        />
                      </td>

                      {/* REMOVE BUTTON */}
                      <td style={{ textAlign: "center" }}>
                        {rows.length > 1 && (
                          <button
                            type="button"
                            className="edw-btn-delete-row"
                            onClick={() => removeRow(index)}
                            title="Delete this row"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ACTIONS BAR */}
          <div className="edw-form-actions-bar">
            <button
              type="button"
              className="edw-btn-add-row"
              onClick={addRow}
            >
              <span>➕</span> Add Another Task Row
            </button>

            <button
              type="submit"
              className="edw-btn-submit"
              disabled={submitting}
            >
              <span>{submitting ? "⏳" : "🚀"}</span>
              {submitting ? "Submitting Work Entries..." : `Submit ${rows.length} Work Entry`}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION: MY PAST DAILY WORKINGS TABLE */}
      <div className="edw-history-section">
        <div className="edw-section-title">
          <div>
            <h2>
              <span>📜</span> My Past Daily Workings ({myRecords.length})
            </h2>
            <p>
              Complete history of your submissions. Only your records are listed here.
            </p>
          </div>
        </div>

        {/* SEARCH CONTROLS */}
        <div className="edw-history-controls">
          <div className="edw-history-search">
            <span className="edw-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search your past tasks, company, group, or period..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button className="edw-action-btn edw-btn-export" onClick={handleExportMyExcel}>
              <span>📊</span> Download Excel
            </button>
          </div>
        </div>

        {/* HISTORY TABLE */}
        <div className="edw-history-table-container">
          <table className="edw-history-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Period</th>
                <th>Location</th>
                <th>Department</th>
                <th>Company / Client</th>
                <th>Task Description</th>
                <th>Time Given</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "40px" }}>
                    Loading your past daily working records...
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "40px", color: "var(--edw-text-muted)" }}>
                    No past working records found for {rawEmpName}. Use the form above to add your first daily work!
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item, idx) => (
                  <tr key={idx}>
                    <td className="mono-cell">{idx + 1}</td>
                    <td className="mono-cell" style={{ fontWeight: 700 }}>
                      {item.formattedDate || item.date}
                    </td>
                    <td>
                      <span className="edw-badge-tag">{item.period || "-"}</span>
                    </td>
                    <td>{item.location || "-"}</td>
                    <td>
                      <span className="edw-badge-tag">{item.department || "-"}</span>
                    </td>
                    <td style={{ fontWeight: 700, color: "#1e293b" }}>
                      {item.companyName || item.groupName || "-"}
                    </td>
                    <td style={{ maxWidth: 360, lineHeight: 1.4 }}>
                      {item.taskDescription || "-"}
                    </td>
                    <td className="mono-cell" style={{ fontWeight: 700 }}>
                      {item.timeGiven || "-"}
                    </td>
                    <td className="mono-cell" style={{ fontSize: "11px", color: "var(--edw-text-subtle)" }}>
                      {item.timestamp ? new Date(item.timestamp).toLocaleString("en-GB") : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
