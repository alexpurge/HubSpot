// 1. Import the tools we installed
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';
const fallbackToken = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_KEY;

const normalizeHubSpotAuth = (authHeader, tokenFallback) => {
    const rawHeader = authHeader ? authHeader.trim() : '';
    const headerToken = rawHeader ? rawHeader.replace(/^Bearer\s+/i, '').trim() : '';
    const token = headerToken || tokenFallback || '';
    if (!token) {
        return null;
    }
    return `Bearer ${token}`;
};

app.use(cors());
app.use(express.json());

app.get('/api/hubspot/contacts', async (req, res) => {
    const authHeader = normalizeHubSpotAuth(req.get('authorization'), fallbackToken);

    if (!authHeader) {
        return res.status(401).json({ error: 'Missing Authorization header or HubSpot token.' });
    }

    try {
        const response = await axios.get(HUBSPOT_BASE_URL, {
            headers: {
                Authorization: authHeader,
                'Content-Type': 'application/json'
            },
            params: req.query
        });

        return res.status(response.status).json(response.data);
    } catch (error) {
        const status = error.response?.status || 500;
        const message = error.response?.data || { error: 'Something went wrong talking to HubSpot' };
        return res.status(status).json(message);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running! Access it at http://localhost:${PORT}`);
});
