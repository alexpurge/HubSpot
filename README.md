# HubSpot Contact Uploader

This app is intentionally single-purpose: it only validates your HubSpot token and creates **contacts** via the CRM v3 API. Use the UI to run each step and inspect the raw responses so you can pinpoint where failures happen (server, token, or payload).

## Quick start

Run the server and UI in two terminals:

```bash
npm run server
npm run dev
```

Open the app at `http://localhost:5173` and follow the three steps on-screen.

## Step-by-step diagnostics

### 1) Server health check

The UI calls:

```bash
GET /api/health
```

You should see an `ok` response plus a flag indicating whether a server-side token is set.

### 2) Token validation

The UI calls:

```bash
POST /api/hubspot/validate-token
```

This checks HubSpot access by requesting a single contact (`limit=1`). If this fails, the response panel will contain HubSpot’s error details and headers.

### 3) Create contact

The UI builds the CRM v3 payload:

```json
{
  "properties": {
    "email": "person@company.com",
    "firstname": "Ada",
    "lastname": "Lovelace"
  }
}
```

and posts it to:

```bash
POST /api/hubspot/contacts
```

## Authentication options

- **Preferred (UI):** Paste a HubSpot Private App token into the UI (it automatically adds the `Bearer` prefix).
- **Optional (server env):** Set `HUBSPOT_ACCESS_TOKEN` (or `HUBSPOT_API_KEY`) and restart the server. The UI can then run with an empty token field.

Required scopes for the Private App:

- `crm.objects.contacts.read`
- `crm.objects.contacts.write`

## Manual curl examples

```bash
curl -s http://localhost:5000/api/health
```

```bash
curl -s -X POST http://localhost:5000/api/hubspot/validate-token \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

```bash
curl -s -X POST http://localhost:5000/api/hubspot/contacts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"properties":{"email":"person@company.com","firstname":"Ada"}}'
```
