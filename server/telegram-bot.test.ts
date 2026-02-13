/**
 * Test to validate Telegram bot token
 */

import { describe, it, expect } from 'vitest';
import { ENV } from './_core/env';

describe('Telegram Bot Token Validation', () => {
  it('should have valid bot token format', () => {
    const token = ENV.telegramBotToken;
    
    // Check token exists
    expect(token).toBeDefined();
    expect(token).not.toBe('');
    
    // Check token format (should be like "123456789:ABCdefGHIjklMNOpqrsTUVwxyz")
    const tokenRegex = /^\d+:[A-Za-z0-9_-]+$/;
    expect(token).toMatch(tokenRegex);
    
    console.log('✅ Bot token format is valid');
  });

  it('should be able to call Telegram API with token', async () => {
    const token = ENV.telegramBotToken;
    
    // Call getMe endpoint to validate token
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.ok).toBe(true);
    expect(data.result).toBeDefined();
    expect(data.result.username).toBe('docpartnerbot');
    
    console.log('✅ Bot token is valid and connected to @docpartnerbot');
    console.log(`Bot info: ${data.result.first_name} (@${data.result.username})`);
  });
});
