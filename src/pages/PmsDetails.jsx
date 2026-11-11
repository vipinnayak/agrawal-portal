import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./InternalAuditFMS.css";
import "./InternalAuditDetails.css";
import { fetchUnifiedPmsData, exportPmsFmsToExcel } from "../utils/pmsFmsService";

export default function PmsDetails() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError("");
    try {
      const records = await fetchUnifiedPmsData(forceRefresh);
      setData(records);
      setFilteredData(records);
    } catch (err) {
      console.error("PMS details load error:", err);
      setError("Failed to Load PMS Data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    const filtered = data.filter((item) =>
      [
        item.id,
        item.groupName,
        item.companyName,
        item.department,
        item.pmsPeriod,
        item.partner,
        item.senior,
        item.assignmentType,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
    setFilteredData(filtered);
  }, [search, data]);

  const formatDate = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-IN");
  };

  return (
    <div className="details-page">
      <div className="details-header" style={{ flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <button
            className="refresh-btn"
            style={{ background: "#ffffff", color: "#0f172a", boxShadow: "0 3px 10px rgba(0,0,0,0.08)" }}
            onClick={() => navigate("/pms-fms")}
          >
            ← Back to PMS
          </button>
          <h1 style={{ marginBottom: 0 }}>PMS Details</h1>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            className="refresh-btn"
            style={{ background: "#059669" }}
            onClick={() => exportPmsFmsToExcel(filteredData)}
          >
            📥 Export Excel
          </button>
          <button className="refresh-btn" onClick={() => loadData(true)}>
            Refresh
          </button>
        </div>
      </div>

      <div className="top-bar">
        <input
          type="text"
          placeholder="Search Group, Company, Partner, Period..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-box"
        />

        <div className="record-count">Total Records : {filteredData.length}</div>
      </div>

      {loading && <div className="loading">Loading Data...</div>}

      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Group Name</th>
                <th>Company Name</th>
                <th>Department</th>
                <th>PMS Period</th>
                <th>Partner</th>
                <th>Senior / CA</th>
                <th>Assignment Type</th>
                <th>Start Date</th>
                <th>Target Date</th>
              </tr>
            </thead>

            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                    No PMS records found. Click &quot;← Back to PMS&quot; to connect your Google Sheet API or create an entry via PMS Form.
                  </td>
                </tr>
              ) : (
                filteredData.map((row, index) => (
                  <tr key={row.id || index}>
                    <td>{formatDate(row.timestamp)}</td>
                    <td>{row.groupName || "-"}</td>
                    <td>{row.companyName || "-"}</td>
                    <td>{row.department || "-"}</td>
                    <td>{row.pmsPeriod || "-"}</td>
                    <td>{row.partner || "-"}</td>
                    <td>{row.senior || "-"}</td>
                    <td>{row.assignmentType || "-"}</td>
                    <td>{formatDate(row.startDate)}</td>
                    <td>{formatDate(row.targetDate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

