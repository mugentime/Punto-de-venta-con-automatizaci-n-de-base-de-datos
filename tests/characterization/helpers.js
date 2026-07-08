// Shared helpers for characterization tests (Phase 1 of the architecture cleanup).
//
// These tests spawn the REAL server.js as a child process and hit it over real
// HTTP, in in-memory mode (DATABASE_URL unset) so they never touch a real
// database. The goal isn't "is this endpoint correct" - it's "does this
// endpoint's behavior stay the same as later refactor phases (route
// extraction, collapsing the useDb branch, etc.) move the code around."
//
// A snapshot going red during a later phase is the signal that phase changed
// observable behavior - which then needs a conscious decision (intentional
// fix vs. accidental regression), not a silent surprise.

const { spawn } = require('child_process');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');

/**
 * Boots a fresh server.js instance on its own port with its own env.
 * Returns { baseUrl, stop() } - callers must call stop() in afterAll.
 */
function startServer(port, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['server.js'], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        DATABASE_URL: '', // force in-memory mode; empty string wins over dotenv's .env fallback
        ADMIN_SECRET_KEY: '', // exercise the "admin endpoints disabled" default
        FALLBACK_ADMIN_USERNAME: '',
        FALLBACK_ADMIN_PASSWORD: '',
        FALLBACK_ADMIN_EMAIL: '',
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error(`server.js on port ${port} did not become ready within 15s`));
      }
    }, 15000);

    let stderrBuf = '';
    child.stderr.on('data', (d) => { stderrBuf += d.toString(); });

    child.stdout.on('data', (data) => {
      if (!settled && data.toString().includes('Server listening on port')) {
        settled = true;
        clearTimeout(timeout);
        resolve({
          baseUrl: `http://localhost:${port}`,
          stop: () => child.kill(),
        });
      }
    });

    child.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    child.on('exit', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`server.js on port ${port} exited early (code ${code}). stderr:\n${stderrBuf}`));
      }
    });
  });
}

/** Minimal fetch wrapper that always resolves with {status, body}. */
async function request(baseUrl, method, urlPath, body) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  let parsedBody = text;
  if (contentType.includes('application/json') && text) {
    try { parsedBody = JSON.parse(text); } catch { /* leave as text */ }
  }
  return { status: res.status, contentType, body: parsedBody };
}

/**
 * Describes the STRUCTURE of a value (types + sorted keys), not its exact
 * data. This is deliberately looser than a raw snapshot: generated ids,
 * timestamps, and Date.now()-based values would make an exact-value
 * snapshot flaky (fails every run for the wrong reason). A shape snapshot
 * still catches what actually matters for a safe refactor: a field
 * disappearing, a type changing, an array turning into an object, etc.
 */
function shapeOf(value) {
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      itemShape: value.length > 0 ? shapeOf(value[0]) : null,
    };
  }
  if (value === null) return { type: 'null' };
  if (typeof value === 'object') {
    const keys = {};
    for (const key of Object.keys(value).sort()) {
      keys[key] = shapeOf(value[key]);
    }
    return { type: 'object', keys };
  }
  return { type: typeof value };
}

module.exports = { startServer, request, shapeOf };
