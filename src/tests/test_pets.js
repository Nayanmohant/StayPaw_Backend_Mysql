const assert = require('assert');
const pool = require('../config/database');
const { generateToken } = require('../utils/jwt');

const BASE_URL = 'http://localhost:8080/api/v1';

let testCustomerA = null;
let testCustomerB = null;
let testSuperAdmin = null;

let tokenCustomerA = null;
let tokenCustomerB = null;
let tokenSuperAdmin = null;

let createdPetId = null;
let passedAssertions = 0;

function pass(msg) {
  passedAssertions++;
  console.log(`  ✓ PASS: ${msg}`);
}

async function setupTestData() {
  console.log('--- Setting up test data for Pet tests ---');

  const custARes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Pet Owner A', 'pet_owner_a@test.com', 'customer', true)
     RETURNING *`
  );
  testCustomerA = custARes.rows[0];
  tokenCustomerA = generateToken(testCustomerA);

  const custBRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Pet Owner B', 'pet_owner_b@test.com', 'customer', true)
     RETURNING *`
  );
  testCustomerB = custBRes.rows[0];
  tokenCustomerB = generateToken(testCustomerB);

  const superRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Pet Super Admin', 'pet_super_admin@test.com', 'super_admin', true)
     RETURNING *`
  );
  testSuperAdmin = superRes.rows[0];
  tokenSuperAdmin = generateToken(testSuperAdmin);

  console.log('Pet test data created successfully.');
}

async function cleanupTestData() {
  console.log('\nCleaning up pet test data...');
  if (testCustomerA || testCustomerB || testSuperAdmin) {
    await pool.query(
      'DELETE FROM pets WHERE owner_id IN ($1, $2, $3)',
      [testCustomerA?.id, testCustomerB?.id, testSuperAdmin?.id]
    );
    await pool.query(
      'DELETE FROM users WHERE id IN ($1, $2, $3)',
      [testCustomerA?.id, testCustomerB?.id, testSuperAdmin?.id]
    );
  }
  console.log('Cleanup finished.');
}

async function runPetTests() {
  console.log('====================================================');
  console.log('             STAYPAW PET API TEST SUITE             ');
  console.log('====================================================');

  try {
    await setupTestData();

    // -------------------------------------------------------------------------
    // SECTION 1: AUTHENTICATION & VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 1: AUTHENTICATION & VALIDATION ---');

    // Test 1: Unauthenticated request rejected -> 401
    console.log('Test 1: Unauthenticated pet creation -> 401 Unauthorized');
    const unauthRes = await fetch(`${BASE_URL}/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rex', breed: 'Golden Retriever' }),
    });
    assert.strictEqual(unauthRes.status, 401);
    pass('Unauthenticated pet request rejected with 401');

    // Test 2: Missing required name -> 400
    console.log('Test 2: Missing pet name -> 400 Bad Request');
    const missingNameRes = await fetch(`${BASE_URL}/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({ breed: 'Golden Retriever' }),
    });
    assert.strictEqual(missingNameRes.status, 400);
    pass('Missing pet name rejected with 400 VALIDATION_ERROR');

    // Test 3: Invalid age (negative) -> 400
    console.log('Test 3: Negative pet age -> 400 Bad Request');
    const invalidAgeRes = await fetch(`${BASE_URL}/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({ name: 'Rex', age: -2 }),
    });
    assert.strictEqual(invalidAgeRes.status, 400);
    pass('Negative pet age rejected with 400 VALIDATION_ERROR');

    // Test 4: Invalid weight (negative) -> 400
    console.log('Test 4: Negative pet weight -> 400 Bad Request');
    const invalidWeightRes = await fetch(`${BASE_URL}/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({ name: 'Rex', weight: -10.5 }),
    });
    assert.strictEqual(invalidWeightRes.status, 400);
    pass('Negative pet weight rejected with 400 VALIDATION_ERROR');

    // -------------------------------------------------------------------------
    // SECTION 2: PET CREATION & OWNERSHIP
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 2: PET CREATION & OWNERSHIP ---');

    // Test 5: Valid pet creation + anti-spoofing
    console.log('Test 5: Create pet with anti-spoofing enforcement');
    const createRes = await fetch(`${BASE_URL}/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({
        name: 'Buddy',
        breed: 'Labrador Retriever',
        age: 3,
        weight: 28.5,
        photoUrl: 'https://images.example.com/buddy.jpg',
        ownerId: testCustomerB.id, // Attempt to spoof owner to Customer B
      }),
    });
    const createData = await createRes.json();
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createData.success, true);

    const pet = createData.data;
    createdPetId = pet.id;

    // Verify model fields match Flutter Pet contract
    assert.ok(pet.id);
    assert.strictEqual(pet.ownerId, testCustomerA.id); // Must come from JWT, ignoring Customer B spoof
    assert.strictEqual(pet.name, 'Buddy');
    assert.strictEqual(pet.breed, 'Labrador Retriever');
    assert.strictEqual(pet.age, 3);
    assert.strictEqual(pet.weight, 28.5);
    assert.strictEqual(pet.photoUrl, 'https://images.example.com/buddy.jpg');
    assert.ok(pet.createdAt);
    pass('Pet created with HTTP 201; ownerId strictly derived from JWT');

    // Test 6: Verify in PostgreSQL database
    console.log('Test 6: Verify pet record in PostgreSQL database');
    const dbPetRes = await pool.query('SELECT * FROM pets WHERE id = $1', [createdPetId]);
    assert.strictEqual(dbPetRes.rows.length, 1);
    assert.strictEqual(dbPetRes.rows[0].owner_id, testCustomerA.id);
    assert.strictEqual(dbPetRes.rows[0].name, 'Buddy');
    pass('Pet record verified in PostgreSQL database');

    // -------------------------------------------------------------------------
    // SECTION 3: LISTING & ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 3: LISTING & ISOLATION ---');

    // Test 7: Customer A lists their pets
    console.log('Test 7: Customer A retrieves pet list');
    const listResA = await fetch(`${BASE_URL}/pets`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const listDataA = await listResA.json();
    assert.strictEqual(listResA.status, 200);
    assert.strictEqual(listDataA.success, true);
    assert.ok(Array.isArray(listDataA.data));
    assert.strictEqual(listDataA.data.length, 1);
    assert.strictEqual(listDataA.data[0].id, createdPetId);
    pass('Customer A receives their pet list array');

    // Test 8: Customer B sees an empty list (isolation)
    console.log('Test 8: Customer B pet list is isolated (empty)');
    const listResB = await fetch(`${BASE_URL}/pets`, {
      headers: { Authorization: `Bearer ${tokenCustomerB}` },
    });
    const listDataB = await listResB.json();
    assert.strictEqual(listResB.status, 200);
    assert.strictEqual(listDataB.data.length, 0);
    pass('Customer B cannot see Customer A pets');

    // Test 9: Customer B attempting spoof query ?ownerId=CustomerA still returns only Customer B pets
    console.log('Test 9: Spoofed ownerId query parameter ignored for customer');
    const spoofListRes = await fetch(`${BASE_URL}/pets?ownerId=${testCustomerA.id}`, {
      headers: { Authorization: `Bearer ${tokenCustomerB}` },
    });
    const spoofListData = await spoofListRes.json();
    assert.strictEqual(spoofListRes.status, 200);
    assert.strictEqual(spoofListData.data.length, 0);
    pass('Query isolation enforced regardless of ?ownerId parameter');

    // -------------------------------------------------------------------------
    // SECTION 4: DETAILS, UPDATES & ACCESS CONTROL
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 4: DETAILS, UPDATES & ACCESS CONTROL ---');

    // Test 10: Owner retrieves pet details
    console.log('Test 10: Owner retrieves pet details');
    const detailResA = await fetch(`${BASE_URL}/pets/${createdPetId}`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const detailDataA = await detailResA.json();
    assert.strictEqual(detailResA.status, 200);
    assert.strictEqual(detailDataA.data.id, createdPetId);
    assert.strictEqual(detailDataA.data.name, 'Buddy');
    pass('Owner successfully retrieves pet details');

    // Test 11: Non-owner Customer B accessing pet details -> 403 Forbidden
    console.log('Test 11: Non-owner Customer B accessing pet details -> 403 Forbidden');
    const unauthDetailRes = await fetch(`${BASE_URL}/pets/${createdPetId}`, {
      headers: { Authorization: `Bearer ${tokenCustomerB}` },
    });
    assert.strictEqual(unauthDetailRes.status, 403);
    pass('Non-owner access blocked with 403 AUTH_FORBIDDEN');

    // Test 12: Nonexistent pet ID returns 404
    console.log('Test 12: Nonexistent pet ID -> 404 Not Found');
    const nonExistRes = await fetch(`${BASE_URL}/pets/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    assert.strictEqual(nonExistRes.status, 404);
    pass('Nonexistent pet returns 404 PET_NOT_FOUND');

    // Test 13: Non-owner Customer B updating pet -> 403 Forbidden
    console.log('Test 13: Non-owner Customer B updating pet -> 403 Forbidden');
    const unauthUpdateRes = await fetch(`${BASE_URL}/pets/${createdPetId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerB}`,
      },
      body: JSON.stringify({ name: 'Hijacked Pet' }),
    });
    assert.strictEqual(unauthUpdateRes.status, 403);
    pass('Non-owner pet update blocked with 403 AUTH_FORBIDDEN');

    // Test 14: Owner Customer A updates pet details
    console.log('Test 14: Owner updates pet details');
    const updateResA = await fetch(`${BASE_URL}/pets/${createdPetId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({
        weight: 30.0,
        age: 4,
      }),
    });
    const updateDataA = await updateResA.json();
    assert.strictEqual(updateResA.status, 200);
    assert.strictEqual(updateDataA.success, true);
    assert.strictEqual(updateDataA.data.weight, 30.0);
    assert.strictEqual(updateDataA.data.age, 4);
    pass('Owner successfully updates pet details');

    // -------------------------------------------------------------------------
    // SECTION 5: DELETION & SUPER ADMIN
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 5: DELETION & SUPER ADMIN ---');

    // Test 15: Non-owner Customer B deleting pet -> 403 Forbidden
    console.log('Test 15: Non-owner Customer B deleting pet -> 403 Forbidden');
    const unauthDeleteRes = await fetch(`${BASE_URL}/pets/${createdPetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenCustomerB}` },
    });
    assert.strictEqual(unauthDeleteRes.status, 403);
    pass('Non-owner pet deletion blocked with 403 AUTH_FORBIDDEN');

    // Test 16: Super Admin can view pet details
    console.log('Test 16: Super Admin retrieves pet details');
    const superDetailRes = await fetch(`${BASE_URL}/pets/${createdPetId}`, {
      headers: { Authorization: `Bearer ${tokenSuperAdmin}` },
    });
    assert.strictEqual(superDetailRes.status, 200);
    pass('Super Admin successfully views pet details');

    // Test 17: Owner Customer A deletes pet -> 200 OK
    console.log('Test 17: Owner deletes pet -> 200 OK');
    const deleteResA = await fetch(`${BASE_URL}/pets/${createdPetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    assert.strictEqual(deleteResA.status, 200);
    pass('Owner successfully deletes pet profile');

    // Verify pet is no longer found in database
    const checkDeletedRes = await fetch(`${BASE_URL}/pets/${createdPetId}`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    assert.strictEqual(checkDeletedRes.status, 404);
    pass('Deleted pet returns 404 Not Found');

    // Test 18: Database health check
    console.log('Test 18: Database health check operational');
    const healthRes = await fetch(`${BASE_URL}/health/database`);
    assert.strictEqual(healthRes.status, 200);
    pass('Database health check returns HTTP 200 OK');

    console.log('\n====================================================');
    console.log(`ALL PET TESTS PASSED! (${passedAssertions}/${passedAssertions} assertions passed)`);
    console.log('====================================================');
  } finally {
    await cleanupTestData();
  }
}

if (require.main === module) {
  runPetTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Pet test failure:', err);
      process.exit(1);
    });
}

module.exports = { runPetTests };
