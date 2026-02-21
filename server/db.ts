import { eq, desc, and, like, sql, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, agents, referrals, payments, doctors, sessions, otpCodes, clinics, clinicReports, paymentActs, appSettings, tasks, type InsertSession, type InsertClinicReport, type InsertPaymentAct, type InsertTask } from "../drizzle/schema";
import { ENV } from './_core/env';
import { createHash } from "crypto";

/** Hash a session token with SHA-256 for safe storage */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ==================== ADMIN PANEL QUERIES ====================

// AGENTS

export async function getAllAgents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agents).orderBy(desc(agents.createdAt));
}

export async function getAgentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  return agent;
}

export async function getAgentByTelegramId(telegramId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [agent] = await db.select().from(agents).where(eq(agents.telegramId, telegramId));
  return agent;
}

export async function getAgentByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [agent] = await db.select().from(agents).where(eq(agents.email, email));
  return agent;
}

export async function getAgentByPhone(phone: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [agent] = await db.select().from(agents).where(eq(agents.phone, phone));
  return agent;
}

export async function getAgentByReferralCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [agent] = await db.select().from(agents).where(eq(agents.referralCode, code));
  return agent;
}

export async function createAgent(data: any) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(agents).values(data);
  return result.insertId;
}

export async function updateAgentStatus(id: number, status: "pending" | "active" | "rejected" | "blocked") {
  const db = await getDb();
  if (!db) return;
  
  // Get agent data before update to check old status and get telegramId
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  const oldStatus = agent?.status;
  
  await db.update(agents).set({ status }).where(eq(agents.id, id));
  
  // Send Telegram notification if status changed and agent has telegramId
  if (agent?.telegramId && oldStatus !== status) {
    const { notifyAgent } = await import('./telegram-bot-webhook');
    
    let message = '';
    if (status === 'active') {
      message = '🎉 <b>Поздравляем!</b>\n\n' +
        'Ваша заявка одобрена! Теперь вы можете отправлять пациентов и зарабатывать.\n\n' +
        'Используйте команду /patient для отправки нового пациента.';
    } else if (status === 'rejected') {
      message = '❌ <b>Заявка отклонена</b>\n\n' +
        'К сожалению, ваша заявка не была одобрена. Если у вас есть вопросы, свяжитесь с нами.';
    } else if (status === 'blocked') {
      message = '🚫 <b>Аккаунт заблокирован</b>\n\n' +
        'Ваш аккаунт был заблокирован. Для получения информации свяжитесь с администрацией.';
    }
    
    if (message) {
      await notifyAgent(agent.telegramId, message);
    }
  }
}

export async function updateAgentTelegramData(id: number, data: {
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  
  // Update only Telegram-related fields
  const updateData: any = {
    telegramId: data.telegramId,
  };
  
  // Update full name if we have first name
  if (data.firstName) {
    updateData.fullName = data.lastName 
      ? `${data.firstName} ${data.lastName}`
      : data.firstName;
  }
  
  await db.update(agents).set(updateData).where(eq(agents.id, id));
}

// REFERRALS

export async function getAllReferrals() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(referrals).orderBy(desc(referrals.createdAt));
}

export async function getReferralById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [referral] = await db.select().from(referrals).where(eq(referrals.id, id));
  return referral;
}

export async function getReferralsByAgentId(agentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(referrals)
    .where(eq(referrals.agentId, agentId))
    .orderBy(desc(referrals.createdAt));
}

export async function createReferral(data: any) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(referrals).values(data);
  return result.insertId;
}

export async function updateReferralStatus(
  id: number, 
  status: "new" | "in_progress" | "contacted" | "scheduled" | "visited" | "paid" | "duplicate" | "no_answer" | "cancelled"
) {
  const db = await getDb();
  if (!db) return;
  
  // Get referral data before update to get old status
  const referralResult = await db.select().from(referrals).where(eq(referrals.id, id)).limit(1);
  const oldReferral = referralResult[0];
  
  if (!oldReferral) {
    throw new Error(`Referral ${id} not found`);
  }
  
  const oldStatus = oldReferral.status;
  
  // Update status
  await db.update(referrals).set({ status }).where(eq(referrals.id, id));
  
  // Send Telegram notification if status changed
  if (oldStatus !== status) {
    // Get agent telegram ID
    const agentResult = await db.select().from(agents).where(eq(agents.id, oldReferral.agentId)).limit(1);
    const agent = agentResult[0];
    
    if (agent?.telegramId) {
      const { notifyReferralStatusChange } = await import("./telegram-notifications");
      await notifyReferralStatusChange(agent.telegramId, {
        id: oldReferral.id,
        patientFullName: oldReferral.patientFullName,
        oldStatus,
        newStatus: status,
        clinic: oldReferral.clinic,
        treatmentAmount: oldReferral.treatmentAmount ?? undefined,
        commissionAmount: oldReferral.commissionAmount ?? undefined,
      });
    }
  }
}

