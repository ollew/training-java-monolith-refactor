const axios = require('axios');
const Ajv = require('ajv');
const fs = require('fs');

const BASE = process.env.USERS_BASE || process.argv[2] || 'http://localhost:9080';
axios.defaults.baseURL = BASE;

// Load schemas
const ajv = new Ajv();
const userSchema = JSON.parse(fs.readFileSync(__dirname + '/schemas/user.schema.json'));
const totalsSchema = JSON.parse(fs.readFileSync(__dirname + '/schemas/totals.schema.json'));
const errorSchema = JSON.parse(fs.readFileSync(__dirname + '/schemas/error.schema.json'));
const validationErrorSchema = JSON.parse(fs.readFileSync(__dirname + '/schemas/validation-error.schema.json'));
const validateUser = ajv.compile(userSchema);
const validateTotals = ajv.compile(totalsSchema);
const validateError = ajv.compile(errorSchema);
const validateValidationError = ajv.compile(validationErrorSchema);

function ok(msg){ console.log('[PASS] ' + msg); }
function fail(msg){ console.error('[FAIL] ' + msg); process.exitCode = 2; }

function approxEqual(a,b,eps=1e-6){ return Math.abs(a-b) <= eps }

async function tryRequest(promise){
  try{
    const r = await promise;
    return { ok: true, status: r.status, data: r.data };
  } catch(e){
    if (e.response) return { ok: false, status: e.response.status, data: e.response.data };
    throw e;
  }
}

