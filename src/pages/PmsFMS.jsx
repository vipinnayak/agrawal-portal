import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./InternalAuditFMS.css";
import "./PmsFMS.css";
import {
  PMS_17_STEPS,
  fetchUnifiedPmsData,
  exportPmsFmsToExcel,
  exportPmsBlankActualStatusReportToExcel,
  getPmsApiConfig,
  savePmsApiConfig,
  resetPmsApiConfig,
  testPmsConnection,
  isPmsLiveApiConfigured,
  updateLocalPmsStep,
} from "../utils/pmsFmsService";

function StepCard({ step, data, canEdit, onEditClick }) {
  return (
    <div className="stepCard">
      <div className="stepHeader">{step.title.split(":")[0]}</div>
      <div className="stepBody">
        <div className="stepRow">
          <b>Owner</b>
          <span>{step.owner}</span>
        </div>
        <div className="stepRow">
          <b>Method</b>
          <span>{step.method}</span>
        </div>
        <div className="stepRow">
          <b>When</b>
          <span>{step.when}</span>
        </div>
        <div className="resultGrid">
          <div>
            <label>Planned</label>
            <p>{data.planned || "-"}</p>
          </div>
          <div>
            <label>Actual</label>
            <p>{data.rawActual || "-"}</p>
          </div>
          <div>
            <label>Status</label>
            <p>{data.rawStatus || data.status || "-"}</p>
          </div>
          <div>
            <label>Delay</label>
            <p>{data.delay || "-"}</p>
          </div>
        </div>
        {canEdit && (
          <button type="button" className="pms-step-edit-btn" onClick={() => onEditClick(step, data)}>
            ✏️ Update Step Progress
          </button>
        )}
      </div>
    </div>
  );
}

