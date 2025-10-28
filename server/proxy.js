// server/proxy.js
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import https from 'https';

const app = express();

// Allow configuring allowed origin via env (defaults to allow all while testing)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '100kb' }));

// Helper to POST to upstream with a timeout and return parsed body (JSON when possible)
async function postToUpstream(url, body, headers = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // create agent for HTTPS with optional skip-verify via env SKIP_TLS_VERIFY=true
  const agent = url && url.toLowerCase().startsWith('https')
    ? new https.Agent({ keepAlive: true, rejectUnauthorized: process.env.SKIP_TLS_VERIFY !== 'true' })
    : undefined;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
      agent,
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

async function callUpstream(url, body, headers = {}, method = 'POST') {
  // Supports POST (default) via postToUpstream, and simple GET with query param for operadorId
  if (!method || method.toUpperCase() === 'POST') {
    return await postToUpstream(url, body, headers);
  }
  if (method.toUpperCase() === 'GET') {
    // build query string from body simple keys
    const params = new URLSearchParams();
    if (body && typeof body === 'object') {
      Object.keys(body).forEach(k => {
        if (body[k] !== undefined && body[k] !== null) params.append(k, String(body[k]));
      });
    }
    const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
    const controller = new AbortController();
    const timeoutMs = 15000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(fullUrl, { method: 'GET', headers: { 'Content-Type': 'application/json', ...headers }, signal: controller.signal });
      clearTimeout(timeout);
      const text = await response.text();
      try { return { status: response.status, ok: response.ok, body: JSON.parse(text) }; } catch { return { status: response.status, ok: response.ok, body: text }; }
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
  // fallback to POST
  return await postToUpstream(url, body, headers);
}

// --- configuration helpers ---
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
  if (cred.headers && typeof cred.headers === 'object') Object.assign(headers, cred.headers);
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
        if (!prodEntry) {
          console.error(`No ObtieneProductos entry for operadorId=${operadorIdStr}`);
          try {
            const debugFile = path.join(process.cwd(), 'src', 'procesos', `no-prod-entry-${operadorIdStr}-${Date.now()}.json`);
            await fs.writeFile(debugFile, JSON.stringify({ timestamp: new Date().toISOString(), operadorId: operadorIdStr, message: 'No config entry for ObtieneProductos' }, null, 2));
          } catch (e) { console.error('Failed to write no-prod-entry debug file', e); }
        } else {
          const prodHeaders = buildAuthHeaders(prodEntry.credencial);

          // prepare payload (respect optional template) and method
          let payload = { operadorId: operadorIdStr };
          if (prodEntry.payloadTemplate) {
            try {
              const tpl = typeof prodEntry.payloadTemplate === 'string' ? prodEntry.payloadTemplate : JSON.stringify(prodEntry.payloadTemplate);
              payload = JSON.parse(tpl.replace(/{{\s*operadorId\s*}}/g, operadorIdStr));
            } catch (e) {
              // fallback to default payload
            }
          }
          const method = (prodEntry.method || 'POST').toUpperCase();

          // retry helper for transient network errors (supports custom attempts, timeout and backoff)
          async function callWithRetry(url, body, headers, method, options = {}) {
            const attempts = options.attempts || 2;
            const timeoutMs = options.timeoutMs || 20000;
            const backoffMs = options.backoffMs || 200;
            let lastErr;
            for (let i = 0; i < attempts; i++) {
              try {
                // for POST use postToUpstream so we can pass timeout
                if (!method || method.toUpperCase() === 'POST') {
                  return await postToUpstream(url, body, headers, timeoutMs);
                }
                // otherwise delegate to callUpstream (GET or other)
                return await callUpstream(url, body, headers, method);
              } catch (err) {
                lastErr = err;
                // transient network errors -> retry
                const transient = err && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.name === 'AbortError');
                if (transient && i < attempts - 1) {
                  const delay = backoffMs * Math.pow(2, i);
                  await new Promise(r => setTimeout(r, delay));
                  continue;
                }
                throw err;
              }
            }
            throw lastErr;
          }

          let prodResult = null;
          try {
            const opts = { attempts: operadorIdStr === '3' ? 4 : 2, timeoutMs: operadorIdStr === '3' ? 30000 : 20000, backoffMs: operadorIdStr === '3' ? 500 : 200 };
            prodResult = await callWithRetry(prodEntry.url, payload, prodHeaders, method, opts);
          } catch (e) {
             console.error('Products call failed for operador', operadorIdStr, e && e.message ? e.message : e);
             try { await fs.writeFile(path.join(procesosDir, `productos-error-call-${operadorIdStr}-${Date.now()}.json`), JSON.stringify({ timestamp: new Date().toISOString(), operadorId: operadorIdStr, error: (e && e.message) || String(e) }, null, 2)); } catch (_) {}
             prodResult = null;
           }

          if (!prodResult || prodResult.status < 200 || prodResult.status >= 300 || prodResult.body == null) {
            try { await fs.writeFile(path.join(procesosDir, `productos-debug-${operadorIdStr}-${Date.now()}.json`), JSON.stringify({ timestamp: new Date().toISOString(), operadorId: operadorIdStr, prodEntry, prodResult }, null, 2)); } catch (_) {}
          } else {
            // extract bare products
            let productsOnly = prodResult.body !== undefined ? prodResult.body : prodResult;
            if (productsOnly && typeof productsOnly === 'object') {
              productsOnly = productsOnly.ObtieneProductosResult ?? productsOnly.body ?? productsOnly.d ?? productsOnly;
            }

            // cleanup old product files for this operator
            try {
              const files = await fs.readdir(procesosDir);
              const toRemove = files.filter(fn => {
                if (!fn) return false;
                if (operadorIdStr === '1' && fn === 'productos-claro.json') return true;
                if (operadorIdStr === '3' && fn === 'productos-tigo.json') return true;
                if (fn.includes(operadorIdStr) && fn.toLowerCase().includes('producto')) return true;
                return false;
              });
              await Promise.all(toRemove.map(f => fs.unlink(path.join(procesosDir, f)).catch(() => {})));
            } catch (_) {}

            const targetFile = operadorIdStr === '1'
              ? path.join(procesosDir, 'productos-claro.json')
              : operadorIdStr === '3'
                ? path.join(procesosDir, 'productos-tigo.json')
                : path.join(procesosDir, `${operadorIdStr}-productos.json`);
            try { await fs.writeFile(targetFile, JSON.stringify(productsOnly, null, 2)); } catch (e) { console.error('Failed to write products file', e); }
          }
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

// Test endpoint: directly call configured ObtieneProductos for an operador and return upstream response
app.post('/api/test-productos', async (req, res) => {
  const { operadorId } = req.body || {};
  if (!operadorId) return res.status(400).json({ error: 'operadorId is required in body' });
  const entry = await findConfigEntry('ObtieneProductos', operadorId);
  if (!entry) return res.status(404).json({ error: 'No config for ObtieneProductos for operador' });
  const headers = buildAuthHeaders(entry.credencial);
  const payload = entry.payloadTemplate ? JSON.parse(typeof entry.payloadTemplate === 'string' ? entry.payloadTemplate.replace(/{{\s*operadorId\s*}}/g, operadorId) : JSON.stringify(entry.payloadTemplate).replace(/{{\s*operadorId\s*}}/g, operadorId)) : { operadorId };
  try {
    // use a longer timeout for tests
    const result = await postToUpstream(entry.url, payload, headers, 60000);
    // write debug file
    try { await fs.writeFile(path.join(process.cwd(), 'src', 'procesos', `test-productos-${operadorId}-${Date.now()}.json`), JSON.stringify({ timestamp: new Date().toISOString(), request: { url: entry.url, payload, headers }, response: result }, null, 2)); } catch (e) { console.error('Failed to write test debug file', e); }
    return res.status(200).json({ upstream: result });
  } catch (err) {
    console.error('Test productos call failed:', err && err.message ? err.message : err);
    try { await fs.writeFile(path.join(process.cwd(), 'src', 'procesos', `test-productos-error-${operadorId}-${Date.now()}.json`), JSON.stringify({ timestamp: new Date().toISOString(), request: { url: entry.url, payload, headers }, error: err && err.message ? err.message : String(err) }, null, 2)); } catch (e) {}
    return res.status(502).json({ error: 'Error contacting upstream', details: err && err.message ? err.message : String(err) });
  }
});

// start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Proxy corriendo en http://localhost:${PORT} (ALLOWED_ORIGIN=${ALLOWED_ORIGIN})`);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
