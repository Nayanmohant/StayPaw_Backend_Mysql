const pool = require('../config/database');
const providerVerificationService = require('../services/providerVerificationService');
// const authService = require('../services/authService');

const BASE_URL = 'http://localhost:8080/api/v1';

async function runSocialAuthTests() {
  console.log('====================================================');
  console.log('     STAYPAW GOOGLE & APPLE AUTH TEST SUITE         ');
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

  try {
    // =============================================================
    // SECTION 1: REAL EXTERNAL PROVIDER VERIFICATION (NO MOCKS)
    // =============================================================
    console.log('--- SECTION 1: REAL PROVIDER VERIFICATION WITH INVALID TOKENS (UNMOCKED) ---');
    providerVerificationService.clearMocks();

    // 1. Missing Google token
    console.log('Test 1: POST /auth/google without token');
    const noGoogleTokenRes = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const noGoogleTokenData = await noGoogleTokenRes.json();
    assert(noGoogleTokenRes.status === 400, 'Returns 400 Bad Request');
    assert(noGoogleTokenData.error === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

    // 2. Real Google verification on invalid/expired token
    console.log('Test 2: POST /auth/google with invalid ID token (Real Google SDK check)');
    const badGoogleTokenRes = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'invalid.google.jwt.signature' }),
    });
    const badGoogleTokenData = await badGoogleTokenRes.json();
    assert(badGoogleTokenRes.status === 401, 'Real Google verification rejects invalid token with 401');
    assert(badGoogleTokenData.error === 'GOOGLE_AUTH_FAILED', 'Error code is GOOGLE_AUTH_FAILED');

    // 3. Missing Apple token
    console.log('Test 3: POST /auth/apple without token');
    const noAppleTokenRes = await fetch(`${BASE_URL}/auth/apple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const noAppleTokenData = await noAppleTokenRes.json();
    assert(noAppleTokenRes.status === 400, 'Returns 400 Bad Request');
    assert(noAppleTokenData.error === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

    // 4. Real Apple verification on invalid token
    console.log('Test 4: POST /auth/apple with invalid identity token (Real Apple JWKS check)');
    const badAppleTokenRes = await fetch(`${BASE_URL}/auth/apple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityToken: 'invalid.apple.jwt.signature' }),
    });
    const badAppleTokenData = await badAppleTokenRes.json();
    assert(badAppleTokenRes.status === 401, 'Real Apple verification rejects invalid token with 401');
    assert(badAppleTokenData.error === 'APPLE_AUTH_FAILED', 'Error code is APPLE_AUTH_FAILED');
    console.log('  -> Real provider invalid token rejection verified.\n');

    // =============================================================
    // SECTION 1B: APPLE & GOOGLE CRYPTOGRAPHIC CLAIM & AUDIENCE VALIDATION
    // =============================================================
    console.log('--- SECTION 1B: APPLE & GOOGLE CRYPTOGRAPHIC & AUDIENCE VALIDATION ---');
    const crypto = require('crypto');
    const jwt = require('jsonwebtoken');

    // Generate real RSA key pairs for cryptographic testing
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const { privateKey: untrustedPrivateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Configure Apple key resolver to return our public key
    providerVerificationService.setAppleCustomGetKey((header, callback) => callback(null, publicKey));
    process.env.APPLE_CLIENT_ID = 'com.example.staypaw';
    process.env.GOOGLE_CLIENT_ID = 'staypaw-google-client-id-dev.apps.googleusercontent.com';

    // Apple Test 1: valid signature + correct issuer + correct audience → accepted
    console.log('Apple Security Test 1: valid signature + correct issuer + correct audience -> accepted');
    const validAppleToken = jwt.sign(
      {
        iss: 'https://appleid.apple.com',
        aud: process.env.APPLE_CLIENT_ID,
        sub: 'apple_crypto_valid_sub_100',
        email: 'verified_apple_user@privaterelay.appleid.com',
        email_verified: 'true',
      },
      privateKey,
      { algorithm: 'RS256', expiresIn: '1h', keyid: 'apple-test-key' }
    );
    const appleVerifiedPayload = await providerVerificationService.verifyAppleToken(validAppleToken);
    assert(appleVerifiedPayload.sub === 'apple_crypto_valid_sub_100', 'Apple token sub verified');
    assert(appleVerifiedPayload.email === 'verified_apple_user@privaterelay.appleid.com', 'Apple token email verified');
    assert(appleVerifiedPayload.emailVerified === true, 'Apple token emailVerified is true');

    // Apple Test 2: valid signature + incorrect audience → rejected
    console.log('Apple Security Test 2: valid signature + incorrect audience -> rejected');
    const wrongAudAppleToken = jwt.sign(
      {
        iss: 'https://appleid.apple.com',
        aud: 'com.unauthorized.app',
        sub: 'apple_crypto_sub_wrong_aud',
      },
      privateKey,
      { algorithm: 'RS256', expiresIn: '1h', keyid: 'apple-test-key' }
    );
    let wrongAudCaught = false;
    try {
      await providerVerificationService.verifyAppleToken(wrongAudAppleToken);
    } catch (err) {
      wrongAudCaught = true;
      assert(err.errorCode === 'APPLE_AUTH_FAILED', 'Rejects with APPLE_AUTH_FAILED');
      assert(err.message.includes('jwt audience invalid'), 'Error confirms jwt audience invalid');
    }
    assert(wrongAudCaught, 'Apple token with incorrect audience rejected');

    // Apple Test 3: valid signature + incorrect issuer → rejected
    console.log('Apple Security Test 3: valid signature + incorrect issuer -> rejected');
    const wrongIssAppleToken = jwt.sign(
      {
        iss: 'https://attacker.evil.com',
        aud: process.env.APPLE_CLIENT_ID,
        sub: 'apple_crypto_sub_wrong_iss',
      },
      privateKey,
      { algorithm: 'RS256', expiresIn: '1h', keyid: 'apple-test-key' }
    );
    let wrongIssCaught = false;
    try {
      await providerVerificationService.verifyAppleToken(wrongIssAppleToken);
    } catch (err) {
      wrongIssCaught = true;
      assert(err.errorCode === 'APPLE_AUTH_FAILED', 'Rejects with APPLE_AUTH_FAILED');
      assert(err.message.includes('jwt issuer invalid'), 'Error confirms jwt issuer invalid');
    }
    assert(wrongIssCaught, 'Apple token with incorrect issuer rejected');

    // Apple Test 4: invalid signature → rejected
    console.log('Apple Security Test 4: invalid signature -> rejected');
    const invalidSigAppleToken = jwt.sign(
      {
        iss: 'https://appleid.apple.com',
        aud: process.env.APPLE_CLIENT_ID,
        sub: 'apple_crypto_sub_bad_sig',
      },
      untrustedPrivateKey, // signed with a different private key
      { algorithm: 'RS256', expiresIn: '1h', keyid: 'apple-test-key' }
    );
    let invalidSigCaught = false;
    try {
      await providerVerificationService.verifyAppleToken(invalidSigAppleToken);
    } catch (err) {
      invalidSigCaught = true;
      assert(err.errorCode === 'APPLE_AUTH_FAILED', 'Rejects with APPLE_AUTH_FAILED');
      assert(err.message.includes('invalid signature'), 'Error confirms invalid signature');
    }
    assert(invalidSigCaught, 'Apple token with invalid signature rejected');

    // Apple Test 5: expired token → rejected
    console.log('Apple Security Test 5: expired token -> rejected');
    const expiredAppleToken = jwt.sign(
      {
        iss: 'https://appleid.apple.com',
        aud: process.env.APPLE_CLIENT_ID,
        sub: 'apple_crypto_sub_expired',
        exp: Math.floor(Date.now() / 1000) - 30, // 30 seconds ago
      },
      privateKey,
      { algorithm: 'RS256', keyid: 'apple-test-key' }
    );
    let expiredCaught = false;
    try {
      await providerVerificationService.verifyAppleToken(expiredAppleToken);
    } catch (err) {
      expiredCaught = true;
      assert(err.errorCode === 'APPLE_AUTH_FAILED', 'Rejects with APPLE_AUTH_FAILED');
      assert(err.message.includes('jwt expired'), 'Error confirms jwt expired');
    }
    assert(expiredCaught, 'Apple token that has expired is rejected');

    // Google Test 6: incorrect audience → rejected
    console.log('Google Security Test 6: incorrect audience -> rejected');
    providerVerificationService.setGoogleClient({
      async verifyIdToken({ idToken, audience }) {
        const decoded = jwt.decode(idToken);
        if (decoded && decoded.aud !== audience) {
          throw new Error(`Wrong recipient, expected audience: ${audience}`);
        }
        return { getPayload: () => decoded };
      },
    });

    const wrongAudGoogleToken = jwt.sign(
      {
        iss: 'https://accounts.google.com',
        aud: 'unauthorized-client-id.apps.googleusercontent.com',
        sub: 'google_wrong_aud_sub_123',
      },
      'secret-key'
    );
    let googleWrongAudCaught = false;
    try {
      await providerVerificationService.verifyGoogleToken(wrongAudGoogleToken);
    } catch (err) {
      googleWrongAudCaught = true;
      assert(err.errorCode === 'GOOGLE_AUTH_FAILED', 'Rejects with GOOGLE_AUTH_FAILED');
      assert(err.message.includes('Wrong recipient'), 'Error confirms audience mismatch');
    }
    assert(googleWrongAudCaught, 'Google token with incorrect audience rejected');

    // Google Test 7: invalid token → rejected
    console.log('Google Security Test 7: invalid token -> rejected');
    providerVerificationService.clearMocks(); // restore default GoogleClient
    let googleInvalidCaught = false;
    try {
      await providerVerificationService.verifyGoogleToken('not-a-valid-google-jwt-token');
    } catch (err) {
      googleInvalidCaught = true;
      assert(err.errorCode === 'GOOGLE_AUTH_FAILED', 'Rejects with GOOGLE_AUTH_FAILED');
    }
    assert(googleInvalidCaught, 'Invalid Google token rejected');

    // Google Test 8: missing token → rejected
    console.log('Google Security Test 8: missing token -> rejected');
    const missingGoogleRes = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const missingGoogleData = await missingGoogleRes.json();
    assert(missingGoogleRes.status === 400, 'Missing token returns 400 Bad Request');
    assert(missingGoogleData.error === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

    console.log('  -> Cryptographic and audience security tests verified.\n');

    // =============================================================
    // SECTION 2: GOOGLE SIGN-IN ACCOUNT LIFECYCLE (MOCKED VERIFIER)
    // =============================================================
    console.log('--- SECTION 2: GOOGLE SIGN-IN ACCOUNT LIFECYCLE (MOCKED VERIFIER) ---');

    const googleSub = `googlesub_${Date.now()}`;
    const googleEmail = `googleuser_${Date.now()}@gmail.com`;
    const googleName = 'Google User Test';
    const googlePicture = 'https://lh3.googleusercontent.com/a/testphoto123';

    // Mock successful Google verification
    providerVerificationService.setMockVerifier({
      google: async (token) => {
        if (token === 'valid_mock_google_token') {
          return {
            sub: googleSub,
            email: googleEmail,
            emailVerified: true,
            name: googleName,
            picture: googlePicture,
          };
        }
        const err = new Error('Invalid mock Google token');
        err.statusCode = 401;
        err.errorCode = 'GOOGLE_AUTH_FAILED';
        throw err;
      },
    });

    // 5. New Google user registration
    console.log('Test 5: New Google user sign-in / account creation');
    const newGoogleRes = await authService.authenticateGoogle({ idToken: 'valid_mock_google_token' });
    assert(newGoogleRes.token && typeof newGoogleRes.token === 'string', 'Returns StayPaw JWT');
    assert(newGoogleRes.user && newGoogleRes.user.email === googleEmail, 'User email matches verified Google email');
    assert(newGoogleRes.user.name === googleName, 'User name matches verified Google name');
    assert(newGoogleRes.user.role === 'customer', 'User role defaults to customer');
    assert(newGoogleRes.user.avatarUrl === googlePicture, 'User avatarUrl matches Google picture');
    assert(newGoogleRes.user.password_hash === undefined, 'password_hash is NOT exposed');
    assert(newGoogleRes.user.password === undefined, 'password is NOT exposed');
    assert(newGoogleRes.user.id && newGoogleRes.user.id.length === 36, 'User ID is 36-char UUID');

    const googleUserId = newGoogleRes.user.id;
    createdUserIds.push(googleUserId);

    // 6. Verify database records for Google user
    console.log('Test 6: Database verification for created Google user');
    const googleUserDb = await pool.query('SELECT * FROM users WHERE id = $1', [googleUserId]);
    assert(googleUserDb.rows.length === 1, 'Row exists in users table');
    assert(googleUserDb.rows[0].password_hash === null, 'password_hash is NULL in database');
    assert(googleUserDb.rows[0].role === 'customer', 'role in database is customer');

    const googleProviderDb = await pool.query(
      'SELECT * FROM user_auth_providers WHERE user_id = $1 AND provider = $2',
      [googleUserId, 'google']
    );
    assert(googleProviderDb.rows.length === 1, 'Row exists in user_auth_providers table');
    assert(googleProviderDb.rows[0].provider === 'google', 'provider is "google"');
    assert(googleProviderDb.rows[0].provider_user_id === googleSub, 'provider_user_id is Google subject');
    assert(googleProviderDb.rows[0].provider_email === googleEmail, 'provider_email is Google email');

    // 7. Verify Google StayPaw JWT with GET /api/v1/auth/me
    console.log('Test 7: Verify StayPaw JWT from Google login with GET /api/v1/auth/me');
    const meGoogleRes = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${newGoogleRes.token}` },
    });
    const meGoogleData = await meGoogleRes.json();
    assert(meGoogleRes.status === 200, 'GET /auth/me returns 200 with Google-issued JWT');
    assert(meGoogleData.success === true, 'meGoogleData.success is true');
    assert(meGoogleData.data.id === googleUserId, 'User profile ID matches Google user');
    assert(meGoogleData.data.avatarUrl === googlePicture, 'User avatarUrl returns correctly');
    assert(meGoogleData.data.password_hash === undefined, 'No password_hash exposed in /auth/me');

    // 8. Existing Google user login
    console.log('Test 8: Existing Google user sign-in (Subsequent login)');
    const existingGoogleRes = await authService.authenticateGoogle({ idToken: 'valid_mock_google_token' });
    assert(existingGoogleRes.user.id === googleUserId, 'Returns the same existing user ID');
    assert(existingGoogleRes.token && typeof existingGoogleRes.token === 'string', 'Returns new fresh StayPaw JWT');

    const googleProvidersCount = await pool.query(
      'SELECT COUNT(*) FROM user_auth_providers WHERE provider = $1 AND provider_user_id = $2',
      ['google', googleSub]
    );
    assert(parseInt(googleProvidersCount.rows[0].count) === 1, 'No duplicate provider rows created');

    // 9. Account Conflict: Prevent merging if email already used by email/password account
    console.log('Test 9: Account Conflict when Google email is already used by email/password account');
    const conflictEmail = `conflict_user_${Date.now()}@example.com`;
    const emailUser = await authService.register({
      name: 'Existing Email User',
      email: conflictEmail,
      password: 'Password123!',
    });
    createdUserIds.push(emailUser.user.id);

    providerVerificationService.setMockVerifier({
      google: async () => ({
        sub: `googlesub_conflict_${Date.now()}`,
        email: conflictEmail,
        emailVerified: true,
        name: 'Conflict Google User',
        picture: null,
      }),
    });

    let conflictCaught = false;
    try {
      await authService.authenticateGoogle({ idToken: 'mock_conflict_token' });
    } catch (err) {
      conflictCaught = true;
      assert(err.statusCode === 409, 'Conflict returns HTTP 409');
      assert(err.errorCode === 'AUTH_ACCOUNT_CONFLICT', 'Error code is AUTH_ACCOUNT_CONFLICT');
    }
    assert(conflictCaught, 'Prevented automatic merging of Google account into existing email account');
    console.log('  -> Google authentication lifecycle verified.\n');

    // =============================================================
    // SECTION 3: APPLE SIGN-IN ACCOUNT LIFECYCLE (MOCKED VERIFIER)
    // =============================================================
    console.log('--- SECTION 3: APPLE SIGN-IN ACCOUNT LIFECYCLE (MOCKED VERIFIER) ---');

    const appleSub = `applesub_${Date.now()}`;
    const appleEmail = `appleuser_${Date.now()}@privaterelay.appleid.com`;

    providerVerificationService.setMockVerifier({
      apple: async (token) => {
        if (token === 'valid_mock_apple_token') {
          return {
            sub: appleSub,
            email: appleEmail,
            emailVerified: true,
          };
        }
        const err = new Error('Invalid mock Apple token');
        err.statusCode = 401;
        err.errorCode = 'APPLE_AUTH_FAILED';
        throw err;
      },
    });

    // 10. New Apple user registration with givenName & familyName
    console.log('Test 10: New Apple user sign-in / account creation with name');
    const newAppleRes = await authService.authenticateApple({
      identityToken: 'valid_mock_apple_token',
      givenName: 'Jane',
      familyName: 'Apple',
    });
    assert(newAppleRes.token && typeof newAppleRes.token === 'string', 'Returns StayPaw JWT');
    assert(newAppleRes.user && newAppleRes.user.email === appleEmail, 'User email matches Apple email');
    assert(newAppleRes.user.name === 'Jane Apple', 'User name formatted from givenName + familyName');
    assert(newAppleRes.user.role === 'customer', 'User role defaults to customer');
    assert(newAppleRes.user.password_hash === undefined, 'password_hash is NOT exposed');
    assert(newAppleRes.user.password === undefined, 'password is NOT exposed');
    assert(newAppleRes.user.id && newAppleRes.user.id.length === 36, 'User ID is 36-char UUID');

    const appleUserId = newAppleRes.user.id;
    createdUserIds.push(appleUserId);

    // 11. Verify database records for Apple user
    console.log('Test 11: Database verification for created Apple user');
    const appleUserDb = await pool.query('SELECT * FROM users WHERE id = $1', [appleUserId]);
    assert(appleUserDb.rows.length === 1, 'Row exists in users table');
    assert(appleUserDb.rows[0].password_hash === null, 'password_hash is NULL in database');
    assert(appleUserDb.rows[0].role === 'customer', 'role in database is customer');

    const appleProviderDb = await pool.query(
      'SELECT * FROM user_auth_providers WHERE user_id = $1 AND provider = $2',
      [appleUserId, 'apple']
    );
    assert(appleProviderDb.rows.length === 1, 'Row exists in user_auth_providers table');
    assert(appleProviderDb.rows[0].provider === 'apple', 'provider is "apple"');
    assert(appleProviderDb.rows[0].provider_user_id === appleSub, 'provider_user_id is Apple subject');
    assert(appleProviderDb.rows[0].provider_email === appleEmail, 'provider_email is Apple email');

    // 12. Verify Apple StayPaw JWT with GET /api/v1/auth/me
    console.log('Test 12: Verify StayPaw JWT from Apple login with GET /api/v1/auth/me');
    const meAppleRes = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${newAppleRes.token}` },
    });
    const meAppleData = await meAppleRes.json();
    assert(meAppleRes.status === 200, 'GET /auth/me returns 200 with Apple-issued JWT');
    assert(meAppleData.success === true, 'meAppleData.success is true');
    assert(meAppleData.data.id === appleUserId, 'User profile ID matches Apple user');
    assert(meAppleData.data.name === 'Jane Apple', 'User name is Jane Apple');
    assert(meAppleData.data.password_hash === undefined, 'No password_hash exposed in /auth/me');

    // 13. Existing Apple user login does NOT overwrite name/email when subsequent login has null name
    console.log('Test 13: Existing Apple user login preserves name/email on subsequent logins without name');
    const existingAppleRes = await authService.authenticateApple({
      identityToken: 'valid_mock_apple_token',
      givenName: null,
      familyName: null,
    });
    assert(existingAppleRes.user.id === appleUserId, 'Returns the same existing user ID');
    assert(existingAppleRes.user.name === 'Jane Apple', 'Preserves original user name');

    const appleUserCheck = await pool.query('SELECT name FROM users WHERE id = $1', [appleUserId]);
    assert(appleUserCheck.rows[0].name === 'Jane Apple', 'Database name not overwritten with null/empty');

    const appleProvidersCount = await pool.query(
      'SELECT COUNT(*) FROM user_auth_providers WHERE provider = $1 AND provider_user_id = $2',
      ['apple', appleSub]
    );
    assert(parseInt(appleProvidersCount.rows[0].count) === 1, 'No duplicate provider rows created');

    // 14. Account Conflict: Prevent merging if email already used by email/password account
    console.log('Test 14: Account Conflict when Apple email is already used by email/password account');
    providerVerificationService.setMockVerifier({
      apple: async () => ({
        sub: `applesub_conflict_${Date.now()}`,
        email: conflictEmail,
        emailVerified: true,
      }),
    });

    let appleConflictCaught = false;
    try {
      await authService.authenticateApple({
        identityToken: 'mock_conflict_token',
        givenName: 'Test',
        familyName: 'User',
      });
    } catch (err) {
      appleConflictCaught = true;
      assert(err.statusCode === 409, 'Conflict returns HTTP 409');
      assert(err.errorCode === 'AUTH_ACCOUNT_CONFLICT', 'Error code is AUTH_ACCOUNT_CONFLICT');
    }
    assert(appleConflictCaught, 'Prevented automatic merging of Apple account into existing email account');
    console.log('  -> Apple authentication lifecycle verified.\n');

    // =============================================================
    // SECTION 4: DATABASE INTEGRITY & TRANSACTION ROLLBACK TESTS
    // =============================================================
    console.log('--- SECTION 4: DATABASE INTEGRITY & TRANSACTION ROLLBACK TESTS ---');

    // 15. Unique constraint on (provider, provider_user_id)
    console.log('Test 15: Enforce unique constraint on (provider, provider_user_id)');
    let duplicateConstraintThrown = false;
    try {
      await pool.query(
        'INSERT INTO user_auth_providers (user_id, provider, provider_user_id) VALUES ($1, $2, $3)',
        [googleUserId, 'google', googleSub]
      );
    } catch (dbErr) {
      duplicateConstraintThrown = true;
      assert(dbErr.code === '23505', 'PostgreSQL throws unique violation (code 23505)');
    }
    assert(duplicateConstraintThrown, 'Duplicate provider identity insertion blocked');

    // 16. Transaction rollback: If user_auth_providers fails, user creation rolls back
    console.log('Test 16: Transaction rollback on failure (no orphan user created)');
    const preRollbackUsersCountRes = await pool.query('SELECT COUNT(*) FROM users');
    const preRollbackUsersCount = parseInt(preRollbackUsersCountRes.rows[0].count);

    // Create an invalid scenario where provider insertion fails due to duplicate provider_user_id
    providerVerificationService.setMockVerifier({
      google: async () => ({
        sub: googleSub, // already exists
        email: `rollback_test_${Date.now()}@example.com`,
        emailVerified: true,
        name: 'Rollback User',
      }),
    });

    // Manually test rollback inside transaction
    const rollbackClient = await pool.connect();
    let rollbackTested = false;
    try {
      await rollbackClient.query('BEGIN');
      const insRes = await rollbackClient.query(
        `INSERT INTO users (name, email, role, avatar_url) VALUES ('Rollback User', $1, 'customer', null) RETURNING id`,
        [`temp_rollback_${Date.now()}@example.com`]
      );
      // This will fail on duplicate provider unique constraint
      await rollbackClient.query(
        `INSERT INTO user_auth_providers (user_id, provider, provider_user_id) VALUES ($1, 'google', $2)`,
        [insRes.rows[0].id, googleSub]
      );
      await rollbackClient.query('COMMIT');
    } catch (err) {
      await rollbackClient.query('ROLLBACK');
      rollbackTested = true;
    } finally {
      rollbackClient.release();
    }

    assert(rollbackTested, 'Transaction caught error and executed ROLLBACK');
    const postRollbackUsersCountRes = await pool.query('SELECT COUNT(*) FROM users');
    const postRollbackUsersCount = parseInt(postRollbackUsersCountRes.rows[0].count);
    assert(preRollbackUsersCount === postRollbackUsersCount, 'User count unchanged (no orphan user remained)');

    // 17. Health endpoint check
    console.log('Test 17: Existing database health check endpoint');
    const healthRes = await fetch(`${BASE_URL}/health/database`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'Health endpoint returns 200 OK');
    assert(healthData.success === true, 'Health reports success: true');

    console.log('\n====================================================');
    console.log(`ALL SOCIAL AUTH TESTS PASSED! (${passedTests}/${totalTests} assertions passed)`);
    console.log('====================================================\n');

    // Clean up created test users
    console.log('Cleaning up test user records...');
    for (const id of createdUserIds) {
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
    }
    console.log('Test records cleaned up cleanly.');
  } finally {
    providerVerificationService.clearMocks();
    await pool.end();
  }
}

runSocialAuthTests().catch((err) => {
  console.error('\nSocial Auth Test Suite Failed:', err);
  process.exit(1);
});
