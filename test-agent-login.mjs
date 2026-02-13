import mysql from 'mysql2/promise';
import { SignJWT, jwtVerify } from 'jose';

const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = "app_session_id";

async function testAgentLogin() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  try {
    // 1. Get latest OTP code for said.i.murtazin@gmail.com
    const [otpRows] = await conn.execute(
      'SELECT * FROM otpCodes WHERE email = ? ORDER BY createdAt DESC LIMIT 1',
      ['said.i.murtazin@gmail.com']
    );
    
    if (otpRows.length === 0) {
      console.log('❌ No OTP code found');
      return;
    }
    
    const otpRecord = otpRows[0];
    console.log('✅ OTP code found:', otpRecord.code);
    console.log('   Created at:', otpRecord.createdAt);
    console.log('   Expires at:', otpRecord.expiresAt);
    
    // 2. Get agent by email
    const [agentRows] = await conn.execute(
      'SELECT * FROM agents WHERE email = ?',
      ['said.i.murtazin@gmail.com']
    );
    
    if (agentRows.length === 0) {
      console.log('❌ Agent not found');
      return;
    }
    
    const agent = agentRows[0];
    console.log('✅ Agent found:', {
      id: agent.id,
      fullName: agent.fullName,
      email: agent.email,
      status: agent.status
    });
    
    // 3. Create JWT token (simulate verifyOtp)
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT({
      userId: agent.id,
      agentId: agent.id,
      role: "agent",
      telegramId: agent.telegramId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);
    
    console.log('✅ JWT token created');
    console.log('   Token length:', token.length);
    
    // 4. Verify JWT token (simulate verifyAgentSession)
    const { payload } = await jwtVerify(token, secret);
    console.log('✅ JWT token verified');
    console.log('   Payload:', payload);
    console.log('   agentId:', payload.agentId);
    
    if (payload.agentId === agent.id) {
      console.log('✅ agentId matches!');
    } else {
      console.log('❌ agentId mismatch!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await conn.end();
  }
}

testAgentLogin();
