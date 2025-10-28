// server/proxy.js (CommonJS variant)
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

// prefer global fetch when available (Node 18+), otherwise try node-fetch
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  try {
    // node-fetch v3 is ESM; some environments expose it as a default export
    const nf = require('node-fetch');
    fetchFn = nf.default || nf;
  } catch (e) {
    throw new Error('fetch is not available. Install node-fetch or use Node 18+');
  }
}

const app = express();
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '100kb' }));

function timeoutSignal(ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

async function postToUpstream(url, body, headers = {}) {
  const { signal, clear } = timeoutSignal(15000);
  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });
    clear();
    const text = await response.text();
    try {
      return { status: response.status, ok: response.ok, body: JSON.parse(text) };
    } catch (err) {
      return { status: response.status, ok: response.ok, body: text };
    }
  } catch (err) {
    clear();
    throw err;
  }
}

app.post('/api/operador', async (req, res) => {
  const { telefono } = req.body || {};
  if (!telefono) return res.status(400).json({ error: 'telefono is required in body' });

  const remoteUrl = 'https://estacionpago.ehub.com.gt/recargas.svc/ObtieneOperadorTelefono';
  try {
    // prepare logging
    const procesosDir = path.join(process.cwd(), 'src', 'procesos');
    await fs.mkdir(procesosDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const logFile = path.join(procesosDir, `${ts}-${id}.json`);
    const logEntry = {
      timestamp: new Date().toISOString(),
      request: { url: remoteUrl, body: { telefono }, headers: req.headers },
      response: null
    };

    const result = await postToUpstream(remoteUrl, { telefono });
    logEntry.response = { status: result.status, body: result.body };
    try { await fs.writeFile(logFile, JSON.stringify(logEntry, null, 2)); } catch (e) { console.error('Failed to write log file', e); }

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Proxy error /api/operador:', err && err.message ? err.message : err);
    try {
      const procesosDir = path.join(process.cwd(), 'src', 'procesos');
      await fs.mkdir(procesosDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const logFile = path.join(procesosDir, `${ts}-${id}-error.json`);
      const logEntry = { timestamp: new Date().toISOString(), request: { url: remoteUrl, body: { telefono }, headers: req.headers }, error: err && err.message ? err.message : String(err) };
      await fs.writeFile(logFile, JSON.stringify(logEntry, null, 2));
    } catch (e) { console.error('Failed to write error log', e); }
    if (err.name === 'AbortError') return res.status(504).json({ error: 'Upstream request timed out' });
    return res.status(502).json({ error: 'Error contacting upstream', details: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Proxy running at http://localhost:${PORT} (ALLOWED_ORIGIN=${ALLOWED_ORIGIN})`);
});
