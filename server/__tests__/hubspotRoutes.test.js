const request = require('supertest');
const app = require('../app');
const hubspotService = require('../hubspotService');

describe('HubSpot routes', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('fails fast when token is missing on health check', async () => {
    const originalToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    process.env.HUBSPOT_PRIVATE_APP_TOKEN = '';

    const response = await request(app).get('/api/hubspot/health');

    expect(response.status).toBe(500);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.message).toBe('HUBSPOT_PRIVATE_APP_TOKEN is required');
    expect(response.body.error.details.stage).toBe('validate-token');

    process.env.HUBSPOT_PRIVATE_APP_TOKEN = originalToken;
  });

  it('returns hubspot body when token is invalid', async () => {
    process.env.HUBSPOT_PRIVATE_APP_TOKEN = 'invalid-token';
    jest.spyOn(hubspotService, 'healthCheck').mockImplementation(() => {
      const error = new Error('HubSpot authentication failed');
      error.hubspotStatus = 401;
      error.hubspotBody = { message: 'INVALID_AUTHENTICATION' };
      throw error;
    });

    const response = await request(app).get('/api/hubspot/health');

    expect(response.status).toBe(500);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.hubspotBody).toEqual({ message: 'INVALID_AUTHENTICATION' });
  });

  it('lists contacts with mocked service', async () => {
    process.env.HUBSPOT_PRIVATE_APP_TOKEN = 'test-token';
    jest.spyOn(hubspotService, 'listContacts').mockResolvedValue({ results: [{ id: '1' }] });

    const response = await request(app).get('/api/hubspot/contacts?limit=1');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.results).toEqual([{ id: '1' }]);
  });
});
