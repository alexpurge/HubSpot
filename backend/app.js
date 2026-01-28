const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const hubspotRoutes = require('./routes/hubspotRoutes');

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: false,
  })
);

app.use((req, res, next) => {
  const existing = req.header('x-correlation-id');
  const correlationId = existing || (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} correlationId=${req.correlationId} durationMs=${durationMs}`);
  });
  next();
});

app.use('/api/hubspot', hubspotRoutes);

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const correlationId = req.correlationId || err.correlationId || 'unknown';
  res.status(status).json({
    ok: false,
    correlationId,
    operation: err.operation || req.operation || 'unknown',
    error: {
      message: err.message || 'Unknown error',
      details: err.details || null,
      hubspotStatus: err.hubspotStatus ?? null,
      hubspotBody: err.hubspotBody ?? null,
      stack: err.stack,
    },
  });
});

module.exports = app;
