import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import { like } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

const agents = await db.select().from(schema.agents).where(like(schema.agents.email, '%murtazin%'));

console.log('Found agents:', JSON.stringify(agents, null, 2));

await connection.end();
