# React + Vite

## HubSpot proxy server

HubSpot requests must go through the local Express server. Start both services in separate terminals:

```bash
npm run server
npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:5000`, so the UI can call `/api/hubspot/ping` without CORS issues.

If you prefer not to paste the token in the UI, you can set `HUBSPOT_ACCESS_TOKEN` (or `HUBSPOT_API_KEY`) in a `.env` file and restart the server. The server will use that token if the Authorization header is missing.

For Google Sheets, you can prefill the UI by setting `VITE_GOOGLE_CLIENT_ID` in a `.env` file before running `npm run dev`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
