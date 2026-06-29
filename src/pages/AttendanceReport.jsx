import { useEffect, useState } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "./AttendanceReport.css";

const API =
  "https://script.google.com/macros/s/AKfycbxp_-pPEH7FwJJu0o9AQHtklmRDfAqJ0SR-gqtJ5LPVsTDovyDtNnIwl1_p57yRSFSPyw/exec";

export default function AttendanceReport() {

  const [rows, setRows] = useState([]);

  useEffect(() => {

    fetch(API)
      .then((res) => res.json())
      .then((data) => {

        console.log(data);
        setRows(data);

      })
      .catch((err) => console.log(err));

  }, []);

  // Format Time
  const formatTime = (time) => {

    if (!time) return "";

    if (typeof time === "string") {

      if (/^\d{2}:\d{2}$/.test(time))
        return time;

      if (/^\d{2}:\d{2}:\d{2}$/.test(time))
        return time.substring(0,5);

      const d = new Date(time);

      if (!isNaN(d.getTime())) {

        return d.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

      }

    }

    return "";

  };

  const downloadExcel = async () => {

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Agrawal Jain & Co.";

    workbook.created = new Date();

    const sheet =
      workbook.addWorksheet(
        "Attendance Report"
      );

    sheet.views = [

      {
        state: "frozen",
        ySplit: 1,
      },

    ];
       sheet.columns = [

{header:"SR.NO",key:"sr",width:10},

{header:"EMPLOYEE NAME",key:"employee",width:30},

{header:"IN",key:"in",width:15},

{header:"OUT",key:"out",width:15},

{header:"CLIENT PLACE",key:"client",width:35},

{header:"LOCATION",key:"location",width:55},

];

    const header = sheet.getRow(1);

    header.height = 30;

    header.eachCell((cell) => {

      cell.font = {
        bold: true,
        color: {
          argb: "FFFFFFFF",
        },
        size: 13,
      };

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "2563EB",
        },
      };

      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      cell.border = {

        top: {
          style: "thin",
        },

        left: {
          style: "thin",
        },

        bottom: {
          style: "thin",
        },

        right: {
          style: "thin",
        },

      };

    });

    rows.forEach((item) => {

     const row = sheet.addRow({

    sr: item.SrNo,

    employee: item.Employee,

    in: item.In,

    out: item.Out,

    client: item.ClientPlace,

    location: item.Location,

});

      row.height = 24;

      row.eachCell((cell) => {

        cell.alignment = {

          vertical: "middle",

        };

        cell.border = {

          top: {
            style: "thin",
            color: {
              argb: "DDDDDD",
            },
          },

          left: {
            style: "thin",
            color: {
              argb: "DDDDDD",
            },
          },

          bottom: {
            style: "thin",
            color: {
              argb: "DDDDDD",
            },
          },

          right: {
            style: "thin",
            color: {
              argb: "DDDDDD",
            },
          },

        };

      });

      if (row.number % 2 === 0) {

        row.eachCell((cell) => {

          cell.fill = {

            type: "pattern",

            pattern: "solid",

            fgColor: {

              argb: "F5F9FF",

            },

          };

        });

      }

    });

    sheet.autoFilter = "A1:F1";

    const buffer =
      await workbook.xlsx.writeBuffer();

    saveAs(

      new Blob([buffer]),

      "Attendance_Report.xlsx"

    );

  };
    return (

    <div className="attendance-report-page">

      <div className="report-header">

        <div>

          <h1>
            Attendance Report
          </h1>

          <p>
            Download and View Employee Attendance Report
          </p>

        </div>

        <button
          className="download-btn"
          onClick={downloadExcel}
        >
          📥 Download Excel
        </button>

      </div>

      <div className="table-container">

        <table>

          <thead>

            <tr>

              <th>SR.NO</th>

              <th>Employee Name</th>

              <th>IN</th>

              <th>OUT</th>

              <th>Client Place</th>

              <th>Location</th>

            </tr>

          </thead>

         <tbody>

{rows.length === 0 ? (

<tr>
<td colSpan="6" style={{textAlign:"center",padding:"30px"}}>
No Attendance Found
</td>
</tr>

) : (

rows.map((row,index)=>(

<tr key={index}>

<td>{row.SrNo}</td>

<td>{row.Employee}</td>

<td>{row.In}</td>

<td>{row.Out}</td>

<td>{row.ClientPlace}</td>

<td>{row.Location}</td>

</tr>

))

)}

</tbody>

        </table>

      </div>

    </div>

  );}