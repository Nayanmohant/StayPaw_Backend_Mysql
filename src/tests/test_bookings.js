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

let testShelterApproved = null;
let testShelterPending = null;

let createdBookingId = null;
let passedAssertions = 0;

function pass(msg) {
  passedAssertions++;
  console.log(`  ✓ PASS: ${msg}`);
}

async function setupTestData() {
  console.log('--- Setting up test data for Booking tests ---');

  // Create test users
  const custARes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Booking Customer A', 'booking_customer_a@test.com', 'customer', true)
     RETURNING *`
  );
  testCustomerA = custARes.rows[0];
  tokenCustomerA = generateToken(testCustomerA);

  const custBRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Booking Customer B', 'booking_customer_b@test.com', 'customer', true)
     RETURNING *`
  );
  testCustomerB = custBRes.rows[0];
  tokenCustomerB = generateToken(testCustomerB);

  const adminRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Booking Shelter Admin', 'booking_shelter_admin@test.com', 'shelter_admin', true)
     RETURNING *`
  );
  testShelterAdmin = adminRes.rows[0];
  tokenShelterAdmin = generateToken(testShelterAdmin);

  const otherAdminRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Other Shelter Admin', 'other_shelter_admin@test.com', 'shelter_admin', true)
     RETURNING *`
  );
  testOtherShelterAdmin = otherAdminRes.rows[0];
  tokenOtherShelterAdmin = generateToken(testOtherShelterAdmin);

  const superRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Booking Super Admin', 'booking_super_admin@test.com', 'super_admin', true)
     RETURNING *`
  );
  testSuperAdmin = superRes.rows[0];
  tokenSuperAdmin = generateToken(testSuperAdmin);

  // Create test shelters
  const shlApprovedRes = await pool.query(
    `INSERT INTO shelters (
       admin_id, name, image_url, address, rating, distance,
       price_per_night, is_live, approval_status, description
     ) VALUES (
       $1, 'StayPaw Luxury Resort', 'https://images.example.com/resort.jpg',
       '777 Sunset Blvd, Los Angeles, CA', 4.9, 1.2, 75.0, true, 'approved',
       'Top rated dog and cat resort.'
     ) RETURNING *`,
    [testShelterAdmin.id]
  );
  testShelterApproved = shlApprovedRes.rows[0];

  const shlPendingRes = await pool.query(
    `INSERT INTO shelters (
       admin_id, name, image_url, address, rating, distance,
       price_per_night, is_live, approval_status, description
     ) VALUES (
       $1, 'Unapproved Facility', 'https://images.example.com/unapproved.jpg',
       '123 Shadow Ln, Los Angeles, CA', 0.0, 5.0, 40.0, false, 'pending',
       'Pending facility.'
     ) RETURNING *`,
    [testOtherShelterAdmin.id]
  );
  testShelterPending = shlPendingRes.rows[0];

  console.log('Test data created successfully.');
}

async function cleanupTestData() {
  console.log('\nCleaning up booking test data...');
  if (testShelterApproved || testShelterPending) {
    await pool.query(
      `DELETE FROM bookings WHERE shelter_id IN ($1, $2)`,
      [testShelterApproved?.id, testShelterPending?.id]
    );
    await pool.query(
      `DELETE FROM shelters WHERE id IN ($1, $2)`,
      [testShelterApproved?.id, testShelterPending?.id]
    );
  }

  if (testCustomerA || testCustomerB || testShelterAdmin || testOtherShelterAdmin || testSuperAdmin) {
    await pool.query(
      `DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5)`,
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

async function runBookingTests() {
  console.log('====================================================');
  console.log('           STAYPAW BOOKING API TEST SUITE           ');
  console.log('====================================================');

  try {
    await setupTestData();

    // -------------------------------------------------------------------------
    // SECTION 1: BOOKING CREATION VALIDATION & ERRORS
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 1: BOOKING CREATION VALIDATION & ERRORS ---');

    // Test 1: Unauthenticated booking creation rejected (401)
    console.log('Test 1: Unauthenticated booking creation -> 401 Unauthorized');
    const unauthRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shelterId: testShelterApproved.id,
        startDate: '2026-10-01T10:00:00.000Z',
        endDate: '2026-10-05T18:00:00.000Z',
      }),
    });
    assert.strictEqual(unauthRes.status, 401);
    pass('Unauthenticated request rejected with 401');

    // Test 2: Missing shelterId -> 400 Bad Request
    console.log('Test 2: Missing shelterId -> 400 Bad Request');
    const missingShelterRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({
        startDate: '2026-10-01T10:00:00.000Z',
        endDate: '2026-10-05T18:00:00.000Z',
      }),
    });
    assert.strictEqual(missingShelterRes.status, 400);
    pass('Missing shelterId rejected with 400 VALIDATION_ERROR');

    // Test 3: Nonexistent shelter -> 404 Not Found
    console.log('Test 3: Nonexistent shelter -> 404 Not Found');
    const nonExistShelterRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({
        shelterId: '00000000-0000-0000-0000-000000000000',
        startDate: '2026-10-01T10:00:00.000Z',
        endDate: '2026-10-05T18:00:00.000Z',
      }),
    });
    assert.strictEqual(nonExistShelterRes.status, 404);
    pass('Nonexistent shelter returns 404 SHELTER_NOT_FOUND');

    // Test 4: Unapproved / pending shelter cannot be booked -> 400
    console.log('Test 4: Unapproved / pending shelter cannot be booked -> 400');
    const pendingShelterRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({
        shelterId: testShelterPending.id,
        startDate: '2026-10-01T10:00:00.000Z',
        endDate: '2026-10-05T18:00:00.000Z',
      }),
    });
    assert.strictEqual(pendingShelterRes.status, 400);
    pass('Pending shelter booking rejected with 400 SHELTER_NOT_AVAILABLE');

    // Test 5: Invalid date ordering (endDate <= startDate) -> 400
    console.log('Test 5: Invalid date ordering (endDate <= startDate) -> 400');
    const invalidDatesRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({
        shelterId: testShelterApproved.id,
        startDate: '2026-10-05T10:00:00.000Z',
        endDate: '2026-10-01T10:00:00.000Z',
      }),
    });
    assert.strictEqual(invalidDatesRes.status, 400);
    pass('Invalid date range rejected with 400 VALIDATION_ERROR');

    // -------------------------------------------------------------------------
    // SECTION 2: SUCCESSFUL BOOKING CREATION & PRICE INTEGRITY
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 2: SUCCESSFUL BOOKING CREATION & PRICE INTEGRITY ---');

    // Test 6: Successful booking creation (4 nights @ $75/night + Gourmet Lunch $15 + Daily Photo $5)
    // base = 4 * 75 = 300. addOns = 15 + 5 = 20. subtotal = 320. tax (8%) = 25.60. serviceFee = 5.0. total = 350.60
    console.log('Test 6: Create valid booking with add-ons and authoritative pricing');
    const createRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({
        shelterId: testShelterApproved.id,
        startDate: '2026-10-01T10:00:00.000Z',
        endDate: '2026-10-05T10:00:00.000Z',
        status: 'confirmed',
        addOns: ['Gourmet Lunch', 'Daily Photo Update'],
      }),
    });
    const createData = await createRes.json();
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createData.success, true);

    const b = createData.data;
    createdBookingId = b.id;

    // Verify model fields match Flutter contract
    assert.ok(b.id, 'Expected booking ID to be present');
    assert.strictEqual(b.shelterId, testShelterApproved.id);
    assert.strictEqual(b.userId, testCustomerA.id);
    assert.strictEqual(b.shelterName, 'StayPaw Luxury Resort');
    assert.strictEqual(b.status, 'confirmed');
    assert.deepStrictEqual(b.addOns, ['Gourmet Lunch', 'Daily Photo Update']);
    pass('Booking successfully created with HTTP 201');

    // Test 7: Verify authoritative price calculation (client cannot spoof cheap total)
    console.log('Test 7: Verify authoritative pricing values');
    assert.strictEqual(b.pricing.subtotal, 320.0);
    assert.strictEqual(b.pricing.tax, 25.6);
    assert.strictEqual(b.pricing.serviceFee, 5.0);
    assert.strictEqual(b.pricing.total, 350.6);
    assert.strictEqual(b.totalPrice, 350.6);
    pass('Authoritative pricing calculated accurately from shelter pricePerNight and catalog');

    // Test 8: Verify persistence in PostgreSQL bookings table
    console.log('Test 8: Verify database persistence in PostgreSQL');
    const dbBookingRes = await pool.query('SELECT * FROM bookings WHERE id = $1', [createdBookingId]);
    assert.strictEqual(dbBookingRes.rows.length, 1);
    const dbRow = dbBookingRes.rows[0];
    assert.strictEqual(dbRow.user_id, testCustomerA.id);
    assert.strictEqual(dbRow.shelter_id, testShelterApproved.id);
    assert.strictEqual(parseFloat(dbRow.total_price), 350.6);
    pass('Booking verified in PostgreSQL database');

    // -------------------------------------------------------------------------
    // SECTION 3: OVERLAP CONFLICTS & BOUNDARY-DATE BEHAVIOR
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 3: OVERLAP CONFLICTS & BOUNDARY DATES ---');

    // Test 9: Conflicting booking overlapping with (Oct 01 - Oct 05) -> rejected 409
    console.log('Test 9: Overlapping booking (Oct 03 - Oct 07) rejected -> 409 Conflict');
    const conflictRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerB}`,
      },
      body: JSON.stringify({
        shelterId: testShelterApproved.id,
        startDate: '2026-10-03T10:00:00.000Z',
        endDate: '2026-10-07T10:00:00.000Z',
      }),
    });
    const conflictData = await conflictRes.json();
    assert.strictEqual(conflictRes.status, 409);
    assert.strictEqual(conflictData.success, false);
    assert.strictEqual(conflictData.message, 'Selected dates are no longer available for this facility.');
    pass('Overlapping dates rejected with HTTP 409 Conflict matching API_CONTRACT.md');

    // Test 10: Valid boundary dates (Oct 05 check-in after Oct 05 checkout) -> 201 Created
    console.log('Test 10: Valid boundary date (Oct 05 checkout / check-in boundary) succeeds');
    const boundaryRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerB}`,
      },
      body: JSON.stringify({
        shelterId: testShelterApproved.id,
        startDate: '2026-10-05T10:00:00.000Z',
        endDate: '2026-10-08T10:00:00.000Z',
      }),
    });
    const boundaryData = await boundaryRes.json();
    assert.strictEqual(boundaryRes.status, 201);
    assert.strictEqual(boundaryData.success, true);
    const boundaryBookingId = boundaryData.data.id;
    pass('Boundary checkout/check-in dates succeed without false conflict');

    // -------------------------------------------------------------------------
    // SECTION 4: CONCURRENCY PROTECTION TEST
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 4: CONCURRENCY PROTECTION TEST ---');

    // Test 11: Concurrent booking attempts for the same facility and dates
    console.log('Test 11: Simultaneous concurrent requests for identical slot (Nov 01 - Nov 05)');
    const reqSlot1 = {
      shelterId: testShelterApproved.id,
      startDate: '2026-11-01T10:00:00.000Z',
      endDate: '2026-11-05T10:00:00.000Z',
    };

    const [concurrentResA, concurrentResB] = await Promise.all([
      fetch(`${BASE_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCustomerA}`,
        },
        body: JSON.stringify(reqSlot1),
      }),
      fetch(`${BASE_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCustomerB}`,
        },
        body: JSON.stringify(reqSlot1),
      }),
    ]);

    const statuses = [concurrentResA.status, concurrentResB.status].sort();
    assert.deepStrictEqual(statuses, [201, 409], 'Exactly one request must succeed (201) and one fail (409)');
    pass('PostgreSQL transaction serialization ensured exactly one concurrent booking succeeded');

    // Verify in database that only ONE confirmed booking exists for Nov 01 - Nov 05
    const concurrentDbCheck = await pool.query(
      `SELECT COUNT(*)::int AS count FROM bookings
       WHERE shelter_id = $1 AND start_date = '2026-11-01T10:00:00.000Z'`,
      [testShelterApproved.id]
    );
    assert.strictEqual(concurrentDbCheck.rows[0].count, 1);
    pass('Database contains exactly 1 booking for the contested date slot (zero double-booking)');

    // -------------------------------------------------------------------------
    // SECTION 5: USER BOOKING LIST & DATA ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 5: USER BOOKING LIST & DATA ISOLATION ---');

    // Test 12: Customer A lists their bookings
    console.log('Test 12: Customer A gets their bookings list');
    const listResA = await fetch(`${BASE_URL}/bookings`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const listDataA = await listResA.json();
    assert.strictEqual(listResA.status, 200);
    assert.strictEqual(listDataA.success, true);
    assert.ok(Array.isArray(listDataA.data), 'Flutter requires data to be a List');
    assert.ok(listDataA.data.every((bk) => bk.userId === testCustomerA.id));
    pass('Customer A booking list returns array scoped strictly to their account');

    // Test 13: Customer A cannot see Customer B bookings even when specifying ?userId=customerB
    console.log('Test 13: Customer isolation enforcement (cannot query other user bookings)');
    const spoofRes = await fetch(`${BASE_URL}/bookings?userId=${testCustomerB.id}`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const spoofData = await spoofRes.json();
    assert.strictEqual(spoofRes.status, 200);
    assert.ok(spoofData.data.every((bk) => bk.userId === testCustomerA.id));
    pass('Customer query ignores unauthorized userId query param and enforces isolation');

    // Test 14: Pagination headers present on booking list
    console.log('Test 14: Pagination headers returned on booking list');
    assert.ok(listResA.headers.get('x-total-count') !== null);
    assert.ok(listResA.headers.get('x-page') !== null);
    assert.ok(listResA.headers.get('x-limit') !== null);
    pass('Pagination headers X-Total-Count, X-Page, X-Limit present');

    // -------------------------------------------------------------------------
    // SECTION 6: BOOKING DETAILS & ACCESS CONTROL
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 6: BOOKING DETAILS & ACCESS CONTROL ---');

    // Test 15: Customer A views their own booking details
    console.log('Test 15: Customer A retrieves booking details');
    const detailRes = await fetch(`${BASE_URL}/bookings/${createdBookingId}`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const detailData = await detailRes.json();
    assert.strictEqual(detailRes.status, 200);
    assert.strictEqual(detailData.success, true);
    assert.strictEqual(detailData.data.id, createdBookingId);
    pass('Owner customer successfully views booking details');

    // Test 16: Customer B blocked from viewing Customer A booking (403)
    console.log('Test 16: Customer B blocked from viewing Customer A booking -> 403 Forbidden');
    const unauthDetailRes = await fetch(`${BASE_URL}/bookings/${createdBookingId}`, {
      headers: { Authorization: `Bearer ${tokenCustomerB}` },
    });
    assert.strictEqual(unauthDetailRes.status, 403);
    pass('Unauthorized customer viewing another user booking returns 403 AUTH_FORBIDDEN');

    // Test 17: Nonexistent booking returns 404
    console.log('Test 17: Nonexistent booking returns 404 Not Found');
    const nonExistBookingRes = await fetch(
      `${BASE_URL}/bookings/00000000-0000-0000-0000-000000000000`,
      { headers: { Authorization: `Bearer ${tokenCustomerA}` } }
    );
    assert.strictEqual(nonExistBookingRes.status, 404);
    pass('Nonexistent booking returns 404 BOOKING_NOT_FOUND');

    // -------------------------------------------------------------------------
    // SECTION 7: STATUS TRANSITIONS & CANCELLATION
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 7: STATUS TRANSITIONS & CANCELLATION ---');

    // Test 18: Customer cannot transition booking to 'completed' (only cancel) -> 403
    console.log('Test 18: Customer cannot mark booking completed -> 403 Forbidden');
    const custCompleteRes = await fetch(`${BASE_URL}/bookings/${createdBookingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({ status: 'completed' }),
    });
    assert.strictEqual(custCompleteRes.status, 403);
    pass('Customer role blocked from setting non-cancellation statuses (403)');

    // Test 19: Shelter Admin advances status from 'confirmed' to 'in_progress'
    console.log('Test 19: Shelter Admin advances booking: confirmed -> in_progress');
    const adminAdvanceRes = await fetch(`${BASE_URL}/bookings/${createdBookingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenShelterAdmin}`,
      },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    const adminAdvanceData = await adminAdvanceRes.json();
    assert.strictEqual(adminAdvanceRes.status, 200);
    assert.strictEqual(adminAdvanceData.data.status, 'in_progress');
    pass('Shelter admin successfully advanced status to in_progress');

    // Test 20: Shelter Admin advances status from 'in_progress' to 'completed'
    console.log('Test 20: Shelter Admin advances booking: in_progress -> completed');
    const adminCompleteRes = await fetch(`${BASE_URL}/bookings/${createdBookingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenShelterAdmin}`,
      },
      body: JSON.stringify({ status: 'completed' }),
    });
    assert.strictEqual(adminCompleteRes.status, 200);
    pass('Shelter admin successfully completed booking');

    // Test 21: Invalid transition from terminal 'completed' status back to 'confirmed' -> 400
    console.log('Test 21: Invalid status transition (completed -> confirmed) -> 400');
    const invalidTransRes = await fetch(`${BASE_URL}/bookings/${createdBookingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenShelterAdmin}`,
      },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    assert.strictEqual(invalidTransRes.status, 400);
    pass('Invalid transition from terminal state rejected with 400 INVALID_STATUS_TRANSITION');

    // Test 22: Customer cancels their boundary booking (confirmed -> cancelled)
    console.log('Test 22: Customer cancels their own booking -> 200 OK');
    const cancelRes = await fetch(`${BASE_URL}/bookings/${boundaryBookingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerB}`,
      },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    const cancelData = await cancelRes.json();
    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelData.data.status, 'cancelled');
    assert.strictEqual(cancelData.message, 'Status updated successfully');
    pass('Customer successfully cancelled booking');

    // Test 23: Re-cancelling an already cancelled booking -> 400
    console.log('Test 23: Re-cancelling an already cancelled booking -> 400');
    const reCancelRes = await fetch(`${BASE_URL}/bookings/${boundaryBookingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerB}`,
      },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    assert.strictEqual(reCancelRes.status, 400);
    pass('Re-cancelling terminal cancelled booking rejected with 400');

    // Test 24: Unrelated shelter admin blocked from managing another facility booking
    console.log('Test 24: Unrelated shelter admin blocked from modifying booking -> 403');
    const unrelatedAdminRes = await fetch(`${BASE_URL}/bookings/${createdBookingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOtherShelterAdmin}`,
      },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    assert.strictEqual(unrelatedAdminRes.status, 403);
    pass('Unrelated shelter admin blocked with 403 AUTH_FORBIDDEN');

    // Test 25: Super admin can view any booking
    console.log('Test 25: Super admin views any booking details');
    const superAdminRes = await fetch(`${BASE_URL}/bookings/${createdBookingId}`, {
      headers: { Authorization: `Bearer ${tokenSuperAdmin}` },
    });
    assert.strictEqual(superAdminRes.status, 200);
    pass('Super admin successfully views booking details');

    // Test 26: Database health check verification
    console.log('Test 26: Database health check remains operational');
    const healthRes = await fetch(`${BASE_URL}/health/database`);
    const healthData = await healthRes.json();
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthData.success, true);
    pass('Health check endpoint returns HTTP 200 OK');

    console.log('\n====================================================');
    console.log(`ALL BOOKING TESTS PASSED! (${passedAssertions}/${passedAssertions} assertions passed)`);
    console.log('====================================================');
  } finally {
    await cleanupTestData();
  }
}

if (require.main === module) {
  runBookingTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Booking test failure:', err);
      process.exit(1);
    });
}

module.exports = { runBookingTests };
