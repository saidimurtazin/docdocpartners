/**
 * Payment Act Service — orchestrates act generation, OTP signing, and status management
 */

import * as db from "./db";
import { ENV } from "./_core/env";
import { generatePaymentActPdf, toPatientInitials, type ActPdfData } from "./payment-act-pdf";
import { storagePut, storageGet } from "./storage";
import crypto from "crypto";

function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

function getCompanyRequisites() {
  return {
    name: ENV.companyName,
    inn: ENV.companyInn,
    ogrn: ENV.companyOgrn,
    address: ENV.companyAddress,
    bankName: ENV.companyBankName,
    bankAccount: ENV.companyBankAccount,
    bankBik: ENV.companyBankBik,
    director: ENV.companyDirector,
  };
}

/**
 * Generate act for a payment
 */
export async function generateAct(paymentId: number): Promise<{ actId: number; actNumber: string }> {
  // Load payment
  const payment = await db.getPaymentById(paymentId);
  if (!payment) throw new Error(`Payment ${paymentId} not found`);
  if (payment.status !== "pending" && payment.status !== "failed") throw new Error(`Payment ${paymentId} is not in pending/failed status (current: ${payment.status})`);

  // Load agent
  const allAgents = await db.getAllAgents();
  const agent = allAgents.find(a => a.id === payment.agentId);
  if (!agent) throw new Error(`Agent ${payment.agentId} not found`);

  // Validate requisites
  if (!agent.inn || !agent.bankAccount || !agent.bankName || !agent.bankBik) {
    throw new Error("Агент не заполнил банковские реквизиты (ИНН, банк, счёт, БИК)");
  }

  // Cancel any existing active act for this payment
  const existingAct = await db.getPaymentActByPaymentId(paymentId);
  if (existingAct) {
    await db.updatePaymentAct(existingAct.id, { status: "cancelled" });
  }

  // Load agent's paid referrals for the act
  const agentReferrals = await db.getAgentPaidReferrals(agent.id);
  const referralData = agentReferrals.map(r => ({
    id: r.id,
    patientInitials: toPatientInitials(r.patientFullName),
    clinic: r.clinic || "—",
    treatmentAmount: r.treatmentAmount || 0,
    commissionAmount: r.commissionAmount || 0,
  }));

  // Determine period
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = now;

  // Create act record first to get ID for act number
  const actId = await db.createPaymentAct({
    paymentId,
    agentId: agent.id,
    actNumber: `TEMP-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
    actDate: now,
    periodStart,
    periodEnd,
    totalAmount: payment.amount,
    status: "generated",
    agentFullNameSnapshot: agent.fullName,
    agentInnSnapshot: agent.inn,
    agentBankNameSnapshot: agent.bankName,
    agentBankAccountSnapshot: agent.bankAccount,
    agentBankBikSnapshot: agent.bankBik,
    referralIds: JSON.stringify(referralData.map(r => r.id)),
  });

  const actNumber = `ACT-${now.getFullYear()}-${String(actId).padStart(6, "0")}`;

  // Generate PDF
  const pdfData: ActPdfData = {
    actNumber,
    actDate: now,
    periodStart,
    periodEnd,
    agent: {
      fullName: agent.fullName,
      inn: agent.inn,
      bankName: agent.bankName,
      bankAccount: agent.bankAccount,
      bankBik: agent.bankBik,
      isSelfEmployed: agent.isSelfEmployed === "yes",
    },
    referrals: referralData,
    totalAmount: payment.amount,
    company: getCompanyRequisites(),
  };

  const pdfBuffer = await generatePaymentActPdf(pdfData);

  // Upload to storage
  const storageKey = `acts/${actNumber}.pdf`;
  let pdfUrl = "";
  try {
    const uploaded = await storagePut(storageKey, pdfBuffer, "application/pdf");
    pdfUrl = uploaded.url;
  } catch (err) {
    console.warn("[PaymentAct] Storage upload failed, continuing without URL:", err);
  }

  // Update act with actual number and PDF
  await db.updatePaymentAct(actId, {
    actNumber,
    pdfStorageKey: storageKey,
    pdfUrl: pdfUrl || undefined,
  });

  // Update payment status
  await db.updatePaymentStatus(paymentId, "act_generated");

  return { actId, actNumber };
}

/**
 * Send OTP for act signing via Telegram (fallback: email)
 */
export async function sendActSigningOtp(actId: number): Promise<{ sentVia: "telegram" | "email" }> {
  const act = await db.getPaymentActById(actId);
  if (!act) throw new Error(`Act ${actId} not found`);
  if (act.status !== "generated" && act.status !== "sent_for_signing") {
    throw new Error(`Act ${actId} cannot receive OTP (status: ${act.status})`);
  }

  const allAgents = await db.getAllAgents();
  const agent = allAgents.find(a => a.id === act.agentId);
  if (!agent) throw new Error(`Agent ${act.agentId} not found`);

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.updatePaymentAct(actId, {
    otpCode: code,
    otpExpiresAt: expiresAt,
    otpAttempts: 0,
  });

  let sentVia: "telegram" | "email" = "telegram";

  // Try Telegram first
  if (agent.telegramId) {
    try {
      const { notifyAgent } = await import("./telegram-bot-webhook");
      const amount = (act.totalAmount / 100).toLocaleString("ru-RU");
      await notifyAgent(
        agent.telegramId,
        `📄 <b>Акт на оплату ${act.actNumber}</b>\n\n` +
        `Сумма: <b>${amount} ₽</b>\n\n` +
        `Для подписания введите код в личном кабинете:\n\n` +
        `<code>${code}</code>\n\n` +
        `Код действителен 10 минут.\n\n` +
        `⚠️ Никому не сообщайте этот код!`
      );
    } catch (err) {
      console.warn("[PaymentAct] Telegram notification failed, trying email:", err);
      sentVia = "email";
    }
  } else {
    sentVia = "email";
  }

  // Fallback to email
  if (sentVia === "email" && agent.email) {
    try {
      const { sendEmail } = await import("./email");
      const amount = (act.totalAmount / 100).toLocaleString("ru-RU");
      await sendEmail({
        to: agent.email,
        subject: `Код подписания акта ${act.actNumber} — DocDocPartner`,
        html: `
          <h2>Акт на оплату ${act.actNumber}</h2>
          <p>Сумма: <strong>${amount} ₽</strong></p>
          <p>Для подписания введите код в личном кабинете:</p>
          <h1 style="font-size: 32px; letter-spacing: 8px; text-align: center;">${code}</h1>
          <p>Код действителен 10 минут.</p>
          <p><em>Никому не сообщайте этот код!</em></p>
        `,
      });
    } catch (err) {
      console.error("[PaymentAct] Email notification also failed:", err);
      throw new Error("Не удалось отправить OTP-код ни через Telegram, ни через email");
    }
  }

  await db.updatePaymentAct(actId, { otpSentVia: sentVia });

  // Update payment status
  const payment = await db.getPaymentById(act.paymentId);
  if (payment) {
    await db.updatePaymentStatus(act.paymentId, "sent_for_signing");
  }

  return { sentVia };
}

/**
 * Verify OTP and mark act as signed
 */
export async function verifyActOtp(
  actId: number,
  code: string,
  ip: string,
  userAgent: string
): Promise<boolean> {
  const act = await db.getPaymentActById(actId);
  if (!act) throw new Error(`Act ${actId} not found`);
  if (act.status !== "sent_for_signing") return false;

  // Check expiry
  if (!act.otpExpiresAt || new Date() > new Date(act.otpExpiresAt)) {
    return false;
  }

  // Check attempts
  if ((act.otpAttempts || 0) >= 5) {
    return false;
  }

  // Compare code
  if (act.otpCode !== code) {
    await db.updatePaymentAct(actId, { otpAttempts: (act.otpAttempts || 0) + 1 });
    return false;
  }

  // Success — mark as signed
  const now = new Date();
  await db.updatePaymentAct(actId, {
    status: "signed",
    signedAt: now,
    signedIp: ip,
    signedUserAgent: userAgent,
    otpCode: null,
    otpExpiresAt: null,
  });

  // Update payment status to ready_for_payment
  await db.updatePaymentStatus(act.paymentId, "ready_for_payment");

  // Notify agent
  try {
    const allAgents = await db.getAllAgents();
    const agent = allAgents.find(a => a.id === act.agentId);
    if (agent?.telegramId) {
      const { notifyAgent } = await import("./telegram-bot-webhook");
      const amount = (act.totalAmount / 100).toLocaleString("ru-RU");
      await notifyAgent(
        agent.telegramId,
        `✅ <b>Акт ${act.actNumber} подписан!</b>\n\n` +
        `Сумма: ${amount} ₽\n` +
        `Статус: готово к оплате\n\n` +
        `Выплата будет произведена в ближайшее время.`
      );
    }
  } catch (err) {
    console.warn("[PaymentAct] Failed to send signing confirmation:", err);
  }

  return true;
}

/**
 * Resend OTP (max 3 resends per act)
 */
export async function resendActOtp(actId: number): Promise<{ sentVia: "telegram" | "email" }> {
  const act = await db.getPaymentActById(actId);
  if (!act) throw new Error(`Act ${actId} not found`);
  if (act.status !== "sent_for_signing") {
    throw new Error("Акт не в статусе ожидания подписания");
  }

  return sendActSigningOtp(actId);
}

/**
 * Cancel old act and generate new one
 */
export async function regenerateAct(paymentId: number): Promise<{ actId: number; actNumber: string }> {
  const existingAct = await db.getPaymentActByPaymentId(paymentId);
  if (existingAct) {
    await db.updatePaymentAct(existingAct.id, { status: "cancelled" });
  }

  // Reset payment status to pending for re-generation
  await db.updatePaymentStatus(paymentId, "pending");

  return generateAct(paymentId);
}

/**
 * Get act details with download URL
 */
export async function getActWithDownloadUrl(actId: number) {
  const act = await db.getPaymentActById(actId);
  if (!act) return null;

  let downloadUrl = act.pdfUrl || "";
  if (act.pdfStorageKey && !downloadUrl) {
    try {
      const result = await storageGet(act.pdfStorageKey);
      downloadUrl = result.url;
    } catch {
      // ignore storage errors
    }
  }

  return { ...act, downloadUrl };
}