export async function updateReferralAmounts(id: number, treatmentAmount: number, commissionAmount: number) {
  const db = await getDb();
  if (!db) return;

  // Block negative values
  if (treatmentAmount < 0 || commissionAmount < 0) {
    throw new Error("Amounts cannot be negative");
  }

  // Get referral to find agent
  const referralResult = await db.select().from(referrals).where(eq(referrals.id, id)).limit(1);
  const referral = referralResult[0];

  if (!referral) {
    throw new Error(`Referral ${id} not found`);
  }

  // Calculate commission delta (subtract old, add new) to avoid double-counting
  const oldCommission = referral.commissionAmount || 0;
  const commissionDelta = commissionAmount - oldCommission;

  // Update referral amounts
  await db.update(referrals)
    .set({ treatmentAmount, commissionAmount })
    .where(eq(referrals.id, id));

  // Update agent totalEarnings (apply delta, not absolute)
  if (commissionDelta !== 0) {
    const agentResult = await db.select().from(agents).where(eq(agents.id, referral.agentId)).limit(1);
    const agent = agentResult[0];

    if (agent) {
      const currentEarnings = agent.totalEarnings || 0;
      const newEarnings = Math.max(0, currentEarnings + commissionDelta);

      await db.update(agents)
        .set({ totalEarnings: newEarnings })
        .where(eq(agents.id, referral.agentId));
    }
  }
}

// PAYMENTS

export async function getAllPayments() {
  const db = await getDb();
  if (!db) return [];
  // Join with agents to get agent name
  const result = await db.select({
    id: payments.id,
    agentId: payments.agentId,
    agentFullName: agents.fullName,
    amount: payments.amount,
    status: payments.status,
    method: payments.method,
    transactionId: payments.transactionId,
    notes: payments.notes,
    requestedAt: payments.requestedAt,
    completedAt: payments.completedAt,
    createdAt: payments.createdAt,
    updatedAt: payments.updatedAt,
    payoutVia: payments.payoutVia,
    jumpPaymentId: payments.jumpPaymentId,
    jumpStatus: payments.jumpStatus,
    jumpStatusText: payments.jumpStatusText,
    jumpAmountPaid: payments.jumpAmountPaid,
    jumpCommission: payments.jumpCommission,
    // Tax breakdown fields
    grossAmount: payments.grossAmount,
    netAmount: payments.netAmount,
    taxAmount: payments.taxAmount,
    socialContributions: payments.socialContributions,
    isSelfEmployedSnapshot: payments.isSelfEmployedSnapshot,
  })
    .from(payments)
    .leftJoin(agents, eq(payments.agentId, agents.id))
    .orderBy(desc(payments.createdAt));
  return result;
}

export async function getPaymentsWithAgents() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    payment: payments,
    agentFullName: agents.fullName,
    agentEmail: agents.email,
    agentPhone: agents.phone,
    agentInn: agents.inn,
    agentBankName: agents.bankName,
    agentBankAccount: agents.bankAccount,
    agentBankBik: agents.bankBik,
    agentIsSelfEmployed: agents.isSelfEmployed,
  })
    .from(payments)
    .leftJoin(agents, eq(payments.agentId, agents.id))
    .orderBy(desc(payments.createdAt));
}

export async function getPaymentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return payment || null;
}

export async function getPaymentsByAgentId(agentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments)
    .where(eq(payments.agentId, agentId))
    .orderBy(desc(payments.createdAt));
}

export async function createPayment(data: any) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(payments).values(data);
  return result.insertId;
}

export async function updatePaymentStatus(
  id: number,
  status: "pending" | "act_generated" | "sent_for_signing" | "signed" | "ready_for_payment" | "processing" | "completed" | "failed",
  transactionId?: string
) {
  const db = await getDb();
  if (!db) return;
  
  // Get payment data before update
  const paymentResult = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  const oldPayment = paymentResult[0];
  
  if (!oldPayment) {
    throw new Error(`Payment ${id} not found`);
  }
  
  const oldStatus = oldPayment.status;
  
  const updateData: any = { status };
  if (status === "completed") {
    updateData.completedAt = new Date();
  }
  if (transactionId) {
    updateData.transactionId = transactionId;
  }
  await db.update(payments).set(updateData).where(eq(payments.id, id));

  // NOTE: No deduction from totalEarnings needed here.
  // Balance = totalEarnings - completedSum - pendingSum
  // automatically accounts for completed payments.

  // Send Telegram notification if status changed
  if (oldStatus !== status) {
    // Get agent telegram ID
    const agentResult = await db.select().from(agents).where(eq(agents.id, oldPayment.agentId)).limit(1);
    const agent = agentResult[0];
    
    if (agent?.telegramId) {
      const { notifyPaymentProcessed } = await import("./telegram-notifications");
      await notifyPaymentProcessed(agent.telegramId, {
        id: oldPayment.id,
        amount: oldPayment.amount,
        status,
        method: oldPayment.method,
        transactionId: transactionId || oldPayment.transactionId,
      });
    }
  }
}

// DOCTORS

export async function getAllDoctors() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(doctors)
    .where(eq(doctors.isActive, "yes"))
    .orderBy(doctors.clinic, doctors.fullName);
}

export async function getDoctorById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [doctor] = await db.select().from(doctors).where(eq(doctors.id, id));
  return doctor;
}

