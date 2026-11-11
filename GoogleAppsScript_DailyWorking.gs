/**
 * ============================================================================
 * AGRAWAL JAIN & CO. (AJC) - DAILY WORKING API (GOOGLE APPS SCRIPT)
 * ============================================================================
 * Target Spreadsheet URL:
 * https://docs.google.com/spreadsheets/d/1w23vFtte_BAus75NtgicyNnxV-dI2yxvrcFdkE6cIO4/edit#gid=0
 *
 * Target Sheet ID:
 * 1w23vFtte_BAus75NtgicyNnxV-dI2yxvrcFdkE6cIO4
 *
 * PURPOSE:
 * Serves real-time Daily Working entries to the Agrawal Portal Frontend:
 * - Daily Working Dashboard (/daily-working)
 * - Daily Working AI Chatbot Analyst (MD Dashboard & All Portals)
 * - Individual Employee Daily Working History Pages
 *
 * ----------------------------------------------------------------------------
 * HOW TO DEPLOY AS A WEB APP (STEP-BY-STEP):
 * ----------------------------------------------------------------------------
 * 1. Open your Google Sheet in browser:
 *    https://docs.google.com/spreadsheets/d/1w23vFtte_BAus75NtgicyNnxV-dI2yxvrcFdkE6cIO4/edit#gid=0
 *
 * 2. In the top Google Sheets menu, click: "Extensions" > "Apps Script".
 *
 * 3. Delete any default code inside the editor ("myFunction()"), and PASTE
 *    this ENTIRE file into the editor.
 *
 * 4. Click the disk icon (💾 Save) or press Ctrl + S.
 *
 * 5. At top-right, click the blue button: "Deploy" > "New deployment".
 *
 * 6. In the modal that opens:
 *    - Click the gear icon (Select type) and choose "Web app".
 *    - Description: "AJC Daily Working Live API"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone"  <-- CRITICAL! Must be "Anyone" so frontend can read data.
 *
 * 7. Click "Deploy".
 *    - If Google asks to authorize permissions:
 *      Click "Authorize access" -> choose your Google Account ->
 *      Click "Advanced" (bottom-left) -> Click "Go to Untitled project (unsafe)" ->
 *      Click "Allow".
 *
 * 8. Copy the generated "Web app URL":
 *    ACTIVE LIVE DEPLOYED WEB APP URL:
 *    https://script.google.com/macros/s/AKfycbyVRDZmhX_nApCD5RPIlNNcP5xKRGQuJDQof0x2QvCxtUNeozMggmXAw-aX7fH-gjq1kQ/exec
 *
 * 9. Attached to Agrawal Portal:
 *    - In src/utils/dailyWorkingService.js (DAILY_WORKING_API & DAILY_WORKING_SUBMIT_API)
 *    - In Daily Working Dashboard (/daily-working)
 *    - In MD Sir Dashboard (/rajesh-agrawal) - Team Live Monitor
 *    - In Daily Working AI Chatbot Analyst
 *    - In Employee Daily Working Portal (/employee-daily-working) & Form Submissions
 * ============================================================================
 */

// Target Sheet ID
var SPREADSHEET_ID = "1w23vFtte_BAus75NtgicyNnxV-dI2yxvrcFdkE6cIO4";

/**
 * Handle HTTP GET Requests (Read data)
 * Accessible by Agrawal Portal Daily Working Dashboard & Chatbot AI
 */
