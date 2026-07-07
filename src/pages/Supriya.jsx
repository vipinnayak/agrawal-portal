import { useNavigate } from "react-router-dom";

export default function Supriya() {
  const navigate = useNavigate();

  return (
    <div style={styles.page}>
      {/* HEADER */}

      <div style={styles.header}>
        <h1 style={styles.heading}>EA Supriya Kurre</h1>

        <p style={styles.subHeading}>
          Agrawal Jain & Co.
        </p>
      </div>

      {/* DASHBOARD */}

      <div style={styles.grid}>

        {/* Daily Attendance */}
        <div
          style={styles.card}
          onClick={() => navigate("/daily-attendance")}
        >
          <h2 style={styles.cardTitle}>Daily Attendance</h2>

          <p style={styles.cardText}>
            Check today attendance status
          </p>
        </div>

        {/* Daily Working */}
        <div
          style={styles.card}
          onClick={() => navigate("/daily-working-vipin")}
        >
          <h2 style={styles.cardTitle}>Daily Working</h2>

          <p style={styles.cardText}>
            Submit daily work updates
          </p>
        </div>

        {/* Delegation */}
        <div
          style={styles.card}
          onClick={() => navigate("/DelegationDashboard")}
        >
          <h2 style={styles.cardTitle}>Delegation</h2>

          <p style={styles.cardText}>
            Manage delegation work
          </p>
        </div>

        {/* Checklist */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Checklist</h2>

          <p style={styles.cardText}>
            Complete assigned checklists
          </p>
        </div>

        {/* Pending CL */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Pending CL</h2>

          <p style={styles.cardText}>
            View pending client tasks
          </p>
        </div>

        {/* Leave Form */}
        <div
          style={styles.card}
          onClick={() => navigate("/leave-form")}
        >
          <h2 style={styles.cardTitle}>Leave Form</h2>

          <p style={styles.cardText}>
            Apply for leave requests
          </p>
        </div>

        {/* Pending Approvals */}
        <div
          style={styles.card}
          onClick={() => navigate("/pending-approvals")}
        >
          <h2 style={styles.cardTitle}>Pending Approvals</h2>

          <p style={styles.cardText}>
            Review pending approvals
          </p>
        </div>

        {/* Reports */}
        <div style={{...styles.card, background:"#2563eb"}}
        onClick={() => navigate("/reports")}>

          <h2 style={styles.cardTitle}>
            Reports
          </h2>

          <p style={styles.cardText}>
            Check today attendance status
          </p>

        </div>

        {/* Client Management */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Client Management</h2>

          <p style={styles.cardText}>
            Manage client records & updates
          </p>
        </div>

        {/* Notifications */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Notifications</h2>

          <p style={styles.cardText}>
            Check latest office alerts
          </p>
        </div>

        {/* Task Status */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Task Status</h2>

          <p style={styles.cardText}>
            Track assigned daily tasks
          </p>
        </div>

        {/* Meetings */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Meetings</h2>

          <p style={styles.cardText}>
            Upcoming meetings & schedules
          </p>
        </div>

      </div>
    </div>
  );
}

const styles = {

  page: {
    minHeight: "100vh",
    background: "#eef2f7",
    padding: "35px",
    fontFamily: "Inter, sans-serif",
  },

  header: {
    marginBottom: "40px",
  },

  heading: {
    fontSize: "52px",
    fontWeight: "800",
    color: "#0f172a",
    margin: 0,
  },

  subHeading: {
    fontSize: "20px",
    color: "#64748b",
    marginTop: "10px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
    gap: "25px",
  },

  card: {
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    borderRadius: "22px",
    padding: "28px",
    minHeight: "190px",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    cursor: "pointer",
    transition: "all .3s ease",
    boxShadow: "0 12px 25px rgba(37,99,235,.25)",
  },

  cardTitle: {
    fontSize: "30px",
    fontWeight: "800",
    margin: 0,
    lineHeight: "38px",
  },

  cardText: {
    fontSize: "18px",
    lineHeight: "28px",
    margin: 0,
    opacity: 0.95,
  },

};