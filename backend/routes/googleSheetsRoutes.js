const express = require('express');
const axios = require('axios');

const router = express.Router();

const asyncHandler = (operation, handler) => async (req, res, next) => {
  req.operation = operation;
  try {
    const data = await handler(req, res);
    res.json({
      ok: true,
      correlationId: req.correlationId,
      operation,
      data,
    });
  } catch (err) {
    err.operation = err.operation || operation;
    next(err);
  }
};

router.get(
  '/list',
  asyncHandler('sheets.list', async (req) => {
    const userToken = req.user.token;
    const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
      headers: { Authorization: `Bearer ${userToken}` },
      params: {
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        orderBy: 'modifiedTime desc',
        pageSize: 25,
        fields: 'files(id,name,modifiedTime)',
      },
    });
    return response.data.files || [];
  })
);

router.get(
  '/:spreadsheetId/sheets',
  asyncHandler('sheets.tabs', async (req) => {
    const userToken = req.user.token;
    const { spreadsheetId } = req.params;
    const response = await axios.get(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
      {
        headers: { Authorization: `Bearer ${userToken}` },
        params: { fields: 'sheets.properties' },
      }
    );
    return (response.data.sheets || []).map((s) => s.properties);
  })
);

router.get(
  '/:spreadsheetId/data',
  asyncHandler('sheets.data', async (req) => {
    const userToken = req.user.token;
    const { spreadsheetId } = req.params;
    const sheetName = req.query.sheet || 'Sheet1';
    const response = await axios.get(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(sheetName)}`,
      {
        headers: { Authorization: `Bearer ${userToken}` },
        params: { valueRenderOption: 'FORMATTED_VALUE' },
      }
    );
    const values = response.data.values || [];
    if (values.length < 2) {
      return { headers: [], rows: [] };
    }
    const headers = values[0];
    const rows = values.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, i) => {
        if (header) {
          obj[header] = row[i] ?? '';
        }
      });
      return obj;
    });
    return { headers, rows };
  })
);

module.exports = router;
