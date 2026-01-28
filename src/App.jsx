import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  ShieldCheck,
  CheckCircle2,
  UserPlus,
  Loader2,
  ArrowRight
} from 'lucide-react';

export default function App() {
  const [hubSpotKey, setHubSpotKey] = useState('');
  const [hubSpotConnected, setHubSpotConnected] = useState(false);
  const [hubSpotCount, setHubSpotCount] = useState(null);

  const [contactForm, setContactForm] = useState({
    email: '',
    firstname: '',
    lastname: '',
    phone: '',
    company: '',
    jobtitle: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactsCreated, setContactsCreated] = useState(0);

  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  const hubSpotEndpoint = '/api/hubspot/contacts';

  useEffect(() => {
    if (!document.querySelector('script[src*="tailwindcss"]')) {
      const tailwindScript = document.createElement('script');
      tailwindScript.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(tailwindScript);
    }

    const style = document.createElement('style');
    style.innerHTML = `
      body, html { margin: 0; padding: 0; width: 100%; height: 100%; background-color: #f8fafc; }
      #root { width: 100%; height: 100%; }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { id: Date.now(), msg, type, timestamp }]);
  };

  const maskToken = (token) => {
    if (!token) return 'not provided';
    if (token.length <= 8) return `${token[0]}***${token[token.length - 1]}`;
    return `${token.slice(0, 4)}…${token.slice(-4)} (len=${token.length})`;
  };

  const readResponseBody = async (res) => {
    const text = await res.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    return { text, json };
  };

  const HUBSPOT_STATUS_GUIDE = [
    {
      status: 400,
      label: 'Bad Request',
      meaning: 'The request is malformed (missing required properties or invalid formatting).',
      fixes: [
        'Ensure the email property is provided for new contacts.',
        'Check field names match HubSpot contact properties.',
        'Try submitting only email + firstname to validate payload.'
      ]
    },
    {
      status: 401,
      label: 'Unauthorized',
      meaning: 'Authentication failed (missing token, invalid token, expired token, or wrong auth type).',
      fixes: [
        'Paste a HubSpot Private App Access Token (starts with "pat-")—not an API key.',
        'Paste the token WITHOUT the "Bearer" prefix (the app adds it).',
        'Confirm the token is active and not revoked in HubSpot.',
        'Ensure the Private App has the correct scopes (crm.objects.contacts.read + write).',
        'If using environment variables, verify HUBSPOT_ACCESS_TOKEN is set and restart the server.'
      ]
    },
    {
      status: 403,
      label: 'Forbidden',
      meaning: 'Token is valid, but lacks required scopes or access rights.',
      fixes: [
        'Enable crm.objects.contacts.write (and read) on the Private App.',
        'Re-generate the token if you changed scopes.',
        'Confirm the app is installed and allowed in the correct HubSpot account.'
      ]
    },
    {
      status: 409,
      label: 'Conflict',
      meaning: 'A request conflict occurred (often duplicate emails).',
      fixes: [
        'Use a unique email address or update the existing record.',
        'Check for duplicate contacts in HubSpot.'
      ]
    },
    {
      status: 404,
      label: 'Not Found',
      meaning: 'The proxy route or API endpoint was not found (often the local server is not running).',
      fixes: [
        'Start the local proxy server (npm run server) and keep it running.',
        'Confirm Vite is proxying /api to http://localhost:5000.',
        'Verify you are hitting the correct environment (local vs hosted backend).'
      ]
    },
    {
      status: 429,
      label: 'Rate Limited',
      meaning: 'HubSpot is throttling requests due to rate limits.',
      fixes: [
        'Wait and retry with a longer delay between requests.',
        'Check HubSpot rate limit headers for remaining quota.'
      ]
    },
    {
      status: 500,
      label: 'HubSpot Server Error',
      meaning: 'HubSpot encountered an internal issue.',
      fixes: [
        'Retry after a short delay.',
        'Check https://status.hubspot.com for outages.',
        'Log the correlation ID from headers for HubSpot support.'
      ]
    }
  ];

  const logHubSpotDiagnostics = ({ url, res, bodyText, bodyJson, token }) => {
    const maskedToken = maskToken(token);
    const contentType = res.headers.get('content-type') ?? 'unknown';
    const correlationId =
      res.headers.get('x-hubspot-correlation-id') ||
      res.headers.get('x-hubspot-trace-id') ||
      res.headers.get('x-request-id') ||
      'not provided';
    const rateLimitHeaders = [
      ['x-hubspot-ratelimit-daily', res.headers.get('x-hubspot-ratelimit-daily')],
      ['x-hubspot-ratelimit-daily-remaining', res.headers.get('x-hubspot-ratelimit-daily-remaining')],
      ['x-hubspot-ratelimit-secondly', res.headers.get('x-hubspot-ratelimit-secondly')],
      ['x-hubspot-ratelimit-secondly-remaining', res.headers.get('x-hubspot-ratelimit-secondly-remaining')]
    ].filter(([, value]) => value);

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'warning');
    addLog('HubSpot Request Diagnostic Report', 'warning');
    addLog(`Request URL: ${url}`, 'warning');
    addLog(`HTTP Status: ${res.status} ${res.statusText}`, 'warning');
    addLog(`Auth Header: Bearer ${maskedToken}`, 'warning');
    addLog(`Response Content-Type: ${contentType}`, 'warning');
    addLog(`HubSpot Correlation ID: ${correlationId}`, 'warning');

    if (rateLimitHeaders.length) {
      addLog('Rate Limit Headers:', 'warning');
      rateLimitHeaders.forEach(([name, value]) => {
        addLog(`- ${name}: ${value}`, 'warning');
      });
    }

    if (bodyJson) {
      addLog('Response Body (parsed JSON):', 'warning');
      addLog(JSON.stringify(bodyJson, null, 2), 'warning');
    } else if (bodyText) {
      addLog('Response Body (raw text):', 'warning');
      addLog(bodyText, 'warning');
    } else {
      addLog('Response Body: <empty>', 'warning');
    }

    const looksLikeMissingProxy =
      res.status === 404 &&
      contentType.includes('text/html') &&
      bodyText &&
      bodyText.includes('Cannot POST /api/hubspot/contacts');
    if (looksLikeMissingProxy) {
      addLog('Likely cause: the local proxy server is not running or the route is missing.', 'warning');
      [
        '➡ Run `npm run server` to start the local proxy on port 5000.',
        '➡ Keep the proxy running while using the app.',
        '➡ If hosted, confirm the backend base URL and routes are deployed.'
      ].forEach((line) => addLog(line, 'warning'));
    }

    addLog('Status Code Playbook (common causes & fixes):', 'warning');
    HUBSPOT_STATUS_GUIDE.forEach((entry) => {
      addLog(`• ${entry.status} ${entry.label}: ${entry.meaning}`, 'warning');
      entry.fixes.forEach((fix) => addLog(`  - ${fix}`, 'warning'));
    });

    const statusEntry = HUBSPOT_STATUS_GUIDE.find((entry) => entry.status === res.status);
    if (statusEntry) {
      addLog(`Focused guidance for ${res.status} ${statusEntry.label}:`, 'warning');
      statusEntry.fixes.forEach((fix) => addLog(`➡ ${fix}`, 'warning'));
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'warning');
  };

  const logHubSpotNetworkGuidance = (err) => {
    addLog('Network/Proxy Diagnostic Guidance:', 'warning');
    addLog(`Error message: ${err.message}`, 'warning');
    [
      '• Ensure the local proxy server is running (npm run server).',
      '• Verify the proxy endpoint is reachable at /api/hubspot/contacts.',
      '• If using a hosted backend, confirm the API base URL and CORS settings.',
      '• Check browser devtools → Network tab for blocked or failed requests.',
      '• Verify there is no VPN/firewall blocking api.hubapi.com.'
    ].forEach((line) => addLog(line, 'warning'));
  };

  const testHubSpot = async () => {
    try {
      addLog('Testing HubSpot connection...');
      const url = `${hubSpotEndpoint}?limit=1`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${hubSpotKey}`,
          'Content-Type': 'application/json'
        }
      });

      const { text, json } = await readResponseBody(res);

      if (!res.ok) {
        logHubSpotDiagnostics({
          url,
          res,
          bodyText: text,
          bodyJson: json,
          token: hubSpotKey
        });
        throw new Error(`HTTP ${res.status} - ${res.statusText}`);
      }

      setHubSpotConnected(true);
      setHubSpotCount('Connected (Ready to create contacts)');
      addLog('HubSpot connected successfully!', 'success');
    } catch (err) {
      setHubSpotConnected(false);
      addLog(`HubSpot Connection Failed: ${err.message}`, 'error');
      logHubSpotNetworkGuidance(err);
    }
  };

  const handleContactChange = (field) => (event) => {
    setContactForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const buildContactPayload = () => {
    const properties = Object.entries(contactForm).reduce((acc, [key, value]) => {
      if (value && value.trim()) {
        acc[key] = value.trim();
      }
      return acc;
    }, {});

    return { properties };
  };

  const handleSubmitContact = async () => {
    if (!hubSpotKey) {
      addLog('Please connect HubSpot first.', 'error');
      return;
    }

    if (!contactForm.email.trim()) {
      addLog('Email is required to create a contact.', 'error');
      return;
    }

    const payload = buildContactPayload();

    try {
      setIsSubmitting(true);
      addLog('Sending contact to HubSpot...');
      const url = hubSpotEndpoint;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hubSpotKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const { text, json } = await readResponseBody(res);

      if (!res.ok) {
        logHubSpotDiagnostics({
          url,
          res,
          bodyText: text,
          bodyJson: json,
          token: hubSpotKey
        });
        throw new Error(`HTTP ${res.status} - ${res.statusText}`);
      }

      setContactsCreated((prev) => prev + 1);
      addLog('Contact created successfully!', 'success');
      setContactForm({
        email: '',
        firstname: '',
        lastname: '',
        phone: '',
        company: '',
        jobtitle: ''
      });
    } catch (err) {
      addLog(`Contact Create Failed: ${err.message}`, 'error');
      logHubSpotNetworkGuidance(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="text-orange-500" /> HubSpot <ArrowRight className="w-4 h-4 text-slate-400" />
              <UserPlus className="text-blue-600" /> Contact Creator
            </h1>
            <p className="text-slate-500 mt-1">Create new HubSpot contacts directly from the app.</p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>Contacts Created</p>
            <p className="text-slate-700 font-semibold text-lg">{contactsCreated}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="space-y-6">
            <div
              className={`p-6 rounded-xl shadow-sm border transition-all ${
                hubSpotConnected ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
                    1
                  </span>
                  HubSpot Connection
                </h2>
                {hubSpotConnected && <CheckCircle2 className="text-green-600 w-5 h-5" />}
              </div>

              <div className="space-y-3">
                <input
                  type="password"
                  value={hubSpotKey}
                  onChange={(e) => setHubSpotKey(e.target.value)}
                  placeholder="Paste HubSpot Private App Access Token (without Bearer)"
                  className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono text-sm"
                />

                <div className="text-xs text-slate-500 bg-slate-100 p-3 rounded space-y-2">
                  <p className="font-semibold text-slate-600">HubSpot Setup Checklist</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      Start the local proxy server: <span className="font-mono">npm run server</span>.
                    </li>
                    <li>
                      In HubSpot, go to <span className="font-semibold">Settings → Integrations → Private Apps</span>.
                    </li>
                    <li>
                      Create a Private App and enable <span className="font-mono">crm.objects.contacts.read</span> and{' '}
                      <span className="font-mono">crm.objects.contacts.write</span>.
                    </li>
                    <li>
                      Copy the Access Token (starts with <span className="font-mono">pat-</span>).
                    </li>
                    <li>
                      Paste the token below <strong>without</strong> the <span className="font-mono">Bearer</span> prefix.
                    </li>
                    <li>Click “Connect HubSpot” to run the diagnostic.</li>
                  </ol>
                  <p>
                    Requests route through the local server at <span className="font-mono">/api/hubspot/contacts</span>. If
                    you prefer env vars, set <span className="font-mono">HUBSPOT_ACCESS_TOKEN</span> and restart the server.
                  </p>
                </div>

                <button
                  onClick={testHubSpot}
                  disabled={!hubSpotKey}
                  className="w-full py-2 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 text-sm font-medium"
                >
                  {hubSpotConnected ? 'Re-Test Connection' : 'Connect HubSpot'}
                </button>
                {hubSpotCount && <p className="text-xs text-slate-500">{hubSpotCount}</p>}
              </div>
            </div>

            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
                    2
                  </span>
                  New Contact Form
                </h2>
                <ShieldCheck className="text-blue-500 w-5 h-5" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={handleContactChange('email')}
                  placeholder="Email *"
                  className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                />
                <input
                  type="text"
                  value={contactForm.firstname}
                  onChange={handleContactChange('firstname')}
                  placeholder="First name"
                  className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                />
                <input
                  type="text"
                  value={contactForm.lastname}
                  onChange={handleContactChange('lastname')}
                  placeholder="Last name"
                  className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                />
                <input
                  type="text"
                  value={contactForm.phone}
                  onChange={handleContactChange('phone')}
                  placeholder="Phone"
                  className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                />
                <input
                  type="text"
                  value={contactForm.company}
                  onChange={handleContactChange('company')}
                  placeholder="Company"
                  className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                />
                <input
                  type="text"
                  value={contactForm.jobtitle}
                  onChange={handleContactChange('jobtitle')}
                  placeholder="Job title"
                  className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                />
              </div>

              <button
                onClick={handleSubmitContact}
                disabled={!hubSpotConnected || isSubmitting}
                className="mt-4 w-full py-3 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                  </>
                ) : (
                  'Create Contact'
                )}
              </button>
              {!hubSpotConnected && (
                <p className="mt-2 text-xs text-slate-500">
                  Connect HubSpot above before submitting new contacts.
                </p>
              )}
            </div>
          </div>

          <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-sm h-[640px] overflow-hidden flex flex-col shadow-inner border border-slate-800">
            <div className="pb-2 border-b border-slate-700 mb-2 flex justify-between items-center">
              <span className="font-semibold text-slate-100">Operation Logs</span>
              <button onClick={() => setLogs([])} className="text-xs hover:text-white">
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
              {logs.length === 0 && <div className="text-slate-600 italic">Ready to create contacts...</div>}
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`flex gap-2 ${
                    log.type === 'error'
                      ? 'text-red-400'
                      : log.type === 'success'
                        ? 'text-green-400'
                        : log.type === 'warning'
                          ? 'text-yellow-400'
                          : 'text-slate-300'
                  }`}
                >
                  <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                  <span>{log.msg}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
