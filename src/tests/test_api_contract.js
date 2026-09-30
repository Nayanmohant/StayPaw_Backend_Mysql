const assert = require('assert');
const pool = require('../config/database');
const { generateToken } = require('../utils/jwt');

const BASE_URL = 'http://localhost:8080/api/v1';

let passedAssertions = 0;
function pass(msg) {
  passedAssertions++;
  console.log(`  ✓ PASS: ${msg}`);
}

let testUser = null;
let testAdmin = null;
let testSuperAdmin = null;
let userToken = null;
let adminToken = null;
let superAdminToken = null;
let testShelter = null;
let testBooking = null;
let testPet = null;

async function setupTestData() {
  console.log('--- Setting up contract test data in database ---');

  // Pre-cleanup in case of prior aborted run
  await pool.query("DELETE FROM messages WHERE sender_id IN (SELECT id FROM users WHERE email IN ('flutter_contract_user@test.com', 'flutter_contract_admin@test.com', 'flutter_contract_super@test.com'))");
  await pool.query("DELETE FROM activities WHERE title = 'Morning Walk'");
  await pool.query("DELETE FROM bookings WHERE shelter_name = 'Contract Test Shelter'");
  await pool.query("DELETE FROM shelters WHERE name = 'Contract Test Shelter'");
  await pool.query("DELETE FROM users WHERE email IN ('flutter_contract_user@test.com', 'flutter_contract_admin@test.com', 'flutter_contract_super@test.com')");

  // 1. Create customer user
  const userRes = await pool.query(
    `INSERT INTO users (name, email, role, phone_number, is_admin_approved)
     VALUES ('Flutter Contract User', 'flutter_contract_user@test.com', 'customer', '+1234567890', true)
     RETURNING *`
  );
  testUser = userRes.rows[0];
  userToken = generateToken(testUser);

  // 2. Create shelter admin
  const adminRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Flutter Contract Admin', 'flutter_contract_admin@test.com', 'shelter_admin', true)
     RETURNING *`
  );
  testAdmin = adminRes.rows[0];
  adminToken = generateToken(testAdmin);

  // 3. Create super admin
  const superRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Flutter Contract Super', 'flutter_contract_super@test.com', 'super_admin', true)
     RETURNING *`
  );
  testSuperAdmin = superRes.rows[0];
  superAdminToken = generateToken(testSuperAdmin);

  // 4. Create test shelter
  const shelterRes = await pool.query(
    `INSERT INTO shelters (
       admin_id, name, image_url, address, rating, distance,
       price_per_night, is_live, approval_status, description
     ) VALUES (
       $1, 'Contract Test Shelter', 'https://example.com/shelter.jpg',
       '100 Contract Way, CA', 4.8, 2.5, 60.0, true, 'approved',
       'High contract compatibility test shelter.'
     ) RETURNING *`,
    [testAdmin.id]
  );
  testShelter = shelterRes.rows[0];

  // 5. Create test booking
  const bookingRes = await pool.query(
    `INSERT INTO bookings (
       user_id, shelter_id, shelter_name, shelter_image,
       start_date, end_date, status, subtotal, tax, service_fee, total_price, add_ons
     ) VALUES (
       $1, $2, $3, $4,
       '2026-11-10T10:00:00.000Z', '2026-11-15T10:00:00.000Z',
       'confirmed', 300.0, 24.0, 5.0, 329.0, $5
     ) RETURNING *`,
    [testUser.id, testShelter.id, testShelter.name, testShelter.image_url, ['Spa Session']]
  );
  testBooking = bookingRes.rows[0];

  console.log('Contract test data prepared successfully.');
}

