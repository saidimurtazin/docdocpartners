import { describe, it, expect } from 'vitest';
import { sendOTPEmail } from './email';

describe('Email Service', () => {
  it('should send OTP email successfully', async () => {
    // Test sending OTP email to verify SMTP credentials
    const testEmail = 'said.murtazin@mail.ru';
    const testCode = '123456';
    
    const result = await sendOTPEmail(testEmail, testCode);
    
    // Should return true if email was sent successfully
    expect(result).toBe(true);
  }, 30000); // 30 second timeout for email sending
});
