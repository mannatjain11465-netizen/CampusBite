import request from 'supertest';
import { createApp } from '../../server/app.ts';
import { resetDbInstanceForTest } from '../../server/db/database.ts';
import { seedDatabase } from '../../server/db/seed.ts';

describe('CampusBite API Integration Tests', () => {
  let app: ReturnType<typeof createApp>;
  let studentToken = '';
  let vendor1Token = '';
  let vendor2Token = '';
  let adminToken = '';

  beforeAll(async () => {
    const db = resetDbInstanceForTest(':memory:');
    seedDatabase(db);
    app = createApp({ skipSeed: true });

    const [stuRes, v1Res, v2Res, admRes] = await Promise.all([
      request(app)
        .post('/api/auth/login')
        .send({ email: 'aarav@student.edu', password: 'Campus@123' }),
      request(app)
        .post('/api/auth/login')
        .send({ email: 'grill@campusbite.edu', password: 'Campus@123' }),
      request(app)
        .post('/api/auth/login')
        .send({ email: 'dosa@campusbite.edu', password: 'Campus@123' }),
      request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@campusbite.edu', password: 'Campus@123' }),
    ]);

    studentToken = stuRes.body.token;
    vendor1Token = v1Res.body.token;
    vendor2Token = v2Res.body.token;
    adminToken = admRes.body.token;
  });

  test('IT-01: GET /api/health returns service ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('IT-02: Student registration succeeds and blocks duplicate emails', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Karan Mehta',
      email: 'karan@student.edu',
      password: 'Password123',
      campusId: 'BT2025099',
      phone: '9898989898',
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.user.role).toBe('student');

    const dupRes = await request(app).post('/api/auth/register').send({
      name: 'Karan Duplicate',
      email: 'karan@student.edu',
      password: 'Password123',
      campusId: 'BT2025100',
      phone: '9898989899',
    });
    expect(dupRes.status).toBe(409);
  });

  test('IT-03: Enforces strict Role-Based Access Control across student, vendor, and admin routes', async () => {
    const stuAdminRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(stuAdminRes.status).toBe(403);

    const stuVendorRes = await request(app)
      .get('/api/inventory/vendor')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(stuVendorRes.status).toBe(403);

    const vendorAdminRes = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${vendor1Token}`);
    expect(vendorAdminRes.status).toBe(403);

    // Vendor 2 must not edit Vendor 1's item (itm_1 belongs to stl_1 / vendor 1)
    const crossVendorEdit = await request(app)
      .patch('/api/menu/itm_1')
      .set('Authorization', `Bearer ${vendor2Token}`)
      .send({ price: 999 });
    expect(crossVendorEdit.status).toBe(403);
  });

  test('IT-04: Atomic order placement deducts stock, prevents duplicate deduction via idempotencyKey, and rejects overselling', async () => {
    const beforeMenu = await request(app).get('/api/menu');
    const burgerBefore = beforeMenu.body.items.find((i: { id: string }) => i.id === 'itm_1');
    const initialStock = burgerBefore.stock_qty;

    const idemKey = 'test-idem-key-001';
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        items: [{ menuItemId: 'itm_1', quantity: 2 }],
        pickupTime: 'ASAP (15 mins)',
        paymentMethod: 'UPI (Simulated)',
        idempotencyKey: idemKey,
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.orders).toHaveLength(1);
    expect(orderRes.body.orders[0].status).toBe('Placed');
    expect(orderRes.body.orders[0].payment_status).toBe('Paid (Simulated)');

    // Duplicate retry with same idempotencyKey must NOT deduct stock twice
    const retryRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        items: [{ menuItemId: 'itm_1', quantity: 2 }],
        pickupTime: 'ASAP (15 mins)',
        paymentMethod: 'UPI (Simulated)',
        idempotencyKey: idemKey,
      });
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.deduplicated).toBe(true);

    const afterMenu = await request(app).get('/api/menu');
    const burgerAfter = afterMenu.body.items.find((i: { id: string }) => i.id === 'itm_1');
    expect(burgerAfter.stock_qty).toBe(initialStock - 2);

    // Ordering more than available stock (within per-line cap 50) fails cleanly with 409
    const overStockRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        items: [{ menuItemId: 'itm_1', quantity: burgerAfter.stock_qty + 5 }],
        pickupTime: 'ASAP (15 mins)',
        paymentMethod: 'UPI (Simulated)',
      });
    expect(overStockRes.status).toBe(409);

    // Ordering absurd quantity > 50 fails Zod schema validation with 400
    const schemaCapRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        items: [{ menuItemId: 'itm_1', quantity: 999 }],
        pickupTime: 'ASAP (15 mins)',
        paymentMethod: 'UPI (Simulated)',
      });
    expect(schemaCapRes.status).toBe(400);
  });

  test('IT-05: Student cancellation restores stock and refunds simulated payment; Preparing order cannot be cancelled', async () => {
    const menuBefore = await request(app).get('/api/menu');
    const dosaBefore = menuBefore.body.items.find((i: { id: string }) => i.id === 'itm_4');

    const createRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        items: [{ menuItemId: 'itm_4', quantity: 3 }],
        pickupTime: '01:15 PM',
        paymentMethod: 'Campus Wallet (Simulated)',
      });
    expect(createRes.status).toBe(201);
    const createdOrderId = createRes.body.orders[0].id;

    // Cancel while Placed
    const cancelRes = await request(app)
      .post(`/api/orders/${createdOrderId}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ reason: 'Class rescheduled' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.order.status).toBe('Cancelled');
    expect(cancelRes.body.order.payment_status).toBe('Refunded (Simulated)');

    const menuAfter = await request(app).get('/api/menu');
    const dosaAfter = menuAfter.body.items.find((i: { id: string }) => i.id === 'itm_4');
    expect(dosaAfter.stock_qty).toBe(dosaBefore.stock_qty);

    // Place another order and advance to Preparing -> cancellation must be blocked
    const secondOrderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        items: [{ menuItemId: 'itm_4', quantity: 1 }],
        pickupTime: '04:00 PM',
        paymentMethod: 'UPI (Simulated)',
      });
    const secondId = secondOrderRes.body.orders[0].id;

    await request(app)
      .patch(`/api/orders/${secondId}/status`)
      .set('Authorization', `Bearer ${vendor2Token}`)
      .send({ status: 'Accepted' });
    await request(app)
      .patch(`/api/orders/${secondId}/status`)
      .set('Authorization', `Bearer ${vendor2Token}`)
      .send({ status: 'Preparing' });

    const lateCancel = await request(app)
      .post(`/api/orders/${secondId}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});
    expect(lateCancel.status).toBe(409);
  });

  test('IT-06: Vendor restock updates inventory and Admin can export CSV reports', async () => {
    const restockRes = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', `Bearer ${vendor1Token}`)
      .send({ menuItemId: 'itm_2', quantity: 15, note: 'Afternoon batch' });
    expect(restockRes.status).toBe(200);
    expect(restockRes.body.addedQty).toBe(15);

    const csvRes = await request(app)
      .get('/api/admin/reports/export?type=orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('Order Code');
  });
});