export async function searchDoctors(filters: {
  clinic?: string;
  specialization?: string;
  name?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(doctors.isActive, "yes")];
  if (filters.clinic) conditions.push(like(doctors.clinic, `%${filters.clinic}%`));
  if (filters.specialization) conditions.push(like(doctors.specialization, `%${filters.specialization}%`));
  if (filters.name) conditions.push(like(doctors.fullName, `%${filters.name}%`));
  
  return db.select().from(doctors)
    .where(and(...conditions))
    .orderBy(doctors.clinic, doctors.fullName);
}

export async function createDoctor(data: any) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(doctors).values(data);
  return result.insertId;
}

export async function updateDoctor(id: number, data: any) {
  const db = await getDb();
  if (!db) return;
  await db.update(doctors).set(data).where(eq(doctors.id, id));
}

export async function deleteDoctor(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(doctors).set({ isActive: "no" }).where(eq(doctors.id, id));
}

// STATISTICS

export async function getStatistics() {
  const db = await getDb();
  if (!db) return {
    totalAgents: 0,
    activeAgents: 0,
    totalReferrals: 0,
    completedReferrals: 0,
    totalPaymentsAmount: 0,
    pendingPaymentsAmount: 0,
  };

  const [totalAgents] = await db.select({ count: sql<number>`count(*)` }).from(agents);
  const [activeAgents] = await db.select({ count: sql<number>`count(*)` })
    .from(agents)
    .where(eq(agents.status, "active"));
  const [totalReferrals] = await db.select({ count: sql<number>`count(*)` }).from(referrals);
  const [completedReferrals] = await db.select({ count: sql<number>`count(*)` })
    .from(referrals)
    .where(sql`${referrals.status} IN ('paid', 'visited')`);
  const [totalPayments] = await db.select({ 
    sum: sql<number>`COALESCE(SUM(amount), 0)` 
  }).from(payments).where(eq(payments.status, "completed"));
  const [pendingPayments] = await db.select({ 
    sum: sql<number>`COALESCE(SUM(amount), 0)` 
  }).from(payments).where(eq(payments.status, "pending"));

  return {
    totalAgents: totalAgents.count,
    activeAgents: activeAgents.count,
    totalReferrals: totalReferrals.count,
    completedReferrals: completedReferrals.count,
    totalPaymentsAmount: totalPayments.sum,
    pendingPaymentsAmount: pendingPayments.sum,
  };
}


// ==================== BOT-SPECIFIC QUERIES ====================

export async function updateAgentRequisites(agentId: number, data: {
  inn?: string;
  isSelfEmployed?: "yes" | "no" | "unknown";
  payoutMethod?: "card" | "sbp" | "bank_account";
  cardNumber?: string;
  bankName?: string;
  bankAccount?: string;
  bankBik?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(agents).set(data).where(eq(agents.id, agentId));
}

export async function updateAgentJumpData(agentId: number, data: {
  jumpContractorId?: number;
  jumpRequisiteId?: number;
  jumpIdentified?: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(agents).set(data).where(eq(agents.id, agentId));
}

export async function getPendingJumpVerificationAgents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agents)
    .where(and(
      isNotNull(agents.jumpContractorId),
      eq(agents.jumpIdentified, false),
    ));
}

export async function updatePaymentJumpData(paymentId: number, data: {
  jumpPaymentId?: string;
  jumpStatus?: number;
  jumpStatusText?: string;
  jumpAmountPaid?: number;
  jumpCommission?: number;
  payoutVia?: "manual" | "jump";
  status?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { ...data };
  if (data.status) {
    updateData.status = data.status;
  }
  await db.update(payments).set(updateData as any).where(eq(payments.id, paymentId));
}

export async function getProcessingJumpPayments() {
  const db = await getDb();
  if (!db) return [];
  const { and, isNotNull } = await import("drizzle-orm");
  return db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.payoutVia, "jump"),
        eq(payments.status, "processing"),
        isNotNull(payments.jumpPaymentId)
      )
    );
}

export async function updateAgentPersonalInfo(agentId: number, data: {
  fullName?: string;
  email?: string;
  phone?: string;
  city?: string;
  specialization?: string;
  role?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(agents).set(data).where(eq(agents.id, agentId));
}

export async function updateAgentExcludedClinics(agentId: number, clinicIds: number[]) {
  const db = await getDb();
  if (!db) return;
  await db.update(agents).set({
    excludedClinics: JSON.stringify(clinicIds),
  }).where(eq(agents.id, agentId));
}

export async function removeAgentExcludedClinic(agentId: number, clinicId: number) {
  const db = await getDb();
  if (!db) return;
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) return;

  let current: number[] = [];
  try {
    if (agent.excludedClinics) current = JSON.parse(agent.excludedClinics);
  } catch { /* ignore */ }

  const updated = current.filter(id => id !== clinicId);
  await db.update(agents).set({
    excludedClinics: JSON.stringify(updated),
  }).where(eq(agents.id, agentId));
}

export function parseExcludedClinics(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id: any) => typeof id === "number") : [];
  } catch {
    return [];
  }
}

