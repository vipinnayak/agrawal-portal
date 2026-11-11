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

// Let's import or extract evaluateEmployee and generateLocalAnswer
const {
  DEFAULT_SHIFT_POLICIES,
  getEmployeeCategoryInfo,
  normalizeName,
  formatWorkingHours,
} = require('../src/utils/attendanceConfig.js');

async function run() {
  const cardUrl = "https://script.google.com/macros/s/AKfycbxp_-pPEH7FwJJu0o9AQHtklmRDfAqJ0SR-gqtJ5LPVsTDovyDtNnIwl1_p57yRSFSPyw/exec";
  const empMasterUrl = "https://script.google.com/macros/s/AKfycbwDe_74vgkL8KaXyT5vE-AZ1mort3HMzFvd7wh4L5Sm9bhA7s5sSsmJzB_vj5m8s7sA/exec";
  
  const [cardData, empData] = await Promise.all([fetchUrl(cardUrl), fetchUrl(empMasterUrl)]);
  
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
  console.log("validRows:", validRows.length);

  // Check how many are classified per category
  const categoriesCount = {};
  validRows.forEach(r => {
    const rawName = (r.Employee || "").trim();
    const cat = getEmployeeCategoryInfo(rawName, r, dynamicDeptMap, DEFAULT_SHIFT_POLICIES);
    const key = cat.categoryKey || cat.key;
    categoriesCount[key] = (categoriesCount[key] || 0) + 1;
  });
  console.log("Categories breakdown:", categoriesCount);
}

run().catch(console.error);