function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};

    // 1. Quick Ping / Connection Test
    if (params.action === "ping") {
      return createJsonResponse({
        status: "ok",
        message: "AJC Daily Working API is online and responding!",
        spreadsheetId: SPREADSHEET_ID,
        timestamp: new Date().toISOString()
      });
    }

    // 2. Open Spreadsheet (bound container or by ID)
    var ss = getSpreadsheet();
    var sheetName = params.sheet || "";
    var sheet = getTargetSheet(ss, sheetName);

    if (!sheet) {
      return createJsonResponse({
        status: "error",
        message: "Target sheet tab not found in spreadsheet",
        availableSheets: ss.getSheets().map(function (s) {
          return s.getName();
        })
      });
    }

    // 3. Read Data
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();

    if (!values || values.length <= 1) {
      return createJsonResponse({
        status: "success",
        totalRows: 0,
        sheetName: sheet.getName(),
        data: []
      });
    }

    // 4. Extract and normalize column headers
    var rawHeaders = values[0];
    var headerKeys = rawHeaders.map(function (h) {
      return normalizeHeader(h);
    });

    // 5. Parse rows
    var rows = [];
    var doerFilter = (params.doer || "").toLowerCase().trim();
    var dateFilter = (params.date || "").trim();
    var limit = parseInt(params.limit || "0", 10);

    for (var i = 1; i < values.length; i++) {
      var row = values[i];

      // Skip empty rows
      var hasContent = row.some(function (cell) {
        return cell !== "" && cell !== null && cell !== undefined;
      });
      if (!hasContent) continue;

      var rowObj = {};
      for (var j = 0; j < headerKeys.length; j++) {
        var key = headerKeys[j];
        if (!key) continue;
        var cellValue = row[j];
        rowObj[key] = formatCellValue(cellValue, key);
      }

      // Standardize entry keys for Agrawal Portal consumption
      var entry = standardizeDailyWorkingEntry(rowObj);

      // Filters
      if (doerFilter && entry.doerName.toLowerCase().indexOf(doerFilter) === -1) {
        continue;
      }
      if (dateFilter && entry.date !== dateFilter) {
        continue;
      }

      rows.push(entry);

      if (limit > 0 && rows.length >= limit) {
        break;
      }
    }

    // 6. Return standard format matching frontend expectations
    return createJsonResponse({
      status: "success",
      totalRows: rows.length,
      sheetName: sheet.getName(),
      data: rows
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: err.toString(),
      stack: err.stack
    });
  }
}

/**
 * Handle HTTP POST Requests (Insert new Daily Work record)
 */
function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var ss = getSpreadsheet();
    var sheet = getTargetSheet(ss, payload.sheet || "");
    if (!sheet) {
      return createJsonResponse({
        status: "error",
        message: "Target sheet tab not found"
      });
    }

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, Math.max(lastCol, 1)).getValues()[0];
    var newRow = [];

    // Map payload into matching columns
    headers.forEach(function (h) {
      var norm = normalizeHeader(h);
      var val = "";
      if (norm === "timestamp") val = new Date();
      else if (norm === "date") val = payload.date || formatDate(new Date());
      else if (norm === "doerName") val = payload.doerName || payload.employeeName || "";
      else if (norm === "department") val = payload.department || "";
      else if (norm === "period") val = payload.period || "";
      else if (norm === "location") val = payload.location || "";
      else if (norm === "groupName") val = payload.groupName || "";
      else if (norm === "companyName") val = payload.companyName || "";
      else if (norm === "taskDescription") val = payload.taskDescription || "";
      else if (norm === "timeGiven") val = payload.timeGiven || "";
      else if (norm === "missingDate") val = payload.missingDate || "";
      else if (norm === "lastUpdated") val = payload.lastUpdated || formatDate(new Date());
      else val = payload[norm] || payload[h] || "";

      newRow.push(val);
    });

    sheet.appendRow(newRow);

    return createJsonResponse({
      status: "success",
      message: "Daily working entry logged successfully",
      savedData: payload
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: err.toString()
    });
  }
}

/**
 * Get the target Spreadsheet (active or by SPREADSHEET_ID)
 */
function getSpreadsheet() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Get target sheet tab
 */
function getTargetSheet(ss, requestedName) {
  if (requestedName) {
    var match = ss.getSheetByName(requestedName);
    if (match) return match;
  }

  // 1. Check all sheets and find the first one that has data (getLastRow > 1)
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    var currentSheet = allSheets[i];
    if (!currentSheet.isSheetHidden() && currentSheet.getLastRow() > 1) {
      return currentSheet;
    }
  }

  // 2. Common sheet tab names fallback
  var commonNames = [
    "Form Responses 1",
    "Daily Working",
    "DailyWorking",
    "Daily Work",
    "Responses",
    "Sheet1"
  ];
  for (var j = 0; j < commonNames.length; j++) {
    var s = ss.getSheetByName(commonNames[j]);
    if (s) return s;
  }

  return allSheets[0];
}

/**
 * Normalize header to canonical camelCase property names
 */
