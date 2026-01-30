const hubspot = require('@hubspot/api-client');

const client = new hubspot.Client({
  accessToken: process.env.HUBSPOT_PRIVATE_APP_TOKEN || '',
  numberOfApiCallRetries: 3,
});

module.exports = client;
