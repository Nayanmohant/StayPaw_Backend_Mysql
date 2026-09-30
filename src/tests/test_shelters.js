const assert = require('assert');
const pool = require('../config/database');
const { generateToken } = require('../utils/jwt');

const BASE_URL = 'http://localhost:8080/api/v1';

let testCustomerUser = null;
let testShelterAdminUser = null;
let testOtherShelterAdmin = null;
let testSuperAdminUser = null;

let customerToken = null;
let shelterAdminToken = null;
let otherShelterAdminToken = null;
let superAdminToken = null;

let testShelter1 = null;
let testShelter2 = null;
let testShelterPending = null;
let testBooking = null;

let passedAssertions = 0;

function pass(msg) {
  passedAssertions++;
  console.log(`  ✓ PASS: ${msg}`);
}

async function setupTestData() {
  console.log('--- Setting up test data for Shelter tests ---');

  // 1. Create test users
  const custRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Shelter Test Customer', 'shelter_customer@test.com', 'customer', true)
     RETURNING *`
  );
  testCustomerUser = custRes.rows[0];
  customerToken = generateToken(testCustomerUser);

  const adminRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Shelter Admin One', 'shelter_admin1@test.com', 'shelter_admin', true)
     RETURNING *`
  );
  testShelterAdminUser = adminRes.rows[0];
  shelterAdminToken = generateToken(testShelterAdminUser);

  const otherAdminRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Shelter Admin Two', 'shelter_admin2@test.com', 'shelter_admin', true)
     RETURNING *`
  );
  testOtherShelterAdmin = otherAdminRes.rows[0];
  otherShelterAdminToken = generateToken(testOtherShelterAdmin);

  const superRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Super Admin User', 'super_admin@test.com', 'super_admin', true)
     RETURNING *`
  );
  testSuperAdminUser = superRes.rows[0];
  superAdminToken = generateToken(testSuperAdminUser);

  // 2. Create test shelters
  const shl1Res = await pool.query(
    `INSERT INTO shelters (
       admin_id, name, image_url, address, rating, distance,
       price_per_night, is_live, approval_status, description, reviews_count
     ) VALUES (
       $1, 'Paws Paradise Retreat', 'https://images.example.com/paws.jpg',
       '100 Oak St, San Francisco, CA', 4.8, 2.5, 65.0, true, 'approved',
       'Premier dog resort with suites and outdoor play yards.', 10
     ) RETURNING *`,
    [testShelterAdminUser.id]
  );
  testShelter1 = shl1Res.rows[0];

  const shl2Res = await pool.query(
    `INSERT INTO shelters (
       admin_id, name, image_url, address, rating, distance,
       price_per_night, is_live, approval_status, description, reviews_count
     ) VALUES (
       $1, 'Furry Haven Hotel', 'https://images.example.com/haven.jpg',
       '250 Pine St, Oakland, CA', 4.2, 5.0, 95.0, false, 'approved',
       'Peaceful boarding with private climate controlled suites.', 5
     ) RETURNING *`,
    [testOtherShelterAdmin.id]
  );
  testShelter2 = shl2Res.rows[0];

  const shlPendingRes = await pool.query(
    `INSERT INTO shelters (
       admin_id, name, image_url, address, rating, distance,
       price_per_night, is_live, approval_status, description
     ) VALUES (
       $1, 'Pending Approval Lodge', 'https://images.example.com/pending.jpg',
       '999 Maple St, San Jose, CA', 0.0, 15.0, 50.0, false, 'pending',
       'Newly submitted facility awaiting admin review.'
     ) RETURNING *`,
    [testShelterAdminUser.id]
  );
  testShelterPending = shlPendingRes.rows[0];

  // 3. Create a test booking on testShelter1 for availability testing
  const bookingRes = await pool.query(
    `INSERT INTO bookings (
       user_id, shelter_id, shelter_name, shelter_image,
       start_date, end_date, status, subtotal, tax, service_fee, total_price
     ) VALUES (
       $1, $2, 'Paws Paradise Retreat', 'https://images.example.com/paws.jpg',
       '2026-11-10T10:00:00Z', '2026-11-15T18:00:00Z', 'confirmed',
       300.0, 25.0, 10.0, 335.0
     ) RETURNING *`,
    [testCustomerUser.id, testShelter1.id]
  );
  testBooking = bookingRes.rows[0];

  // 4. Create an activity tied to this booking
  await pool.query(
    `INSERT INTO activities (
       booking_id, date, type, title, description, mood, photo_url, time_label
     ) VALUES (
       $1, '2026-11-11T12:00:00Z', 'play', 'Yard Playtime',
       'Had fun chasing tennis balls with friends', 'happy', 'https://photos.example.com/play.jpg', '12:00 PM'
     )`,
    [testBooking.id]
  );

  console.log('Test data created successfully.');
}

