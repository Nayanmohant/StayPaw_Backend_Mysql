const pool = require('../config/database');

const BASE_URL = 'http://localhost:8080/api/v1/auth';

async function runTests() {
  console.log('====================================================');
  console.log('        STAYPAW AUTHENTICATION TEST SUITE          ');
  console.log('====================================================\n');

  const testEmail = `testuser_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Jane StayPaw';
  let jwtToken = null;
  let createdUserId = null;

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Register New User
    // -------------------------------------------------------------
    console.log('Test 1: Register New User');
    const regRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: testName,
        email: testEmail,
        password: testPassword,
      }),
    });
    const regData = await regRes.json();

    assert(regRes.status === 201, `Status code is 201 (got ${regRes.status})`);
    assert(regData.success === true, 'Response contains success: true');
    assert(regData.data && typeof regData.data.token === 'string', 'Returns JWT token string');
    assert(regData.data.user && regData.data.user.email === testEmail.toLowerCase(), 'User email matches (lowercased)');
    assert(regData.data.user.role === 'customer', 'User role defaults to customer');
    assert(regData.data.user.password_hash === undefined, 'password_hash is NOT exposed in response');
    assert(regData.data.user.password === undefined, 'password is NOT exposed in response');
    assert(regData.data.user.id && regData.data.user.id.length === 36, 'User ID is 36-char UUID');
    assert(typeof regData.data.user.phoneNumber === 'string', 'phoneNumber field is present (camelCase)');
    assert(typeof regData.data.user.isAdminApproved === 'boolean', 'isAdminApproved is present (camelCase)');

    jwtToken = regData.data.token;
    createdUserId = regData.data.user.id;
    console.log(`  -> Registered user id: ${createdUserId}\n`);

    // -------------------------------------------------------------
    // Test 2: Verify PostgreSQL records for created user
    // -------------------------------------------------------------
    console.log('Test 2: PostgreSQL Database Verification for Registered User');
    const userDbRes = await pool.query('SELECT * FROM users WHERE id = $1', [createdUserId]);
    assert(userDbRes.rows.length === 1, 'Found user row in PostgreSQL users table');
    const userRow = userDbRes.rows[0];
    assert(userRow.password_hash.startsWith('$2b$'), 'password_hash is a valid bcrypt hash');
    assert(userRow.password_hash !== testPassword, 'password is NOT stored in plaintext');
    assert(userRow.role === 'customer', 'role in database is customer');

    const authProviderDbRes = await pool.query(
      'SELECT * FROM user_auth_providers WHERE user_id = $1',
      [createdUserId]
    );
    assert(authProviderDbRes.rows.length === 1, 'Found row in user_auth_providers table');
    const providerRow = authProviderDbRes.rows[0];
    assert(providerRow.provider === 'email', 'provider is "email"');
    assert(providerRow.provider_user_id === testEmail.toLowerCase(), 'provider_user_id is set to user email');
    console.log('  -> Database user and auth_provider rows verified\n');

    // -------------------------------------------------------------
    // Test 3: Register duplicate email (Conflict)
    // -------------------------------------------------------------
    console.log('Test 3: Register Same Email Again');
    const dupRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another Jane',
        email: testEmail,
        password: 'AnotherPassword456!',
      }),
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 409, `Duplicate registration returns 409 Conflict (got ${dupRes.status})`);
    assert(dupData.success === false, 'dupData.success is false');
    assert(dupData.error === 'AUTH_EMAIL_ALREADY_EXISTS', 'Error code is AUTH_EMAIL_ALREADY_EXISTS');
    console.log('  -> Duplicate registration properly blocked\n');

    // -------------------------------------------------------------
    // Test 4: Validation on Registration (Bad input)
    // -------------------------------------------------------------
    console.log('Test 4: Registration Validation Errors');
    const badNameRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', email: 'valid@example.com', password: 'Password123!' }),
    });
    assert(badNameRes.status === 400, 'Empty name returns 400 Bad Request');

    const badEmailRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Valid Name', email: 'invalid-email', password: 'Password123!' }),
    });
    assert(badEmailRes.status === 400, 'Invalid email returns 400 Bad Request');

    const shortPassRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Valid Name', email: 'valid2@example.com', password: '123' }),
    });
    assert(shortPassRes.status === 400, 'Password < 6 chars returns 400 Bad Request');
    console.log('  -> Input validations verified\n');

    // -------------------------------------------------------------
    // Test 5: Login with correct password
    // -------------------------------------------------------------
    console.log('Test 5: Login with Correct Password');
    const loginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, `Login returns 200 OK (got ${loginRes.status})`);
    assert(loginData.success === true, 'loginData.success is true');
    assert(typeof loginData.data.token === 'string', 'Returns JWT token string');
    assert(loginData.data.user.id === createdUserId, 'Returns matching user ID');
    assert(loginData.data.user.password_hash === undefined, 'password_hash is NOT exposed in login');
    console.log('  -> Successful login verified\n');

    // -------------------------------------------------------------
    // Test 6: Login with incorrect password
    // -------------------------------------------------------------
    console.log('Test 6: Login with Incorrect Password');
    const badLoginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword!',
      }),
    });
    const badLoginData = await badLoginRes.json();
    assert(badLoginRes.status === 401, `Invalid password returns 401 Unauthorized (got ${badLoginRes.status})`);
    assert(badLoginData.success === false, 'badLoginData.success is false');
    assert(badLoginData.error === 'AUTH_INVALID_CREDENTIALS', 'Error code is AUTH_INVALID_CREDENTIALS');
    console.log('  -> Bad password rejected\n');

    // -------------------------------------------------------------
    // Test 7: Login with non-existent email
    // -------------------------------------------------------------
    console.log('Test 7: Login with Non-Existent Email');
    const nonExistentLoginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nobody_exists_here_123@example.com',
        password: 'Password123!',
      }),
    });
    const nonExistentData = await nonExistentLoginRes.json();
    assert(nonExistentLoginRes.status === 401, 'Non-existent user returns 401 Unauthorized');
    assert(nonExistentData.error === 'AUTH_INVALID_CREDENTIALS', 'Returns generic AUTH_INVALID_CREDENTIALS');
    console.log('  -> Non-existent email returns generic 401\n');

    // -------------------------------------------------------------
    // Test 8: GET /auth/me with valid JWT
    // -------------------------------------------------------------
    console.log('Test 8: GET /auth/me with Valid JWT');
    const meRes = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, `GET /auth/me returns 200 OK (got ${meRes.status})`);
    assert(meData.success === true, 'meData.success is true');
    assert(meData.data.id === createdUserId, 'meData returns current user ID');
    assert(meData.data.email === testEmail.toLowerCase(), 'meData returns current user email');
    assert(meData.data.name === testName, 'meData returns current user name');
    assert(meData.data.role === 'customer', 'meData returns current user role');
    assert(meData.data.password_hash === undefined, 'meData does NOT expose password_hash');
    console.log('  -> GET /auth/me profile verified\n');

    // -------------------------------------------------------------
    // Test 9: GET /auth/me without JWT
    // -------------------------------------------------------------
    console.log('Test 9: GET /auth/me without JWT');
    const noTokenRes = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
    });
    const noTokenData = await noTokenRes.json();
    assert(noTokenRes.status === 401, `Missing token returns 401 (got ${noTokenRes.status})`);
    assert(noTokenData.success === false, 'noTokenData.success is false');
    assert(noTokenData.error === 'AUTH_UNAUTHORIZED', 'Error code is AUTH_UNAUTHORIZED');
    console.log('  -> Missing token rejected\n');

    // -------------------------------------------------------------
    // Test 10: GET /auth/me with invalid JWT
    // -------------------------------------------------------------
    console.log('Test 10: GET /auth/me with Invalid JWT');
    const badTokenRes = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid.token.payload',
      },
    });
    const badTokenData = await badTokenRes.json();
    assert(badTokenRes.status === 401, `Invalid token returns 401 (got ${badTokenRes.status})`);
    assert(badTokenData.success === false, 'badTokenData.success is false');
    assert(badTokenData.error === 'AUTH_UNAUTHORIZED', 'Error code is AUTH_UNAUTHORIZED');
    console.log('  -> Invalid token rejected\n');

    // -------------------------------------------------------------
    // Test 11: POST /auth/logout
    // -------------------------------------------------------------
    console.log('Test 11: POST /auth/logout');
    const logoutRes = await fetch(`${BASE_URL}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwtToken}`,
      },
    });
    const logoutData = await logoutRes.json();
    assert(logoutRes.status === 200, `Logout returns 200 OK (got ${logoutRes.status})`);
    assert(logoutData.success === true, 'logoutData.success is true');
    assert(logoutData.message === 'Session invalidated', 'Message conforms to contract');
    console.log('  -> Logout response verified\n');

    // -------------------------------------------------------------
    // Test 12: Existing database health endpoint still intact
    // -------------------------------------------------------------
    console.log('Test 12: Existing Health Endpoint Integrity');
    const healthRes = await fetch('http://localhost:8080/api/v1/health/database');
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'Health endpoint returns 200 OK');
    assert(healthData.success === true, 'Health check reports success: true');
    assert(typeof healthData.databaseTime === 'string', 'Health check reports databaseTime');
    console.log('  -> Database health endpoint working perfectly\n');

    console.log('====================================================');
    console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} assertions passed)`);
    console.log('====================================================\n');

    // Clean up test user
    console.log('Cleaning up test user records...');
    await pool.query('DELETE FROM users WHERE id = $1', [createdUserId]);
    console.log('Test records cleaned up.');
  } finally {
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
