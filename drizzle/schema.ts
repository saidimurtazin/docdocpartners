import { boolean, double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  telegramId: varchar("telegramId", { length: 64 }).unique(),
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
  // Jump.Finance integration
  jumpContractorId: int("jumpContractorId"), // ID контрагента в Jump.Finance
  payoutMethod: mysqlEnum("payoutMethod", ["card", "sbp", "bank_account"]).default("card").notNull(),
  cardNumber: varchar("cardNumber", { length: 19 }), // номер карты (16-19 цифр)
  jumpRequisiteId: int("jumpRequisiteId"), // ID реквизита в Jump.Finance
  jumpIdentified: boolean("jumpIdentified").default(false), // прошёл идентификацию в Jump
  excludedClinics: text("excludedClinics"), // JSON array of clinic IDs, e.g. "[1,3,5]"
  commissionOverride: text("commissionOverride"), // JSON: [{minMonthlyRevenue: number, commissionRate: number}] — индивидуальные тарифы
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
  status: mysqlEnum("status", ["new", "in_progress", "contacted", "scheduled", "visited", "paid", "duplicate", "no_answer", "cancelled"]).default("new").notNull(),
  treatmentAmount: int("treatmentAmount").default(0), // сумма лечения в копейках
  commissionAmount: int("commissionAmount").default(0), // вознаграждение агенту в копейках
  treatmentMonth: varchar("treatmentMonth", { length: 7 }), // "YYYY-MM" — месяц лечения для расчёта тиров
  contactConsent: boolean("contactConsent"), // согласие пациента на связь от DocDoc
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
  amount: int("amount").notNull(), // в копейках (gross — списывается с баланса)
  grossAmount: int("grossAmount"), // валовая сумма = amount (дублирование для явности)
  netAmount: int("netAmount"), // чистая сумма к выплате (после вычетов)
  taxAmount: int("taxAmount").default(0), // НДФЛ 13% для физлица (копейки)
  socialContributions: int("socialContributions").default(0), // соц. отчисления 30% для физлица (копейки)
  isSelfEmployedSnapshot: mysqlEnum("isSelfEmployedSnapshot", ["yes", "no"]), // налоговый статус на момент запроса
  status: mysqlEnum("status", ["pending", "act_generated", "sent_for_signing", "signed", "ready_for_payment", "processing", "completed", "failed"]).default("pending").notNull(),
  method: varchar("method", { length: 50 }), // card, bank_transfer, etc.
  payoutVia: mysqlEnum("payoutVia", ["manual", "jump"]).default("manual").notNull(),
  transactionId: varchar("transactionId", { length: 255 }),
  // Jump.Finance payment tracking
  jumpPaymentId: varchar("jumpPaymentId", { length: 50 }),
  jumpStatus: int("jumpStatus"), // Jump status (1-8)
  jumpStatusText: varchar("jumpStatusText", { length: 50 }),
  jumpAmountPaid: int("jumpAmountPaid"), // фактически выплачено (копейки)
  jumpCommission: int("jumpCommission"), // комиссия Jump (копейки)
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

/**
 * Partner clinics (клиники-партнеры)
 */
export const clinics = mysqlTable("clinics", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }), // Многопрофильная, Узкопрофильная
  ownership: varchar("ownership", { length: 100 }), // Частная, Государственная
  city: varchar("city", { length: 100 }),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  website: varchar("website", { length: 500 }),
  specializations: text("specializations"), // JSON array of specializations
  certifications: text("certifications"),
  description: text("description"),
  commissionRate: int("commissionRate").default(10), // % комиссии агенту
  commissionTiers: text("commissionTiers"), // JSON: [{threshold: число_копеек, rate: %}] — тарифные уровни для владельца (инфо)
  averageCheck: int("averageCheck").default(0), // средний чек в копейках
  foundedYear: int("foundedYear"),
  languages: varchar("languages", { length: 255 }).default("Русский"),
  imageUrl: varchar("imageUrl", { length: 500 }),
  reportEmails: text("reportEmails"), // JSON array of emails from which clinic sends patient reports
  latitude: double("latitude"),
  longitude: double("longitude"),
  isActive: mysqlEnum("isActive", ["yes", "no"]).default("yes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Clinic = typeof clinics.$inferSelect;
export type InsertClinic = typeof clinics.$inferInsert;

/**
 * Clinic reports — реестр отчётов от клиник (AI-парсинг email)
 */
export const clinicReports = mysqlTable("clinic_reports", {
  id: int("id").autoincrement().primaryKey(),

  // FK (nullable — может быть не привязан)
  referralId: int("referralId"),
  clinicId: int("clinicId"),

  // Email-метаданные
  emailFrom: varchar("emailFrom", { length: 320 }).notNull(),
  emailSubject: varchar("emailSubject", { length: 500 }),
  emailMessageId: varchar("emailMessageId", { length: 500 }).notNull().unique(),
  emailReceivedAt: timestamp("emailReceivedAt"),
  emailBodyRaw: text("emailBodyRaw"),

  // AI-извлечённые поля
  patientName: varchar("patientName", { length: 255 }),
  visitDate: varchar("visitDate", { length: 50 }),
  treatmentAmount: int("treatmentAmount").default(0), // копейки
  services: text("services"), // JSON array
  clinicName: varchar("clinicName", { length: 255 }),

  // Статус и уверенность
  status: mysqlEnum("status", ["pending_review", "auto_matched", "approved", "rejected"]).default("pending_review").notNull(),
  aiConfidence: int("aiConfidence").default(0), // 0-100
  matchConfidence: int("matchConfidence").default(0), // 0-100

  // Рецензирование
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  reviewNotes: text("reviewNotes"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClinicReport = typeof clinicReports.$inferSelect;
export type InsertClinicReport = typeof clinicReports.$inferInsert;

/**
 * Payment acts — акты на оплату с подписанием через ПЭП
 */
export const paymentActs = mysqlTable("payment_acts", {
  id: int("id").autoincrement().primaryKey(),
  paymentId: int("paymentId").notNull(),
  agentId: int("agentId").notNull(),

  // Document metadata
  actNumber: varchar("actNumber", { length: 50 }).notNull().unique(),
  actDate: timestamp("actDate").notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),

  // Financial
  totalAmount: int("totalAmount").notNull(), // kopecks

  // File storage
  pdfStorageKey: varchar("pdfStorageKey", { length: 500 }),
  pdfUrl: varchar("pdfUrl", { length: 1000 }),

  // Signing workflow
  status: mysqlEnum("status", ["generated", "sent_for_signing", "signed", "cancelled"]).default("generated").notNull(),

  // OTP for signing
  otpCode: varchar("otpCode", { length: 6 }),
  otpExpiresAt: timestamp("otpExpiresAt"),
  otpAttempts: int("otpAttempts").default(0),
  otpSentVia: varchar("otpSentVia", { length: 20 }),

  // Signing data
  signedAt: timestamp("signedAt"),
  signedIp: varchar("signedIp", { length: 45 }),
  signedUserAgent: text("signedUserAgent"),

  // Snapshot of agent requisites at time of act generation
  agentFullNameSnapshot: varchar("agentFullNameSnapshot", { length: 255 }).notNull(),
  agentInnSnapshot: varchar("agentInnSnapshot", { length: 12 }).notNull(),
  agentBankNameSnapshot: varchar("agentBankNameSnapshot", { length: 255 }).notNull(),
  agentBankAccountSnapshot: varchar("agentBankAccountSnapshot", { length: 20 }).notNull(),
  agentBankBikSnapshot: varchar("agentBankBikSnapshot", { length: 9 }).notNull(),

  // Referral IDs included in this act (JSON array)
  referralIds: text("referralIds"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentAct = typeof paymentActs.$inferSelect;
export type InsertPaymentAct = typeof paymentActs.$inferInsert;

/**
 * Application settings — глобальные настройки (тарифы агентов и т.д.)
 */
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(), // JSON value
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;
