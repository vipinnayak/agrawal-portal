import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DelegationDashboard.css";

function DelegationDashboard() {

  const [summary,setSummary] = useState({
    total:0,
    onTime:0,
    late:0,
  });


const navigate = useNavigate();
  useEffect(() => {

    // SUMMARY API
    fetch(
      "YOUR_SUMMARY_GOOGLE_SCRIPT_URL"
    )
      .then(res => res.json())
      .then(data => {

        setSummary(data);

      });

    // TABLE API
    fetch(
      "YOUR_DELEGATION_TABLE_SCRIPT_URL"
    )
      .then(res => res.json())
      .then(data => {

        // setDelegationData(data);

      });

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
      onClick={() => navigate("/view-delegation")}
    >
      View Delegation
    </button>

  </div>

</div>

      {/* SUMMARY */}

      <div className="summary-grid">

        {/* TOTAL */}

        <div className="summary-card blue">

          <h2>
            {summary.total}
          </h2>

          <span>
            Total Assigned Work
          </span>

        </div>

        {/* ON TIME */}

        <div className="summary-card green">

          <h2>
            {summary.onTime}%
          </h2>

          <span>
            Work Done On Time
          </span>

        </div>

        {/* LATE */}

        <div className="summary-card red">

          <h2>
            {summary.late}%
          </h2>

          <span>
            Work Not Done On Time
          </span>

        </div>

      </div>

      {/* TABLE */}

      {/* LOOKER STUDIO DASHBOARD */}

<div className="table-card">

  <div className="table-top">
    <h2>Delegation Dashboard Report</h2>
  </div>

  <iframe
    title="Delegation Dashboard"
    src="https://datastudio.google.com/embed/reporting/624c83c3-93cb-4fc6-af8f-fabc111f036e/page/VQveF"
    width="100%"
    height="900"
    frameBorder="0"
    style={{
      border: 0,
      borderRadius: "20px"
    }}
    allowFullScreen
  ></iframe>

</div>

    </div>

  );
}

export default DelegationDashboard;