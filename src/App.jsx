import { useMemo, useState } from 'react';
import './App.css';

const DEFAULT_CONTACT = {
  email: '',
  firstname: '',
  lastname: '',
  phone: '',
  company: '',
  jobtitle: ''
};

const STEP_LABELS = {
  health: 'Server Health Check',
  validate: 'Token Validation',
  create: 'Create Contact'
};

const readResponseBody = async (res) => {
  const text = await res.text();
  let json = null;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch (error) {
      json = null;
    }
  }

  return { text, json };
};

export default function App() {
  const [token, setToken] = useState('');
  const [contact, setContact] = useState(DEFAULT_CONTACT);
  const [logs, setLogs] = useState([]);
  const [lastResponse, setLastResponse] = useState(null);
  const [status, setStatus] = useState({
    health: 'idle',
    validate: 'idle',
    create: 'idle'
  });

  const maskedToken = useMemo(() => {
    if (!token) return 'using server env token (if configured)';
    if (token.length <= 8) return `${token[0]}***${token[token.length - 1]}`;
    return `${token.slice(0, 4)}…${token.slice(-4)} (len=${token.length})`;
  }, [token]);

  const addLog = (message, type = 'info') => {
    const entry = {
      id: Date.now() + Math.random(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setLogs((prev) => [...prev, entry]);
  };

  const updateStatus = (step, value) => {
    setStatus((prev) => ({ ...prev, [step]: value }));
  };

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const runHealthCheck = async () => {
    updateStatus('health', 'loading');
    addLog('Checking local server health...');

    try {
      const res = await fetch('/api/health');
      const { text, json } = await readResponseBody(res);
      setLastResponse({
        label: STEP_LABELS.health,
        status: res.status,
        ok: res.ok,
        bodyText: text,
        bodyJson: json
      });

      if (res.ok) {
        addLog('Server is reachable ✅', 'success');
        addLog(`Env token present: ${json?.envTokenPresent ? 'yes' : 'no'}`);
        updateStatus('health', 'success');
      } else {
        addLog('Server health check failed.', 'error');
        updateStatus('health', 'error');
      }
    } catch (error) {
      addLog(`Health check error: ${error.message}`, 'error');
      updateStatus('health', 'error');
    }
  };

  const runTokenValidation = async () => {
    updateStatus('validate', 'loading');
    addLog('Validating token against HubSpot...');

    try {
      const res = await fetch('/api/hubspot/validate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        }
      });

      const { text, json } = await readResponseBody(res);
      setLastResponse({
        label: STEP_LABELS.validate,
        status: res.status,
        ok: res.ok,
        bodyText: text,
        bodyJson: json
      });

      if (res.ok) {
        addLog('Token validated. HubSpot responded successfully ✅', 'success');
        updateStatus('validate', 'success');
      } else {
        addLog(`Token validation failed (HTTP ${res.status}).`, 'error');
        updateStatus('validate', 'error');
      }
    } catch (error) {
      addLog(`Token validation error: ${error.message}`, 'error');
      updateStatus('validate', 'error');
    }
  };

  const runCreateContact = async () => {
    if (!contact.email.trim()) {
      addLog('Email is required to create a contact.', 'error');
      updateStatus('create', 'error');
      return;
    }

    updateStatus('create', 'loading');
    addLog('Submitting contact to HubSpot...');

    const payload = {
      properties: Object.fromEntries(
        Object.entries(contact).filter(([, value]) => value && value.trim())
      )
    };

    try {
      const res = await fetch('/api/hubspot/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify(payload)
      });

      const { text, json } = await readResponseBody(res);
      setLastResponse({
        label: STEP_LABELS.create,
        status: res.status,
        ok: res.ok,
        bodyText: text,
        bodyJson: json
      });

      if (res.ok) {
        addLog('Contact created successfully ✅', 'success');
        updateStatus('create', 'success');
        setContact(DEFAULT_CONTACT);
      } else {
        addLog(`Contact create failed (HTTP ${res.status}).`, 'error');
        updateStatus('create', 'error');
      }
    } catch (error) {
      addLog(`Contact create error: ${error.message}`, 'error');
      updateStatus('create', 'error');
    }
  };

  const statusClass = (value) => {
    if (value === 'success') return 'status-chip status-success';
    if (value === 'error') return 'status-chip status-error';
    if (value === 'loading') return 'status-chip status-loading';
    return 'status-chip status-idle';
  };

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">HubSpot Contact Uploader</p>
          <h1>Single-purpose HubSpot Contact Tester</h1>
          <p className="subhead">
            Step-by-step diagnostics to confirm your server, token, and payload formatting.
          </p>
        </div>
        <div className="token-chip">Token: {maskedToken}</div>
      </header>

      <section className="card">
        <h2>Step 1 — Server health</h2>
        <p>Confirms the Express proxy is running locally.</p>
        <div className="actions">
          <button className="primary" onClick={runHealthCheck}>
            Run /api/health
          </button>
          <span className={statusClass(status.health)}>{status.health}</span>
        </div>
      </section>

      <section className="card">
        <h2>Step 2 — Token validation</h2>
        <p>
          Uses HubSpot&apos;s contacts endpoint with <code>limit=1</code> to validate auth and scopes.
          Leave the field empty to use <code>HUBSPOT_ACCESS_TOKEN</code> from the server.
        </p>
        <div className="field">
          <label htmlFor="token">HubSpot Private App Token</label>
          <input
            id="token"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="pat-..."
          />
        </div>
        <div className="actions">
          <button className="primary" onClick={runTokenValidation}>
            Validate Token
          </button>
          <span className={statusClass(status.validate)}>{status.validate}</span>
        </div>
      </section>

      <section className="card">
        <h2>Step 3 — Create a contact</h2>
        <p>Builds a CRM v3 payload and posts to HubSpot.</p>
        <div className="grid">
          <div className="field">
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              type="email"
              value={contact.email}
              onChange={(event) =>
                setContact((prev) => ({ ...prev, email: event.target.value }))
              }
              placeholder="email@company.com"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="firstname">First name</label>
            <input
              id="firstname"
              type="text"
              value={contact.firstname}
              onChange={(event) =>
                setContact((prev) => ({ ...prev, firstname: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="lastname">Last name</label>
            <input
              id="lastname"
              type="text"
              value={contact.lastname}
              onChange={(event) =>
                setContact((prev) => ({ ...prev, lastname: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="text"
              value={contact.phone}
              onChange={(event) =>
                setContact((prev) => ({ ...prev, phone: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="company">Company</label>
            <input
              id="company"
              type="text"
              value={contact.company}
              onChange={(event) =>
                setContact((prev) => ({ ...prev, company: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="jobtitle">Job title</label>
            <input
              id="jobtitle"
              type="text"
              value={contact.jobtitle}
              onChange={(event) =>
                setContact((prev) => ({ ...prev, jobtitle: event.target.value }))
              }
            />
          </div>
        </div>
        <div className="actions">
          <button className="primary" onClick={runCreateContact}>
            Create Contact
          </button>
          <span className={statusClass(status.create)}>{status.create}</span>
        </div>
      </section>

      <section className="grid-two">
        <div className="card">
          <h2>Latest response</h2>
          {lastResponse ? (
            <div className="response-block">
              <div className="response-header">
                <span>{lastResponse.label}</span>
                <span className={lastResponse.ok ? 'pill pill-ok' : 'pill pill-error'}>
                  HTTP {lastResponse.status}
                </span>
              </div>
              <pre>
                {lastResponse.bodyJson
                  ? JSON.stringify(lastResponse.bodyJson, null, 2)
                  : lastResponse.bodyText || '<empty>'}
              </pre>
            </div>
          ) : (
            <p className="muted">No requests yet. Run a step to see the response.</p>
          )}
        </div>

        <div className="card">
          <h2>Live logs</h2>
          <div className="log-list">
            {logs.length === 0 ? (
              <p className="muted">Logs will appear here.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className={`log ${log.type}`}>
                  <span className="timestamp">[{log.timestamp}]</span>
                  <span>{log.message}</span>
                </div>
              ))
            )}
          </div>
          <button className="secondary" onClick={() => setLogs([])}>
            Clear Logs
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Quick troubleshooting checklist</h2>
        <ul>
          <li>Start the server with <code>npm run server</code> and the UI with <code>npm run dev</code>.</li>
          <li>Ensure your token has <code>crm.objects.contacts.read</code> and <code>crm.objects.contacts.write</code>.</li>
          <li>Use a unique email or delete duplicates in HubSpot before retrying.</li>
          <li>Check the response panel for HubSpot error messages and correlation IDs.</li>
        </ul>
      </section>
    </div>
  );
}
