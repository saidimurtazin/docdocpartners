import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  notifyReferralStatusChange,
  notifyPaymentProcessed,
  notifyNewReferral,
  notifyBonusPointsEarned,
} from "./telegram-notifications";

// Mock fetch globally
global.fetch = vi.fn();

describe("Telegram Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful Telegram API response
    (global.fetch as any).mockResolvedValue({
      json: async () => ({ ok: true, result: { message_id: 123 } }),
    });
  });

  describe("notifyReferralStatusChange", () => {
    it("should send notification when referral status changes to completed", async () => {
      const result = await notifyReferralStatusChange("123456789", {
        id: 1,
        patientFullName: "Иван Иванов",
        oldStatus: "scheduled",
        newStatus: "completed",
        clinic: "MEDSI",
        treatmentAmount: 5000000, // 50,000 rubles in kopecks
        commissionAmount: 500000, // 5,000 rubles in kopecks
      });

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[0]).toContain("/sendMessage");
      
      const body = JSON.parse(callArgs[1].body);
      expect(body.chat_id).toBe("123456789");
      expect(body.text).toContain("Иван Иванов");
      expect(body.text).toContain("MEDSI");
      expect(body.text).toContain("50\u00a0000,00\u00a0₽");
      expect(body.text).toContain("5\u00a0000,00\u00a0₽");
      expect(body.parse_mode).toBe("HTML");
    });

    it("should send notification when referral status changes to contacted", async () => {
      const result = await notifyReferralStatusChange("123456789", {
        id: 2,
        patientFullName: "Мария Петрова",
        oldStatus: "pending",
        newStatus: "contacted",
        clinic: "MIBS",
      });

      expect(result).toBe(true);
      
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.text).toContain("Мария Петрова");
      expect(body.text).toContain("координатор связался");
    });

    it("should send notification when referral is cancelled", async () => {
      const result = await notifyReferralStatusChange("123456789", {
        id: 3,
        patientFullName: "Петр Сидоров",
        oldStatus: "scheduled",
        newStatus: "cancelled",
      });

      expect(result).toBe(true);
      
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.text).toContain("отменена");
    });

    it("should handle Telegram API errors gracefully", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: false, error_code: 400, description: "Bad Request" }),
      });

      const result = await notifyReferralStatusChange("123456789", {
        id: 1,
        patientFullName: "Тест",
        oldStatus: "pending",
        newStatus: "contacted",
      });

      expect(result).toBe(false);
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const result = await notifyReferralStatusChange("123456789", {
        id: 1,
        patientFullName: "Тест",
        oldStatus: "pending",
        newStatus: "contacted",
      });

      expect(result).toBe(false);
    });
  });

  describe("notifyPaymentProcessed", () => {
    it("should send notification when payment is completed", async () => {
      const result = await notifyPaymentProcessed("123456789", {
        id: 1,
        amount: 500000, // 5,000 rubles
        status: "completed",
        method: "bank_transfer",
        transactionId: "TXN123456",
      });

      expect(result).toBe(true);
      
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.text).toContain("5\u00a0000,00\u00a0₽");
      expect(body.text).toContain("Банковский перевод");
      expect(body.text).toContain("TXN123456");
      expect(body.text).toContain("успешно завершена");
    });

    it("should send notification when payment is processing", async () => {
      const result = await notifyPaymentProcessed("123456789", {
        id: 2,
        amount: 300000,
        status: "processing",
      });

      expect(result).toBe(true);
      
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.text).toContain("обрабатывается");
    });

    it("should send notification when payment fails", async () => {
      const result = await notifyPaymentProcessed("123456789", {
        id: 3,
        amount: 200000,
        status: "failed",
      });

      expect(result).toBe(true);
      
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.text).toContain("Ошибка");
    });
  });

  describe("notifyNewReferral", () => {
    it("should send notification when new referral is created", async () => {
      const result = await notifyNewReferral("123456789", {
        id: 5,
        patientFullName: "Анна Смирнова",
        clinic: "Olymp Clinic",
      });

      expect(result).toBe(true);
      
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.text).toContain("Новая рекомендация");
      expect(body.text).toContain("Анна Смирнова");
      expect(body.text).toContain("Olymp Clinic");
    });

    it("should work without clinic specified", async () => {
      const result = await notifyNewReferral("123456789", {
        id: 6,
        patientFullName: "Дмитрий Козлов",
      });

      expect(result).toBe(true);
      
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.text).toContain("Дмитрий Козлов");
    });
  });

  describe("notifyBonusPointsEarned", () => {
    it("should send notification when agent earns bonus points", async () => {
      const result = await notifyBonusPointsEarned("123456789", {
        points: 5000,
        referredAgentName: "Доктор Иванов",
        totalPoints: 15000,
      });

      expect(result).toBe(true);
      
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.text).toContain("+5000 баллов");
      expect(body.text).toContain("Доктор Иванов");
      expect(body.text).toContain("15000");
    });
  });

  describe("Amount formatting", () => {
    it("should format amounts correctly in rubles", async () => {
      await notifyReferralStatusChange("123456789", {
        id: 1,
        patientFullName: "Тест",
        oldStatus: "scheduled",
        newStatus: "completed",
        treatmentAmount: 12345678, // 123,456.78 rubles
        commissionAmount: 1234567, // 12,345.67 rubles
      });

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      // Russian number formatting uses non-breaking spaces
      expect(body.text).toMatch(/123.*456/);
      expect(body.text).toMatch(/12.*345/);
    });
  });
});
