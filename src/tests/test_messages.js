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

let createdMessageId = null;
let passedAssertions = 0;

function pass(msg) {
  passedAssertions++;
  console.log(`  ✓ PASS: ${msg}`);
}

async function setupTestData() {
  console.log('--- Setting up test data for Messaging tests ---');

  // Create users
  const custARes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Chat Customer A', 'chat_customer_a@test.com', 'customer', true)
     RETURNING *`
  );
  testCustomerA = custARes.rows[0];
  tokenCustomerA = generateToken(testCustomerA);

  const custBRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Chat Customer B', 'chat_customer_b@test.com', 'customer', true)
     RETURNING *`
  );
  testCustomerB = custBRes.rows[0];
  tokenCustomerB = generateToken(testCustomerB);

  const adminRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Chat Shelter Admin', 'chat_shelter_admin@test.com', 'shelter_admin', true)
     RETURNING *`
  );
  testShelterAdmin = adminRes.rows[0];
  tokenShelterAdmin = generateToken(testShelterAdmin);

  const otherAdminRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Other Chat Admin', 'other_chat_admin@test.com', 'shelter_admin', true)
     RETURNING *`
  );
  testOtherShelterAdmin = otherAdminRes.rows[0];
  tokenOtherShelterAdmin = generateToken(testOtherShelterAdmin);

  const superRes = await pool.query(
    `INSERT INTO users (name, email, role, is_admin_approved)
     VALUES ('Chat Super Admin', 'chat_super_admin@test.com', 'super_admin', true)
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
       $1, 'Chat Shelter Resort', 'https://images.example.com/chat.jpg',
       '123 Chat Way, Sunnyvale, CA', 4.9, 1.0, 70.0, true, 'approved',
       'Chat test facility.'
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
       $1, $2, 'Chat Shelter Resort', 'https://images.example.com/chat.jpg',
       '2026-12-01T10:00:00Z', '2026-12-05T10:00:00Z', 'confirmed',
       280.0, 22.4, 5.0, 307.4
     ) RETURNING *`,
    [testCustomerA.id, testShelter.id]
  );
  testBookingA = bRes.rows[0];

  console.log('Messaging test data created successfully.');
}

