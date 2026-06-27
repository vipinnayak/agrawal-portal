import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DelegationDashboard.css";

function DelegationDashboard() {

  const [summary,setSummary] = useState({
    total:0,
    onTime:0,
    late:0,
  });

  const [delegationData,setDelegationData] = useState([]);
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

        setDelegationData(data);

      });

  }, []);

  return (

    <div className="delegation-page">

      {/* HEADER */}

      <div className="delegation-header">

        <div>

          <h1>
            Delegation Dashboard
          </h1>

          <p>
            Agrawal Jain & Co.
          </p>

        </div>
<button
  className="delegation-btn"
  onClick={() =>
    navigate("/delegation-form")
  }
>
  Open Delegation Form
</button>

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

      <div className="table-card">

        <div className="table-top">

          <h2>
            Delegation Reports
          </h2>

        </div>

        <div className="table-wrapper">

          <table>

            <thead>

              <tr>

                <th>
                  Delegation ID
                </th>

                <th>
                  Employee Name
                </th>

                <th>
                  Task
                </th>

                <th>
                  Assigned Date
                </th>

                <th>
                  Deadline
                </th>

                <th>
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {
                delegationData.length > 0
                ? delegationData.map((item,index) => (

                    <tr key={index}>

                      <td>
                        {item.id}
                      </td>

                      <td>
                        {item.employee}
                      </td>

                      <td>
                        {item.task}
                      </td>

                      <td>
                        {item.assignedDate}
                      </td>

                      <td>
                        {item.deadline}
                      </td>

                      <td>

                        <span
                          className={
                            item.status === "Completed"
                            ? "status-green"
                            : "status-red"
                          }
                        >

                          {item.status}

                        </span>

                      </td>

                    </tr>

                  ))
                : (
                  <tr>

                    <td
                      colSpan="6"
                      className="no-data"
                    >
                      No Delegation Data
                    </td>

                  </tr>
                )
              }

            </tbody>

          </table>

        </div>

      </div>

    </div>

  );
}

export default DelegationDashboard;