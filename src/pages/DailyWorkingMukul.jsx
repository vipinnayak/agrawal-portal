import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DailyWorking.css";

function DailyWorkingMukul() {

  const navigate = useNavigate();

  const [data, setData] = useState([]);

  useEffect(() => {

    fetch(
      "https://script.google.com/macros/s/AKfycbxChm2tuSBdFiwLATUq4THD01CMfytH0S8KJuXGobPPkxEJCbeSs7y_tVCD9rMJ2cr2Rw/exec"
    )

      .then((res) => res.json())

      .then((result) => {

        console.log(result);

        setData(result.data || []);

      })

      .catch((err) => {

        console.log(err);

      });

  }, []);

  // LAST 5

  const latestFive =
    [...data]
      .reverse()
      .slice(0, 5);

  // LAST 10

  const latestTen =
    [...data]
      .reverse()
      .slice(0, 10);

  // LAST ENTRY

  const latestEntry =
    latestFive[0] || {};

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

        {/* TOTAL ENTRIES */}

        <div className="stat-card blue">

          <h2>
            {data.length}
          </h2>

          <p>
            Total Entries
          </p>

        </div>

        {/* LAST UPDATED TIME */}

        <div className="stat-card green">

          <h2>

            {
  latestEntry.timestamp
    ? new Date(latestEntry.timestamp)
        .toLocaleString("en-GB")
    : "--"
}
          </h2>
 <p>
            Last Updated Timestamp
          </p>

        
        </div>

        {/* LAST UPDATE DATE */}
{/* LAST UPDATE DATE */}

<div className="stat-card purple">

  <h2>

    {latestTen.find(item => item.lastUpdated)?.lastUpdated || "--"}

  </h2>
 <p>
            Last Updated Date
          </p>

 
</div>

        {/* PENDING DATES */}

        {/* PENDING DATES */}

<div className="stat-card orange">

  <div className="pending-scroll">

   <h2 className="pending-text">

{
  latestTen.find(item => item.missingDate)
    ?.missingDate
    ?.split(",")
    .map(date => {

      // IF DATE IS SERIAL NUMBER
      if (!isNaN(date)) {

        const jsDate =
          new Date(
            (Number(date) - 25569) * 86400 * 1000
          );

        return jsDate.toLocaleDateString("en-GB");

      }

      // NORMAL DATE
      return date;

    })
    .join(", ")
    || "--"
}

</h2>

  </div>

  <p>
    Pending Dates
  </p>

</div>
      </div>

      {/* TABLE */}

      <div className="table-card">

        <div className="table-header">

          <h2>
            Last 10 Entries
          </h2>

        </div>

        <div className="table-wrapper">

          <table>

            <thead>

              <tr>

                <th>Period</th>
                <th>Date</th>
                <th>Doer Name</th>
                <th>Location</th>
                <th>Department</th>
                <th>Group Name</th>
                <th>Company Name</th>
                <th>Task Description</th>
                <th>Time Given</th>
                

              </tr>

            </thead>

            <tbody>

              {latestTen.length > 0 ? (

                latestTen.map((item, index) => (

                  <tr key={index}>

                    <td>
                      {item.period}
                    </td>

                    <td>
                      {item.date}
                    </td>

                    <td>
                      {item.doerName}
                    </td>

                    <td>
                      {item.location}
                    </td>

                    <td>
                      {item.department}
                    </td>

                    <td>
                      {item.groupName}
                    </td>

                    <td>
                      {item.companyName}
                    </td>

                    <td>
                      {item.taskDescription}
                    </td>

                    <td>
                      {item.timeGiven}
                    </td>

                   

                  </tr>

                ))

              ) : (

                <tr>

                  <td
                    colSpan="10"
                    className="no-data"
                  >
                    No Data Found
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

export default DailyWorkingMukul;