export async function createPaymentRequest(agentId: number, data: {
  amount: number;
  grossAmount: number;
  netAmount: number;
  taxAmount: number;
  socialContributions: number;
  isSelfEmployedSnapshot: "yes" | "no";
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(payments).values({
    agentId,
    amount: data.amount,
    grossAmount: data.grossAmount,
    netAmount: data.netAmount,
    taxAmount: data.taxAmount,
    socialContributions: data.socialContributions,
    isSelfEmployedSnapshot: data.isSelfEmployedSnapshot,
    status: "pending",
    createdAt: new Date(),
  });
  return result.insertId;
}

export async function getAgentStatistics(agentId: number) {
  const db = await getDb();
  if (!db) return {
    totalReferrals: 0,
    completedReferrals: 0,
    totalEarnings: 0,
    pendingPayments: 0,
    completedPayments: 0,
  };

  const [totalReferrals] = await db.select({ count: sql<number>`count(*)` })
    .from(referrals)
    .where(eq(referrals.agentId, agentId));
  
  const [completedReferrals] = await db.select({ count: sql<number>`count(*)` })
    .from(referrals)
    .where(and(eq(referrals.agentId, agentId), sql`${referrals.status} IN ('paid', 'visited')`));
  
  const [totalEarnings] = await db.select({ 
    sum: sql<number>`COALESCE(SUM(amount), 0)` 
  }).from(payments).where(and(eq(payments.agentId, agentId), eq(payments.status, "completed")));
  
  const [pendingPayments] = await db.select({ 
    sum: sql<number>`COALESCE(SUM(amount), 0)` 
  }).from(payments).where(and(eq(payments.agentId, agentId), eq(payments.status, "pending")));
  
  const [completedPaymentsCount] = await db.select({ count: sql<number>`count(*)` })
    .from(payments)
    .where(and(eq(payments.agentId, agentId), eq(payments.status, "completed")));

  return {
    totalReferrals: totalReferrals.count,
    completedReferrals: completedReferrals.count,
    totalEarnings: totalEarnings.sum,
    pendingPayments: pendingPayments.sum,
    completedPayments: completedPaymentsCount.count,
  };
}


// ==================== SESSION MANAGEMENT ====================

export async function createSession(data: InsertSession) {
  const db = await getDb();
  if (!db) return 0;
  // Store hashed token in DB for security
  const hashedData = { ...data, sessionToken: hashSessionToken(data.sessionToken) };
  const [result] = await db.insert(sessions).values(hashedData);
  return result.insertId;
}

export async function getSessionByToken(sessionToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const hashedToken = hashSessionToken(sessionToken);
  const [session] = await db.select().from(sessions)
    .where(and(
      eq(sessions.sessionToken, hashedToken),
      eq(sessions.isRevoked, "no")
    ));
  return session;
}

export async function getSessionsByAgentId(agentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions)
    .where(and(
      eq(sessions.agentId, agentId),
      eq(sessions.isRevoked, "no")
    ))
    .orderBy(desc(sessions.lastActivityAt));
}

export async function getAllSessionsByAgentId(agentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions)
    .where(eq(sessions.agentId, agentId))
    .orderBy(desc(sessions.lastActivityAt));
}

export async function updateSessionActivity(sessionToken: string) {
  const db = await getDb();
  if (!db) return;
  const hashedToken = hashSessionToken(sessionToken);
  await db.update(sessions)
    .set({ lastActivityAt: new Date() })
    .where(eq(sessions.sessionToken, hashedToken));
}

export async function revokeSession(sessionId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(sessions)
    .set({ isRevoked: "yes" })
    .where(eq(sessions.id, sessionId));
}

export async function revokeSessionByToken(sessionToken: string) {
  const db = await getDb();
  if (!db) return;
  const hashedToken = hashSessionToken(sessionToken);
  await db.update(sessions)
    .set({ isRevoked: "yes" })
    .where(eq(sessions.sessionToken, hashedToken));
}

export async function revokeAllSessionsExceptCurrent(agentId: number, currentSessionToken: string) {
  const db = await getDb();
  if (!db) return;
  const hashedToken = hashSessionToken(currentSessionToken);
  await db.update(sessions)
    .set({ isRevoked: "yes" })
    .where(and(
      eq(sessions.agentId, agentId),
      sql`${sessions.sessionToken} != ${hashedToken}`,
      eq(sessions.isRevoked, "no")
    ));
}

export async function cleanupExpiredSessions() {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  await db.update(sessions)
    .set({ isRevoked: "yes" })
    .where(and(
      sql`${sessions.expiresAt} < ${now}`,
      eq(sessions.isRevoked, "no")
    ));
}

// ==================== CLINICS ====================

export async function getAllClinics() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clinics)
    .where(eq(clinics.isActive, "yes"))
    .orderBy(clinics.name);
}

export async function getAllClinicsAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clinics).orderBy(desc(clinics.createdAt));
}

export async function getClinicById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [clinic] = await db.select().from(clinics).where(eq(clinics.id, id));
  return clinic;
}

export async function createClinic(data: any) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(clinics).values(data);
  return result.insertId;
}

export async function updateClinic(id: number, data: any) {
  const db = await getDb();
  if (!db) return;
  await db.update(clinics).set(data).where(eq(clinics.id, id));
}

