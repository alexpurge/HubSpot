const https = require('https');

// ⚠️ SECURITY WARNING: PASTE YOUR TOKEN BELOW FOR THIS TEST ONLY.
// DELETE THIS FILE IMMEDIATELY AFTER THE TEST.
const token = "pat-ap1-800c7655-2304-4dd4-be98-184f6a91cbea"; 

console.log("----- HARDCODED TOKEN TEST -----");
console.log(`Testing with token ending in: ...${token.slice(-4)}`);

const options = {
  hostname: 'api.hubapi.com',
  path: '/crm/v3/objects/companies?limit=1',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  console.log(`Response Status: ${res.statusCode} ${res.statusMessage}`);
  
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log("✅ SUCCESS: The token is VALID. The issue is your .env file.");
    } else {
      console.log("❌ FAILURE: The token is INVALID/BLOCKED. The issue is inside HubSpot.");
      console.log("HubSpot Reply:", data);
    }
    console.log("--------------------------------");
  });
});

req.on('error', (e) => {
  console.error(`ERROR: Network request failed: ${e.message}`);
});

req.end();