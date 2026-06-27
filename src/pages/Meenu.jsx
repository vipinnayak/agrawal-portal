import { useNavigate } from "react-router-dom";

export default function Meenu() {

  const navigate = useNavigate();

  return (

    <div style={styles.page}>

      {/* HEADER */}

      <div style={styles.header}>

        <h1 style={styles.heading}>
          CRM Meenu Patel
        </h1>

        <p style={styles.subHeading}>
          Agrawal Jain & Co.
        </p>

      </div>

      {/* CARDS */}

      <div style={styles.grid}>

        {/* DAILY ATTENDANCE */}

        <div style={{...styles.card, background:"#2563eb"}}
        onClick={() => navigate("/daily-attendance")}>

          <h2 style={styles.cardTitle}>
            Daily Attendance
          </h2>

          <p style={styles.cardText}>
            Check today attendance status
          </p>

        </div>

        {/* DAILY WORKING */}

       <div
  style={{...styles.card, background:"#059669"}}

  onClick={() => navigate("/daily-working-vipin")}
>

  <h2 style={styles.cardTitle}>
    Daily Working
  </h2>

  <p style={styles.cardText}>
    Submit daily work updates
  </p>

</div>

        {/* DELEGATION */}

        <div style={{...styles.card, background:"#7c3aed"}}>

          <h2 style={styles.cardTitle}>
            Delegation
          </h2>

          <p style={styles.cardText}>
            Manage delegated tasks
          </p>

        </div>

        {/* CHECKLIST */}

        <div style={{...styles.card, background:"#ea580c"}}>

          <h2 style={styles.cardTitle}>
            Checklist
          </h2>

          <p style={styles.cardText}>
            Complete assigned checklists
          </p>

        </div>

        {/* PENDING CL */}

        <div style={{...styles.card, background:"#dc2626"}}>

          <h2 style={styles.cardTitle}>
            Pending CL
          </h2>

          <p style={styles.cardText}>
            View pending client tasks
          </p>

        </div>

        {/* LEAVE FORM */}

        <div
          style={{...styles.card, background:"#0891b2"}}

          onClick={() => navigate("/leave-form")}
        >

          <h2 style={styles.cardTitle}>
            Leave Form
          </h2>

          <p style={styles.cardText}>
            Apply for leave requestsA
          </p>

        </div>

        {/* PENDING APPROVALS */}

        <div style={{...styles.card, background:"#0f766e"}}onClick={() => navigate("/pending-approvals")}>
            

          <h2 style={styles.cardTitle}>
            Pending Approvals
          </h2>

          <p style={styles.cardText}>
            Review pending approvals
          </p>

        </div>

        {/* REPORTS */}

        <div style={{...styles.card, background:"#1e293b"}}>

          <h2 style={styles.cardTitle}>
            Reports
          </h2>

          <p style={styles.cardText}>
            View MIS & performance reports
          </p>

        </div>

        {/* CLIENT MANAGEMENT */}

        <div style={{...styles.card, background:"#c2410c"}}>

          <h2 style={styles.cardTitle}>
            Client Management
          </h2>

          <p style={styles.cardText}>
            Manage client records & updates
          </p>

        </div>

        {/* NOTIFICATIONS */}

        <div style={{...styles.card, background:"#4338ca"}}>

          <h2 style={styles.cardTitle}>
            Notifications
          </h2>

          <p style={styles.cardText}>
            Check latest office alerts
          </p>

        </div>

        {/* TASK STATUS */}

        <div style={{...styles.card, background:"#be123c"}}>

          <h2 style={styles.cardTitle}>
            Task Status
          </h2>

          <p style={styles.cardText}>
            Track assigned daily tasks
          </p>

        </div>

        {/* MEETINGS */}

        <div style={{...styles.card, background:"#4d7c0f"}}>

          <h2 style={styles.cardTitle}>
            Meetings
          </h2>

          <p style={styles.cardText}>
            Upcoming meetings & schedules
          </p>

        </div>

      </div>

    </div>

  );
}

const styles = {

  page:{
    minHeight:"100vh",

    background:"#eef2f7",

    padding:"35px",

    fontFamily:"Inter, sans-serif",

    overflowY:"auto",
  },

  header:{
    marginBottom:"40px",
  },

  heading:{
    fontSize:"52px",

    fontWeight:"800",

    color:"#0f172a",

    margin:"0",
  },

  subHeading:{
    marginTop:"10px",

    color:"#64748b",

    fontSize:"20px",
  },

  grid:{
    display:"grid",

    gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",

    gap:"28px",
  },

  card:{
    borderRadius:"28px",

    padding:"32px",

    color:"#ffffff",

    minHeight:"210px",

    display:"flex",

    flexDirection:"column",

    justifyContent:"space-between",

    cursor:"pointer",

    boxShadow:"0 12px 24px rgba(15,23,42,0.08)",

    transition:"0.3s",

    boxSizing:"border-box",
  },

  cardTitle:{
    fontSize:"34px",

    fontWeight:"800",

    lineHeight:"42px",

    margin:"0",
  },

  cardText:{
    fontSize:"19px",

    opacity:"0.92",

    lineHeight:"32px",

    margin:"0",
  },

};