export async function deleteClinic(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(clinics).set({ isActive: "no" }).where(eq(clinics.id, id));
}

// OTP Code functions
export async function getValidOtpCode(email: string, code: string) {
  const db = await getDb();
  if (!db) return null;
  
  const now = new Date();
  const result = await db.select()
    .from(otpCodes)
    .where(and(
      eq(otpCodes.email, email),
      eq(otpCodes.code, code),
      eq(otpCodes.used, "no"),
      sql`${otpCodes.expiresAt} > ${now}`
    ))
    .limit(1);
  
  return result[0] || null;
}

export async function markOtpAsUsed(id: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(otpCodes)
    .set({ used: "yes" })
    .where(eq(otpCodes.id, id));
}

// ==================== CLINIC REPORTS ====================

export async function getAllClinicReports(filters?: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  if (!db) return { reports: [], total: 0 };

  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  let query = db.select().from(clinicReports).orderBy(desc(clinicReports.createdAt));

  // Count total
  const conditions: any[] = [];
  if (filters?.status) {
    conditions.push(eq(clinicReports.status, filters.status as any));
  }
  if (filters?.search) {
    conditions.push(like(clinicReports.patientName, `%${filters.search}%`));
  }

  let countQuery;
  if (conditions.length > 0) {
    countQuery = db.select({ count: sql<number>`count(*)` }).from(clinicReports).where(and(...conditions));
  } else {
    countQuery = db.select({ count: sql<number>`count(*)` }).from(clinicReports);
  }
  const [{ count: total }] = await countQuery;

  // Fetch paginated
  let dataQuery;
  if (conditions.length > 0) {
    dataQuery = db.select().from(clinicReports).where(and(...conditions)).orderBy(desc(clinicReports.createdAt)).limit(pageSize).offset(offset);
  } else {
    dataQuery = db.select().from(clinicReports).orderBy(desc(clinicReports.createdAt)).limit(pageSize).offset(offset);
  }
  const reports = await dataQuery;

  return { reports, total };
}

export async function getClinicReportById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [report] = await db.select().from(clinicReports).where(eq(clinicReports.id, id));
  return report || null;
}

export async function getClinicReportByEmailMessageId(messageId: string) {
  const db = await getDb();
  if (!db) return null;
  const [report] = await db.select().from(clinicReports).where(eq(clinicReports.emailMessageId, messageId));
  return report || null;
}

export async function createClinicReport(data: Omit<InsertClinicReport, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(clinicReports).values(data as any);
  return result.insertId;
}

export async function updateClinicReportStatus(
  id: number,
  status: "pending_review" | "auto_matched" | "approved" | "rejected",
  reviewedBy?: number,
  reviewNotes?: string
) {
  const db = await getDb();
  if (!db) return;
  await db.update(clinicReports).set({
    status,
    reviewedBy: reviewedBy || undefined,
    reviewedAt: new Date(),
    reviewNotes: reviewNotes || undefined,
  }).where(eq(clinicReports.id, id));
}

export async function updateClinicReport(id: number, data: Record<string, any>) {
  const db = await getDb();
  if (!db) return;
  await db.update(clinicReports).set(data).where(eq(clinicReports.id, id));
}

export async function linkClinicReportToReferral(id: number, referralId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(clinicReports).set({
    referralId,
    matchConfidence: 100,
  }).where(eq(clinicReports.id, id));
}

export async function unlinkClinicReportFromReferral(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(clinicReports).set({
    referralId: null,
    matchConfidence: 0,
  }).where(eq(clinicReports.id, id));
}

export async function getClinicReportsStats() {
  const db = await getDb();
  if (!db) return { total: 0, pendingReview: 0, autoMatched: 0, approved: 0, rejected: 0 };

  const [total] = await db.select({ count: sql<number>`count(*)` }).from(clinicReports);
  const [pending] = await db.select({ count: sql<number>`count(*)` }).from(clinicReports).where(eq(clinicReports.status, "pending_review"));
  const [autoMatched] = await db.select({ count: sql<number>`count(*)` }).from(clinicReports).where(eq(clinicReports.status, "auto_matched"));
  const [approved] = await db.select({ count: sql<number>`count(*)` }).from(clinicReports).where(eq(clinicReports.status, "approved"));
  const [rejected] = await db.select({ count: sql<number>`count(*)` }).from(clinicReports).where(eq(clinicReports.status, "rejected"));

  return {
    total: total.count,
    pendingReview: pending.count,
    autoMatched: autoMatched.count,
    approved: approved.count,
    rejected: rejected.count,
  };
}

export async function getPublicStats() {
  const db = await getDb();
  if (!db) return { agentCount: 0, referralCount: 0, clinicCount: 0 };

  const [agentCount] = await db.select({ count: sql<number>`count(*)` }).from(agents);
  const [referralCount] = await db.select({ count: sql<number>`count(*)` }).from(referrals);
  const [clinicCount] = await db.select({ count: sql<number>`count(*)` })
    .from(clinics)
    .where(eq(clinics.isActive, "yes"));

  return {
    agentCount: agentCount.count,
    referralCount: referralCount.count,
    clinicCount: clinicCount.count,
  };
}

