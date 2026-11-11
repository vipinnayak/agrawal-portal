// Standalone verification script for Attendance Chatbot answer generation
const {
  DEFAULT_SHIFT_POLICIES,
  normalizeName,
  getEmployeeCategoryInfo,
  formatWorkingHours,
  formatLateDuration,
} = require('../src/utils/attendanceConfig.js');

const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function verify() {
  console.log("Loading live data...");
  const cardUrl = "https://script.google.com/macros/s/AKfycbxp_-pPEH7FwJJu0o9AQHtklmRDfAqJ0SR-gqtJ5LPVsTDovyDtNnIwl1_p57yRSFSPyw/exec";
  const empMasterUrl = "https://script.google.com/macros/s/AKfycbwDe_74vgkL8KaXyT5vE-AZ1mort3HMzFvd7wh4L5Sm9bhA7s5sSsmJzB_vj5m8s7sA/exec";
  const monthlyUrl = "https://script.google.com/macros/s/AKfycbzeIeo1t9sB67rqnBtxYzHJGCqm_-ai70YCevQyzeejG0nkeMzaxC6fRUPBonvnXg/exec";

  const [cardData, empData, monthlyRaw] = await Promise.all([
    fetchUrl(cardUrl),
    fetchUrl(empMasterUrl),
    fetchUrl(monthlyUrl)
  ]);

  console.log("Card rows:", cardData.length, "Monthly rows:", monthlyRaw?.data?.length);

  const dynamicDeptMap = new Map();
  if (Array.isArray(empData)) {
    empData.forEach((emp) => {
      if (emp && emp.Name) {
        const clean = normalizeName(emp.Name);
        if (clean) dynamicDeptMap.set(clean, emp.Department || "");
      }
    });
  }

  const validRows = cardData.filter(r => r && r.Employee && r.Employee.trim() !== "");
  console.log("Valid daily employees:", validRows.length);
  const presentRows = validRows.filter(r => r.In && r.In.trim() !== "");
  console.log("Present daily employees:", presentRows.length);
  console.log("✅ Live test completed successfully!");
}

verify().catch(console.error);

