# HubSpot Integration Guide (SalesOps Gem)

This document is a **single-source, step-by-step playbook** for integrating HubSpot with this repo. It is intentionally detailed and explicit so future AIs can follow it without making assumptions. The goal is **repeatable, safe setup** of the HubSpot connection flow.

> **Scope:** Authentication, local dev proxy, API connectivity checks, and how requests flow through the app. This guide avoids deep data extraction details and focuses on making the integration reliable and understandable.

---

## 1) Integration Overview (What exists today)

### High-level flow

1. **UI (React app)** collects a HubSpot Private App token from the user and sends it to the local API. The UI hits `/api/hubspot/ping` with an `Authorization: Bearer <token>` header. This lives in `src/App.jsx`.【F:src/App.jsx†L1-L116】
2. **Vite dev server** proxies `/api/*` requests to `http://localhost:5000` so the UI can call the backend without CORS issues. This is in `vite.config.js`.【F:vite.config.js†L1-L11】
3. **Express server** handles `/api/hubspot/ping`, forwards the request to HubSpot with the provided `Authorization` header, and returns `ok` if HubSpot accepts the token. This lives in `server/index.js`.【F:server/index.js†L1-L43】

### Why the proxy exists

HubSpot’s API does not allow browser calls from `localhost` directly (CORS). The Express server acts as a **secure proxy** so the browser never calls HubSpot directly. The server uses a server-to-server request instead. This is why `/api/hubspot/ping` exists in `server/index.js` and why the Vite proxy is configured. 【F:server/index.js†L1-L43】【F:vite.config.js†L1-L11】

---

## 2) Prerequisites (Required for any integration)

You need:

- **HubSpot account** with permission to create a Private App.
- **Private App token** (a `pat-...` token).
- **Node.js** for running the dev server and frontend.

---

## 3) Create a HubSpot Private App (Token Setup)

1. Log in to HubSpot.
2. Navigate to: **Settings → Integrations → Private Apps**.
3. Click **Create private app**.
4. Name the app clearly (example: `SalesOps Gem Local Dev`).
5. **Permissions:**
   - The current `/api/hubspot/ping` endpoint uses the **CRM contacts endpoint** to validate connectivity. That requires **read access** to CRM objects. If you do **not** want to use contacts, change the ping URL to an endpoint that requires the minimal permissions you’re comfortable with.
6. Create the app and copy the **Access Token** (starts with `pat-`).

> ⚠️ Treat the token like a password. Do not commit it to Git or paste it into source files.

---

## 4) Configure the backend server (Token flow)

### Option A: Provide token at runtime (recommended for dev)

1. Start the UI (Vite dev server) and the Express server.
2. Paste the token into the UI form.
3. The UI sends `Authorization: Bearer <token>` to `/api/hubspot/ping` in the backend. This logic is in `src/App.jsx`.【F:src/App.jsx†L50-L87】

### Option B: Provide token via environment variables

If you want to avoid pasting the token into the UI every time, the Express server supports a fallback token:

- `HUBSPOT_ACCESS_TOKEN` (preferred)
- `HUBSPOT_API_KEY` (fallback, legacy)

The backend uses this fallback token when the incoming request does **not** include an `Authorization` header. This behavior is implemented in `server/index.js`.【F:server/index.js†L9-L16】

Example `.env` file at repo root (do **not** commit):

```env
HUBSPOT_ACCESS_TOKEN=pat-xxxxx
```

---

## 5) Start the services (Local dev)

You must run **both** the UI and backend:

```bash
npm run server
npm run dev
```

`npm run server` starts the Express server defined in `server/index.js`. `npm run dev` starts Vite, which proxies `/api` to the backend. The scripts are defined in `package.json`.【F:package.json†L1-L15】

---

## 6) Verify the connection (What success looks like)

### Using the UI

1. Open the UI in the browser (Vite will show the local URL).
2. Enter your HubSpot token in the “HubSpot Token” field.
3. Click **Check HubSpot Connection**.
4. A successful check yields:
   - UI status = **Connected**
   - Log entry = “HubSpot connected successfully.”

All of this is handled in `src/App.jsx`.【F:src/App.jsx†L50-L116】

### Using curl (backend verification)

Use this to bypass the UI and verify the backend directly:

```bash
curl -i http://localhost:5000/api/hubspot/ping \
  -H "Authorization: Bearer pat-your-token"
```

Expected success response:

```json
{ "ok": true }
```

---

## 7) How `/api/hubspot/ping` works (Backend details)

The `/api/hubspot/ping` endpoint is intentionally minimal and only checks whether the token is valid:

- It reads `Authorization` from the incoming request, or falls back to `HUBSPOT_ACCESS_TOKEN` / `HUBSPOT_API_KEY` if missing. 【F:server/index.js†L9-L16】
- It forwards that token to HubSpot’s API (currently `crm/v3/objects/contacts?limit=1`).【F:server/index.js†L11-L24】
- If HubSpot returns a success status, `/api/hubspot/ping` returns `{ ok: true }` to the UI. 【F:server/index.js†L24-L33】
- If HubSpot returns an error, the backend passes that response through to the UI. 【F:server/index.js†L28-L33】

