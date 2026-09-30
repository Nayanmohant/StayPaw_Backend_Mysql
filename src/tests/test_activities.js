const assert = require('assert');
const pool = require('../config/database');
const { generateToken } = require('../utils/jwt');

const BASE_URL = 'http://localhost:8080/api/v1';

let testCustomerA = null;
let testCustomerB = null;
let testShelterAdmin = null;
let testOtherShelterAdmin = null;
let testSuperAdmin = null;

let tokenCustomerA = null;
let tokenCustomerB = null;
let tokenShelterAdmin = null;
let tokenOtherShelterAdmin = null;
let tokenSuperAdmin = null;

let testShelter = null;
let testBookingA = null;

let createdActivityId = null;
let passedAssertions = 0;

function pass(msg) {
  passedAssertions++;
  console.log(`  ✓ PASS: ${msg}`);
}

async function setupTestData() {
  console.log('--- Setting up test data for Activity tests ---');

  const custARes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Activity Customer A', 'act_customer_a@test.com', 'customer', true)
     RETURNING *`
  );
  testCustomerA = custARes.rows[0];
  tokenCustomerA = generateToken(testCustomerA);

  const custBRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Activity Customer B', 'act_customer_b@test.com', 'customer', true)
     RETURNING *`
  );
  testCustomerB = custBRes.rows[0];
  tokenCustomerB = generateToken(testCustomerB);

  const adminRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Activity Shelter Admin', 'act_shelter_admin@test.com', 'shelter_admin', true)
     RETURNING *`
  );
  testShelterAdmin = adminRes.rows[0];
  tokenShelterAdmin = generateToken(testShelterAdmin);

  const otherAdminRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Other Act Admin', 'other_act_admin@test.com', 'shelter_admin', true)
     RETURNING *`
  );
  testOtherShelterAdmin = otherAdminRes.rows[0];
  tokenOtherShelterAdmin = generateToken(testOtherShelterAdmin);

  const superRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Activity Super Admin', 'act_super_admin@test.com', 'super_admin', true)
     RETURNING *`
  );
  testSuperAdmin = superRes.rows[0];
  tokenSuperAdmin = generateToken(testSuperAdmin);

  // Create shelter
  const shlRes = await pool.query(
    `INSERT INTO shelters (
       admin_id, name, image_url, address, rating, distance,
       price_per_night, is_live, approval_status, description
     ) VALUES (
       $1, 'Activity Test Shelter', 'https://images.example.com/act_shl.jpg',
       '456 Care Ln, San Jose, CA', 4.8, 2.0, 80.0, true, 'approved',
       'Care activities testing facility.'
     ) RETURNING *`,
    [testShelterAdmin.id]
  );
  testShelter = shlRes.rows[0];

  // Create booking for Customer A
  const bRes = await pool.query(
    `INSERT INTO bookings (
       user_id, shelter_id, shelter_name, shelter_image,
       start_date, end_date, status, subtotal, tax, service_fee, total_price
     ) VALUES (
       $1, $2, 'Activity Test Shelter', 'https://images.example.com/act_shl.jpg',
       '2026-10-10T10:00:00Z', '2026-10-15T10:00:00Z', 'in_progress',
       320.0, 25.6, 5.0, 350.6
     ) RETURNING *`,
    [testCustomerA.id, testShelter.id]
  );
  testBookingA = bRes.rows[0];

  console.log('Activity test data created successfully.');
}

async function cleanupTestData() {
  console.log('\nCleaning up activity test data...');
  if (testBookingA) {
    await pool.query('DELETE FROM activities WHERE booking_id = $1', [testBookingA.id]);
    await pool.query('DELETE FROM bookings WHERE id = $1', [testBookingA.id]);
  }
  if (testShelter) {
    await pool.query('DELETE FROM shelters WHERE id = $1', [testShelter.id]);
  }
  if (testCustomerA || testCustomerB || testShelterAdmin || testOtherShelterAdmin || testSuperAdmin) {
    await pool.query(
      'DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5)',
      [
        testCustomerA?.id,
        testCustomerB?.id,
        testShelterAdmin?.id,
        testOtherShelterAdmin?.id,
        testSuperAdmin?.id,
      ]
    );
  }
  console.log('Cleanup finished.');
}

async function runActivityTests() {
  console.log('====================================================');
  console.log('           STAYPAW ACTIVITY API TEST SUITE          ');
  console.log('====================================================');

  try {
    await setupTestData();

    // -------------------------------------------------------------------------
    // SECTION 1: AUTHENTICATION & ACCESS CONTROL
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 1: AUTHENTICATION & ACCESS CONTROL ---');

    // Test 1: Unauthenticated request rejected -> 401
    console.log('Test 1: Unauthenticated activities request -> 401 Unauthorized');
    const unauthRes = await fetch(`${BASE_URL}/activities`);
    assert.strictEqual(unauthRes.status, 401);
    pass('Unauthenticated activities request rejected with 401');

    // Test 2: Nonexistent booking activities request -> 404 Not Found
    console.log('Test 2: Nonexistent booking activities request -> 404 Not Found');
    const nonExistRes = await fetch(`${BASE_URL}/bookings/00000000-0000-0000-0000-000000000000/activities`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    assert.strictEqual(nonExistRes.status, 404);
    pass('Nonexistent booking returns 404 BOOKING_NOT_FOUND');

    // Test 3: Unauthorized customer accessing another user's booking activities -> 403
    console.log('Test 3: Customer B accessing Customer A booking activities -> 403 Forbidden');
    const unauthCustRes = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/activities`, {
      headers: { Authorization: `Bearer ${tokenCustomerB}` },
    });
    assert.strictEqual(unauthCustRes.status, 403);
    pass('Unauthorized customer blocked with 403 AUTH_FORBIDDEN');

    // Test 4: Unrelated shelter admin accessing booking activities -> 403
    console.log('Test 4: Unrelated shelter admin accessing booking activities -> 403 Forbidden');
    const unauthAdminRes = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/activities`, {
      headers: { Authorization: `Bearer ${tokenOtherShelterAdmin}` },
    });
    assert.strictEqual(unauthAdminRes.status, 403);
    pass('Unrelated shelter admin blocked with 403 AUTH_FORBIDDEN');

    // -------------------------------------------------------------------------
    // SECTION 2: ACTIVITY CREATION & VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 2: ACTIVITY CREATION & VALIDATION ---');

    // Test 5: Customer cannot create activity (staff only) -> 403
    console.log('Test 5: Customer role cannot create care activity -> 403 Forbidden');
    const custCreateRes = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({
        type: 'food',
        title: 'Unauthorized Food Log',
      }),
    });
    assert.strictEqual(custCreateRes.status, 403);
    pass('Customer role blocked from creating care activities (403)');

    // Test 6: Invalid activity type rejected -> 400
    console.log('Test 6: Invalid activity type rejected -> 400 Bad Request');
    const invalidTypeRes = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenShelterAdmin}`,
      },
      body: JSON.stringify({
        type: 'invalid_type',
        title: 'Morning Breakfast',
      }),
    });
    assert.strictEqual(invalidTypeRes.status, 400);
    pass('Invalid activity type rejected with 400 VALIDATION_ERROR');

    // Test 7: Missing title rejected -> 400
    console.log('Test 7: Missing title rejected -> 400 Bad Request');
    const missingTitleRes = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenShelterAdmin}`,
      },
      body: JSON.stringify({
        type: 'food',
      }),
    });
    assert.strictEqual(missingTitleRes.status, 400);
    pass('Missing activity title rejected with 400 VALIDATION_ERROR');

    // Test 8: Valid activity creation by facility shelter admin
    console.log('Test 8: Facility shelter admin creates care activity -> 201 Created');
    const createRes1 = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenShelterAdmin}`,
      },
      body: JSON.stringify({
        type: 'food',
        title: 'Breakfast Complete',
        description: 'Ate 1.5 cups of dry kibble with salmon topper.',
        mood: 'energetic',
        timeLabel: '9:30 AM',
        date: '2026-10-11T09:30:00Z',
      }),
    });
    const createData1 = await createRes1.json();
    assert.strictEqual(createRes1.status, 201);
    assert.strictEqual(createData1.success, true);

    const act1 = createData1.data;
    createdActivityId = act1.id;

    // Verify model fields match Flutter Activity model
    assert.ok(act1.id);
    assert.strictEqual(act1.bookingId, testBookingA.id);
    assert.strictEqual(act1.type, 'food');
    assert.strictEqual(act1.title, 'Breakfast Complete');
    assert.strictEqual(act1.description, 'Ate 1.5 cups of dry kibble with salmon topper.');
    assert.strictEqual(act1.mood, 'energetic');
    assert.strictEqual(act1.timeLabel, '9:30 AM');
    assert.ok(act1.date);
    pass('Activity created with HTTP 201 matching Flutter Activity contract');

    // Test 9: Create second activity (Walk) for ordering test
    console.log('Test 9: Create second activity (Walk) later in the day');
    const createRes2 = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenShelterAdmin}`,
      },
      body: JSON.stringify({
        type: 'walk',
        title: 'Afternoon Trail Walk',
        description: 'Walked 2 miles around the dog park.',
        mood: 'happy',
        timeLabel: '3:00 PM',
        date: '2026-10-11T15:00:00Z',
      }),
    });
    assert.strictEqual(createRes2.status, 201);
    pass('Second activity created successfully');

    // Test 10: Verify persistence in PostgreSQL activities table
    console.log('Test 10: Verify activity stored in PostgreSQL');
    const dbActRes = await pool.query('SELECT * FROM activities WHERE id = $1', [createdActivityId]);
    assert.strictEqual(dbActRes.rows.length, 1);
    assert.strictEqual(dbActRes.rows[0].booking_id, testBookingA.id);
    assert.strictEqual(dbActRes.rows[0].type, 'food');
    pass('Activity verified in PostgreSQL database');

    // -------------------------------------------------------------------------
    // SECTION 3: TIMELINE RETRIEVAL, ORDERING & SCOPING
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 3: TIMELINE RETRIEVAL, ORDERING & SCOPING ---');

    // Test 11: Authorized booking owner views booking activities
    console.log('Test 11: Booking owner views booking activities');
    const bookingActRes = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/activities`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const bookingActData = await bookingActRes.json();
    assert.strictEqual(bookingActRes.status, 200);
    assert.strictEqual(bookingActData.success, true);
    assert.ok(Array.isArray(bookingActData.data));
    assert.strictEqual(bookingActData.data.length, 2);
    pass('Booking owner receives activities array');

    // Test 12: Verify timeline ordering (ORDER BY date DESC - newest first)
    console.log('Test 12: Verify timeline ordering (date DESC - newest first)');
    assert.strictEqual(bookingActData.data[0].type, 'walk'); // 3:00 PM
    assert.strictEqual(bookingActData.data[1].type, 'food'); // 9:30 AM
    pass('Timeline correctly ordered by date DESC (newest first)');

    // Test 13: Customer views general scoped activities (/api/v1/activities)
    console.log('Test 13: Customer views general scoped activities');
    const scopedRes = await fetch(`${BASE_URL}/activities`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const scopedData = await scopedRes.json();
    assert.strictEqual(scopedRes.status, 200);
    assert.strictEqual(scopedData.success, true);
    assert.ok(Array.isArray(scopedData.data));
    assert.strictEqual(scopedData.data.length, 2);
    pass('Customer receives scoped activities for their active bookings');

    // Test 14: Customer B gets empty scoped activities (data isolation)
    console.log('Test 14: Customer B gets 0 activities (isolation)');
    const scopedResB = await fetch(`${BASE_URL}/activities`, {
      headers: { Authorization: `Bearer ${tokenCustomerB}` },
    });
    const scopedDataB = await scopedResB.json();
    assert.strictEqual(scopedResB.status, 200);
    assert.strictEqual(scopedDataB.data.length, 0);
    pass('Customer B cannot see Customer A care activities');

    // Test 15: Pagination headers present
    console.log('Test 15: Verify pagination headers');
    assert.strictEqual(scopedRes.headers.get('x-total-count'), '2');
    assert.strictEqual(scopedRes.headers.get('x-page'), '1');
    assert.strictEqual(scopedRes.headers.get('x-limit'), '50');
    pass('Pagination headers X-Total-Count, X-Page, X-Limit present');

    // -------------------------------------------------------------------------
    // SECTION 4: LIVE ACTIVITY TIMELINE & SUPER ADMIN
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 4: LIVE ACTIVITY TIMELINE & SUPER ADMIN ---');

    // Test 16: Live activity timeline (/api/v1/activities/live)
    console.log('Test 16: Retrieve live activity timeline');
    const liveRes = await fetch(`${BASE_URL}/activities/live?limit=10`);
    const liveData = await liveRes.json();
    assert.strictEqual(liveRes.status, 200);
    assert.strictEqual(liveData.success, true);
    assert.ok(Array.isArray(liveData.data));
    assert.ok(liveData.data.length >= 2);
    pass('GET /activities/live returns latest real-time activities array');

    // Test 17: Super admin can view activities
    console.log('Test 17: Super admin views booking activities');
    const superActRes = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/activities`, {
      headers: { Authorization: `Bearer ${tokenSuperAdmin}` },
    });
    assert.strictEqual(superActRes.status, 200);
    pass('Super admin successfully views booking activities');

    // Test 18: Database health check
    console.log('Test 18: Database health check operational');
    const healthRes = await fetch(`${BASE_URL}/health/database`);
    assert.strictEqual(healthRes.status, 200);
    pass('Database health check returns HTTP 200 OK');

    console.log('\n====================================================');
    console.log(`ALL ACTIVITY TESTS PASSED! (${passedAssertions}/${passedAssertions} assertions passed)`);
    console.log('====================================================');
  } finally {
    await cleanupTestData();
  }
}

if (require.main === module) {
  runActivityTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Activity test failure:', err);
      process.exit(1);
    });
}

module.exports = { runActivityTests };
