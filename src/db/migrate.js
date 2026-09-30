const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('Connecting to PostgreSQL database to check migrations...');

    // 1. Create migrations tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // 2. Fetch already executed migrations
    const { rows: executedRows } = await client.query(
      'SELECT name FROM schema_migrations ORDER BY id ASC'
    );
    const executedMigrations = new Set(executedRows.map((r) => r.name));

    // 3. Read migration files in directory and sort in ascending order
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const pendingMigrations = files.filter((file) => !executedMigrations.has(file));

    if (pendingMigrations.length === 0) {
      console.log('Database is already up to date. No pending migrations.');
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s).`);

    // 4. Run each migration in a dedicated transaction
    for (const file of pendingMigrations) {
      console.log(`Running migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`✓ Completed migration: ${file}`);
      } catch (migrationError) {
        await client.query('ROLLBACK');
        console.error(`✗ Migration failed in file: ${file}`);
        console.error(migrationError);
        throw migrationError;
      }
    }

    console.log('✓ All migrations executed successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration process finished cleanly.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration process aborted with error:', err.message);
      process.exit(1);
    });
}

module.exports = runMigrations;
