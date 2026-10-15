/**
 * SyncExc Server — Database test helpers
 */

export async function truncateAllTables(db) {
  const result = await db.query(
    `
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'schema_%'
    `
  );

  const tables = result.rows.map((r) => `"${r.tablename}"`).join(', ');
  if (tables) {
    await db.query(`TRUNCATE ${tables} CASCADE`);
  }
}

export async function withTransaction(db, fn) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}