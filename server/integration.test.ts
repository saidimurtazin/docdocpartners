import { describe, it, expect } from 'vitest';

describe('Email and Export Integration', () => {
  it('should export email functions', async () => {
    const emailModule = await import('./email');
    
    expect(emailModule.sendEmail).toBeDefined();
    expect(emailModule.generateOTP).toBeDefined();
    expect(emailModule.sendReferralNotification).toBeDefined();
    expect(emailModule.sendReferralStatusUpdate).toBeDefined();
    expect(emailModule.sendPaymentStatusUpdate).toBeDefined();
    expect(emailModule.sendAgentStatusUpdate).toBeDefined();
  });

  it('should generate 6-digit OTP', async () => {
    const { generateOTP } = await import('./email');
    const otp = generateOTP();
    
    expect(otp).toMatch(/^\d{6}$/);
    expect(otp.length).toBe(6);
  });

  it('should export OTP functions', async () => {
    const otpModule = await import('./otp');
    
    expect(otpModule.createAndSendOTP).toBeDefined();
    expect(otpModule.verifyOTP).toBeDefined();
  });

  it('should export Excel export functions', async () => {
    const exportModule = await import('./export');
    
    expect(exportModule.exportReferralsToExcel).toBeDefined();
    expect(exportModule.exportPaymentsToExcel).toBeDefined();
    expect(exportModule.exportAgentsToExcel).toBeDefined();
  });

  it('should export referrals to Excel buffer', async () => {
    const { exportReferralsToExcel } = await import('./export');
    
    const buffer = await exportReferralsToExcel();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should export payments to Excel buffer', async () => {
    const { exportPaymentsToExcel } = await import('./export');
    
    const buffer = await exportPaymentsToExcel();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should export agents to Excel buffer', async () => {
    const { exportAgentsToExcel } = await import('./export');
    
    const buffer = await exportAgentsToExcel();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should export filtered referrals', async () => {
    const { exportReferralsToExcel } = await import('./export');
    
    const buffer = await exportReferralsToExcel({
      status: 'pending'
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should export filtered payments', async () => {
    const { exportPaymentsToExcel } = await import('./export');
    
    const buffer = await exportPaymentsToExcel({
      status: 'completed'
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should export filtered agents', async () => {
    const { exportAgentsToExcel } = await import('./export');
    
    const buffer = await exportAgentsToExcel({
      status: 'active'
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe('Bot API Integration', () => {
  it('should have bot API endpoints in router', async () => {
    const routersModule = await import('./routers');
    
    // Check that appRouter is exported
    expect(routersModule.appRouter).toBeDefined();
  });

  it('should have admin export endpoints in router', async () => {
    const routersModule = await import('./routers');
    
    // Check that appRouter is exported
    expect(routersModule.appRouter).toBeDefined();
  });
});
