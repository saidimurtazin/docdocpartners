import { randomBytes } from 'crypto';

// Store OTP codes temporarily (in production, use Redis)
const otpStore = new Map<string, { code: string; telegramId: number; expiresAt: number }>();

// Telegram Bot API configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_BOT_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Generate 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate unique session ID
 */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Send OTP code to user via Telegram
 */
export async function sendTelegramOTP(telegramId: number, code: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return false;
  }

  try {
    const message = `🔐 **Код для входа в личный кабинет DocDocPartner**\n\n` +
                   `Ваш код: **${code}**\n\n` +
                   `Код действителен 5 минут.\n\n` +
                   `Если вы не запрашивали вход, проигнорируйте это сообщение.`;

    const response = await fetch(`${TELEGRAM_BOT_API}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      console.error('Failed to send Telegram message:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Telegram OTP:', error);
    return false;
  }
}

/**
 * Store OTP code for verification
 */
export function storeOTP(sessionId: string, telegramId: number, code: string): void {
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  otpStore.set(sessionId, { code, telegramId, expiresAt });
}

/**
 * Verify OTP code
 */
export function verifyOTP(sessionId: string, code: string): { valid: boolean; telegramId?: number } {
  const stored = otpStore.get(sessionId);
  
  if (!stored) {
    return { valid: false };
  }

  // Check expiration
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(sessionId);
    return { valid: false };
  }

  // Check code
  if (stored.code !== code) {
    return { valid: false };
  }

  // Valid - clean up and return telegram ID
  otpStore.delete(sessionId);
  return { valid: true, telegramId: stored.telegramId };
}

/**
 * Clean up expired OTP codes (call periodically)
 */
export function cleanupExpiredOTPs(): void {
  const now = Date.now();
  const toDelete: string[] = [];
  
  otpStore.forEach((data, sessionId) => {
    if (now > data.expiresAt) {
      toDelete.push(sessionId);
    }
  });
  
  toDelete.forEach(sessionId => otpStore.delete(sessionId));
}

// Clean up expired OTPs every minute
setInterval(cleanupExpiredOTPs, 60 * 1000);
