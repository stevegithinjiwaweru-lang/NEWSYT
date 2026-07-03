import request from 'supertest';
import app from '../src/app';
import { prisma } from '../prisma';

const api = request(app);

async function createAdminAndToken() {
  const phone = `0709${Date.now().toString().slice(-6)}`;
  await api.post('/auth/register').send({ phone, password: 'adminpass' });
  const login = await api.post('/auth/login').send({ phone, password: 'adminpass' });
  return login.body.accessToken;
}

describe('Riders Integration', () => {
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

  it('create, list, update and delete rider', async () => {
    const token = await createAdminAndToken();

    const create = await api.post('/riders').set('Authorization', `Bearer ${token}`).send({ name: 'RiderOne', phone: '0712000001', bikeReg: 'KAA 111A' });
    expect(create.status).toBe(201);
    expect(create.body.ok).toBe(true);
    const riderId = create.body.rider.id;

    const list = await api.get('/riders').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.count).toBeGreaterThanOrEqual(1);

    const patch = await api.patch(`/riders/${riderId}`).set('Authorization', `Bearer ${token}`).send({ branch: 'North' });
    expect(patch.status).toBe(200);
    expect(patch.body.ok).toBe(true);

    const del = await api.delete(`/riders/${riderId}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
  }, 20000);
});
