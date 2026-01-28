import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());

const HUBSPOT_BASE_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';
const fallbackToken = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_KEY;

app.get('/api/hubspot/ping', async (req, res) => {
  const authHeader = req.get('authorization') || (fallbackToken ? `Bearer ${fallbackToken}` : null);

  if (!authHeader) {
    return res.status(401).json({ ok: false, error: 'Missing Authorization header or HubSpot token.' });
  }

  try {
    const hubspotResponse = await fetch(`${HUBSPOT_BASE_URL}?limit=1`, {
      headers: {
        Authorization: authHeader
      }
    });

    if (hubspotResponse.ok) {
      return res.status(200).json({ ok: true });
    }

    const responseBody = await hubspotResponse.text();
    res.status(hubspotResponse.status);
    res.set('Content-Type', hubspotResponse.headers.get('content-type') ?? 'application/json');
    return res.send(responseBody || JSON.stringify({ ok: false, error: 'HubSpot returned an error.' }));
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Failed to reach HubSpot API.' });
  }
});

app.listen(port, () => {
  console.log(`HubSpot connection server listening on port ${port}`);
});
