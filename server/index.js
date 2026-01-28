import crypto from 'crypto';
import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 5000;

const logPrefix = (traceId) => `[HubSpotProxy][${traceId}]`;

const redactAuthorization = (value) => {
  if (!value) {
    return '<missing>';
  }
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) {
    return trimmed;
  }
  const token = trimmed.slice(7).trim();
  const suffix = token.length > 4 ? token.slice(-4) : token;
  return `Bearer ***${suffix}`;
};

const normalizeHubSpotAuth = (authHeader, tokenFallback) => {
  const rawHeader = authHeader ? authHeader.trim() : '';
  const headerToken = rawHeader ? rawHeader.replace(/^Bearer\s+/i, '').trim() : '';
  const token = headerToken || tokenFallback || '';
  if (!token) {
    return null;
  }
  return `Bearer ${token}`;
};

const logChecklist = (traceId, checks) => {
  checks.forEach(({ id, pass, detail }) => {
    const status = pass ? 'PASS' : 'FAIL';
    const extra = detail ? ` ${detail}` : '';
    console.log(`${logPrefix(traceId)} [${id}] ${status}${extra}`);
  });
};

const classifyHubSpotFailure = ({
  status,
  method,
  host,
  path,
  responseBodyRaw,
  responseBodyJson,
  traceId
}) => {
  if (status === 404 && path.startsWith('/contacts/v1')) {
    return {
      code: 'LEGACY_ENDPOINT_USED',
      fix: 'Use /crm/v3/objects/contacts with v3 body shape.',
      evidence: { status, path, responseBodyRaw, traceId }
    };
  }
  if (status === 404 && path === '/crm/v3/objects/contacts' && method !== 'POST') {
    return {
      code: 'WRONG_METHOD_ROUTE_NOT_FOUND',
      fix: 'Use POST to the v3 contact create endpoint.',
      evidence: { status, method, path, responseBodyRaw, traceId }
    };
  }
  if (status === 404 && host !== 'api.hubapi.com') {
    return {
      code: 'WRONG_HOST',
      fix: 'Use host api.hubapi.com.',
      evidence: { status, host, responseBodyRaw, traceId }
    };
  }
  if (status === 400 && responseBodyJson) {
    return {
      code: 'BAD_BODY_SHAPE',
      fix: 'Use { "properties": { ... } } for v3 single-create.',
      evidence: { status, responseBodyRaw, responseBodyJson, traceId }
    };
  }
  if (status === 401) {
    return {
      code: 'AUTH_HEADER_MISSING_OR_INVALID',
      fix: 'Provide Authorization: Bearer <token>.',
      evidence: { status, responseBodyRaw, traceId }
    };
  }
  if (status === 403) {
    return {
      code: 'INSUFFICIENT_PERMISSIONS',
      fix: 'Update app scopes to include CRM contacts write.',
      evidence: { status, responseBodyRaw, traceId }
    };
  }
  if (status === 429) {
    return {
      code: 'RATE_LIMIT',
      fix: 'Retry with backoff; reduce request rate.',
      evidence: { status, responseBodyRaw, traceId }
    };
  }
  return null;
};

app.use(cors());
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  })
);

const HUBSPOT_BASE_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';
const fallbackToken = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_KEY;

app.get('/api/hubspot/contacts', async (req, res) => {
  const traceId = crypto.randomUUID();
  const authHeader = normalizeHubSpotAuth(req.get('authorization'), fallbackToken);

  if (!authHeader) {
    console.log(`${logPrefix(traceId)} Missing Authorization header or fallback token.`);
    return res.status(401).json({ error: 'Missing Authorization header or HubSpot token.' });
  }

  const url = new URL(HUBSPOT_BASE_URL);
  Object.entries(req.query).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  });

  const resolvedUrl = url.toString();
  const method = 'GET';
  const checks = [
    { id: 'CHECK_METHOD_GET', pass: method === 'GET', detail: `method=${method}` },
    { id: 'CHECK_URL_HOST', pass: url.host === 'api.hubapi.com', detail: `host=${url.host}` },
    { id: 'CHECK_URL_PATH_SINGLE', pass: url.pathname === '/crm/v3/objects/contacts', detail: `path=${url.pathname}` },
    {
      id: 'CHECK_AUTH_HEADER',
      pass: Boolean(authHeader?.startsWith('Bearer ')),
      detail: `authorization=${redactAuthorization(authHeader)}`
    },
    {
      id: 'CHECK_CONTENT_TYPE',
      pass: req.get('content-type') === 'application/json',
      detail: `content-type=${req.get('content-type') || '<missing>'}`
    }
  ];

  console.log(`${logPrefix(traceId)} Incoming GET /api/hubspot/contacts`);
  logChecklist(traceId, checks);
  console.log(
    `${logPrefix(traceId)} Outbound request: ${JSON.stringify({
      resolved_url: resolvedUrl,
      http_method: method,
      headers: {
        Authorization: redactAuthorization(authHeader),
        'Content-Type': 'application/json'
      },
      debug_trace_id: traceId
    })}`
  );

  try {
    const hubspotResponse = await fetch(url.toString(), {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'X-Debug-Trace-Id': traceId
      }
    });

    const responseBody = await hubspotResponse.text();
    let responseBodyJson = null;
    try {
      responseBodyJson = JSON.parse(responseBody);
    } catch (parseError) {
      responseBodyJson = null;
    }
    console.log(
      `${logPrefix(traceId)} Response received: ${JSON.stringify({
        status_code: hubspotResponse.status,
        response_headers: Object.fromEntries(hubspotResponse.headers.entries()),
        response_body_raw: responseBody,
        response_body_json: responseBodyJson
      })}`
    );
    const failure = classifyHubSpotFailure({
      status: hubspotResponse.status,
      method,
      host: url.host,
      path: url.pathname,
      responseBodyRaw: responseBody,
      responseBodyJson,
      traceId
    });
    if (failure) {
      console.log(
        `${logPrefix(traceId)} FAIL_CODE=${failure.code} evidence=${JSON.stringify(
          failure.evidence
        )} fix="${failure.fix}"`
      );
    }
    res.status(hubspotResponse.status);
    res.set('Content-Type', hubspotResponse.headers.get('content-type') ?? 'application/json');
    res.set('X-Debug-Trace-Id', traceId);
    return res.send(responseBody);
  } catch (error) {
    console.log(`${logPrefix(traceId)} Network error reaching HubSpot: ${error?.message || error}`);
    return res.status(500).json({ error: 'Failed to reach HubSpot API.' });
  }
});

