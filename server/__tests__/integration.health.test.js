const request = require('supertest');
const app = require('../app');

describe('HubSpot integration health check', () => {
  const shouldRun = process.env.RUN_INTEGRATION_TESTS === 'true';

  (shouldRun ? it : it.skip)('calls HubSpot health endpoint with real token', async () => {
    const response = await request(app).get('/api/hubspot/health');

    expect(response.body.ok).toBe(true);
  });
});
