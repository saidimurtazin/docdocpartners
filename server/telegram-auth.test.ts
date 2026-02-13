import { describe, it, expect } from 'vitest';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_BOT_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

describe('Telegram Bot Token', () => {
  it('should validate bot token with getMe endpoint', async () => {
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    const response = await fetch(`${TELEGRAM_BOT_API}/getMe`);
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.ok).toBe(true);
    expect(data.result).toBeDefined();
    expect(data.result.is_bot).toBe(true);
  }, 10000);
});
