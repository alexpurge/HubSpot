// 1. Import the tools we installed
require('dotenv').config(); // Load the secret password
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 5000; // Your server will live on Port 5000

// 2. Allow the frontend to talk to us
app.use(cors());
app.use(express.json());

// 3. This is the "Route". When your App asks for data, this code runs.
app.get('/api/hubspot-data', async (req, res) => {
    try {
        // The Brain calls HubSpot safely here
        const response = await axios.get('https://api.hubapi.com/crm/v3/objects/contacts', {
            headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // The Brain sends the data back to your App (Face)
        res.json(response.data);
    } catch (error) {
        console.error("HubSpot Error:", error.message);
        res.status(500).json({ error: 'Something went wrong talking to HubSpot' });
    }
});

// 4. Start the server
app.listen(PORT, () => {
    console.log(`Server is running! Access it at http://localhost:${PORT}`);
});