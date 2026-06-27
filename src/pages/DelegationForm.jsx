import React, { useEffect, useState } from "react";
import "./DelegationForm.css";

export default function DelegationForm() {

  // DROPDOWN API
  const DROPDOWN_API =
    "https://script.google.com/macros/s/AKfycbxwvFdgKYvxbiIjzv47cehwbrE33FoD7KzTC6D4n0m5A7gJyNzWwdCJblKRMFZG46pt/exec";

  // RESPONSE API
  const RESPONSE_API =
    "https://script.google.com/macros/s/AKfycbzYuE7Ohl-EoHPn3RHXyx3kev7fVi5P_LTZip-se84Tl8M8izi7c4Vvz42lH9TMcir-/exec";

  // DROPDOWN STATES
  const [assignorNames, setAssignorNames] = useState([]);
  const [doerNames, setDoerNames] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [groupNames, setGroupNames] = useState([]);
  const [clientNames, setClientNames] = useState([]);

  // FORM DATA
  const [formData, setFormData] = useState({
    assignorName: "",
    doerName: "",
    typeOfWork: "",
    groupName: "",
    clientName: "",
    taskDescription: "",
    targetDate: "",
  });

  // FETCH DROPDOWNS
  useEffect(() => {

    fetch(DROPDOWN_API)
      .then((res) => res.json())
      .then((data) => {

        console.log(data);

        setAssignorNames(data.assignorNames || []);
        setDoerNames(data.doerNames || []);
        setWorkTypes(data.typeOfWork || []);
        setGroupNames(data.groupNames || []);
        setClientNames(data.clientNames || []);

      })
      .catch((err) => {

        console.log(err);

        alert("Dropdown API Failed");

      });

  }, []);
// LOADING STATE
const [loading, setLoading] = useState(false);

// SUBMITTED STATE
const [submitted, setSubmitted] = useState(false);
  // HANDLE CHANGE
  const handleChange = (e) => {

    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

  };

  // SUBMIT
 // SUBMIT
const handleSubmit = async (e) => {

  e.preventDefault();

  setLoading(true);

  try {

    await fetch(RESPONSE_API, {
      method: "POST",
      body: JSON.stringify(formData),
    });

    setSubmitted(true);

    setTimeout(() => {
      setSubmitted(false);
    }, 2000);

    setFormData({
      assignorName: "",
      doerName: "",
      typeOfWork: "",
      groupName: "",
      clientName: "",
      taskDescription: "",
      targetDate: "",
    });

  } catch (error) {

    alert("❌ Submission Failed");

  }

  setLoading(false);

};
  return (

    <div className="delegation-page">

      <div className="delegation-card">

        <h1 className="delegation-title">
          Delegation Form
        </h1>

        <p className="delegation-subtitle">
          Agrawal Jain & Co.
        </p>

        <form onSubmit={handleSubmit}>

          <div className="delegation-grid">

            {/* ASSIGNOR */}

            <div className="field-box">

              <label>Assignor Name</label>

              <select
                name="assignorName"
                value={formData.assignorName}
                onChange={handleChange}
                required
              >

                <option value="">
                  Select Assignor
                </option>

                {assignorNames.map((item, index) => (
                  <option key={index} value={item}>
                    {item}
                  </option>
                ))}

              </select>

            </div>

            {/* DOER */}

            <div className="field-box">

              <label>Doer Name</label>

              <select
                name="doerName"
                value={formData.doerName}
                onChange={handleChange}
                required
              >

                <option value="">
                  Select Doer
                </option>

                {doerNames.map((item, index) => (
                  <option key={index} value={item}>
                    {item}
                  </option>
                ))}

              </select>

            </div>

            {/* TYPE OF WORK */}

            <div className="field-box">

              <label>Type Of Work</label>

              <select
                name="typeOfWork"
                value={formData.typeOfWork}
                onChange={handleChange}
                required
              >

                <option value="">
                  Select Type
                </option>

                {workTypes.map((item, index) => (
                  <option key={index} value={item}>
                    {item}
                  </option>
                ))}

              </select>

            </div>

            {/* GROUP */}

            <div className="field-box">

              <label>Group Name</label>

              <select
                name="groupName"
                value={formData.groupName}
                onChange={handleChange}
                required
              >

                <option value="">
                  Select Group
                </option>

                {groupNames.map((item, index) => (
                  <option key={index} value={item}>
                    {item}
                  </option>
                ))}

              </select>

            </div>

            {/* CLIENT */}

            <div className="field-box">

              <label>Client Name</label>

              <select
                name="clientName"
                value={formData.clientName}
                onChange={handleChange}
                required
              >

                <option value="">
                  Select Client
                </option>

                {clientNames.map((item, index) => (
                  <option key={index} value={item}>
                    {item}
                  </option>
                ))}

              </select>

            </div>

            {/* DATE */}

            <div className="field-box">

              <label>Target Completion Date</label>

              <input
                type="date"
                name="targetDate"
                value={formData.targetDate}
                onChange={handleChange}
                required
              />

            </div>

          </div>

          {/* TASK DESCRIPTION */}

          <div className="task-box">

            <label>Task Description</label>

            <textarea
              name="taskDescription"
              value={formData.taskDescription}
              onChange={handleChange}
              placeholder="Enter Task Description"
              required
            />

          </div>

          {/* BUTTON */}

         <button
  type="submit"
  className={`submit-btn ${submitted ? "submitted-btn" : ""}`}
>

  {
    loading
      ? "Submitting..."
      : submitted
      ? "Submitted Successfully ✓"
      : "Submit Delegation"
  }

</button>

        </form>

      </div>

    </div>

  );

}