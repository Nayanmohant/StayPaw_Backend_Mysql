const pool = require('../config/database');

async function verify() {
  const client = await pool.connect();
  try {
    console.log('=== VERIFYING DATABASE TABLES ===');
    const { rows: tables } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Tables found (' + tables.length + '):', tables.map(t => t.table_name));

    console.log('\n=== VERIFYING PRIMARY KEYS ===');
    const { rows: pks } = await client.query(`
      SELECT tc.table_name, kcu.column_name, c.data_type, c.character_maximum_length, c.column_default
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.columns c
        ON c.table_name = tc.table_name AND c.column_name = kcu.column_name AND c.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name;
    `);
    console.log(JSON.stringify(pks, null, 2));

    console.log('\n=== VERIFYING FOREIGN KEYS & ON DELETE ACTIONS ===');
    const { rows: fks } = await client.query(`
      SELECT
        tc.table_name AS from_table,
        kcu.column_name AS from_column,
        ccu.table_name AS to_table,
        ccu.column_name AS to_column,
        rc.delete_rule AS on_delete
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);
    console.log(JSON.stringify(fks, null, 2));

    console.log('\n=== VERIFYING CHECK CONSTRAINTS ===');
    const { rows: checks } = await client.query(`
      SELECT tc.table_name, tc.constraint_name, cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name AND tc.constraint_schema = cc.constraint_schema
      WHERE tc.constraint_type = 'CHECK' AND tc.table_schema = 'public'
        AND tc.constraint_name NOT LIKE '%_not_null'
      ORDER BY tc.table_name, tc.constraint_name;
    `);
    console.log(JSON.stringify(checks, null, 2));

    console.log('\n=== VERIFYING INDEXES ===');
    const { rows: indexes } = await client.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    console.table(indexes);

    console.log('\n=== TESTING DEFAULT ID GENERATION ===');
    const { rows: testInsert } = await client.query(`
      INSERT INTO users (name, email, role)
      VALUES ('Test Verification User', 'test-verification@staypaw.com', 'customer')
      RETURNING id, name, email, role, is_admin_approved, created_at, updated_at;
    `);
    const insertedUser = testInsert[0];
    console.log('Inserted test user successfully:', insertedUser);
    console.log(`Generated ID: "${insertedUser.id}", length: ${insertedUser.id.length}`);

    // Clean up test user
    await client.query(`DELETE FROM users WHERE id = $1`, [insertedUser.id]);
    console.log('Cleaned up test user successfully.');

  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch(console.error);
