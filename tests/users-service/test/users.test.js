const axios = require('axios');
const Ajv = require('ajv');
const fs = require('fs');
const { expect } = require('chai');

const BASE = process.env.USERS_BASE || process.argv[2] || 'http://localhost:9080';
const client = axios.create({ baseURL: BASE, validateStatus: () => true });

const ajv = new Ajv();
const userSchema = JSON.parse(fs.readFileSync(__dirname + '/../schemas/user.schema.json'));
const totalsSchema = JSON.parse(fs.readFileSync(__dirname + '/../schemas/totals.schema.json'));
const errorSchema = JSON.parse(fs.readFileSync(__dirname + '/../schemas/error.schema.json'));
const validationErrorSchema = JSON.parse(fs.readFileSync(__dirname + '/../schemas/validation-error.schema.json'));

const validateUser = ajv.compile(userSchema);
const validateTotals = ajv.compile(totalsSchema);
const validateError = ajv.compile(errorSchema);
const validateValidationError = ajv.compile(validationErrorSchema);

async function post(url, body) { return (await client.post(url, body)).data ? { status: (await client.post(url, body)).status, data: (await client.post(url, body)).data } : { status: (await client.post(url, body)).status, data: null }; }

describe('Users service acceptance (Mocha)', function() {
  this.timeout(5000);

  it('creates a user and matches user schema', async () => {
    const payload = { email: `testuser+1+${Date.now()}@example.org`, name: 'Test User 1' };
    const resp = await client.post('/api/users', payload);
    expect(resp.status).to.equal(201);
    expect(validateUser(resp.data), JSON.stringify(validateUser.errors)).to.be.true;
    expect(resp.data.email).to.equal(payload.email);
  });

  it('duplicate create returns 409 with error schema', async () => {
    const payload = { email: 'dup@example.org', name: 'Dup User' };
    await client.post('/api/users', payload);
    const resp = await client.post('/api/users', payload);
    expect(resp.status).to.equal(409);
    expect(validateError(resp.data), JSON.stringify(validateError.errors)).to.be.true;
    expect((resp.data.message || '').toLowerCase()).to.include('email');
  });

  it('returns 400 validation error for missing email and contains field error', async () => {
    const invalid = { name: '' };
    const resp = await client.post('/api/users', invalid);
    expect(resp.status).to.equal(400);
    expect(validateValidationError(resp.data), JSON.stringify(validateValidationError.errors)).to.be.true;
    expect(Array.isArray(resp.data.errors)).to.be.true;
    const hasEmail = resp.data.errors.some(e => e.field && e.field.toLowerCase() === 'email');
    expect(hasEmail).to.be.true;
  });

  it('invalid email format returns 400 with email field error', async () => {
    const invalid = { email: 'not-an-email', name: 'Invalid' };
    const resp = await client.post('/api/users', invalid);
    expect(resp.status).to.equal(400);
    expect(validateValidationError(resp.data)).to.be.true;
    const hasEmail = resp.data.errors.some(e => e.field && e.field.toLowerCase() === 'email');
    expect(hasEmail).to.be.true;
  });

  it('lists users and each item matches user schema', async () => {
    const resp = await client.get('/api/users');
    expect(resp.status).to.equal(200);
    const items = Array.isArray(resp.data) ? resp.data : [resp.data];
    expect(items.length).to.be.greaterThan(0);
    for (const it of items) expect(validateUser(it), JSON.stringify(validateUser.errors)).to.be.true;
  });

  it('update to duplicate email returns 409 with error schema', async () => {
    const a = { email: `uniqueA+${Date.now()}@example.org`, name: 'A' };
    const b = { email: `uniqueB+${Date.now()}@example.org`, name: 'B' };
    const ra = await client.post('/api/users', a); expect(ra.status).to.equal(201);
    const rb = await client.post('/api/users', b); expect(rb.status).to.equal(201);
    const bid = rb.data.id;
    const upd = await client.put(`/api/users/${bid}`, { email: ra.data.email, name: 'B new' });
    expect(upd.status).to.equal(409);
    expect(validateError(upd.data)).to.be.true;
  });

  it('successful update returns updated user matching schema', async () => {
    const u = { email: `to-update+${Date.now()}@example.org`, name: 'Before' };
    const cr = await client.post('/api/users', u); expect(cr.status).to.equal(201);
    const id = cr.data.id;
    const up = await client.put(`/api/users/${id}`, { email: u.email, name: 'After' });
    expect(up.status).to.equal(200);
    expect(validateUser(up.data)).to.be.true;
    expect(up.data.name).to.equal('After');
  });

  it('totals endpoint returns expected totals for seeded user', async () => {
    // requires seed_totals.sql applied
    const list = await client.get('/api/users', { params: { email: 'u1@example.org' } });
    expect(list.status).to.equal(200);
    const id = Array.isArray(list.data) ? list.data[0].id : list.data.id;
    expect(id).to.exist;
    const totals = await client.get(`/api/users/${id}/totals`);
    expect(totals.status).to.equal(200);
    expect(validateTotals(totals.data)).to.be.true;
    expect(Math.abs((totals.data.totalHours || totals.data.hours) - 3.75)).to.be.lessThan(0.01);
    expect(Math.abs((totals.data.totalRevenue || totals.data.revenue) - 437.5)).to.be.lessThan(0.1);
  });

  it('delete prevented when billable_hours exist (returns 409)', async () => {
    const list = await client.get('/api/users', { params: { email: 'u1@example.org' } });
    expect(list.status).to.equal(200);
    const id = Array.isArray(list.data) ? list.data[0].id : list.data.id;
    const del = await client.delete(`/api/users/${id}`);
    expect(del.status).to.equal(409);
    expect(validateError(del.data)).to.be.true;
  });
});
