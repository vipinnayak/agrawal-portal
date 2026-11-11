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
  const url = "https://script.google.com/macros/s/AKfycbzeIeo1t9sB67rqnBtxYzHJGCqm_-ai70YCevQyzeejG0nkeMzaxC6fRUPBonvnXg/exec";
  const res = await fetchUrl(url);
  console.log("Sheet name:", res.sheetName, "totalRows:", res.totalRows);
  if (Array.isArray(res.data)) {
    console.log("data length:", res.data.length);
    console.log("sample data row:", res.data[0]);
  }
}

test().catch(console.error);

