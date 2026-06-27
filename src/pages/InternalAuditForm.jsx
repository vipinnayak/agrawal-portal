import React, { useEffect, useState } from "react";
import "./InternalAuditForm.css";

const MASTER_API =
"https://script.google.com/macros/s/AKfycbxpFa9JECyoDVSjtH7lfwNH7gAOxOUjr74vYb1n1dYG9YVsw7_veYlEPIz2ak-znDTH/exec";

const RESPONSE_API =
"https://script.google.com/macros/s/AKfycbyDHb4L61YI6F9tR_Urn1H5x6OW1R8kvSJgYt9oVZqfiWDOaglXZu2LaHQVMN7JEXzF/exec";

export default function InternalAuditForm() {

  const [masterData, setMasterData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    groupName: "",
    companyName: "",
    iaPeriod: "",
    partner: "",
    otherCA: "",
    assignmentType: "",
    startDate: "",
    targetDate: ""
  });

  useEffect(() => {

    fetch(MASTER_API)
      .then((res) => res.json())
      .then((data) => {
        setMasterData(data.rows || []);
      })
      .catch((err) => {
        console.log(err);
      });

  }, []);

  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value
    });

  };

  const handleSubmit = async (e) => {

    e.preventDefault();

    setLoading(true);

    try {

      const response = await fetch(
        RESPONSE_API,
        {
          method: "POST",
          mode: "no-cors",
          body: JSON.stringify(form)
        }
      );

      console.log("Submitted", response);

      alert("✅ Audit Submitted Successfully");

      setForm({
        groupName: "",
        companyName: "",
        iaPeriod: "",
        partner: "",
        otherCA: "",
        assignmentType: "",
        startDate: "",
        targetDate: ""
      });

    } catch (error) {

      console.error(error);

      alert("❌ Error Saving Data");

    }

    setLoading(false);

  };

  return (

    <div className="audit-page">

      <div className="glass-form">

        <h1>Internal Audit Form</h1>

        <form onSubmit={handleSubmit}>

          <div className="form-group">

            <label>Group Name</label>

            <select
              name="groupName"
              value={form.groupName}
              onChange={handleChange}
              required
            >
              <option value="">Select Group</option>

              {[...new Set(masterData.map(r => r[0]))]
                .filter(Boolean)
                .map((item, index) => (
                  <option
                    key={index}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
            </select>

          </div>

          <div className="form-group">

            <label>Company Name</label>

            <select
              name="companyName"
              value={form.companyName}
              onChange={handleChange}
              required
            >
              <option value="">Select Company</option>

              {[...new Set(masterData.map(r => r[1]))]
                .filter(Boolean)
                .map((item, index) => (
                  <option
                    key={index}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
            </select>

          </div>

          <div className="form-group">

            <label>IA Period</label>

            <select
              name="iaPeriod"
              value={form.iaPeriod}
              onChange={handleChange}
              required
            >
              <option value="">Select IA Period</option>

              {[...new Set(masterData.map(r => r[3]))]
                .filter(Boolean)
                .map((item, index) => (
                  <option
                    key={index}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
            </select>

          </div>

          <div className="form-group">

            <label>Partner's Incharge</label>

            <select
              name="partner"
              value={form.partner}
              onChange={handleChange}
              required
            >
              <option value="">Select Partner</option>

              {[...new Set(masterData.map(r => r[4]))]
                .filter(Boolean)
                .map((item, index) => (
                  <option
                    key={index}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
            </select>

          </div>

          <div className="form-group">

            <label>Other's CA Involved</label>

            <select
              name="otherCA"
              value={form.otherCA}
              onChange={handleChange}
            >
              <option value="">Select CA</option>

              {[...new Set(masterData.map(r => r[5]))]
                .filter(Boolean)
                .map((item, index) => (
                  <option
                    key={index}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
            </select>

          </div>

          <div className="form-group">

            <label>Assignment Type</label>

            <select
              name="assignmentType"
              value={form.assignmentType}
              onChange={handleChange}
              required
            >
              <option value="">Select Assignment</option>

              {[...new Set(masterData.map(r => r[6]))]
                .filter(Boolean)
                .map((item, index) => (
                  <option
                    key={index}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
            </select>

          </div>

          <div className="form-group">

            <label>Start Date</label>

            <input
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={handleChange}
              required
            />

          </div>

          <div className="form-group">

            <label>Target Date</label>

            <input
              type="date"
              name="targetDate"
              value={form.targetDate}
              onChange={handleChange}
              required
            />

          </div>

          <button
            type="submit"
            className="submit-btn"
            disabled={loading}
          >
            {loading ? "Saving..." : "Submit Audit"}
          </button>

        </form>

      </div>

    </div>

  );

}