function normalizeHeader(rawHeader) {
  if (!rawHeader) return "";
  var str = String(rawHeader).trim().toLowerCase();

  // Timestamp
  if (str.indexOf("timestamp") !== -1 || str === "submitted at" || str === "submission time") {
    return "timestamp";
  }

  // Date
  if (
    str === "date" ||
    str.indexOf("working date") !== -1 ||
    str.indexOf("work date") !== -1 ||
    str.indexOf("date of work") !== -1
  ) {
    return "date";
  }

  // Doer / Employee Name
  if (
    str.indexOf("doer") !== -1 ||
    str.indexOf("employee") !== -1 ||
    str.indexOf("staff") !== -1 ||
    str === "name" ||
    str === "user"
  ) {
    return "doerName";
  }

  // Department
  if (str.indexOf("department") !== -1 || str === "dept") {
    return "department";
  }

  // Period
  if (str.indexOf("period") !== -1 || str.indexOf("quarter") !== -1 || str === "audit period") {
    return "period";
  }

  // Location
  if (str.indexOf("location") !== -1 || str.indexOf("place of work") !== -1 || str === "site") {
    return "location";
  }

  // Group Name
  if (str.indexOf("group") !== -1) {
    return "groupName";
  }

  // Company Name
  if (
    str.indexOf("company") !== -1 ||
    str.indexOf("client") !== -1 ||
    str === "entity"
  ) {
    return "companyName";
  }

  // Task Description
  if (
    str.indexOf("task") !== -1 ||
    str.indexOf("description") !== -1 ||
    str.indexOf("work done") !== -1 ||
    str.indexOf("activity") !== -1 ||
    str.indexOf("details") !== -1
  ) {
    return "taskDescription";
  }

  // Time Given
  if (
    str.indexOf("time given") !== -1 ||
    str.indexOf("time spent") !== -1 ||
    str === "time" ||
    str === "hours" ||
    str === "duration" ||
    str.indexOf("total time") !== -1
  ) {
    return "timeGiven";
  }

  // Missing Date / Backlog
  if (str.indexOf("missing") !== -1 || str.indexOf("backlog") !== -1 || str.indexOf("pending date") !== -1) {
    return "missingDate";
  }

  // Last Updated
  if (str.indexOf("last updated") !== -1 || str.indexOf("updated date") !== -1) {
    return "lastUpdated";
  }

  // Default clean camelCase fallback
  return str.replace(/[^a-zA-Z0-9]+(.)/g, function (m, chr) {
    return chr.toUpperCase();
  });
}

/**
 * Standardize daily working object so frontend never receives missing fields
 */
function standardizeDailyWorkingEntry(obj) {
  var doer = obj.doerName || obj.employeeName || obj.name || "";
  return {
    timestamp: obj.timestamp || "",
    date: obj.date || "",
    doerName: doer,
    employeeName: doer,
    department: obj.department || "",
    period: obj.period || "",
    location: obj.location || "",
    groupName: obj.groupName || "",
    companyName: obj.companyName || "",
    taskDescription: obj.taskDescription || "",
    timeGiven: obj.timeGiven || "",
    missingDate: obj.missingDate || "",
    lastUpdated: obj.lastUpdated || ""
  };
}

/**
 * Cell value formatter
 */
function formatCellValue(val, key) {
  if (val === null || val === undefined) return "";

  // Date objects
  if (Object.prototype.toString.call(val) === "[object Date]" && !isNaN(val.getTime())) {
    if (key === "timestamp") {
      return val.toISOString();
    }
    return formatDate(val);
  }

  // Time fractions (e.g. 0.5 = 12:00)
  if (key === "timeGiven" && typeof val === "number" && val > 0 && val < 1) {
    var totalMinutes = Math.round(val * 24 * 60);
    var hrs = Math.floor(totalMinutes / 60);
    var mins = totalMinutes % 60;
    return (hrs < 10 ? "0" + hrs : hrs) + ":" + (mins < 10 ? "0" + mins : mins);
  }

  return String(val).trim();
}

/**
 * Format date to DD/MM/YYYY
 */
function formatDate(d) {
  var day = d.getDate();
  var month = d.getMonth() + 1;
  var year = d.getFullYear();
  return (day < 10 ? "0" + day : day) + "/" + (month < 10 ? "0" + month : month) + "/" + year;
}

/**
 * Generate standard JSON response with CORS headers
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
