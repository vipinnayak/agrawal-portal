import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./InternalAuditForm.css";
import {
  fetchPmsMasterList,
  getPmsApiConfig,
  addLocalPmsRecord,
  invalidatePmsCache,
} from "../utils/pmsFmsService";
import { PARTNERS_LIST, SENIORS_LIST } from "../utils/attendanceConfig";

const DEFAULT_PERIOD_OPTIONS = [
  "Q1-Apr To Jun",
  "Q2-Jul To Sep",
  "Q3-Oct To Dec",
  "Q4-Jan To Mar",
  "FY 2026-27",
  "Monthly",
];

const DEFAULT_TYPE_OPTIONS = ["City", "Plant", "Office", "Other"];

export default function PmsForm() {
  const navigate = useNavigate();
  const [masterData, setMasterData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    groupName: "",
    companyName: "",
    department: "PMS",
    pmsPeriod: "",
    partner: "",
    senior: "",
    assignmentType: "City",
    startDate: "",
    targetDate: "",
  });

  useEffect(() => {
    fetchPmsMasterList()
      .then((rows) => setMasterData(rows || []))
      .catch((err) => console.warn("PMS master list fetch error:", err));
  }, []);

  const options = useMemo(() => {
    const extract = (idx, fallback = []) => {
      const fromMaster = masterData
        .map((r) => (Array.isArray(r) ? r[idx] : null))
        .filter((v) => v && String(v).trim() !== "")
        .map((v) => String(v).trim());
      return [...new Set([...fromMaster, ...fallback])];
    };

    return {
      groups: extract(0),
      companies: extract(1),
      periods: extract(3, DEFAULT_PERIOD_OPTIONS),
      partners: extract(4, PARTNERS_LIST.map((p) => p.name)),
      seniors: extract(5, SENIORS_LIST.map((s) => s.name)),
      types: extract(6, DEFAULT_TYPE_OPTIONS),
    };
  }, [masterData]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { formSubmitApi } = getPmsApiConfig();

    try {
      if (formSubmitApi) {
        await fetch(formSubmitApi, {
          method: "POST",
          mode: "no-cors",
          body: JSON.stringify(form),
        });
        invalidatePmsCache();
        alert("✅ PMS Assignment Submitted to Google Sheet!");
      } else {
        addLocalPmsRecord(form);
        alert("✅ PMS Assignment Saved Successfully in Portal!");
      }

      setForm({
        groupName: "",
        companyName: "",
        department: "PMS",
        pmsPeriod: "",
        partner: "",
        senior: "",
        assignmentType: "City",
        startDate: "",
        targetDate: "",
      });
    } catch (error) {
      console.error("PMS form submission error:", error);
      alert("❌ Error Saving PMS Data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="audit-page">
      <div className="glass-form">
        <div style={{ marginBottom: "18px" }}>
          <button
            type="button"
            onClick={() => navigate("/pms-fms")}
            style={{
              border: "none",
              background: "#e2e8f0",
              color: "#0f172a",
              padding: "8px 16px",
              borderRadius: "10px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ← Back to PMS
          </button>
        </div>

        <h1>PMS Form</h1>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Group Name</label>
            <input
              type="text"
              name="groupName"
              list="pms-groups-list"
              placeholder="Enter or select Group Name"
              value={form.groupName}
              onChange={handleChange}
              required
            />
            <datalist id="pms-groups-list">
              {options.groups.map((item, idx) => (
                <option key={idx} value={item} />
              ))}
            </datalist>
          </div>

          <div className="form-group">
            <label>Company Name</label>
            <input
              type="text"
              name="companyName"
              list="pms-companies-list"
              placeholder="Enter or select Company / Client Name"
              value={form.companyName}
              onChange={handleChange}
              required
            />
            <datalist id="pms-companies-list">
              {options.companies.map((item, idx) => (
                <option key={idx} value={item} />
              ))}
            </datalist>
          </div>

          <div className="form-group">
            <label>Department</label>
            <input
              type="text"
              name="department"
              placeholder="e.g. PMS, Internal Audit, Statutory"
              value={form.department}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>PMS Period</label>
            <input
              type="text"
              name="pmsPeriod"
              list="pms-periods-list"
              placeholder="Select or type Period (e.g. Q3-Oct To Dec)"
              value={form.pmsPeriod}
              onChange={handleChange}
              required
            />
            <datalist id="pms-periods-list">
              {options.periods.map((item, idx) => (
                <option key={idx} value={item} />
              ))}
            </datalist>
          </div>

          <div className="form-group">
            <label>Partner&apos;s Incharge</label>
            <select name="partner" value={form.partner} onChange={handleChange} required>
              <option value="">Select Partner</option>
              {options.partners.map((item, idx) => (
                <option key={idx} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Senior / Lead CA Involved</label>
            <select name="senior" value={form.senior} onChange={handleChange}>
              <option value="">Select Senior / Lead CA</option>
              {options.seniors.map((item, idx) => (
                <option key={idx} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Assignment Type</label>
            <select name="assignmentType" value={form.assignmentType} onChange={handleChange} required>
              <option value="">Select Assignment Type</option>
              {options.types.map((item, idx) => (
                <option key={idx} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Start Date</label>
            <input type="date" name="startDate" value={form.startDate} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label>Target Date</label>
            <input type="date" name="targetDate" value={form.targetDate} onChange={handleChange} required />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Saving..." : "Submit PMS Assignment"}
          </button>
        </form>
      </div>
    </div>
  );
}