// =====================
// PAYMENT ACTS
// =====================

export async function createPaymentAct(data: InsertPaymentAct): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(paymentActs).values(data);
  return result.insertId;
}

export async function getPaymentActById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(paymentActs).where(eq(paymentActs.id, id)).limit(1);
  return result[0] || null;
}

export async function getPaymentActByPaymentId(paymentId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(paymentActs)
    .where(and(
      eq(paymentActs.paymentId, paymentId),
      sql`${paymentActs.status} != 'cancelled'`
    ))
    .orderBy(desc(paymentActs.createdAt))
    .limit(1);
  return result[0] || null;
}

export async function updatePaymentAct(id: number, data: Partial<InsertPaymentAct>) {
  const db = await getDb();
  if (!db) return;
  await db.update(paymentActs).set(data as any).where(eq(paymentActs.id, id));
}

export async function getReadyForPaymentActsWithAgents() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    act: paymentActs,
    agent: agents,
    payment: payments,
  })
    .from(paymentActs)
    .innerJoin(agents, eq(paymentActs.agentId, agents.id))
    .innerJoin(payments, eq(paymentActs.paymentId, payments.id))
    .where(eq(payments.status, "ready_for_payment"))
    .orderBy(desc(paymentActs.createdAt));
  return result;
}

export async function getAgentPaidReferrals(agentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(referrals)
    .where(and(
      eq(referrals.agentId, agentId),
      sql`${referrals.commissionAmount} > 0`,
      sql`${referrals.status} IN ('visited', 'paid')`
    ))
    .orderBy(desc(referrals.createdAt));
}

// ==================== COMMISSION & BALANCE ====================

/**
 * Поиск клиники по имени (для расчёта комиссии из referrals.clinic)
 * Сначала exact match, потом case-insensitive
 */
export async function getClinicByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  // Exact match first
  const [exact] = await db.select().from(clinics)
    .where(eq(clinics.name, name))
    .limit(1);
  if (exact) return exact;
  // Fallback: case-insensitive LIKE
  const [fuzzy] = await db.select().from(clinics)
    .where(sql`LOWER(${clinics.name}) = LOWER(${name})`)
    .limit(1);
  return fuzzy;
}

/**
 * @deprecated Balance is calculated via totalEarnings - completedSum - pendingSum. Do not call.
 * Kept for reference only.
 */
export async function deductPaymentFromEarnings(agentId: number, amount: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(agents)
    .set({ totalEarnings: sql`GREATEST(0, ${agents.totalEarnings} - ${amount})` } as any)
    .where(eq(agents.id, agentId));
}

/**
 * Сумма всех незавершённых платежей агента (для валидации при запросе выплаты)
 */
export async function getAgentPendingPaymentsSum(agentId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({
    sum: sql<number>`COALESCE(SUM(${payments.amount}), 0)`
  }).from(payments)
    .where(and(
      eq(payments.agentId, agentId),
      sql`${payments.status} IN ('pending', 'processing', 'act_generated', 'sent_for_signing', 'signed', 'ready_for_payment')`
    ));
  return result.sum;
}

/**
 * Сумма всех завершённых (выплаченных) платежей агента
 */
export async function getAgentCompletedPaymentsSum(agentId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({
    sum: sql<number>`COALESCE(SUM(${payments.amount}), 0)`
  }).from(payments)
    .where(and(
      eq(payments.agentId, agentId),
      eq(payments.status, "completed")
    ));
  return result.sum;
}

/**
 * Calculate agent's available balance (totalEarnings - completed - pending payments)
 * Single source of truth for balance calculation used by both dashboard and bot.
 */
export async function getAgentAvailableBalance(agentId: number): Promise<number> {
  const totalEarnings = (await getAgentById(agentId))?.totalEarnings || 0;
  const pendingSum = await getAgentPendingPaymentsSum(agentId);
  const completedSum = await getAgentCompletedPaymentsSum(agentId);
  return Math.max(0, totalEarnings - completedSum - pendingSum);
}

/**
 * Create a payment request with pessimistic locking to prevent race conditions.
 * Uses MySQL transaction + SELECT FOR UPDATE on the agent row.
 */
