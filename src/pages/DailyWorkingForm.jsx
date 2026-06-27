import React,
{
  useEffect,
  useState
}
from "react";

import "./DailyWorkingForm.css";

function DailyWorkingForm() {

  const [masterData, setMasterData] =
    useState([]);

  const [dropdowns, setDropdowns] =
    useState({

      periods: [],
      doers: [],
      locations: [],
      departments: [],

    });

  const [formData, setFormData] =
    useState({

      date: "",
      doerName: "",
      location: "",

    });

  const [rows, setRows] =
    useState([
      {
        period: "",
        department: "",
        groupName: "",
        companyName: "",
        taskDescription: "",
        timeGiven: "",
      }
    ]);

  const [loading, setLoading] =
    useState(false);

  /* DROPDOWN API */

  const DROPDOWN_API =
    "https://script.google.com/macros/s/AKfycbxwHdK3tBY71gamETPbtIhPcZXavQU4cpAVWoiBJCb-n8wBYFqLc4KpvSJfajoGbNVU/exec";

  /* RESPONSE API */

  const RESPONSE_API =
    "https://script.google.com/macros/s/AKfycbwneVUJJ4CwK1ODKRCtERmpzkGU0aBKeMso3GOu3ptypHhpZm73-Iq0OU6GTCSinjPkgg/exec";

  /* FETCH DATA */

  useEffect(() => {

    fetch(DROPDOWN_API)

      .then((res) => res.json())

      .then((data) => {

        setMasterData(
          data.masterData || []
        );

        setDropdowns({

          periods:
            data.periods || [],

          doers:
            data.doers || [],

          locations:
            data.locations || [],

          departments:
            data.departments || [],

        });

      })

      .catch((err) => {

        console.log(err);

      });

  }, []);

  /* COMMON CHANGE */

  const handleChange = (e) => {

    setFormData({

      ...formData,

      [e.target.name]:
        e.target.value,

    });

  };

  /* ROW CHANGE */

  const handleRowChange =
    (index, field, value) => {

      const updatedRows =
        [...rows];

      updatedRows[index][field] =
        value;

      if (field === "department") {

        updatedRows[index].groupName = "";
        updatedRows[index].companyName = "";

      }

      if (field === "groupName") {

        updatedRows[index].companyName = "";

      }

      setRows(updatedRows);

    };

  /* ADD ROW */

  const addRow = () => {

    setRows([
      ...rows,
      {
        period: "",
        department: "",
        groupName: "",
        companyName: "",
        taskDescription: "",
        timeGiven: "",
      }
    ]);

  };

  /* REMOVE ROW */

  const removeRow = (index) => {

    const updatedRows =
      [...rows];

    updatedRows.splice(index, 1);

    setRows(updatedRows);

  };

  /* SUBMIT */

  const handleSubmit =
    async (e) => {

      e.preventDefault();

      setLoading(true);

      try {

        for (const row of rows) {

          const finalData = {

            date:
              formData.date,

            doerName:
              formData.doerName,

            location:
              formData.location,

            period:
              row.period,

            department:
              row.department,

            groupName:
              row.groupName,

            companyName:
              row.companyName,

            taskDescription:
              row.taskDescription,

            timeGiven:
              row.timeGiven,

          };

          await fetch(
            RESPONSE_API,
            {
              method: "POST",
              mode: "no-cors",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify(
                  finalData
                ),
            }
          );

        }

        alert(
          "All Entries Submitted Successfully"
        );

        setFormData({

          date: "",
          doerName: "",
          location: "",

        });

        setRows([
          {
            period: "",
            department: "",
            groupName: "",
            companyName: "",
            taskDescription: "",
            timeGiven: "",
          }
        ]);

      }

      catch (error) {

        console.log(error);

        alert(
          "Submission Failed"
        );

      }

      setLoading(false);

    };

  return (

    <div className="dw-page">

      <div className="dw-header">

        <h1>
          Daily Working Form
        </h1>

        <p>
          Agrawal Jain & Co.
        </p>

      </div>

      <form
        className="dw-form"
        onSubmit={handleSubmit}
      >

        {/* COMMON FIELDS */}

        <div className="common-grid">

          {/* DATE */}

          <div>

            <label>
              Date
            </label>

            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />

          </div>

          {/* DOER */}

          <div>

            <label>
              Doer Name
            </label>

            <select
              name="doerName"
              value={formData.doerName}
              onChange={handleChange}
              required
            >

              <option value="">
                Select Employee
              </option>

              {dropdowns.doers.map(
                (item, index) => (

                  <option
                    key={index}
                    value={item}
                  >
                    {item}
                  </option>

                )
              )}

            </select>

          </div>

          {/* LOCATION */}

          <div>

            <label>
              Location
            </label>

            <select
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
            >

              <option value="">
                Select Location
              </option>

              {dropdowns.locations.map(
                (item, index) => (

                  <option
                    key={index}
                    value={item}
                  >
                    {item}
                  </option>

                )
              )}

            </select>

          </div>

        </div>

        {/* TABLE */}

        <div className="multi-table">

          <div className="multi-head">

            <div>Period</div>
            <div>Department</div>
            <div>Group Name</div>
            <div>Company Name</div>
            <div>Task Description</div>
            <div>Time Given</div>
            <div>Action</div>

          </div>

          {rows.map((row, index) => {

            const filteredGroups =
              masterData.filter(
                (item) =>
                  item.department ===
                  row.department
              );

            const uniqueGroups =
              [...new Set(
                filteredGroups.map(
                  (item) =>
                    item.groupName
                )
              )];

            const filteredCompanies =
              masterData.filter(
                (item) =>

                  item.department ===
                    row.department &&

                  item.groupName ===
                    row.groupName
              );

            const uniqueCompanies =
              [...new Set(
                filteredCompanies.map(
                  (item) =>
                    item.companyName
                )
              )];

            return (

              <div
                className="multi-row"
                key={index}
              >

                {/* PERIOD */}

                <select
                  value={row.period}
                  onChange={(e) =>
                    handleRowChange(
                      index,
                      "period",
                      e.target.value
                    )
                  }
                  required
                >

                  <option value="">
                    Select
                  </option>

                  {dropdowns.periods.map(
                    (item, i) => (

                      <option
                        key={i}
                        value={item}
                      >
                        {item}
                      </option>

                    )
                  )}

                </select>

                {/* DEPARTMENT */}

                <select
                  value={row.department}
                  onChange={(e) =>
                    handleRowChange(
                      index,
                      "department",
                      e.target.value
                    )
                  }
                  required
                >

                  <option value="">
                    Select
                  </option>

                  {dropdowns.departments.map(
                    (item, i) => (

                      <option
                        key={i}
                        value={item}
                      >
                        {item}
                      </option>

                    )
                  )}

                </select>

                {/* GROUP */}

                <select
                  value={row.groupName}
                  onChange={(e) =>
                    handleRowChange(
                      index,
                      "groupName",
                      e.target.value
                    )
                  }
                  required
                >

                  <option value="">
                    Select
                  </option>

                  {uniqueGroups.map(
                    (item, i) => (

                      <option
                        key={i}
                        value={item}
                      >
                        {item}
                      </option>

                    )
                  )}

                </select>

                {/* COMPANY */}

                <select
                  value={row.companyName}
                  onChange={(e) =>
                    handleRowChange(
                      index,
                      "companyName",
                      e.target.value
                    )
                  }
                  required
                >

                  <option value="">
                    Select
                  </option>

                  {uniqueCompanies.map(
                    (item, i) => (

                      <option
                        key={i}
                        value={item}
                      >
                        {item}
                      </option>

                    )
                  )}

                </select>

                {/* TASK */}

                <input
                  type="text"
                  placeholder="Task Description"
                  value={row.taskDescription}
                  onChange={(e) =>
                    handleRowChange(
                      index,
                      "taskDescription",
                      e.target.value
                    )
                  }
                  required
                />

                {/* TIME */}

                <input
                  type="time"
                  value={row.timeGiven}
                  onChange={(e) =>
                    handleRowChange(
                      index,
                      "timeGiven",
                      e.target.value
                    )
                  }
                  required
                />

                {/* REMOVE */}

                <button
                  type="button"
                  className="remove-btn"
                  onClick={() =>
                    removeRow(index)
                  }
                >
                  Remove
                </button>

              </div>

            );

          })}

        </div>

        {/* BUTTONS */}

        <div className="bottom-btns">

          <button
            type="button"
            className="add-row-btn"
            onClick={addRow}
          >
            + Add Row
          </button>

          <button
            type="submit"
            disabled={loading}
            className="submit-btn"
          >

            {loading
              ? "Submitting..."
              : "Submit All Entries"}

          </button>

        </div>

      </form>

    </div>

  );

}

export default DailyWorkingForm;