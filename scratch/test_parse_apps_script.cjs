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

async function run() {
  const monthlyUrl = "https://script.google.com/macros/s/AKfycbzeIeo1t9sB67rqnBtxYzHJGCqm_-ai70YCevQyzeejG0nkeMzaxC6fRUPBonvnXg/exec";
  const monthlyDataRaw = await fetchUrl(monthlyUrl);
  const rows = monthlyDataRaw.data;
  
  const dates = new Map();
  rows.forEach(r => {
    const d = r.Date;
    if (d) {
      const parts = d.split('/');
      if (parts.length === 3) {
        const my = parts[1] + '/' + parts[2];
        dates.set(my, (dates.get(my) || 0) + 1);
      }
    }
  });
  console.log("Months in data:", Array.from(dates.entries()));
}

run().catch(console.error);

