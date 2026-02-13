import { describe, it, expect } from "vitest";
import { calculatePayout, canRequestPayout } from "./payout-calculator";
import { checkSelfEmploymentStatus } from "./self-employment-check";

describe("Payout Calculator", () => {
  it("should calculate 7% commission for self-employed agent", () => {
    const result = calculatePayout({
      treatmentAmount: 10000000, // 100,000 RUB
      isSelfEmployed: true,
      monthlyVolume: 50000000, // 500,000 RUB monthly
    });

    expect(result.commissionRate).toBe(0.07);
    expect(result.grossAmount).toBe(700000); // 7,000 RUB
    expect(result.taxAmount).toBe(0); // Self-employed pays own taxes
    expect(result.netAmount).toBe(700000);
  });

  it("should calculate 7% commission with NDFL deduction for non-self-employed", () => {
    const result = calculatePayout({
      treatmentAmount: 10000000, // 100,000 RUB
      isSelfEmployed: false,
      monthlyVolume: 50000000, // 500,000 RUB monthly
    });

    expect(result.commissionRate).toBe(0.07);
    expect(result.grossAmount).toBe(700000); // 7,000 RUB
    expect(result.taxAmount).toBe(91000); // 13% NDFL
    expect(result.socialContributions).toBe(210000); // 30% social
    expect(result.netAmount).toBe(399000); // After all deductions
  });

  it("should apply 10% commission for high-volume agents (>1M RUB/month)", () => {
    const result = calculatePayout({
      treatmentAmount: 10000000, // 100,000 RUB
      isSelfEmployed: true,
      monthlyVolume: 150000000, // 1.5M RUB monthly - high volume
    });

    expect(result.commissionRate).toBe(0.1);
    expect(result.grossAmount).toBe(1000000); // 10,000 RUB
    expect(result.netAmount).toBe(1000000);
  });

  it("should calculate correctly for low monthly volume", () => {
    const result = calculatePayout({
      treatmentAmount: 10000000,
      isSelfEmployed: false,
      monthlyVolume: 30000000, // 300,000 RUB - below 1M threshold
    });

    expect(result.commissionRate).toBe(0.07);
    expect(result.grossAmount).toBe(700000);
  });
});

describe("Self-Employment Verification", () => {
  it("should validate INN format", async () => {
    const result = await checkSelfEmploymentStatus("123456789012");

    expect(result.isValid).toBe(true);
    expect(result.inn).toBe("123456789012");
    expect(result.status).toBe("pending_verification");
  });

  it("should reject invalid INN format", async () => {
    const result = await checkSelfEmploymentStatus("12345");

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Неверный формат ИНН");
  });
});

describe("Referral System", () => {
  it("should award 5000 bonus points for successful referral", () => {
    const bonusPoints = 5000;
    const minimumReferralsForWithdrawal = 10;

    expect(bonusPoints).toBe(5000);
    expect(minimumReferralsForWithdrawal).toBe(10);
  });

  it("should block withdrawal with less than 10 referrals", () => {
    const result = canRequestPayout(8, 15000);

    expect(result.canWithdraw).toBe(false);
    expect(result.reason).toContain("минимум 10");
  });

  it("should allow withdrawal with 10+ referrals", () => {
    const result = canRequestPayout(12, 20000);

    expect(result.canWithdraw).toBe(true);
  });
});
