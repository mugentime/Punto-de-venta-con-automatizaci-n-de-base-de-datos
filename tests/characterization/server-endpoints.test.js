// Characterization tests for server.js's full endpoint surface, run against
// a live in-memory-mode instance (no DATABASE_URL). See helpers.js for why
// these use shape snapshots instead of exact-value snapshots.
//
// Scope: this locks in CURRENT behavior, bugs included. Two endpoints below
// (POST/PUT/DELETE /api/coworking-sessions) are known-broken in this mode -
// see the architecture audit's "DB/file dual-path duplication" finding. The
// test for them asserts the current 500, with a comment explaining why. When
// Phase 3 (collapsing the useDb branch into a repository) fixes this, that
// assertion is the thing that should change - on purpose, not by accident.
//
// The AI endpoints (generate-description, generate-image) call real external
// services on their success path. Only their input-validation branch (missing
// productName) is covered here; the network-dependent path is out of scope
// for a fast, deterministic test suite.

const { startServer, request, shapeOf } = require('./helpers');

const PORT = 3991;
let server;

beforeAll(async () => {
  server = await startServer(PORT);
}, 20000);

afterAll(() => {
  server?.stop();
});

const get = (p) => request(server.baseUrl, 'GET', p);
const post = (p, b) => request(server.baseUrl, 'POST', p, b);
const put = (p, b) => request(server.baseUrl, 'PUT', p, b);
const del = (p) => request(server.baseUrl, 'DELETE', p);

describe('health', () => {
  test('GET /api/health reports in-memory mode', async () => {
    const { status, body } = await get('/api/health');
    expect(status).toBe(200);
    expect(body).toEqual({ status: 'ok', database: 'in-memory' });
  });
});

describe('products (stateful - order matters, shares the seeded in-memory array)', () => {
  let createdId;

  test('GET /api/products returns the 10 seeded products', async () => {
    const { status, body } = await get('/api/products');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(10);
    expect(shapeOf(body)).toMatchSnapshot();
  });

  test('POST /api/products creates a product in memory', async () => {
    const { status, body } = await post('/api/products', {
      name: 'Characterization Test Product',
      price: 10,
      cost: 5,
      stock: 1,
      description: 'temp',
      imageUrl: 'https://example.com/x.png',
      category: 'Test',
    });
    expect(status).toBe(201);
    expect(shapeOf(body)).toMatchSnapshot();
    createdId = body.id;
  });

  test('PUT /api/products/:id updates the created product', async () => {
    const { status, body } = await put(`/api/products/${createdId}`, { price: 20 });
    expect(status).toBe(200);
    expect(body.price).toBe(20);
    expect(shapeOf(body)).toMatchSnapshot();
  });

  test('PUT /api/products/:id with an unknown id returns 404', async () => {
    const { status, body } = await put('/api/products/does-not-exist', { price: 1 });
    expect(status).toBe(404);
    expect(body).toEqual({ error: 'Product not found' });
  });

  test('DELETE /api/products/:id removes the created product', async () => {
    const { status } = await del(`/api/products/${createdId}`);
    expect(status).toBe(204);
  });

  test('DELETE /api/products/:id on an already-deleted id still returns 204 (not idempotency-checked)', async () => {
    const { status } = await del(`/api/products/${createdId}`);
    expect(status).toBe(204);
  });

  test('GET /api/products is back to 10 after create+delete', async () => {
    const { body } = await get('/api/products');
    expect(body.length).toBe(10);
  });

  test('POST /api/products/import upserts by name in memory', async () => {
    const { status, body } = await post('/api/products/import', [
      { name: 'Espresso Americano', price: 40, cost: 12, stock: 90, description: 'updated', imageUrl: 'x', category: 'Cafetería' },
    ]);
    expect(status).toBe(200);
    expect(shapeOf(body)).toMatchSnapshot();
  });

  test('POST /api/products/increase-prices requires a database', async () => {
    const { status, body } = await post('/api/products/increase-prices', {});
    expect(status).toBe(400);
    expect(body).toEqual({ error: 'Database not connected' });
  });

  test('POST /api/products/update-stock works in memory (goes through productStore, not raw pool)', async () => {
    const { body: products } = await get('/api/products');
    const target = products[0];
    const { status, body } = await post('/api/products/update-stock', {
      items: [{ id: target.id, quantity: 1 }],
    });
    expect(status).toBe(200);
    expect(body).toEqual({ message: 'Stock updated successfully' });
  });
});

