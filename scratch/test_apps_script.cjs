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
  console.log("Fetching Apps Script monthly URL:", url);
  const start = Date.now();
  const res = await fetchUrl(url);
  console.log("Fetched in", Date.now() - start, "ms");
  console.log("Type:", typeof res);
  if (Array.isArray(res)) {
    console.log("Array length:", res.length);
    console.log("Sample item:", res[0]);
  } else if (typeof res === 'object' && res !== null) {
    console.log("Keys:", Object.keys(res));
  } else {
    console.log("String sample:", String(res).substring(0, 150));
  }
}

test().catch(console.error);

