import React, { useEffect, useState } from "react";
import "./InternalAuditFMS.css";import { useNavigate } from "react-router-dom";
export default function InternalAuditFMS() {

  const API =
  "https://script.google.com/macros/s/AKfycbzLrYemM772sgYveZ-P9o1hhPlM4wUds5HxCVbRdFlyOu_cr_M5g_DDWRJfY6QncCxNWw/exec";

  const [rows,setRows] = useState([]);
  const [selected,setSelected] = useState(0);const navigate = useNavigate();


  useEffect(() => {

    fetch(API)
      .then(res => res.json())
      .then(data => {

        const result =
          data.data || data;

        setRows(result);

      })
      .catch(err =>
        console.log(err)
      );

  }, []);

  const row =
    rows[selected] || [];

  const getStep = (stepNo) => {

    const start =
      11 + ((stepNo - 1) * 4);

    return {
      planned: row[start] || "",
      actual: row[start + 1] || "",
      status: row[start + 2] || "",
      delay: row[start + 3] || ""
    };
  };

  const StepCard = ({
    title,
    owner,
    method,
    when,
    data
  }) => (

    <div className="stepCard">

      <div className="stepHeader">
        {title}
      </div>

      <div className="stepBody">

        <div className="stepRow">
          <b>Owner</b>
          <span>{owner}</span>
        </div>

        <div className="stepRow">
          <b>Method</b>
          <span>{method}</span>
        </div>

        <div className="stepRow">
          <b>When</b>
          <span>{when}</span>
        </div>

        <div className="resultGrid">

          <div>
            <label>Planned</label>
            <p>{data.planned}</p>
          </div>

          <div>
            <label>Actual</label>
            <p>{data.actual}</p>
          </div>

          <div>
            <label>Status</label>
            <p>{data.status}</p>
          </div>

          <div>
            <label>Delay</label>
            <p>{data.delay}</p>
          </div>

        </div>

      </div>

    </div>

  );

  return (

    <div className="fmsPage">

      <div className="fmsTop">

        <h1>
          Internal Audit FMS
        </h1>
<div className="header-buttons">

  <button
    className="header-btn fms-btn"
    onClick={() => navigate("/internalauditdetails")}
  >
    📊 View Internal Audit FMS
  </button>

  <button
    className="header-btn form-btn"
    onClick={() => navigate("/internalauditform")}
  >
    📝 Internal Audit Form
  </button>

</div>
        <p>
          Agrawal Jain & Co.
        </p>

      </div>

      <select
        className="auditSelect"
        value={selected}
        onChange={(e)=>
          setSelected(
            Number(e.target.value)
          )
        }
      >

        {rows.map((r,index)=>(
          <option
            key={index}
            value={index}
          >
            {r[0]}
          </option>
        ))}

      </select>

      <div className="masterSection">

        <div className="masterGrid">

          <div>
            <label>UI</label>
            <p>{row[0]}</p>
          </div>

          <div>
            <label>Time Stamp</label>
            <p>{row[1]}</p>
          </div>

          <div>
            <label>Group Name</label>
            <p>{row[2]}</p>
          </div>

          <div>
            <label>Company Name</label>
            <p>{row[3]}</p>
          </div>

          <div>
            <label>Department</label>
            <p>{row[4]}</p>
          </div>

          <div>
            <label>IA Period</label>
            <p>{row[5]}</p>
          </div>

          <div>
            <label>Partner</label>
            <p>{row[6]}</p>
          </div>

          <div>
            <label>Senior</label>
            <p>{row[7]}</p>
          </div>

          <div>
            <label>Assignment Type</label>
            <p>{row[8]}</p>
          </div>

          <div>
            <label>Start Date</label>
            <p>{row[9]}</p>
          </div>

          <div>
            <label>Target Date</label>
            <p>{row[10]}</p>
          </div>

        </div>

      </div>

      <div className="stepsWrapper">

        <StepCard
          title="STEP-1"
          owner="PARTNERS"
          method="Expected Start & End Date Form"
          when="Beginning Of Financial Year"
          data={getStep(1)}
        />

        <StepCard
          title="STEP-2"
          owner="SENIOR"
          method="Phone Call / Mail / Whatsapp"
          when="Before Audit"
          data={getStep(2)}
        />

        <StepCard
          title="STEP-3"
          owner="PARTNERS"
          method="Online"
          when="1 Week Before Audit"
          data={getStep(3)}
        />

        <StepCard
          title="STEP-4"
          owner="PARTNERS"
          method="Audit Programme"
          when="Planning Stage"
          data={getStep(4)}
        />

        <StepCard
          title="STEP-5"
          owner="SENIOR"
          method="Email / Whatsapp"
          when="1 Day Before Audit"
          data={getStep(5)}
        />

        <StepCard
          title="STEP-6"
          owner="SENIOR"
          method="Meet HODs"
          when="Audit Start Day"
          data={getStep(6)}
        />

        <StepCard
          title="STEP-7"
          owner="SENIOR"
          method="Daily Review"
          when="Daily"
          data={getStep(7)}
        />
                <StepCard
          title="STEP-8"
          owner="PARTNERS"
          method="Weekly Discussion"
          when="Tuesday Review Meeting"
          data={getStep(8)}
        />

        <StepCard
          title="STEP-9"
          owner="SENIOR"
          method="Discuss Draft Report"
          when="Before Final Report"
          data={getStep(9)}
        />

        <StepCard
          title="STEP-10"
          owner="SENIOR"
          method="Take HOD Responses"
          when="Before Submission"
          data={getStep(10)}
        />

        <StepCard
          title="STEP-11"
          owner="PARTNERS"
          method="Physical Meeting"
          when="Executive Summary"
          data={getStep(11)}
        />

        <StepCard
          title="STEP-12"
          owner="CRM"
          method="Physical Meeting"
          when="Owner Discussion"
          data={getStep(12)}
        />

        <StepCard
          title="STEP-13"
          owner="PARTNERS"
          method="Board Meeting"
          when="Final Discussion"
          data={getStep(13)}
        />

        <StepCard
          title="STEP-14"
          owner="SENIOR"
          method="Executive Summary Upload"
          when="After Completion"
          data={getStep(14)}
        />

        <StepCard
          title="STEP-15"
          owner="SENIOR"
          method="Benefit Chart Update"
          when="Post Audit"
          data={getStep(15)}
        />

        <StepCard
          title="STEP-16"
          owner="Accounts Department"
          method="Billing & Receipt"
          when="After Report"
          data={getStep(16)}
        />

        <StepCard
          title="STEP-17"
          owner="HR Head"
          method="Cost Sheet"
          when="Final Closure"
          data={getStep(17)}
        />

      </div>

    </div>

  );
}