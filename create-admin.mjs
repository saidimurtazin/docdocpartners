import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

// Create admin user
const adminOpenId = `telegram_${Date.now()}`;

await db.insert(schema.users).values({
  openId: adminOpenId,
  name: "Admin",
  email: "admin@docdocpartner.com",
  loginMethod: "telegram",
  role: "admin",
});

console.log('✅ Admin user created successfully!');
console.log('Email: admin@docdocpartner.com');
console.log('You can now login via OAuth or Telegram');

await connection.end();
process.exit(0);
