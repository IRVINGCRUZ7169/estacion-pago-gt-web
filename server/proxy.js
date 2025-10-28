// server/proxy.js
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

const app = express();

// Allow configuring allowed origin via env (defaults to allow all while testing)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '100kb' }));

// Helper to POST to upstream with a timeout and return parsed body (JSON when possible)
async function postToUpstream(url, body, headers = {}) {
  const controller = new AbortController();
  const timeoutMs = 15000; // 15s
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const text = await response.text();
    try {
      return { status: response.status, ok: response.ok, body: JSON.parse(text) };
    } catch {
      return { status: response.status, ok: response.ok, body: text };
    }
  } catch (err) {
    clearTimeout(timeout);
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
      request: {
        url: remoteUrl,
        body: { telefono },
        headers: req.headers
      },
      response: null,
    };

    const result = await postToUpstream(remoteUrl, { telefono });
    logEntry.response = { status: result.status, body: result.body };
    // write log (best-effort)
    try { await fs.writeFile(logFile, JSON.stringify(logEntry, null, 2)); } catch (e) { console.error('Failed to write log file', e); }

    // Forward status and body from upstream
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Proxy error /api/operador:', err && err.message ? err.message : err);
    // attempt to write error log
    try {
      const procesosDir = path.join(process.cwd(), 'src', 'procesos');
      await fs.mkdir(procesosDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const logFile = path.join(procesosDir, `${ts}-${id}-error.json`);
      const logEntry = {
        timestamp: new Date().toISOString(),
        request: { url: remoteUrl, body: { telefono }, headers: req.headers },
        error: err && err.message ? err.message : String(err)
      };
      await fs.writeFile(logFile, JSON.stringify(logEntry, null, 2));
    } catch (e) { console.error('Failed to write error log', e); }
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Upstream request timed out' });
    }
    return res.status(502).json({ error: 'Error contacting upstream', details: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Proxy corriendo en http://localhost:${PORT} (ALLOWED_ORIGIN=${ALLOWED_ORIGIN})`);
});

