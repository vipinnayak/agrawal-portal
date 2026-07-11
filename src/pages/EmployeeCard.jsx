import { useNavigate } from "react-router-dom";
import "./EmployeeCard.css";

export default function EmployeeCard() {
  const navigate = useNavigate();

  return (
    <div
      className="employee-page"
      style={{
        minHeight: "100vh",
        background: "#0b5cff",
      }}
    >
      <div className="employee-section">
        <div className="employee-content">
          <div className="employee-icon">
            👨🏻‍💼
          </div>

          <h1>Employee Management</h1>

          <p>
            Add new employees, manage onboarding, update employee records,
            maintain employee information and process employee exits from one
            place.
          </p>

          <div className="employee-actions">
            <button
              className="btn-add"
              onClick={() => navigate("/employeemaster")}
            >
              ➕ Add Employee
            </button>

            <button
              className="btn-exit"
              onClick={() => navigate("/exitemployee")}
            >
              🚪 Exit Employee
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}