async function cleanupTestData() {
  console.log('\n--- Cleaning up contract test data ---');
  try {
    if (testUser || testAdmin || testSuperAdmin) {
      await pool.query('DELETE FROM messages WHERE sender_id IN ($1, $2, $3)', [
        testUser?.id,
        testAdmin?.id,
        testSuperAdmin?.id,
      ]);
    }
    if (testBooking) {
      await pool.query('DELETE FROM messages WHERE booking_id = $1 OR booking_id = $2', [testBooking.id, 'global']);
      await pool.query('DELETE FROM activities WHERE booking_id = $1', [testBooking.id]);
      await pool.query('DELETE FROM bookings WHERE id = $1', [testBooking.id]);
    }
    if (testPet) {
      await pool.query('DELETE FROM pets WHERE id = $1', [testPet.id]);
    }
    if (testShelter) {
      await pool.query('DELETE FROM reviews WHERE shelter_id = $1', [testShelter.id]);
      await pool.query('DELETE FROM shelters WHERE id = $1', [testShelter.id]);
    }
    if (testUser || testAdmin || testSuperAdmin) {
      await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [
        testUser?.id,
        testAdmin?.id,
        testSuperAdmin?.id,
      ]);
    }
  } catch (e) {
    console.error('Error during cleanup:', e.message);
  }
  console.log('Cleanup completed.');
}

