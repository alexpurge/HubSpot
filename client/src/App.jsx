import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const GOOGLE_SHEETS_BASE = 'http://localhost:5000/api/google-sheets';

const API_BASE = 'http://localhost:5000/api/hubspot';

const createCorrelationId = () => {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `corr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const safeJsonParse = (value) => {
  if (!value) {
    return {};
  }
  return JSON.parse(value);
};

const parseFormStateFromJson = (value, defaults = []) => {
  if (!value) {
    return { defaultValues: {}, customRows: [] };
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { defaultValues: {}, customRows: [] };
    }
    const defaultKeys = new Set(defaults.map((item) => item.key));
    const defaultValues = defaults.reduce((acc, item) => {
      if (Object.prototype.hasOwnProperty.call(parsed, item.key)) {
        acc[item.key] = parsed[item.key] ?? '';
      }
      return acc;
    }, {});
    const customRows = Object.entries(parsed)
      .filter(([key]) => !defaultKeys.has(key))
      .map(([key, itemValue]) => ({
        key,
        value: itemValue ?? '',
      }));
    return { defaultValues, customRows };
  } catch (error) {
    return { defaultValues: {}, customRows: [] };
  }
};

const normalizeFormRows = (rows) => (rows && rows.length ? rows : [{ key: '', value: '' }]);
const normalizeFormValues = (values) => values || {};

const buildPropertiesFromForm = (values, rows) => {
  const properties = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      properties[key] = value;
    }
  });
  (rows || []).forEach((row) => {
    if (row.key) {
      properties[row.key] = row.value ?? '';
    }
  });
  return properties;
};

const parseCSV = (text) => {
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''));
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  if (nonEmpty.length < 2) {
    return { headers: [], rows: [] };
  }
  const parseRow = (line) => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };
  const headers = parseRow(nonEmpty[0]);
  const rows = nonEmpty.slice(1).map((line) => {
    const values = parseRow(line);
    const obj = {};
    headers.forEach((header, index) => {
      if (header) {
        obj[header] = values[index] ?? '';
      }
    });
    return obj;
  });
  return { headers, rows };
};

const CSV_COLUMN_MAP = {
  'slug': null,
  'url': 'website',
  'website?': 'website',
  'page': 'facebook_company_page',
  'ads': 'facebook_ads_library',
  'rep': 'last_sales_outreach_by',
  'date': 'last_sales_outreach_date',
  'number': 'phone',
  'number2': 'alternate_phone_number',
  'number 2': 'alternate_phone_number',
  'format': 'phone_number_format',
  'notes': 'last_sales_call_outcome',
  'email': 'email',
  'email format': 'email_format',
  'business': 'name',
  'category': 'industry1',
  'state': 'state',
  'city': 'city',
  'postcode': 'zip',
  'apes': 'pces',
  'pces': 'pces',
  'rural flag': 'rural_indicator',
  'rural?': 'rural_indicator',
  'scraped date': null,
  'scraped': null,
  'follower count': 'facebook_followers',
  'follower': 'facebook_followers',
  'probability': 'probability',
  'probability answered': null,
};

const CALL_OUTCOME_MAP = {
  'NA': 'no_answer',
  'NI': 'not-interested',
  'HU': 'hung_up',
  'WASTE': 'waste',
  'DUPE': 'dupe',
  'IN': 'invalid_number',
  'OP': 'op',
  'FU': 'follow_up',
  'TMW': 'too_much_work',
  'DNC': 'do_not_call',
};

const CSV_TARGETS = [
  { value: 'contacts', label: 'Create Contacts', path: '/contacts/create' },
  { value: 'companies', label: 'Create Companies', path: '/companies/create' },
  { value: 'deals', label: 'Create Deals', path: '/deals/create' },
];

const parseDateToMidnightUTC = (value) => {
  if (!value) return value;
  // Strip trailing dots/spaces, normalize separators
  const cleaned = value.trim().replace(/[.\s]+$/, '');
  // Already a ms or seconds timestamp
  if (/^\d{10,13}$/.test(cleaned)) {
    const ts = Number(cleaned);
    const d = new Date(ts > 9999999999 ? ts : ts * 1000);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime().toString();
  }
  // Normalise dots, dashes, spaces to slashes so all separators are uniform
  const normalised = cleaned.replace(/[\.\-\s]+/g, '/');
  // AU format: D/M/YYYY or DD/MM/YYYY (also handles single-digit day/month)
  const dmy = normalised.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1])));
    if (!isNaN(d.getTime())) return d.getTime().toString();
  }
  // ISO: YYYY/MM/DD
  const iso = normalised.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    if (!isNaN(d.getTime())) return d.getTime().toString();
  }
  // Fallback for anything else Date can understand
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime().toString();
  }
  return value;
};

const transformCsvProperties = (properties) => {
  if (properties.last_sales_call_outcome) {
    const upper = properties.last_sales_call_outcome.toUpperCase().trim();
    if (upper.startsWith('OP')) {
      properties.last_sales_call_outcome = 'op';
    } else if (CALL_OUTCOME_MAP[upper]) {
      properties.last_sales_call_outcome = CALL_OUTCOME_MAP[upper];
    }
  }
  if (properties.last_sales_outreach_date) {
    properties.last_sales_outreach_date = parseDateToMidnightUTC(properties.last_sales_outreach_date);
  }
  return properties;
};

const extractInvalidProperty = (data, remainingKeys) => {
  try {
    const body = data.error?.hubspotBody;
    if (!body) return null;
    const msg = typeof body === 'string' ? body : (body.message || '');
    const jsonMatch = msg.match(/\[.*\]/s);
    if (jsonMatch) {
      const items = JSON.parse(jsonMatch[0]);
      if (Array.isArray(items) && items.length > 0 && items[0].name) {
        return items[0].name;
      }
    }
    if (body.validationResults) {
      if (Array.isArray(body.validationResults) && body.validationResults.length > 0) {
        return body.validationResults[0].name || null;
      }
      const keys = Object.keys(body.validationResults);
      if (keys.length > 0) return keys[0];
    }
    for (const key of remainingKeys) {
      if (msg.includes(key)) return key;
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

const resolvePropertiesPayload = (values) => {
  const mode = values.propertiesMode || 'form';
  if (mode === 'form') {
    return buildPropertiesFromForm(values.propertiesFormValues, values.propertiesFormRows);
  }
  return safeJsonParse(values.properties);
};

const defaultResultState = {
  request: null,
  response: null,
  correlationId: null,
  error: null,
  status: null,
};

const Field = ({ field, value, onChange }) => {
  if (field.type === 'textarea') {
    return (
      <label className="field">
        <span>{field.label}</span>
        <textarea
          value={value}
          onChange={(event) => onChange(field.name, event.target.value)}
          placeholder={field.placeholder}
          rows={field.rows || 4}
        />
      </label>
    );
  }

  return (
    <label className="field">
      <span>{field.label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(field.name, event.target.value)}
        placeholder={field.placeholder}
      />
    </label>
  );
};

const PropertiesForm = ({
  defaults,
  values,
  onValuesChange,
  rows,
  onRowsChange,
  showStandard = true,
  showCustom = true,
  title = 'Properties',
}) => {
  const safeRows = normalizeFormRows(rows);
  const safeValues = normalizeFormValues(values);

  const updateRow = (index, key, value) => {
    const nextRows = safeRows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [key]: value } : row
    );
    onRowsChange(nextRows);
  };

  const addRow = () => {
    onRowsChange([...safeRows, { key: '', value: '' }]);
  };

  const removeRow = (index) => {
    const nextRows = safeRows.filter((_, rowIndex) => rowIndex !== index);
    onRowsChange(nextRows.length ? nextRows : [{ key: '', value: '' }]);
  };

  return (
    <div className="field field--full">
      <span>{title}</span>
      <div className="properties-form">
        {showStandard && defaults.length > 0 && (
          <div className="properties-section">
            <div className="properties-section__title">Standard properties</div>
            <div className="properties-defaults">
              {defaults.map((item) => (
                <label className="field" key={item.key}>
                  <span>{item.label}</span>
                  <input
                    type="text"
                    value={safeValues[item.key] ?? ''}
                    onChange={(event) =>
                      onValuesChange({
                        ...safeValues,
                        [item.key]: event.target.value,
                      })
                    }
                    placeholder={item.placeholder}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
        {showCustom && (
          <div className="properties-section">
            <div className="properties-section__title">Custom properties</div>
            {safeRows.map((row, index) => (
              <div className="properties-row" key={`property-row-${index}`}>
                <input
                  type="text"
                  value={row.key}
                  onChange={(event) => updateRow(index, 'key', event.target.value)}
                  placeholder="Property name"
                />
                <input
                  type="text"
                  value={row.value}
                  onChange={(event) => updateRow(index, 'value', event.target.value)}
                  placeholder="Value"
                />
                <button type="button" className="properties-remove" onClick={() => removeRow(index)}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="properties-add" onClick={addRow}>
              Add property
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const OperationCard = ({ operation, values, onChange, onChangeValues, onExecute, result }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const propertiesField = operation.fields.find((field) => field.kind === 'properties');
  const otherFields = operation.fields.filter((field) => field.kind !== 'properties');
  const propertiesMode = values.propertiesMode || 'form';
  const propertiesDefaults = propertiesField?.defaults || [];
  const statusLabel = result.status === 'error' ? 'Unsuccessful' : 'Successful';
  const statusClassName = result.status === 'error' ? 'status status--error' : 'status status--success';

  const handleModeChange = (mode) => {
    if (mode === propertiesMode) {
      return;
    }
    const updates = { propertiesMode: mode };
    if (mode === 'form' && (!values.propertiesFormRows || values.propertiesFormRows.length === 0)) {
      const seededState = parseFormStateFromJson(values.properties, propertiesDefaults);
      updates.propertiesFormValues = seededState.defaultValues;
      updates.propertiesFormRows = seededState.customRows.length
        ? seededState.customRows
        : [{ key: '', value: '' }];
    }
    onChangeValues(updates);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>{operation.label}</h3>
        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setShowAdvanced((prev) => !prev)}
          aria-expanded={showAdvanced}
        >
          <span className="advanced-toggle__icon" aria-hidden="true">
            ⚙
          </span>
          Advanced settings
        </button>
      </div>
      <div className="card-body">
        <div className="card-status">
          {result.status && <span className={statusClassName}>{statusLabel}</span>}
        </div>
        <div className="fields">
          {otherFields.map((field) => (
            <Field
              key={field.name}
              field={field}
              value={values[field.name] ?? ''}
              onChange={onChange}
            />
          ))}
          {propertiesField && propertiesMode === 'form' && (
            <PropertiesForm
              defaults={propertiesDefaults}
              values={values.propertiesFormValues}
              onValuesChange={(nextValues) => onChangeValues({ propertiesFormValues: nextValues })}
              rows={values.propertiesFormRows}
              onRowsChange={(rows) => onChangeValues({ propertiesFormRows: rows })}
              showCustom={false}
              title="Properties"
            />
          )}
        </div>
        {showAdvanced && (
          <div className="advanced">
            {propertiesField && (
              <div className="input-mode">
                <span>Input mode</span>
                <div className="mode-toggle">
                  <button
                    type="button"
                    className={propertiesMode === 'form' ? 'active' : ''}
                    onClick={() => handleModeChange('form')}
                  >
                    Form
                  </button>
                  <button
                    type="button"
                    className={propertiesMode === 'json' ? 'active' : ''}
                    onClick={() => handleModeChange('json')}
                  >
                    JSON
                  </button>
                </div>
              </div>
            )}
            <div className="advanced-content">
              {propertiesField && propertiesMode === 'json' && (
                <Field
                  field={propertiesField}
                  value={values[propertiesField.name] ?? ''}
                  onChange={onChange}
                />
              )}
              {propertiesField && propertiesMode === 'form' && (
                <PropertiesForm
                  defaults={propertiesDefaults}
                  values={values.propertiesFormValues}
                  onValuesChange={(nextValues) => onChangeValues({ propertiesFormValues: nextValues })}
                  rows={values.propertiesFormRows}
                  onRowsChange={(rows) => onChangeValues({ propertiesFormRows: rows })}
                  showStandard={false}
                  title="Custom properties"
                />
              )}
              <div className="result">
                <div>
                  <strong>Correlation Id:</strong> {result.correlationId || '—'}
                </div>
                <div className="result-block">
                  <span>Request Payload</span>
                  <pre>{result.request ? JSON.stringify(result.request, null, 2) : '—'}</pre>
                </div>
                <div className="result-block">
                  <span>Response JSON</span>
                  <pre>{result.response ? JSON.stringify(result.response, null, 2) : '—'}</pre>
                </div>
                {result.error && <div className="error">{result.error}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="card-footer">
        <button type="button" className="primary-button" onClick={() => onExecute(operation)}>
          Submit
        </button>
      </div>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const tokenClientRef = useRef(null);

  const handleTokenResponse = useCallback(async (response) => {
    if (response.error) {
      setAuthError(response.error_description || response.error);
      setAuthLoading(false);
      return;
    }
    const token = response.access_token;
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = await res.json();
      setUser({ email: profile.email, name: profile.name, picture: profile.picture, token });
      setAuthError(null);
    } catch {
      setAuthError('Failed to fetch user profile');
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    const initGis = () => {
      if (!window.google?.accounts?.oauth2) {
        setTimeout(initGis, 200);
        return;
      }
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: 'openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly',
        callback: handleTokenResponse,
      });
    };
    initGis();
  }, [handleTokenResponse]);

  const handleSignIn = () => {
    setAuthLoading(true);
    setAuthError(null);
    tokenClientRef.current?.requestAccessToken();
  };

  const handleSignOut = () => {
    if (user?.token) {
      window.google.accounts.oauth2.revoke(user.token, () => {});
    }
    setUser(null);
  };

  const apiFetch = useCallback(async (url, options = {}) => {
    const start = Date.now();
    const correlationId = options.headers?.['x-correlation-id'] || '';
    const method = options.method || 'GET';
    const path = url.replace(API_BASE, '').replace(GOOGLE_SHEETS_BASE, '/sheets');
    let requestBody = null;
    if (options.body) {
      try { requestBody = JSON.parse(options.body); } catch { requestBody = options.body; }
    }
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${user?.token || ''}`,
        },
      });
      const cloned = response.clone();
      let responseData = null;
      try { responseData = await cloned.json(); } catch {}
      const durationMs = Date.now() - start;
      setLogEntries((prev) => [{
        id: createCorrelationId(),
        timestamp: new Date(),
        method,
        path,
        correlationId,
        requestBody,
        response: responseData,
        status: responseData?.ok !== false ? 'success' : 'error',
        error: responseData?.ok === false ? (responseData?.error?.message || 'Request failed') : null,
        durationMs,
      }, ...prev]);
      return response;
    } catch (err) {
      const durationMs = Date.now() - start;
      setLogEntries((prev) => [{
        id: createCorrelationId(),
        timestamp: new Date(),
        method,
        path,
        correlationId,
        requestBody,
        response: null,
        status: 'error',
        error: err.message,
        durationMs,
      }, ...prev]);
      throw err;
    }
  }, [user]);

  const categories = useMemo(
    () => [
      {
        id: 'contacts',
        label: 'Contacts',
        operations: [
          {
            id: 'contacts.create',
            label: 'Create Contact',
            buildRequest: (values) => ({
              method: 'POST',
              path: '/contacts/create',
              body: { properties: resolvePropertiesPayload(values) },
            }),
            fields: [
              {
                name: 'properties',
                label: 'Properties JSON (include email)',
                type: 'textarea',
                placeholder: '{"email": "name@example.com", "firstname": "Ada"}',
                rows: 5,
                kind: 'properties',
                defaults: [
                  { key: 'email', label: 'Email', placeholder: 'name@example.com' },
                  { key: 'firstname', label: 'First name', placeholder: 'Ada' },
                  { key: 'lastname', label: 'Last name', placeholder: 'Lovelace' },
                  { key: 'phone', label: 'Phone', placeholder: '+1 (555) 000-0000' },
                  { key: 'company', label: 'Company', placeholder: 'Example Co' },
                  { key: 'jobtitle', label: 'Job title', placeholder: 'Engineer' },
                ],
              },
            ],
          },
          {
            id: 'contacts.getById',
            label: 'Get Contact By Id',
            buildRequest: (values) => ({
              method: 'GET',
              path: `/contacts/${values.contactId}?properties=${encodeURIComponent(values.properties || '')}`,
            }),
            fields: [
              { name: 'contactId', label: 'Contact Id', placeholder: '123' },
              { name: 'properties', label: 'Properties CSV', placeholder: 'email,firstname' },
            ],
          },
          {
            id: 'contacts.searchByEmail',
            label: 'Search Contact By Email',
            buildRequest: (values) => ({
              method: 'POST',
              path: '/contacts/search/email',
              body: { email: values.email },
            }),
            fields: [{ name: 'email', label: 'Email', placeholder: 'name@example.com' }],
          },
          {
            id: 'contacts.updateById',
            label: 'Update Contact By Id',
            buildRequest: (values) => ({
              method: 'PATCH',
              path: `/contacts/${values.contactId}`,
              body: { properties: resolvePropertiesPayload(values) },
            }),
            fields: [
              { name: 'contactId', label: 'Contact Id', placeholder: '123' },
              {
                name: 'properties',
                label: 'Properties JSON',
                type: 'textarea',
                placeholder: '{"firstname": "Ada"}',
                rows: 4,
                kind: 'properties',
                defaults: [
                  { key: 'email', label: 'Email', placeholder: 'name@example.com' },
                  { key: 'firstname', label: 'First name', placeholder: 'Ada' },
                  { key: 'lastname', label: 'Last name', placeholder: 'Lovelace' },
                  { key: 'phone', label: 'Phone', placeholder: '+1 (555) 000-0000' },
                  { key: 'company', label: 'Company', placeholder: 'Example Co' },
                  { key: 'jobtitle', label: 'Job title', placeholder: 'Engineer' },
                ],
              },
            ],
          },
          {
            id: 'contacts.upsertByEmail',
            label: 'Upsert Contact By Email',
            buildRequest: (values) => ({
              method: 'POST',
              path: '/contacts/upsert',
              body: { email: values.email, properties: resolvePropertiesPayload(values) },
            }),
            fields: [
              { name: 'email', label: 'Email', placeholder: 'name@example.com' },
              {
                name: 'properties',
                label: 'Properties JSON',
                type: 'textarea',
                placeholder: '{"firstname": "Ada"}',
                rows: 4,
                kind: 'properties',
                defaults: [
                  { key: 'email', label: 'Email', placeholder: 'name@example.com' },
                  { key: 'firstname', label: 'First name', placeholder: 'Ada' },
                  { key: 'lastname', label: 'Last name', placeholder: 'Lovelace' },
                  { key: 'phone', label: 'Phone', placeholder: '+1 (555) 000-0000' },
                  { key: 'company', label: 'Company', placeholder: 'Example Co' },
                  { key: 'jobtitle', label: 'Job title', placeholder: 'Engineer' },
                ],
              },
            ],
          },
          {
            id: 'contacts.list',
            label: 'List Contacts Paging',
            buildRequest: (values) => ({
              method: 'GET',
              path: `/contacts?limit=${values.limit || 10}&after=${values.after || ''}`,
            }),
            fields: [
              { name: 'limit', label: 'Limit', placeholder: '10' },
              { name: 'after', label: 'After', placeholder: 'cursor' },
            ],
          },
        ],
      },
      {
        id: 'companies',
        label: 'Companies',
        operations: [
          {
            id: 'companies.create',
            label: 'Create Company',
            buildRequest: (values) => ({
              method: 'POST',
              path: '/companies/create',
              body: { properties: resolvePropertiesPayload(values) },
            }),
            fields: [
              {
                name: 'properties',
                label: 'Properties JSON (include name/domain)',
                type: 'textarea',
                placeholder: '{"name": "Example Co", "domain": "example.com"}',
                rows: 5,
                kind: 'properties',
                defaults: [
                  { key: 'name', label: 'Company name', placeholder: 'Example Co' },
                  { key: 'domain', label: 'Domain', placeholder: 'example.com' },
                  { key: 'phone', label: 'Phone', placeholder: '+1 (555) 000-0000' },
                  { key: 'city', label: 'City', placeholder: 'San Francisco' },
                  { key: 'state', label: 'State', placeholder: 'CA' },
                  { key: 'industry', label: 'Industry', placeholder: 'Software' },
                ],
              },
            ],
          },
          {
            id: 'companies.getById',
            label: 'Get Company By Id',
            buildRequest: (values) => ({
              method: 'GET',
              path: `/companies/${values.companyId}?properties=${encodeURIComponent(values.properties || '')}`,
            }),
            fields: [
              { name: 'companyId', label: 'Company Id', placeholder: '123' },
              { name: 'properties', label: 'Properties CSV', placeholder: 'name,domain' },
            ],
          },
          {
            id: 'companies.search',
            label: 'Search Company By Domain or Name',
            buildRequest: (values) => ({
              method: 'POST',
              path: '/companies/search',
              body: { domain: values.domain, name: values.name },
            }),
            fields: [
              { name: 'domain', label: 'Domain', placeholder: 'example.com' },
              { name: 'name', label: 'Name', placeholder: 'Example' },
            ],
          },
          {
            id: 'companies.updateById',
            label: 'Update Company By Id',
            buildRequest: (values) => ({
              method: 'PATCH',
              path: `/companies/${values.companyId}`,
              body: { properties: resolvePropertiesPayload(values) },
            }),
            fields: [
              { name: 'companyId', label: 'Company Id', placeholder: '123' },
              {
                name: 'properties',
                label: 'Properties JSON',
                type: 'textarea',
                placeholder: '{"name": "New Name"}',
                rows: 4,
                kind: 'properties',
                defaults: [
                  { key: 'name', label: 'Company name', placeholder: 'Example Co' },
                  { key: 'domain', label: 'Domain', placeholder: 'example.com' },
                  { key: 'phone', label: 'Phone', placeholder: '+1 (555) 000-0000' },
                  { key: 'city', label: 'City', placeholder: 'San Francisco' },
                  { key: 'state', label: 'State', placeholder: 'CA' },
                  { key: 'industry', label: 'Industry', placeholder: 'Software' },
                ],
              },
            ],
          },
          {
            id: 'companies.list',
            label: 'List Companies Paging',
            buildRequest: (values) => ({
              method: 'GET',
              path: `/companies?limit=${values.limit || 10}&after=${values.after || ''}`,
            }),
            fields: [
              { name: 'limit', label: 'Limit', placeholder: '10' },
              { name: 'after', label: 'After', placeholder: 'cursor' },
            ],
          },
        ],
      },
      {
        id: 'deals',
        label: 'Deals',
        operations: [
          {
            id: 'deals.create',
            label: 'Create Deal',
            buildRequest: (values) => ({
              method: 'POST',
              path: '/deals/create',
              body: { properties: resolvePropertiesPayload(values) },
            }),
            fields: [
              {
                name: 'properties',
                label: 'Properties JSON (include dealname, pipeline, dealstage)',
                type: 'textarea',
                placeholder: '{"dealname": "New Deal", "pipeline": "default", "dealstage": "appointmentscheduled"}',
                rows: 5,
                kind: 'properties',
                defaults: [
                  { key: 'dealname', label: 'Deal name', placeholder: 'New Deal' },
                  { key: 'amount', label: 'Amount', placeholder: '15000' },
                  { key: 'pipeline', label: 'Pipeline', placeholder: 'default' },
                  { key: 'dealstage', label: 'Deal stage', placeholder: 'appointmentscheduled' },
                  { key: 'closedate', label: 'Close date', placeholder: '2024-12-31' },
                ],
              },
            ],
          },
          {
            id: 'deals.getById',
            label: 'Get Deal By Id',
            buildRequest: (values) => ({
              method: 'GET',
              path: `/deals/${values.dealId}?properties=${encodeURIComponent(values.properties || '')}`,
            }),
            fields: [
              { name: 'dealId', label: 'Deal Id', placeholder: '123' },
              { name: 'properties', label: 'Properties CSV', placeholder: 'dealname,dealstage' },
            ],
          },
          {
            id: 'deals.updateById',
            label: 'Update Deal By Id',
            buildRequest: (values) => ({
              method: 'PATCH',
              path: `/deals/${values.dealId}`,
              body: { properties: resolvePropertiesPayload(values) },
            }),
            fields: [
              { name: 'dealId', label: 'Deal Id', placeholder: '123' },
              {
                name: 'properties',
                label: 'Properties JSON',
                type: 'textarea',
                placeholder: '{"dealname": "Updated"}',
                rows: 4,
                kind: 'properties',
                defaults: [
                  { key: 'dealname', label: 'Deal name', placeholder: 'Updated Deal' },
                  { key: 'amount', label: 'Amount', placeholder: '15000' },
                  { key: 'pipeline', label: 'Pipeline', placeholder: 'default' },
                  { key: 'dealstage', label: 'Deal stage', placeholder: 'appointmentscheduled' },
                  { key: 'closedate', label: 'Close date', placeholder: '2024-12-31' },
                ],
              },
            ],
          },
          {
            id: 'deals.list',
            label: 'List Deals Paging',
            buildRequest: (values) => ({
              method: 'GET',
              path: `/deals?limit=${values.limit || 10}&after=${values.after || ''}`,
            }),
            fields: [
              { name: 'limit', label: 'Limit', placeholder: '10' },
              { name: 'after', label: 'After', placeholder: 'cursor' },
            ],
          },
        ],
      },
      {
        id: 'associations',
        label: 'Associations',
        operations: [
          {
            id: 'associations.contactCompany',
            label: 'Associate Contact To Company',
            buildRequest: (values) => ({
              method: 'POST',
              path: '/associations/contact-company',
              body: {
                contactId: values.contactId,
                companyId: values.companyId,
                associationTypeId: values.associationTypeId ? Number(values.associationTypeId) : undefined,
              },
            }),
            fields: [
              { name: 'contactId', label: 'Contact Id', placeholder: '123' },
              { name: 'companyId', label: 'Company Id', placeholder: '456' },
              { name: 'associationTypeId', label: 'Association Type Id (optional)', placeholder: '279' },
            ],
          },
          {
            id: 'associations.dealContact',
            label: 'Associate Deal To Contact',
            buildRequest: (values) => ({
              method: 'POST',
              path: '/associations/deal-contact',
              body: {
                dealId: values.dealId,
                contactId: values.contactId,
                associationTypeId: values.associationTypeId ? Number(values.associationTypeId) : undefined,
              },
            }),
            fields: [
              { name: 'dealId', label: 'Deal Id', placeholder: '123' },
              { name: 'contactId', label: 'Contact Id', placeholder: '456' },
              { name: 'associationTypeId', label: 'Association Type Id (optional)', placeholder: '4' },
            ],
          },
          {
            id: 'associations.dealCompany',
            label: 'Associate Deal To Company',
            buildRequest: (values) => ({
              method: 'POST',
              path: '/associations/deal-company',
              body: {
                dealId: values.dealId,
                companyId: values.companyId,
                associationTypeId: values.associationTypeId ? Number(values.associationTypeId) : undefined,
              },
            }),
            fields: [
              { name: 'dealId', label: 'Deal Id', placeholder: '123' },
              { name: 'companyId', label: 'Company Id', placeholder: '456' },
              { name: 'associationTypeId', label: 'Association Type Id (optional)', placeholder: '5' },
            ],
          },
        ],
      },
      {
        id: 'owners',
        label: 'Owners',
        operations: [
          {
            id: 'owners.list',
            label: 'List Owners',
            buildRequest: (values) => ({
              method: 'GET',
              path: `/owners?email=${encodeURIComponent(values.email || '')}&limit=${values.limit || 100}&after=${values.after || ''}`,
            }),
            fields: [
              { name: 'email', label: 'Email Filter', placeholder: 'user@example.com' },
              { name: 'limit', label: 'Limit', placeholder: '100' },
              { name: 'after', label: 'After', placeholder: 'cursor' },
            ],
          },
        ],
      },
      {
        id: 'pipelines',
        label: 'Pipelines',
        operations: [
          {
            id: 'pipelines.deals.list',
            label: 'List Deal Pipelines',
            buildRequest: () => ({ method: 'GET', path: '/pipelines/deals' }),
            fields: [],
          },
          {
            id: 'pipelines.deals.stages',
            label: 'List Pipeline Stages',
            buildRequest: (values) => ({ method: 'GET', path: `/pipelines/deals/${values.pipelineId}/stages` }),
            fields: [{ name: 'pipelineId', label: 'Pipeline Id', placeholder: 'default' }],
          },
        ],
      },
      {
        id: 'properties',
        label: 'Properties',
        operations: [
          {
            id: 'properties.contacts.list',
            label: 'List Contact Properties',
            buildRequest: () => ({ method: 'GET', path: '/properties/contacts' }),
            fields: [],
          },
          {
            id: 'properties.companies.list',
            label: 'List Company Properties',
            buildRequest: () => ({ method: 'GET', path: '/properties/companies' }),
            fields: [],
          },
          {
            id: 'properties.deals.list',
            label: 'List Deal Properties',
            buildRequest: () => ({ method: 'GET', path: '/properties/deals' }),
            fields: [],
          },
        ],
      },
      {
        id: 'engagements',
        label: 'Engagement',
        operations: [
          {
            id: 'engagements.notes.create',
            label: 'Create Note',
            buildRequest: (values) => ({
              method: 'POST',
              path: '/engagements/notes',
              body: { properties: resolvePropertiesPayload(values) },
            }),
            fields: [
              {
                name: 'properties',
                label: 'Properties JSON (hs_note_body, hs_timestamp)',
                type: 'textarea',
                placeholder: '{"hs_note_body": "Note text", "hs_timestamp": "1714761600000"}',
                rows: 5,
                kind: 'properties',
                defaults: [
                  { key: 'hs_note_body', label: 'Note body', placeholder: 'Note text' },
                  { key: 'hs_timestamp', label: 'Timestamp (ms)', placeholder: '1714761600000' },
                ],
              },
            ],
          },
          {
            id: 'engagements.tasks.create',
            label: 'Create Task',
            buildRequest: (values) => ({
              method: 'POST',
              path: '/engagements/tasks',
              body: { properties: resolvePropertiesPayload(values) },
            }),
            fields: [
              {
                name: 'properties',
                label: 'Properties JSON (hs_task_body, hs_timestamp)',
                type: 'textarea',
                placeholder: '{"hs_task_body": "Follow up", "hs_timestamp": "1714761600000"}',
                rows: 5,
                kind: 'properties',
                defaults: [
                  { key: 'hs_task_body', label: 'Task body', placeholder: 'Follow up' },
                  { key: 'hs_timestamp', label: 'Timestamp (ms)', placeholder: '1714761600000' },
                  { key: 'hs_task_status', label: 'Task status', placeholder: 'NOT_STARTED' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'webhooks',
        label: 'Webhooks',
        operations: [
          {
            id: 'webhooks.list',
            label: 'List Webhook Subscriptions (OAuth required)',
            buildRequest: () => ({ method: 'GET', path: '/webhooks/subscriptions' }),
            fields: [],
          },
        ],
      },
    ],
    []
  );

  const [activePage, setActivePage] = useState(null);
  const [formState, setFormState] = useState({});
  const [results, setResults] = useState({});
  const statusTimersRef = useRef({});
  const [rawRequest, setRawRequest] = useState({
    method: 'GET',
    path: '/health',
    body: '',
  });
  const [rawResult, setRawResult] = useState(defaultResultState);
  const [showRawAdvanced, setShowRawAdvanced] = useState(false);
  const [csvTarget, setCsvTarget] = useState('contacts');
  const [csvStatus, setCsvStatus] = useState(null);
  const [csvDragOver, setCsvDragOver] = useState(false);
  const csvInputRef = useRef(null);
  const [sheetsList, setSheetsList] = useState([]);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [sheetTabs, setSheetTabs] = useState([]);
  const [selectedTab, setSelectedTab] = useState('');
  const [sheetsError, setSheetsError] = useState(null);
  const [logEntries, setLogEntries] = useState([]);

  const rawStatusLabel = rawResult.status === 'error' ? 'Unsuccessful' : 'Successful';
  const rawStatusClassName = rawResult.status === 'error' ? 'status status--error' : 'status status--success';
  const rawStatusTimerRef = useRef(null);

  const updateFormValues = (operationId, updates) => {
    setFormState((prev) => ({
      ...prev,
      [operationId]: {
        ...(prev[operationId] || {}),
        ...updates,
      },
    }));
  };

  const scheduleStatusReset = (operationId) => {
    if (statusTimersRef.current[operationId]) {
      clearTimeout(statusTimersRef.current[operationId]);
    }
    statusTimersRef.current[operationId] = setTimeout(() => {
      setResults((prev) => {
        const current = prev[operationId];
        if (!current) {
          return prev;
        }
        return {
          ...prev,
          [operationId]: {
            ...current,
            status: null,
          },
        };
      });
    }, 3000);
  };

  const scheduleRawStatusReset = () => {
    if (rawStatusTimerRef.current) {
      clearTimeout(rawStatusTimerRef.current);
    }
    rawStatusTimerRef.current = setTimeout(() => {
      setRawResult((prev) => ({
        ...prev,
        status: null,
      }));
    }, 3000);
  };

  const clearOperationFields = (operation) => {
    const updates = operation.fields.reduce(
      (acc, field) => ({
        ...acc,
        [field.name]: '',
      }),
      {}
    );
    const hasPropertiesField = operation.fields.some((field) => field.kind === 'properties');

    if (hasPropertiesField) {
      updates.propertiesFormValues = {};
      updates.propertiesFormRows = [{ key: '', value: '' }];
    }

    if (Object.keys(updates).length === 0) {
      return;
    }

    setFormState((prev) => ({
      ...prev,
      [operation.id]: {
        ...(prev[operation.id] || {}),
        ...updates,
      },
    }));
  };

  const executeOperation = async (operation) => {
    const values = formState[operation.id] || {};
    const correlationId = createCorrelationId();

    let requestConfig;
    try {
      requestConfig = operation.buildRequest(values);
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [operation.id]: {
          ...defaultResultState,
          correlationId,
          error: `Invalid JSON input: ${error.message}`,
          status: 'error',
        },
      }));
      return;
    }

    const requestPayload = {
      method: requestConfig.method,
      path: requestConfig.path,
      body: requestConfig.body || null,
    };

    setResults((prev) => ({
      ...prev,
      [operation.id]: {
        ...defaultResultState,
        request: requestPayload,
        correlationId,
      },
    }));

    if (statusTimersRef.current[operation.id]) {
      clearTimeout(statusTimersRef.current[operation.id]);
    }

    try {
      const response = await apiFetch(`${API_BASE}${requestConfig.path}`, {
        method: requestConfig.method,
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
        },
        body: requestConfig.body ? JSON.stringify(requestConfig.body) : undefined,
      });

      const data = await response.json();
      setResults((prev) => ({
        ...prev,
        [operation.id]: {
          ...prev[operation.id],
          response: data,
          status: 'success',
        },
      }));
      scheduleStatusReset(operation.id);
      clearOperationFields(operation);
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [operation.id]: {
          ...prev[operation.id],
          error: error.message,
          status: 'error',
        },
      }));
    }
  };

  const executeRawRequest = async () => {
    const correlationId = createCorrelationId();
    let body;
    try {
      body = rawRequest.body ? JSON.parse(rawRequest.body) : null;
    } catch (error) {
      setRawResult({
        ...defaultResultState,
        correlationId,
        error: `Invalid JSON input: ${error.message}`,
        status: 'error',
      });
      return;
    }

    const requestPayload = {
      method: rawRequest.method,
      path: rawRequest.path,
      body,
    };

    setRawResult({
      ...defaultResultState,
      correlationId,
      request: requestPayload,
    });

    if (rawStatusTimerRef.current) {
      clearTimeout(rawStatusTimerRef.current);
    }

    try {
      const response = await apiFetch(`${API_BASE}${rawRequest.path}`, {
        method: rawRequest.method,
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      setRawResult((prev) => ({
        ...prev,
        response: data,
        status: 'success',
      }));
      scheduleRawStatusReset();
    } catch (error) {
      setRawResult((prev) => ({
        ...prev,
        error: error.message,
        status: 'error',
      }));
    }
  };

  const handleCsvDragOver = (e) => {
    e.preventDefault();
    setCsvDragOver(true);
  };

  const handleCsvDragLeave = () => {
    setCsvDragOver(false);
  };

  const handleCsvDrop = (e) => {
    e.preventDefault();
    setCsvDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      processCSVUpload(file);
    }
  };

  const handleCsvFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      processCSVUpload(file);
    }
    e.target.value = '';
  };

  const processSheetRows = async (rows, target) => {
    const BATCH_SIZE = 100;
    const CONCURRENCY = 6;

    setCsvStatus((prev) => ({
      ...prev,
      state: 'uploading',
      total: rows.length,
    }));

    // Map all rows to properties upfront
    const allProperties = rows.map((row) => {
      const properties = {};
      Object.entries(row).forEach(([key, value]) => {
        if (value === '') return;
        const lowerKey = key.toLowerCase().trim();
        if (lowerKey in CSV_COLUMN_MAP) {
          const mapped = CSV_COLUMN_MAP[lowerKey];
          if (mapped !== null) {
            properties[mapped] = value;
          }
        }
      });
      return transformCsvProperties(properties);
    });

    // Chunk into batches of 100
    const batches = [];
    for (let i = 0; i < allProperties.length; i += BATCH_SIZE) {
      batches.push({
        startIndex: i,
        items: allProperties.slice(i, i + BATCH_SIZE).map((p) => ({ properties: p })),
      });
    }

    const errors = [];
    const warnings = [];
    let completed = 0;

    const batchPath = target.path.replace('/create', '/batch-create');

    const processBatch = async (batch) => {
      try {
        const response = await apiFetch(`${API_BASE}${batchPath}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-correlation-id': createCorrelationId(),
          },
          body: JSON.stringify({ items: batch.items }),
        });
        const data = await response.json();
        if (data.ok && data.data?.results) {
          for (const r of data.data.results) {
            const rowNum = batch.startIndex + r.index + 2;
            if (r.status === 'failed') {
              errors.push({ row: rowNum, message: r.error || 'Failed' });
            } else if (r.status === 'warning') {
              warnings.push({
                row: rowNum,
                message: `Sent successfully, however had to skip invalid properties: ${(r.skippedFields || []).join(', ')}`,
              });
            }
          }
        } else {
          for (let j = 0; j < batch.items.length; j++) {
            errors.push({
              row: batch.startIndex + j + 2,
              message: data.error?.message || 'Batch request failed',
            });
          }
        }
      } catch (err) {
        for (let j = 0; j < batch.items.length; j++) {
          errors.push({ row: batch.startIndex + j + 2, message: err.message });
        }
      }
      completed += batch.items.length;
      setCsvStatus((prev) => ({
        ...prev,
        completed,
        failed: errors.length,
        warned: warnings.length,
        errors: [...errors],
        warnings: [...warnings],
      }));
    };

    // Process batches with concurrency limit
    let nextIdx = 0;
    const runWorker = async () => {
      while (nextIdx < batches.length) {
        const idx = nextIdx++;
        await processBatch(batches[idx]);
      }
    };
    const workers = [];
    for (let w = 0; w < Math.min(CONCURRENCY, batches.length); w++) {
      workers.push(runWorker());
    }
    await Promise.all(workers);

    setCsvStatus((prev) => ({
      ...prev,
      state: 'done',
    }));
  };

  const processCSVUpload = async (file) => {
    const target = CSV_TARGETS.find((t) => t.value === csvTarget);
    if (!target) return;

    setCsvStatus({
      state: 'parsing',
      total: 0,
      completed: 0,
      failed: 0,
      warned: 0,
      errors: [],
      warnings: [],
      fileName: file.name,
    });

    const text = await file.text();
    const { rows } = parseCSV(text);

    if (rows.length === 0) {
      setCsvStatus((prev) => ({
        ...prev,
        state: 'error',
        errors: [{ row: 0, message: 'CSV is empty or has no data rows' }],
      }));
      return;
    }

    await processSheetRows(rows, target);
  };

  const loadGoogleSheets = async () => {
    setSheetsLoading(true);
    setSheetsError(null);
    try {
      const res = await apiFetch(`${GOOGLE_SHEETS_BASE}/list`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message || 'Failed to list sheets');
      setSheetsList(data.data);
    } catch (err) {
      setSheetsError(err.message);
    }
    setSheetsLoading(false);
  };

  const loadSheetTabs = async (spreadsheetId) => {
    try {
      const res = await apiFetch(`${GOOGLE_SHEETS_BASE}/${spreadsheetId}/sheets`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message || 'Failed to list tabs');
      setSheetTabs(data.data);
      if (data.data.length > 0) {
        setSelectedTab(data.data[0].title);
      }
    } catch (err) {
      setSheetsError(err.message);
    }
  };

  const importFromGoogleSheet = async () => {
    if (!selectedSheet || !selectedTab) return;
    const target = CSV_TARGETS.find((t) => t.value === csvTarget);
    if (!target) return;

    const sheetName = sheetsList.find((s) => s.id === selectedSheet)?.name || selectedSheet;

    setCsvStatus({
      state: 'parsing',
      total: 0,
      completed: 0,
      failed: 0,
      warned: 0,
      errors: [],
      warnings: [],
      fileName: `Google Sheet: ${sheetName}`,
    });

    try {
      const res = await apiFetch(
        `${GOOGLE_SHEETS_BASE}/${selectedSheet}/data?sheet=${encodeURIComponent(selectedTab)}`
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message || 'Failed to read sheet data');

      const rows = data.data.rows;
      if (!rows || rows.length === 0) {
        setCsvStatus((prev) => ({
          ...prev,
          state: 'error',
          errors: [{ row: 0, message: 'Sheet is empty or has no data rows' }],
        }));
        return;
      }

      await processSheetRows(rows, target);
    } catch (err) {
      setCsvStatus((prev) => ({
        ...prev,
        state: 'error',
        errors: [{ row: 0, message: err.message }],
      }));
    }
  };

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1>HubSpot Control Panel</h1>
          <p>Sign in with your Google account to continue</p>
          {authError && <div className="login-error">{authError}</div>}
          <button
            type="button"
            className="google-signin-button"
            onClick={handleSignIn}
            disabled={authLoading}
          >
            {authLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
      </div>
    );
  }

  const tileIcons = {
    'csv-import': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <polyline points="9 15 12 12 15 15" />
      </svg>
    ),
    contacts: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    companies: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="9" y1="6" x2="9" y2="6.01" />
        <line x1="15" y1="6" x2="15" y2="6.01" />
        <line x1="9" y1="10" x2="9" y2="10.01" />
        <line x1="15" y1="10" x2="15" y2="10.01" />
        <line x1="9" y1="14" x2="9" y2="14.01" />
        <line x1="15" y1="14" x2="15" y2="14.01" />
        <path d="M9 18h6" />
      </svg>
    ),
    deals: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    associations: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    owners: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <polyline points="17 11 19 13 23 9" />
      </svg>
    ),
    pipelines: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="4" rx="1" />
        <rect x="4" y="10" width="16" height="4" rx="1" />
        <rect x="6" y="17" width="12" height="4" rx="1" />
      </svg>
    ),
    properties: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
    engagements: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    webhooks: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    'raw-request': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    log: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  };

  const pageLabel = (() => {
    if (!activePage) return '';
    if (activePage === 'csv-import') return 'CSV Import';
    if (activePage === 'raw-request') return 'Raw Request';
    if (activePage === 'log') return 'Log';
    const cat = categories.find((c) => c.id === activePage);
    return cat ? cat.label : '';
  })();

  const activeCategory = activePage ? categories.find((c) => c.id === activePage) : null;

  return (
    <div className="app">
      <header className="topbar">
        <h1>HubSpot Control Panel</h1>
        <div className="topbar-user">
          {user.picture && <img src={user.picture} alt="" className="topbar-user__avatar" referrerPolicy="no-referrer" />}
          <span className="topbar-user__name">{user.name}</span>
          <span className="topbar-user__email">{user.email}</span>
          <button type="button" className="topbar-user__signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {activePage ? (
        <div className="sub-page">
          <div className="sub-page-header">
            <button type="button" className="back-button" onClick={() => setActivePage(null)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
            <h2>{pageLabel}</h2>
          </div>
          <div className="sub-page-content">
            {/* Category pages */}
            {activeCategory && activeCategory.operations.map((operation) => (
              <OperationCard
                key={operation.id}
                operation={operation}
                values={formState[operation.id] || {}}
                onChange={(name, value) => updateFormValues(operation.id, { [name]: value })}
                onChangeValues={(updates) => updateFormValues(operation.id, updates)}
                onExecute={executeOperation}
                result={results[operation.id] || defaultResultState}
              />
            ))}

            {/* CSV Import page */}
            {activePage === 'csv-import' && (
              <div className="card">
                <div className="card-header">
                  <h3>Import from CSV</h3>
                </div>
                <div className="fields">
                  <div className="field">
                    <label>Object type</label>
                    <select
                      value={csvTarget}
                      onChange={(e) => setCsvTarget(e.target.value)}
                      disabled={csvStatus?.state === 'uploading'}
                    >
                      {CSV_TARGETS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {(!csvStatus || csvStatus.state === 'idle') && (
                  <div
                    className={`csv-dropzone csv-dropzone--main${csvDragOver ? ' csv-dropzone--active' : ''}`}
                    onDragOver={handleCsvDragOver}
                    onDragLeave={handleCsvDragLeave}
                    onDrop={handleCsvDrop}
                    onClick={() => csvInputRef.current?.click()}
                  >
                    <span>Drop CSV file here or click to browse</span>
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv"
                      style={{ display: 'none' }}
                      onChange={handleCsvFileSelect}
                    />
                  </div>
                )}

                {(!csvStatus || csvStatus.state === 'idle' || csvStatus.state === 'done' || csvStatus.state === 'error') && (
                  <div className="sheets-import">
                    <div className="sheets-import__header">
                      <span>Or import from Google Sheets</span>
                      <button type="button" className="sheets-refresh-button" onClick={loadGoogleSheets} disabled={sheetsLoading}>
                        {sheetsLoading ? 'Loading...' : 'Load My Sheets'}
                      </button>
                    </div>
                    {sheetsError && <div className="sheets-error">{sheetsError}</div>}
                    {sheetsList.length > 0 && (
                      <div className="sheets-selectors">
                        <label className="field">
                          <span>Select spreadsheet</span>
                          <select
                            value={selectedSheet}
                            onChange={(e) => {
                              setSelectedSheet(e.target.value);
                              setSelectedTab('');
                              setSheetTabs([]);
                              if (e.target.value) loadSheetTabs(e.target.value);
                            }}
                          >
                            <option value="">Choose a spreadsheet...</option>
                            {sheetsList.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </label>
                        {sheetTabs.length > 0 && (
                          <label className="field">
                            <span>Select sheet tab</span>
                            <select value={selectedTab} onChange={(e) => setSelectedTab(e.target.value)}>
                              {sheetTabs.map((t) => (
                                <option key={t.sheetId} value={t.title}>{t.title}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        {selectedSheet && selectedTab && (
                          <button
                            type="button"
                            className="primary-button"
                            onClick={importFromGoogleSheet}
                            disabled={csvStatus?.state === 'uploading'}
                          >
                            Import from Sheet
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {csvStatus?.state === 'parsing' && (
                  <div className="csv-main-status">Reading {csvStatus.fileName}...</div>
                )}

                {csvStatus?.state === 'uploading' && (
                  <div className="csv-main-status">
                    <div className="csv-progress-label">
                      Uploading: {csvStatus.completed} / {csvStatus.total}
                      {csvStatus.warned > 0 && (
                        <span className="csv-warned"> ({csvStatus.warned} with warnings)</span>
                      )}
                      {csvStatus.failed > 0 && (
                        <span className="csv-failed"> ({csvStatus.failed} failed)</span>
                      )}
                    </div>
                    <div className="csv-progress-bar csv-progress-bar--main">
                      <div
                        className="csv-progress-fill"
                        style={{ width: `${(csvStatus.completed / csvStatus.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {csvStatus?.state === 'done' && (
                  <div className="csv-main-status">
                    <div className="csv-done-label">
                      {(() => {
                        const clean = csvStatus.completed - csvStatus.failed - csvStatus.warned;
                        const parts = [];
                        if (clean > 0) parts.push(`${clean} succeeded`);
                        if (csvStatus.warned > 0) parts.push(`${csvStatus.warned} succeeded with warnings`);
                        if (csvStatus.failed > 0) parts.push(`${csvStatus.failed} failed`);
                        if (parts.length === 0) parts.push('0 succeeded');
                        return parts.map((text, idx) => {
                          const isWarned = text.includes('warnings');
                          const isFailed = text.includes('failed');
                          const separator = idx > 0 ? ', ' : '';
                          if (isWarned) return <span key={idx}><span>{separator}</span><span className="csv-warned">{text}</span></span>;
                          if (isFailed) return <span key={idx}><span>{separator}</span><span className="csv-failed">{text}</span></span>;
                          return <span key={idx}>{separator}{text}</span>;
                        });
                      })()}
                    </div>
                    {csvStatus.warnings.length > 0 && (
                      <div className="csv-warnings csv-warnings--main">
                        {csvStatus.warnings.map((w, i) => (
                          <div key={i} className="csv-warning-item">
                            Row {w.row}: {w.message}
                          </div>
                        ))}
                      </div>
                    )}
                    {csvStatus.errors.length > 0 && (
                      <div className="csv-errors csv-errors--main">
                        {csvStatus.errors.map((err, i) => (
                          <div key={i} className="csv-error-item">
                            Row {err.row}: {err.message}
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => setCsvStatus(null)}
                    >
                      Import Another
                    </button>
                  </div>
                )}

                {csvStatus?.state === 'error' && (
                  <div className="csv-main-status">
                    <div className="csv-error-msg">{csvStatus.errors[0]?.message}</div>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => setCsvStatus(null)}
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Raw Request page */}
            {activePage === 'raw-request' && (
              <div className="card">
                <div className="card-header">
                  <h3>Send Any Backend Request</h3>
                </div>
                <button
                  type="button"
                  className="advanced-toggle"
                  onClick={() => setShowRawAdvanced((prev) => !prev)}
                  aria-expanded={showRawAdvanced}
                >
                  <span className="advanced-toggle__icon" aria-hidden="true">
                    &#9881;
                  </span>
                  Advanced settings
                </button>
                <div className="card-body">
                  <div className="card-status">
                    {rawResult.status && <span className={rawStatusClassName}>{rawStatusLabel}</span>}
                  </div>
                  <div className="fields">
                    <label className="field">
                      <span>Method</span>
                      <select
                        value={rawRequest.method}
                        onChange={(event) => setRawRequest((prev) => ({ ...prev, method: event.target.value }))}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Path (relative to /api/hubspot)</span>
                      <input
                        type="text"
                        value={rawRequest.path}
                        onChange={(event) => setRawRequest((prev) => ({ ...prev, path: event.target.value }))}
                        placeholder="/contacts"
                      />
                    </label>
                    <label className="field">
                      <span>JSON Body</span>
                      <textarea
                        value={rawRequest.body}
                        onChange={(event) => setRawRequest((prev) => ({ ...prev, body: event.target.value }))}
                        placeholder='{"key":"value"}'
                        rows={4}
                      />
                    </label>
                  </div>
                  {showRawAdvanced && (
                    <div className="advanced">
                      <div className="advanced-content">
                        <div className="result">
                          <div>
                            <strong>Correlation Id:</strong> {rawResult.correlationId || '\u2014'}
                          </div>
                          <div className="result-block">
                            <span>Request Payload</span>
                            <pre>{rawResult.request ? JSON.stringify(rawResult.request, null, 2) : '\u2014'}</pre>
                          </div>
                          <div className="result-block">
                            <span>Response JSON</span>
                            <pre>{rawResult.response ? JSON.stringify(rawResult.response, null, 2) : '\u2014'}</pre>
                          </div>
                          {rawResult.error && <div className="error">{rawResult.error}</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="card-footer">
                  <button type="button" className="primary-button" onClick={executeRawRequest}>
                    Submit
                  </button>
                </div>
              </div>
            )}

            {/* Log page */}
            {activePage === 'log' && (
              <div className="card">
                <div className="card-header">
                  <h3>Activity Log ({logEntries.length} entries)</h3>
                  {logEntries.length > 0 && (
                    <button
                      type="button"
                      className="properties-remove"
                      onClick={() => setLogEntries([])}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="log-entries">
                  {logEntries.length === 0 && (
                    <div className="log-empty">No activity recorded yet.</div>
                  )}
                  {logEntries.map((entry) => (
                    <div key={entry.id} className={`log-entry log-entry--${entry.status}`}>
                      <div className="log-entry__header">
                        <span className="log-entry__time">
                          {entry.timestamp.toLocaleTimeString()}
                        </span>
                        <span className={`log-entry__method log-entry__method--${entry.method.toLowerCase()}`}>
                          {entry.method}
                        </span>
                        <span className="log-entry__path">{entry.path}</span>
                        <span className={`log-entry__status log-entry__status--${entry.status}`}>
                          {entry.status}
                        </span>
                        {entry.durationMs != null && (
                          <span className="log-entry__duration">{entry.durationMs}ms</span>
                        )}
                      </div>
                      {entry.error && (
                        <div className="log-entry__error">{entry.error}</div>
                      )}
                      {entry.correlationId && (
                        <div className="log-entry__meta">Correlation ID: {entry.correlationId}</div>
                      )}
                      {entry.requestBody && (
                        <details className="log-entry__details">
                          <summary>Request Body</summary>
                          <pre>{JSON.stringify(entry.requestBody, null, 2)}</pre>
                        </details>
                      )}
                      {entry.response && (
                        <details className="log-entry__details">
                          <summary>Response</summary>
                          <pre>{JSON.stringify(entry.response, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="tile-grid">
          <button type="button" className="tile" onClick={() => setActivePage('csv-import')}>
            <span className="tile-icon">{tileIcons['csv-import']}</span>
            <span className="tile-label">CSV Import</span>
          </button>
          {categories.map((category) => (
            <button key={category.id} type="button" className="tile" onClick={() => setActivePage(category.id)}>
              <span className="tile-icon">{tileIcons[category.id]}</span>
              <span className="tile-label">{category.label}</span>
              <span className="tile-badge">{category.operations.length}</span>
            </button>
          ))}
          <button type="button" className="tile" onClick={() => setActivePage('raw-request')}>
            <span className="tile-icon">{tileIcons['raw-request']}</span>
            <span className="tile-label">Raw Request</span>
          </button>
          <button type="button" className="tile" onClick={() => setActivePage('log')}>
            <span className="tile-icon">{tileIcons.log}</span>
            <span className="tile-label">Log</span>
            {logEntries.length > 0 && <span className="tile-badge">{logEntries.length}</span>}
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
