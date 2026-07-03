import request from 'supertest';
import app from '../src/app';
import { prisma } from '../prisma';

const api = request(app);

describe('Auth Integration', () => {
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

  it('register -> login -> me -> refresh -> logout', async () => {
    // register
    const phone = `0701${Date.now().toString().slice(-6)}`;
    const reg = await api.post('/auth/register').send({ phone, password: 'testpass' });
    expect(reg.status).toBe(201);
    expect(reg.body.ok).toBe(true);
    const userId = reg.body.user.id;

    // login
    const login = await api.post('/auth/login').send({ phone, password: 'testpass' });
    expect(login.status).toBe(200);
    expect(login.body.ok).toBe(true);
    const { accessToken, refreshToken } = login.body;
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();

    // me
    const me = await api.get('/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.ok).toBe(true);
    expect(me.body.user.id).toBe(userId);

    // refresh
    const ref = await api.post('/auth/refresh').send({ refreshToken });
    expect(ref.status).toBe(200);
    expect(ref.body.ok).toBe(true);
    expect(ref.body.accessToken).toBeDefined();
    expect(ref.body.refreshToken).toBeDefined();

    // logout
    const out = await api.post('/auth/logout').send({ refreshToken: ref.body.refreshToken });
    expect(out.status).toBe(200);
    expect(out.body.ok).toBe(true);
  }, 20000);
});
