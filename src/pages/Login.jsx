import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./../index.css";

export default function Login() {
  const navigate = useNavigate();

  const [employee, setEmployee] = useState("");
  const [password, setPassword] = useState("");

  // USERS & PASSWORDS
  const users = {
    "MIS(1)": "mis123",
    "MIS(2)": "mis456",

    "PC(1)": "pc123",
    "PC(2)": "pc456",

    "Naresh Prajapati": "naresh123",

    ACCOUNTANT: "acc123",

    CRM: "crm123",

    EA: "ea123",

    "ADMIN(MD)": "admin123",

    "CA HARSH MITTAL": "harsh123",
    "CA HARSH SHARMA": "harsh123",
    "kanhakediaajc@gmail.com": "kanha123",
    "pankajagrawalajc@gmail.com": "pankaj123",
    "drishtichandnaniajc@gmail.com": "drishti123",
    "chandansinghajc@gmail.com": "chandan123",
    "pratibhaagrawalajc@gmail.com": "pratibha123",
    "vikasgoyalajc@gmail.com":"vikas123",
    "vedantkhandelwalajc@gmail.com": "vedant123",
    "priyadaniajc@gmail.com":"priya123",
    "ankitkumargargajc@gmail.com":"ankit123",
    "mukul.c@mail.ca.in":"mukul123",
    "rupeshvaid123@gmail.com":"rupesh123",
    "vipinnayak754@gmail.com":"Vipin@#1999",
    "yash123@gmail.com":"yash123",
    "supriya123@gmail.com" :"supriya123",
    "meenu123@gmail.com":"meenu123",
    "pranjali123@gmail.com":"pranjali123",
    "babita123@gmail.com":"babita123",
    "bhavika123@gmail.com":"bhavika123",
    "yogita123@gmail.com":"yogita123",
    "sarika123@gmail.com":"sarika123",
    "rajni123@gmail.com":"rajni123",
    "khushboo123@gmail.com":"khushboo123",
    "amit123@gmail.com":"amit123",
    "vaishali123@gmail.com":"vaishali123",
    "nayanpreet123@gmail.com":"nayanpreet123",
    "vicky123@gmail.com":"vicky123",
    "vimal123@gmail.com":"vimal123",
    "chandrabhusan123@gmail.com":"chandrabhusan123",
    "tushar123@gmail.com":"tushar123",
    "lucky123@gmail.com":"lucky123",
    "kundan123@gmail.com":"kundan123",
    "kishan123@gmail.com":"kishan123",
    "khemlal123@gmail.com":"khemlal123",
    "rohit123@gmail.com":"rohit123",
    "neeraj123@gmail.com":"neeraj123",
    "suraj123@gmail.com":"suraj123",
    "shubham123@gmail.com":"shubham123",
    "jitendra123@gmail.com":"jitendra123",
    "trdewangan123@gmail.com":"trdewangan123",
    "fulesh123@gmail.com":"fulesh123",
    "akash123@gmail.com":"akash123",
    "vikas123@gmail.com":"vikas123",
    "gauri123@gmail.com":"gauri123",
    "dayalu123@gmail.com":"dayalu123",
    "nitish123@gmail.com":"nitish123",
    "jeetu123@gmail.com":"jeetu123",

  };

  const handleLogin = () => {
    const emp = employee.trim();

    if (users[emp] === password) {
      if (emp === "MIS(1)") {
        navigate("/mis1");
      } else if (emp === "MIS(2)") {
        navigate("/mis2");
      } else if (emp === "PC(1)") {
        navigate("/pc1");
      } else if (emp === "PC(2)") {
        navigate("/pc2");
      } else if (emp === "ACCOUNTANT") {
        navigate("/accountant");
      } else if (emp === "CRM") {
        navigate("/crm");
      } else if (emp === "EA") {
        navigate("/ea");
      } else if (emp === "ADMIN(MD)") {
        navigate("/admin-md");
      } else if (emp === "Naresh Prajapati") {
        navigate("/naresh-prajapati");
      } else if (emp === "CA HARSH MITTAL") {
        navigate("/ca-harsh-mittal");
      } else if (emp === "CA HARSH SHARMA") {
        navigate("/ca-harsh-sharma");
      }else if (emp === "kanhakediaajc@gmail.com") {
        navigate("/ca-kanha");
      }
      else if (emp === "pankajagrawalajc@gmail.com") {
        navigate("/ca-pankaj");
      }else if (emp === "drishtichandnaniajc@gmail.com") {
        navigate("/ca-drishti");
      }else if (emp === "chandansinghajc@gmail.com") {
        navigate("/ca-chandan");
      }else if (emp === "pratibhaagrawalajc@gmail.com") {
        navigate("/ca-pratibha");
      }else if (emp === "vikasgoyalajc@gmail.com") {
        navigate("/ca-vikas");
      }else if (emp === "vedantkhandelwalajc@gmail.com") {
        navigate("/ca-vedant");
      }else if (emp === "priyadaniajc@gmail.com") {
        navigate("/ca-priya");
      }else if (emp === "ankitkumargargajc@gmail.com") {
        navigate("/ca-ankit");
      }else if (emp === "mukul.c@mail.ca.in") {
        navigate("/ca-mukul");
      }else if (emp === "rupeshvaid123@gmail.com") {
        navigate("/ca-rupesh");
      }else if (emp === "vipinnayak754@gmail.com") {
        navigate("/vipin");
      }else if (emp === "yash123@gmail.com") {
        navigate("/yash");
      }else if (emp === "supriya123@gmail.com") {
        navigate("/supriya");
      }else if (emp === "pranjali123@gmail.com") {
        navigate("/pranjali");
      }else if (emp === "bhavika123@gmail.com") {
        navigate("/bhavika");
      }else if (emp === "babita123@gmail.com") {
        navigate("/babita");
      }else if (emp === "yogita123@gmail.com") {
        navigate("/yogita");
      }else if (emp === "sarika123@gmail.com") {
        navigate("/sarika");
      }else if (emp === "meenu123@gmail.com") {
        navigate("/meenu");
      }else if (emp === "rajni123@gmail.com") {
        navigate("/rajni");
      }else if (emp === "khushboo123@gmail.com") {
        navigate("/khushboo");
      }else if (emp === "amit123@gmail.com") {
        navigate("/amit");
      }else if (emp === "vaishali123@gmail.com") {
        navigate("/vaishali");
      }else if (emp === "nayanpreet123@gmail.com") {
        navigate("/nayanpreet");
      }else if (emp === "vicky123@gmail.com") {
        navigate("/vicky");
      }else if (emp === "vimal123@gmail.com") {
        navigate("/vimal");
      }else if (emp === "chandrabhusan123@gmail.com") {
        navigate("/chandrabhusan");
      }else if (emp === "tushar123@gmail.com") {
        navigate("/tushar");
      }else if (emp === "lucky123@gmail.com") {
        navigate("/lucky");
      }else if (emp === "trdewandan123@gmail.com") {
        navigate("/trdewangan");
      }else if (emp === "khemlal123@gmail.com") {
        navigate("/khemlalsahu");
      }else if (emp === "jitendra123@gmail.com") {
        navigate("/jitendra");
      }else if (emp === "rohit123@gmail.com") {
        navigate("/rohitvibhar");
      }else if (emp === "shubham123@gmail.com") {
        navigate("/shubham");
      }else if (emp === "niraj123@gmail.com") {
        navigate("/niraj");
      }else if (emp === "suraj123@gmail.com") {
        navigate("/suraj");
      }else if (emp === "kundan123@gmail.com") {
        navigate("/kundan");
      }else if (emp === "akash123@gmail.com") {
        navigate("/akash");
      }else if (emp === "vikas123@gmail.com") {
        navigate("/vikas");
      }else if (emp === "fulesh123@gmail.com") {
        navigate("/fulesh");
      }else if (emp === "gauri123@gmail.com") {
        navigate("/gauri");
      }else if (emp === "kishan123@gmail.com") {
        navigate("/kishan");
      }else if (emp === "dayalu123@gmail.com") {
        navigate("/dayalu");
      }else if (emp === "jeetu123@gmail.com") {
        navigate("/jeetu");
      }else if (emp === "nitish123@gmail.com") {
        navigate("/nitish");
      }

    } else {
      alert("Invalid Employee Name or Password");
    }
  };

  return (
    <div className="login-container">
      {/* LEFT PANEL */}
      <div className="left-panel">
        <div className="circle circle1"></div>
        <div className="circle circle2"></div>

        <div className="left-content">
          <div className="company-section">
            <h1>Agrawal Jain & Co.</h1>
            <p>ERP Portal</p>
          </div>

          <div className="main-heading">
            <h2>
              Workforce <br />
              Management <br />
              System
            </h2>
          </div>

          <div className="feature-grid">
            <div className="feature-box">
              Employee Management
            </div>

            <div className="feature-box">
              Attendance Monitoring
            </div>

            <div className="feature-box">
              Role Based Access
            </div>

            <div className="feature-box">
              Workflow Automation
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="right-panel">
        <div className="login-box">
          <div className="login-top">
            <h2>Welcome Back</h2>
            <p>Login to continue</p>
          </div>

          {/* EMPLOYEE NAME */}
          <div className="form-group">
            <label>Employee Name</label>

            <input
              type="text"
              placeholder="Enter Employee Name"
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
            />
          </div>

          {/* PASSWORD */}
          <div className="form-group">
            <label>Password</label>

            <input
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleLogin();
                }
              }}
            />
          </div>

          {/* LOGIN BUTTON */}
          <button
            className="login-btn"
            onClick={handleLogin}
          >
            Login
          </button>

          <div className="footer">
            © 2026 Agrawal Jain & Co.
          </div>
        </div>
      </div>
    </div>
  );
}