async function runContractAudit() {
  console.log('================================================================');
  console.log('         STAYPAW AUTOMATED FLUTTER ↔ BACKEND API AUDIT          ');
  console.log('================================================================');

  try {
    await setupTestData();

    // -------------------------------------------------------------------------
    // 1. AUTH CONTRACT AUDIT (auth_repository.dart)
    // -------------------------------------------------------------------------
    console.log('\n[1/8] Verifying Auth Module API Contract...');

    // GET /auth/me
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const meData = await meRes.json();
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meData.success, true);
    // Flutter User.fromMap expectation verification (unwrapped from data by ApiClient)
    const u = meData.data;
    assert.ok(u.id && typeof u.id === 'string', 'User.id must be string');
    assert.ok(u.name && typeof u.name === 'string', 'User.name must be string');
    assert.ok(u.email && typeof u.email === 'string', 'User.email must be string');
    assert.strictEqual(u.role, 'customer', 'User.role must match');
    assert.strictEqual(typeof u.isAdminApproved, 'boolean', 'User.isAdminApproved must be boolean');
    pass('GET /auth/me response matches Flutter User.fromMap contract');

    // POST /auth/logout
    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const logoutData = await logoutRes.json();
    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(logoutData.success, true);
    pass('POST /auth/logout matches Flutter AuthRepository.logout contract');

    // POST /auth/forgot-password
    const forgotRes = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'flutter_contract_user@test.com' }),
    });
    const forgotData = await forgotRes.json();
    assert.strictEqual(forgotRes.status, 200);
    assert.strictEqual(forgotData.success, true);
    assert.ok(forgotData.message);
    pass('POST /auth/forgot-password matches Flutter AuthRepository contract');

    // -------------------------------------------------------------------------
    // 2. SHELTER CONTRACT AUDIT (shelter_repository.dart)
    // -------------------------------------------------------------------------
    console.log('\n[2/8] Verifying Shelter Module API Contract...');

    // GET /shelters (query params: search, isLive, minRating, maxPrice, sortBy)
    const sheltersRes = await fetch(`${BASE_URL}/shelters?search=Contract&isLive=true&sortBy=rating_desc`);
    const sheltersData = await sheltersRes.json();
    assert.strictEqual(sheltersRes.status, 200);
    assert.strictEqual(sheltersData.success, true);
    assert.ok(Array.isArray(sheltersData.data), 'Expected array under data');
    assert.ok(sheltersData.data.length > 0, 'Expected search results');
    // Flutter Shelter.fromMap verification
    const s = sheltersData.data[0];
    assert.ok(typeof s.id === 'string', 'Shelter.id must be string');
    assert.ok(typeof s.name === 'string', 'Shelter.name must be string');
    assert.ok(typeof s.imageUrl === 'string', 'Shelter.imageUrl must be string');
    assert.ok(typeof s.address === 'string', 'Shelter.address must be string');
    assert.ok(typeof s.rating === 'number', 'Shelter.rating must be number');
    assert.ok(typeof s.distance === 'number', 'Shelter.distance must be number');
    assert.ok(typeof s.pricePerNight === 'number', 'Shelter.pricePerNight must be number');
    assert.ok(typeof s.isLive === 'boolean', 'Shelter.isLive must be boolean');
    assert.ok(typeof s.approvalStatus === 'string', 'Shelter.approvalStatus must be string');
    pass('GET /shelters response items match Flutter Shelter.fromMap contract');

    // GET /shelters/:id
    const shelterDetailRes = await fetch(`${BASE_URL}/shelters/${testShelter.id}`);
    const shelterDetailData = await shelterDetailRes.json();
    assert.strictEqual(shelterDetailRes.status, 200);
    assert.strictEqual(shelterDetailData.data.id, testShelter.id);
    pass('GET /shelters/:id matches Flutter ShelterRepository.getShelterDetails contract');

    // GET /shelters/:id/reviews
    const reviewsRes = await fetch(`${BASE_URL}/shelters/${testShelter.id}/reviews`);
    const reviewsData = await reviewsRes.json();
    assert.strictEqual(reviewsRes.status, 200);
    assert.strictEqual(reviewsData.success, true);
    assert.ok(Array.isArray(reviewsData.data), 'Expected reviews array');
    pass('GET /shelters/:id/reviews matches Flutter ShelterRepository.getReviews contract');

    // -------------------------------------------------------------------------
    // 3. BOOKING CONTRACT AUDIT (booking_repository.dart)
    // -------------------------------------------------------------------------
    console.log('\n[3/8] Verifying Booking Module API Contract & State Security...');

    // Security check: Client attempting to create unauthorized initial status
    const illegalStatusRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        shelterId: testShelter.id,
        startDate: '2026-12-01T10:00:00.000Z',
        endDate: '2026-12-05T10:00:00.000Z',
        status: 'completed', // Client attempting to forge completed status
      }),
    });
    assert.strictEqual(illegalStatusRes.status, 400, 'Creation with status: completed must be rejected with 400');
    pass('Booking creation rejects unauthorized initial status (completed/in_progress) with 400');

    // Valid booking creation
    const validBookingRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        shelterId: testShelter.id,
        startDate: '2026-12-10T10:00:00.000Z',
        endDate: '2026-12-14T10:00:00.000Z',
        status: 'confirmed',
        addOns: ['Spa Session'],
      }),
    });
    const validBookingData = await validBookingRes.json();
    assert.strictEqual(validBookingRes.status, 201);
    assert.strictEqual(validBookingData.success, true);
    // Flutter Booking.fromMap verification
    const b = validBookingData.data;
    assert.ok(typeof b.id === 'string', 'Booking.id must be string');
    assert.strictEqual(b.shelterId, testShelter.id);
    assert.strictEqual(b.userId, testUser.id);
    assert.strictEqual(b.shelterName, testShelter.name);
    assert.ok(b.startDate && b.endDate, 'Booking dates must be present');
    assert.strictEqual(b.status, 'confirmed');
    assert.ok(typeof b.totalPrice === 'number', 'Booking totalPrice must be number');
    assert.ok(b.pricing && typeof b.pricing.subtotal === 'number', 'Booking pricing object must be nested');
    assert.ok(Array.isArray(b.addOns), 'Booking addOns must be array');
    pass('POST /bookings matches Flutter Booking.fromMap and Pricing contract');

    // Clean up created booking
    await pool.query('DELETE FROM bookings WHERE id = $1', [b.id]);

    // GET /bookings
    const listBookingsRes = await fetch(`${BASE_URL}/bookings`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const listBookingsData = await listBookingsRes.json();
    assert.strictEqual(listBookingsRes.status, 200);
    assert.ok(Array.isArray(listBookingsData.data), 'Expected bookings array');
    assert.ok(listBookingsRes.headers.get('X-Total-Count') !== null, 'Expected X-Total-Count header');
    pass('GET /bookings matches Flutter BookingRepository.getUserBookings + pagination headers');

    // GET /bookings/:id
    const singleBookingRes = await fetch(`${BASE_URL}/bookings/${testBooking.id}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const singleBookingData = await singleBookingRes.json();
    assert.strictEqual(singleBookingRes.status, 200);
    assert.strictEqual(singleBookingData.data.id, testBooking.id);
    pass('GET /bookings/:id matches Flutter BookingRepository.getBookingById');

    // PATCH /bookings/:id/status (Cancellation flow by customer)
    const cancelRes = await fetch(`${BASE_URL}/bookings/${testBooking.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    const cancelData = await cancelRes.json();
    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelData.data.status, 'cancelled');
    pass('PATCH /bookings/:id/status matches Flutter BookingRepository.cancelBooking');

    // -------------------------------------------------------------------------
    // 4. MESSAGING CONTRACT AUDIT (messaging_repository.dart)
    // -------------------------------------------------------------------------
    console.log('\n[4/8] Verifying Messaging Module API Contract...');

    // POST /bookings/:id/messages
    const sendMsgRes = await fetch(`${BASE_URL}/bookings/${testBooking.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ content: 'Hello shelter admin!' }),
    });
    const sendMsgData = await sendMsgRes.json();
    assert.strictEqual(sendMsgRes.status, 201);
    const m = sendMsgData.data;
    assert.ok(typeof m.id === 'string', 'Message.id must be string');
    assert.strictEqual(m.bookingId, testBooking.id);
    assert.strictEqual(m.senderId, testUser.id);
    assert.strictEqual(m.content, 'Hello shelter admin!');
    assert.strictEqual(m.isRead, false);
    assert.ok(m.createdAt, 'Message createdAt must exist');
    pass('POST /bookings/:id/messages matches Flutter MessageModel.fromMap');

    // GET /bookings/:id/messages
    const getMsgsRes = await fetch(`${BASE_URL}/bookings/${testBooking.id}/messages`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const getMsgsData = await getMsgsRes.json();
    assert.strictEqual(getMsgsRes.status, 200);
    assert.ok(Array.isArray(getMsgsData.data), 'Expected messages array');
    pass('GET /bookings/:id/messages matches Flutter MessagingRepository.getMessages');

    // POST /messages/global (Live facility chat)
    const sendGlobalRes = await fetch(`${BASE_URL}/messages/global`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ content: 'Live facility question' }),
    });
    const sendGlobalData = await sendGlobalRes.json();
    assert.strictEqual(sendGlobalRes.status, 201);
    assert.strictEqual(sendGlobalData.data.bookingId, 'global');
    pass('POST /messages/global matches Flutter MessagingRepository.sendGlobalMessage');

    // GET /messages/global
    const getGlobalRes = await fetch(`${BASE_URL}/messages/global`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const getGlobalData = await getGlobalRes.json();
    assert.strictEqual(getGlobalRes.status, 200);
    assert.ok(Array.isArray(getGlobalData.data), 'Expected global messages array');
    pass('GET /messages/global matches Flutter MessagingRepository.getGlobalMessages');

    // -------------------------------------------------------------------------
    // 5. ACTIVITIES CONTRACT AUDIT (report_repository.dart)
    // -------------------------------------------------------------------------
    console.log('\n[5/8] Verifying Activity Module API Contract...');

    // Insert an activity record directly to test contract
    const actRes = await pool.query(
      `INSERT INTO activities (booking_id, title, type, date, description, mood)
       VALUES ($1, 'Morning Walk', 'walk', '2026-11-11T09:00:00.000Z', 'Enjoyed the sunshine.', 'happy')
       RETURNING *`,
      [testBooking.id]
    );

    // GET /activities
    const activitiesRes = await fetch(`${BASE_URL}/activities`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const activitiesData = await activitiesRes.json();
    assert.strictEqual(activitiesRes.status, 200);
    assert.ok(Array.isArray(activitiesData.data), 'Expected activities array');
    const a = activitiesData.data[0];
    assert.ok(typeof a.id === 'string', 'Activity.id must be string');
    assert.ok(typeof a.title === 'string', 'Activity.title must be string');
    assert.ok(typeof a.type === 'string', 'Activity.type must be string');
    assert.ok(a.date, 'Activity.date must exist');
    pass('GET /activities matches Flutter Activity.fromMap contract');

    // GET /activities/live
    const liveActRes = await fetch(`${BASE_URL}/activities/live`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const liveActData = await liveActRes.json();
    assert.strictEqual(liveActRes.status, 200);
    assert.ok(Array.isArray(liveActData.data), 'Expected live activities array');
    pass('GET /activities/live matches Flutter ReportRepository.getLiveActivities');

    // -------------------------------------------------------------------------
    // 6. ADMIN CONTRACT AUDIT (admin_repository.dart)
    // -------------------------------------------------------------------------
    console.log('\n[6/8] Verifying Admin Module API Contract...');

    // PATCH /admin/shelters/:id/review
    const adminReviewRes = await fetch(`${BASE_URL}/admin/shelters/${testShelter.id}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ approvalStatus: 'approved' }),
    });
    const adminReviewData = await adminReviewRes.json();
    assert.strictEqual(adminReviewRes.status, 200);
    assert.strictEqual(adminReviewData.data.approvalStatus, 'approved');
    pass('PATCH /admin/shelters/:id/review matches Flutter AdminRepository.reviewShelter');

    // PATCH /admin/users/:id/role
    const adminRoleRes = await fetch(`${BASE_URL}/admin/users/${testUser.id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ role: 'customer' }),
    });
    const adminRoleData = await adminRoleRes.json();
    assert.strictEqual(adminRoleRes.status, 200);
    assert.strictEqual(adminRoleData.data.role, 'customer');
    pass('PATCH /admin/users/:id/role matches Flutter AdminRepository.updateUserRole');

    // -------------------------------------------------------------------------
    // 7. PET MODULE AUDIT (Category B: Backend Endpoint Ready for Flutter UI)
    // -------------------------------------------------------------------------
    console.log('\n[7/8] Verifying Pet Module API Contract (Category B)...');

    const petCreateRes = await fetch(`${BASE_URL}/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: 'Contract Test Dog',
        breed: 'Golden Retriever',
        age: 3,
        weight: 25.5,
      }),
    });
    const petCreateData = await petCreateRes.json();
    assert.strictEqual(petCreateRes.status, 201);
    testPet = petCreateData.data;
    assert.ok(typeof testPet.id === 'string', 'Pet.id must be string');
    assert.strictEqual(testPet.name, 'Contract Test Dog');
    assert.strictEqual(testPet.breed, 'Golden Retriever');
    assert.strictEqual(testPet.age, 3);
    assert.strictEqual(testPet.weight, 25.5);
    assert.strictEqual(testPet.ownerId, testUser.id);
    pass('POST /pets matches Flutter Pet.fromMap contract');

    const petListRes = await fetch(`${BASE_URL}/pets`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const petListData = await petListRes.json();
    assert.strictEqual(petListRes.status, 200);
    assert.ok(Array.isArray(petListData.data), 'Expected pets array');
    pass('GET /pets returns customer pet list');

    // -------------------------------------------------------------------------
    // 8. ERROR & HEALTH CONTRACT AUDIT
    // -------------------------------------------------------------------------
    console.log('\n[8/8] Verifying Error Contract & System Health...');

    // 401 Unauthorized shape
    const err401Res = await fetch(`${BASE_URL}/auth/me`);
    const err401Data = await err401Res.json();
    assert.strictEqual(err401Res.status, 401);
    assert.strictEqual(err401Data.success, false);
    assert.ok(err401Data.error && err401Data.message, 'Error shape must include success, error, message');
    pass('HTTP 401 error envelope conforms to ApiClient contract');

    // 404 Not Found shape
    const err404Res = await fetch(`${BASE_URL}/shelters/00000000-0000-0000-0000-000000000000`);
    const err404Data = await err404Res.json();
    assert.strictEqual(err404Res.status, 404);
    assert.strictEqual(err404Data.success, false);
    assert.ok(err404Data.error && err404Data.message);
    pass('HTTP 404 error envelope conforms to ApiClient contract');

    // Health endpoint
    const healthRes = await fetch(`${BASE_URL}/health/database`);
    const healthData = await healthRes.json();
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthData.success, true);
    assert.ok(healthData.databaseTime, 'Expected databaseTime in response');
    pass('GET /health/database operational (connected successfully)');

    console.log('================================================================');
    console.log(`ALL API CONTRACT CHECKS PASSED! (${passedAssertions} assertions passed)`);
    console.log('================================================================');
  } finally {
    await cleanupTestData();
  }
}

runContractAudit()
  .then(() => {
    console.log('Contract audit completed with 0 errors.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('API CONTRACT AUDIT FAILED:', err);
    process.exit(1);
  });
