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

async function test() {
  const cardUrl = "https://script.google.com/macros/s/AKfycbxp_-pPEH7FwJJu0o9AQHtklmRDfAqJ0SR-gqtJ5LPVsTDovyDtNnIwl1_p57yRSFSPyw/exec";
  const empMasterUrl = "https://script.google.com/macros/s/AKfycbwDe_74vgkL8KaXyT5vE-AZ1mort3HMzFvd7wh4L5Sm9bhA7s5sSsmJzB_vj5m8s7sA/exec";
  
  console.log("Fetching data...");
  const [cardData, empData] = await Promise.all([fetchUrl(cardUrl), fetchUrl(empMasterUrl)]);
  
  console.log("Card rows:", cardData.length, "Emp rows:", empData.length);
  
  const validRows = cardData.filter(r => r && r.Employee && r.Employee.trim() !== "");
  console.log("Valid card rows with Employee:", validRows.length);
  
  const inRows = validRows.filter(r => r.In && r.In.trim() !== "");
  console.log("Rows with In:", inRows.length);
}

test().catch(console.error);

