import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./da.css";

function DailyAttendanceChandan() {
  const navigate = useNavigate();

  const [attendanceData, setAttendanceData] = useState([]);

  useEffect(() => {
    fetch(
      "https://script.google.com/macros/s/AKfycbyzGR2R5ZThXsOTc8og8qMN9ryOq6XQuvCQpgGVRYuPsv6ou7C47PTLQsqER53cHOSXrA/exec"
    )
      .then((res) => res.json())
      .then((data) => {
        console.log(data);
        setAttendanceData(data.data || []);
      })
      .catch((err) => console.log(err));
  }, []);

  const pendingAttendance = attendanceData
    .map((item) => item["Pending Attendance"])
    .filter(Boolean);

  const leaveData = attendanceData
    .map((item) => item["Leave"])
    .filter(Boolean);

  const halfDayData = attendanceData
    .map((item) => item["Half Day"])
    .filter(Boolean);

  const lateDaysData = attendanceData
    .map((item) => item["Late Days"])
    .filter(Boolean);

  return (
    <div className="dw-page">

      <div className="dw-header">

        <div>
          <h1>Daily Attendance</h1>
          <p>Agrawal Jain & Co.</p>
        </div>

        <button
          className="dw-attendance-btn"
          onClick={() => navigate("/attendance-form")}
        >
          Mark Attendance
        </button>

      </div>

      <div className="dw-four-grid">

        {/* Pending Attendance */}

        <div className="dw-stat-card dw-blue">

          <div className="dw-card-scroll">

           {pendingAttendance.length > 0 ? (
  pendingAttendance.map((item, index) => {
    let value = item;

    // Excel serial number
    if (!isNaN(item) && item !== "") {
      value = new Date((Number(item) - 25569) * 86400 * 1000)
        .toLocaleDateString("en-GB");
    }

    // Date string
    else if (!isNaN(Date.parse(item))) {
      value = new Date(item).toLocaleDateString("en-GB");
    }

    // Text (No Pending Attendance)
    else {
      value = item;
    }

    return (
      <div key={index} className="dw-scroll-item">
        {value}
      </div>
    );
  })
) : (
  <div className="dw-scroll-item">No Pending Attendance</div>
)}
          </div>

          <p>Pending Attendance</p>

        </div>

        {/* Leave */}

        <div className="dw-stat-card dw-purple">

          <div className="dw-card-center">

            <h2 className="dw-big-number">
              {leaveData.length > 0 ? leaveData[0] : 0}
            </h2>

          </div>

          <p>Leave</p>

        </div>

        {/* Half Day */}

        <div className="dw-stat-card dw-orange">

          <div className="dw-card-center">

            <h2 className="dw-big-number">
              {halfDayData.length > 0 ? halfDayData[0] : 0}
            </h2>

          </div>

          <p>Half Day</p>

        </div>

        {/* Late Days */}

        <div className="dw-stat-card dw-red">

          <div className="dw-card-center">

            <h2 className="dw-big-number">
              {lateDaysData.length > 0 ? lateDaysData[0] : 0}
            </h2>

          </div>

          <p>Late Days</p>

        </div>

      </div>

    </div>
  );
}

export default DailyAttendanceChandan;