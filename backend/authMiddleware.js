const axios = require('axios');

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false,
      correlationId: req.correlationId || 'unknown',
      error: { message: 'Missing or invalid Authorization header' },
    });
  }

  const token = authHeader.slice(7);

  try {
    const { data } = await axios.get(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`
    );

    if (!data.email || !data.email_verified || data.email_verified === 'false') {
      return res.status(403).json({
        ok: false,
        correlationId: req.correlationId || 'unknown',
        error: { message: 'Email not verified' },
      });
    }

    const email = data.email.toLowerCase();
    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(email)) {
      return res.status(403).json({
        ok: false,
        correlationId: req.correlationId || 'unknown',
        error: { message: `Email ${email} is not authorized` },
      });
    }

    req.user = { email, token };
    next();
  } catch (err) {
    const status = err.response?.status;
    if (status === 400 || status === 401) {
      return res.status(401).json({
        ok: false,
        correlationId: req.correlationId || 'unknown',
        error: { message: 'Invalid or expired Google token' },
      });
    }
    return res.status(500).json({
      ok: false,
      correlationId: req.correlationId || 'unknown',
      error: { message: 'Token validation failed', details: err.message },
    });
  }
};

module.exports = requireAuth;
