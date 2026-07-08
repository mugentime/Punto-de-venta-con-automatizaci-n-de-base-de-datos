// Dedicated tests for the in-memory-mode login fallback. Split out from
// server-endpoints.test.js because it needs its own server instance with
// FALLBACK_ADMIN_* env vars set, to exercise the path that used to hardcode
// a real credential in source (see the "security: remove hardcoded fallback
// login credential" commit). This is the regression test for that fix:
// if someone reintroduces a hardcoded default here, this suite doesn't
// itself prevent it, but it does lock in that login is env-var-gated and
// fails closed when those vars are absent.

const { startServer, request } = require('./helpers');

const PORT = 3992;
let serverWithFallback;
let serverWithoutFallback;

beforeAll(async () => {
  [serverWithFallback, serverWithoutFallback] = await Promise.all([
    startServer(PORT, {
      FALLBACK_ADMIN_USERNAME: 'char-test-admin',
      FALLBACK_ADMIN_PASSWORD: 'char-test-pass-123',
      FALLBACK_ADMIN_EMAIL: 'char-test@example.com',
    }),
    startServer(PORT + 1), // no fallback env vars set at all
  ]);
}, 20000);

afterAll(() => {
  serverWithFallback?.stop();
  serverWithoutFallback?.stop();
});

describe('login fallback is disabled by default (fails closed)', () => {
  test('POST /api/login returns 503 when no database and no fallback creds are configured', async () => {
    const { status, body } = await request(serverWithoutFallback.baseUrl, 'POST', '/api/login', {
      username: 'anyone',
      password: 'anything',
    });
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'No hay base de datos configurada y no hay credenciales de respaldo definidas.' });
  });
});

describe('login fallback works once explicitly configured via env vars', () => {
  test('correct username + password succeeds', async () => {
    const { status, body } = await request(serverWithFallback.baseUrl, 'POST', '/api/login', {
      username: 'char-test-admin',
      password: 'char-test-pass-123',
    });
    expect(status).toBe(200);
    expect(body).toEqual({
      id: 'fallback-admin',
      username: 'char-test-admin',
      email: 'char-test@example.com',
      role: 'admin',
      status: 'approved',
    });
  });

  test('username is case-insensitive', async () => {
    const { status, body } = await request(serverWithFallback.baseUrl, 'POST', '/api/login', {
      username: 'CHAR-TEST-ADMIN',
      password: 'char-test-pass-123',
    });
    expect(status).toBe(200);
    expect(body.username).toBe('char-test-admin');
  });

  test('wrong username returns 401', async () => {
    const { status, body } = await request(serverWithFallback.baseUrl, 'POST', '/api/login', {
      username: 'someone-else',
      password: 'char-test-pass-123',
    });
    expect(status).toBe(401);
    expect(body).toEqual({ error: 'Usuario no encontrado.' });
  });

  test('wrong password returns 401', async () => {
    const { status, body } = await request(serverWithFallback.baseUrl, 'POST', '/api/login', {
      username: 'char-test-admin',
      password: 'wrong-password',
    });
    expect(status).toBe(401);
    expect(body).toEqual({ error: 'Contraseña incorrecta.' });
  });
});
