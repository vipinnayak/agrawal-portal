import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DailyWorking.css";

function DailyWorking() {

  const navigate = useNavigate();

  const [data, setData] = useState([]);

  useEffect(() => {

    fetch(
      "YOUR_GOOGLE_SCRIPT_WEBAPP_URL"
    )
      .then((res) => res.json())
      .then((result) => {

        setData(result);

      })
      .catch((err) => {

        console.log(err);

      });

  }, []);

  // LAST 5 ENTRIES

  const latestFive =
    data.slice(-5).reverse();

  return (

    <div className="daily-page">

      {/* HEADER */}

      <div className="daily-header">

        <div>

          <h1>
            Daily Working
          </h1>

          <p>
            Agrawal Jain & Co.
          </p>

        </div>

        <button
          className="new-btn"
          onClick={() =>
            navigate("/daily-working-form")
          }
        >
          + Add Daily Work
        </button>

      </div>

      {/* STATS */}

      <div className="stats-grid four-grid">

        <div className="stat-card blue">

          <h2>
            {data.length}
          </h2>

          <p>
            Total Entries
          </p>

        </div>

        <div className="stat-card green">

          <h2>
            {latestFive.length > 0
              ? latestFive[0]?.employeeName
              : "0"}
          </h2>

          <p>
            Last Updated By
          </p>

        </div>

        <div className="stat-card purple">

          <h2>
            {latestFive.length > 0
              ? latestFive[0]?.date
              : "--"}
          </h2>

          <p>
            Last Update Date
          </p>

        </div>
        <div className="stat-card orange">

  <h2>
    12
  </h2>

  <p>
    Pending Dates
  </p>

</div>

      </div>

      {/* LAST 5 ENTRIES */}

      <div className="table-card">

        <div className="table-header">

          <h2>
            Last 5 Entries
          </h2>

        </div>

        <div className="table-wrapper">

          <table>

            <thead>

              <tr>

                <th>
                  Employee
                </th>

                <th>
                  Client
                </th>

                <th>
                  Work Title
                </th>

                <th>
                  Status
                </th>

                <th>
                  Date
                </th>

              </tr>

            </thead>

            <tbody>

              {latestFive.length > 0 ? (

                latestFive.map((item, index) => (

                  <tr key={index}>

                    <td>
                      {item.employeeName}
                    </td>

                    <td>
                      {item.clientName}
                    </td>

                    <td>
                      {item.workTitle}
                    </td>

                    <td>
                      <span className="status">
                        {item.status}
                      </span>
                    </td>

                    <td>
                      {item.date}
                    </td>

                  </tr>

                ))

              ) : (

                <tr>

                  <td
                    colSpan="5"
                    className="no-data"
                  >
                    No Daily Working Found
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
    

  );

}

export default DailyWorking;