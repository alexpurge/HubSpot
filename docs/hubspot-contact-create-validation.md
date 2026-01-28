# HubSpot CRM v3 Contact Create: Requests + Validation/Diagnostics

## 1) Correct v3 requests (curl)

**Single create**

```bash
curl --request POST \
  --url "https://api.hubapi.com/crm/v3/objects/contacts" \
  --header "Authorization: Bearer <PRIVATE_APP_ACCESS_TOKEN>" \
  --header "Content-Type: application/json" \
  --data '{
    "properties": {
      "email": "jane.doe@example.com",
      "firstname": "Jane",
      "lastname": "Doe"
    }
  }'
```

**Batch create**

```bash
curl --request POST \
  --url "https://api.hubapi.com/crm/v3/objects/contacts/batch/create" \
  --header "Authorization: Bearer <PRIVATE_APP_ACCESS_TOKEN>" \
  --header "Content-Type: application/json" \
  --data '{
    "inputs": [
      {
        "properties": {
          "email": "jane.doe@example.com",
          "firstname": "Jane",
          "lastname": "Doe"
        }
      },
      {
        "properties": {
          "email": "john.smith@example.com",
          "firstname": "John",
          "lastname": "Smith"
        }
      }
    ]
  }'
```

## 2) Wrong legacy v1 request (curl) for comparison

```bash
curl --request POST \
  --url "https://api.hubapi.com/contacts/v1/contact" \
  --header "Authorization: Bearer <PRIVATE_APP_ACCESS_TOKEN>" \
  --header "Content-Type: application/json" \
  --data '{
    "properties": [
      { "property": "email", "value": "jane.doe@example.com" },
      { "property": "firstname", "value": "Jane" },
      { "property": "lastname", "value": "Doe" }
    ]
  }'
```

## 3) Validation + Diagnostics Framework (checklist + decision table)

### A) Pre-flight assertions (fail fast before sending)

| CHECK_ID | PASS condition | FAIL log (print exact values seen) |
| --- | --- | --- |
| CHECK_METHOD_POST | `method === "POST"` | `method=<actual>` |
| CHECK_URL_HOST | `host === "api.hubapi.com"` | `host=<actual>` |
| CHECK_URL_PATH_SINGLE | `path === "/crm/v3/objects/contacts"` | `path=<actual>` |
| CHECK_URL_PATH_BATCH | `path === "/crm/v3/objects/contacts/batch/create"` | `path=<actual>` |
| CHECK_AUTH_HEADER | `Authorization` exists and starts with `"Bearer "` | `authorization=<actual or missing>` |
| CHECK_CONTENT_TYPE | `Content-Type === "application/json"` | `content-type=<actual or missing>` |
| CHECK_BODY_JSON_PARSE | request body parses as JSON | `body_raw=<actual>` + `parse_error=<error>` |
| CHECK_BODY_PROPERTIES_OBJECT | `body.properties` exists and is an object (not array) | `body.properties=<actual>` |
| CHECK_BODY_EMAIL_PRESENT | `body.properties.email` exists (or explicitly allowed to be omitted) | `body.properties.email=<actual or missing>` |

**Implementation notes (pre-flight):**
- For batch requests, replace `CHECK_BODY_PROPERTIES_OBJECT` and `CHECK_BODY_EMAIL_PRESENT` with:
  - `CHECK_BODY_INPUTS_ARRAY`: `body.inputs` exists and is an array
  - `CHECK_BODY_INPUTS_PROPERTIES_OBJECT`: every `inputs[i].properties` is an object
  - `CHECK_BODY_INPUTS_EMAIL_PRESENT`: every `inputs[i].properties.email` exists (or explicitly allowed to be omitted)

### B) On-send instrumentation (prove what was actually sent)

At send time, log exactly:
- `resolved_url`: full URL string (protocol + host + path + query)
- `http_method`
- `headers`: with `Authorization` redacted as `Bearer ***<last4>`
- `request_body`: exact body as sent (string or JSON)
- `debug_trace_id`: locally generated UUID (also add `X-Debug-Trace-Id` header)

**Example header redaction rule**
- `Authorization: Bearer abcdef123456` → `Authorization: Bearer ***3456`

### C) On-response instrumentation (prove what came back)

Log exactly:
- `status_code`
- `response_headers` (especially any HubSpot request id header)
- `response_body_raw`
- `response_body_json` (only if JSON parse succeeds)

### D) Deterministic classification (decision table, no guessing)

| FAIL_CODE | Trigger condition (exact) | Evidence to print | One-line fix |
| --- | --- | --- | --- |
| LEGACY_ENDPOINT_USED | `status==404` AND `path` starts with `/contacts/v1` | `status`, `path`, `response_body_raw`, `response_headers`, `debug_trace_id` | Use `/crm/v3/objects/contacts` with v3 body shape. |
| WRONG_METHOD_ROUTE_NOT_FOUND | `status==404` AND `path=="/crm/v3/objects/contacts"` AND `method!=="POST"` | `status`, `method`, `path`, `response_body_raw`, `debug_trace_id` | Use POST to the v3 contact create endpoint. |
| WRONG_HOST | `status==404` AND `host!=="api.hubapi.com"` | `status`, `host`, `resolved_url`, `response_body_raw`, `debug_trace_id` | Use host `api.hubapi.com`. |
| BAD_BODY_SHAPE | `status==400` AND response JSON contains validation errors | `status`, `response_body_raw`, `response_body_json`, `debug_trace_id` | Use `{ "properties": { ... } }` for v3 single-create. |
| AUTH_HEADER_MISSING_OR_INVALID | `status==401` | `status`, `response_body_raw`, `response_headers`, `debug_trace_id` | Provide `Authorization: Bearer <token>`. |
| INSUFFICIENT_PERMISSIONS | `status==403` | `status`, `response_body_raw`, `response_headers`, `debug_trace_id` | Update app scopes to include CRM contacts write. |
| RATE_LIMIT | `status==429` | `status`, `response_body_raw`, `response_headers`, `debug_trace_id` | Retry with backoff; reduce request rate. |

### E) Required output format (internal system)

**Checklist output (example)**
```
[CHECK_METHOD_POST] PASS
[CHECK_URL_HOST] PASS
[CHECK_URL_PATH_SINGLE] FAIL path="/crm/v3/objects/contacts/123"
[CHECK_AUTH_HEADER] PASS
[CHECK_CONTENT_TYPE] PASS
[CHECK_BODY_JSON_PARSE] PASS
[CHECK_BODY_PROPERTIES_OBJECT] FAIL body.properties=[{"property":"email","value":"..."}]
[CHECK_BODY_EMAIL_PRESENT] FAIL body.properties.email=<missing>
```

**Decision output (example)**
```
FAIL_CODE=BAD_BODY_SHAPE
evidence={"status":400,"response_body_raw":"...","response_body_json":{...},"debug_trace_id":"..."}
fix="Use { \"properties\": { ... } } for v3 single-create."
```
