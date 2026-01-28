import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import './App.css';

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

const statusLabel = {
  idle: 'Not connected',
  connecting: 'Checking...',
  connected: 'Connected',
  error: 'Failed'
};

export default function App() {
  const [hubSpotToken, setHubSpotToken] = useState('');
  const [hubSpotStatus, setHubSpotStatus] = useState('idle');
  const [googleClientId, setGoogleClientId] = useState(
    () => import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
  );
  const [googleStatus, setGoogleStatus] = useState('idle');
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (message, type = 'info') => {
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        message,
        type,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  const handleHubSpotConnect = async () => {
    if (!hubSpotToken) {
      addLog('HubSpot token is required before checking the connection.', 'error');
      return;
    }

    setHubSpotStatus('connecting');
    addLog('Checking HubSpot connection...');

    try {
      const response = await fetch('/api/hubspot/ping', {
        headers: {
          Authorization: `Bearer ${hubSpotToken}`
        }
      });

      if (!response.ok) {
        const bodyText = await response.text();
        setHubSpotStatus('error');
        addLog(`HubSpot connection failed (HTTP ${response.status}).`, 'error');
        if (bodyText) {
          addLog(`HubSpot response: ${bodyText}`, 'error');
        }
        return;
      }

      setHubSpotStatus('connected');
      addLog('HubSpot connected successfully.', 'success');
    } catch (error) {
      setHubSpotStatus('error');
      addLog(`HubSpot connection failed: ${error.message}`, 'error');
    }
  };

  const handleGoogleConnect = () => {
    if (!googleClientId) {
      addLog('Google Client ID is required before checking the connection.', 'error');
      return;
    }

    if (!window.google || !window.google.accounts?.oauth2) {
      addLog('Google Identity Services is still loading. Try again in a moment.', 'error');
      return;
    }

    setGoogleStatus('connecting');
    addLog('Starting Google Sheets authorization...');

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: GOOGLE_SCOPE,
      callback: async (tokenResponse) => {
        if (!tokenResponse?.access_token) {
          setGoogleStatus('error');
          addLog('Google authorization failed. No access token returned.', 'error');
          return;
        }

        try {
          const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=1&q=mimeType=\'application/vnd.google-apps.spreadsheet\'', {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`
            }
          });

          if (!response.ok) {
            const text = await response.text();
            setGoogleStatus('error');
            addLog(`Google Sheets connection failed (HTTP ${response.status}).`, 'error');
            if (text) {
              addLog(`Google response: ${text}`, 'error');
            }
            return;
          }

          setGoogleStatus('connected');
          addLog('Google Sheets connected successfully.', 'success');
        } catch (error) {
          setGoogleStatus('error');
          addLog(`Google Sheets connection failed: ${error.message}`, 'error');
        }
      }
    });

    client.requestAccessToken();
  };

  const statusIcon = (status) => {
    if (status === 'connected') return <CheckCircle2 className="status-icon success" />;
    if (status === 'error') return <XCircle className="status-icon error" />;
    if (status === 'connecting') return <CircleDashed className="status-icon pending" />;
    return <CircleDashed className="status-icon idle" />;
  };

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Connection Monitor</h1>
          <p>HubSpot + Google Sheets connection checks only.</p>
        </div>
        <div className="status-summary">
          <div className="status-pill">
            {statusIcon(hubSpotStatus)}
            <span>HubSpot: {statusLabel[hubSpotStatus]}</span>
          </div>
          <div className="status-pill">
            {statusIcon(googleStatus)}
            <span>Google Sheets: {statusLabel[googleStatus]}</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="card">
          <h2>HubSpot</h2>
          <p>Provide your Private App token and check if the API is reachable.</p>
          <label className="field">
            <span>HubSpot Token</span>
            <input
              type="password"
              placeholder="pat-..."
              value={hubSpotToken}
              onChange={(event) => setHubSpotToken(event.target.value)}
            />
          </label>
          <button type="button" onClick={handleHubSpotConnect}>
            Check HubSpot Connection
          </button>
          <div className={`status-message ${hubSpotStatus}`}>
            {statusLabel[hubSpotStatus]}
          </div>
        </section>

        <section className="card">
          <h2>Google Sheets</h2>
          <p>Authorize access and confirm that Sheets are reachable.</p>
          <label className="field">
            <span>Google Client ID</span>
            <input
              type="text"
              placeholder="xxxx.apps.googleusercontent.com"
              value={googleClientId}
              onChange={(event) => setGoogleClientId(event.target.value)}
            />
          </label>
          <button type="button" onClick={handleGoogleConnect}>
            Check Google Sheets Connection
          </button>
          <div className={`status-message ${googleStatus}`}>
            {statusLabel[googleStatus]}
          </div>
        </section>

        <section className="card logs">
          <div className="logs-header">
            <h2>Operations Log</h2>
            <button type="button" className="ghost" onClick={() => setLogs([])}>
              Clear
            </button>
          </div>
          <div className="logs-body">
            {logs.length === 0 ? (
              <div className="empty">No actions yet. Run a connection check.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className={`log-entry ${log.type}`}>
                  <span>[{log.timestamp}]</span>
                  <span>{log.message}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </section>
      </main>
    </div>
  );
}
