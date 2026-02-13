import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notifyNewDeviceLogin } from "./telegram-notifications";

// Mock fetch globally
global.fetch = vi.fn();

describe("Login Notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = "test_token_123";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("notifyNewDeviceLogin", () => {
    it("should send notification with full device info", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      const result = await notifyNewDeviceLogin("123456789", {
        deviceInfo: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ipAddress: "192.168.1.1",
        loginMethod: "telegram",
        timestamp: new Date("2026-02-07T12:00:00Z"),
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain("sendMessage");
      
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.chat_id).toBe("123456789");
      expect(body.parse_mode).toBe("HTML");
      expect(body.text).toContain("Вход в личный кабинет");
      expect(body.text).toContain("Chrome на Windows");
      expect(body.text).toContain("192.168.1.1");
      expect(body.text).toContain("Telegram");
    });

    it("should handle unknown device info", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      const result = await notifyNewDeviceLogin("123456789", {
        deviceInfo: null,
        ipAddress: "192.168.1.1",
        loginMethod: "telegram",
        timestamp: new Date("2026-02-07T12:00:00Z"),
      });

      expect(result).toBe(true);
      
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.text).toContain("Неизвестное устройство");
    });

    it("should handle missing IP address", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      const result = await notifyNewDeviceLogin("123456789", {
        deviceInfo: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        ipAddress: null,
        loginMethod: "telegram",
        timestamp: new Date("2026-02-07T12:00:00Z"),
      });

      expect(result).toBe(true);
      
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.text).toContain("Неизвестен");
    });

    it("should detect mobile devices", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      const result = await notifyNewDeviceLogin("123456789", {
        deviceInfo: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        ipAddress: "10.0.0.1",
        loginMethod: "telegram",
        timestamp: new Date(),
      });

      expect(result).toBe(true);
      
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.text).toContain("Safari на iOS");
    });

    it("should detect Android devices", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      const result = await notifyNewDeviceLogin("123456789", {
        deviceInfo: "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        ipAddress: "10.0.0.1",
        loginMethod: "telegram",
        timestamp: new Date(),
      });

      expect(result).toBe(true);
      
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.text).toContain("Chrome на Android");
    });

    it("should detect macOS devices", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      const result = await notifyNewDeviceLogin("123456789", {
        deviceInfo: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ipAddress: "10.0.0.1",
        loginMethod: "telegram",
        timestamp: new Date(),
      });

      expect(result).toBe(true);
      
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.text).toContain("Chrome на macOS");
    });

    it("should detect Firefox browser", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      const result = await notifyNewDeviceLogin("123456789", {
        deviceInfo: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
        ipAddress: "10.0.0.1",
        loginMethod: "telegram",
        timestamp: new Date(),
      });

      expect(result).toBe(true);
      
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.text).toContain("Firefox на Windows");
    });

    it("should include security warning", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      const result = await notifyNewDeviceLogin("123456789", {
        deviceInfo: "Test Device",
        ipAddress: "192.168.1.1",
        loginMethod: "telegram",
        timestamp: new Date(),
      });

      expect(result).toBe(true);
      
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.text).toContain("Если это были не вы");
      expect(body.text).toContain("Завершите все сессии");
      expect(body.text).toContain("Смените пароль");
      expect(body.text).toContain("Свяжитесь с поддержкой");
    });

    it("should handle Telegram API errors", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, description: "Chat not found" }),
      } as Response);

      const result = await notifyNewDeviceLogin("123456789", {
        deviceInfo: "Test Device",
        ipAddress: "192.168.1.1",
        loginMethod: "telegram",
        timestamp: new Date(),
      });

      expect(result).toBe(false);
    });

    it("should handle network errors", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await notifyNewDeviceLogin("123456789", {
        deviceInfo: "Test Device",
        ipAddress: "192.168.1.1",
        loginMethod: "telegram",
        timestamp: new Date(),
      });

      expect(result).toBe(false);
    });

    it("should format timestamp in Russian locale", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      const testDate = new Date("2026-02-07T15:30:00Z");
      
      const result = await notifyNewDeviceLogin("123456789", {
        deviceInfo: "Test Device",
        ipAddress: "192.168.1.1",
        loginMethod: "telegram",
        timestamp: testDate,
      });

      expect(result).toBe(true);
      
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      // Check that timestamp is formatted (exact format depends on locale)
      expect(body.text).toContain("Время:");
    });
  });
});
