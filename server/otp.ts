import { getDb } from "./db";
import { otpCodes } from "../drizzle/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { generateOTP, sendOTPEmail } from "./email";

/**
 * Create and send OTP code to email
 */
export async function createAndSendOTP(email: string): Promise<boolean> {
  try {
    // Generate OTP
    const code = generateOTP();
    
    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    // Save to database
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    await db.insert(otpCodes).values({
      email,
      code,
      expiresAt,
      used: "no",
    });
    
    // Send email
    const sent = await sendOTPEmail(email, code);
    
    return sent;
  } catch (error) {
    console.error("Error creating and sending OTP:", error);
    return false;
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(email: string, code: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    
    // Find valid OTP
    const [otpRecord] = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.email, email),
          eq(otpCodes.code, code),
          eq(otpCodes.used, "no"),
          sql`${otpCodes.expiresAt} > NOW()`
        )
      )
      .limit(1);
    
    if (!otpRecord) {
      return false;
    }
    
    // Mark as used
    await db
      .update(otpCodes)
      .set({ used: "yes" })
      .where(eq(otpCodes.id, otpRecord.id));
    
    return true;
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return false;
  }
}

/**
 * Clean up expired OTP codes (call this periodically)
 */
export async function cleanupExpiredOTPs(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    
    await db
      .delete(otpCodes)
      .where(sql`${otpCodes.expiresAt} < NOW()`);
  } catch (error) {
    console.error("Error cleaning up expired OTPs:", error);
  }
}
