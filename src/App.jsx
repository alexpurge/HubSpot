import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Download,
  Loader2,
  Database,
  Search,
  AlertCircle,
  Terminal,
  Settings,
  RefreshCw,
  LayoutGrid,
  List,
  ShieldCheck,
  Sun,
  Moon,
  Check,
  Tags,
  Plus,
  X,
  Trash2,
  FileText,
  Clock,
  Layers,
  Hash,
  Infinity,
  Square,
  User,
  Globe,
} from 'lucide-react';

const EXPORT_HEADERS = [
  "id",
  "profile_picture",
  "name",
  "category",
  "email",
  "phone",
  "address",
  "description",
  "website",
  "facebook",
  "instagram",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- GLOBAL STYLES & TAILWIND INJECTION ---
const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    
    :root {
      /* Default (Dark Mode) Variables */
      --bg-canvas: #0d0d0d;
      --bg-sidebar: #050505;
      --bg-surface: #111111;
      --bg-input: #0a0a0a;
      --border-color: #262626;
      
      --text-main: #ffffff;
      --text-muted: #a3a3a3;
      --text-subtle: #52525b;

      --color-primary: #f97316;
    }

    /* Light Mode Overrides */
    [data-theme='light'] {
      --bg-canvas: #f8fafc;
      --bg-sidebar: #ffffff;
      --bg-surface: #ffffff;
      --bg-input: #f1f5f9;
      --border-color: #e2e8f0;
      
      --text-main: #0f172a;
      --text-muted: #64748b;
      --text-subtle: #94a3b8;
    }

    body {
      background-color: var(--bg-canvas);
      color: var(--text-main);
      margin: 0;
      overflow: hidden; /* Viewport Locking */
      font-family: 'Inter', sans-serif;
      -webkit-font-smoothing: antialiased;
      /* Smooth transitions for theme switching */
      transition: background-color 0.5s cubic-bezier(0.4, 0, 0.2, 1), color 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Apply transitions to all common themeable properties */
    div, button, input, span, svg, textarea, select {
       transition-property: background-color, border-color, color, fill, stroke;
       transition-duration: 0.3s;
       transition-timing-function: ease-in-out;
    }

    /* Custom Scrollbar per Style Guide */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: var(--text-subtle);
      border-radius: 3px;
      opacity: 0.5;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-muted);
    }

    /* Utility for glow effects */
    .glow-orange {
      box-shadow: 0 0 20px rgba(249, 115, 22, 0.3);
    }
    
    /* Input Auto-fill fix */
    input:-webkit-autofill,
    input:-webkit-autofill:hover, 
    input:-webkit-autofill:focus, 
    input:-webkit-autofill:active{
        -webkit-box-shadow: 0 0 0 30px var(--bg-input) inset !important;
        -webkit-text-fill-color: var(--text-main) !important;
        transition: background-color 5000s ease-in-out 0s;
    }
    
    /* Date picker specific styling for consistency */
    input[type="date"]::-webkit-calendar-picker-indicator {
        filter: invert(0.5);
        cursor: pointer;
    }
  `}} />
);

// --- UI COMPONENTS ---

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`relative w-full flex items-center gap-3 px-4 py-3 text-sm font-medium group transition-all duration-300 ${
      active 
        ? 'text-[var(--text-main)]' 
        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-canvas)]'
    }`}
  >
    {active && (
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 rounded-r-full shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
    )}
    {active && (
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-surface)] to-transparent opacity-50 z-[-1]" />
    )}
    {Icon && <Icon className={`w-4 h-4 transition-colors duration-300 ${active ? 'text-orange-500' : 'text-[var(--text-subtle)] group-hover:text-[var(--text-muted)]'}`} />}
    <span>{label}</span>
  </button>
);

const InputField = ({ label, value, onChange, placeholder, type = "text", icon: Icon, disabled = false }) => (
  <div className="mb-4">
    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">
      {label}
    </label>
    <div className="relative group">
      {Icon && (
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-orange-500 transition-colors duration-300" />
      )}
      <input 
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] text-sm rounded-xl py-2.5 ${Icon ? 'pl-12' : 'pl-4'} pr-4 
          focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all duration-300 placeholder-[var(--text-subtle)] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
    </div>
  </div>
);

const StatusPill = ({ status }) => {
  let styles = "bg-[var(--bg-input)] text-[var(--text-subtle)] border-[var(--border-color)]";
  if (status === 'SUCCEEDED') styles = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]";
  if (status === 'RUNNING' || status === 'STARTING') styles = "bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse";
  if (status && status.startsWith('PROCESSING')) styles = "bg-orange-500/10 text-orange-500 border-orange-500/20 animate-pulse";
  if (status && status.startsWith('AUTOMATION')) styles = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse";
  // Updated FAILED/TIMED-OUT to be amber/orange to signify "Attention" rather than just a dead end, since we fetch data anyway
  if (status === 'FAILED' || status === 'TIMED-OUT' || status === 'ABORTED') styles = "bg-amber-500/10 text-amber-500 border-amber-500/20";
  
  return (
    <div className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${styles} transition-all duration-300`}>
      {status}
    </div>
  );
};

