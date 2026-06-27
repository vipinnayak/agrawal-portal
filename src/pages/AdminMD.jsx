import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminMD() {

  const navigate = useNavigate();

  // PENDING APPROVAL COUNT
  const [pendingCount, setPendingCount] = useState(0);

  // SAME API URL USED IN PENDING APPROVAL PAGE
  const API_URL =
    "https://script.google.com/macros/s/AKfycbxPNEam1oR6hiQKrse9f6pJWaAkkvrkAPVohNiuUEkvMh414tZPbvjL154KpkWwuUfbaA/exec";

  // FETCH COUNT
 useEffect(() => {

  fetch(API_URL)
    .then((res) => res.json())
    .then((response) => {

      console.log(response);

      // CHECK DIFFERENT POSSIBLE FORMATS

      const rows =
        response.data ||
        response.rows ||
        response.result ||
        response;

      // COUNT ROWS

      setPendingCount(
        Array.isArray(rows)
          ? rows.length
          : 0
      );

    })
    .catch((err) => {
      console.log(err);
    });

}, []);

  return (

    <div style={styles.page}>

      {/* HEADER */}

      <div style={styles.header}>

        <h1 style={styles.heading}>
          ADMIN (MD) Dashboard
        </h1>

        <p style={styles.subHeading}>
          Agrawal Jain & Co.
        </p>

      </div>

      {/* CARDS */}

      <div style={styles.grid}>

        {/* EMPLOYEE PANEL */}

        <div
          style={{...styles.card, background:"#2563eb"}}
        >

          <h2 style={styles.cardTitle}>
            Employee Panel
          </h2>

          <p style={styles.cardText}>
            Manage all employees
          </p>

        </div>

        {/* DAILY WORKING */}

        <div
          style={{...styles.card, background:"#059669"}}
        >

          <h2 style={styles.cardTitle}>
            Daily Working
          </h2>

          <p style={styles.cardText}>
            View daily work reports
          </p>

        </div>

        {/* DELEGATION */}

       <div
  style={{...styles.card, background:"#7c3aed"}}

  onClick={() => navigate("/DelegationDashboard")}
>
  

  <h2 style={styles.cardTitle}>
    Delegation
  </h2>

          <p style={styles.cardText}>
            Manage delegated work
          </p>

        </div>

        {/* CHECKLIST */}

        <div
          style={{...styles.card, background:"#ea580c"}}
        >

          <h2 style={styles.cardTitle}>
            Checklist
          </h2>

          <p style={styles.cardText}>
            View all checklists
          </p>

        </div>

        {/* PENDING APPROVALS */}

        <div
          style={{...styles.card, background:"#dc2626"}}

          onClick={() =>
            navigate("/pending-approvals-admin")
          }
        >

          {/* COUNT BADGE */}

          <div style={styles.countBadge}>
            {pendingCount}
          </div>

          <h2 style={styles.cardTitle}>
            Pending Approvals
          </h2>

          <p style={styles.cardText}>
            View approval requests
          </p>

        </div>

        {/* LEAVE FORM */}

        <div
          style={{...styles.card, background:"#0891b2"}}

          onClick={() =>
            navigate("/leave-form")
          }
        >

          <h2 style={styles.cardTitle}>
            Leave Form
          </h2>

          <p style={styles.cardText}>
            Open leave application
          </p>

          

        </div>
        {/* INTERNAL AUDIT FMS */}

<div
  style={{ ...styles.card, background:"#0f766e" }}

  onClick={() => navigate("/internal-audit-fms")}
>

  <h2 style={styles.cardTitle}>
    Internal Audit FMS
  </h2>

  <p style={styles.cardText}>
    Create and Manage Audit Assignments
  </p>

</div>

      </div>

    </div>

  );
}

const styles = {

  page:{
    minHeight:"100vh",
    background:"#edf2f7",
    padding:"35px",
    fontFamily:"Inter, sans-serif",
    overflowY:"auto",
    boxSizing:"border-box",
  },

  header:{
    marginBottom:"35px",
  },

  heading:{
    fontSize:"48px",
    fontWeight:"800",
    color:"#0f172a",
    margin:"0",
  },

  subHeading:{
    marginTop:"8px",
    color:"#64748b",
    fontSize:"18px",
  },

  grid:{
    display:"grid",
    gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",
    gap:"25px",
  },

  card:{
    borderRadius:"24px",
    padding:"30px",
    color:"white",
    minHeight:"190px",

    display:"flex",
    flexDirection:"column",
    justifyContent:"space-between",

    cursor:"pointer",

    transition:"0.3s",

    position:"relative",

    boxShadow:"0 10px 25px rgba(0,0,0,0.08)",
  },

  cardTitle:{
    fontSize:"30px",
    fontWeight:"700",
    lineHeight:"38px",
  },

  cardText:{
    fontSize:"18px",
    lineHeight:"28px",
    opacity:"0.9",
  },

  // COUNT BADGE

  countBadge:{
    position:"absolute",

    top:"18px",

    right:"18px",

    width:"60px",

    height:"60px",

    borderRadius:"50%",

    background:"white",

    color:"#dc2626",

    display:"flex",

    alignItems:"center",

    justifyContent:"center",

    fontSize:"28px",

    fontWeight:"900",

    boxShadow:"0 10px 25px rgba(0,0,0,0.15)",
  },

};