export async function createPaymentWithLock(
  agentId: number,
  paymentData: {
    amount: number;
    grossAmount?: number;
    netAmount?: number;
    taxAmount?: number;
    socialContributions?: number;
    isSelfEmployedSnapshot?: "yes" | "no";
  }
): Promise<{ paymentId: number; availableBalance: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    // 1. Lock the agent row with FOR UPDATE to prevent concurrent payouts
    const lockResult = await tx.execute(
      sql`SELECT id, totalEarnings FROM agents WHERE id = ${agentId} FOR UPDATE`
    );
    const agentRow = (lockResult as any)[0]?.[0];
    if (!agentRow) throw new Error("Agent not found");

    const totalEarnings: number = agentRow.totalEarnings || 0;

    // 2. Sum pending payments within the transaction
    const [pendingResult] = await tx.select({
      sum: sql<number>`COALESCE(SUM(${payments.amount}), 0)`
    }).from(payments)
      .where(and(
        eq(payments.agentId, agentId),
        sql`${payments.status} IN ('pending', 'processing', 'act_generated', 'sent_for_signing', 'signed', 'ready_for_payment')`
      ));

    // 3. Sum completed payments within the transaction
    const [completedResult] = await tx.select({
      sum: sql<number>`COALESCE(SUM(${payments.amount}), 0)`
    }).from(payments)
      .where(and(
        eq(payments.agentId, agentId),
        eq(payments.status, "completed")
      ));

    const pendingSum = pendingResult.sum;
    const completedSum = completedResult.sum;
    const availableBalance = totalEarnings - completedSum - pendingSum;

    // 4. Validate amount
    if (paymentData.amount > availableBalance) {
      throw new Error(`Недостаточно средств: доступно ${availableBalance}, запрошено ${paymentData.amount}`);
    }

    if (paymentData.amount < 100000) { // 1000 RUB minimum
      throw new Error("Минимальная сумма выплаты — 1 000 ₽");
    }

    // 5. Check for existing pending payment (deduplication)
    const [existingPending] = await tx.select({ id: payments.id }).from(payments)
      .where(and(
        eq(payments.agentId, agentId),
        sql`${payments.status} IN ('pending', 'processing')`
      ))
      .limit(1);

    if (existingPending) {
      throw new Error("У вас уже есть необработанная заявка на выплату");
    }

    // 6. Insert payment within the same transaction
    const [result] = await tx.insert(payments).values({
      agentId,
      amount: paymentData.amount,
      grossAmount: paymentData.grossAmount ?? paymentData.amount,
      netAmount: paymentData.netAmount,
      taxAmount: paymentData.taxAmount ?? 0,
      socialContributions: paymentData.socialContributions ?? 0,
      isSelfEmployedSnapshot: paymentData.isSelfEmployedSnapshot,
      status: "pending",
      createdAt: new Date(),
    });

    return {
      paymentId: result.insertId,
      availableBalance,
    };
  });
}

/**
 * Месячная выручка агента (сумма treatmentAmount за текущий месяц, visited/paid)
 */
export async function getAgentMonthlyRevenue(agentId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [result] = await db.select({
    sum: sql<number>`COALESCE(SUM(${referrals.treatmentAmount}), 0)`
  }).from(referrals)
    .where(and(
      eq(referrals.agentId, agentId),
      sql`${referrals.status} IN ('visited', 'paid')`,
      sql`${referrals.createdAt} >= ${firstOfMonth}`
    ));
  return result.sum;
}

/**
 * Месячная выручка агента по treatmentMonth (YYYY-MM).
 * Используется для определения тира комиссии за конкретный месяц.
 */
export async function getAgentMonthlyRevenueByTreatmentMonth(agentId: number, treatmentMonth: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({
    sum: sql<number>`COALESCE(SUM(${referrals.treatmentAmount}), 0)`
  }).from(referrals)
    .where(and(
      eq(referrals.agentId, agentId),
      sql`${referrals.status} IN ('visited', 'paid')`,
      eq(referrals.treatmentMonth, treatmentMonth)
    ));
  return result.sum;
}

/**
 * Все referrals агента за конкретный treatmentMonth (visited/paid).
 * Используется для пересчёта комиссий при изменении тира.
 */
export async function getReferralsByAgentAndMonth(agentId: number, treatmentMonth: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(referrals)
    .where(and(
      eq(referrals.agentId, agentId),
      eq(referrals.treatmentMonth, treatmentMonth),
      sql`${referrals.status} IN ('visited', 'paid')`
    ));
}

/**
 * Установить treatmentMonth на referral (при утверждении отчёта клиники).
 */
export async function setReferralTreatmentMonth(referralId: number, treatmentMonth: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(referrals)
    .set({ treatmentMonth } as any)
    .where(eq(referrals.id, referralId));
}

// ==================== APP SETTINGS ====================

export async function getAppSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return row?.value || null;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(appSettings).values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

// ==================== REFERRAL BONUS ====================

/**
 * Начислить бонус агенту (в копейках)
 */
export async function addBonusPoints(agentId: number, amountKopecks: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(agents)
    .set({ bonusPoints: sql`${agents.bonusPoints} + ${amountKopecks}` } as any)
    .where(eq(agents.id, agentId));
}

/**
 * Количество оплаченных пациентов агента (status='paid')
 */
export async function getAgentPaidReferralCount(agentId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({
    count: sql<number>`count(*)`
  }).from(referrals)
    .where(and(
      eq(referrals.agentId, agentId),
      eq(referrals.status, "paid")
    ));
  return result.count;
}

/**
 * Разблокировать бонус → перенести bonusPoints в totalEarnings
 * Только если агент имеет >= 10 оплаченных пациентов
 * Использует транзакцию с FOR UPDATE для предотвращения двойного начисления
 * Возвращает true если бонус был разблокирован
 */
