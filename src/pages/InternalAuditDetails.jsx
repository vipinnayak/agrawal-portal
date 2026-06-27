import React, { useEffect, useState } from "react";
import "./InternalAuditDetails.css";

const API =
"https://script.google.com/macros/s/AKfycby8qaKsz1-FNGJthiK42oPR1Pm7d_TZ33r3wZj4ONyCCvsOGAfczwQPpt6_s4yLVWHDgQ/exec";

export default function InternalAuditDetails() {

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = () => {

    setLoading(true);

    fetch(API)
      .then(res => res.json())
      .then(result => {

        const rows = result.data || [];

        setData(rows);
        setFilteredData(rows);
        setLoading(false);

      })
      .catch(err => {

        console.log(err);

        setError("Failed to Load Data");
        setLoading(false);

      });

  };

  useEffect(() => {

    loadData();

  }, []);

  useEffect(() => {

    const filtered = data.filter(row =>

      row.join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())

    );

    setFilteredData(filtered);

  }, [search, data]);

  const formatDate = (value) => {

    if (!value) return "-";

    try {

      return new Date(value).toLocaleDateString("en-IN");

    } catch {

      return value;

    }

  };

  return (

    <div className="details-page">

      <div className="details-header">

        <h1>Internal Audit FMS Details</h1>

        <button
          className="refresh-btn"
          onClick={loadData}
        >
          Refresh
        </button>

      </div>

      <div className="top-bar">

        <input
          type="text"
          placeholder="Search Group, Company, Partner..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          className="search-box"
        />

        <div className="record-count">
          Total Records : {filteredData.length}
        </div>

      </div>

      {loading && (

        <div className="loading">
          Loading Data...
        </div>

      )}

      {error && (

        <div className="error">
          {error}
        </div>

      )}

      {!loading && !error && (

        <div className="table-wrapper">

          <table>

            <thead>

              <tr>
                <th>Timestamp</th>
                <th>Group Name</th>
                <th>Company Name</th>
                <th>IA Period</th>
                <th>Partner</th>
                <th>Other CA</th>
                <th>Assignment Type</th>
                <th>Start Date</th>
                <th>Target Date</th>
              </tr>

            </thead>

            <tbody>

              {filteredData.map((row, index) => (

                <tr key={index}>

                  <td>{formatDate(row[0])}</td>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                  <td>{row[3]}</td>
                  <td>{row[4]}</td>
                  <td>{row[5]}</td>
                  <td>{row[6]}</td>
                  <td>{formatDate(row[7])}</td>
                  <td>{formatDate(row[8])}</td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      )}

    </div>

  );

}