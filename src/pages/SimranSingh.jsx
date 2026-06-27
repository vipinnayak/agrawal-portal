import { useNavigate } from "react-router-dom";

export default function SimranSingh() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/", { replace: true });
  };

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div>
            <h1 style={styles.heading}>Simran Singh</h1>
            <p style={styles.subHeading}>Agrawal Jain & Co.</p>
          </div>

          <button
            style={styles.logoutBtn}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>

      {/* CARDS GRID */}
      <div style={styles.grid}>

        <div
          style={styles.card}
          onClick={() => navigate("/daily-attendance")}
        >
          <h2 style={styles.cardTitle}>Daily Attendance</h2>
          <p style={styles.cardText}>
            Check today attendance status
          </p>
        </div>

        <div
          style={styles.card}
          onClick={() => navigate("/daily-working-harsh-sharma")}
        >
          <h2 style={styles.cardTitle}>Daily Working</h2>
          <p style={styles.cardText}>
            Submit daily work updates
          </p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Delegation</h2>
          <p style={styles.cardText}>
            Manage delegated tasks
          </p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Checklist</h2>
          <p style={styles.cardText}>
            Complete assigned checklists
          </p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Pending CL</h2>
          <p style={styles.cardText}>
            View pending client tasks
          </p>
        </div>

        <div
          style={styles.card}
          onClick={() => navigate("/leave-form")}
        >
          <h2 style={styles.cardTitle}>Leave Form</h2>
          <p style={styles.cardText}>
            Apply for leave requests
          </p>
        </div>

        <div
          style={styles.card}
          onClick={() => navigate("/pending-approvals")}
        >
          <h2 style={styles.cardTitle}>Pending Approvals</h2>
          <p style={styles.cardText}>
            Review pending approvals
          </p>
        </div>

        

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Client Management</h2>
          <p style={styles.cardText}>
            Manage client records & updates
          </p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Notifications</h2>
          <p style={styles.cardText}>
            Check latest office alerts
          </p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Task Status</h2>
          <p style={styles.cardText}>
            Track assigned daily tasks
          </p>
        </div>

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
    background: "#f1f5f9",
    padding: "25px",
    fontFamily: "Inter, sans-serif",
  },

  header: {
    background: "#ffffff",
    padding: "30px",
    borderRadius: "20px",
    marginBottom: "30px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    borderLeft: "6px solid #1e3a8a",
  },

  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "20px",
  },

  heading: {
    margin: 0,
    fontSize: "48px",
    fontWeight: "800",
    color: "#0f172a",
  },

  subHeading: {
    marginTop: "8px",
    color: "#64748b",
    fontSize: "18px",
  },

  logoutBtn: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    padding: "12px 24px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "600",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
  },

  card: {
    background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
    borderRadius: "18px",
    padding: "25px",
    color: "#fff",
    minHeight: "180px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(37,99,235,0.18)",
    transition: "all 0.3s ease",
  },

  cardTitle: {
    margin: 0,
    fontSize: "30px",
    fontWeight: "700",
    lineHeight: "38px",
  },

  cardText: {
    margin: 0,
    fontSize: "16px",
    lineHeight: "24px",
    opacity: "0.95",
  },
};