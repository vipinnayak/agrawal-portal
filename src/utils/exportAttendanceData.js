import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Helper: Format 24-hr time string "10:30" to "10:30 AM"
const formatTimeAmPm = (timeStr) => {
  if (!timeStr) return "-";
  const match = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return timeStr;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

// Helper: Format date for filename
const getFormattedDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Export Attendance Data to Excel (.xlsx)
 * Contains:
 * - Summary sheet with KPI cards & category shift breakdowns
 * - Detailed sheet with all employee attendance records, statuses, working hours & locations
 * - Chat history sheet with AI conversation log
 */
export const exportAttendanceToExcel = async ({ attendanceMetrics, shiftPolicies, messages = [] }) => {
  if (!attendanceMetrics || !attendanceMetrics.evaluated) {
    alert("No attendance data available to export.");
    return false;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. - Attendance AI";
  workbook.created = new Date();

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const generatedTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // ==========================================
  // SHEET 1: ATTENDANCE ANALYSIS & DETAILED DATA
  // ==========================================
  const sheet = workbook.addWorksheet("Attendance Analysis");

  sheet.views = [
    {
      state: "frozen",
      ySplit: 11, // Freeze header row of the table
    },
  ];

  // Title Block
  sheet.mergeCells("A1:K1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "AGRAWAL JAIN & CO. - ATTENDANCE ANALYSIS & SHIFT REPORT";
  titleCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E3A8A" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 40;

  sheet.mergeCells("A2:K2");
  const subCell = sheet.getCell("A2");
  subCell.value = `Report Generated: ${todayStr} at ${generatedTime} | System: Real-Time Attendance AI Analyst`;
  subCell.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "FF334155" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 24;

  // Summary KPI Cards (Rows 4-5)
  sheet.mergeCells("A4:B4");
  sheet.getCell("A4").value = "TOTAL REGISTERED";
  sheet.mergeCells("C4:D4");
  sheet.getCell("C4").value = "PRESENT TODAY";
  sheet.mergeCells("E4:F4");
  sheet.getCell("E4").value = "ABSENT TODAY";
  sheet.mergeCells("G4:H4");
  sheet.getCell("G4").value = "EARLY LOGINS (< Cut-off)";
  sheet.mergeCells("I4:J4");
  sheet.getCell("I4").value = "LATE ARRIVALS (> Grace)";
  sheet.getCell("K4").value = "WITHIN GRACE";

  const kpiHeaderRow = sheet.getRow(4);
  kpiHeaderRow.height = 22;
  ["A4", "C4", "E4", "G4", "I4", "K4"].forEach((pos) => {
    const c = sheet.getCell(pos);
    c.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF475569" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });

  sheet.mergeCells("A5:B5");
  sheet.getCell("A5").value = attendanceMetrics.total;
  sheet.mergeCells("C5:D5");
  sheet.getCell("C5").value = attendanceMetrics.present.length;
  sheet.mergeCells("E5:F5");
  sheet.getCell("E5").value = attendanceMetrics.absent.length;
  sheet.mergeCells("G5:H5");
  sheet.getCell("G5").value = attendanceMetrics.allEarly.length;
  sheet.mergeCells("I5:J5");
  sheet.getCell("I5").value = attendanceMetrics.allLate.length;
  sheet.getCell("K5").value = attendanceMetrics.allWithinGrace.length;

  const kpiValueRow = sheet.getRow(5);
  kpiValueRow.height = 30;

  const kpiStyles = [
    { pos: "A5", fg: "FF3B82F6", fontColor: "FFFFFFFF" },
    { pos: "C5", fg: "FF10B981", fontColor: "FFFFFFFF" },
    { pos: "E5", fg: "FFEF4444", fontColor: "FFFFFFFF" },
    { pos: "G5", fg: "FF06B6D4", fontColor: "FFFFFFFF" },
    { pos: "I5", fg: "FFF97316", fontColor: "FFFFFFFF" },
    { pos: "K5", fg: "FFFBBF24", fontColor: "FF1F2937" },
  ];

  kpiStyles.forEach((item) => {
    const c = sheet.getCell(item.pos);
    c.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: item.fontColor } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: item.fg } };
  });

  // Category Shift Policies Summary (Rows 7-9)
  sheet.mergeCells("A7:K7");
  const shiftHeader = sheet.getCell("A7");
  shiftHeader.value = "CATEGORY SHIFT POLICIES APPLIED (Grace Period = Cut-off + 5 mins | Late counted from Grace):";
  shiftHeader.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF1E293B" } };
  sheet.getRow(7).height = 18;

  sheet.mergeCells("A8:K8");
  const shiftDetails = sheet.getCell("A8");
  const plantCutoff = shiftPolicies?.PLANT_AUDIT?.cutoff || "10:30";
  const plantGrace = shiftPolicies?.PLANT_AUDIT?.grace || "10:35";
  const articleCutoff = shiftPolicies?.ARTICLE?.cutoff || "11:00";
  const articleGrace = shiftPolicies?.ARTICLE?.grace || "11:05";
  const officeCutoff = shiftPolicies?.BACK_OFFICE?.cutoff || "10:00";
  const officeGrace = shiftPolicies?.BACK_OFFICE?.grace || "10:05";
  const seniorCutoff = shiftPolicies?.SENIOR?.cutoff || shiftPolicies?.SENIOR_PARTNER_MD?.cutoff || "10:00";
  const seniorGrace = shiftPolicies?.SENIOR?.grace || shiftPolicies?.SENIOR_PARTNER_MD?.grace || "10:05";
  const partnerCutoff = shiftPolicies?.PARTNER?.cutoff || "10:00";
  const partnerGrace = shiftPolicies?.PARTNER?.grace || "10:05";
  const mdCutoff = shiftPolicies?.MD?.cutoff || "10:00";
  const mdGrace = shiftPolicies?.MD?.grace || "10:05";

  shiftDetails.value = `• 🏭 Plant: ${formatTimeAmPm(plantCutoff)} (Grace: ${formatTimeAmPm(plantGrace)}) | • 📚 Articles: ${formatTimeAmPm(articleCutoff)} (Grace: ${formatTimeAmPm(articleGrace)}) | • 🏢 Office: ${formatTimeAmPm(officeCutoff)} (Grace: ${formatTimeAmPm(officeGrace)}) | • 👔 Seniors: ${formatTimeAmPm(seniorCutoff)} (Grace: ${formatTimeAmPm(seniorGrace)}) | • 🤝 Partners: ${formatTimeAmPm(partnerCutoff)} (Grace: ${formatTimeAmPm(partnerGrace)}) | • 👑 MD: ${formatTimeAmPm(mdCutoff)} (Grace: ${formatTimeAmPm(mdGrace)})`;
  shiftDetails.font = { name: "Segoe UI", size: 9, color: { argb: "FF475569" } };
  shiftDetails.alignment = { vertical: "middle" };
  sheet.getRow(8).height = 20;

  // Blank spacer row 10
  sheet.getRow(10).height = 12;

  // Table Headers (Row 11)
  const columns = [
    { header: "SR. NO.", key: "sr", width: 10 },
    { header: "EMPLOYEE NAME", key: "name", width: 32 },
    { header: "DEPARTMENT / CATEGORY", key: "category", width: 28 },
    { header: "CUT-OFF", key: "cutoff", width: 14 },
    { header: "GRACE TIME", key: "grace", width: 14 },
    { header: "PUNCH IN", key: "in", width: 16 },
    { header: "PUNCH OUT", key: "out", width: 20 },
    { header: "ATTENDANCE STATUS", key: "status", width: 22 },
    { header: "EARLY / LATE DURATION", key: "duration", width: 24 },
    { header: "WORKING HOURS", key: "workingHours", width: 20 },
    { header: "WORK LOCATION", key: "workSite", width: 26 },
  ];

  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width }));

  // Re-confirm title blocks
  sheet.getCell("A1").value = "AGRAWAL JAIN & CO. - ATTENDANCE ANALYSIS & SHIFT REPORT";
  sheet.getCell("A2").value = `Report Generated: ${todayStr} at ${generatedTime} | System: Real-Time Attendance AI Analyst`;

  const headerRow = sheet.getRow(11);
  headerRow.height = 32;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = {
      name: "Segoe UI",
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "2563EB" },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF1E40AF" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  // Populate Employee Rows
  const sortedEmployees = [...attendanceMetrics.evaluated].sort((a, b) => {
    // Sort absent to bottom or by category
    if (a.categoryLabel !== b.categoryLabel) {
      return a.categoryLabel.localeCompare(b.categoryLabel);
    }
    return a.name.localeCompare(b.name);
  });

  sortedEmployees.forEach((emp, index) => {
    let statusText = "On Time";
    let statusColor = "FF16A34A"; // Green
    let durationText = "On Time";

    if (emp.isAbsent) {
      statusText = "Absent";
      statusColor = "FFDC2626"; // Red
      durationText = "-";
    } else if (emp.isEarly) {
      statusText = "Early Login";
      statusColor = "FF0284C7"; // Cyan/Blue
      durationText = `Early by ${emp.earlyDuration}`;
    } else if (emp.isWithinGrace) {
      statusText = "Within Grace";
      statusColor = "FFD97706"; // Amber
      durationText = "Within Grace Period";
    } else if (emp.isLate) {
      statusText = "Late";
      statusColor = "FFEA580C"; // Orange/Red
      durationText = `Late by ${emp.lateDuration}`;
    }

    const row = sheet.addRow({
      sr: index + 1,
      name: emp.name,
      category: emp.categoryLabel + (emp.customNote ? ` (${emp.customNote})` : ""),
      cutoff: formatTimeAmPm(emp.cutoff),
      grace: formatTimeAmPm(emp.grace),
      in: emp.inTime ? formatTimeAmPm(emp.inTime) : "Not Punched",
      out: emp.outTime ? formatTimeAmPm(emp.outTime) : (emp.isPresent ? "Active" : "-"),
      status: statusText,
      duration: durationText,
      workingHours: emp.isPresent ? emp.formattedWorkingHours : "-",
      workSite: emp.clientPlace && emp.clientPlace.toLowerCase() !== "office"
        ? `Client Site (${emp.clientPlace})`
        : "AJC Office",
    });

    row.height = 24;

    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Segoe UI", size: 10 };
      cell.alignment = { vertical: "middle" };

      // Align numbers and times in center
      if ([1, 4, 5, 6, 7, 8, 9, 10].includes(colNumber)) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }

      // Status column formatting
      if (colNumber === 8) {
        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: statusColor } };
      }

      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });

    // Zebra striping
    if (row.number % 2 === 0) {
      row.eachCell((cell, colNumber) => {
        if (colNumber !== 8) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        }
      });
    }
  });

  sheet.autoFilter = `A11:K${11 + sortedEmployees.length}`;

  // ==========================================
  // SHEET 2: AI CHAT CONVERSATION LOG
  // ==========================================
  if (messages && messages.length > 0) {
    const chatSheet = workbook.addWorksheet("AI Chat Conversation");

    chatSheet.mergeCells("A1:C1");
    const chatTitle = chatSheet.getCell("A1");
    chatTitle.value = "ATTENDANCE AI CHATBOT - CONVERSATION LOG";
    chatTitle.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    chatTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E3A8A" } };
    chatTitle.alignment = { horizontal: "center", vertical: "middle" };
    chatSheet.getRow(1).height = 35;

    chatSheet.columns = [
      { header: "TIME", key: "time", width: 14 },
      { header: "SENDER", key: "sender", width: 18 },
      { header: "MESSAGE CONTENT", key: "message", width: 90 },
    ];

    const chatHeaderRow = chatSheet.getRow(2);
    chatHeaderRow.height = 26;
    chatHeaderRow.eachCell((cell) => {
      cell.font = { name: "Segoe UI", bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563EB" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    messages.forEach((msg) => {
      const cleanText = (msg.text || "")
        .replace(/\*\*/g, "")
        .replace(/###/g, "")
        .replace(/`+/g, "")
        .replace(/\[button:.*?\]/g, "");

      const r = chatSheet.addRow({
        time: msg.time || "-",
        sender: msg.sender === "user" ? "User (Query)" : "Attendance AI Assistant",
        message: cleanText,
      });

      r.height = Math.min(80, Math.max(24, Math.ceil(cleanText.length / 80) * 18));
      r.getCell(1).alignment = { horizontal: "center", vertical: "top" };
      r.getCell(2).alignment = { horizontal: "center", vertical: "top" };
      r.getCell(3).alignment = { wrapText: true, vertical: "top" };

      if (msg.sender === "user") {
        r.getCell(2).font = { bold: true, color: { argb: "FF2563EB" } };
      } else {
        r.getCell(2).font = { bold: true, color: { argb: "FF059669" } };
      }
    });
  }

  // Generate and save file
  const fileName = `AJC_Attendance_Report_${getFormattedDate()}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
  return true;
};

/**
 * Export Attendance Data to Landscape PDF (.pdf)
 * Contains:
 * - Professional Header with Agrawal Jain & Co. branding
 * - Executive KPI summary cards (Total, Present, Absent, Early, Late, Within Grace)
 * - Category shift policy reference bar
 * - Clean autoTable of all employees with status highlighting & working hours
 * - Document footer with timestamp & page numbers
 */
export const exportAttendanceToPDF = ({ attendanceMetrics, shiftPolicies }) => {
  if (!attendanceMetrics || !attendanceMetrics.evaluated) {
    alert("No attendance data available to export.");
    return false;
  }

  // Create PDF in Landscape orientation
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4", // 297mm x 210mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const generatedTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Top Accent Brand Banner
  doc.setFillColor(30, 58, 138); // Dark Navy Blue
  doc.rect(0, 0, pageWidth, 5, "F");

  // Firm Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 58, 138);
  doc.text("AGRAWAL JAIN & CO.", 14, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text("Attendance AI Analytics & Shift Compliance Report", 14, 21);

  // Right-aligned Date and Timestamp
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${todayStr} at ${generatedTime}`, pageWidth - 14, 15, { align: "right" });
  doc.text("Real-Time Multi-Shift Analytics Engine", pageWidth - 14, 21, { align: "right" });

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 24, pageWidth - 14, 24);

  // KPI Summary Cards
  const kpis = [
    { label: "Total Staff", val: attendanceMetrics.total, color: [59, 130, 246] },
    { label: "Present", val: attendanceMetrics.present.length, color: [16, 185, 129] },
    { label: "Absent", val: attendanceMetrics.absent.length, color: [239, 68, 68] },
    { label: "Early Logins (< Cut-off)", val: attendanceMetrics.allEarly.length, color: [6, 182, 212] },
    { label: "Late Arrivals (> Grace)", val: attendanceMetrics.allLate.length, color: [249, 115, 22] },
    { label: "Within Grace Window", val: attendanceMetrics.allWithinGrace.length, color: [245, 158, 11] },
  ];

  const cardWidth = (pageWidth - 28 - (kpis.length - 1) * 3) / kpis.length;
  const cardHeight = 14;
  const startY = 27;

  kpis.forEach((kpi, i) => {
    const x = 14 + i * (cardWidth + 3);

    // Card background
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, startY, cardWidth, cardHeight, 1.5, 1.5, "FD");

    // Left accent pill
    doc.setFillColor(...kpi.color);
    doc.roundedRect(x, startY, 2.5, cardHeight, 1, 1, "F");

    // Value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(String(kpi.val), x + 6, startY + 6.5);

    // Label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 6, startY + 11.5);
  });

  // Shifts Reference Line
  const plantCutoff = shiftPolicies?.PLANT_AUDIT?.cutoff || "10:30";
  const articleCutoff = shiftPolicies?.ARTICLE?.cutoff || "11:00";
  const officeCutoff = shiftPolicies?.BACK_OFFICE?.cutoff || "10:00";
  const seniorCutoff = shiftPolicies?.SENIOR?.cutoff || shiftPolicies?.SENIOR_PARTNER_MD?.cutoff || "10:00";
  const partnerCutoff = shiftPolicies?.PARTNER?.cutoff || "10:00";
  const mdCutoff = shiftPolicies?.MD?.cutoff || "10:00";

  doc.setFillColor(241, 245, 249);
  doc.rect(14, 44, pageWidth - 28, 6.5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Shifts: 🏭 Plant (${formatTimeAmPm(plantCutoff)}) | 📚 Articles (${formatTimeAmPm(articleCutoff)}) | 🏢 Office (${formatTimeAmPm(officeCutoff)}) | 👔 Seniors (${formatTimeAmPm(seniorCutoff)}) | 🤝 Partners (${formatTimeAmPm(partnerCutoff)}) | 👑 MD (${formatTimeAmPm(mdCutoff)}) [Grace = +5m]`,
    16,
    48.5
  );

  // Table Data Preparation
  const sortedEmployees = [...attendanceMetrics.evaluated].sort((a, b) => {
    if (a.categoryLabel !== b.categoryLabel) {
      return a.categoryLabel.localeCompare(b.categoryLabel);
    }
    return a.name.localeCompare(b.name);
  });

  const tableRows = sortedEmployees.map((emp, index) => {
    let statusText = "On Time";
    let durationText = "On Time";

    if (emp.isAbsent) {
      statusText = "Absent";
      durationText = "-";
    } else if (emp.isEarly) {
      statusText = "Early Login";
      durationText = `Early by ${emp.earlyDuration}`;
    } else if (emp.isWithinGrace) {
      statusText = "Within Grace";
      durationText = "Within Grace";
    } else if (emp.isLate) {
      statusText = "Late";
      durationText = `Late by ${emp.lateDuration}`;
    }

    return [
      index + 1,
      emp.name,
      emp.categoryLabel + (emp.customNote ? `\n(${emp.customNote})` : ""),
      formatTimeAmPm(emp.cutoff),
      emp.inTime ? formatTimeAmPm(emp.inTime) : "Not Punched",
      emp.outTime ? formatTimeAmPm(emp.outTime) : (emp.isPresent ? "Active" : "-"),
      statusText,
      durationText,
      emp.isPresent ? emp.formattedWorkingHours : "-",
      emp.clientPlace && emp.clientPlace.toLowerCase() !== "office"
        ? `Client (${emp.clientPlace})`
        : "AJC Office",
    ];
  });

  autoTable(doc, {
    startY: 53,
    head: [
      [
        "Sr",
        "Employee Name",
        "Category / Department",
        "Cut-off",
        "In Time",
        "Out Time",
        "Status",
        "Early / Late Duration",
        "Working Hours",
        "Work Site",
      ],
    ],
    body: tableRows,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: "helvetica",
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      valign: "middle",
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { fontStyle: "bold", cellWidth: 42 },
      2: { cellWidth: 34 },
      3: { halign: "center", cellWidth: 18 },
      4: { halign: "center", cellWidth: 20 },
      5: { halign: "center", cellWidth: 20 },
      6: { halign: "center", fontStyle: "bold", cellWidth: 25 },
      7: { halign: "center", cellWidth: 32 },
      8: { halign: "center", cellWidth: 26 },
      9: { cellWidth: 42 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Color-code the Status column (index 6)
      if (data.section === "body" && data.column.index === 6) {
        const val = data.cell.raw;
        if (val === "Absent") {
          data.cell.styles.textColor = [220, 38, 38]; // Red
        } else if (val === "Late") {
          data.cell.styles.textColor = [234, 88, 12]; // Orange
        } else if (val === "Early Login") {
          data.cell.styles.textColor = [2, 132, 199]; // Blue/Cyan
        } else if (val === "Within Grace") {
          data.cell.styles.textColor = [217, 119, 6]; // Amber
        } else if (val === "On Time") {
          data.cell.styles.textColor = [22, 163, 74]; // Green
        }
      }
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Agrawal Jain & Co. • Attendance AI Report • Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        205,
        { align: "center" }
      );
    },
  });

  // Save PDF
  const fileName = `AJC_Attendance_Report_${getFormattedDate()}.pdf`;
  doc.save(fileName);
  return true;
};

/**
 * Export Weekly Attendance to Excel (.xlsx)
 */
export const exportWeeklyAttendanceToExcel = async ({
  weeklyData = {},
  shiftPolicies = {},
  messages = [],
}) => {
  const list = weeklyData.list || [];
  const weekRange = weeklyData.weekRange || "Past 7 Days";
  if (!list || list.length === 0) {
    alert("No weekly attendance data available to export.");
    return false;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. - Attendance AI";
  workbook.created = new Date();

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const sheet = workbook.addWorksheet("Weekly Summary");
  sheet.views = [{ state: "frozen", ySplit: 5 }];

  // Table Headers
  const columns = [
    { header: "SR. NO.", key: "sr", width: 10 },
    { header: "EMPLOYEE NAME", key: "name", width: 32 },
    { header: "DEPARTMENT / CATEGORY", key: "category", width: 28 },
    { header: "DAYS PRESENT", key: "present", width: 16 },
    { header: "LATE DAYS", key: "late", width: 14 },
    { header: "ABSENT DAYS", key: "absent", width: 16 },
    { header: "HALF DAYS", key: "halfDay", width: 14 },
    { header: "TOTAL WEEKLY HOURS", key: "totalHours", width: 22 },
    { header: "AVG DAILY HOURS", key: "avgHours", width: 18 },
    { header: "ATTENDANCE RATE (%)", key: "pct", width: 22 },
  ];
  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width }));

  // Title Block (Rows 1-2)
  sheet.mergeCells("A1:J1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "AGRAWAL JAIN & CO. - WEEKLY ATTENDANCE REPORT";
  titleCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E3A8A" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 40;

  sheet.mergeCells("A2:J2");
  const subCell = sheet.getCell("A2");
  subCell.value = `Week Period: ${weekRange} | Generated: ${todayStr} | Real-Time Attendance AI`;
  subCell.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "FF334155" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 24;

  sheet.getRow(3).height = 10;
  sheet.getRow(4).height = 8;

  const headerRow = sheet.getRow(5);
  headerRow.height = 30;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: "Segoe UI", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563EB" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF1E40AF" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  list.forEach((item, index) => {
    const row = sheet.addRow({
      sr: index + 1,
      name: item.employee,
      category: `${item.categoryIcon || ""} ${item.categoryLabel || item.categoryKey}`,
      present: item.daysPresent,
      late: item.lateDays,
      absent: item.daysAbsent,
      halfDay: item.halfDays,
      totalHours: item.totalWorkingHours,
      avgHours: item.avgWorkingHours,
      pct: `${item.attendancePct}%`,
    });
    row.height = 24;
    row.eachCell((cell, colNum) => {
      cell.font = { name: "Segoe UI", size: 10 };
      cell.alignment = { vertical: "middle" };
      if ([1, 4, 5, 6, 7, 8, 9, 10].includes(colNum)) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
      if (colNum === 10) {
        const pct = item.attendancePct;
        const color = pct >= 90 ? "FF16A34A" : pct >= 75 ? "FFD97706" : "FFDC2626";
        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: color } };
      }
    });

    if (row.number % 2 === 0) {
      row.eachCell((cell, colNum) => {
        if (colNum !== 10) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }
      });
    }
  });

  sheet.autoFilter = `A5:J${5 + list.length}`;

  // Sheet 2: Day-by-Day Log
  if (weeklyData.weeklyLogs && weeklyData.weeklyLogs.length > 0) {
    const logSheet = workbook.addWorksheet("Weekly Day-by-Day Log");
    const logCols = [
      { header: "DATE", key: "date", width: 14 },
      { header: "DAY", key: "day", width: 10 },
      { header: "EMPLOYEE NAME", key: "emp", width: 30 },
      { header: "CATEGORY", key: "cat", width: 22 },
      { header: "IN TIME", key: "in", width: 14 },
      { header: "OUT TIME", key: "out", width: 14 },
      { header: "STATUS", key: "status", width: 18 },
      { header: "WORKING HOURS", key: "hours", width: 18 },
      { header: "WORK SITE", key: "site", width: 22 },
    ];
    logSheet.columns = logCols.map((c) => ({ key: c.key, width: c.width }));

    const logHeader = logSheet.getRow(1);
    logHeader.height = 28;
    logHeader.values = logCols.map((c) => c.header);
    logHeader.eachCell((cell) => {
      cell.font = { name: "Segoe UI", bold: true, color: { argb: "FFFFFFFF" }, size: 10.5 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563EB" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "medium", color: { argb: "FF1E40AF" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });

    weeklyData.weeklyLogs.forEach((log) => {
      const r = logSheet.addRow({
        date: log.date,
        day: log.dayName,
        emp: log.employee,
        cat: log.categoryLabel || log.categoryKey,
        in: log.inTime || "-",
        out: log.outTime || "-",
        status: log.status,
        hours: log.workingHours || "-",
        site: log.clientPlace || "Office",
      });
      r.height = 22;
      r.eachCell((cell, colNum) => {
        cell.font = { name: "Segoe UI", size: 9.5 };
        cell.alignment = { vertical: "middle" };
        if ([1, 2, 5, 6, 7, 8].includes(colNum)) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });
    });

    logSheet.autoFilter = `A1:I${1 + weeklyData.weeklyLogs.length}`;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `AJC_Weekly_Attendance_${getFormattedDate()}.xlsx`;
  saveAs(new Blob([buffer]), fileName);
  return true;
};

/**
 * Export Weekly Attendance to PDF (.pdf)
 */
export const exportWeeklyAttendanceToPDF = ({
  weeklyData = {},
  shiftPolicies = {},
}) => {
  const list = weeklyData.list || [];
  const weekRange = weeklyData.weekRange || "Past 7 Days";
  if (!list || list.length === 0) {
    alert("No weekly attendance data available to export.");
    return false;
  }

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Header Banner
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, pageWidth, 26, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text("AGRAWAL JAIN & CO.", 14, 11);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("CHARTERED ACCOUNTANTS • WEEKLY ATTENDANCE REPORT", 14, 18);

  doc.setFontSize(8.5);
  doc.text(`Week Range: ${weekRange} | Generated: ${todayStr}`, pageWidth - 14, 15, { align: "right" });

  // Summary Metrics Cards
  const totalEmployees = list.length;
  const avgAttendance = Math.round(list.reduce((acc, cur) => acc + cur.attendancePct, 0) / (totalEmployees || 1));
  const totalLate = list.reduce((acc, cur) => acc + cur.lateDays, 0);
  const totalAbsent = list.reduce((acc, cur) => acc + cur.daysAbsent, 0);

  const kpis = [
    { label: "Active Employees", val: totalEmployees, color: [59, 130, 246] },
    { label: "Average Attendance", val: `${avgAttendance}%`, color: [16, 185, 129] },
    { label: "Total Late Occurrences", val: totalLate, color: [249, 115, 22] },
    { label: "Total Absent Days", val: totalAbsent, color: [239, 68, 68] },
  ];

  const cardWidth = (pageWidth - 28 - (kpis.length - 1) * 6) / kpis.length;
  kpis.forEach((k, idx) => {
    const x = 14 + idx * (cardWidth + 6);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, 30, cardWidth, 14, 2, 2, "FD");

    doc.setFillColor(...k.color);
    doc.roundedRect(x, 30, 2.5, 14, 1, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(String(k.val), x + 6, 36.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, x + 6, 41.5);
  });

  const tableRows = list.map((item, idx) => [
    idx + 1,
    item.employee,
    item.categoryLabel || item.categoryKey,
    item.daysPresent,
    item.lateDays,
    item.daysAbsent,
    item.halfDays,
    item.totalWorkingHours,
    item.avgWorkingHours,
    `${item.attendancePct}%`,
  ]);

  autoTable(doc, {
    startY: 48,
    head: [
      [
        "Sr",
        "Employee Name",
        "Department / Category",
        "Present",
        "Late",
        "Absent",
        "Half Day",
        "Weekly Hours",
        "Avg/Day",
        "Attendance %",
      ],
    ],
    body: tableRows,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: "helvetica",
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      valign: "middle",
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { fontStyle: "bold", cellWidth: 50 },
      2: { cellWidth: 42 },
      3: { halign: "center", cellWidth: 20 },
      4: { halign: "center", cellWidth: 18 },
      5: { halign: "center", cellWidth: 18 },
      6: { halign: "center", cellWidth: 18 },
      7: { halign: "center", cellWidth: 32 },
      8: { halign: "center", cellWidth: 28 },
      9: { halign: "center", fontStyle: "bold", cellWidth: 28 },
    },
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Agrawal Jain & Co. • Weekly Attendance Report • Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        205,
        { align: "center" }
      );
    },
  });

  const fileName = `AJC_Weekly_Attendance_${getFormattedDate()}.pdf`;
  doc.save(fileName);
  return true;
};

/**
 * Export Monthly Attendance to Excel (.xlsx)
 */
export const exportMonthlyAttendanceToExcel = async ({
  monthlyData = {},
  shiftPolicies = {},
  messages = [],
}) => {
  const list = monthlyData.monthlySummaries || [];
  const workingDaysCount = monthlyData.workingDaysCount || 24;
  if (!list || list.length === 0) {
    alert("No monthly attendance data available to export.");
    return false;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Agrawal Jain & Co. - Attendance AI";
  workbook.created = new Date();

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const currentMonthName = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const sheet = workbook.addWorksheet("Monthly Register");
  sheet.views = [{ state: "frozen", ySplit: 5 }];

  // Table Headers
  const columns = [
    { header: "SR. NO.", key: "sr", width: 10 },
    { header: "EMPLOYEE NAME", key: "name", width: 32 },
    { header: "DEPARTMENT / CATEGORY", key: "category", width: 28 },
    { header: "TOTAL DAYS", key: "totalDays", width: 14 },
    { header: "DAYS PRESENT", key: "present", width: 16 },
    { header: "LATE DAYS", key: "late", width: 14 },
    { header: "ABSENT DAYS", key: "absent", width: 16 },
    { header: "HALF DAYS", key: "halfDay", width: 14 },
    { header: "TOTAL WORKING HOURS", key: "totalHours", width: 24 },
    { header: "AVG DAILY HOURS", key: "avgHours", width: 18 },
    { header: "ATTENDANCE RATE (%)", key: "pct", width: 24 },
  ];
  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width }));

  // Title Block (Rows 1-2)
  sheet.mergeCells("A1:K1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "AGRAWAL JAIN & CO. - MONTHLY ATTENDANCE REGISTER";
  titleCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E3A8A" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 40;

  sheet.mergeCells("A2:K2");
  const subCell = sheet.getCell("A2");
  subCell.value = `Month: ${currentMonthName} | Working Days: ${workingDaysCount} | Generated: ${todayStr} | Real-Time Attendance AI`;
  subCell.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "FF334155" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 24;

  sheet.getRow(3).height = 10;
  sheet.getRow(4).height = 8;

  const headerRow = sheet.getRow(5);
  headerRow.height = 30;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: "Segoe UI", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563EB" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF1E40AF" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  list.forEach((item, index) => {
    const row = sheet.addRow({
      sr: index + 1,
      name: item.employee,
      category: `${item.categoryIcon || ""} ${item.categoryLabel || item.categoryKey}`,
      totalDays: item.totalDays || workingDaysCount,
      present: item.daysPresent,
      late: item.lateDays,
      absent: item.daysAbsent,
      halfDay: item.halfDays,
      totalHours: item.totalWorkingHours,
      avgHours: item.avgWorkingHours,
      pct: `${item.attendancePct}%`,
    });
    row.height = 24;
    row.eachCell((cell, colNum) => {
      cell.font = { name: "Segoe UI", size: 10 };
      cell.alignment = { vertical: "middle" };
      if ([1, 4, 5, 6, 7, 8, 9, 10, 11].includes(colNum)) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
      if (colNum === 11) {
        const pct = item.attendancePct;
        const color = pct >= 90 ? "FF16A34A" : pct >= 75 ? "FFD97706" : "FFDC2626";
        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: color } };
      }
    });

    if (row.number % 2 === 0) {
      row.eachCell((cell, colNum) => {
        if (colNum !== 11) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }
      });
    }
  });

  sheet.autoFilter = `A5:K${5 + list.length}`;

  // Sheet 2: Day-by-Day Monthly Punch Log
  if (monthlyData.monthlyLogs && monthlyData.monthlyLogs.length > 0) {
    const logSheet = workbook.addWorksheet("Monthly Daily Punch Log");
    const logCols = [
      { header: "DATE", key: "date", width: 14 },
      { header: "DAY", key: "day", width: 10 },
      { header: "EMPLOYEE NAME", key: "emp", width: 30 },
      { header: "CATEGORY", key: "cat", width: 22 },
      { header: "IN TIME", key: "in", width: 14 },
      { header: "OUT TIME", key: "out", width: 14 },
      { header: "STATUS", key: "status", width: 18 },
      { header: "WORKING HOURS", key: "hours", width: 18 },
      { header: "WORK SITE", key: "site", width: 22 },
    ];
    logSheet.columns = logCols.map((c) => ({ key: c.key, width: c.width }));

    const logHeader = logSheet.getRow(1);
    logHeader.height = 28;
    logHeader.values = logCols.map((c) => c.header);
    logHeader.eachCell((cell) => {
      cell.font = { name: "Segoe UI", bold: true, color: { argb: "FFFFFFFF" }, size: 10.5 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563EB" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "medium", color: { argb: "FF1E40AF" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });

    monthlyData.monthlyLogs.forEach((log) => {
      const r = logSheet.addRow({
        date: log.date,
        day: log.dayName,
        emp: log.employee,
        cat: log.categoryLabel || log.categoryKey,
        in: log.inTime || "-",
        out: log.outTime || "-",
        status: log.status,
        hours: log.workingHours || "-",
        site: log.clientPlace || "Office",
      });
      r.height = 22;
      r.eachCell((cell, colNum) => {
        cell.font = { name: "Segoe UI", size: 9.5 };
        cell.alignment = { vertical: "middle" };
        if ([1, 2, 5, 6, 7, 8].includes(colNum)) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });
    });

    logSheet.autoFilter = `A1:I${1 + monthlyData.monthlyLogs.length}`;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `AJC_Monthly_Attendance_${getFormattedDate()}.xlsx`;
  saveAs(new Blob([buffer]), fileName);
  return true;
};

/**
 * Export Monthly Attendance to PDF (.pdf)
 */
export const exportMonthlyAttendanceToPDF = ({
  monthlyData = {},
  shiftPolicies = {},
}) => {
  const list = monthlyData.monthlySummaries || [];
  const workingDaysCount = monthlyData.workingDaysCount || 24;
  if (!list || list.length === 0) {
    alert("No monthly attendance data available to export.");
    return false;
  }

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const currentMonthName = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  // Header Banner
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, pageWidth, 26, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text("AGRAWAL JAIN & CO.", 14, 11);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("CHARTERED ACCOUNTANTS • MONTHLY ATTENDANCE REGISTER", 14, 18);

  doc.setFontSize(8.5);
  doc.text(`Month: ${currentMonthName} | Working Days: ${workingDaysCount} | Generated: ${todayStr}`, pageWidth - 14, 15, { align: "right" });

  // Summary Metrics Cards
  const totalEmployees = list.length;
  const avgAttendance = Math.round(list.reduce((acc, cur) => acc + cur.attendancePct, 0) / (totalEmployees || 1));
  const totalLate = list.reduce((acc, cur) => acc + cur.lateDays, 0);
  const totalAbsent = list.reduce((acc, cur) => acc + cur.daysAbsent, 0);

  const kpis = [
    { label: "Total Staff", val: totalEmployees, color: [59, 130, 246] },
    { label: "Working Days in Month", val: workingDaysCount, color: [14, 165, 233] },
    { label: "Avg Monthly Attendance", val: `${avgAttendance}%`, color: [16, 185, 129] },
    { label: "Total Late Recorded", val: totalLate, color: [249, 115, 22] },
    { label: "Total Absent Days", val: totalAbsent, color: [239, 68, 68] },
  ];

  const cardWidth = (pageWidth - 28 - (kpis.length - 1) * 5) / kpis.length;
  kpis.forEach((k, idx) => {
    const x = 14 + idx * (cardWidth + 5);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, 30, cardWidth, 14, 2, 2, "FD");

    doc.setFillColor(...k.color);
    doc.roundedRect(x, 30, 2.5, 14, 1, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(String(k.val), x + 5.5, 36.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, x + 5.5, 41.5);
  });

  const tableRows = list.map((item, idx) => [
    idx + 1,
    item.employee,
    item.categoryLabel || item.categoryKey,
    item.totalDays || workingDaysCount,
    item.daysPresent,
    item.lateDays,
    item.daysAbsent,
    item.halfDays,
    item.totalWorkingHours,
    item.avgWorkingHours,
    `${item.attendancePct}%`,
  ]);

  autoTable(doc, {
    startY: 48,
    head: [
      [
        "Sr",
        "Employee Name",
        "Department / Category",
        "Total Days",
        "Present",
        "Late",
        "Absent",
        "Half Day",
        "Total Hours",
        "Avg/Day",
        "Attendance %",
      ],
    ],
    body: tableRows,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: "helvetica",
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      valign: "middle",
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { fontStyle: "bold", cellWidth: 46 },
      2: { cellWidth: 38 },
      3: { halign: "center", cellWidth: 18 },
      4: { halign: "center", cellWidth: 18 },
      5: { halign: "center", cellWidth: 16 },
      6: { halign: "center", cellWidth: 16 },
      7: { halign: "center", cellWidth: 16 },
      8: { halign: "center", cellWidth: 30 },
      9: { halign: "center", cellWidth: 26 },
      10: { halign: "center", fontStyle: "bold", cellWidth: 26 },
    },
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Agrawal Jain & Co. • Monthly Attendance Register • Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        205,
        { align: "center" }
      );
    },
  });

  const fileName = `AJC_Monthly_Attendance_${getFormattedDate()}.pdf`;
  doc.save(fileName);
  return true;
};

