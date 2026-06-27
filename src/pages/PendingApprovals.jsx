import React, { useEffect, useState } from "react";

function PendingApprovals() {

  const [data, setData] = useState([]);

  useEffect(() => {

    fetch(
      "https://script.google.com/macros/s/AKfycbymzWnlj4s2mXkR1-ZcFxFgy6feBlwUNZkZs5J_yNJdCyTnHWxFb2juVkl-uT1ekcRC/exec"
    )
      .then((res) => res.json())
      .then((result) => {

        setData(result);

      })
      .catch((error) => {

        console.log(error);

      });

  }, []);

  return (

    <div style={styles.page}>

      {/* HEADER */}

      <div style={styles.header}>

        <h1 style={styles.heading}>
          Pending Approvals
        </h1>

        <p style={styles.subHeading}>
          Agrawal Jain & Co.
        </p>

      </div>

      {/* TABLE */}

      <div style={styles.tableWrapper}>

        <table style={styles.table}>

          <thead>

            <tr>

              <th style={styles.th}>
                SR.NO
              </th>

              <th style={styles.th}>
                UNIQUE CODE
              </th>

              <th style={styles.th}>
                TimeStamp
              </th>

            </tr>

          </thead>

          <tbody>

            {data.length > 0 ? (

              data.map((item, index) => (

                <tr
                  key={index}
                  style={
                    index % 2 === 0
                      ? styles.rowEven
                      : styles.rowOdd
                  }
                >

                  <td style={styles.td}>
                    {item.srno}
                  </td>

                  <td style={styles.td}>
                    {item.uniquecode}
                  </td>

                  <td style={styles.td}>
                    {new Date(item.timestamp)
                      .toLocaleDateString("en-GB")}
                  </td>

                </tr>

              ))

            ) : (

              <tr>

                <td
                  colSpan="3"
                  style={styles.noData}
                >
                  LOADING.......
                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

    </div>

  );
}

const styles = {

  page:{
    minHeight:"100vh",

    background:"#edf2f7",

    padding:"40px",

    fontFamily:"Arial",

    overflowY:"auto",

    boxSizing:"border-box",
  },

  header:{
    marginBottom:"30px",
  },

  heading:{
    fontSize:"42px",

    fontWeight:"700",

    color:"#0f172a",

    margin:"0",
  },

  subHeading:{
    marginTop:"8px",

    fontSize:"18px",

    color:"#64748b",
  },

  tableWrapper:{
    width:"100%",

    background:"#ffffff",

    border:"1px solid #d1d5db",

    overflowX:"auto",
  },

  table:{
    width:"100%",

    borderCollapse:"collapse",
  },

  th:{
    background:"#f3f4f6",

    color:"#111827",

    padding:"14px",

    textAlign:"left",

    fontSize:"15px",

    fontWeight:"700",

    border:"1px solid #d1d5db",
  },

  td:{
    padding:"14px",

    fontSize:"15px",

    color:"#111827",

    border:"1px solid #d1d5db",
  },

  rowEven:{
    background:"#ffffff",
  },

  rowOdd:{
    background:"#ffffff",
  },

  noData:{
    textAlign:"center",

    padding:"30px",

    fontSize:"15px",

    color:"#64748b",
  },

};

export default PendingApprovals;