import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Telegram ID for OTP delivery (optional, for admins who want to use Email/OTP login) */
  telegramId: varchar("telegramId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Doctors knowledge base for clinic partners
 */
export const doctors = mysqlTable("doctors", {
  id: int("id").autoincrement().primaryKey(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  specialization: varchar("specialization", { length: 255 }).notNull(),
  clinic: varchar("clinic", { length: 255 }).notNull(),
  clinicLocation: varchar("clinicLocation", { length: 255 }),
  experience: int("experience"), // years of experience
  education: text("education"),
  achievements: text("achievements"),
  services: text("services"), // JSON array of services
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  bio: text("bio"),
  isActive: mysqlEnum("isActive", ["yes", "no"]).default("yes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Doctor = typeof doctors.$inferSelect;
export type InsertDoctor = typeof doctors.$inferInsert;

/**
 * Agents (врачи-агенты) who refer patients
 */
export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  telegramId: varchar("telegramId", { length: 64 }).notNull().unique(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  role: varchar("role", { length: 100 }), // Врач, Координатор, etc.
  city: varchar("city", { length: 100 }),
  specialization: varchar("specialization", { length: 255 }),
  status: mysqlEnum("status", ["pending", "active", "rejected", "blocked"]).default("pending").notNull(),
  referralCode: varchar("referralCode", { length: 50 }).unique(),
  referredBy: int("referredBy"), // ID агента, который пригласил
  totalEarnings: int("totalEarnings").default(0), // в копейках
  totalReferrals: int("totalReferrals").default(0),
  bonusPoints: int("bonusPoints").default(0), // бонусные баллы за рефералов
  inn: varchar("inn", { length: 12 }), // ИНН
  isSelfEmployed: mysqlEnum("isSelfEmployed", ["yes", "no", "unknown"]).default("unknown").notNull(),
  bankAccount: varchar("bankAccount", { length: 20 }), // номер счета
  bankName: varchar("bankName", { length: 255 }), // название банка
  bankBik: varchar("bankBik", { length: 9 }), // БИК банка
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

/**
 * Patient referrals (рекомендации пациентов)
 */
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(), // кто направил
  patientFullName: varchar("patientFullName", { length: 255 }).notNull(),
  patientBirthdate: varchar("patientBirthdate", { length: 50 }).notNull(),
  patientCity: varchar("patientCity", { length: 100 }),
  patientPhone: varchar("patientPhone", { length: 50 }),
  patientEmail: varchar("patientEmail", { length: 320 }),
  clinic: varchar("clinic", { length: 255 }), // какая клиника
  status: mysqlEnum("status", ["pending", "contacted", "scheduled", "completed", "cancelled"]).default("pending").notNull(),
  treatmentAmount: int("treatmentAmount").default(0), // сумма лечения в копейках
  commissionAmount: int("commissionAmount").default(0), // вознаграждение агенту в копейках
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

/**
 * Payments to agents (выплаты агентам)
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  amount: int("amount").notNull(), // в копейках
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  method: varchar("method", { length: 50 }), // card, bank_transfer, etc.
  transactionId: varchar("transactionId", { length: 255 }),
  notes: text("notes"),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * OTP codes for email verification
 */
export const otpCodes = mysqlTable("otpCodes", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: mysqlEnum("used", ["yes", "no"]).default("no").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OtpCode = typeof otpCodes.$inferSelect;
export type InsertOtpCode = typeof otpCodes.$inferInsert;

/**
 * User sessions for tracking logins and devices
 */
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(), // reference to agents table
  sessionToken: varchar("sessionToken", { length: 255 }).notNull().unique(),
  deviceInfo: text("deviceInfo"), // User-Agent string
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv4 or IPv6
  loginMethod: varchar("loginMethod", { length: 50 }).notNull(), // telegram, oauth, etc.
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  isRevoked: mysqlEnum("isRevoked", ["yes", "no"]).default("no").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;


