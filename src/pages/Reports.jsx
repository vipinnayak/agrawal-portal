import React from "react";
import { useNavigate } from "react-router-dom";
import "./Reports.css";

export default function Reports() {

  const navigate = useNavigate();

  const reports = [

    {
      title: "Attendance Report",
      desc: "View employee attendance reports",
      color: "#2563eb",
      icon: "📅",
      route: "/attendance-report",
    },

    {
      title: "Leave Report",
      desc: "View employee leave history",
      color: "#dc2626",
      icon: "📝",
      route: "/leave-report",
    },

    {
      title: "Performance Report",
      desc: "Monthly performance summary",
      color: "#7c3aed",
      icon: "📈",
      route: "/performance-report",
    }

  ];

  return (

    <div className="reports-page">

      <div className="reports-header">

        <button
          className="back-btn"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>

        <h1>
          Reports
        </h1>

        <p>
          Select any report to view details.
        </p>

      </div>

      <div className="report-grid">

        {reports.map((item, index) => (

          <div
            key={index}
            className="report-card"
            style={{
              background: item.color
            }}
          >

            <div className="icon">

              {item.icon}

            </div>

            <h2>

              {item.title}

            </h2>

            <p>

              {item.desc}

            </p>

            <button
              onClick={() => navigate(item.route)}
            >
              View Report
            </button>

          </div>

        ))}

      </div>

    </div>

  );

}