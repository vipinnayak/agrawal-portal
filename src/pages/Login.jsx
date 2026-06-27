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

    "naresh123@gmail.com": "naresh123",

    ACCOUNTANT: "acc123",

    CRM: "crm123",

    EA: "ea123",

    "ADMIN(MD)": "admin123",
     "rajeshagrawal123@gmail.com": "md123",

    "harshmittal123@gmail.com": "harsh123",
    "harshsharma123@gmail.com": "harsh123",
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
    "diptiverma123@gmail.com":"dipti123",
    "sikhagupta123@gmail.com":"sikha123",
    "yanagendle123@gmail.com":"yana123",
    "tarunrathi123@gmail.com":"tarun123",
    "aryamandhar123@gmail.com":"aryaman123",
    "vikassonwani123@gmail.com":"vikas123",
    "piyuverma123@gmail.com":"piyush123",
    "simranpatnaik123@gmail.com":"simran123",
    "shubhamverma123@gmail.com":"shubham123",
    "sanidhyanahar123@gmail.com":"sanidhya123",
    "poojagupta123@gmail.com":"pooja123",
    "simransingh123@gmail.com":"simran123",
    "prakharvaid123@gmail.com":"prakhar123",
    "adityaraj123@gmail.com":"aditya123",
    "chetnaagrawal123@gmail.com":"chetna123",
    "saniadalwani123@gmail.com":"sania123",
    "anirudhagrawal123@gmail.com":"anirudh123",
    "palakdodani123@gmail.com":"palak123",
    "harshgupta123@gmail.com":"harsh123",
    "nikhildawani123@gmail.com":"nikhil123",
    "akshitaagrawal123@gmail.com":"akshita123",
    "sarthakjain123@gmail.com":"sarthak123",
    "mahakjain123@gmail.com":"mahak123",
    "pihuagrawal123@gmail.com":"pihu123",
    "sonalmeghani123@gmail.com":"sonalmeghani123",
    "deevyaverma123@gmail.com":"deevya123",
    "yogeshsonkar123@gmail.com":"yogesh123",
    "muktipathak123@gmail.com":"mukti123",
    "shushanttiwari123@gmail.com":"shushant123",
    "devdilip123@gmail.com":"dev123",

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
      } else if (emp === "naresh123@gmail.com") {
        navigate("/naresh-prajapati");
      } else if (emp === "harshmittal123@gmail.com") {
        navigate("/ca-harsh-mittal");
      } else if (emp === "harshsharma123@gmail.com") {
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
      }else if (emp === "neeraj123@gmail.com") {
        navigate("/neeraj");
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
      }else if (emp === "diptiverma123@gmail.com") {
        navigate("/dipti");
      }else if (emp === "sikhagupta123@gmail.com") {
        navigate("/sikha");
      }else if (emp === "yanagendle123@gmail.com") {
        navigate("/yana");
      }else if (emp === "tarunrathi123@gmail.com") {
        navigate("/tarun");
      }else if (emp === "aryamandhar123@gmail.com") {
        navigate("/aryaman");
      }else if (emp === "vikassonwani123@gmail.com") {
        navigate("/vikas-sonwani");
      }else if (emp === "piyushverma123@gmail.com") {
        navigate("/piyush");
      }else if (emp === "ankitsingh123@gmail.com") {
        navigate("/ankit-singh");
      }else if (emp === "poorvasharma123@gmail.com") {
        navigate("/poorva");
      }else if (emp === "simranpatnaik123@gmail.com") {
        navigate("/simran-patnaik");
      }else if (emp === "shubhamverma123@gmail.com") {
        navigate("/shubham-verma");
      }else if (emp === "sanidhyanahar123@gmail.com") {
        navigate("/sanidhya");
      }else if (emp === "poojagupta123@gmail.com") {
        navigate("/pooja-gupta");
      }else if (emp === "simransingh123@gmail.com") {
        navigate("/simran-singh");
      }else if (emp === "prakharvaid123@gmail.com") {
        navigate("/prakhar");
      }else if (emp === "adityaraj123@gmail.com") {
        navigate("/adityaraj");
      }else if (emp === "chetnaagrawal123@gmail.com") {
        navigate("/chetna");
      }else if (emp === "saniadalwani123@gmail.com") {
        navigate("/sania");
      }else if (emp === "anirudhagrawal123@gmail.com") {
        navigate("/anirudh");
      }else if (emp === "palakdodani123@gmail.com") {
        navigate("/palak");
      }else if (emp === "harshgupta123@gmail.com") {
        navigate("/harsh-gupta");
      }else if (emp === "nikhildawani123@gmail.com") {
        navigate("/nikhil");
      }else if (emp === "akshitaagrawal123@gmail.com") {
        navigate("/akshita");
      }else if (emp === "sarthakjain123@gmail.com") {
        navigate("/sarthak");
      }else if (emp === "mahakjain123@gmail.com") {
        navigate("/mahak");
      }else if (emp === "pihuagrawal123@gmail.com") {
        navigate("/pihu");
      }else if (emp === "sonalmeghani123@gmail.com") {
        navigate("/sonal");
      }else if (emp === "deevyaverma123@gmail.com") {
        navigate("/deevya");
      }else if (emp === "yogeshsonkar123@gmail.com") {
        navigate("/yogesh");
      }else if (emp === "muktipathak123@gmail.com") {
        navigate("/mukti");
      }else if (emp === "shushanttiwari123@gmail.com") {
        navigate("/shushant");
      }else if (emp === "devdilip123@gmail.com") {
        navigate("/devdilip");
      }else if (emp === "rajeshagrawal123@gmail.com") {
        navigate("/rajesh-agrawal");
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