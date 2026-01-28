import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  FileSpreadsheet, 
  Play, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  PauseOctagon,
  Settings,
  ArrowRight
} from 'lucide-react';

// --- CONFIGURATION ---
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_DOCS = ['https://sheets.googleapis.com/$discovery/rest?version=v4'];

export default function App() {
  // --- STATE ---
  
  // HubSpot State
  const [hubSpotKey, setHubSpotKey] = useState('');
  const [hubSpotConnected, setHubSpotConnected] = useState(false);
  const [hubSpotCount, setHubSpotCount] = useState(null);
  
  // Google State
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [googleToken, setGoogleToken] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [selectedSheetId, setSelectedSheetId] = useState('');
  const [newSheetName, setNewSheetName] = useState('HubSpot Company Export');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Process State
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [stopSignal, setStopSignal] = useState(false);
  const [stats, setStats] = useState({ totalFetched: 0, totalWritten: 0, batches: 0 });

  // Settings
  const hubSpotEndpoint = '/api/hubspot/companies';

  // Refs for async loop control
  const stopSignalRef = useRef(false);
  const logsEndRef = useRef(null);

  // --- INITIALIZATION ---

  useEffect(() => {
    // 1. Load Tailwind CSS (Styles) dynamically
    // This ensures the app looks styled even if Tailwind isn't installed in the project
    if (!document.querySelector('script[src*="tailwindcss"]')) {
      const tailwindScript = document.createElement('script');
      tailwindScript.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(tailwindScript);
    }

    // 2. Inject Global Reset Styles
    // This ensures the app takes up the full screen width/height without default browser margins
    const style = document.createElement('style');
    style.innerHTML = `
      body, html { margin: 0; padding: 0; width: 100%; height: 100%; background-color: #f8fafc; }
      #root { width: 100%; height: 100%; }
    `;
    document.head.appendChild(style);

    // 3. Load Google Identity Services script dynamically
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    // 4. Load Google API Client
    const apiScript = document.createElement('script');
    apiScript.src = 'https://apis.google.com/js/api.js';
    apiScript.async = true;
    apiScript.defer = true;
    apiScript.onload = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({
          discoveryDocs: DISCOVERY_DOCS,
        });
      });
    };
    document.body.appendChild(apiScript);

    return () => {
      // Cleanup is tricky with global scripts, mostly we leave them or check existence next time
      // But we can remove the listeners if needed.
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // --- LOGIC: LOGGING ---

  const addLog = (msg, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { id: Date.now(), msg, type, timestamp }]);
  };

  // --- LOGIC: GOOGLE AUTH ---

  const handleGoogleLogin = () => {
    if (!googleClientId) {
      addLog('Error: Please enter a Google Client ID.', 'error');
      return;
    }

    // Set API Key if provided
    if (googleApiKey && window.gapi && window.gapi.client) {
      window.gapi.client.setApiKey(googleApiKey);
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: SCOPES,
      callback: async (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          setGoogleToken(tokenResponse.access_token);
          addLog('Google Authenticated successfully.', 'success');
          fetchSheets(tokenResponse.access_token);
        }
      },
    });
    client.requestAccessToken();
  };

  const fetchSheets = async (accessToken) => {
    try {
      // Using raw fetch to avoid complex gapi logic for file listing
      const response = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType=\'application/vnd.google-apps.spreadsheet\'', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      if (data.files) {
        setSheets(data.files);
        if (data.files.length > 0) setSelectedSheetId(data.files[0].id);
      }
    } catch (err) {
      addLog(`Error fetching sheets: ${err.message}`, 'error');
    }
  };

  // --- LOGIC: HUBSPOT CHECK ---

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
      meaning: 'The request is malformed (invalid query params, unsupported properties, or bad formatting).',
      fixes: [
        'Double-check the query params in the URL (limit, after, properties).',
        'Remove or fix any invalid property names.',
        'Try a minimal request (limit=1) to confirm basic connectivity.'
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
        'Ensure the Private App has the correct scopes (crm.objects.companies.read at minimum).',
        'If using environment variables, verify HUBSPOT_ACCESS_TOKEN is set and restart the server.'
      ]
    },
    {
      status: 403,
      label: 'Forbidden',
      meaning: 'Token is valid, but lacks required scopes or access rights.',
      fixes: [
        'Enable crm.objects.companies.read (and any other needed scopes) on the Private App.',
        'Re-generate the token if you changed scopes.',
        'Confirm the app is installed and allowed in the correct HubSpot account.'
      ]
    },
    {
      status: 404,
      label: 'Not Found',
      meaning: 'Endpoint path is wrong or the resource is unavailable.',
      fixes: [
        'Verify /api/hubspot/companies is reachable locally.',
        'Confirm the proxy server is running and mapped to the correct HubSpot endpoint.',
        'Check for typos in the route or query params.'
      ]
    },
    {
      status: 409,
      label: 'Conflict',
      meaning: 'A request conflict occurred (often related to writes or state).',
      fixes: [
        'Retry after a short delay.',
        'Check for duplicate or conflicting requests.'
      ]
    },
    {
      status: 415,
      label: 'Unsupported Media Type',
      meaning: 'Content-Type is missing or incorrect.',
      fixes: [
        'Ensure Content-Type is application/json for requests with a body.',
        'Verify the proxy server forwards Content-Type correctly.'
      ]
    },
    {
      status: 429,
      label: 'Rate Limited',
      meaning: 'HubSpot is throttling requests due to rate limits.',
      fixes: [
        'Wait and retry with a longer delay between batches.',
        'Reduce batch size to decrease request frequency.',
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
    },
    {
      status: 502,
      label: 'Bad Gateway',
      meaning: 'Upstream error between your proxy and HubSpot.',
      fixes: [
        'Confirm the local server is reachable.',
        'Retry after a short delay.',
        'Check local server logs for proxy errors.'
      ]
    },
    {
      status: 503,
      label: 'Service Unavailable',
      meaning: 'HubSpot or the proxy service is temporarily unavailable.',
      fixes: [
        'Retry after a short delay.',
        'Check HubSpot status and local server health.'
      ]
    },
    {
      status: 504,
      label: 'Gateway Timeout',
      meaning: 'Request timed out reaching HubSpot.',
      fixes: [
        'Retry with a smaller limit.',
        'Check network connectivity and proxy server responsiveness.'
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
    addLog('HubSpot Connection Diagnostic Report (Deep Detail)', 'warning');
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

    addLog('Step-by-step verification checklist:', 'warning');
    [
      '1) Confirm the local server is running: `npm run server` (or your deployed backend).',
      '2) Create a HubSpot Private App (Settings → Integrations → Private Apps).',
      '3) Enable scopes: crm.objects.companies.read (minimum for this tool).',
      '4) Copy the Access Token (starts with "pat-").',
      '5) Paste the token into this field WITHOUT the "Bearer" prefix.',
      '6) Click “Connect HubSpot” to run the diagnostic.',
      '7) If using env vars, set HUBSPOT_ACCESS_TOKEN and restart the server.',
      '8) Retry after any change—tokens and scopes require re-auth.'
    ].forEach((line) => addLog(line, 'warning'));

    addLog('If you still see 401:', 'warning');
    [
      '• The token may be revoked—create a new token.',
      '• The token may belong to a different HubSpot account/portal.',
      '• The proxy may be stripping or altering the Authorization header.',
      '• A copy/paste error may have added spaces or newlines—re-copy the token.'
    ].forEach((line) => addLog(line, 'warning'));

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'warning');
  };

  const logHubSpotNetworkGuidance = (err) => {
    addLog('Network/Proxy Diagnostic Guidance:', 'warning');
    addLog(`Error message: ${err.message}`, 'warning');
    [
      '• Ensure the local proxy server is running (npm run server).',
      '• Verify the proxy endpoint is reachable at /api/hubspot/companies.',
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
          'Authorization': `Bearer ${hubSpotKey}`,
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

      const data = json || {};
      setHubSpotConnected(true);
      setHubSpotCount('Connected (Total count requires scan)');
      addLog('HubSpot connected successfully!', 'success');
    } catch (err) {
      setHubSpotConnected(false);
      addLog(`HubSpot Connection Failed: ${err.message}`, 'error');
      logHubSpotNetworkGuidance(err);
    }
  };

  // --- LOGIC: EXPORT PROCESS ---

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const createSheet = async () => {
    addLog(`Creating new sheet: ${newSheetName}...`);
    try {
      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: { title: newSheetName }
        })
      });
      const data = await response.json();
      addLog(`Sheet created with ID: ${data.spreadsheetId}`, 'success');
      return data.spreadsheetId;
    } catch (err) {
      throw new Error(`Failed to create sheet: ${err.message}`);
    }
  };

  const runExport = async () => {
    if (!hubSpotKey || !googleToken) {
      addLog('Missing API Keys or Token.', 'error');
      return;
    }

    setIsExporting(true);
    setStopSignal(false);
    stopSignalRef.current = false;
    
    let activeSheetId = selectedSheetId;

    try {
      // 1. Prepare Sheet
      if (isCreatingNew) {
        activeSheetId = await createSheet();
      }

      // 2. Add Header Row
      addLog('Writing headers to sheet...');
      const headers = ['ID', 'Company Name', 'Domain', 'Industry', 'Created Date', 'Last Modified'];
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${activeSheetId}/values/A1:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [headers] })
      });

      // 3. Start Loop
      let afterCursor = null;
      let hasMore = true;
      let totalProcessed = 0;
      let batchCount = 0;

      addLog('Starting export loop. Batch size: 50 records.');

      while (hasMore && !stopSignalRef.current) {
        // --- A. Fetch from HubSpot ---
        let url = `${hubSpotEndpoint}?limit=50&properties=name,domain,industry,createdate,hs_lastmodifieddate`;
        if (afterCursor) url += `&after=${afterCursor}`;

        const hsRes = await fetch(url, {
          headers: { Authorization: `Bearer ${hubSpotKey}` }
        });

        if (!hsRes.ok) {
           if (hsRes.status === 429) {
             addLog('HubSpot Rate Limit hit. Pausing for 5 seconds...', 'warning');
             await sleep(5000);
             continue; // Retry same batch (logic simplistic here, normally requires not advancing cursor)
           }
           throw new Error(`HubSpot Fetch Error: ${hsRes.statusText}`);
        }

        const hsData = await hsRes.json();
        const companies = hsData.results;

        if (!companies || companies.length === 0) {
          hasMore = false;
          break;
        }

        // --- B. Format Data ---
        const rows = companies.map(c => [
          c.id,
          c.properties.name || '',
          c.properties.domain || '',
          c.properties.industry || '',
          c.properties.createdate || '',
          c.properties.hs_lastmodifieddate || ''
        ]);

        // --- C. Push to Google Sheets ---
        const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${activeSheetId}/values/A1:append?valueInputOption=USER_ENTERED`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: rows })
        });

        if (!sheetRes.ok) {
           if (sheetRes.status === 429) {
             addLog('Google Sheets Quota hit. Pausing for 10 seconds...', 'warning');
             await sleep(10000);
             // Note: In a robust app we would retry the write. Here we log error.
             addLog('Batch failed write due to quota. Some records may be skipped.', 'error');
           } else {
             throw new Error(`Sheet Write Error: ${sheetRes.statusText}`);
           }
        }

        // --- D. Update State & Delay ---
        totalProcessed += companies.length;
        batchCount++;
        setStats({ 
          totalFetched: totalProcessed, 
          totalWritten: totalProcessed, 
          batches: batchCount 
        });
        addLog(`Batch ${batchCount}: Processed ${companies.length} records. Total: ${totalProcessed}`);

        // Update cursor
        if (hsData.paging && hsData.paging.next) {
          afterCursor = hsData.paging.next.after;
        } else {
          hasMore = false;
        }

        // Safety sleep to be kind to the APIs (approx 60 batches per min max)
        await sleep(1200); 
      }

      if (stopSignalRef.current) {
        addLog('Process stopped by user.', 'warning');
      } else {
        addLog('Export Complete!', 'success');
      }

    } catch (err) {
      addLog(`CRITICAL ERROR: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleStop = () => {
    setStopSignal(true);
    stopSignalRef.current = true;
    addLog('Stopping after current batch...', 'warning');
  };

  // --- RENDER ---

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="text-orange-500" /> HubSpot <ArrowRight className="w-4 h-4 text-slate-400" /> <FileSpreadsheet className="text-green-600" /> Exporter
            </h1>
            <p className="text-slate-500 mt-1">High-volume record migration tool (Localhost)</p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>Batch Size: 50</p>
            <p>Delay: 1.2s</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* LEFT COLUMN - CONFIG */}
          <div className="space-y-6">
            
            {/* STEP 1: HUBSPOT */}
            <div className={`p-6 rounded-xl shadow-sm border transition-all ${hubSpotConnected ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                  HubSpot Source
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
                  <p className="font-semibold text-slate-600">HubSpot Source — Step-by-step setup</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Start the local proxy server: <span className="font-mono">npm run server</span>.</li>
                    <li>In HubSpot, go to <span className="font-semibold">Settings → Integrations → Private Apps</span>.</li>
                    <li>Create a Private App and enable <span className="font-mono">crm.objects.companies.read</span> scope.</li>
                    <li>Copy the Access Token (starts with <span className="font-mono">pat-</span>).</li>
                    <li>Paste the token below <strong>without</strong> the <span className="font-mono">Bearer</span> prefix.</li>
                    <li>Click “Connect HubSpot” to run the diagnostic.</li>
                  </ol>
                  <p>
                    Requests route through the local server at <span className="font-mono">/api/hubspot/companies</span>. If
                    you prefer env vars, set <span className="font-mono">HUBSPOT_ACCESS_TOKEN</span> and restart the server.
                  </p>
                  <p className="text-slate-600">
                    If you see a 401 error, the diagnostic log will list every possible fix and redundancy step.
                  </p>
                </div>

                <button 
                  onClick={testHubSpot}
                  disabled={!hubSpotKey}
                  className="w-full py-2 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 text-sm font-medium"
                >
                  {hubSpotConnected ? 'Re-Test Connection' : 'Connect HubSpot'}
                </button>
              </div>
            </div>

            {/* STEP 2: GOOGLE */}
            <div className={`p-6 rounded-xl shadow-sm border transition-all ${googleToken ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                  Google Sheets Destination
                </h2>
                {googleToken && <CheckCircle2 className="text-green-600 w-5 h-5" />}
              </div>

              {!googleToken ? (
                <div className="space-y-3">
                  <input 
                    type="text" 
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    placeholder="Google Client ID"
                    className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-green-500 focus:outline-none font-mono text-sm"
                  />
                  <input 
                    type="password" 
                    value={googleApiKey}
                    onChange={(e) => setGoogleApiKey(e.target.value)}
                    placeholder="Google API Key (Optional but recommended)"
                    className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-green-500 focus:outline-none font-mono text-sm"
                  />
                  <button 
                    onClick={handleGoogleLogin}
                    disabled={!googleClientId}
                    className="w-full py-3 border-2 border-slate-200 rounded flex items-center justify-center gap-2 hover:bg-slate-50 font-medium text-slate-700 disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" /> Sign in with Google
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="sheetType" 
                        checked={!isCreatingNew} 
                        onChange={() => setIsCreatingNew(false)}
                      />
                      Existing Sheet
                    </label>
                    <label className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="sheetType" 
                        checked={isCreatingNew} 
                        onChange={() => setIsCreatingNew(true)}
                      />
                      Create New
                    </label>
                  </div>

                  {isCreatingNew ? (
                    <input 
                      type="text" 
                      value={newSheetName} 
                      onChange={(e) => setNewSheetName(e.target.value)}
                      className="w-full p-2 border rounded"
                      placeholder="New Sheet Name"
                    />
                  ) : (
                    <select 
                      value={selectedSheetId} 
                      onChange={(e) => setSelectedSheetId(e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      {sheets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      {sheets.length === 0 && <option>No sheets found</option>}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* ACTION AREA */}
            <div className="p-6 bg-slate-900 rounded-xl text-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                 <div>
                   <div className="text-3xl font-bold">{stats.totalWritten.toLocaleString()}</div>
                   <div className="text-slate-400 text-sm">Records Exported</div>
                 </div>
                 {isExporting ? (
                   <button onClick={handleStop} className="p-3 bg-red-600 rounded-full hover:bg-red-700 transition-colors">
                     <PauseOctagon className="w-6 h-6" />
                   </button>
                 ) : (
                   <button 
                    onClick={runExport}
                    disabled={!hubSpotConnected || !googleToken}
                    className="p-3 bg-green-500 rounded-full hover:bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
                   >
                     <Play className="w-6 h-6 ml-1" />
                   </button>
                 )}
              </div>
              {isExporting && (
                <div className="flex items-center gap-2 text-sm text-green-300 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing Batch {stats.batches + 1}...
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN - LOGS */}
          <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-sm h-[600px] overflow-hidden flex flex-col shadow-inner border border-slate-800">
            <div className="pb-2 border-b border-slate-700 mb-2 flex justify-between items-center">
              <span className="font-semibold text-slate-100">Operation Logs</span>
              <button onClick={() => setLogs([])} className="text-xs hover:text-white">Clear</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
              {logs.length === 0 && <div className="text-slate-600 italic">Ready to start...</div>}
              {logs.map((log) => (
                <div key={log.id} className={`flex gap-2 ${
                  log.type === 'error' ? 'text-red-400' : 
                  log.type === 'success' ? 'text-green-400' : 
                  log.type === 'warning' ? 'text-yellow-400' : 'text-slate-300'
                }`}>
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
