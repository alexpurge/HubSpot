import { useMemo, useRef, useState } from 'react';

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

  const [activeCategory, setActiveCategory] = useState('contacts');
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
  const rawStatusLabel = rawResult.status === 'error' ? 'Unsuccessful' : 'Successful';
  const rawStatusClassName = rawResult.status === 'error' ? 'status status--error' : 'status status--success';
  const rawStatusTimerRef = useRef(null);

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
            </div>
            <button
              type="button"
              className="advanced-toggle"
              onClick={() => setShowRawAdvanced((prev) => !prev)}
              aria-expanded={showRawAdvanced}
            >
              <span className="advanced-toggle__icon" aria-hidden="true">
                ⚙
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
              )}
            </div>
            <div className="card-footer">
              <button type="button" className="primary-button" onClick={executeRawRequest}>
                Submit
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
