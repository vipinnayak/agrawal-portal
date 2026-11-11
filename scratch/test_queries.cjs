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

// Let's test if fetchMonthlyAttendance works directly in node or if there are issues
async function test() {
  const cardUrl = "https://script.google.com/macros/s/AKfycbxp_-pPEH7FwJJu0o9AQHtklmRDfAqJ0SR-gqtJ5LPVsTDovyDtNnIwl1_p57yRSFSPyw/exec";
  const cardData = await fetchUrl(cardUrl);
  const validRows = cardData.filter(r => r && r.Employee && r.Employee.trim() !== "");
  console.log("Valid Rows:", validRows.length);
  
  // Let's test monthly sheet gviz
  const MONTHLY_GOOGLE_SHEET_ID = "16L5BoFAveSFJvwpgRnvYn8RH9CfLYQq_0sVeWIcNcyk";
  const MONTHLY_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${MONTHLY_GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&gid=0`;
  const gvizRes = await fetchUrl(MONTHLY_GVIZ_URL);
  console.log("GViz response type:", typeof gvizRes);
  if (typeof gvizRes === 'string') {
    console.log("GViz length:", gvizRes.length, "starts with:", gvizRes.substring(0, 50));
  }
}

test().catch(console.error);

