/**
 * Jump Finance Payout — reusable logic for sending payments via Jump.
 * Used by:
 *   1. dashboard.requestPayment — auto-submit on withdrawal request
 *   2. admin.payments.payViaJump — manual admin button (fallback)
 */

import * as db from "./db";
import { jumpFinance, parseAgentName, makeCustomerPaymentId, REQUISITE_TYPE, getLegalFormId, LEGAL_FORM } from "./jump-finance";

export interface JumpPayoutResult {
  success: boolean;
  jumpPaymentId?: string;
  error?: string;
}

/**
 * Process a payment through Jump Finance.
 * Does NOT throw errors — returns { success, error } for safe use from auto-flows.
 * Handles: contractor creation (smart payment), idempotency, DB update, Telegram notification.
 */
export async function processJumpPayment(paymentId: number): Promise<JumpPayoutResult> {
  try {
    if (!jumpFinance.isConfigured) {
      return { success: false, error: "Jump.Finance API not configured" };
    }

    const payment = await db.getPaymentById(paymentId);
    if (!payment) {
      return { success: false, error: `Payment ${paymentId} not found` };
    }
    if (payment.status !== "pending") {
      return { success: false, error: `Payment ${paymentId} is not pending (status: ${payment.status})` };
    }

    // Idempotency: if already has Jump ID, don't create another
    if (payment.jumpPaymentId) {
      return { success: false, error: `Payment already sent to Jump (ID: ${payment.jumpPaymentId})` };
    }

    const agent = await db.getAgentById(payment.agentId);
    if (!agent) {
      return { success: false, error: `Agent ${payment.agentId} not found` };
    }
    if (!agent.inn) {
      return { success: false, error: "Agent has no INN" };
    }
    if (!/^\d{12}$/.test(agent.inn)) {
      return { success: false, error: `Invalid INN format: "${agent.inn}" (expected 12 digits)` };
    }
    if (!agent.phone) {
      return { success: false, error: "Agent has no phone" };
    }
    const cleanPhone = agent.phone.replace(/[\s\-()]/g, '');
    if (!/^\+?[78]\d{10}$/.test(cleanPhone)) {
      return { success: false, error: `Invalid phone format: "${agent.phone}" (expected Russian number)` };
    }

    // Determine payout method
    const payoutMethod = agent.payoutMethod || "card";
    if (payoutMethod === "card" && !agent.cardNumber) {
      return { success: false, error: "Agent has no card number" };
    }
    if (payoutMethod === "sbp" && !agent.phone) {
      return { success: false, error: "Agent has no phone for SBP" };
    }
    if (payoutMethod === "bank_account" && (!agent.bankAccount || !agent.bankBik)) {
      return { success: false, error: "Agent has incomplete bank details" };
    }
    if (payoutMethod === "bank_account" && agent.bankBik && !/^\d{9}$/.test(agent.bankBik)) {
      return { success: false, error: `Invalid BIK format: "${agent.bankBik}" (expected 9 digits)` };
    }

    const { firstName, lastName, middleName } = parseAgentName(agent.fullName);
    const amountRubles = payment.amount / 100; // convert kopecks to rubles
    const customerPaymentId = makeCustomerPaymentId(payment.id);

    let jumpPayment;

    // If agent already has Jump contractor + requisite, use standard payment
    if (agent.jumpContractorId && agent.jumpRequisiteId) {
      const result = await jumpFinance.createPayment({
        contractorId: agent.jumpContractorId,
        amount: amountRubles,
        requisiteId: agent.jumpRequisiteId,
        serviceName: "Вознаграждение за рекомендацию пациентов",
        paymentPurpose: `Выплата агенту #${agent.id} по заявке #${payment.id}`,
        customerPaymentId,
      });
      jumpPayment = result.item;
    } else {
      // Use smart payment (creates contractor + payment in one call)
      const requisite: { typeId: number; accountNumber?: string } = payoutMethod === "card"
        ? { typeId: REQUISITE_TYPE.CARD, accountNumber: agent.cardNumber! }
        : payoutMethod === "sbp"
          ? { typeId: REQUISITE_TYPE.SBP }
          : { typeId: REQUISITE_TYPE.BANK_ACCOUNT, accountNumber: agent.bankAccount! };

      const result = await jumpFinance.createSmartPayment({
        phone: agent.phone,
        firstName,
        lastName,
        middleName,
        legalFormId: getLegalFormId(agent.isSelfEmployed || "no"),
        tin: agent.inn || undefined,
        amount: amountRubles,
        requisite,
        serviceName: "Вознаграждение за рекомендацию пациентов",
        paymentPurpose: `Выплата агенту #${agent.id} по заявке #${payment.id}`,
        customerPaymentId,
      });
      jumpPayment = result.item;

      // Save contractor ID from smart payment response
      if (jumpPayment.contractor?.id && !agent.jumpContractorId) {
        await db.updateAgentJumpData(agent.id, {
          jumpContractorId: jumpPayment.contractor.id,
        });
      }
    }

    // Update payment with Jump data
    await db.updatePaymentJumpData(payment.id, {
      jumpPaymentId: jumpPayment.id,
      jumpStatus: jumpPayment.status.id,
      jumpStatusText: jumpPayment.status.title,
      payoutVia: "jump",
      status: "processing",
    });

    // Notify agent via Telegram
    try {
      const { notifyAgent } = await import("./telegram-bot-webhook");
      const methodText = payoutMethod === "card" ? "на карту" : payoutMethod === "sbp" ? "по СБП" : "на счёт";
      await notifyAgent(
        agent.telegramId,
        `💳 <b>Выплата отправлена ${methodText}</b>\n\nСумма: ${amountRubles.toLocaleString("ru-RU")} ₽\nСтатус: Обрабатывается\n\nВы получите уведомление когда деньги поступят.`
      );
    } catch (err) {
      console.error("[JumpPayout] Failed to notify agent:", err);
    }

    return { success: true, jumpPaymentId: jumpPayment.id };
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error(`[JumpPayout] Error processing payment ${paymentId}:`, message);
    return { success: false, error: message };
  }
}
