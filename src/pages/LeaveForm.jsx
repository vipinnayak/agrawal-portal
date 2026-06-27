import React, { useEffect, useState } from "react";


function LeaveForm() {

  const [formData, setFormData] = useState({
    employee: "",
    requestDate: "",
    leaveTillDate: "",
    rejoinDate: "",
    reason: "",
  });
  const [loading,setLoading] = useState(false);
  const [employees,setEmployees] = useState([]);
  

  const handleChange = (e) => {

    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

  };

  useEffect(() => {

  fetch(
    "https://script.google.com/macros/s/AKfycbwLZFmOBGjvZCTVsXaae4x6JhdKZOQvJPCLvkEJBcmO-HEdH7dLYokWjg_WQrbCh8D6/exec"
  )
    .then(res => res.json())
    .then(data => {

      setEmployees(data);

    })
    .catch(err => {

      console.log(err);

    });

}, []);
  const handleSubmit = async (e) => {

  e.preventDefault();

  setLoading(true);

  try {

    await fetch(
      "https://script.google.com/macros/s/AKfycbyblo9Huc-VCVJsc1GownlN_enMBwZ-0dUY2ym1xorcYZIgLBGjM6CHpcniUNyB8B3xmw/exec",
      {
        method:"POST",

        mode:"no-cors",

        headers:{
          "Content-Type":"application/json",
        },

        body:JSON.stringify(formData),
      }
    );

    alert("✅ Leave Form Submitted Successfully");

    setFormData({
      employee:"",
      requestDate:"",
      leaveTillDate:"",
      rejoinDate:"",
      reason:"",
    });

  }

  catch(error){

    console.log(error);

    alert("❌ Error Submitting Form");

  }

  finally{

    setLoading(false);

  }

};

  return (

    <div style={styles.page}>

      <div style={styles.formBox}>

        <h1 style={styles.heading}>
          Leave Application Form
        </h1>

        <p style={styles.subHeading}>
          Agrawal Jain & Co.
        </p>

        <form
          onSubmit={handleSubmit}

          onKeyDown={(e) => {

            if(e.key === "Enter"){

              e.preventDefault();

              handleSubmit(e);

            }

          }}
        >

          {/* EMPLOYEE NAME */}

         {/* EMPLOYEE NAME */}

<div style={styles.group}>

  <label style={styles.label}>
    Employee Name
  </label>

  <select
    name="employee"
    value={formData.employee}
    onChange={handleChange}
    required
    style={styles.input}
  >

    <option value="">
      Select Employee
    </option>

    {
      employees.map((emp,index) => (

        <option
          key={index}
          value={emp}
        >
          {emp}
        </option>

      ))
    }

  </select>

</div>

          {/* REQUEST DATE */}

          <div style={styles.group}>

            <label style={styles.label}>
              Requested Leave Date
            </label>

            <input
              type="date"
              name="requestDate"
              value={formData.requestDate}
              onChange={handleChange}
              required
              style={styles.input}
            />

          </div>

          {/* LEAVE TILL DATE */}

          <div style={styles.group}>

            <label style={styles.label}>
              Leave Till Date
            </label>

            <input
              type="date"
              name="leaveTillDate"
              value={formData.leaveTillDate}
              onChange={handleChange}
              required
              style={styles.input}
            />

          </div>

          {/* REJOIN DATE */}

          <div style={styles.group}>

            <label style={styles.label}>
              Expected Rejoin Date
            </label>

            <input
              type="date"
              name="rejoinDate"
              value={formData.rejoinDate}
              onChange={handleChange}
              required
              style={styles.input}
            />

          </div>

          {/* REASON */}

          <div style={styles.group}>

            <label style={styles.label}>
              Reason For Leave
            </label>

            <textarea
              name="reason"
              placeholder="Enter Leave Reason"
              value={formData.reason}
              onChange={handleChange}
              required
              style={styles.textarea}
            />

          </div>

          {/* BUTTON */}

         <button
  type="submit"
  style={{
    ...styles.button,
    opacity:loading ? 0.7 : 1,
    cursor:loading ? "not-allowed" : "pointer",
  }}
  disabled={loading}
>

  {
    loading
    ? "Submitting..."
    : "Submit Leave Form"
  }

</button>

        </form>

      </div>

    </div>

  );
}

const styles = {  page:{
  minHeight:"100vh",

  background:"#eef2f7",

  display:"flex",
  justifyContent:"center",
  alignItems:"flex-start",

  padding:"40px 20px",

  fontFamily:"Inter, sans-serif",

  overflowY:"auto",

  boxSizing:"border-box",
},  formBox:{    width:"100%",    maxWidth:"720px",    background:"#ffffff",    padding:"45px",    borderRadius:"24px",    border:"1px solid #e2e8f0",    boxShadow:"0 10px 35px rgba(15,23,42,0.06)",  },  heading:{    fontSize:"46px",    fontWeight:"800",    color:"#0f172a",    marginBottom:"8px",    letterSpacing:"-1px",  },  subHeading:{    color:"#64748b",    fontSize:"18px",    marginBottom:"40px",  },  group:{    marginBottom:"28px",  },  label:{    display:"block",    marginBottom:"12px",    fontSize:"15px",    fontWeight:"600",    color:"#1e293b",  },  input:{    width:"100%",    height:"62px",    background:"#f8fafc",    border:"1px solid #dbe3ee",    borderRadius:"16px",    padding:"0 20px",    fontSize:"16px",    color:"#0f172a",    outline:"none",    transition:"0.3s",    boxSizing:"border-box",  },  textarea:{    width:"100%",    height:"150px",    background:"#f8fafc",    border:"1px solid #dbe3ee",    borderRadius:"16px",    padding:"18px 20px",    fontSize:"16px",    color:"#0f172a",    outline:"none",    resize:"none",    boxSizing:"border-box",  },  button:{    width:"100%",    height:"64px",    border:"none",    borderRadius:"18px",    background:"linear-gradient(135deg, #2563eb, #1d4ed8)",    color:"#ffffff",    fontSize:"18px",    fontWeight:"700",    cursor:"pointer",    marginTop:"10px",    boxShadow:"0 10px 25px rgba(37,99,235,0.25)",    transition:"0.3s",  },};
export default LeaveForm;