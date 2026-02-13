import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyTelegramAuth, formatTelegramUser, type TelegramAuthData } from "./telegram-widget-auth";
import crypto from "crypto";

// Mock ENV
vi.mock("./_core/env", () => ({
  ENV: {
    telegramBotToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
  },
}));

describe("Telegram Widget Authentication", () => {
  describe("verifyTelegramAuth", () => {
    it("should verify valid Telegram auth data", () => {
      const botToken = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
      const authDate = Math.floor(Date.now() / 1000);
      
      // Create test data
      const dataToCheck = {
        id: 123456789,
        first_name: "John",
        last_name: "Doe",
        username: "johndoe",
        photo_url: "https://example.com/photo.jpg",
        auth_date: authDate,
      };

      // Calculate correct hash
      const dataCheckString = Object.keys(dataToCheck)
        .sort()
        .map((key) => `${key}=${dataToCheck[key as keyof typeof dataToCheck]}`)
        .join("\n");

      const secretKey = crypto.createHash("sha256").update(botToken).digest();
      const hash = crypto
        .createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      const authData: TelegramAuthData = {
        ...dataToCheck,
        hash,
      };

      const result = verifyTelegramAuth(authData);
      expect(result).toBe(true);
    });

    it("should reject auth data with invalid hash", () => {
      const authData: TelegramAuthData = {
        id: 123456789,
        first_name: "John",
        auth_date: Math.floor(Date.now() / 1000),
        hash: "invalid_hash",
      };

      const result = verifyTelegramAuth(authData);
      expect(result).toBe(false);
    });

    it("should reject auth data that is too old", () => {
      const botToken = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
      // Auth date from 25 hours ago (exceeds 24 hour limit)
      const authDate = Math.floor(Date.now() / 1000) - (25 * 60 * 60);
      
      const dataToCheck = {
        id: 123456789,
        first_name: "John",
        auth_date: authDate,
      };

      const dataCheckString = Object.keys(dataToCheck)
        .sort()
        .map((key) => `${key}=${dataToCheck[key as keyof typeof dataToCheck]}`)
        .join("\n");

      const secretKey = crypto.createHash("sha256").update(botToken).digest();
      const hash = crypto
        .createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      const authData: TelegramAuthData = {
        ...dataToCheck,
        hash,
      };

      const result = verifyTelegramAuth(authData);
      expect(result).toBe(false);
    });

    it("should handle auth data with minimal fields", () => {
      const botToken = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
      const authDate = Math.floor(Date.now() / 1000);
      
      const dataToCheck = {
        id: 123456789,
        first_name: "John",
        auth_date: authDate,
      };

      const dataCheckString = Object.keys(dataToCheck)
        .sort()
        .map((key) => `${key}=${dataToCheck[key as keyof typeof dataToCheck]}`)
        .join("\n");

      const secretKey = crypto.createHash("sha256").update(botToken).digest();
      const hash = crypto
        .createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      const authData: TelegramAuthData = {
        ...dataToCheck,
        hash,
      };

      const result = verifyTelegramAuth(authData);
      expect(result).toBe(true);
    });

    it("should handle auth data with all optional fields", () => {
      const botToken = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
      const authDate = Math.floor(Date.now() / 1000);
      
      const dataToCheck = {
        id: 123456789,
        first_name: "John",
        last_name: "Doe",
        username: "johndoe",
        photo_url: "https://example.com/photo.jpg",
        auth_date: authDate,
      };

      const dataCheckString = Object.keys(dataToCheck)
        .sort()
        .map((key) => `${key}=${dataToCheck[key as keyof typeof dataToCheck]}`)
        .join("\n");

      const secretKey = crypto.createHash("sha256").update(botToken).digest();
      const hash = crypto
        .createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      const authData: TelegramAuthData = {
        ...dataToCheck,
        hash,
      };

      const result = verifyTelegramAuth(authData);
      expect(result).toBe(true);
    });
  });

  describe("formatTelegramUser", () => {
    it("should format user data with all fields", () => {
      const authData: TelegramAuthData = {
        id: 123456789,
        first_name: "John",
        last_name: "Doe",
        username: "johndoe",
        photo_url: "https://example.com/photo.jpg",
        auth_date: Math.floor(Date.now() / 1000),
        hash: "test_hash",
      };

      const result = formatTelegramUser(authData);

      expect(result).toEqual({
        telegramId: "123456789",
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
        photoUrl: "https://example.com/photo.jpg",
      });
    });

    it("should format user data with minimal fields", () => {
      const authData: TelegramAuthData = {
        id: 123456789,
        first_name: "John",
        auth_date: Math.floor(Date.now() / 1000),
        hash: "test_hash",
      };

      const result = formatTelegramUser(authData);

      expect(result).toEqual({
        telegramId: "123456789",
        firstName: "John",
        lastName: null,
        username: null,
        photoUrl: null,
      });
    });

    it("should convert numeric ID to string", () => {
      const authData: TelegramAuthData = {
        id: 999999999,
        first_name: "Test",
        auth_date: Math.floor(Date.now() / 1000),
        hash: "test_hash",
      };

      const result = formatTelegramUser(authData);

      expect(result.telegramId).toBe("999999999");
      expect(typeof result.telegramId).toBe("string");
    });

    it("should handle Cyrillic names", () => {
      const authData: TelegramAuthData = {
        id: 123456789,
        first_name: "Иван",
        last_name: "Иванов",
        username: "ivanov",
        auth_date: Math.floor(Date.now() / 1000),
        hash: "test_hash",
      };

      const result = formatTelegramUser(authData);

      expect(result.firstName).toBe("Иван");
      expect(result.lastName).toBe("Иванов");
    });
  });
});
