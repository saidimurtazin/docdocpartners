import crypto from "crypto";
import { ENV } from "./_core/env";

/**
 * Telegram Login Widget Authentication
 * Verifies the authenticity of data received from Telegram Login Widget
 */

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Verifies Telegram authentication data
 * @param authData - Data received from Telegram Login Widget
 * @returns true if data is authentic, false otherwise
 */
export function verifyTelegramAuth(authData: TelegramAuthData): boolean {
  const { hash, ...dataToCheck } = authData;

  // Create data-check-string by sorting keys alphabetically
  const dataCheckString = Object.keys(dataToCheck)
    .sort()
    .map((key) => {
      const value = dataToCheck[key as keyof typeof dataToCheck];
      return `${key}=${value}`;
    })
    .join("\n");

  // Get bot token from environment
  const botToken = ENV.telegramBotToken;
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN is not set in environment");
    return false;
  }

  // Create secret key: SHA256(bot_token)
  const secretKey = crypto.createHash("sha256").update(botToken).digest();

  // Calculate HMAC-SHA256
  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // Compare with received hash
  if (hmac !== hash) {
    console.error("Telegram auth hash mismatch");
    return false;
  }

  // Check if auth_date is not too old (max 24 hours)
  const now = Math.floor(Date.now() / 1000);
  const maxAge = 24 * 60 * 60; // 24 hours in seconds
  
  if (now - authData.auth_date > maxAge) {
    console.error("Telegram auth data is too old");
    return false;
  }

  return true;
}

/**
 * Formats Telegram user data for database storage
 */
export function formatTelegramUser(authData: TelegramAuthData) {
  return {
    telegramId: authData.id.toString(),
    firstName: authData.first_name,
    lastName: authData.last_name || null,
    username: authData.username || null,
    photoUrl: authData.photo_url || null,
  };
}
