import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ClientMaster.css";

const API =
"https://script.google.com/macros/s/AKfycbyA8nUoU15iBRYOAlr4iaOxfL2aN-77KKslD2Q8p2-DLzQnEpMDUZLKN5zQuYoCLguE/exec";

export default function ClientMaster() {

  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(API)
      .then((res) => res.json())
      .then((data) => {
        setClients(data);
        setFiltered(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {

    const value = search.toLowerCase();

    const data = clients.filter((item) =>
      (item.TypeOfClient || "").toLowerCase().includes(value) ||
      (item.GroupName || "").toLowerCase().includes(value) ||
      (item.CompanyName || "").toLowerCase().includes(value) ||
      (item.Department || "").toLowerCase().includes(value)
    );

    setFiltered(data);

  }, [search, clients]);

  return (

    <div className="client-page">

      <div className="client-header">

        <div>
          <h1>Client Master</h1>
          <p>Manage all client records from one place.</p>
        </div>

        <div className="header-buttons">

          <button
            className="view-client-btn"
            onClick={() => navigate("/client-master-fms")}
          >
            📋 View Client Master FMS
          </button>

          <button
            className="add-client-btn"
            onClick={() => navigate("/add-client")}
          >
            + Add Client
          </button>

        </div>

      </div>

      <div className="stats">

        <div className="stat-card">
          <h3>Total Clients</h3>
          <h2>{clients.length}</h2>
        </div>

        <div className="stat-card">
          <h3>Groups</h3>
          <h2>{new Set(clients.map(x => x.GroupName)).size}</h2>
        </div>

        <div className="stat-card">
          <h3>Companies</h3>
          <h2>{new Set(clients.map(x => x.CompanyName)).size}</h2>
        </div>

        <div className="stat-card">
          <h3>Departments</h3>
          <h2>{new Set(clients.map(x => x.Department)).size}</h2>
        </div>

      </div>

      <div className="search-box">

        <input
          type="text"
          placeholder="🔍 Search Client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

      </div>

      <div className="table-box">

        <table className="client-table">

          <thead>
            <tr>
              <th>TYPE</th>
              <th>GROUP</th>
              <th>COMPANY NAME</th>
              <th>DEPARTMENT</th>
            </tr>
          </thead>

          <tbody>

            {filtered.length === 0 ? (

              <tr>
                <td colSpan="4" className="no-data">
                  No Client Found
                </td>
              </tr>

            ) : (

              filtered.map((item, index) => (

                <tr key={index}>
                  <td>{item.TypeOfClient}</td>
                  <td>{item.GroupName}</td>
                  <td>{item.CompanyName}</td>
                  <td>{item.Department}</td>
                </tr>

              ))

            )}

          </tbody>

        </table>

      </div>

    </div>

  );

}