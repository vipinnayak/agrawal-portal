import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../DelegationDashboard.css";

function CDChandanSingh() {

  const navigate = useNavigate();

  const [summary, setSummary] = useState({
    total: 0,
    onTime: 0,
    late: 0,
  });

  useEffect(() => {

    // Replace with your Summary API
    fetch("YOUR_SUMMARY_GOOGLE_SCRIPT_URL")
      .then(res => res.json())
      .then(data => setSummary(data))
      .catch(err => console.log(err));

  }, []);

  return (

    <div className="delegation-page">

      {/* HEADER */}

      <div className="delegation-header">

        <div>
          <h1>Delegation Dashboard</h1>
          <p>Agrawal Jain & Co.</p>
        </div>

        <div className="header-buttons">

          <button
            className="delegation-btn"
            onClick={() => navigate("/delegation-form")}
          >
            Open Delegation Form
          </button>

          <button
            className="view-btn"
            onClick={() =>
              window.open(
                "https://sites.google.com/view/ca-chandansingh/home",
                "_blank"
              )
            }
          >
            View Delegation
          </button>

        </div>

      </div>

      {/* SUMMARY */}

      <div className="summary-grid">

        <div className="summary-card blue">
          <h2>{summary.total}</h2>
          <span>Total Assigned Work</span>
        </div>

        <div className="summary-card green">
          <h2>{summary.onTime}%</h2>
          <span>Work Done On Time</span>
        </div>

        <div className="summary-card red">
          <h2>{summary.late}%</h2>
          <span>Work Not Done On Time</span>
        </div>

      </div>

    </div>

  );
}

export default CDChandanSingh;