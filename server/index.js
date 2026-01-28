import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const HUBSPOT_BASE_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';

app.get('/api/hubspot/contacts', async (req, res) => {
  const authHeader = req.get('authorization');

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header.' });
  }

  const url = new URL(HUBSPOT_BASE_URL);
  Object.entries(req.query).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  });

  try {
    const hubspotResponse = await fetch(url.toString(), {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json'
      }
    });

    const responseBody = await hubspotResponse.text();
    res.status(hubspotResponse.status);
    res.set('Content-Type', hubspotResponse.headers.get('content-type') ?? 'application/json');
    return res.send(responseBody);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to reach HubSpot API.' });
  }
});

app.listen(port, () => {
  console.log(`HubSpot proxy server listening on port ${port}`);
});