export default function PmsFMS() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDownloadingBlank, setIsDownloadingBlank] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // API Settings Modal state
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiForm, setApiForm] = useState(() => getPmsApiConfig());
  const [testingField, setTestingField] = useState("");
  const [testResult, setTestResult] = useState(null);

  // Local Step Edit Modal state
  const [editingStep, setEditingStep] = useState(null);
  const [stepPatch, setStepPatch] = useState({ planned: "", actual: "", status: "", delay: "" });

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const data = await fetchUnifiedPmsData(forceRefresh);
      setRecords(data || []);
      setSelectedIdx(0);
    } catch (err) {
      console.error("Error loading PMS FMS data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  const currentRecord = records[selectedIdx] || null;
  const liveConfigured = isPmsLiveApiConfigured();

  const handleDownloadBlankReport = async () => {
    setIsDownloadingBlank(true);
    try {
      await exportPmsBlankActualStatusReportToExcel(records);
    } catch (err) {
      console.error("Error exporting PMS blank actual & status report:", err);
      alert("Failed to export PMS Blank Actual & Status Report.");
    } finally {
      setIsDownloadingBlank(false);
    }
  };

  const handleDownloadAllReport = async () => {
    setIsDownloadingAll(true);
    try {
      await exportPmsFmsToExcel(records);
    } catch (err) {
      console.error("Error exporting PMS register:", err);
      alert("Failed to export PMS Register.");
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleTestEndpoint = async (fieldKey) => {
    setTestingField(fieldKey);
    setTestResult(null);
    const res = await testPmsConnection(apiForm[fieldKey]);
    setTestingField("");
    setTestResult({ fieldKey, ...res });
  };

  const handleSaveApiConfig = () => {
    savePmsApiConfig(apiForm);
    setShowApiModal(false);
    setTestResult(null);
    loadData(true);
  };

  const handleResetApiConfig = () => {
    const cleared = resetPmsApiConfig();
    setApiForm(cleared);
    setTestResult(null);
    loadData(true);
  };

  const openStepEditor = (step, data) => {
    setEditingStep(step);
    setStepPatch({
      planned: data.planned || "",
      actual: data.rawActual || "",
      status: data.rawStatus || "",
      delay: data.delay || "",
    });
  };

  const handleSaveStepUpdate = async (e) => {
    e.preventDefault();
    if (!currentRecord || !editingStep) return;
    updateLocalPmsStep(currentRecord.id, editingStep.stepNo, stepPatch);
    setEditingStep(null);
    await loadData(true);
  };

  return (
    <div className="fmsPage">
      <div className="fmsTop">
        <div className="pms-top-nav">
          <div className="pms-title-row">
            <h1>PMS</h1>
            <span className={`pms-source-badge ${liveConfigured ? "live" : "local"}`}>
              {liveConfigured ? "🟢 Live Google Sheet Connected" : "🗂️ Portal Mode (Configure API Anytime)"}
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button type="button" className="pms-back-btn" onClick={() => navigate("/admin-md")}>
              ← Back to MD Dashboard
            </button>
            <button
              type="button"
              className="pms-config-btn"
              onClick={() => {
                setApiForm(getPmsApiConfig());
                setTestResult(null);
                setShowApiModal(true);
              }}
            >
              ⚙️ API Config
            </button>
          </div>
        </div>

        <div className="header-buttons" style={{ flexWrap: "wrap" }}>
          <button className="header-btn fms-btn" onClick={() => navigate("/pmsdetails")}>
            📊 View PMS Details
          </button>

          <button className="header-btn form-btn" onClick={() => navigate("/pmsform")}>
            📝 PMS Form
          </button>

          <button
            className="header-btn download-blank-btn"
            onClick={handleDownloadBlankReport}
            disabled={isDownloadingBlank}
            title="Download report of employees who have actual and status field both blank in PMS"
          >
            {isDownloadingBlank ? "⏳ Generating..." : "📥 Blank Actual & Status Report"}
          </button>

          <button
            className="header-btn pms-export-register-btn"
            onClick={handleDownloadAllReport}
            disabled={isDownloadingAll}
            title="Download complete PMS FMS Register (.xlsx)"
          >
            {isDownloadingAll ? "⏳ Exporting..." : "📑 Export PMS Register"}
          </button>
        </div>

        <p>Agrawal Jain &amp; Co. — PMS Flow Management System (FMS)</p>
      </div>

      {!loading && records.length === 0 && (
        <div className="pms-setup-banner">
          <div>
            <h4>No PMS Records Loaded Yet</h4>
            <p>
              Connect your live PMS Google Sheet Apps Script URLs using <strong>⚙️ API Config</strong>, or submit your first PMS engagement via <strong>📝 PMS Form</strong>.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button type="button" className="pms-btn-secondary" onClick={() => navigate("/pmsform")}>
              📝 Open PMS Form
            </button>
            <button
              type="button"
              className="pms-btn-primary"
              onClick={() => {
                setApiForm(getPmsApiConfig());
                setShowApiModal(true);
              }}
            >
              ⚙️ Connect Sheet API
            </button>
          </div>
        </div>
      )}

      {records.length > 0 && (
        <div className="pms-selector-row">
          <select
            className="auditSelect"
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
          >
            {records.map((rec, index) => (
              <option key={rec.id || index} value={index}>
                {rec.id} — {rec.companyName} ({rec.pmsPeriod})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="masterSection">
        <div className="masterGrid">
          <div>
            <label>UI</label>
            <p>{currentRecord?.id || "-"}</p>
          </div>
          <div>
            <label>Time Stamp</label>
            <p>{currentRecord?.timestamp ? new Date(currentRecord.timestamp).toLocaleDateString("en-IN") : "-"}</p>
          </div>
          <div>
            <label>Group Name</label>
            <p>{currentRecord?.groupName || "-"}</p>
          </div>
          <div>
            <label>Company Name</label>
            <p>{currentRecord?.companyName || "-"}</p>
          </div>
          <div>
            <label>Department</label>
            <p>{currentRecord?.department || "-"}</p>
          </div>
          <div>
            <label>PMS Period</label>
            <p>{currentRecord?.pmsPeriod || "-"}</p>
          </div>
          <div>
            <label>Partner</label>
            <p>{currentRecord?.partner || "-"}</p>
          </div>
          <div>
            <label>Senior</label>
            <p>{currentRecord?.senior || "-"}</p>
          </div>
          <div>
            <label>Assignment Type</label>
            <p>{currentRecord?.assignmentType || "-"}</p>
          </div>
          <div>
            <label>Start Date</label>
            <p>{currentRecord?.startDate || "-"}</p>
          </div>
          <div>
            <label>Target Date</label>
            <p>{currentRecord?.targetDate || "-"}</p>
          </div>
        </div>
      </div>

      <div className="stepsWrapper">
        {PMS_17_STEPS.map((step) => {
          const stepData =
            currentRecord?.steps?.find((s) => s.stepNo === step.stepNo) || {
              planned: "",
              rawActual: "",
              rawStatus: "",
              status: "",
              delay: "",
            };
          return (
            <StepCard
              key={step.stepNo}
              step={step}
              data={stepData}
              canEdit={Boolean(currentRecord && currentRecord.source === "Local Portal")}
              onEditClick={openStepEditor}
            />
          );
        })}
      </div>

      {/* API CONFIGURATION MODAL */}
      {showApiModal && (
        <div className="pms-modal-overlay" onClick={() => setShowApiModal(false)}>
          <div className="pms-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pms-modal-header">
              <div>
                <h2>PMS Google Sheet &amp; Apps Script Integration</h2>
                <p>Connect your live PMS FMS endpoints (mirrors Internal Audit FMS structure)</p>
              </div>
              <button type="button" className="pms-modal-close" onClick={() => setShowApiModal(false)}>
                ✕
              </button>
            </div>

            <div className="pms-modal-body">
              {[
                { key: "fmsApi", label: "PMS FMS 17-Step Tracking API URL (Main Sheet):" },
                { key: "masterApi", label: "PMS Master Dropdowns API URL (Groups / Companies / Owners):" },
                { key: "detailsApi", label: "PMS Submitted Details Table API URL:" },
                { key: "formSubmitApi", label: "PMS Form Submit Web App URL (POST endpoint):" },
              ].map((cfg) => (
                <div key={cfg.key} className="pms-field-group">
                  <label>{cfg.label}</label>
                  <div className="pms-input-row">
                    <input
                      type="url"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={apiForm[cfg.key]}
                      onChange={(e) => setApiForm({ ...apiForm, [cfg.key]: e.target.value })}
                    />
                    {cfg.key !== "formSubmitApi" && (
                      <button
                        type="button"
                        className="pms-test-btn"
                        disabled={!apiForm[cfg.key]?.trim() || testingField === cfg.key}
                        onClick={() => handleTestEndpoint(cfg.key)}
                      >
                        {testingField === cfg.key ? "Testing..." : "⚡ Test"}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {testResult && (
                <div className={`pms-test-alert ${testResult.success ? "ok" : "err"}`}>
                  {testResult.success ? (
                    <span>
                      ✅ <strong>Connected!</strong> Found <strong>{testResult.rowCount}</strong> rows from sheet.
                    </span>
                  ) : (
                    <span>
                      ❌ <strong>Connection Failed:</strong> {testResult.error}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="pms-modal-footer">
              <button type="button" className="pms-btn-secondary" onClick={handleResetApiConfig}>
                Reset URLs
              </button>
              <button type="button" className="pms-btn-primary" onClick={handleSaveApiConfig}>
                💾 Save &amp; Reload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOCAL STEP UPDATE MODAL */}
      {editingStep && (
        <div className="pms-modal-overlay" onClick={() => setEditingStep(null)}>
          <div className="pms-modal-card" style={{ width: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="pms-modal-header">
              <div>
                <h2>{editingStep.title}</h2>
                <p>Owner: {editingStep.owner} • {editingStep.when}</p>
              </div>
              <button type="button" className="pms-modal-close" onClick={() => setEditingStep(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStepUpdate}>
              <div className="pms-modal-body">
                <div className="pms-field-group">
                  <label>Planned Date</label>
                  <input
                    type="date"
                    value={stepPatch.planned}
                    onChange={(e) => setStepPatch({ ...stepPatch, planned: e.target.value })}
                  />
                </div>
                <div className="pms-field-group">
                  <label>Actual Date</label>
                  <input
                    type="date"
                    value={stepPatch.actual}
                    onChange={(e) => setStepPatch({ ...stepPatch, actual: e.target.value })}
                  />
                </div>
                <div className="pms-field-group">
                  <label>Status</label>
                  <select
                    value={stepPatch.status}
                    onChange={(e) => setStepPatch({ ...stepPatch, status: e.target.value })}
                  >
                    <option value="">(Blank)</option>
                    <option value="Done">Done</option>
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending">Pending</option>
                    <option value="Delayed">Delayed</option>
                  </select>
                </div>
                <div className="pms-field-group">
                  <label>Delay (Days / Note)</label>
                  <input
                    type="text"
                    placeholder="e.g. 0 days or On Time"
                    value={stepPatch.delay}
                    onChange={(e) => setStepPatch({ ...stepPatch, delay: e.target.value })}
                  />
                </div>
              </div>
              <div className="pms-modal-footer">
                <button type="button" className="pms-btn-secondary" onClick={() => setEditingStep(null)}>
                  Cancel
                </button>
                <button type="submit" className="pms-btn-primary">
                  💾 Save Step Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

