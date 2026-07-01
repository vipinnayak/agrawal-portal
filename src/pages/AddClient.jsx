import React, { useEffect, useState } from "react";
import "./AddClient.css";

const DEPARTMENT_API =
  "https://script.google.com/macros/s/AKfycbxSuAy8gxpc_d8WRKLtVd99xrdyJDUTTnh_bwS0cx0Pr1xukGPvoxGb0_q0wSgi99C7/exec";

const SAVE_API =
  "https://script.google.com/macros/s/AKfycbxDkAyXtd2y5FKA0oGqxI0W3JZi3da1IgvZd-2oyaHMqmAJzywjgysdUBJI-3TjzZU40w/exec";

export default function AddClient() {

  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(false);

  const [rows, setRows] = useState([
    {
      type: "",
      group: "",
      company: "",
      department: "",
    },
  ]);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {

      const res = await fetch(DEPARTMENT_API);

      const data = await res.json();

      setDepartments(data);

    } catch (err) {

      console.log(err);

    //   alert("Unable to load departments.");

    }
  };
    const handleChange = (index, field, value) => {

    const temp = [...rows];

    temp[index][field] = value;

    setRows(temp);

  };

  const addRow = () => {

    setRows([
      ...rows,
      {
        type: "",
        group: "",
        company: "",
        department: "",
      },
    ]);

  };

  const deleteRow = (index) => {

    if (rows.length === 1) return;

    const temp = [...rows];

    temp.splice(index, 1);

    setRows(temp);

  };

  const handleSubmit = async () => {

    for (let r of rows) {

      if (
        !r.type ||
        !r.group ||
        !r.company ||
        !r.department
      ) {

        alert("Please fill all fields.");

        return;

      }

    }

    setLoading(true);

    try {

      const response = await fetch(SAVE_API, {

        method: "POST",

        body: JSON.stringify(rows),

      });

      const result = await response.json();

      console.log(result);

      alert("Client Added Successfully");

      setRows([
        {
          type: "",
          group: "",
          company: "",
          department: "",
        },
      ]);

    } catch (err) {

      console.log(err);

      alert("Unable to Save");

    }

    setLoading(false);

  };
    return (

    <div className="add-client-page">

      <div className="glass-card">

      <div className="page-header">

  <div>

    <h1>Add Client</h1>

    <p>Add one or multiple client records.</p>

  </div>

  <button
    className="add-row-btn"
    onClick={addRow}
  >
    + Add Another Row
  </button>

</div>

        <div className="table-wrapper">

          <table>

            <thead>

              <tr>

                <th>Type of Client</th>

                <th>Group Name</th>

                <th>Company Name</th>

                <th>Department</th>

                <th>Action</th>

              </tr>

            </thead>

            <tbody>

              {rows.map((row,index)=>(

                <tr key={index}>

                  <td>

                    <select

                      value={row.type}

                      onChange={(e)=>

                        handleChange(

                          index,

                          "type",

                          e.target.value

                        )

                      }

                    >

                      <option value="">
                        Select
                      </option>

                      <option>A</option>

                      <option>B</option>

                      <option>C</option>

                    </select>

                  </td>

                  <td>

                    <input

                      type="text"

                      placeholder="Group Name"

                      value={row.group}

                      onChange={(e)=>

                        handleChange(

                          index,

                          "group",

                          e.target.value

                        )

                      }

                    />

                  </td>

                  <td>

                    <input

                      type="text"

                      placeholder="Company Name"

                      value={row.company}

                      onChange={(e)=>

                        handleChange(

                          index,

                          "company",

                          e.target.value

                        )

                      }

                    />

                  </td>

                  <td>

                    <select

                      value={row.department}

                      onChange={(e)=>

                        handleChange(

                          index,

                          "department",

                          e.target.value

                        )

                      }

                    >

                      <option value="">
                        Department
                      </option>

                      {

                        departments.map(

                          (d,i)=>(

                            <option

                              key={i}

                              value={d}

                            >

                              {d}

                            </option>

                          )

                        )

                      }

                    </select>

                  </td>

                  <td>

                    <button

                      className="delete-btn"

                      onClick={()=>

                        deleteRow(index)

                      }

                    >

                      ❌

                    </button>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

        <button

          className="submit-btn"

          onClick={handleSubmit}

          disabled={loading}

        >

          {

            loading

            ?

            "Saving..."

            :

            "Save Client"

          }

        </button>

      </div>

    </div>

  );

}