const AdLibraryManager = () => {
  // --- TAILWIND INJECTION & THEME CONFIG & GOOGLE API ---
  useEffect(() => {
    // Tailwind
    if (!document.querySelector('#tailwind-script')) {
      const script = document.createElement('script');
      script.id = 'tailwind-script';
      script.src = 'https://cdn.tailwindcss.com';
      script.onload = () => {
        window.tailwind.config = {
          theme: {
            extend: {
              colors: {
                canvas: 'var(--bg-canvas)',
                sidebar: 'var(--bg-sidebar)',
                surface: 'var(--bg-surface)',
                input: 'var(--bg-input)',
                borderMain: 'var(--border-color)',
                primary: '#f97316', 
              },
              fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
              }
            }
          }
        };
      };
      document.head.appendChild(script);
    }
    
    // Google Identity Services
    if (!document.querySelector('#google-client-script')) {
      const script = document.createElement('script');
      script.id = 'google-client-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  // --- STATE ---
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | keywords

  // Auth State
  const [apiToken, setApiToken] = useState('');
  const [customProxyUrl, setCustomProxyUrl] = useState(''); 
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [googleToken, setGoogleToken] = useState(''); // Stores the Access Token from Login
  const [googleSheetId, setGoogleSheetId] = useState('');
  const [userSheets, setUserSheets] = useState([]);
  const [isFetchingSheets, setIsFetchingSheets] = useState(false);

  // Keyword Centre State
  const [keywordPresets, setKeywordPresets] = useState([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetRawText, setNewPresetRawText] = useState('');
  const [viewingPreset, setViewingPreset] = useState(null);

  // Continuous / Schedule State
  const [schedules, setSchedules] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState('');
  const [scheduleFrequency, setScheduleFrequency] = useState('daily');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState('1');
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState('1');
  const [customCronMinute, setCustomCronMinute] = useState('*');
  const [customCronHour, setCustomCronHour] = useState('*');
  const [customCronDayMonth, setCustomCronDayMonth] = useState('*');
  const [customCronMonth, setCustomCronMonth] = useState('*');
  const [customCronDayWeek, setCustomCronDayWeek] = useState('*');
  const [fetchingSchedules, setFetchingSchedules] = useState(false);

  // Run Config
  const [runMode, setRunMode] = useState('single');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [country, setCountry] = useState('ALL');
  const [maxItems, setMaxItems] = useState(50);
  const [activeStatus, setActiveStatus] = useState('active');
  const [minDate, setMinDate] = useState('');
  const [maxDate, setMaxDate] = useState('');
  
  // Timeout State
  const [runTimeoutValue, setRunTimeoutValue] = useState(10);
  const [runTimeoutUnit, setRunTimeoutUnit] = useState('hours');
  
  // Execution State
  const [datasetId, setDatasetId] = useState(null);
  const [runStatus, setRunStatus] = useState('IDLE'); 
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [runHistory, setRunHistory] = useState([]);
  
  // Automation State
  const [isAutomated, setIsAutomated] = useState(false);
  const [showAutoConfirm, setShowAutoConfirm] = useState(false);
  const automationRef = useRef(false);
  
  // Automation Export Config
  const [autoExportMode, setAutoExportMode] = useState('local'); // 'local' | 'sheet'
  const [autoScheduleMode, setAutoScheduleMode] = useState('continuous'); 
  const [autoIntervalValue, setAutoIntervalValue] = useState(30);
  const [autoIntervalUnit, setAutoIntervalUnit] = useState('minutes');
  const [autoDailyTime, setAutoDailyTime] = useState('09:00');

  // Single Run Export Config
  const [showSingleRunConfirm, setShowSingleRunConfirm] = useState(false);
  const [singleRunExportMode, setSingleRunExportMode] = useState('local'); // 'local' | 'sheet'
  
  // Data
  const [datasetItems, setDatasetItems] = useState([]);

  // Use the UUID for robustness - UPDATED ACTOR ID
  const ACTOR_ID = '1cabRg4HPWqKK38xa'; 
  const logsEndRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, message, type }]);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // --- GOOGLE LOGIN HANDLER ---
  const handleGoogleLogin = () => {
    if (!googleClientId) {
      setError("Please enter a Google Client ID first.");
      return;
    }
    
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly',
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            setGoogleToken(tokenResponse.access_token);
            addLog("Google Login Successful!", "success");
          } else {
             setError("Google Login failed or cancelled.");
          }
        },
      });
      client.requestAccessToken();
    } catch (e) {
      console.error("Google Auth Error", e);
      setError("Failed to initialize Google Login. Check Client ID.");
    }
  };

  // --- GOOGLE SHEETS FETCHING ---
  useEffect(() => {
    const fetchUserSheets = async () => {
      if (!googleToken) return;
      
      setIsFetchingSheets(true);
      try {
        let url = "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&pageSize=20&fields=files(id, name)";
        if (googleApiKey) {
            url += `&key=${googleApiKey}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${googleToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            setUserSheets(data.files || []);
            if (!googleSheetId && data.files && data.files.length > 0) {
                setGoogleSheetId(data.files[0].id);
            }
        } else {
             const err = await response.text();
             console.warn("Sheet fetch failed", err);
        }
      } catch (e) {
          console.error("Failed to fetch sheets", e);
      } finally {
          setIsFetchingSheets(false);
      }
    };

    fetchUserSheets();
  }, [googleToken, googleApiKey]);

  // --- GOOGLE SHEETS HELPER ---
  
  const getSheetMetadata = async (spreadsheetId) => {
      let metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
      if (googleApiKey) metaUrl += `?key=${googleApiKey}`;

      const response = await fetch(metaUrl, {
          headers: { 'Authorization': `Bearer ${googleToken}` }
      });
      
      if (!response.ok) {
          throw new Error("Failed to access spreadsheet. Check permissions.");
      }
      
      const data = await response.json();
      if (!data.sheets || data.sheets.length === 0) {
          throw new Error("Spreadsheet has no sheets.");
      }
      
      return data.sheets[0].properties.title;
  };

  const fetchSheetColumn = async (spreadsheetId, sheetName, columnLetter) => {
      const range = `'${sheetName}'!${columnLetter}:${columnLetter}`;
      let url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?majorDimension=COLUMNS`;
      if (googleApiKey) url += `&key=${googleApiKey}`;
      
      const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${googleToken}` }
      });
      
      if (!response.ok) return new Set();
      
      const data = await response.json();
      const rows = data.values ? data.values[0] : []; 
      return new Set(rows.filter(Boolean)); 
  };

  const exportToGoogleSheet = async (items, spreadsheetId, sheetName = null) => {
      if (!googleToken || !spreadsheetId) {
          throw new Error("Google credentials missing");
      }

      let targetSheet = sheetName;
      if (!targetSheet) {
         try {
             targetSheet = await getSheetMetadata(spreadsheetId);
         } catch(e) {
             console.warn("Metadata fetch failed in export", e);
             targetSheet = 'Sheet1'; 
         }
      }

      const range = `'${targetSheet}'!A:A`;

      const rows = items.map(item => {
          return EXPORT_HEADERS.map(key => {
              const val = item[key];
              return val === null || val === undefined ? "" : String(val);
          });
      });

      let appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
      if (googleApiKey) appendUrl += `&key=${googleApiKey}`;
      
      const response = await fetch(appendUrl, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${googleToken}`,
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              values: rows
          })
      });

      if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Google API Error: ${errText}`);
      }

      return rows.length;
  };

  // --- DATA NORMALIZATION ENGINE ---
  const normalizeData = (items) => {
    return items.map(item => {
      // Flattening: Check common nesting patterns (snapshot, data) or use root
      const source = item.snapshot || item.data || item;

      // Safe Extraction Helper with Multi-key Support
      // Checks a list of keys and returns the first non-null/undefined value
      const getVal = (...keys) => {
        for (const key of keys) {
           // Support dot notation for deep access (e.g. "extra_info.email")
           const val = key.split('.').reduce((obj, k) => (obj || {})[k], source);
           if (val !== null && val !== undefined && val !== "") return val;
        }
        return '';
      };

      // Array Helper: Joins arrays or returns string
      const getArrayVal = (...keys) => {
          const val = getVal(...keys);
          if (Array.isArray(val)) return val.join(', ');
          return val || '';
      };

      // Construct Clean Object with user-defined schema
      return {
        id: getVal('id', 'page_id', 'pageId', 'uuid'),
        profile_picture: getVal('profile_picture', 'page_profile_picture_url', 'profilePicture', 'logo'),
        name: getVal('name', 'page_name', 'pageName', 'title'),
        category: getArrayVal('category', 'page_categories', 'categories'),
        email: getVal('email', 'emails', 'contact_email', 'business_email', 'extra_info.email'),
        phone: getVal('phone', 'phones', 'phone_number', 'contact_phone', 'extra_info.phone'),
        address: getVal('address', 'location', 'full_address', 'business_address', 'extra_info.address'),
        description: getVal('description', 'about', 'bio', 'page_description'),
        website: getVal('website', 'website_url', 'external_url'),
        facebook: getVal('facebook', 'page_profile_uri', 'facebook_url', 'social_facebook'),
        instagram: getVal('instagram', 'instagram_url', 'social_instagram'),
      };
    });
  };

  // --- API HELPERS ---
  const callApify = async (endpoint, method = 'GET', body = null, queryParams = {}) => {
    if (!apiToken) throw new Error("API Token is required");
    
    // Construct base URL
    let url = `https://api.apify.com/v2/acts/${ACTOR_ID}/${endpoint}?token=${apiToken}`;
    
    // Append extra query parameters if they exist (e.g. timeout)
    const queryString = new URLSearchParams(queryParams).toString();
    if (queryString) {
      url += `&${queryString}`;
    }

    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error (${response.status}): ${errText}`);
    }
    return response.json();
  };

  // --- CORE EXECUTION LOGIC (SINGLE KEYWORD) ---
  const executeKeywordRun = async (keyword, index, total) => {
    addLog(`PROCESSING (${index}/${total}): "${keyword}"...`, 'system');
    
    let finalTimeout = 0;
    if (runTimeoutUnit !== 'infinity') {
        const val = parseInt(runTimeoutValue) || 0;
        const multipliers = { seconds: 1, minutes: 60, hours: 3600, days: 86400 };
        finalTimeout = val * (multipliers[runTimeoutUnit] || 1);
    }
    
    try {
      const input = {
        query: keyword,
        country: country,
        maxItems: parseInt(maxItems),
        mediaType: "all",
        category: "all",
        activeStatus: activeStatus,
        proxyConfiguration: customProxyUrl 
            ? { useApifyProxy: false, proxyUrls: [customProxyUrl] }
            : { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] }
      };

      if (minDate) input.minDate = minDate;
      if (maxDate) input.maxDate = maxDate;

      const queryParams = finalTimeout > 0 ? { timeout: finalTimeout } : {};

      const data = await callApify('runs', 'POST', input, queryParams);
      const runId = data.data.id;
      const defDatasetId = data.data.defaultDatasetId;
      
      setDatasetId(defDatasetId); 
      
      let isDone = false;
      while (!isDone) {
        await sleep(4000);
        const response = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs/${runId}?token=${apiToken}`);
        const runData = await response.json();
        const status = runData.data.status;
        
        if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
          isDone = true;
          if (status !== 'SUCCEEDED') {
             addLog(`Run for "${keyword}" finished with status: ${status}`, 'warning');
          }
        }
      }

      if (!defDatasetId) {
         addLog(`No dataset ID for "${keyword}"`, 'error');
         return [];
      }

      const url = `https://api.apify.com/v2/datasets/${defDatasetId}/items?token=${apiToken}`;
      const dsResponse = await fetch(url);
      if (!dsResponse.ok) throw new Error(`Dataset fetch failed`);
      const rawItems = await dsResponse.json();

      if (rawItems.length === 0) {
        addLog(`No items found for "${keyword}"`, 'warning');
        return [];
      }

      // Normalize
      return normalizeData(rawItems);

    } catch (err) {
      addLog(`Error processing "${keyword}": ${err.message}`, 'error');
      return [];
    }
  };

  // --- EXECUTION SEQUENCE MANAGER ---
  const executeSequence = async (exportConfig = null) => {
    if (!apiToken) {
      setError("API Token required");
      return;
    }

    let keywordsToRun = [];
    let runLabel = "";

    if (runMode === 'single') {
        if (!searchQuery.trim()) {
            setError("Search query required.");
            return;
        }
        keywordsToRun = [searchQuery];
        runLabel = `Search: ${searchQuery}`;
    } else {
        if (!selectedPresetId) {
            setError("Please select a preset.");
            return;
        }
        const preset = keywordPresets.find(p => String(p.id) === String(selectedPresetId));
        if (!preset || preset.keywords.length === 0) {
            setError("Invalid or empty preset selected.");
            return;
        }
        keywordsToRun = preset.keywords;
        runLabel = `Preset: ${preset.name}`;
    }

    setIsLoading(true);
    setError(null);
    
    if (!isAutomated || (isAutomated && !exportConfig)) {
         setDatasetItems([]); 
    }
    
    setRunStatus('PROCESSING');
    
    addLog(`Starting Concurrent Sequence: ${keywordsToRun.length} keywords queued.`, 'system');

    // PRE-FETCH SHEET DATA IF EXPORTING
    const sheetSeenUris = new Set();
    let targetSheetName = null;
    
    if (exportConfig) {
        try {
            addLog(`Fetching existing data from Sheet to prepare for duplicates...`, 'system');
            const sheetId = exportConfig.spreadsheetId;
            targetSheetName = await getSheetMetadata(sheetId);
            // FIXED: Checking Column J (Facebook Link) for duplicates as requested
            const existingIds = await fetchSheetColumn(sheetId, targetSheetName, 'J'); 
            existingIds.forEach(id => sheetSeenUris.add(id));
            addLog(`Loaded ${existingIds.size} existing IDs from sheet.`, 'success');
        } catch (e) {
            addLog(`Failed to fetch sheet data: ${e.message}`, 'error');
            setRunStatus('FAILED');
            setIsLoading(false);
            return;
        }
    }

    // BATCH PROCESSING VARIABLES
    const BATCH_SIZE = 128;
    const runSeenUris = new Set();
    let totalRawCount = 0;
    let totalUniqueCount = 0;
    const localAccumulator = [];

    for (let i = 0; i < keywordsToRun.length; i += BATCH_SIZE) {
        const batch = keywordsToRun.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(keywordsToRun.length / BATCH_SIZE);

        addLog(`Starting Batch ${batchNumber}/${totalBatches} (${batch.length} keywords)...`, 'system');

        const batchPromises = batch.map(async (kw, batchIndex) => {
            const globalIndex = i + batchIndex + 1;
            const newItems = await executeKeywordRun(kw, globalIndex, keywordsToRun.length);
            return newItems;
        });

        const batchResults = await Promise.all(batchPromises);
        const flattenedBatchItems = batchResults.flat();
        
        totalRawCount += flattenedBatchItems.length;

        // Filter & Deduplicate Batch
        const uniqueBatchItems = [];
        
        flattenedBatchItems.forEach(item => {
            if (!item) return;
            // FIXED: Deduplicate based on 'facebook' field (Column J)
            const uri = item.facebook; 
            
            if (uri && runSeenUris.has(uri)) return;
            if (exportConfig && uri && sheetSeenUris.has(uri)) return;

            if (uri) {
                runSeenUris.add(uri);
                if (exportConfig) sheetSeenUris.add(uri);
            }
            uniqueBatchItems.push(item);
        });

        totalUniqueCount += uniqueBatchItems.length;

        // Process Batch Results
        if (uniqueBatchItems.length > 0) {
            if (exportConfig) {
                try {
                    addLog(`Batch ${batchNumber}: Appending ${uniqueBatchItems.length} unique items to Sheet...`, 'system');
                    await exportToGoogleSheet(uniqueBatchItems, exportConfig.spreadsheetId, targetSheetName);
                    addLog(`Batch ${batchNumber}: Export successful.`, 'success');
                } catch (e) {
                    addLog(`Batch ${batchNumber} Export Failed: ${e.message}`, 'error');
                }
            } else {
                localAccumulator.push(...uniqueBatchItems);
                setDatasetItems(prev => [...prev, ...uniqueBatchItems]);
            }
        } else {
            addLog(`Batch ${batchNumber}: No new unique items found.`, 'warning');
        }

        if (i + BATCH_SIZE < keywordsToRun.length) {
            await sleep(2000);
        }
    }

    // --- FINAL DEDUPLICATION (Local) ---
    addLog(`Runs finished. Consolidating results...`, 'system');

    const flattenedItems = localAccumulator;
    const finalUniqueItems = [];
    const seenUris = new Set();

    flattenedItems.forEach(item => {
        if (!item) return;
        // FIXED: Deduplicate based on 'facebook' field (Column J)
        const uri = item.facebook;
        if (uri) {
            if (!seenUris.has(uri)) {
                seenUris.add(uri);
                finalUniqueItems.push(item);
            }
        } else {
            finalUniqueItems.push(item);
        }
    });

    const localDuplicates = flattenedItems.length - finalUniqueItems.length;
    if (localDuplicates > 0) {
        addLog(`Local Deduplication: Removed ${localDuplicates} internal duplicates.`, 'warning');
    }
    
    addLog(`Sequence Complete. Total Raw: ${totalRawCount}, Total Added/Kept: ${totalUniqueCount}`, 'success');

    const runSummary = {
        id: Date.now(),
        label: runLabel,
        totalCount: totalRawCount,
        uniqueCount: totalUniqueCount,
        date: new Date().toLocaleString(),
        runId: isAutomated ? 'Automation' : (exportConfig ? 'Sheet' : 'Local')
    };
    setRunHistory(prev => [runSummary, ...prev]);
    
    setRunStatus('SUCCEEDED');
    setIsLoading(false);
  };

  const handleStartSingleRun = () => {
    // Prepare export config if selected using the global sheet ID state
    const exportConfig = singleRunExportMode === 'sheet' 
        ? { spreadsheetId: googleSheetId } 
        : null;

    executeSequence(exportConfig);
    setShowSingleRunConfirm(false);
  };

  const startAutomationCycle = async () => {
    setIsAutomated(true);
    automationRef.current = true;
    
    // Prepare export config if selected using the global sheet ID state
    const exportConfig = autoExportMode === 'sheet' 
        ? { spreadsheetId: googleSheetId } 
        : null;
        
    // Close modal
    setShowAutoConfirm(false);
    
    // Determine First Run Start Time for Intervals
    let nextScheduledTime = Date.now();
    
    // Automation Loop
    while (automationRef.current) {
        
        // 1. Wait Logic (If Scheduled)
        if (autoScheduleMode !== 'continuous') {
            setRunStatus('WAITING');
            let msToWait = 0;
            
            if (autoScheduleMode === 'interval') {
                const intervalMs = (parseInt(autoIntervalValue) || 1) * (autoIntervalUnit === 'seconds' ? 1000 : 
                     autoIntervalUnit === 'minutes' ? 60000 : 
                     3600000); // hours
                
                if (nextScheduledTime <= Date.now()) {
                     // run now
                } else {
                     msToWait = nextScheduledTime - Date.now();
                }
                
                nextScheduledTime += intervalMs;
                
            } else if (autoScheduleMode === 'daily') {
                const now = new Date();
                const [h, m] = autoDailyTime.split(':').map(Number);
                const target = new Date();
                target.setHours(h, m, 0, 0);
                
                if (target <= now) {
                    target.setDate(target.getDate() + 1);
                }
                msToWait = target.getTime() - now.getTime();
            }
            
            if (msToWait > 0) {
                const waitSecs = Math.ceil(msToWait / 1000);
                addLog(`Waiting ${waitSecs}s for schedule...`, 'system');
                
                const steps = 10;
                for(let s=0; s<steps; s++) {
                    if(!automationRef.current) break;
                    await sleep(msToWait / steps);
                }
            }
            
            if(!automationRef.current) break;
        }

        // 2. Run Execution
        setRunStatus('AUTOMATION ACTIVE');
        addLog(`--- STARTING AUTOMATION CYCLE (${autoExportMode === 'sheet' ? 'Export' : 'Local'}) ---`, 'system');
        
        try {
            await executeSequence(exportConfig);
            
            if (!automationRef.current) break;
            
            addLog('Cycle finished.', 'system');
            
            await sleep(1000);
            
        } catch (e) {
            addLog(`Automation Error: ${e.message}. Retrying in 5s...`, 'error');
            await sleep(5000);
        }
    }
    
    setIsAutomated(false);
    setRunStatus('IDLE');
    setIsLoading(false);
    addLog('Automation Stopped by User.', 'warning');
  };

  const stopAutomation = () => {
      automationRef.current = false;
      setIsAutomated(false); // Optimistic UI update
      addLog('Stopping automation after current tasks complete...', 'warning');
  };

  const fetchDataset = async (targetDatasetId) => {
    const idToUse = targetDatasetId || datasetId;
    if (!idToUse) {
      addLog("Cannot fetch: No Dataset ID available.", 'error');
      return;
    }

    setIsFetchingData(true);
    addLog(`Fetching data from Dataset: ${idToUse}...`, 'system');

    try {
      const url = `https://api.apify.com/v2/datasets/${idToUse}/items?token=${apiToken}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
      
      const rawItems = await response.json();
      
      if (rawItems.length === 0) {
        addLog('Dataset is empty.', 'warning');
        setDatasetItems([]);
        return;
      }

      // Normalize & Dedupe Single Run
      const cleanedItems = normalizeData(rawItems);
      const uniqueItems = [];
      const seenUris = new Set();
      
      cleanedItems.forEach(item => {
        // FIXED: Deduplicate based on 'facebook' field (Column J)
        const uri = item.facebook;
        if (uri) {
            if (!seenUris.has(uri)) {
                seenUris.add(uri);
                uniqueItems.push(item);
            }
        } else {
            uniqueItems.push(item);
        }
      });
      
      // Update History for Manual Fetch too
      const runSummary = {
          id: Date.now(),
          label: `Manual Fetch: ${idToUse}`,
          totalCount: rawItems.length,
          uniqueCount: uniqueItems.length,
          date: new Date().toLocaleString(),
          runId: 'External'
      };
      setRunHistory(prev => [runSummary, ...prev]);
      
      setDatasetItems(uniqueItems);
      addLog(`Successfully loaded ${uniqueItems.length} items.`, 'success');
    } catch (err) {
      addLog(`Data fetch error: ${err.message}`, 'error');
      setError(err.message);
    } finally {
      setIsFetchingData(false);
    }
  };

  // --- KEYWORD CENTRE HANDLERS ---
  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;

    const keywords = newPresetRawText
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    const newPreset = {
      id: Date.now(),
      name: newPresetName,
      keywords: keywords,
      dateCreated: new Date().toLocaleDateString()
    };

    setKeywordPresets(prev => [...prev, newPreset]);
    
    setNewPresetName('');
    setNewPresetRawText('');
    setShowPresetModal(false);
  };

  const handleDeletePreset = (id) => {
    setKeywordPresets(prev => prev.filter(p => p.id !== id));
  };
  
  // --- SCHEDULE HANDLERS ---
  const fetchSchedules = useCallback(async () => {
    if (!apiToken) return;
    setFetchingSchedules(true);
    try {
        const response = await fetch(`https://api.apify.com/v2/schedules?token=${apiToken}`);
        if (response.ok) {
            const data = await response.json();
            setSchedules(data.data.items || []);
        }
    } catch (e) {
        console.error("Failed to fetch schedules", e);
    } finally {
        setFetchingSchedules(false);
    }
  }, [apiToken]);

  useEffect(() => {
    if (activeTab === 'continuous' && apiToken) {
        fetchSchedules();
    }
  }, [activeTab, apiToken, fetchSchedules]);

  const handleCreateSchedule = async () => {
    if (!newScheduleName.trim() || !apiToken) return;

    // Determine payload input based on current config settings
    let queryToUse = searchQuery;
    if (runMode === 'preset') {
        const preset = keywordPresets.find(p => String(p.id) === String(selectedPresetId));
        if (preset) {
            queryToUse = preset.keywords.join(', ');
        }
    }

    if (!queryToUse) {
        setError("Schedule requires a valid search query or preset.");
        return;
    }

    const inputPayload = {
        query: queryToUse,
        country: country,
        maxItems: parseInt(maxItems),
        mediaType: "all",
        category: "all",
        activeStatus: activeStatus,
        proxyConfiguration: customProxyUrl 
            ? { useApifyProxy: false, proxyUrls: [customProxyUrl] }
            : { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
        timeout: 36000, 
        timeoutSecs: 36000
    };
    if (minDate) inputPayload.minDate = minDate;
    if (maxDate) inputPayload.maxDate = maxDate;

    // Construct Cron Expression based on User Friendly Inputs
    let cronExpression = '@daily';
    const [hour, minute] = (scheduleTime || '00:00').split(':').map(Number);

    switch (scheduleFrequency) {
        case 'hourly':
            cronExpression = '0 * * * *';
            break;
        case 'daily':
            cronExpression = `${minute || 0} ${hour || 0} * * *`;
            break;
        case 'weekly':
            // 0-6 in Cron is Sun-Sat. 
            cronExpression = `${minute || 0} ${hour || 0} * * ${scheduleDayOfWeek}`;
            break;
        case 'monthly':
            cronExpression = `${minute || 0} ${hour || 0} ${scheduleDayOfMonth} * *`;
            break;
        case 'custom':
            // Construct from the broken down fields
            cronExpression = `${customCronMinute} ${customCronHour} ${customCronDayMonth} ${customCronMonth} ${customCronDayWeek}`;
            break;
        default:
            cronExpression = '@daily';
    }

    const schedulePayload = {
        name: newScheduleName,
        cronExpression: cronExpression,
        isEnabled: true,
        isExclusive: false,
        actions: [
            {
                type: "RUN_ACTOR",
                actorId: ACTOR_ID,
                input: inputPayload
            }
        ]
    };

    try {
        const response = await fetch(`https://api.apify.com/v2/schedules?token=${apiToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(schedulePayload)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Failed to create schedule: ${err}`);
        }

        addLog(`Schedule "${newScheduleName}" created successfully!`, 'success');
        setShowScheduleModal(false);
        fetchSchedules(); // Refresh list
        setNewScheduleName('');
        // Reset defaults
        setScheduleFrequency('daily');
        setScheduleTime('09:00');
        
    } catch (err) {
        setError(err.message);
        addLog(`Error creating schedule: ${err.message}`, 'error');
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
      if(!apiToken) return;
      try {
          await fetch(`https://api.apify.com/v2/schedules/${scheduleId}?token=${apiToken}`, {
              method: 'DELETE'
          });
          setSchedules(prev => prev.filter(s => s.id !== scheduleId));
          addLog("Schedule deleted.", 'warning');
      } catch(e) {
          setError(e.message);
      }
  };

  const handleToggleSchedule = async (schedule) => {
      if(!apiToken) return;
      try {
          await fetch(`https://api.apify.com/v2/schedules/${schedule.id}?token=${apiToken}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isEnabled: !schedule.isEnabled })
          });
          
          // Optimistic update
          setSchedules(prev => prev.map(s => s.id === schedule.id ? {...s, isEnabled: !s.isEnabled} : s));
          
      } catch(e) {
          setError("Failed to toggle schedule");
      }
  };

  const pollRunStatus = async (runId) => {
    if (!runId || !apiToken) return;

    try {
      let status = 'RUNNING';
      while (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
        await sleep(4000);
        const response = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs/${runId}?token=${apiToken}`);
        if (!response.ok) throw new Error(`Status poll failed: ${response.statusText}`);
        const runData = await response.json();
        status = runData?.data?.status || 'UNKNOWN';
        setRunStatus(status);
      }
    } catch (e) {
      addLog(`Status poll error: ${e.message}`, 'warning');
    }
  };

  const handleRunSchedule = async (schedule) => {
    if (!apiToken) {
        setError("API Token required");
        return;
    }

    const runAction = schedule.actions?.find(a => a.type === 'RUN_ACTOR');
    
    if (!runAction) {
        setError("Could not find a runnable action in this schedule.");
        return;
    }

    addLog(`Manually triggering schedule: "${schedule.name}"...`, 'system');

    try {
        const response = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${apiToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(runAction.input)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const runId = data.data.id;
        const defDatasetId = data.data.defaultDatasetId;

        setDatasetId(defDatasetId);
        setRunStatus(data.data.status);
        
        pollRunStatus(runId);
        
        addLog(`Manual run started successfully! ID: ${runId}`, 'success');

    } catch (err) {
        setError(err.message);
        addLog(`Manual run failed: ${err.message}`, 'error');
    }
  };

  const renderScheduleTiming = (schedule) => {
     const cron = schedule.cronExpression;
     if (!cron) return "Manual";
     
     if (cron === '0 * * * *') return "Every Hour";
     if (cron === '@hourly') return "Every Hour";
     if (cron === '@daily') return "Daily (Midnight)";
     if (cron.endsWith('* * *')) {
         const parts = cron.split(' ');
         if(parts.length >= 2) return `Daily at ${parts[1]}:${parts[0].padStart(2,'0')}`;
     }
     
     return `Custom (${cron})`;
  };


  const downloadCSV = () => {
    if (datasetItems.length === 0) return;
    
    const csvContent = [
      EXPORT_HEADERS.join(','),
      ...datasetItems.map(item => 
        EXPORT_HEADERS.map(key => {
          let val = item[key];
          if (Array.isArray(val)) {
             const isSimple = val.every(v => typeof v === 'string' || typeof v === 'number');
             if (isSimple) {
                val = val.join(', ');
             } else {
                val = JSON.stringify(val);
             }
          } else if (typeof val === 'object' && val !== null) {
             val = JSON.stringify(val);
          }
          if (val === null || val === undefined) val = '';
          // Escape quotes for CSV
          return `"${String(val).replace(/"/g, '""')}"`
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `purge_export_${datasetId || 'bulk'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex w-screen h-screen bg-canvas text-[var(--text-main)] overflow-hidden" data-theme={theme}>
      <GlobalStyles />

      {/* --- SIDEBAR --- */}
      <div className="w-64 flex-shrink-0 bg-sidebar border-r border-borderMain flex flex-col z-20 transition-colors duration-300">
        <div className="h-16 flex items-center px-6 border-b border-borderMain">
          <img src="https://i.imgur.com/QjjDjuU.png" alt="Purge Digital Logo" className="w-8 h-8 mr-2" />
          <h1 className="font-bold tracking-tight text-lg text-[var(--text-main)]">PURGE<span className="text-[var(--text-subtle)] font-normal">.DIGITAL</span></h1>
        </div>

        <div className="py-6 flex-1 space-y-1">
          <div className="px-6 mb-2 text-[10px] font-bold text-[var(--text-subtle)] uppercase tracking-widest">Platform</div>
          <SidebarItem 
            icon={LayoutGrid} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={Tags} 
            label="Keyword Centre" 
            active={activeTab === 'keywords'} 
            onClick={() => setActiveTab('keywords')} 
          />
          <SidebarItem 
            icon={Clock} 
            label="Continuous" 
            active={activeTab === 'continuous'} 
            onClick={() => setActiveTab('continuous')} 
          />
        </div>

        <div className="p-4 border-t border-borderMain">
          <div className="bg-[var(--bg-input)] rounded-xl p-2 border border-borderMain flex items-center gap-2 shadow-sm transition-colors duration-300">
            <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-white shrink-0">
              AD
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-medium text-[var(--text-main)] truncate">Admin User</div>
              <div className="text-[10px] text-[var(--text-subtle)] truncate">Enterprise Lic.</div>
            </div>
            <button 
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-canvas)] border border-borderMain text-[var(--text-muted)] hover:text-orange-500 hover:border-orange-500/50 transition-all duration-300"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-canvas transition-colors duration-300">
        
        {/* Top Header */}
        <header className="h-16 border-b border-borderMain flex items-center justify-between px-8 bg-canvas/95 backdrop-blur z-10 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight">Ad Library Scraper</h2>
            <div className="h-6 w-px bg-borderMain"></div>
            <StatusPill status={runStatus} />
          </div>
          
          <div className="flex items-center gap-3">
            {(runStatus === 'SUCCEEDED' || runStatus === 'TIMED-OUT' || runStatus === 'FAILED' || datasetItems.length > 0) && (
               <button 
                onClick={() => fetchDataset(datasetId)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-borderMain hover:bg-[var(--bg-surface)] text-xs font-medium transition-colors text-[var(--text-muted)]"
                disabled={isFetchingData || !datasetId || isLoading}
               >
                 <RefreshCw className={`w-3 h-3 ${isFetchingData ? 'animate-spin' : ''}`} />
                 {isFetchingData ? 'Fetching...' : 'Fetch Results'}
               </button>
            )}
            <button 
              onClick={downloadCSV}
              disabled={datasetItems.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                datasetItems.length > 0 
                ? 'bg-[var(--bg-surface)] text-[var(--text-main)] border border-borderMain hover:border-orange-500 hover:text-orange-500 shadow-sm' 
                : 'opacity-50 cursor-not-allowed border border-transparent'
              }`}
            >
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto p-8">
          
          <div className="grid grid-cols-12 gap-8 max-w-7xl mx-auto">
            
            {/* LEFT COLUMN: Controls */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              
              {/* --- DASHBOARD TAB CONTENT --- */}
              {activeTab === 'dashboard' && (
                <>
                  <div className="bg-[var(--bg-surface)] border border-orange-500/30 rounded-2xl p-6 relative overflow-hidden shadow-lg transition-colors duration-300">
                      <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                      <h3 className="text-[var(--text-main)] font-bold text-lg mb-2">Authentication</h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-[var(--text-subtle)] mb-1">Apify API Token</p>
                          <InputField 
                            value={apiToken}
                            onChange={(e) => setApiToken(e.target.value)}
                            icon={ShieldCheck}
                            type="password"
                            placeholder="apify_api_..."
                          />
                        </div>
                        
                        <div className="pt-3 border-t border-[var(--border-color)]">
                          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Custom Proxy (Optional)</p>
                          <div className="mb-3">
                             <InputField 
                                value={customProxyUrl}
                                onChange={(e) => setCustomProxyUrl(e.target.value)}
                                icon={Globe}
                                type="password"
                                placeholder="http://user:pass@host:port"
                              />
                          </div>

                          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Google Sheets Integration</p>
                          <div className="space-y-2">
                             <InputField 
                                value={googleClientId}
                                onChange={(e) => setGoogleClientId(e.target.value)}
                                icon={ShieldCheck}
                                type="password"
                                placeholder="Google Client ID"
                              />
                              <InputField 
                                value={googleApiKey}
                                onChange={(e) => setGoogleApiKey(e.target.value)}
                                icon={Hash}
                                type="password"
                                placeholder="Google API Key"
                              />
                              
                              <button 
                                onClick={handleGoogleLogin}
                                className="w-full py-2 bg-white text-gray-800 hover:bg-gray-100 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                              >
                                <User className="w-4 h-4" />
                                Sign in with Google
                              </button>

                              {/* Sheet Selector (Shown only after login) */}
                              {googleToken && (
                                <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">
                                    Select Spreadsheet
                                  </label>
                                  {isFetchingSheets ? (
                                      <div className="w-full h-10 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl flex items-center justify-center">
                                          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                                      </div>
                                  ) : (
                                      <div className="relative">
                                          <select 
                                              value={googleSheetId} 
                                              onChange={(e) => setGoogleSheetId(e.target.value)}
                                              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] text-sm rounded-xl py-2.5 px-4 pr-10 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 appearance-none transition-all duration-300 cursor-pointer"
                                              disabled={userSheets.length === 0}
                                          >
                                              <option value="">-- Choose a Sheet --</option>
                                              {userSheets.map(sheet => (
                                                  <option key={sheet.id} value={sheet.id}>
                                                      {sheet.name}
                                                  </option>
                                              ))}
                                          </select>
                                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">▼</div>
                                      </div>
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>

                  <div className="bg-[var(--bg-surface)] border border-borderMain rounded-2xl overflow-hidden shadow-xl transition-colors duration-300">
                    <div className="px-6 py-4 border-b border-borderMain flex items-center justify-between">
                      <span className="text-sm font-bold text-[var(--text-main)]">RUN CONFIGURATION</span>
                      <Settings className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                    
                    <div className="p-6">
                      <div className="mb-4 flex bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--border-color)]">
                        <button 
                          onClick={() => setRunMode('single')}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                            runMode === 'single' ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                          }`}
                        >
                          Single Search
                        </button>
                        <button 
                          onClick={() => setRunMode('preset')}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                            runMode === 'preset' ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                          }`}
                        >
                          Use Preset
                        </button>
                      </div>

                      {runMode === 'single' ? (
                        <InputField 
                          label="Search Query" 
                          placeholder="e.g. Nike, Adidas" 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          icon={Search}
                        />
                      ) : (
                        <div className="mb-4">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">Select Preset</label>
                          <div className="relative">
                            <select 
                              value={selectedPresetId} 
                              onChange={(e) => setSelectedPresetId(e.target.value)}
                              className="w-full bg-[var(--bg-input)] border border-borderMain text-[var(--text-main)] text-sm rounded-xl py-2.5 px-4 pr-10 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 appearance-none transition-all duration-300 cursor-pointer"
                            >
                              <option value="">-- Choose a Preset --</option>
                              {keywordPresets.map(preset => (
                                <option key={preset.id} value={preset.id}>
                                  {preset.name} ({preset.keywords.length} keywords)
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">▼</div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="mb-4">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">Target Country</label>
                          <div className="relative">
                            <select 
                              value={country} 
                              onChange={(e) => setCountry(e.target.value)}
                              className="w-full bg-[var(--bg-input)] border border-borderMain text-[var(--text-main)] text-sm rounded-xl py-2.5 px-4 pr-10 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 appearance-none transition-all duration-300 cursor-pointer"
                            >
                              <option value="ALL">All Countries</option>
                              <option value="US">United States</option>
                              <option value="GB">United Kingdom</option>
                              <option value="CA">Canada</option>
                              <option value="AU">Australia</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">▼</div>
                          </div>
                        </div>

                        <div className="mb-4">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">Active Status</label>
                          <div className="relative">
                            <select 
                              value={activeStatus} 
                              onChange={(e) => setActiveStatus(e.target.value)}
                              className="w-full bg-[var(--bg-input)] border border-borderMain text-[var(--text-main)] text-sm rounded-xl py-2.5 px-4 pr-10 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 appearance-none transition-all duration-300 cursor-pointer"
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                              <option value="all">All</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">▼</div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="mb-4">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">Min Date</label>
                          <div className="relative">
                            <input 
                              type="date"
                              value={minDate}
                              onChange={(e) => setMinDate(e.target.value)}
                              className="w-full bg-[var(--bg-input)] border border-borderMain text-[var(--text-main)] text-sm rounded-xl py-2.5 px-4 pr-10 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 appearance-none transition-all duration-300 cursor-pointer"
                            />
                          </div>
                        </div>
                        <div className="mb-4">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">Max Date</label>
                          <div className="relative">
                            <input 
                              type="date"
                              value={maxDate}
                              onChange={(e) => setMaxDate(e.target.value)}
                              className="w-full bg-[var(--bg-input)] border border-borderMain text-[var(--text-main)] text-sm rounded-xl py-2.5 px-4 pr-10 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 appearance-none transition-all duration-300 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* MAX ITEMS & TIMEOUT */}
                      <div className="grid grid-cols-2 gap-4">
                        <InputField 
                            label="Max Items" 
                            placeholder="50" 
                            type="number"
                            value={maxItems}
                            onChange={(e) => setMaxItems(e.target.value)}
                        />
                         
                         {/* UNIT-BASED TIMEOUT SELECTOR */}
                         <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">
                                Max Run Time
                            </label>
                            <div className="flex w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl overflow-hidden focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500/50 transition-all duration-300">
                                <input 
                                    type="number" 
                                    placeholder="10" 
                                    value={runTimeoutValue}
                                    onChange={(e) => setRunTimeoutValue(e.target.value)}
                                    disabled={runTimeoutUnit === 'infinity'}
                                    className={`w-1/2 bg-transparent text-[var(--text-main)] text-sm py-2.5 px-3 focus:outline-none ${runTimeoutUnit === 'infinity' ? 'opacity-30 cursor-not-allowed' : ''}`}
                                />
                                <div className="w-px bg-[var(--border-color)]"></div>
                                <select 
                                    value={runTimeoutUnit}
                                    onChange={(e) => setRunTimeoutUnit(e.target.value)}
                                    className="w-1/2 bg-[var(--bg-input)] text-[var(--text-muted)] text-xs font-medium focus:outline-none px-2 cursor-pointer appearance-none text-center"
                                    style={{ textAlignLast: 'center' }}
                                >
                                    <option value="seconds">Seconds</option>
                                    <option value="minutes">Minutes</option>
                                    <option value="hours">Hours</option>
                                    <option value="days">Days</option>
                                    <option value="infinity">Infinity</option>
                                </select>
                            </div>
                         </div>
                      </div>

                      {/* ACTIONS ROW */}
                      <div className="space-y-3 mt-2">
                        {/* 1. Initiate Sequence (Standard) */}
                        <button 
                            onClick={() => setShowSingleRunConfirm(true)}
                            disabled={isLoading || !apiToken || isAutomated}
                            className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all duration-300 ${
                            isLoading || isAutomated
                                ? 'bg-[var(--bg-input)] text-[var(--text-subtle)] cursor-not-allowed' 
                                : !apiToken
                                ? 'bg-[var(--bg-input)] text-[var(--text-subtle)] cursor-not-allowed'
                                : 'bg-orange-500 text-white hover:bg-orange-600 glow-orange'
                            }`}
                        >
                            {isLoading && !isAutomated ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                            {isLoading && !isAutomated ? (runMode === 'preset' ? 'RUNNING BULK SEQUENCE...' : 'EXECUTING SEQUENCE...') : (runMode === 'preset' ? 'START BULK RUN' : 'INITIATE SEQUENCE')}
                        </button>

                        {/* 2. Run Automation / Stop Automation */}
                        {!isAutomated ? (
                            <button 
                                onClick={() => setShowAutoConfirm(true)}
                                disabled={isLoading || !apiToken}
                                className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all duration-300 group ${
                                isLoading || !apiToken
                                    ? 'bg-[var(--bg-input)] text-[var(--text-subtle)] cursor-not-allowed'
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20'
                                }`}
                            >
                                <Infinity className="w-5 h-5" />
                                RUN AUTOMATION
                            </button>
                        ) : (
                            <button 
                                onClick={stopAutomation}
                                className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all duration-300 bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 animate-pulse"
                            >
                                <Square className="w-4 h-4 fill-current" />
                                STOP AUTOMATION
                            </button>
                        )}
                      </div>

                    </div>
                  </div>
                </>
              )}

              {/* --- KEYWORD CENTRE TAB CONTENT --- */}
              {activeTab === 'keywords' && (
                <div className="bg-[var(--bg-surface)] border border-borderMain rounded-2xl overflow-hidden shadow-xl transition-colors duration-300 h-full flex flex-col">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-borderMain flex items-center justify-between bg-[var(--bg-surface)]">
                     <div className="flex items-center gap-2">
                       <Tags className="w-4 h-4 text-orange-500" />
                       <span className="text-sm font-bold text-[var(--text-main)]">KEYWORD CENTRE</span>
                     </div>
                     <button 
                        onClick={() => setShowPresetModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                     >
                       <Plus className="w-3 h-3" />
                       New Preset
                     </button>
                  </div>

                  {/* Content Area */}
                  <div className="p-6 flex-1 overflow-y-auto bg-[var(--bg-input)]">
                    {keywordPresets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-[var(--text-subtle)] space-y-3 opacity-60">
                        <Tags className="w-12 h-12" />
                        <p className="text-sm">No presets created yet.</p>
                        <p className="text-xs">Click "New Preset" to import keywords.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {keywordPresets.map((preset) => (
                          <div 
                            key={preset.id} 
                            onClick={() => setViewingPreset(preset)}
                            className="bg-[var(--bg-surface)] border border-borderMain rounded-xl p-4 flex items-center justify-between group hover:border-orange-500/50 transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-orange-500" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-[var(--text-main)]">{preset.name}</h4>
                                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                                  {preset.keywords.length} keywords • Created {preset.dateCreated}
                                </p>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id); }}
                              className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete Preset"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- CONTINUOUS / SCHEDULES TAB CONTENT --- */}
              {activeTab === 'continuous' && (
                <div className="bg-[var(--bg-surface)] border border-borderMain rounded-2xl overflow-hidden shadow-xl transition-colors duration-300 h-full flex flex-col">
                  <div className="px-6 py-4 border-b border-borderMain flex items-center justify-between bg-[var(--bg-surface)]">
                     <div className="flex items-center gap-2">
                       <Clock className="w-4 h-4 text-orange-500" />
                       <span className="text-sm font-bold text-[var(--text-main)]">CONTINUOUS SCHEDULES</span>
                     </div>
                     <button 
                        onClick={() => setShowScheduleModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                     >
                       <Plus className="w-3 h-3" />
                       Create Schedule
                     </button>
                  </div>

                  <div className="p-6 flex-1 overflow-y-auto bg-[var(--bg-input)]">
                    {!apiToken ? (
                       <div className="flex flex-col items-center justify-center h-full text-[var(--text-subtle)] space-y-3 opacity-60">
                        <ShieldCheck className="w-12 h-12" />
                        <p className="text-sm">Authentication Required</p>
                        <p className="text-xs">Please enter your API Token in the Dashboard tab.</p>
                      </div>
                    ) : fetchingSchedules ? (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--text-subtle)] space-y-3 opacity-60">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <p className="text-xs">Loading schedules...</p>
                        </div>
                    ) : schedules.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-[var(--text-subtle)] space-y-3 opacity-60">
                        <Clock className="w-12 h-12" />
                        <p className="text-sm">No active schedules.</p>
                        <p className="text-xs">Create a schedule to run tasks around the clock.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {schedules.map((schedule) => (
                          <div key={schedule.id} className="bg-[var(--bg-surface)] border border-borderMain rounded-xl p-4 flex flex-col gap-4 group hover:border-orange-500/50 transition-all">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${schedule.isEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--bg-input)] text-[var(--text-muted)]'}`}>
                                        <RefreshCw className={`w-5 h-5 ${schedule.isEnabled ? 'animate-[spin_10s_linear_infinite]' : ''}`} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-[var(--text-main)]">{schedule.name}</h4>
                                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">
                                            {renderScheduleTiming(schedule)} • Next: {new Date(schedule.nextRunAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Run Now Button */}
                                    <button 
                                        onClick={() => handleRunSchedule(schedule)}
                                        className="p-2 text-[var(--text-muted)] hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                        title="Run Now"
                                    >
                                        <Play className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleToggleSchedule(schedule)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                            schedule.isEnabled 
                                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                                            : 'bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border-color)]'
                                        }`}
                                    >
                                        {schedule.isEnabled ? 'Active' : 'Paused'}
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteSchedule(schedule.id)}
                                        className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Schedule Details Snippet */}
                            {schedule.lastRunAt && (
                                <div className="pt-3 border-t border-[var(--border-color)] flex justify-between items-center text-[10px] text-[var(--text-subtle)]">
                                    <span>Last Run: {new Date(schedule.lastRunAt).toLocaleString()}</span>
                                </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}


              {/* Console/Logs Card (Always Visible) */}
              <div className="bg-[var(--bg-surface)] border border-borderMain rounded-2xl overflow-hidden flex flex-col h-64 shadow-xl transition-colors duration-300">
                <div className="px-6 py-3 border-b border-borderMain flex items-center gap-2">
                  <Terminal className="w-3 h-3 text-orange-500" />
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">System Output</span>
                </div>
                <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] space-y-2 bg-[var(--bg-input)] transition-colors duration-300">
                  {logs.length === 0 && <span className="text-[var(--text-subtle)] italic">System ready. Waiting for input...</span>}
                  {logs.map((log, i) => (
                    <div key={i} className={`flex gap-3 ${
                      log.type === 'error' ? 'text-red-500' : 
                      log.type === 'success' ? 'text-emerald-500' : 
                      log.type === 'warning' ? 'text-amber-500' : 
                      log.type === 'system' ? 'text-orange-500/80' : 'text-[var(--text-muted)]'
                    }`}>
                      <span className="text-[var(--text-subtle)] shrink-0 select-none">[{log.timestamp}]</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Results - NOW SHOWS RUN HISTORY TILES */}
            <div className="col-span-12 lg:col-span-8 h-[700px] flex flex-col">
              <div className="bg-[var(--bg-surface)] border border-borderMain rounded-2xl flex-1 flex flex-col overflow-hidden relative shadow-2xl transition-colors duration-300">
                
                {/* Data Header */}
                <div className="px-6 py-4 border-b border-borderMain flex justify-between items-center bg-[var(--bg-surface)] transition-colors duration-300">
                  <div>
                    <h3 className="text-[var(--text-main)] font-bold text-sm">RUN HISTORY</h3>
                    <p className="text-[10px] text-[var(--text-subtle)] font-mono mt-0.5">
                      {runHistory.length} Sequences Recorded
                    </p>
                  </div>
                  <div className="flex gap-2">
                     <button className="p-2 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] transition-colors">
                       <List className="w-4 h-4" />
                     </button>
                     <button className="p-2 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] transition-colors">
                       <LayoutGrid className="w-4 h-4" />
                     </button>
                  </div>
                </div>

                {/* Run History Grid (Replaced Table) */}
                <div className="flex-1 overflow-auto bg-[var(--bg-input)] p-6 relative transition-colors duration-300">
                  {runHistory.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {runHistory.map((run) => (
                        <div key={run.id} className="bg-[var(--bg-surface)] border border-borderMain rounded-xl p-5 flex flex-col gap-3 hover:border-orange-500/50 transition-all shadow-sm">
                           <div className="flex justify-between items-start">
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                 <Layers className="w-5 h-5 text-orange-500" />
                               </div>
                               <div>
                                 <h4 className="text-sm font-bold text-[var(--text-main)]">{run.label}</h4>
                                 <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{run.date}</p>
                                 <p className="text-[10px] text-[var(--text-subtle)] font-mono mt-0.5">Ref: {run.runId}</p>
                               </div>
                             </div>
                             <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] font-bold text-emerald-500 uppercase">
                               Success
                             </div>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-2 mt-2">
                             <div className="bg-[var(--bg-input)] p-2 rounded-lg border border-borderMain">
                               <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Total Raw</p>
                               <p className="text-lg font-bold text-[var(--text-main)]">{run.totalCount}</p>
                             </div>
                             <div className="bg-[var(--bg-input)] p-2 rounded-lg border border-borderMain">
                               <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Unique Leads</p>
                               <p className="text-lg font-bold text-orange-500">{run.uniqueCount}</p>
                             </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-muted)]">
                      <Database className="w-16 h-16 mb-4 opacity-10" />
                      <p className="text-sm font-medium">No History Available</p>
                      <p className="text-[10px] mt-2 opacity-50 uppercase tracking-widest">Run a sequence to populate tiles</p>
                    </div>
                  )}

                  {/* Error Overlay - Now only shows if we truly have NO data and an error exists, or as a toast */}
                  {error && runHistory.length === 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 backdrop-blur-sm">
                       <div className="bg-[var(--bg-surface)] border border-red-500/20 p-6 rounded-2xl max-w-md text-center shadow-2xl">
                         <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                         <h4 className="text-red-500 font-bold mb-2">SYSTEM ERROR</h4>
                         <p className="text-[var(--text-muted)] text-xs font-mono">{error}</p>
                         <button 
                           onClick={() => setError(null)}
                           className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-600 transition-colors"
                         >
                           Dismiss
                         </button>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* --- CREATE PRESET MODAL --- */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-borderMain rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-borderMain flex items-center justify-between bg-[var(--bg-surface)]">
              <h3 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                <Plus className="w-5 h-5 text-orange-500" />
                Create Keyword Preset
              </h3>
              <button 
                onClick={() => setShowPresetModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <InputField 
                label="Preset Name"
                placeholder="e.g. Nike Competitors"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                icon={Tags}
              />
              
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">
                  Paste Keywords (Spreadsheet Column)
                </label>
                <textarea 
                  className="w-full h-48 bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] text-sm rounded-xl p-3 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all duration-300 placeholder-[var(--text-subtle)] resize-none font-mono"
                  placeholder={`Nike\nAdidas\nPuma\nReebok`}
                  value={newPresetRawText}
                  onChange={(e) => setNewPresetRawText(e.target.value)}
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-2 text-right">
                  {newPresetRawText ? newPresetRawText.split('\n').filter(k => k.trim()).length : 0} keywords detected
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-borderMain bg-[var(--bg-input)] flex justify-end gap-3">
              <button 
                onClick={() => setShowPresetModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold uppercase tracking-wider shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW PRESET MODAL --- */}
      {viewingPreset && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-borderMain rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-borderMain flex items-center justify-between bg-[var(--bg-surface)]">
              <h3 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                <Tags className="w-5 h-5 text-orange-500" />
                {viewingPreset.name}
              </h3>
              <button 
                onClick={() => setViewingPreset(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">
                  Keywords List
                </label>
                <div className="w-full h-64 bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] text-sm rounded-xl p-3 overflow-y-auto font-mono">
                  {viewingPreset.keywords.map((kw, i) => (
                    <div key={i} className="py-1 border-b border-[var(--border-color)] last:border-0 border-opacity-50">
                      {kw}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--text-muted)] mt-2 text-right">
                  {viewingPreset.keywords.length} keywords total
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-borderMain bg-[var(--bg-input)] flex justify-end">
              <button 
                onClick={() => setViewingPreset(null)}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold uppercase tracking-wider shadow-lg shadow-orange-500/20 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CREATE SCHEDULE MODAL --- */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-borderMain rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-borderMain flex items-center justify-between bg-[var(--bg-surface)]">
              <h3 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Create Continuous Schedule
              </h3>
              <button 
                onClick={() => setShowScheduleModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl mb-4">
                  <p className="text-[10px] text-[var(--text-muted)]">
                      <span className="text-orange-500 font-bold block mb-1">AUTOMATED CONFIGURATION</span>
                      This schedule will use your current settings (Target Country: {country}, Active Status: {activeStatus}) and the selected keyword source below.
                  </p>
              </div>

              <InputField 
                label="Schedule Name"
                placeholder="e.g. Daily Competitor Scan"
                value={newScheduleName}
                onChange={(e) => setNewScheduleName(e.target.value)}
                icon={FileText}
              />

              <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">Frequency</label>
                    <div className="relative">
                        <select 
                        value={scheduleFrequency} 
                        onChange={(e) => setScheduleFrequency(e.target.value)}
                        className="w-full bg-[var(--bg-input)] border border-borderMain text-[var(--text-main)] text-sm rounded-xl py-2.5 px-4 pr-10 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 appearance-none transition-all duration-300 cursor-pointer"
                        >
                        <option value="hourly">Every Hour</option>
                        <option value="daily">Every Day</option>
                        <option value="weekly">Every Week</option>
                        <option value="monthly">Every Month</option>
                        <option value="custom">Advanced (Custom Cron)</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">▼</div>
                    </div>
                  </div>
                  
                  {/* Dynamic Time/Day Inputs based on Frequency */}
                  <div className="grid grid-cols-2 gap-4">
                      {(scheduleFrequency === 'daily' || scheduleFrequency === 'weekly' || scheduleFrequency === 'monthly') && (
                          <div>
                             <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">Time</label>
                             <input 
                                type="time"
                                value={scheduleTime}
                                onChange={(e) => setScheduleTime(e.target.value)}
                                className="w-full bg-[var(--bg-input)] border border-borderMain text-[var(--text-main)] text-sm rounded-xl py-2.5 px-4 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all duration-300"
                             />
                          </div>
                      )}

                      {scheduleFrequency === 'weekly' && (
                          <div>
                             <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">Day of Week</label>
                             <div className="relative">
                                <select 
                                    value={scheduleDayOfWeek}
                                    onChange={(e) => setScheduleDayOfWeek(e.target.value)}
                                    className="w-full bg-[var(--bg-input)] border border-borderMain text-[var(--text-main)] text-sm rounded-xl py-2.5 px-4 pr-10 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 appearance-none transition-all duration-300 cursor-pointer"
                                >
                                    <option value="1">Monday</option>
                                    <option value="2">Tuesday</option>
                                    <option value="3">Wednesday</option>
                                    <option value="4">Thursday</option>
                                    <option value="5">Friday</option>
                                    <option value="6">Saturday</option>
                                    <option value="0">Sunday</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">▼</div>
                             </div>
                          </div>
                      )}

                      {scheduleFrequency === 'monthly' && (
                          <div>
                             <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">Day of Month</label>
                             <div className="relative">
                                <select 
                                    value={scheduleDayOfMonth}
                                    onChange={(e) => setScheduleDayOfMonth(e.target.value)}
                                    className="w-full bg-[var(--bg-input)] border border-borderMain text-[var(--text-main)] text-sm rounded-xl py-2.5 px-4 pr-10 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 appearance-none transition-all duration-300 cursor-pointer"
                                >
                                    {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                                        <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">▼</div>
                             </div>
                          </div>
                      )}
                  </div>
                  
                  {scheduleFrequency === 'custom' && (
                      <div className="flex gap-2 mt-2 w-full">
                        <div className="flex-1"><InputField label="Min" value={customCronMinute} onChange={(e) => setCustomCronMinute(e.target.value)} /></div>
                        <div className="flex-1"><InputField label="Hour" value={customCronHour} onChange={(e) => setCustomCronHour(e.target.value)} /></div>
                        <div className="flex-1"><InputField label="Day" value={customCronDayMonth} onChange={(e) => setCustomCronDayMonth(e.target.value)} /></div>
                        <div className="flex-1"><InputField label="Month" value={customCronMonth} onChange={(e) => setCustomCronMonth(e.target.value)} /></div>
                        <div className="flex-1"><InputField label="Week" value={customCronDayWeek} onChange={(e) => setCustomCronDayWeek(e.target.value)} /></div>
                      </div>
                  )}
              </div>

              {/* Source Selection Feedback */}
              <div className="mt-2 pt-2 border-t border-[var(--border-color)]">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">
                      Keyword Source
                  </label>
                  {runMode === 'single' ? (
                      <div className="bg-[var(--bg-input)] p-3 rounded-xl border border-[var(--border-color)] flex items-center gap-3">
                          <Search className="w-4 h-4 text-[var(--text-muted)]" />
                          <div className="overflow-hidden">
                              <p className="text-xs font-bold text-[var(--text-main)] truncate">{searchQuery || 'No query entered'}</p>
                              <p className="text-[10px] text-[var(--text-muted)]">Single Keyword Mode</p>
                          </div>
                      </div>
                  ) : (
                      <div className="bg-[var(--bg-input)] p-3 rounded-xl border border-[var(--border-color)] flex items-center gap-3">
                          <Tags className="w-4 h-4 text-[var(--text-muted)]" />
                          <div className="overflow-hidden">
                              <p className="text-xs font-bold text-[var(--text-main)] truncate">
                                  {keywordPresets.find(p => String(p.id) === String(selectedPresetId))?.name || 'No Preset Selected'}
                              </p>
                              <p className="text-[10px] text-[var(--text-muted)]">Preset Mode</p>
                          </div>
                      </div>
                  )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-borderMain bg-[var(--bg-input)] flex justify-end gap-3">
              <button 
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateSchedule}
                disabled={!newScheduleName.trim() || !apiToken}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold uppercase tracking-wider shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Create Schedule
              </button>
            </div>
          </div>
        </div>
      )}

       {/* --- AUTOMATION CONFIRMATION MODAL --- */}
       {showAutoConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-borderMain rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Infinity className="w-8 h-8 text-indigo-500" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">Start Automation?</h3>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                This will run the selected configuration continuously in a loop. It will deduplicate and save results after every cycle.
              </p>

              {/* AUTOMATION MODE TOGGLE */}
              <div className="bg-[var(--bg-input)] p-1 rounded-xl flex mb-6 border border-[var(--border-color)]">
                 <button 
                    onClick={() => setAutoExportMode('local')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        autoExportMode === 'local' ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                 >
                    Run Locally
                 </button>
                 <button 
                    onClick={() => setAutoExportMode('sheet')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        autoExportMode === 'sheet' ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                 >
                    Run & Append
                 </button>
              </div>

              {/* AUTOMATION SCHEDULE SETTINGS */}
              <div className="mb-6 text-left border-t border-[var(--border-color)] pt-4">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)] mb-2 ml-1">Schedule Mode</label>
                  <div className="relative mb-3">
                      <select 
                        value={autoScheduleMode} 
                        onChange={(e) => setAutoScheduleMode(e.target.value)}
                        className="w-full bg-[var(--bg-input)] border border-borderMain text-[var(--text-main)] text-sm rounded-xl py-2.5 px-4 pr-10 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 appearance-none transition-all duration-300 cursor-pointer"
                      >
                        <option value="continuous">Continuous (Loop)</option>
                        <option value="interval">Interval (Every X Time)</option>
                        <option value="daily">Daily (At Specific Time)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">▼</div>
                  </div>

                  {autoScheduleMode === 'interval' && (
                       <div className="flex w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl overflow-hidden focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500/50 transition-all duration-300">
                          <input 
                              type="number" 
                              placeholder="30" 
                              value={autoIntervalValue}
                              onChange={(e) => setAutoIntervalValue(e.target.value)}
                              className="w-1/2 bg-transparent text-[var(--text-main)] text-sm py-2.5 px-3 focus:outline-none"
                          />
                          <div className="w-px bg-[var(--border-color)]"></div>
                          <select 
                              value={autoIntervalUnit}
                              onChange={(e) => setAutoIntervalUnit(e.target.value)}
                              className="w-1/2 bg-[var(--bg-input)] text-[var(--text-muted)] text-xs font-medium focus:outline-none px-2 cursor-pointer appearance-none text-center"
                              style={{ textAlignLast: 'center' }}
                          >
                              <option value="seconds">Seconds</option>
                              <option value="minutes">Minutes</option>
                              <option value="hours">Hours</option>
                          </select>
                      </div>
                  )}

                  {autoScheduleMode === 'daily' && (
                       <input 
                          type="time"
                          value={autoDailyTime}
                          onChange={(e) => setAutoDailyTime(e.target.value)}
                          className="w-full bg-[var(--bg-input)] border border-borderMain text-[var(--text-main)] text-sm rounded-xl py-2.5 px-4 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all duration-300"
                       />
                  )}
              </div>

              {/* SHEET SELECTION CHECK */}
              {autoExportMode === 'sheet' && !googleSheetId && (
                  <div className="mb-6 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-left">
                     <AlertCircle className="w-3 h-3 inline mr-1" />
                     Please select a target spreadsheet in the Dashboard authentication settings first.
                  </div>
              )}
              {autoExportMode === 'sheet' && googleSheetId && (
                  <div className="mb-6 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs text-left truncate">
                     <Check className="w-3 h-3 inline mr-1" />
                     Target: {userSheets.find(s => s.id === googleSheetId)?.name || googleSheetId}
                  </div>
              )}
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={startAutomationCycle}
                  disabled={autoExportMode === 'sheet' && (!googleToken || !googleSheetId)}
                  className={`w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider shadow-lg shadow-indigo-500/25 transition-all ${autoExportMode === 'sheet' && (!googleToken || !googleSheetId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Start Running
                </button>
                <button 
                  onClick={() => setShowAutoConfirm(false)}
                  className="w-full py-3 bg-[var(--bg-input)] hover:bg-[var(--border-color)] text-[var(--text-muted)] rounded-xl font-medium transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

       {/* --- SINGLE RUN CONFIRMATION MODAL --- */}
       {showSingleRunConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-borderMain rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Play className="w-8 h-8 text-orange-500 ml-1" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">Initiate Sequence?</h3>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                Ready to start the data collection sequence? Choose how you want to handle the results.
              </p>

              {/* MODE TOGGLE */}
              <div className="bg-[var(--bg-input)] p-1 rounded-xl flex mb-6 border border-[var(--border-color)]">
                 <button 
                    onClick={() => setSingleRunExportMode('local')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        singleRunExportMode === 'local' ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                 >
                    Run Locally
                 </button>
                 <button 
                    onClick={() => setSingleRunExportMode('sheet')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        singleRunExportMode === 'sheet' ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                 >
                    Run & Append
                 </button>
              </div>

              {/* SHEET SELECTION CHECK */}
              {singleRunExportMode === 'sheet' && !googleSheetId && (
                  <div className="mb-6 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-left">
                     <AlertCircle className="w-3 h-3 inline mr-1" />
                     Please select a target spreadsheet in the Dashboard settings first.
                  </div>
              )}
              {singleRunExportMode === 'sheet' && googleSheetId && (
                  <div className="mb-6 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs text-left truncate">
                     <Check className="w-3 h-3 inline mr-1" />
                     Target: {userSheets.find(s => s.id === googleSheetId)?.name || googleSheetId}
                  </div>
              )}
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleStartSingleRun}
                  disabled={singleRunExportMode === 'sheet' && (!googleToken || !googleSheetId)}
                  className={`w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold uppercase tracking-wider shadow-lg shadow-orange-500/25 transition-all ${singleRunExportMode === 'sheet' && (!googleToken || !googleSheetId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Run Now
                </button>
                <button 
                  onClick={() => setShowSingleRunConfirm(false)}
                  className="w-full py-3 bg-[var(--bg-input)] hover:bg-[var(--border-color)] text-[var(--text-muted)] rounded-xl font-medium transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdLibraryManager;

// :contentReference[oaicite:0]{index=0}
