import crypto from 'crypto';
import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 5000;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';

app.use(cors());
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  })
);

const resolveAuthorization = (req) => {
  const header = req.get('authorization') || '';
  const headerToken = header.replace(/^Bearer\s+/i, '').trim();
  const envToken = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_KEY;
  const token = headerToken || envToken || '';

  if (!token) {
    return null;
  }

  return `Bearer ${token}`;
};

const redactToken = (value) => {
  if (!value) {
    return '<missing>';
  }

  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) {
    return trimmed;
  }

  const token = trimmed.slice(7).trim();
  if (token.length <= 8) {
    return `Bearer ${token[0]}***${token[token.length - 1]}`;
  }

  return `Bearer ${token.slice(0, 4)}…${token.slice(-4)}`;
};

const parseHubSpotResponse = async (hubspotResponse) => {
  const text = await hubspotResponse.text();
  let json = null;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch (error) {
      json = null;
    }
  }

  return { text, json };
};

const pickHubSpotHeaders = (headers) => ({
  'content-type': headers.get('content-type'),
  'x-hubspot-correlation-id': headers.get('x-hubspot-correlation-id'),
  'x-hubspot-ratelimit-daily': headers.get('x-hubspot-ratelimit-daily'),
  'x-hubspot-ratelimit-daily-remaining': headers.get('x-hubspot-ratelimit-daily-remaining'),
  'x-hubspot-ratelimit-secondly': headers.get('x-hubspot-ratelimit-secondly'),
  'x-hubspot-ratelimit-secondly-remaining': headers.get('x-hubspot-ratelimit-secondly-remaining')
});

const baseHeaders = (authHeader, traceId) => ({
  Authorization: authHeader,
  'Content-Type': 'application/json',
  'X-Debug-Trace-Id': traceId
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    serverTime: new Date().toISOString(),
    envTokenPresent: Boolean(process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_KEY)
  });
});

app.post('/api/hubspot/validate-token', async (req, res) => {
  const traceId = crypto.randomUUID();
  const authHeader = resolveAuthorization(req);

  if (!authHeader) {
    return res.status(401).json({
      traceId,
      error: 'Missing Authorization header or HUBSPOT_ACCESS_TOKEN.',
      nextStep: 'Provide a HubSpot Private App token or set HUBSPOT_ACCESS_TOKEN.'
    });
  }

  const url = new URL(HUBSPOT_BASE_URL);
  url.searchParams.set('limit', '1');

  try {
    const hubspotResponse = await fetch(url.toString(), {
      headers: baseHeaders(authHeader, traceId)
    });
    const { text, json } = await parseHubSpotResponse(hubspotResponse);

    return res.status(hubspotResponse.status).json({
      traceId,
      request: {
        method: 'GET',
        url: url.toString(),
        authorization: redactToken(authHeader)
      },
      response: {
        status: hubspotResponse.status,
        statusText: hubspotResponse.statusText,
        headers: pickHubSpotHeaders(hubspotResponse.headers),
        bodyText: text,
        bodyJson: json
      }
    });
  } catch (error) {
    return res.status(500).json({
      traceId,
      error: 'Failed to reach HubSpot API.',
      detail: error?.message || String(error)
    });
  }
});

app.post('/api/hubspot/contacts', async (req, res) => {
  const traceId = crypto.randomUUID();
  const authHeader = resolveAuthorization(req);

  if (!authHeader) {
    return res.status(401).json({
      traceId,
      error: 'Missing Authorization header or HUBSPOT_ACCESS_TOKEN.',
      nextStep: 'Provide a HubSpot Private App token or set HUBSPOT_ACCESS_TOKEN.'
    });
  }

  const payload = req.body ?? {};
  const properties = payload?.properties;
  const email = properties?.email;

  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return res.status(400).json({
      traceId,
      error: 'Invalid payload shape.',
      expected: '{ "properties": { "email": "name@domain.com", ... } }',
      received: payload
    });
  }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      traceId,
      error: 'Missing required email property.',
      expected: 'properties.email must be a non-empty string.'
    });
  }

  try {
    const hubspotResponse = await fetch(HUBSPOT_BASE_URL, {
      method: 'POST',
      headers: baseHeaders(authHeader, traceId),
      body: JSON.stringify(payload)
    });
    const { text, json } = await parseHubSpotResponse(hubspotResponse);

    return res.status(hubspotResponse.status).json({
      traceId,
      request: {
        method: 'POST',
        url: HUBSPOT_BASE_URL,
        authorization: redactToken(authHeader),
        body: payload
      },
      response: {
        status: hubspotResponse.status,
        statusText: hubspotResponse.statusText,
        headers: pickHubSpotHeaders(hubspotResponse.headers),
        bodyText: text,
        bodyJson: json
      }
    });
  } catch (error) {
    return res.status(500).json({
      traceId,
      error: 'Failed to reach HubSpot API.',
      detail: error?.message || String(error)
    });
  }
});

app.listen(port, () => {
  console.log(`HubSpot contact server listening on port ${port}`);
});
