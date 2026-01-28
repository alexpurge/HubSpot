const hubspot = require('@hubspot/api-client');

const client = new hubspot.Client({
  accessToken: process.env.HUBSPOT_PRIVATE_APP_TOKEN || '',
});

module.exports = client;