export async function unlockBonusToEarnings(agentId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  return await db.transaction(async (tx) => {
    // Lock agent row to prevent concurrent bonus unlocks
    const lockResult = await tx.execute(
      sql`SELECT id, bonusPoints, totalEarnings FROM agents WHERE id = ${agentId} FOR UPDATE`
    );
    const agentRow = (lockResult as any)[0]?.[0];
    if (!agentRow || !agentRow.bonusPoints || agentRow.bonusPoints <= 0) return false;

    // Check paid referral count within the transaction
    const [countResult] = await tx.select({
      count: sql<number>`count(*)`
    }).from(referrals)
      .where(and(eq(referrals.agentId, agentId), eq(referrals.status, "paid")));

    if (countResult.count < 10) return false;

    // Atomically transfer bonus to totalEarnings
    const bonus = agentRow.bonusPoints;
    await tx.update(agents).set({
      totalEarnings: sql`${agents.totalEarnings} + ${bonus}`,
      bonusPoints: 0,
    } as any).where(eq(agents.id, agentId));

    return true;
  });
}

/**
 * Hard-delete agent and ALL related records (sessions, referrals, payments, paymentActs).
 * Use with extreme caution — this is irreversible.
 */
export async function hardDeleteAgent(agentId: number) {
  const db = await getDb();
  if (!db) return { deleted: false, reason: "No DB connection" };

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent) return { deleted: false, reason: "Agent not found" };

  // Delete related records in dependency order
  // 1. Payment acts (references payments & agents)
  await db.delete(paymentActs).where(eq(paymentActs.agentId, agentId));
  // 2. Payments
  await db.delete(payments).where(eq(payments.agentId, agentId));
  // 3. Clinic reports linked to referrals of this agent
  const agentReferrals = await db.select({ id: referrals.id }).from(referrals).where(eq(referrals.agentId, agentId));
  for (const ref of agentReferrals) {
    await db.delete(clinicReports).where(eq(clinicReports.referralId, ref.id));
  }
  // 4. Referrals
  await db.delete(referrals).where(eq(referrals.agentId, agentId));
  // 5. Sessions
  await db.delete(sessions).where(eq(sessions.agentId, agentId));
  // 6. Agent itself
  await db.delete(agents).where(eq(agents.id, agentId));

  return { deleted: true, agentName: agent.fullName, agentId: agent.id };
}

// ==================== STAFF MANAGEMENT ====================

export async function getAllStaffUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users)
    .where(sql`${users.role} IN ('admin', 'support', 'accountant')`)
    .orderBy(desc(users.createdAt));
}

export async function createStaffUser(data: {
  name: string;
  email: string;
  phone?: string;
  role: "admin" | "support" | "accountant";
}) {
  const db = await getDb();
  if (!db) return 0;
  const openId = `staff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const [result] = await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    role: data.role,
    loginMethod: "email_otp",
  });
  return result.insertId;
}

export async function updateStaffUser(id: number, data: {
  name?: string;
  email?: string;
  phone?: string;
  role?: "admin" | "support" | "accountant";
}) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.role !== undefined) updateData.role = data.role;
  await db.update(users).set(updateData).where(eq(users.id, id));
}

export async function revokeAllSessionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(sessions)
    .set({ isRevoked: "yes" })
    .where(and(eq(sessions.userId, userId), eq(sessions.isRevoked, "no")));
}

export async function deleteStaffUser(id: number) {
  const db = await getDb();
  if (!db) return;
  // Revoke all active sessions before deleting
  await revokeAllSessionsByUserId(id);
  await db.delete(users).where(eq(users.id, id));
}

// ==================== TASKS ====================

export async function createTask(data: {
  type: string;
  title: string;
  referralId?: number;
  agentId?: number;
  assignedTo?: number;
  priority?: "low" | "normal" | "high" | "urgent";
  notes?: string;
}) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(tasks).values(data as any);
  return result.insertId;
}

export async function getTasksList(filters?: {
  status?: string;
  assignedTo?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];
  if (filters?.status) {
    conditions.push(eq(tasks.status, filters.status as any));
  }
  if (filters?.assignedTo) {
    conditions.push(eq(tasks.assignedTo, filters.assignedTo));
  }

  if (conditions.length > 0) {
    return db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.createdAt));
  }
  return db.select().from(tasks).orderBy(desc(tasks.createdAt));
}

export async function getTaskById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return task || null;
}

export async function updateTaskStatus(
  id: number,
  status: "pending" | "in_progress" | "completed" | "cancelled",
  completedBy?: number
) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { status };
  if (status === "completed") {
    updateData.completedAt = new Date();
    if (completedBy) updateData.completedBy = completedBy;
  }
  await db.update(tasks).set(updateData as any).where(eq(tasks.id, id));
}

export async function assignTask(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(tasks).set({ assignedTo: userId } as any).where(eq(tasks.id, id));
}

export async function getTaskStats() {
  const db = await getDb();
  if (!db) return { pending: 0, inProgress: 0, completed: 0, cancelled: 0 };

  const [pending] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "pending"));
  const [inProgress] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "in_progress"));
  const [completed] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "completed"));
  const [cancelled] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "cancelled"));

  return {
    pending: pending.count,
    inProgress: inProgress.count,
    completed: completed.count,
    cancelled: cancelled.count,
  };
}

export async function hasPendingTaskForReferral(referralId: number, type: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(and(
      eq(tasks.referralId, referralId),
      eq(tasks.type, type),
      eq(tasks.status, "pending")
    ));
  return result.count > 0;
}
