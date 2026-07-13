import { useEffect, useState } from "react";
import "./MIS2Delegation.css";

const API =
  "https://script.google.com/macros/s/AKfycby1bW4c4oc8tq1tSsRpthupkIAA41pKIZ4HHVK_8tZhbx9SpwHa3gjqMntn0nReK-wO/exec";

const REPORT_URL =
  "https://datastudio.google.com/embed/reporting/3ef53718-b3e7-4946-92f5-87465983c630/page/WtleF";

export default function MIS2Delegation() {

  const [dashboard, setDashboard] = useState({
    TotalWork: 0,
    PendingWork: 0,
    ThisWeekWork: 0,
    WeeklyScore: 0,
    LastWeekScore: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API)
      .then((res) => res.json())
      .then((data) => {
        setDashboard(data);
        setLoading(false);
      })
      .catch((err) => {
        console.log(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="delegation-page">

      {/* Header */}

      <div className="delegation-header">

        <div>
          <h1>MIS2 Delegation</h1>

          <p>
            Manage delegated work and employee performance.
          </p>
        </div>

        <button
          className="mark-btn"
          onClick={() => window.open(REPORT_URL, "_blank")}
        >
          ➕ Mark Delegation
        </button>

      </div>

      {/* Dashboard */}

      <div className="dashboard-grid">

        {/* Total Work */}

        <div className="dash-card total">

          <div className="icon">📋</div>

          <h5>Total Work</h5>

          <h2>
            {loading ? "..." : dashboard.TotalWork}
          </h2>

        </div>

        {/* Pending */}

        <div className="dash-card pending">

          <div className="icon">⏳</div>

          <h5>Pending Work</h5>

          <h2>
            {loading ? "..." : dashboard.PendingWork}
          </h2>

        </div>

        {/* This Week */}

        <div className="dash-card week">

          <div className="icon">📅</div>

          <h5>This Week</h5>

          <h2>
            {loading ? "..." : dashboard.ThisWeekWork}
          </h2>

        </div>

        {/* Weekly Score */}

        <div className="dash-card score">

          <div className="icon">⭐</div>

          <h5>Weekly Score</h5>

          <h2>
            {loading ? "..." : `${dashboard.WeeklyScore}%`}
          </h2>

        </div>

        {/* Last Week */}

        <div className="dash-card lastscore">

          <div className="icon">🏆</div>

          <h5>Last Week Score</h5>

          <h2>
            {loading ? "..." : `${dashboard.LastWeekScore}%`}
          </h2>

        </div>

      </div>

    </div>
  );
}