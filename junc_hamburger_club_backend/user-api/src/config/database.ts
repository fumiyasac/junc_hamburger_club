import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? 'junc_hamburger',
  user: process.env.DB_USER ?? 'junc_user',
  password: process.env.DB_PASSWORD ?? 'junc_password',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+09:00',
  charset: 'utf8mb4',
});
