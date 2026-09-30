const pool = require('../config/database');
const smsService = require('../services/smsService');

const BASE_URL = 'http://localhost:8080/api/v1';

async function runPhoneAuthTests() {
  console.log('====================================================');
  console.log('         STAYPAW PHONE OTP AUTH TEST SUITE          ');
  console.log('====================================================\n');

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

  const createdUserIds = [];
  const testPhone1 = `+9198${Date.now().toString().slice(-8)}`;
  const testPhone2 = `+9197${Date.now().toString().slice(-8)}`;
  let verificationId1 = null;
  let otp1 = null;

  try {
    // -------------------------------------------------------------
    // Test 1: Missing phone number
    // -------------------------------------------------------------
    console.log('Test 1: Request OTP without phone number');
    const noPhoneRes = await fetch(`${BASE_URL}/auth/phone/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const noPhoneData = await noPhoneRes.json();
    assert(noPhoneRes.status === 400, 'Returns 400 Bad Request');
    assert(noPhoneData.error === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

    // -------------------------------------------------------------
    // Test 2: Invalid phone number
    // -------------------------------------------------------------
    console.log('Test 2: Request OTP with invalid phone format');
    const badPhoneRes = await fetch(`${BASE_URL}/auth/phone/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: 'not_a_phone_number' }),
    });
    const badPhoneData = await badPhoneRes.json();
    assert(badPhoneRes.status === 422, 'Returns 422 Unprocessable Entity');
    assert(badPhoneData.error === 'PHONE_INVALID', 'Error code is PHONE_INVALID');

    // -------------------------------------------------------------
    // Test 3: Valid Request OTP
    // -------------------------------------------------------------
    console.log('Test 3: Request OTP with valid phone number');
    const validReqRes = await fetch(`${BASE_URL}/auth/phone/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: testPhone1 }),
    });
    const validReqData = await validReqRes.json();
    assert(validReqRes.status === 200, 'Returns 200 OK');
    assert(validReqData.success === true, 'Response contains success: true');
    assert(typeof validReqData.data.verificationId === 'string', 'Returns verificationId string');
    assert(validReqData.data.verificationId.length === 36, 'verificationId is a valid 36-char UUID');

    verificationId1 = validReqData.data.verificationId;
    otp1 = validReqData.data.devOtp || smsService.getLastDevOtp(testPhone1);
    assert(otp1 && otp1.length === 6, 'Dev mode captured 6-digit OTP');

    // -------------------------------------------------------------
    // Test 4: OTP record created in PostgreSQL
    // -------------------------------------------------------------
    console.log('Test 4: PostgreSQL record verification for phone_verifications');
    const dbRecordRes = await pool.query(
      'SELECT * FROM phone_verifications WHERE id = $1',
      [verificationId1]
    );
    assert(dbRecordRes.rows.length === 1, 'Found verification record in phone_verifications table');
    const pvRow = dbRecordRes.rows[0];
    assert(pvRow.phone_number === testPhone1, 'phone_number matches normalized phone');
    assert(pvRow.attempts === 0, 'Initial attempts count is 0');
    assert(pvRow.max_attempts === 5, 'max_attempts is 5');
    assert(pvRow.consumed_at === null, 'consumed_at is initially null');
    assert(new Date(pvRow.expires_at) > new Date(), 'expires_at is in the future');

    // -------------------------------------------------------------
    // Test 5 & 6: OTP stored as bcrypt hash, plaintext not stored
    // -------------------------------------------------------------
    console.log('Test 5 & 6: Hashed OTP storage verification');
    assert(pvRow.otp_hash.startsWith('$2b$'), 'otp_hash is a bcrypt hash');
    assert(pvRow.otp_hash !== otp1, 'Plaintext OTP is NOT stored in database');

    // -------------------------------------------------------------
    // Test 7: Resend protection cooldown (45 seconds)
    // -------------------------------------------------------------
    console.log('Test 7: Resend protection / rate limiting');
    const cooldownRes = await fetch(`${BASE_URL}/auth/phone/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: testPhone1 }),
    });
    const cooldownData = await cooldownRes.json();
    assert(cooldownRes.status === 429, 'Returns 429 Too Many Requests within cooldown');
    assert(cooldownData.error === 'OTP_RATE_LIMITED', 'Error code is OTP_RATE_LIMITED');
    assert(typeof cooldownData.details.retryAfterSeconds === 'number', 'Reports retryAfterSeconds');

    // -------------------------------------------------------------
    // Test 8: Verify OTP - Missing code
    // -------------------------------------------------------------
    console.log('Test 8: Verify OTP without code');
    const noCodeRes = await fetch(`${BASE_URL}/auth/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificationId: verificationId1 }),
    });
    const noCodeData = await noCodeRes.json();
    assert(noCodeRes.status === 400, 'Returns 400 Bad Request');
    assert(noCodeData.error === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

    // -------------------------------------------------------------
    // Test 9 & 10: Verify OTP - Incorrect code & Attempt increment
    // -------------------------------------------------------------
    console.log('Test 9 & 10: Verify OTP with incorrect code & attempt increment');
    const badCodeRes = await fetch(`${BASE_URL}/auth/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificationId: verificationId1, code: '000000' }),
    });
    const badCodeData = await badCodeRes.json();
    assert(badCodeRes.status === 400, 'Incorrect code returns 400 Bad Request');
    assert(badCodeData.error === 'OTP_INVALID', 'Error code is OTP_INVALID');

    const dbAttemptRes = await pool.query(
      'SELECT attempts FROM phone_verifications WHERE id = $1',
      [verificationId1]
    );
    assert(dbAttemptRes.rows[0].attempts === 1, 'attempts incremented to 1 in database');

    // -------------------------------------------------------------
    // Test 11: Maximum attempts lockout
    // -------------------------------------------------------------
    console.log('Test 11: Maximum retry attempts exceeded');
    // Set attempts to 4 to test the 5th attempt triggering lockout
    await pool.query('UPDATE phone_verifications SET attempts = 4 WHERE id = $1', [verificationId1]);

    const maxAttemptRes = await fetch(`${BASE_URL}/auth/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificationId: verificationId1, code: '000000' }),
    });
    const maxAttemptData = await maxAttemptRes.json();
    assert(maxAttemptRes.status === 429, 'Returns 429 Too Many Requests when attempts >= max_attempts');
    assert(maxAttemptData.error === 'OTP_MAX_ATTEMPTS', 'Error code is OTP_MAX_ATTEMPTS');

    // -------------------------------------------------------------
    // Test 12: Expired OTP
    // -------------------------------------------------------------
    console.log('Test 12: Expired verification session rejection');
    const testPhoneExpired = `+9196${Date.now().toString().slice(-8)}`;
    const expiredRes = await pool.query(
      `INSERT INTO phone_verifications (phone_number, otp_hash, attempts, max_attempts, expires_at)
       VALUES ($1, 'dummy_hash', 0, 5, NOW() - INTERVAL '1 minute')
       RETURNING id`,
      [testPhoneExpired]
    );
    const expiredId = expiredRes.rows[0].id;

    const verifyExpiredRes = await fetch(`${BASE_URL}/auth/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificationId: expiredId, code: '123456' }),
    });
    const verifyExpiredData = await verifyExpiredRes.json();
    assert(verifyExpiredRes.status === 400, 'Expired OTP returns 400 Bad Request');
    assert(verifyExpiredData.error === 'OTP_EXPIRED', 'Error code is OTP_EXPIRED');

    // -------------------------------------------------------------
    // Test 13: Successful verification & new user creation
    // -------------------------------------------------------------
    console.log('Test 13: Successful OTP verification and account creation');
    const phoneAuthRes = await fetch(`${BASE_URL}/auth/phone/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: testPhone2 }),
    });
    const phoneAuthData = await phoneAuthRes.json();
    const verId2 = phoneAuthData.data.verificationId;
    const otp2 = phoneAuthData.data.devOtp || smsService.getLastDevOtp(testPhone2);

    const verifySuccessRes = await fetch(`${BASE_URL}/auth/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificationId: verId2, code: otp2 }),
    });
    const verifySuccessData = await verifySuccessRes.json();

    assert(verifySuccessRes.status === 200, 'Successful verification returns 200 OK');
    assert(verifySuccessData.success === true, 'verifySuccessData.success is true');
    assert(typeof verifySuccessData.data.token === 'string', 'Returns StayPaw JWT string');
    assert(verifySuccessData.data.user.phoneNumber === testPhone2, 'User phoneNumber matches');
    assert(verifySuccessData.data.user.role === 'customer', 'User role defaults to customer');
    assert(verifySuccessData.data.user.password_hash === undefined, 'No password_hash exposed');

    const createdPhoneUserId = verifySuccessData.data.user.id;
    createdUserIds.push(createdPhoneUserId);
    const phoneJwtToken = verifySuccessData.data.token;

    // -------------------------------------------------------------
    // Test 14: Database check: consumed_at is set
    // -------------------------------------------------------------
    console.log('Test 14: Verification session marked consumed in database');
    const consumedDbRes = await pool.query(
      'SELECT consumed_at FROM phone_verifications WHERE id = $1',
      [verId2]
    );
    assert(consumedDbRes.rows[0].consumed_at !== null, 'consumed_at timestamp is populated');

    // -------------------------------------------------------------
    // Test 15: Replay protection: Same OTP cannot be reused
    // -------------------------------------------------------------
    console.log('Test 15: Replay attack prevention (consumed OTP reuse)');
    const replayRes = await fetch(`${BASE_URL}/auth/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificationId: verId2, code: otp2 }),
    });
    const replayData = await replayRes.json();
    assert(replayRes.status === 401, 'Reused verification returns 401');
    assert(replayData.error === 'OTP_INVALID', 'Error code is OTP_INVALID');

    // -------------------------------------------------------------
    // Test 16: Database check: user and user_auth_providers row created
    // -------------------------------------------------------------
    console.log('Test 16: Database records for created phone user');
    const userRowRes = await pool.query('SELECT * FROM users WHERE id = $1', [createdPhoneUserId]);
    assert(userRowRes.rows.length === 1, 'User row created in users table');
    assert(userRowRes.rows[0].password_hash === null, 'password_hash is null for phone account');
    assert(userRowRes.rows[0].phone_number === testPhone2, 'users.phone_number matches');

    const providerRowRes = await pool.query(
      'SELECT * FROM user_auth_providers WHERE user_id = $1 AND provider = $2',
      [createdPhoneUserId, 'phone']
    );
    assert(providerRowRes.rows.length === 1, 'Provider row created in user_auth_providers table');
    assert(providerRowRes.rows[0].provider_user_id === testPhone2, 'provider_user_id is phone number');

    // -------------------------------------------------------------
    // Test 17: StayPaw JWT works with GET /auth/me
    // -------------------------------------------------------------
    console.log('Test 17: Phone-authenticated StayPaw JWT works with GET /auth/me');
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${phoneJwtToken}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, 'GET /auth/me returns 200 OK');
    assert(meData.data.id === createdPhoneUserId, 'Profile ID matches phone user');
    assert(meData.data.phoneNumber === testPhone2, 'Profile phoneNumber matches');
    assert(meData.data.role === 'customer', 'Profile role is customer');

    // -------------------------------------------------------------
    // Test 18: Existing phone user login (no duplicate user created)
    // -------------------------------------------------------------
    console.log('Test 18: Existing phone user login returns existing user');
    // Clear cooldown to allow new request
    await pool.query('DELETE FROM phone_verifications WHERE phone_number = $1', [testPhone2]);

    const reqAgainRes = await fetch(`${BASE_URL}/auth/phone/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: testPhone2 }),
    });
    const reqAgainData = await reqAgainRes.json();
    const verId3 = reqAgainData.data.verificationId;
    const otp3 = reqAgainData.data.devOtp || smsService.getLastDevOtp(testPhone2);

    const loginAgainRes = await fetch(`${BASE_URL}/auth/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificationId: verId3, code: otp3 }),
    });
    const loginAgainData = await loginAgainRes.json();

    assert(loginAgainRes.status === 200, 'Returns 200 OK for returning user');
    assert(loginAgainData.data.user.id === createdPhoneUserId, 'Returns exact same existing user ID');

    const totalPhoneUsers = await pool.query(
      'SELECT COUNT(*) FROM users WHERE phone_number = $1',
      [testPhone2]
    );
    assert(parseInt(totalPhoneUsers.rows[0].count) === 1, 'No duplicate user created in users table');

    // -------------------------------------------------------------
    // Test 19: Account Conflict when phone number already belongs to another account
    // -------------------------------------------------------------
    console.log('Test 19: Account Conflict when phone belongs to another account');
    const conflictPhone = `+9199${Date.now().toString().slice(-8)}`;
    // Create an existing user with this phone number but under email provider
    const existingConflictUser = await pool.query(
      `INSERT INTO users (name, email, phone_number, role)
       VALUES ('Conflict Phone User', $1, $2, 'customer')
       RETURNING id`,
      [`conflict_${Date.now()}@example.com`, conflictPhone]
    );
    createdUserIds.push(existingConflictUser.rows[0].id);

    // Request and verify OTP for conflictPhone
    const confReqRes = await fetch(`${BASE_URL}/auth/phone/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: conflictPhone }),
    });
    const confReqData = await confReqRes.json();
    const confVerId = confReqData.data.verificationId;
    const confOtp = confReqData.data.devOtp || smsService.getLastDevOtp(conflictPhone);

    const confVerifyRes = await fetch(`${BASE_URL}/auth/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificationId: confVerId, code: confOtp }),
    });
    const confVerifyData = await confVerifyRes.json();
    assert(confVerifyRes.status === 409, 'Conflict returns 409 Conflict');
    assert(confVerifyData.error === 'AUTH_ACCOUNT_CONFLICT', 'Error code is AUTH_ACCOUNT_CONFLICT');

    // -------------------------------------------------------------
    // Test 20: Database Health Endpoint Integrity
    // -------------------------------------------------------------
    console.log('Test 20: Existing database health check integrity');
    const healthRes = await fetch(`${BASE_URL}/health/database`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'Health endpoint returns 200 OK');
    assert(healthData.success === true, 'Health check reports success: true');

    console.log('\n====================================================');
    console.log(`ALL PHONE AUTH TESTS PASSED! (${passedTests}/${totalTests} assertions passed)`);
    console.log('====================================================\n');

    // Clean up created test users and verifications
    console.log('Cleaning up test records...');
    for (const uid of createdUserIds) {
      await pool.query('DELETE FROM users WHERE id = $1', [uid]);
    }
    await pool.query('DELETE FROM phone_verifications WHERE phone_number IN ($1, $2, $3)', [
      testPhone1,
      testPhone2,
      conflictPhone,
    ]);
    console.log('Cleaned up successfully.');
  } finally {
    smsService.clearDevOtps();
    await pool.end();
  }
}

runPhoneAuthTests().catch((err) => {
  console.error('\nPhone Auth Test Suite Failed:', err);
  process.exit(1);
});