async function cleanupTestData() {
  console.log('\nCleaning up messaging test data...');
  if (testBookingA) {
    await pool.query('DELETE FROM messages WHERE booking_id = $1', [testBookingA.id]);
  }
  await pool.query("DELETE FROM messages WHERE content LIKE 'Global live chat test%'");

  if (testBookingA) {
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

async function runMessagingTests() {
  console.log('====================================================');
  console.log('          STAYPAW MESSAGING API TEST SUITE          ');
  console.log('====================================================');

  try {
    await setupTestData();

    // -------------------------------------------------------------------------
    // SECTION 1: AUTHENTICATION & ACCESS CONTROL
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 1: AUTHENTICATION & ACCESS CONTROL ---');

    // Test 1: Unauthenticated request to get booking messages -> 401
    console.log('Test 1: Unauthenticated request -> 401 Unauthorized');
    const unauthGetRes = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/messages`);
    assert.strictEqual(unauthGetRes.status, 401);
    pass('Unauthenticated booking messages request rejected with 401');

    // Test 2: Nonexistent booking ID -> 404 Not Found
    console.log('Test 2: Nonexistent booking ID -> 404 Not Found');
    const nonExistRes = await fetch(`${BASE_URL}/bookings/00000000-0000-0000-0000-000000000000/messages`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    assert.strictEqual(nonExistRes.status, 404);
    pass('Nonexistent booking returns 404 BOOKING_NOT_FOUND');

    // Test 3: Unauthorized customer accessing another user's booking chat -> 403
    console.log('Test 3: Customer B accessing Customer A booking chat -> 403 Forbidden');
    const unauthCustRes = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/messages`, {
      headers: { Authorization: `Bearer ${tokenCustomerB}` },
    });
    assert.strictEqual(unauthCustRes.status, 403);
    pass('Unauthorized customer blocked with 403 AUTH_FORBIDDEN');

    // Test 4: Unrelated shelter admin accessing booking chat -> 403
    console.log('Test 4: Unrelated shelter admin accessing booking chat -> 403 Forbidden');
    const unauthAdminRes = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/messages`, {
      headers: { Authorization: `Bearer ${tokenOtherShelterAdmin}` },
    });
    assert.strictEqual(unauthAdminRes.status, 403);
    pass('Unrelated shelter admin blocked with 403 AUTH_FORBIDDEN');

    // -------------------------------------------------------------------------
    // SECTION 2: SENDING BOOKING MESSAGES & CONTENT VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 2: SENDING BOOKING MESSAGES & CONTENT VALIDATION ---');

    // Test 5: Missing or empty content -> 400 Bad Request
    console.log('Test 5: Empty message content -> 400 Bad Request');
    const emptyContentRes = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({ content: '   ' }),
    });
    assert.strictEqual(emptyContentRes.status, 400);
    pass('Empty message rejected with 400 VALIDATION_ERROR');

    // Test 6: Oversized message (> 2000 chars) -> 400 Bad Request
    console.log('Test 6: Oversized message content -> 400 Bad Request');
    const oversizedContent = 'A'.repeat(2001);
    const oversizedRes = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({ content: oversizedContent }),
    });
    assert.strictEqual(oversizedRes.status, 400);
    pass('Oversized message (> 2000 chars) rejected with 400 VALIDATION_ERROR');

    // Test 7: Unauthorized customer trying to send message in another's booking -> 403
    console.log('Test 7: Customer B sending message in Customer A booking -> 403 Forbidden');
    const unauthSendRes = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerB}`,
      },
      body: JSON.stringify({ content: 'Sneaky message' }),
    });
    assert.strictEqual(unauthSendRes.status, 403);
    pass('Unauthorized message sending rejected with 403 AUTH_FORBIDDEN');

    // Test 8: Authorized customer sends message + sender spoofing prevention
    console.log('Test 8: Authorized customer sends message (preventing sender spoofing)');
    const sendResA = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({
        content: 'When is Rex evening walk scheduled?',
        senderId: 'spoofed_user_id', // Must be ignored
        senderName: 'Spoofed Name',
      }),
    });
    const sendDataA = await sendResA.json();
    assert.strictEqual(sendResA.status, 201);
    assert.strictEqual(sendDataA.success, true);

    const msgA = sendDataA.data;
    createdMessageId = msgA.id;

    // Verify Flutter MessageModel contract & sender integrity
    assert.ok(msgA.id);
    assert.strictEqual(msgA.bookingId, testBookingA.id);
    assert.strictEqual(msgA.senderId, testCustomerA.id); // Derived from JWT
    assert.strictEqual(msgA.senderName, testCustomerA.name);
    assert.strictEqual(msgA.content, 'When is Rex evening walk scheduled?');
    assert.strictEqual(msgA.isRead, false);
    assert.ok(msgA.createdAt);
    pass('Message sent with HTTP 201; sender ID strictly derived from JWT');

    // Test 9: Shelter admin replies in the booking chat
    console.log('Test 9: Facility shelter admin replies in booking chat');
    const sendResAdmin = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenShelterAdmin}`,
      },
      body: JSON.stringify({
        content: 'Hi! Rex has his evening walk at 6:00 PM.',
      }),
    });
    const sendDataAdmin = await sendResAdmin.json();
    assert.strictEqual(sendResAdmin.status, 201);
    assert.strictEqual(sendDataAdmin.data.senderId, testShelterAdmin.id);
    assert.strictEqual(sendDataAdmin.data.senderName, testShelterAdmin.name);
    pass('Facility shelter admin successfully replies in booking chat');

    // Test 10: Verify persistence in PostgreSQL messages table
    console.log('Test 10: Verify message record in PostgreSQL database');
    const dbMsgRes = await pool.query('SELECT * FROM messages WHERE id = $1', [createdMessageId]);
    assert.strictEqual(dbMsgRes.rows.length, 1);
    const dbRow = dbMsgRes.rows[0];
    assert.strictEqual(dbRow.booking_id, testBookingA.id);
    assert.strictEqual(dbRow.sender_id, testCustomerA.id);
    assert.strictEqual(dbRow.content, 'When is Rex evening walk scheduled?');
    assert.strictEqual(dbRow.is_read, false);
    pass('Message verified in PostgreSQL database');

    // -------------------------------------------------------------------------
    // SECTION 3: RETRIEVING MESSAGES, ORDERING, & PAGINATION
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 3: RETRIEVING MESSAGES, ORDERING, & PAGINATION ---');

    // Test 11: Authorized customer retrieves booking messages
    console.log('Test 11: Authorized customer gets message history');
    const getResA = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/messages`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const getDataA = await getResA.json();
    assert.strictEqual(getResA.status, 200);
    assert.strictEqual(getDataA.success, true);
    assert.ok(Array.isArray(getDataA.data), 'Flutter expects data to be an Array');
    assert.strictEqual(getDataA.data.length, 2);
    pass('Customer receives message history array matching Flutter contract');

    // Test 12: Chronological ordering (created_at ASC)
    console.log('Test 12: Verify chronological ordering (created_at ASC)');
    assert.strictEqual(getDataA.data[0].id, createdMessageId);
    assert.strictEqual(getDataA.data[0].content, 'When is Rex evening walk scheduled?');
    assert.strictEqual(getDataA.data[1].content, 'Hi! Rex has his evening walk at 6:00 PM.');
    pass('Messages returned in chronological order (created_at ASC)');

    // Test 13: Pagination headers
    console.log('Test 13: Verify pagination headers on booking messages');
    assert.strictEqual(getResA.headers.get('x-total-count'), '2');
    assert.strictEqual(getResA.headers.get('x-page'), '1');
    assert.strictEqual(getResA.headers.get('x-limit'), '50');
    pass('Pagination headers X-Total-Count, X-Page, X-Limit present');

    // Test 14: Authorized shelter admin retrieves booking messages
    console.log('Test 14: Authorized shelter admin retrieves booking messages');
    const getResAdmin = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/messages`, {
      headers: { Authorization: `Bearer ${tokenShelterAdmin}` },
    });
    const getDataAdmin = await getResAdmin.json();
    assert.strictEqual(getResAdmin.status, 200);
    assert.strictEqual(getDataAdmin.data.length, 2);
    pass('Shelter admin receives booking message history');

    // Test 15: Super admin retrieves booking messages
    console.log('Test 15: Super admin retrieves booking messages');
    const getResSuper = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/messages`, {
      headers: { Authorization: `Bearer ${tokenSuperAdmin}` },
    });
    assert.strictEqual(getResSuper.status, 200);
    pass('Super admin successfully views booking messages');

    // -------------------------------------------------------------------------
    // SECTION 4: READ / UNREAD STATUS
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 4: READ / UNREAD STATUS ---');

    // Test 16: Shelter admin marks incoming messages as read
    console.log('Test 16: Shelter admin marks Customer A message as read');
    const markReadRes = await fetch(`${BASE_URL}/bookings/${testBookingA.id}/messages/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenShelterAdmin}` },
    });
    const markReadData = await markReadRes.json();
    assert.strictEqual(markReadRes.status, 200);
    assert.strictEqual(markReadData.success, true);
    assert.strictEqual(markReadData.data.markedCount, 1); // Only customer's message marked
    pass('Recipient marked incoming message as read');

    // Verify in database that Customer A message is now is_read = true
    const checkReadRes = await pool.query('SELECT is_read FROM messages WHERE id = $1', [createdMessageId]);
    assert.strictEqual(checkReadRes.rows[0].is_read, true);
    pass('Database reflects is_read = true for marked message');

    // -------------------------------------------------------------------------
    // SECTION 5: GLOBAL FACILITY LIVE CHAT
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 5: GLOBAL FACILITY LIVE CHAT ---');

    // Test 17: Send global facility live stream message
    console.log('Test 17: Send message to global facility stream chat');
    const globalSendRes = await fetch(`${BASE_URL}/messages/global`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({
        content: 'Global live chat test: Hello everyone watching Bella stream!',
      }),
    });
    const globalSendData = await globalSendRes.json();
    assert.strictEqual(globalSendRes.status, 201);
    assert.strictEqual(globalSendData.success, true);
    assert.strictEqual(globalSendData.data.bookingId, 'global');
    assert.strictEqual(globalSendData.data.senderId, testCustomerA.id);
    assert.strictEqual(globalSendData.data.senderName, testCustomerA.name);
    const globalMsgId = globalSendData.data.id;
    pass('Global message sent; bookingId returned as "global" matching Flutter contract');

    // Verify in database: booking_id is stored as NULL in PostgreSQL
    const globalDbRes = await pool.query('SELECT booking_id FROM messages WHERE id = $1', [globalMsgId]);
    assert.strictEqual(globalDbRes.rows[0].booking_id, null);
    pass('Global live stream message stored with booking_id = NULL in PostgreSQL');

    // Test 18: Retrieve global facility stream messages
    console.log('Test 18: Retrieve global stream messages list');
    const globalGetRes = await fetch(`${BASE_URL}/messages/global`);
    const globalGetData = await globalGetRes.json();
    assert.strictEqual(globalGetRes.status, 200);
    assert.strictEqual(globalGetData.success, true);
    assert.ok(Array.isArray(globalGetData.data));
    assert.ok(globalGetData.data.some((m) => m.id === globalMsgId));
    pass('GET /messages/global returns list containing the sent live chat message');

    // Test 19: Empty global message rejected -> 400
    console.log('Test 19: Empty global message rejected -> 400');
    const emptyGlobalRes = await fetch(`${BASE_URL}/messages/global`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({ content: '' }),
    });
    assert.strictEqual(emptyGlobalRes.status, 400);
    pass('Empty global message rejected with 400 VALIDATION_ERROR');

    // -------------------------------------------------------------------------
    // SECTION 6: SYSTEM INTEGRITY
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 6: SYSTEM INTEGRITY ---');

    // Test 20: Database health check remains operational
    console.log('Test 20: Database health check operational');
    const healthRes = await fetch(`${BASE_URL}/health/database`);
    const healthData = await healthRes.json();
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthData.success, true);
    pass('Health check endpoint returns HTTP 200 OK');

    console.log('\n====================================================');
    console.log(`ALL MESSAGING TESTS PASSED! (${passedAssertions}/${passedAssertions} assertions passed)`);
    console.log('====================================================');
  } finally {
    await cleanupTestData();
  }
}

if (require.main === module) {
  runMessagingTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Messaging test failure:', err);
      process.exit(1);
    });
}

module.exports = { runMessagingTests };
