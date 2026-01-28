import { useMemo, useState } from 'react';

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

const parseFormRowsFromJson = (value) => {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [];
    }
    return Object.entries(parsed).map(([key, itemValue]) => ({
      key,
      value: itemValue ?? '',
    }));
  } catch (error) {
    return [];
  }
};

const normalizeFormRows = (rows) => (rows && rows.length ? rows : [{ key: '', value: '' }]);

const buildPropertiesFromRows = (rows) =>
  (rows || []).reduce((acc, row) => {
    if (row.key) {
      acc[row.key] = row.value ?? '';
    }
    return acc;
  }, {});

const resolvePropertiesPayload = (values) => {
  if (values.propertiesMode === 'form') {
    return buildPropertiesFromRows(values.propertiesFormRows);
  }
  return safeJsonParse(values.properties);
};

const defaultResultState = {
  request: null,
  response: null,
  correlationId: null,
  error: null,
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

const PropertiesForm = ({ rows, onRowsChange }) => {
  const safeRows = normalizeFormRows(rows);

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
      <span>Properties (form)</span>
      <div className="properties-form">
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
    </div>
  );
};

const OperationCard = ({ operation, values, onChange, onChangeValues, onExecute, result }) => {
  const propertiesField = operation.fields.find((field) => field.kind === 'properties');
  const otherFields = operation.fields.filter((field) => field.kind !== 'properties');
  const propertiesMode = values.propertiesMode || 'json';

  const handleModeChange = (mode) => {
    if (mode === propertiesMode) {
      return;
    }
    const updates = { propertiesMode: mode };
    if (mode === 'form' && (!values.propertiesFormRows || values.propertiesFormRows.length === 0)) {
      const seededRows = parseFormRowsFromJson(values.properties);
      updates.propertiesFormRows = seededRows.length ? seededRows : [{ key: '', value: '' }];
    }
    onChangeValues(updates);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>{operation.label}</h3>
        <button type="button" onClick={() => onExecute(operation)}>
          Run
        </button>
      </div>
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
      <div className="card-body">
        <div className="fields">
          {otherFields.map((field) => (
            <Field
              key={field.name}
              field={field}
              value={values[field.name] ?? ''}
              onChange={onChange}
            />
          ))}
          {propertiesField && propertiesMode === 'json' && (
            <Field
              field={propertiesField}
              value={values[propertiesField.name] ?? ''}
              onChange={onChange}
            />
          )}
          {propertiesField && propertiesMode === 'form' && (
            <PropertiesForm
              rows={values.propertiesFormRows}
              onRowsChange={(rows) => onChangeValues({ propertiesFormRows: rows })}
            />
          )}
        </div>
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
          {result.error && (
            <div className="error">{result.error}</div>
          )}
        </div>
      </div>
    </div>
  );
};

const App = () => {
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

  const [activeCategory, setActiveCategory] = useState('contacts');
  const [formState, setFormState] = useState({});
  const [results, setResults] = useState({});
  const [rawRequest, setRawRequest] = useState({
    method: 'GET',
    path: '/health',
    body: '',
  });
  const [rawResult, setRawResult] = useState(defaultResultState);

  const currentCategory = categories.find((category) => category.id === activeCategory) || categories[0];

  const updateFormValues = (operationId, updates) => {
    setFormState((prev) => ({
      ...prev,
      [operationId]: {
        ...(prev[operationId] || {}),
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

    try {
      const response = await fetch(`${API_BASE}${requestConfig.path}`, {
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
        },
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [operation.id]: {
          ...prev[operation.id],
          error: error.message,
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

    try {
      const response = await fetch(`${API_BASE}${rawRequest.path}`, {
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
      }));
    } catch (error) {
      setRawResult((prev) => ({
        ...prev,
        error: error.message,
      }));
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>HubSpot Control Panel</h1>
        <nav>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={category.id === activeCategory ? 'active' : ''}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </nav>
      </aside>
      <main>
        <section className="category">
          <h2>{currentCategory.label}</h2>
          {currentCategory.operations.map((operation) => (
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
        </section>
        <section className="category">
          <h2>Raw Request Builder</h2>
          <div className="card">
            <div className="card-header">
              <h3>Send Any Backend Request</h3>
              <button type="button" onClick={executeRawRequest}>
                Send
              </button>
            </div>
            <div className="card-body">
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
              <div className="result">
                <div>
                  <strong>Correlation Id:</strong> {rawResult.correlationId || '—'}
                </div>
                <div className="result-block">
                  <span>Request Payload</span>
                  <pre>{rawResult.request ? JSON.stringify(rawResult.request, null, 2) : '—'}</pre>
                </div>
                <div className="result-block">
                  <span>Response JSON</span>
                  <pre>{rawResult.response ? JSON.stringify(rawResult.response, null, 2) : '—'}</pre>
                </div>
                {rawResult.error && <div className="error">{rawResult.error}</div>}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
