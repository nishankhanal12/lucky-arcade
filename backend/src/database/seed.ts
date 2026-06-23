import bcrypt from 'bcryptjs';
import pool from './connection';

export async function seedAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = await bcrypt.hash(password, 10);

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT id FROM admins WHERE username = ?', [username]);
    if ((rows as unknown[]).length === 0) {
      await conn.execute('INSERT INTO admins (username, password) VALUES (?, ?)', [username, hash]);
      console.log(`Admin seeded: ${username}`);
    } else {
      await conn.execute('UPDATE admins SET password = ? WHERE username = ?', [hash, username]);
      console.log(`Admin password updated: ${username}`);
    }
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  seedAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