> ✅ **Important:** The endpoint used to “ping” is currently the contacts endpoint. That is just a **connectivity check**. You can swap to any other HubSpot endpoint if you want to avoid contact access or if your app’s permissions differ.

---

## 8) Security & token handling guidelines

### Must-do rules

- **Never commit tokens.** Store them in `.env` or supply them manually at runtime.
- **Never log tokens.** The UI and server do not log the token today—keep it that way.
- **Keep tokens in memory only.** The UI holds the token in React state only and doesn’t persist it. This is shown in `src/App.jsx`.【F:src/App.jsx†L13-L28】

### Why this matters

HubSpot tokens grant API access and should be treated like password-level secrets.

---

## 9) Troubleshooting (Common failure states)

### “Missing Authorization header or HubSpot token.”

- This error is returned by `/api/hubspot/ping` if **no token** is supplied. The check is in `server/index.js`.【F:server/index.js†L13-L18】
- Fix: Provide a token via the UI or set `HUBSPOT_ACCESS_TOKEN` in your `.env` file.

### “HubSpot connection failed (HTTP 401/403)”

- The token is invalid or lacks the permissions required by the current HubSpot endpoint (contacts endpoint).
- Fix: Validate token, update app permissions, or change the ping endpoint to one your permissions allow.

### “Failed to reach HubSpot API.”

- Network error or HubSpot API unreachable.
- Fix: Check network connectivity and HubSpot status.

---

## 10) How to change the HubSpot endpoint safely

You may want the “ping” endpoint to hit a different HubSpot API route to avoid specific data access or to align with new permissions.

### Steps:

1. Edit `HUBSPOT_BASE_URL` in `server/index.js`.
2. Pick an endpoint that requires minimal permissions (and does not return large data payloads).
3. Keep the same **limit=1** pattern or any other small request that proves connectivity.

Reference for current usage: `server/index.js` uses `https://api.hubapi.com/crm/v3/objects/contacts?limit=1`.【F:server/index.js†L9-L24】

---

## 11) Optional: Using the legacy backend server

There is a legacy server in `backend/server.js`. It exposes `/api/hubspot/ping` and `/api/hubspot/contacts`. The new recommended server for this repo is `server/index.js`, because it aligns with the current `npm run server` script and the Vite proxy. The legacy server may be removed later or used for extended logic. 【F:backend/server.js†L1-L84】【F:package.json†L1-L15】

---

## 12) Checklist: “Bulletproof” integration steps

Use this as the authoritative step-by-step process:

1. **Create HubSpot Private App** and copy the `pat-` token.
2. **Decide on token handling:**
   - UI entry (recommended for dev), or
   - `.env` variable `HUBSPOT_ACCESS_TOKEN`.
3. **Start backend**: `npm run server`.
4. **Start frontend**: `npm run dev`.
5. **Confirm Vite proxy** is routing `/api` to `http://localhost:5000` (see `vite.config.js`).【F:vite.config.js†L1-L11】
6. **Use UI to check HubSpot connection** or curl `/api/hubspot/ping`.
7. **If failure occurs**, check error output and follow troubleshooting section.
8. **If permissions fail**, adjust HubSpot app permissions or switch the ping endpoint in `server/index.js`.

---

## 13) Future integration notes for AI agents

If you’re a future agent modifying the integration, keep the following invariants:

- The UI should **never** call HubSpot directly (CORS & security).
- All HubSpot API calls must go through the backend.
- The token should be **short-lived in memory** and never persisted.
- The ping endpoint should remain **lightweight** and should not return sensitive data.
- Any new API calls should follow the same pattern as `/api/hubspot/ping`:
  1. Validate token.
  2. Forward request server-to-server.
  3. Return a minimal response to the UI.

These expectations are based on current patterns in `src/App.jsx`, `vite.config.js`, and `server/index.js`.【F:src/App.jsx†L50-L116】【F:vite.config.js†L1-L11】【F:server/index.js†L9-L35】

---

## 14) Quick reference (files involved)

- **UI logic**: `src/App.jsx` (HubSpot token input, connection check, logs).【F:src/App.jsx†L13-L116】
- **Backend proxy**: `server/index.js` (HubSpot ping endpoint, token handling).【F:server/index.js†L1-L43】
- **Vite proxy**: `vite.config.js` (`/api` → `localhost:5000`).【F:vite.config.js†L1-L11】
- **Scripts**: `package.json` (`npm run server`, `npm run dev`).【F:package.json†L1-L15】

---

## 15) Final notes

- This document is the authoritative guide for HubSpot integration in this repo.
- Keep it up-to-date if you change the server routes, endpoints, or token handling.
- If you add new HubSpot functionality, document it here step-by-step.

