# HubSpot CRM v3 Contact Update: Search + Update + Diagnostics

## 1) Search by email to obtain numeric ID (curl)

```bash
curl --request POST \
  --url "https://api.hubapi.com/crm/v3/objects/contacts/search" \
  --header "Authorization: Bearer <PRIVATE_APP_ACCESS_TOKEN>" \
  --header "Content-Type: application/json" \
  --data '{
    "filterGroups": [
      {
        "filters": [
          {
            "propertyName": "email",
            "operator": "EQ",
            "value": "jane.doe@example.com"
          }
        ]
      }
    ],
    "properties": ["email", "firstname", "lastname"]
  }'
```

## 2) Update by numeric ID (curl)

```bash
curl --request PATCH \
  --url "https://api.hubapi.com/crm/v3/objects/contacts/123456" \
  --header "Authorization: Bearer <PRIVATE_APP_ACCESS_TOKEN>" \
  --header "Content-Type: application/json" \
  --data '{
    "properties": {
      "firstname": "Jane",
      "lastname": "Doe"
    }
  }'
```

## 3) Legacy (wrong) update example for comparison

```bash
curl --request PATCH \
  --url "https://api.hubapi.com/crm/v3/objects/contacts/jane.doe@example.com" \
  --header "Authorization: Bearer <PRIVATE_APP_ACCESS_TOKEN>" \
  --header "Content-Type: application/json" \
  --data '{
    "properties": [
      { "property": "firstname", "value": "Jane" }
    ]
  }'
```
