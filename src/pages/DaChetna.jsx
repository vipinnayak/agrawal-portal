import React, { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import "./DailyAttendance.css";

function DaChetna() {

  const navigate = useNavigate();

  const [attendanceData, setAttendanceData] =
    useState([]);

  useEffect(() => {

    fetch(
      "https://script.google.com/macros/s/AKfycbymeU8g4AdibaJ6MvzqQIDnX5tlffFK8k-OkAxAVbhDdYX6cLLwGYiHJ1DxDUcsa88hUQ/exec"
    )

      .then((res) => res.json())

      .then((data) => {

        console.log(data);

        setAttendanceData(
          data.data || []
        );

      })

      .catch((err) => {

        console.log(err);

      });

  }, []);

  // MAP DATA

  const pendingAttendance =
    attendanceData
      .map(item => item["Pending Attendance"])
      .filter(Boolean);

  const leaveData =
    attendanceData
      .map(item => item["Leave"])
      .filter(Boolean);

  const halfDayData =
    attendanceData
      .map(item => item["Half Day"])
      .filter(Boolean);

  const lateDaysData =
    attendanceData
      .map(item => item["Late Days"])
      .filter(Boolean);

  return (

    <div className="daily-page">

      {/* HEADER */}

      <div className="daily-header">

        <div>

          <h1>
            Daily Attendance
          </h1>

          <p>
            Agrawal Jain & Co.
          </p>

        </div>

        <button
          className="attendance-btn"
          onClick={() =>
            navigate("/attendance-form")
          }
        >
          Mark Attendance
        </button>

      </div>

      {/* CARDS */}

      <div className="four-grid">

        {/* PENDING */}

       {/* PENDING */}

<div className="stat-card blue">

  <div className="card-scroll">

    {
      pendingAttendance.length > 0
        ? pendingAttendance.map(
            (item, index) => (

              <div
                key={index}
                className="scroll-item"
              >

                {
                  new Date(item)
                    .toLocaleDateString(
                      "en-GB"
                    )
                }

              </div>

            )
          )
        : "0"
    }

  </div>

  <p>
    Pending Attendance
  </p>

</div>

{/* LEAVE */}

<div className="stat-card purple">

  <div className="card-center">

    <h2 className="big-number">
      {
        leaveData.length > 0
          ? leaveData[0]
          : 0
      }
    </h2>

  </div>

  <p>
    Leave
  </p>

</div>

{/* HALF DAY */}

<div className="stat-card orange">

  <div className="card-center">

    <h2 className="big-number">
      {
        halfDayData.length > 0
          ? halfDayData[0]
          : 0
      }
    </h2>

  </div>

  <p>
    Half Day
  </p>

</div>

{/* LATE DAYS */}

<div className="stat-card red">

  <div className="card-center">

    <h2 className="big-number">
      {
        lateDaysData.length > 0
          ? lateDaysData[0]
          : 0
      }
    </h2>

  </div>

  <p>
    Late Days
  </p>

</div>

        {/* LATE DAYS */}

        {/* <div className="stat-card red">

          <div className="card-scroll">

            {
              lateDaysData.length > 0
                ? lateDaysData.map(
                    (item, index) => (
                      <div
                        key={index}
                        className="scroll-item"
                      >
                        {item}
                      </div>
                    )
                  )
                : "0"
            }

          </div>

          <p>
            Late Days
          </p>

        </div> */}

      </div>

    </div>

  );

}

export default DaChetna;