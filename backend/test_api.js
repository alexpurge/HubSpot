require('dotenv').config();
const https = require('https');

const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

console.log("----- API CONNECTION TEST -----");
if (!token) {
    console.error("CRITICAL: Token is MISSING from process.env");
    process.exit(1);
}

// We will try to READ companies. This verifies the token is valid.
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
      console.log("✅ SUCCESS: The token works! HubSpot accepted the connection.");
    } else {
      console.log("❌ FAILURE: HubSpot rejected the token.");
      console.log("Error Body:", data);
    }
    console.log("-------------------------------");
  });
});

req.on('error', (e) => {
  console.error(`ERROR: Network request failed: ${e.message}`);
});

req.end();