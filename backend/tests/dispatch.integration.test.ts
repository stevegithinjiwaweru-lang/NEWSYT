import request from 'supertest';
import app from '../src/app';
import { prisma } from '../prisma';

const api = request(app);

async function createUserAndToken() {
  const phone = `0718${Date.now().toString().slice(-6)}`;
  await api.post('/auth/register').send({ phone, password: 'dispatchpass' });
  const login = await api.post('/auth/login').send({ phone, password: 'dispatchpass' });
  return login.body.accessToken;
}

describe('Dispatch Integration', () => {
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

  it('create and assign dispatch', async () => {
    const token = await createUserAndToken();
    const dispatchCreate = await api.post('/v1/dispatches').set('Authorization', `Bearer ${token}`).send({ orderReference: 'ORD123' });
    expect(dispatchCreate.status).toBe(201);
    expect(dispatchCreate.body.ok).toBe(true);
    const dispatchId = dispatchCreate.body.dispatch.id;

    const rider = await api.post('/riders').set('Authorization', `Bearer ${token}`).send({ name: 'DispatchRider', phone: '0715000001' });
    const riderId = rider.body.rider.id;

    const assign = await api.post(`/v1/dispatches/${dispatchId}/assign`).set('Authorization', `Bearer ${token}`).send({ riderId });
    expect(assign.status).toBe(200);
    expect(assign.body.ok).toBe(true);
  }, 20000);
});