async function run(){
  console.log('Running Node.js users-service acceptance tests against', BASE);

  // Test 1: Create user
  const createPayload = { email: 'testuser+1@example.org', name: 'Test User 1' };
  let res = await tryRequest(axios.post('/api/users', createPayload));
  if (res.ok && res.status === 201 && res.data && res.data.email === createPayload.email) {
    // JSON Schema validation
    if (validateUser(res.data)) ok('Create user and response matches schema');
    else fail('Create user - response did not match user schema: ' + JSON.stringify(validateUser.errors));
  } else {
    fail('Create user - unexpected response: ' + JSON.stringify(res));
  }

  // Test 2: Duplicate create (expect 409)
  const dupPayload = { email: 'dup@example.org', name: 'Dup User' };
  // Ensure first exists
  await tryRequest(axios.post('/api/users', dupPayload));
  res = await tryRequest(axios.post('/api/users', dupPayload));
  if (!res.ok && res.status === 409) {
    // Validate error shape
    if (validateError(res.data)) {
      const msg = res.data && (res.data.message || res.data.error || JSON.stringify(res.data));
      if ((msg || '').toString().toLowerCase().includes('email')) {
        ok('Duplicate create returned 409 with friendly message and valid error schema');
      } else {
        ok('Duplicate create returned 409 with valid error schema (message did not include "email")');
      }
    } else {
      fail('Duplicate create returned 409 but error response did not match schema: ' + JSON.stringify(validateError.errors));
    }
  } else {
    fail('Duplicate create - expected 409, got ' + JSON.stringify(res));
  }

  // Test: create with invalid payload -> expect 400 and structured validation error
  const invalidPayload = { name: '' }; // missing/invalid email
  const invalidRes = await tryRequest(axios.post('/api/users', invalidPayload));
  if (!invalidRes.ok && invalidRes.status === 400) {
    if (validateValidationError(invalidRes.data)) ok('Validation error returned 400 and matches validation-error schema');
    else fail('Validation error 400 but did not match schema: ' + JSON.stringify(validateValidationError.errors));
  } else {
    fail('Expected 400 validation error for invalid create payload, got: ' + JSON.stringify(invalidRes));
  }

  // Additionally assert there is a field-level error for 'email'
  try {
    const errs = invalidRes.data && invalidRes.data.errors;
    if (Array.isArray(errs) && errs.some(e => e.field && e.field.toLowerCase() === 'email')) {
      ok('Validation error contains field-level entry for email');
    } else {
      fail('Validation error did not include field-level entry for email: ' + JSON.stringify(errs));
    }
  } catch (e) {
    fail('Could not assert field-level validation errors: ' + e);
  }

  // Test: invalid email format returns validation error with field 'email'
  const invalidFormat = { email: 'not-an-email', name: 'Invalid Format' };
  const invalidFormatRes = await tryRequest(axios.post('/api/users', invalidFormat));
  if (!invalidFormatRes.ok && invalidFormatRes.status === 400) {
    if (validateValidationError(invalidFormatRes.data)) {
      const errs = invalidFormatRes.data.errors || [];
      if (errs.some(e => e.field && e.field.toLowerCase() === 'email')) ok('Invalid email format returned 400 with email field error');
      else fail('Invalid email format returned 400 but no email field error: ' + JSON.stringify(errs));
    } else fail('Invalid email format returned 400 but did not match validation schema');
  } else {
    fail('Expected 400 for invalid email format, got: ' + JSON.stringify(invalidFormatRes));
  }

  // Test: list users and validate each item against user schema
  const listRes = await tryRequest(axios.get('/api/users'));
  if (listRes.ok && listRes.status === 200) {
    const items = Array.isArray(listRes.data) ? listRes.data : [listRes.data];
    let allValid = true;
    for (const it of items) {
      if (!validateUser(it)) { allValid = false; break; }
    }
    if (allValid) ok('List users - all items match user schema'); else fail('List users - some items did not match user schema');
  } else {
    fail('List users request failed: ' + JSON.stringify(listRes));
  }

  // Test: update user to use duplicate email -> expect 409 with error schema
  // Create a new user to update
  const uA = { email: 'uniqueA+' + Date.now() + '@example.org', name: 'Unique A' };
  const uB = { email: 'uniqueB+' + Date.now() + '@example.org', name: 'Unique B' };
  const createA = await tryRequest(axios.post('/api/users', uA));
  const createB = await tryRequest(axios.post('/api/users', uB));
  if (!(createA.ok && createA.status === 201 && createB.ok && createB.status === 201)) {
    fail('Setup for update-duplicate test failed');
  } else {
    const bId = createB.data.id;
    const updateBody = { email: createA.data.email, name: 'B renamed' };
    const updRes = await tryRequest(axios.put(`/api/users/${bId}`, updateBody));
    if (!updRes.ok && updRes.status === 409) {
      if (validateError(updRes.data)) ok('Update to duplicate email returned 409 and matches error schema');
      else fail('Update duplicate returned 409 but error response did not match schema');
    } else {
      fail('Expected 409 when updating to duplicate email, got: ' + JSON.stringify(updRes));
    }
  }

  // Test: successful update changes name and returns user schema
  const toUpdate = { email: 'to-update+' + Date.now() + '@example.org', name: 'Before' };
  const create = await tryRequest(axios.post('/api/users', toUpdate));
  if (!(create.ok && create.status === 201 && create.data && create.data.id)) { fail('Create for update test failed'); }
  else {
    const idu = create.data.id;
    const updated = await tryRequest(axios.put(`/api/users/${idu}`, { email: toUpdate.email, name: 'After' }));
    if (updated.ok && updated.status === 200 && validateUser(updated.data) && updated.data.name === 'After') ok('Update user success');
    else fail('Update user did not return expected result: ' + JSON.stringify(updated));
  }

  // Test 3: GET by id and by email
  const create2 = { email: 'testuser+2@example.org', name: 'Test User 2' };
  res = await tryRequest(axios.post('/api/users', create2));
  if (!(res.ok && res.status === 201 && res.data && res.data.id)) { fail('Create user 2 failed'); return; }
  const id = res.data.id;
  const byId = await tryRequest(axios.get(`/api/users/${id}`));
  if (!(byId.ok && byId.status === 200 && byId.data && byId.data.email === create2.email)) { fail('GET by id failed'); }
  else ok('GET by id');

  const byEmail = await tryRequest(axios.get('/api/users', { params: { email: create2.email } }));
  if (byEmail.ok && byEmail.status === 200) {
    let foundId = null;
    if (Array.isArray(byEmail.data) && byEmail.data.length>0) foundId = byEmail.data[0].id;
    else if (byEmail.data && byEmail.data.id) foundId = byEmail.data.id;
    if (foundId === id) ok('GET by email'); else fail('GET by email did not return expected id');
  } else {
    fail('GET by email request failed');
  }

  // Test 4: Totals calculation (requires seed_totals.sql applied)
  // Expect totalHours = 3.75 and totalRevenue = 437.5 for u1@example.org
  // Find user id for u1@example.org
  const u1 = await tryRequest(axios.get('/api/users', { params: { email: 'u1@example.org' } }));
  if (!(u1.ok && u1.status === 200)) { fail('Could not find user u1@example.org for totals test'); }
  let u1id = null;
  if (Array.isArray(u1.data) && u1.data.length>0) u1id = u1.data[0].id;
  else if (u1.data && u1.data.id) u1id = u1.data.id;
  if (!u1id) { fail('u1 id not found'); }
  const totals = await tryRequest(axios.get(`/api/users/${u1id}/totals`));
  if (totals.ok && totals.status === 200) {
    const th = parseFloat(totals.data.totalHours || totals.data.hours || 0);
    const tr = parseFloat(totals.data.totalRevenue || totals.data.revenue || 0);
    // schema validation first
    if (!validateTotals(totals.data)) {
      fail('Totals response did not match schema: ' + JSON.stringify(validateTotals.errors));
    } else if (approxEqual(th, 3.75, 1e-3) && approxEqual(tr, 437.5, 1e-2)) ok('Totals calculation matches expected');
    else fail(`Totals mismatch: got hours=${th} revenue=${tr}`);
  } else {
    fail('Totals endpoint failed: ' + JSON.stringify(totals));
  }

  // Test 5: Delete prevention when billable_hours exist
  const del = await tryRequest(axios.delete(`/api/users/${u1id}`));
  if (!del.ok && del.status === 409) {
    if (validateError(del.data)) ok('Delete prevented with 409 and valid error schema when dependent billable_hours exist');
    else fail('Delete returned 409 but error response did not match schema: ' + JSON.stringify(validateError.errors));
  }
  else fail('Delete did not return 409 as expected');

  if (process.exitCode && process.exitCode !== 0) {
    console.error('One or more tests failed');
    process.exit(process.exitCode);
  }
  console.log('All Node.js acceptance tests completed successfully.');
}

run().catch(err => { console.error('Uncaught error:', err); process.exit(10); });