app.post('/api/hubspot/contacts', async (req, res) => {
  const traceId = crypto.randomUUID();
  const authHeader = normalizeHubSpotAuth(req.get('authorization'), fallbackToken);

  if (!authHeader) {
    console.log(`${logPrefix(traceId)} Missing Authorization header or fallback token.`);
    return res.status(401).json({ error: 'Missing Authorization header or HubSpot token.' });
  }

  const method = 'POST';
  const url = new URL(HUBSPOT_BASE_URL);
  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : '';
  const parsedBody = req.body ?? {};
  const contentType = req.get('content-type') || '<missing>';
  const hasPropertiesObject =
    parsedBody &&
    typeof parsedBody === 'object' &&
    !Array.isArray(parsedBody) &&
    parsedBody.properties &&
    typeof parsedBody.properties === 'object' &&
    !Array.isArray(parsedBody.properties);
  const emailValue = hasPropertiesObject ? parsedBody.properties.email : undefined;
  const checks = [
    { id: 'CHECK_METHOD_POST', pass: method === 'POST', detail: `method=${method}` },
    { id: 'CHECK_URL_HOST', pass: url.host === 'api.hubapi.com', detail: `host=${url.host}` },
    { id: 'CHECK_URL_PATH_SINGLE', pass: url.pathname === '/crm/v3/objects/contacts', detail: `path=${url.pathname}` },
    {
      id: 'CHECK_AUTH_HEADER',
      pass: Boolean(authHeader?.startsWith('Bearer ')),
      detail: `authorization=${redactAuthorization(authHeader)}`
    },
    { id: 'CHECK_CONTENT_TYPE', pass: contentType.includes('application/json'), detail: `content-type=${contentType}` },
    {
      id: 'CHECK_BODY_JSON_PARSE',
      pass: rawBody.length === 0 || !Number.isNaN(JSON.stringify(parsedBody).length),
      detail: `body_raw=${rawBody || '<empty>'}`
    },
    {
      id: 'CHECK_BODY_PROPERTIES_OBJECT',
      pass: Boolean(hasPropertiesObject),
      detail: `body.properties=${hasPropertiesObject ? '<object>' : JSON.stringify(parsedBody?.properties)}`
    },
    {
      id: 'CHECK_BODY_EMAIL_PRESENT',
      pass: Boolean(emailValue),
      detail: `body.properties.email=${emailValue ?? '<missing>'}`
    }
  ];

  console.log(`${logPrefix(traceId)} Incoming POST /api/hubspot/contacts`);
  logChecklist(traceId, checks);
  console.log(
    `${logPrefix(traceId)} Outbound request: ${JSON.stringify({
      resolved_url: url.toString(),
      http_method: method,
      headers: {
        Authorization: redactAuthorization(authHeader),
        'Content-Type': 'application/json',
        'X-Debug-Trace-Id': traceId
      },
      request_body: parsedBody,
      debug_trace_id: traceId
    })}`
  );

  try {
    const hubspotResponse = await fetch(HUBSPOT_BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'X-Debug-Trace-Id': traceId
      },
      body: JSON.stringify(req.body ?? {})
    });

    const responseBody = await hubspotResponse.text();
    let responseBodyJson = null;
    try {
      responseBodyJson = JSON.parse(responseBody);
    } catch (parseError) {
      responseBodyJson = null;
    }
    console.log(
      `${logPrefix(traceId)} Response received: ${JSON.stringify({
        status_code: hubspotResponse.status,
        response_headers: Object.fromEntries(hubspotResponse.headers.entries()),
        response_body_raw: responseBody,
        response_body_json: responseBodyJson
      })}`
    );
    const failure = classifyHubSpotFailure({
      status: hubspotResponse.status,
      method,
      host: url.host,
      path: url.pathname,
      responseBodyRaw: responseBody,
      responseBodyJson,
      traceId
    });
    if (failure) {
      console.log(
        `${logPrefix(traceId)} FAIL_CODE=${failure.code} evidence=${JSON.stringify(
          failure.evidence
        )} fix="${failure.fix}"`
      );
    }
    res.status(hubspotResponse.status);
    res.set('Content-Type', hubspotResponse.headers.get('content-type') ?? 'application/json');
    res.set('X-Debug-Trace-Id', traceId);
    return res.send(responseBody);
  } catch (error) {
    console.log(`${logPrefix(traceId)} Network error reaching HubSpot: ${error?.message || error}`);
    return res.status(500).json({ error: 'Failed to reach HubSpot API.' });
  }
});

app.listen(port, () => {
  console.log(`HubSpot proxy server listening on port ${port}`);
});