async function cleanupTestData() {
  console.log('\nCleaning up test data...');
  if (testShelter1 || testShelter2 || testShelterPending) {
    await pool.query(
      `DELETE FROM activities WHERE booking_id IN (
         SELECT id FROM bookings WHERE shelter_id IN ($1, $2, $3)
       )`,
      [testShelter1?.id, testShelter2?.id, testShelterPending?.id]
    );
    await pool.query(
      `DELETE FROM reviews WHERE shelter_id IN ($1, $2, $3)`,
      [testShelter1?.id, testShelter2?.id, testShelterPending?.id]
    );
    await pool.query(
      `DELETE FROM bookings WHERE shelter_id IN ($1, $2, $3)`,
      [testShelter1?.id, testShelter2?.id, testShelterPending?.id]
    );
    await pool.query(
      `DELETE FROM shelters WHERE id IN ($1, $2, $3) OR name LIKE 'Created Admin%'`,
      [testShelter1?.id, testShelter2?.id, testShelterPending?.id]
    );
  }

  if (testCustomerUser || testShelterAdminUser || testOtherShelterAdmin || testSuperAdminUser) {
    await pool.query(
      `DELETE FROM users WHERE id IN ($1, $2, $3, $4)`,
      [
        testCustomerUser?.id,
        testShelterAdminUser?.id,
        testOtherShelterAdmin?.id,
        testSuperAdminUser?.id,
      ]
    );
  }
  console.log('Cleanup finished.');
}

