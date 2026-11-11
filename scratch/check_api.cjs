const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // follow redirect if 302
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

async function run() {
  const cardUrl = "https://script.google.com/macros/s/AKfycbxp_-pPEH7FwJJu0o9AQHtklmRDfAqJ0SR-gqtJ5LPVsTDovyDtNnIwl1_p57yRSFSPyw/exec";
  const data = await fetchUrl(cardUrl);
  console.log("Total rows:", Array.isArray(data) ? data.length : typeof data);
  if (Array.isArray(data) && data.length > 0) {
    console.log("Sample row:", data[0]);
    console.log("Last row:", data[data.length - 1]);
    const withIn = data.filter(r => r.In && r.In.trim() !== "");
    console.log("Rows with In:", withIn.length);
    if (withIn.length > 0) {
      console.log("Sample with In:", withIn[0]);
      console.log("Last with In:", withIn[withIn.length - 1]);
    }
    const dates = new Set(data.map(r => r.Date || r.date).filter(Boolean));
    console.log("Dates present:", Array.from(dates).slice(0, 10));
  }
}

run().catch(console.error);