// --- Configuration helpers ---
async function readConfig() {
  try {
    const cfgPath = path.join(process.cwd(), 'server', 'config', 'credentials.json');
    const raw = await fs.readFile(cfgPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Could not read config credentials.json:', e && e.message ? e.message : e);
    return { Recargas: [] };
  }
}

function buildAuthHeaders(cred = {}) {
  const headers = {};
  if (!cred) return headers;
  if (cred.apiKey) {
    headers['Authorization'] = `Bearer ${cred.apiKey}`;
    headers['x-api-key'] = cred.apiKey;
  } else if (cred.username && cred.password) {
    const token = Buffer.from(`${cred.username}:${cred.password}`).toString('base64');
    headers['Authorization'] = `Basic ${token}`;
  }
  // include any other static headers configured
  if (cred.headers && typeof cred.headers === 'object') {
    Object.assign(headers, cred.headers);
  }
  return headers;
}

async function findConfigEntry(consulta, operadorId) {
  const cfg = await readConfig();
  const list = Array.isArray(cfg.Recargas) ? cfg.Recargas : [];
  // prefer exact match on consulta + operadorId
  let entry = list.find((e) => e.consulta === consulta && String(e.operadorId) === String(operadorId));
  if (entry) return entry;
  // then any with consulta and no operadorId or wildcard
  entry = list.find((e) => e.consulta === consulta && (!e.operadorId || e.operadorId === '*' ))
  if (entry) return entry;
  // then any with consulta
  entry = list.find((e) => e.consulta === consulta);
  return entry || null;
}

// --- New endpoints to orchestrate flows ---
// 1) Obtener operador por teléfono
app.post('/api/operador', async (req, res) => {
  const { telefono } = req.body || {};
  if (!telefono) return res.status(400).json({ error: 'telefono is required in body' });
  const consultaName = 'ObtieneOperadorTelefono';
  const entry = await findConfigEntry(consultaName);
  if (!entry) return res.status(500).json({ error: 'No configuration for ObtieneOperadorTelefono' });

  const headers = buildAuthHeaders(entry.credencial);
  const remoteUrl = entry.url;

  try {
    const procesosDir = path.join(process.cwd(), 'src', 'procesos');
    await fs.mkdir(procesosDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const logFile = path.join(procesosDir, `${ts}-${id}-operador.json`);
    const logEntry = { timestamp: new Date().toISOString(), request: { url: remoteUrl, body: { telefono }, headers: req.headers }, response: null };

    const result = await postToUpstream(remoteUrl, { telefono }, headers);
    logEntry.response = { status: result.status, body: result.body };
    try { await fs.writeFile(logFile, JSON.stringify(logEntry, null, 2)); } catch (e) { console.error('Failed to write log', e); }
    // Determine operator id from upstream response body
    let operatorIdValue = null;
    try {
      const rb = result.body;
      if (rb && typeof rb === 'object' && Object.prototype.hasOwnProperty.call(rb, 'body')) {
        operatorIdValue = rb.body;
      } else if (rb && typeof rb === 'object' && Object.prototype.hasOwnProperty.call(rb, 'ObtieneOperadorTelefonoResult')) {
        operatorIdValue = rb.ObtieneOperadorTelefonoResult;
      } else {
        operatorIdValue = rb;
      }
    } catch (e) {
      operatorIdValue = null;
    }

    const operadorIdStr = operatorIdValue != null ? String(operatorIdValue) : null;

    // If we have an operadorId from the lookup, attempt to fetch products
    // using the configured ObtieneProductos entry for that operador (if present).
    try {
      if (operadorIdStr) {
        const prodEntry = await findConfigEntry('ObtieneProductos', operadorIdStr);
        if (prodEntry) {
          const prodHeaders = buildAuthHeaders(prodEntry.credencial);
          // Call upstream ObtieneProductos with operadorId (payload shape depends on upstream; we use { operadorId })
          const prodResult = await postToUpstream(prodEntry.url, { operadorId: operadorIdStr }, prodHeaders);
          const productsFile = path.join(process.cwd(), 'src', 'procesos', `${operadorIdStr}-productos.json`);
          const productsLog = {
            timestamp: new Date().toISOString(),
            operadorId: operadorIdStr,
            request: { url: prodEntry.url, body: { operadorId: operadorIdStr } },
            response: { status: prodResult.status, body: prodResult.body }
          };
          try { await fs.writeFile(productsFile, JSON.stringify(productsLog, null, 2)); } catch (e) { console.error('Failed to write products file', e); }
        }
      }
    } catch (e) {
      console.error('Error fetching products for operador after operador lookup:', e);
    }

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Error in /api/operador orchestrator:', err);
    return res.status(502).json({ error: 'Error contacting upstream', details: err && err.message });
  }
});

// 2) Obtener productos para un operador
app.post('/api/productos', async (req, res) => {
  const { operadorId } = req.body || {};
  if (!operadorId) return res.status(400).json({ error: 'operadorId is required in body' });
  const consultaName = 'ObtieneProductos';
  const entry = await findConfigEntry(consultaName, operadorId);
  if (!entry) return res.status(500).json({ error: 'No configuration for ObtieneProductos for operadorId' });
  const headers = buildAuthHeaders(entry.credencial);
  const remoteUrl = entry.url;
  try {
    const procesosDir = path.join(process.cwd(), 'src', 'procesos');
    await fs.mkdir(procesosDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const logFile = path.join(procesosDir, `${ts}-${id}-productos.json`);
    const logEntry = { timestamp: new Date().toISOString(), request: { url: remoteUrl, body: { operadorId }, headers: req.headers }, response: null };

    const result = await postToUpstream(remoteUrl, { operadorId }, headers);
    logEntry.response = { status: result.status, body: result.body };
    try { await fs.writeFile(logFile, JSON.stringify(logEntry, null, 2)); } catch (e) { console.error('Failed to write log', e); }
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Error in /api/productos orchestrator:', err);
    return res.status(502).json({ error: 'Error contacting upstream', details: err && err.message });
  }
});

// 3) Ejecutar recarga (carga)
app.post('/api/recarga', async (req, res) => {
  const payload = req.body || {};
  const operadorId = payload.operadorId;
  if (!operadorId) return res.status(400).json({ error: 'operadorId is required in body' });
  const consultaName = 'CargaRecarga';
  const entry = await findConfigEntry(consultaName, operadorId);
  if (!entry) return res.status(500).json({ error: 'No configuration for CargaRecarga for operadorId' });
  const headers = buildAuthHeaders(entry.credencial);
  const remoteUrl = entry.url;
  try {
    const procesosDir = path.join(process.cwd(), 'src', 'procesos');
    await fs.mkdir(procesosDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const logFile = path.join(procesosDir, `${ts}-${id}-recarga.json`);
    const logEntry = { timestamp: new Date().toISOString(), request: { url: remoteUrl, body: payload, headers: req.headers }, response: null };

    const result = await postToUpstream(remoteUrl, payload, headers);
    logEntry.response = { status: result.status, body: result.body };
    try { await fs.writeFile(logFile, JSON.stringify(logEntry, null, 2)); } catch (e) { console.error('Failed to write log', e); }
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Error in /api/recarga orchestrator:', err);
    return res.status(502).json({ error: 'Error contacting upstream', details: err && err.message });
  }
});
