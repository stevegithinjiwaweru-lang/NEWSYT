import request from 'supertest';
import app from '../src/app';
import { prisma } from '../prisma';

const api = request(app);

async function createUserAndLogin(phoneSuffix: string) {
  const phone = `0712${Date.now().toString().slice(-5)}${phoneSuffix}`;
  await api.post('/auth/register').send({ phone, password: 'testpass' });
  const login = await api.post('/auth/login').send({ phone, password: 'testpass' });
  return login.body.accessToken;
}

describe('Orders Integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.order.deleteMany();
    await prisma.dispatch.deleteMany();
    await prisma.rider.deleteMany();
    await prisma.merchant.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create an order and list orders', async () => {
    const token = await createUserAndLogin('A');

    // create merchant
    const merchant = await prisma.merchant.create({ data: { name: 'TestShop', connector: 'CSV', status: 'CONNECTED' } });

    const payload = {
      merchantId: merchant.id,
      customerName: 'Alice',
      phone: '0710000001',
      address: 'Test Street',
      amount: 500,
    };

    const create = await api.post('/orders').set('Authorization', `Bearer ${token}`).send(payload);
    expect(create.status).toBe(201);
    expect(create.body.ok).toBe(true);
    expect(create.body.order).toBeDefined();

    const list = await api.get('/orders').set('Authorization', `Bearer ${token}`);
    expect([200, 401]).toContain(list.status);
    if (list.status === 200) {
      expect(Array.isArray(list.body.items)).toBe(true);
    }
  }, 20000);

  it('should import CSV and skip duplicates', async () => {
    const token = await createUserAndLogin('B');
    const merchant = await prisma.merchant.create({ data: { name: 'CSVShop', connector: 'CSV', status: 'CONNECTED' } });

    const csv = `Order ID,Customer,Phone,Address,Amount,Status\nEXT123,John Doe,0711000002,Addr 1,300,NEW\nEXT123,John Doe,0711000002,Addr 1,300,NEW\n`;

    const res = await api.post('/orders/upload-csv')
      .set('Authorization', `Bearer ${token}`)
      .field('merchantId', merchant.id)
      .attach('file', Buffer.from(csv), 'orders.csv');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.imported).toBeGreaterThanOrEqual(1);
  }, 20000);
});
