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

// Let's test the Apps Script web app parsing
const {
  DEFAULT_SHIFT_POLICIES,
  normalizeName,
} = require('../src/utils/attendanceConfig.js');

async function run() {
  const empMasterUrl = "https://script.google.com/macros/s/AKfycbwDe_74vgkL8KaXyT5vE-AZ1mort3HMzFvd7wh4L5Sm9bhA7s5sSsmJzB_vj5m8s7sA/exec";
  const monthlyUrl = "https://script.google.com/macros/s/AKfycbzeIeo1t9sB67rqnBtxYzHJGCqm_-ai70YCevQyzeejG0nkeMzaxC6fRUPBonvnXg/exec";

  console.log("Fetching...");
  const [empData, monthlyDataRaw] = await Promise.all([fetchUrl(empMasterUrl), fetchUrl(monthlyUrl)]);
  
  console.log("empData rows:", empData.length);
  console.log("monthlyDataRaw totalRows:", monthlyDataRaw.totalRows, "data length:", monthlyDataRaw.data?.length);

  const rawRows = monthlyDataRaw.data;
  console.log("Sample monthly row:", rawRows[0]);
}

run().catch(console.error);

