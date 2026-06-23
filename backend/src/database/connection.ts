import mysql, { ResultSetHeader } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lucky_arcade',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
});

export default pool;

export async function query<T = unknown>(sql: string, params: (string | number | boolean | null)[] = []): Promise<T> {
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}

export async function queryOne<T = unknown>(sql: string, params: (string | number | boolean | null)[] = []): Promise<T | null> {
  const rows = await query<T[]>(sql, params);
  return rows[0] ?? null;
}

export async function insert(sql: string, params: (string | number | boolean | null)[] = []): Promise<number> {
  const [result] = await pool.execute(sql, params);
  return (result as ResultSetHeader).insertId;
}