async function runShelterTests() {
  console.log('====================================================');
  console.log('           STAYPAW SHELTER API TEST SUITE           ');
  console.log('====================================================');

  try {
    await setupTestData();

    // -------------------------------------------------------------------------
    // SECTION 1: PUBLIC SHELTER LISTING & FILTERING
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 1: PUBLIC SHELTER LISTING & FILTERING ---');

    // Test 1: List shelters (public, returns approved shelters)
    console.log('Test 1: List approved shelters without filters');
    const listRes = await fetch(`${BASE_URL}/shelters`);
    const listData = await listRes.json();
    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(listData.success, true);
    assert.ok(Array.isArray(listData.data), 'Expected data to be an Array (Flutter requirement)');
    pass('Returns HTTP 200 and data is an Array');

    // Verify pending shelters are not exposed to default public listing
    const hasPending = listData.data.some((s) => s.id === testShelterPending.id);
    assert.strictEqual(hasPending, false, 'Pending shelters should not appear in default public listing');
    pass('Default public listing excludes pending approval shelters');

    // Test 2: Search filter
    console.log('Test 2: Search filter matching shelter name');
    const searchRes = await fetch(`${BASE_URL}/shelters?search=Paradise`);
    const searchData = await searchRes.json();
    assert.strictEqual(searchRes.status, 200);
    assert.ok(searchData.data.some((s) => s.id === testShelter1.id));
    assert.ok(!searchData.data.some((s) => s.id === testShelter2.id));
    pass('Search filter correctly filters by keyword');

    // Test 3: Filter by isLive
    console.log('Test 3: Filter by isLive=true');
    const liveRes = await fetch(`${BASE_URL}/shelters?isLive=true`);
    const liveData = await liveRes.json();
    assert.strictEqual(liveRes.status, 200);
    assert.ok(liveData.data.every((s) => s.isLive === true));
    assert.ok(liveData.data.some((s) => s.id === testShelter1.id));
    assert.ok(!liveData.data.some((s) => s.id === testShelter2.id));
    pass('isLive=true filter returns only shelters with active live stream');

    // Test 4: Filter by minRating
    console.log('Test 4: Filter by minRating=4.5');
    const ratingRes = await fetch(`${BASE_URL}/shelters?minRating=4.5`);
    const ratingData = await ratingRes.json();
    assert.strictEqual(ratingRes.status, 200);
    assert.ok(ratingData.data.every((s) => s.rating >= 4.5));
    assert.ok(ratingData.data.some((s) => s.id === testShelter1.id));
    assert.ok(!ratingData.data.some((s) => s.id === testShelter2.id));
    pass('minRating filter correctly restricts shelters by minimum rating');

    // Test 5: Filter by maxPrice
    console.log('Test 5: Filter by maxPrice=70.0');
    const priceRes = await fetch(`${BASE_URL}/shelters?maxPrice=70.0`);
    const priceData = await priceRes.json();
    assert.strictEqual(priceRes.status, 200);
    assert.ok(priceData.data.every((s) => s.pricePerNight <= 70.0));
    assert.ok(priceData.data.some((s) => s.id === testShelter1.id));
    assert.ok(!priceData.data.some((s) => s.id === testShelter2.id));
    pass('maxPrice filter correctly restricts shelters by pricePerNight');

    // Test 6: Sort by price_asc
    console.log('Test 6: Sort shelters by price_asc');
    const sortRes = await fetch(`${BASE_URL}/shelters?sortBy=price_asc`);
    const sortData = await sortRes.json();
    assert.strictEqual(sortRes.status, 200);
    for (let i = 1; i < sortData.data.length; i++) {
      assert.ok(sortData.data[i].pricePerNight >= sortData.data[i - 1].pricePerNight);
    }
    pass('sortBy=price_asc orders shelters ascending by price');

    // Test 7: Pagination headers
    console.log('Test 7: Pagination headers returned');
    assert.ok(listRes.headers.get('x-total-count') !== null);
    assert.ok(listRes.headers.get('x-page') !== null);
    assert.ok(listRes.headers.get('x-limit') !== null);
    pass('Pagination headers X-Total-Count, X-Page, X-Limit present');

    // -------------------------------------------------------------------------
    // SECTION 2: SHELTER DETAILS & FLUTTER COMPATIBILITY
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 2: SHELTER DETAILS & FLUTTER COMPATIBILITY ---');

    // Test 8: Get shelter by ID
    console.log('Test 8: Get shelter details by ID');
    const detailRes = await fetch(`${BASE_URL}/shelters/${testShelter1.id}`);
    const detailData = await detailRes.json();
    assert.strictEqual(detailRes.status, 200);
    assert.strictEqual(detailData.success, true);
    const shl = detailData.data;

    // Verify all Flutter Shelter model fields
    assert.strictEqual(shl.id, testShelter1.id);
    assert.strictEqual(shl.name, 'Paws Paradise Retreat');
    assert.strictEqual(shl.imageUrl, 'https://images.example.com/paws.jpg');
    assert.strictEqual(shl.address, '100 Oak St, San Francisco, CA');
    assert.strictEqual(typeof shl.rating, 'number');
    assert.strictEqual(typeof shl.distance, 'number');
    assert.strictEqual(typeof shl.pricePerNight, 'number');
    assert.strictEqual(shl.isLive, true);
    assert.strictEqual(shl.adminId, testShelterAdminUser.id);
    assert.strictEqual(shl.approvalStatus, 'approved');
    assert.ok(Array.isArray(shl.availableAddOns));
    assert.strictEqual(typeof shl.reviewsCount, 'number');
    pass('Shelter details match exact Flutter Shelter model contract');

    // Test 9: Nonexistent shelter ID returns 404
    console.log('Test 9: Nonexistent shelter ID returns 404');
    const notFoundRes = await fetch(`${BASE_URL}/shelters/00000000-0000-0000-0000-000000000000`);
    const notFoundData = await notFoundRes.json();
    assert.strictEqual(notFoundRes.status, 404);
    assert.strictEqual(notFoundData.success, false);
    assert.strictEqual(notFoundData.error, 'SHELTER_NOT_FOUND');
    pass('Nonexistent shelter ID returns 404 SHELTER_NOT_FOUND');

    // -------------------------------------------------------------------------
    // SECTION 3: REVIEWS & RATINGS RECALCULATION
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 3: REVIEWS & RATINGS ---');

    // Test 10: Get shelter reviews (initially empty)
    console.log('Test 10: Get shelter reviews');
    const revRes = await fetch(`${BASE_URL}/shelters/${testShelter1.id}/reviews`);
    const revData = await revRes.json();
    assert.strictEqual(revRes.status, 200);
    assert.strictEqual(revData.success, true);
    assert.ok(Array.isArray(revData.data));
    pass('GET /shelters/:id/reviews returns reviews list');

    // Test 11: Submit review requires authentication
    console.log('Test 11: Submit review without auth token -> 401');
    const unauthRev = await fetch(`${BASE_URL}/shelters/${testShelter1.id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5, comment: 'Great place!' }),
    });
    assert.strictEqual(unauthRev.status, 401);
    pass('Review creation without token rejected with 401');

    // Test 12: Submit review with invalid rating range (< 1 or > 5)
    console.log('Test 12: Submit review with invalid rating (6) -> 400');
    const invalidRatingRes = await fetch(`${BASE_URL}/shelters/${testShelter1.id}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ rating: 6, comment: 'Impossible rating' }),
    });
    assert.strictEqual(invalidRatingRes.status, 400);
    pass('Invalid rating > 5 rejected with 400 VALIDATION_ERROR');

    // Test 13: Submit valid review (authenticated customer)
    console.log('Test 13: Submit valid review -> 201 Created');
    const postRevRes = await fetch(`${BASE_URL}/shelters/${testShelter1.id}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ rating: 5.0, comment: 'Amazing facility and staff!' }),
    });
    const postRevData = await postRevRes.json();
    assert.strictEqual(postRevRes.status, 201);
    assert.strictEqual(postRevData.success, true);
    assert.strictEqual(postRevData.data.rating, 5.0);
    assert.strictEqual(postRevData.data.comment, 'Amazing facility and staff!');
    assert.strictEqual(postRevData.data.userName, 'Shelter Test Customer');
    assert.strictEqual(postRevData.data.shelterId, testShelter1.id);
    pass('Valid review created and returns exact Flutter Review contract');

    // Test 14: Recalculation of shelter rating & reviews_count in database
    console.log('Test 14: Verify shelter aggregate rating updated in database');
    const updatedShlRes = await pool.query('SELECT rating, reviews_count FROM shelters WHERE id = $1', [
      testShelter1.id,
    ]);
    const updatedShlRow = updatedShlRes.rows[0];
    assert.strictEqual(parseFloat(updatedShlRow.rating), 5.0);
    assert.strictEqual(parseInt(updatedShlRow.reviews_count, 10), 1);
    pass('Shelter average rating and reviews_count automatically recalculated');

    // -------------------------------------------------------------------------
    // SECTION 4: SHELTER AVAILABILITY
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 4: SHELTER AVAILABILITY ---');

    // Test 15: Check availability without dates -> 400
    console.log('Test 15: Missing date parameters -> 400');
    const missingDateRes = await fetch(`${BASE_URL}/shelters/${testShelter1.id}/availability`);
    assert.strictEqual(missingDateRes.status, 400);
    pass('Missing date query parameters returns 400 Bad Request');

    // Test 16: Check availability with invalid range (endDate <= startDate) -> 400
    console.log('Test 16: Invalid date range (end <= start) -> 400');
    const invalidDatesRes = await fetch(
      `${BASE_URL}/shelters/${testShelter1.id}/availability?startDate=2026-11-20T10:00:00Z&endDate=2026-11-19T10:00:00Z`
    );
    assert.strictEqual(invalidDatesRes.status, 400);
    pass('Invalid date range returns 400 VALIDATION_ERROR');

    // Test 17: Check availability for open dates (no booking overlap) -> isAvailable = true
    console.log('Test 17: Open dates without conflicts -> isAvailable: true');
    const openRes = await fetch(
      `${BASE_URL}/shelters/${testShelter1.id}/availability?startDate=2026-11-01T10:00:00Z&endDate=2026-11-05T10:00:00Z`
    );
    const openData = await openRes.json();
    assert.strictEqual(openRes.status, 200);
    assert.strictEqual(openData.success, true);
    assert.strictEqual(openData.data.isAvailable, true);
    assert.strictEqual(openData.data.conflictingBookings, 0);
    pass('Open dates return isAvailable: true and 0 conflicts');

    // Test 18: Check availability overlapping with existing confirmed booking (Nov 10 - Nov 15) -> isAvailable = false
    console.log('Test 18: Overlapping dates with confirmed booking -> isAvailable: false');
    const overlapRes = await fetch(
      `${BASE_URL}/shelters/${testShelter1.id}/availability?startDate=2026-11-12T10:00:00Z&endDate=2026-11-18T10:00:00Z`
    );
    const overlapData = await overlapRes.json();
    assert.strictEqual(overlapRes.status, 200);
    assert.strictEqual(overlapData.success, true);
    assert.strictEqual(overlapData.data.isAvailable, false);
    assert.strictEqual(overlapData.data.conflictingBookings, 1);
    pass('Conflicting date range correctly detects overlapping booking');

    // -------------------------------------------------------------------------
    // SECTION 5: SHELTER ACTIVITIES
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 5: SHELTER ACTIVITIES ---');

    // Test 19: Get care activities associated with shelter bookings
    console.log('Test 19: Get activities for shelter');
    const actRes = await fetch(`${BASE_URL}/shelters/${testShelter1.id}/activities`);
    const actData = await actRes.json();
    assert.strictEqual(actRes.status, 200);
    assert.strictEqual(actData.success, true);
    assert.ok(Array.isArray(actData.data));
    assert.strictEqual(actData.data.length, 1);
    const act = actData.data[0];
    assert.strictEqual(act.type, 'play');
    assert.strictEqual(act.title, 'Yard Playtime');
    assert.strictEqual(act.mood, 'happy');
    assert.strictEqual(act.bookingId, testBooking.id);
    pass('Shelter activities endpoint returns activities with exact Flutter Activity contract');

    // -------------------------------------------------------------------------
    // SECTION 6: SHELTER MANAGEMENT & AUTHORIZATION
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 6: SHELTER MANAGEMENT & AUTHORIZATION ---');

    // Test 20: Create shelter forbidden for normal customer (403)
    console.log('Test 20: Customer cannot create shelter -> 403 Forbidden');
    const custCreateRes = await fetch(`${BASE_URL}/shelters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ name: 'Unauthorized Shelter', pricePerNight: 50 }),
    });
    assert.strictEqual(custCreateRes.status, 403);
    pass('Customer role forbidden from creating shelters (403 AUTH_FORBIDDEN)');

    // Test 21: Create shelter by shelter_admin
    console.log('Test 21: shelter_admin creates new shelter -> 201 Created');
    const adminCreateRes = await fetch(`${BASE_URL}/shelters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${shelterAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Created Admin Shelter',
        address: '555 Pine Rd, Berkeley, CA',
        pricePerNight: 80.0,
        description: 'New pet facility',
        isLive: true,
      }),
    });
    const adminCreateData = await adminCreateRes.json();
    assert.strictEqual(adminCreateRes.status, 201);
    assert.strictEqual(adminCreateData.success, true);
    assert.strictEqual(adminCreateData.data.name, 'Created Admin Shelter');
    assert.strictEqual(adminCreateData.data.adminId, testShelterAdminUser.id);
    const createdShelterId = adminCreateData.data.id;
    pass('shelter_admin successfully creates shelter');

    // Test 22: Update shelter forbidden for non-owner shelter_admin (403)
    console.log('Test 22: Non-owner shelter_admin cannot update shelter -> 403 Forbidden');
    const otherAdminUpdateRes = await fetch(`${BASE_URL}/shelters/${createdShelterId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherShelterAdminToken}`,
      },
      body: JSON.stringify({ name: 'Hijacked Shelter' }),
    });
    assert.strictEqual(otherAdminUpdateRes.status, 403);
    pass('Non-owner shelter_admin cannot modify another admin shelter (403)');

    // Test 23: Update shelter by owner shelter_admin (200)
    console.log('Test 23: Owner shelter_admin updates shelter -> 200 OK');
    const ownerUpdateRes = await fetch(`${BASE_URL}/shelters/${createdShelterId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${shelterAdminToken}`,
      },
      body: JSON.stringify({ name: 'Updated Admin Shelter', pricePerNight: 85.0 }),
    });
    const ownerUpdateData = await ownerUpdateRes.json();
    assert.strictEqual(ownerUpdateRes.status, 200);
    assert.strictEqual(ownerUpdateData.data.name, 'Updated Admin Shelter');
    assert.strictEqual(ownerUpdateData.data.pricePerNight, 85.0);
    pass('Owner shelter_admin successfully updates shelter');

    // -------------------------------------------------------------------------
    // SECTION 7: ADMIN OPERATIONS (REVIEW & ROLE ASSIGNMENT)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 7: ADMIN OPERATIONS ---');

    // Test 24: Review shelter forbidden for customer (403)
    console.log('Test 24: Customer review shelter -> 403 Forbidden');
    const custReviewRes = await fetch(`${BASE_URL}/admin/shelters/${testShelterPending.id}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ approvalStatus: 'approved' }),
    });
    assert.strictEqual(custReviewRes.status, 403);
    pass('Customer role forbidden from admin shelter review (403)');

    // Test 25: Review shelter with invalid status -> 400
    console.log('Test 25: Admin review with invalid status -> 400');
    const invalidStatusRes = await fetch(`${BASE_URL}/admin/shelters/${testShelterPending.id}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ approvalStatus: 'unknown_status' }),
    });
    assert.strictEqual(invalidStatusRes.status, 400);
    pass('Invalid approvalStatus rejected with 400 VALIDATION_ERROR');

    // Test 26: Review shelter by admin -> approves shelter (200)
    console.log('Test 26: Admin approves pending shelter -> 200 OK');
    const approveRes = await fetch(`${BASE_URL}/admin/shelters/${testShelterPending.id}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ approvalStatus: 'approved' }),
    });
    const approveData = await approveRes.json();
    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveData.success, true);
    assert.strictEqual(approveData.data.approvalStatus, 'approved');
    pass('Admin review successfully sets approvalStatus to approved');

    // Verify it now appears in public shelter list
    const publicAfterApproveRes = await fetch(`${BASE_URL}/shelters`);
    const publicAfterApproveData = await publicAfterApproveRes.json();
    assert.ok(publicAfterApproveData.data.some((s) => s.id === testShelterPending.id));
    pass('Newly approved shelter now appears in public shelter listing');

    // Test 27: Assign user role forbidden for shelter_admin (403)
    console.log('Test 27: Assign user role forbidden for shelter_admin -> 403');
    const shelterAdminAssignRes = await fetch(`${BASE_URL}/admin/users/${testCustomerUser.id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${shelterAdminToken}`,
      },
      body: JSON.stringify({ role: 'shelter_admin' }),
    });
    assert.strictEqual(shelterAdminAssignRes.status, 403);
    pass('shelter_admin forbidden from assigning user roles (403 AUTH_FORBIDDEN)');

    // Test 28: Assign user role by super_admin -> 200 OK
    console.log('Test 28: super_admin assigns shelter_admin role -> 200 OK');
    const superAdminAssignRes = await fetch(`${BASE_URL}/admin/users/${testCustomerUser.id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ role: 'shelter_admin' }),
    });
    const superAdminAssignData = await superAdminAssignRes.json();
    assert.strictEqual(superAdminAssignRes.status, 200);
    assert.strictEqual(superAdminAssignData.success, true);
    assert.strictEqual(superAdminAssignData.data.role, 'shelter_admin');
    pass('super_admin successfully updates user role');

    // Test 29: Delete shelter by super_admin -> 200 OK
    console.log('Test 29: super_admin deletes shelter -> 200 OK');
    const deleteRes = await fetch(`${BASE_URL}/shelters/${createdShelterId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });
    assert.strictEqual(deleteRes.status, 200);
    pass('super_admin successfully deletes shelter');

    // Verify deleted shelter no longer exists
    const checkDeletedRes = await fetch(`${BASE_URL}/shelters/${createdShelterId}`);
    assert.strictEqual(checkDeletedRes.status, 404);
    pass('Deleted shelter returns 404 Not Found');

    console.log('\n====================================================');
    console.log(`ALL SHELTER TESTS PASSED! (${passedAssertions}/${passedAssertions} assertions passed)`);
    console.log('====================================================');
  } finally {
    await cleanupTestData();
  }
}

if (require.main === module) {
  runShelterTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Shelter test failure:', err);
      process.exit(1);
    });
}

module.exports = { runShelterTests };
