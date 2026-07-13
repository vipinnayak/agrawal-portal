import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./EmployeeMaster.css";

const API =
  "https://script.google.com/macros/s/AKfycbzp9jjuDv3H_T85SNi75ZJlLjKDlMB2NFlMaxZTVCG-C5VRDuM6OWd_KLwRatBWlmPzRA/exec";

export default function EmployeeMaster() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API)
      .then((res) => res.json())
      .then((data) => {
        setEmployees(data);
        setFiltered(data);

        const deps = [
          "All",
          ...new Set(
            data
              .map((e) => e.Department)
              .filter(Boolean)
          ),
        ];

        setDepartments(deps);
        setLoading(false);
      })
      .catch((err) => {
        console.log(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let temp = [...employees];

    const keyword = search.toLowerCase();

    if (search.trim() !== "") {
      temp = temp.filter((emp) => {
        return (
          String(emp.Name ?? "")
            .toLowerCase()
            .includes(keyword) ||

          String(emp.Mobile ?? "")
            .includes(search) ||

          String(emp.Department ?? "")
            .toLowerCase()
            .includes(keyword) ||

          String(emp.Address ?? "")
            .toLowerCase()
            .includes(keyword) ||

          String(emp.Salary ?? "")
            .includes(search) ||

          String(emp.AccountNo ?? "")
            .includes(search)
        );
      });
    }

    if (department !== "All") {
      temp = temp.filter(
        (emp) => emp.Department === department
      );
    }

    setFiltered(temp);
  }, [search, department, employees]);

  return (
    <div className="emp-page">

      <div className="emp-header">

        <div className="emp-title">
          <h1>Employee Master</h1>
          <p>Manage all employee records from one place.</p>
        </div>

       <button
  className="add-btn"
  onClick={() => navigate("/addemployeeform")}
>
  ➕ Add Employee
</button>

      </div>

      <div className="emp-summary">

        <div className="emp-summary-icon">
          👨🏻‍💼
        </div>

        <div>
          <h4>Total Employees</h4>
          <h2>{employees.length}</h2>
        </div>

      </div>

      <div className="emp-filter">

        <input
          type="text"
          placeholder="🔍 Search Employee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          {departments.map((dep, index) => (
            <option key={index} value={dep}>
              {dep}
            </option>
          ))}
        </select>

      </div>

      <div className="emp-table">

        <table>

          <thead>
            <tr>
              <th>EmployeeID</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Department</th>
              <th>Joining Date</th>
              <th>Salary</th>
              <th>Address</th>
              {/* <th>Account No</th> */}
             
              <th>Exit</th>
            </tr>
          </thead>

          <tbody>

            {loading ? (

              <tr>
                <td colSpan="8" className="loading">
                  Loading...
                </td>
              </tr>

            ) : filtered.length === 0 ? (

              <tr>
                <td colSpan="8" className="loading">
                  No Employee Found
                </td>
              </tr>

            ) : (

              filtered.map((emp, index) => (

  <tr key={index}>

  <td>{emp.EmployeeID}</td>

  <td>{emp.Name}</td>

  <td>{emp.Mobile}</td>

  <td>{emp.Department}</td>

  <td>
    {emp.JoiningDate
      ? new Date(emp.JoiningDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : ""}
  </td>

  <td>{emp.Salary}</td>

  <td>{emp.Address}</td>

  {/* <td>{emp.AccountNo}</td> */}

  {/* <td>
    <button
      className="edit-btn"
      onClick={() =>
        navigate(`/editemployee/${emp.EmployeeID}`)
      }
    >
      ✏️
    </button>
  </td> */}

  <td>
    <button
      className="exit-btn"
      onClick={() =>
        navigate(`/exitemployee/${emp.EmployeeID}`)
      }
    >
      🚪
    </button>
  </td>

</tr>

              ))

            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}