describe('orders', () => {
  test('GET /api/orders returns an empty array without a database', async () => {
    const { status, body } = await get('/api/orders');
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  test('POST /api/orders creates an order in memory', async () => {
    const { status, body } = await post('/api/orders', {
      clientName: 'Test Client',
      serviceType: 'Cafetería',
      paymentMethod: 'Efectivo',
      items: [{ id: '1', name: 'Espresso', price: 35, cost: 12, quantity: 1 }],
      subtotal: 35,
      total: 35,
      userId: 'user-1',
    });
    expect(status).toBe(201);
    expect(shapeOf(body)).toMatchSnapshot();
  });

  test('DELETE /api/orders/:id requires a database', async () => {
    const { status, body } = await del('/api/orders/anything');
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });

  test('POST /api/orders/cleanup-duplicates requires a database', async () => {
    const { status, body } = await post('/api/orders/cleanup-duplicates', {});
    expect(status).toBe(500);
    expect(body).toEqual({ error: 'Database mode only' });
  });
});

describe('expenses', () => {
  test('GET /api/expenses returns an empty array without a database', async () => {
    const { status, body } = await get('/api/expenses');
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  test('POST /api/expenses requires a database', async () => {
    const { status, body } = await post('/api/expenses', { description: 'x', amount: 1, category: 'y' });
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });

  test('PUT /api/expenses/:id requires a database', async () => {
    const { status, body } = await put('/api/expenses/x', {});
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });

  test('DELETE /api/expenses/:id requires a database', async () => {
    const { status, body } = await del('/api/expenses/x');
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });
});

describe('coworking sessions (KNOWN BUG - see architecture audit)', () => {
  test('GET /api/coworking-sessions falls back to the file-based store and returns an array', async () => {
    const { status, body } = await get('/api/coworking-sessions');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test('KNOWN BUG: POST /api/coworking-sessions has no useDb guard and 500s without a database', async () => {
    const { status, body } = await post('/api/coworking-sessions', {
      clientName: 'Test',
      startTime: new Date().toISOString(),
      hourlyRate: 50,
    });
    expect(status).toBe(500);
    expect(body).toEqual({ error: 'Failed to create coworking session' });
  });

  test('KNOWN BUG: PUT /api/coworking-sessions/:id has no useDb guard and 500s without a database', async () => {
    const { status, body } = await put('/api/coworking-sessions/anything', { status: 'finished' });
    expect(status).toBe(500);
    expect(body).toEqual({ error: 'Failed to update coworking session' });
  });

  test('KNOWN BUG: DELETE /api/coworking-sessions/:id has no useDb guard and 500s without a database', async () => {
    const { status, body } = await del('/api/coworking-sessions/anything');
    expect(status).toBe(500);
    expect(body).toEqual({ error: 'Failed to delete coworking session' });
  });
});

describe('cash sessions', () => {
  test('GET /api/cash-sessions returns an empty array without a database', async () => {
    const { status, body } = await get('/api/cash-sessions');
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  test('POST /api/cash-sessions requires a database', async () => {
    const { status, body } = await post('/api/cash-sessions', { startAmount: 100 });
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });

  test('PUT /api/cash-sessions/:id requires a database', async () => {
    const { status, body } = await put('/api/cash-sessions/x', {});
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });
});

describe('cash withdrawals', () => {
  test('GET /api/cash-withdrawals returns an empty array without a database', async () => {
    const { status, body } = await get('/api/cash-withdrawals');
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  test('GET /api/cash-withdrawals/session/:sessionId returns an empty array without a database', async () => {
    const { status, body } = await get('/api/cash-withdrawals/session/x');
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  test('POST /api/cash-withdrawals requires a database', async () => {
    const { status, body } = await post('/api/cash-withdrawals', { cashSessionId: 'x', amount: 1 });
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });

  test('DELETE /api/cash-withdrawals/:id requires a database', async () => {
    const { status, body } = await del('/api/cash-withdrawals/x');
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });
});

describe('users', () => {
  test('GET /api/users returns an empty array without a database', async () => {
    const { status, body } = await get('/api/users');
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  test('POST /api/users requires a database', async () => {
    const { status, body } = await post('/api/users', { username: 'x', email: 'x@x.com', password: 'x' });
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });

  test('PUT /api/users/:id requires a database', async () => {
    const { status, body } = await put('/api/users/x', {});
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });

  test('DELETE /api/users/:id requires a database', async () => {
    const { status, body } = await del('/api/users/x');
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });
});

describe('customers (INCONSISTENT with other resources - 503 on GET, not an empty array)', () => {
  test('GET /api/customers requires a database (unlike orders/expenses/users, which return [])', async () => {
    const { status, body } = await get('/api/customers');
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });

  test('POST /api/customers requires a database', async () => {
    const { status, body } = await post('/api/customers', { name: 'x' });
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });

  test('PUT /api/customers/:id requires a database', async () => {
    const { status, body } = await put('/api/customers/x', {});
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });

  test('DELETE /api/customers/:id requires a database', async () => {
    const { status, body } = await del('/api/customers/x');
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });

  test('GET /api/customers/:id/credits requires a database', async () => {
    const { status, body } = await get('/api/customers/x/credits');
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });

  test('POST /api/customers/:id/credits requires a database', async () => {
    const { status, body } = await post('/api/customers/x/credits', { amount: 1, type: 'charge' });
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });

  test('PUT /api/customer-credits/:id requires a database', async () => {
    const { status, body } = await put('/api/customer-credits/x', { status: 'paid' });
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Database not available' });
  });
});

describe('admin endpoints (ADMIN_SECRET_KEY unset -> disabled by default)', () => {
  test('POST /api/admin/fix-coworking-totals is disabled without ADMIN_SECRET_KEY', async () => {
    const { status, body } = await post('/api/admin/fix-coworking-totals', {});
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Admin endpoints disabled: configure ADMIN_SECRET_KEY in environment.' });
  });

  test('POST /api/admin/optimize-database is disabled without ADMIN_SECRET_KEY', async () => {
    const { status, body } = await post('/api/admin/optimize-database', {});
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Admin endpoints disabled: configure ADMIN_SECRET_KEY in environment.' });
  });

  test('POST /api/admin/add-customerId-column is disabled without ADMIN_SECRET_KEY', async () => {
    const { status, body } = await post('/api/admin/add-customerId-column', {});
    expect(status).toBe(503);
    expect(body).toEqual({ error: 'Admin endpoints disabled: configure ADMIN_SECRET_KEY in environment.' });
  });
});

describe('AI endpoints (validation branch only - success path calls real external services)', () => {
  test('POST /api/generate-description requires productName', async () => {
    const { status, body } = await post('/api/generate-description', {});
    expect(status).toBe(400);
    expect(body).toEqual({ error: 'productName is required' });
  });

  test('POST /api/generate-image requires productName', async () => {
    const { status, body } = await post('/api/generate-image', {});
    expect(status).toBe(400);
    expect(body).toEqual({ error: 'productName is required' });
  });
});

describe('SPA catch-all', () => {
  test('an unmatched path falls through to dist/index.html, not a 404', async () => {
    const { status, contentType } = await get('/some-completely-unknown-path');
    expect(status).toBe(200);
    expect(contentType).toContain('text/html');
  });
});
