import { eq, desc, and, like, sql, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, agents, referrals, payments, doctors, sessions, otpCodes, clinics, clinicReports, paymentActs, appSettings, type InsertSession, type InsertClinicReport, type InsertPaymentAct } from "../drizzle/schema";
import { ENV } from './_core/env';

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

  // Deduct from agent's totalEarnings when payment is completed (prevent double-deduction)
  if (status === "completed" && oldStatus !== "completed") {
    await deductPaymentFromEarnings(oldPayment.agentId, oldPayment.amount);
  }

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

export async function createPaymentRequest(agentId: number, amount: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(payments).values({
    agentId,
    amount,
    status: "pending",
    createdAt: new Date(),
  });
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
  const [result] = await db.insert(sessions).values(data);
  return result.insertId;
}

export async function getSessionByToken(sessionToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [session] = await db.select().from(sessions)
    .where(and(
      eq(sessions.sessionToken, sessionToken),
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
  await db.update(sessions)
    .set({ lastActivityAt: new Date() })
    .where(eq(sessions.sessionToken, sessionToken));
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
  await db.update(sessions)
    .set({ isRevoked: "yes" })
    .where(eq(sessions.sessionToken, sessionToken));
}

export async function revokeAllSessionsExceptCurrent(agentId: number, currentSessionToken: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(sessions)
    .set({ isRevoked: "yes" })
    .where(and(
      eq(sessions.agentId, agentId),
      sql`${sessions.sessionToken} != ${currentSessionToken}`,
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
 * Списание с баланса агента при выплате (атомарно через SQL)
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
 * Возвращает true если бонус был разблокирован
 */
export async function unlockBonusToEarnings(agentId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent || !agent.bonusPoints || agent.bonusPoints <= 0) return false;

  // Check if agent has 10+ paid referrals
  const paidCount = await getAgentPaidReferralCount(agentId);
  if (paidCount < 10) return false;

  // Atomically move bonusPoints to totalEarnings
  const bonus = agent.bonusPoints;
  await db.update(agents).set({
    totalEarnings: sql`${agents.totalEarnings} + ${bonus}`,
    bonusPoints: 0,
  } as any).where(eq(agents.id, agentId));

  return true;
}
