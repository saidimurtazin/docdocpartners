/**
 * Telegram Push Notifications Service
 * Sends notifications to agents via Telegram bot when:
 * - Referral status changes
 * - Payment is processed or status changes
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Send a Telegram message to a user
 */
async function sendTelegramMessage(
  telegramId: string,
  message: string,
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<boolean> {
  // Validate telegramId is a numeric string
  if (!telegramId || !/^\d+$/.test(telegramId)) {
    console.warn(`[Telegram] Invalid telegramId: "${telegramId}" — skipping notification`);
    return false;
  }
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: parseMode,
      }),
    });

    const data = await response.json();
    
    if (!data.ok) {
      console.error(`Failed to send Telegram message to ${telegramId}:`, data);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error sending Telegram message to ${telegramId}:`, error);
    return false;
  }
}

/**
 * Format amount in kopecks to rubles string
 */
function formatAmount(kopecks: number): string {
  const rubles = kopecks / 100;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
  }).format(rubles);
}

/**
 * Get status emoji and text for referral status
 */
function getReferralStatusInfo(status: string): { emoji: string; text: string } {
  const statusMap: Record<string, { emoji: string; text: string }> = {
    new: { emoji: "🆕", text: "Новая заявка" },
    in_progress: { emoji: "⚙️", text: "В работе" },
    contacted: { emoji: "📞", text: "Связались с пациентом" },
    scheduled: { emoji: "📅", text: "Записан на приём" },
    visited: { emoji: "✅", text: "Приём состоялся" },
    duplicate: { emoji: "🔁", text: "Дубликат — пациент уже в базе клиники" },
    no_answer: { emoji: "📵", text: "Не дозвонились" },
    cancelled: { emoji: "❌", text: "Отменена" },
  };
  return statusMap[status] || { emoji: "📋", text: status };
}

/**
 * Get status emoji and text for payment status
 */
function getPaymentStatusInfo(status: string): { emoji: string; text: string } {
  const statusMap: Record<string, { emoji: string; text: string }> = {
    pending: { emoji: "⏳", text: "Ожидает обработки" },
    processing: { emoji: "🔄", text: "В обработке" },
    completed: { emoji: "✅", text: "Выплачено" },
    failed: { emoji: "❌", text: "Ошибка" },
  };
  return statusMap[status] || { emoji: "💰", text: status };
}

/**
 * Send notification when referral status changes
 */
export async function notifyReferralStatusChange(
  telegramId: string,
  referralData: {
    id: number;
    patientFullName: string;
    oldStatus: string;
    newStatus: string;
    clinic?: string | null;
    treatmentAmount?: number;
    commissionAmount?: number;
  }
): Promise<boolean> {
  const { emoji, text } = getReferralStatusInfo(referralData.newStatus);
  
  let message = `${emoji} <b>Изменение статуса рекомендации</b>\n\n`;
  message += `<b>Пациент:</b> ${referralData.patientFullName}\n`;
  message += `<b>Рекомендация №:</b> ${referralData.id}\n`;
  
  if (referralData.clinic) {
    message += `<b>Клиника:</b> ${referralData.clinic}\n`;
  }
  
  message += `\n<b>Новый статус:</b> ${text}\n`;
  
  // Add special messages for certain statuses
  if (referralData.newStatus === "visited") {
    if (referralData.commissionAmount) {
      message += `\n💰 <b>Ваше вознаграждение:</b> ${formatAmount(referralData.commissionAmount)}\n`;
      if (referralData.treatmentAmount) {
        message += `<b>Сумма лечения:</b> ${formatAmount(referralData.treatmentAmount)}\n`;
      }
    } else {
      message += `\n✅ Приём состоялся. Вознаграждение будет начислено после подтверждения суммы лечения.\n`;
    }
  } else if (referralData.newStatus === "scheduled") {
    message += `\n📅 Пациент записан на приём. Ожидайте информации о визите.\n`;
  } else if (referralData.newStatus === "contacted") {
    message += `\n📞 Наш координатор связался с пациентом. Скоро будет назначена консультация.\n`;
  } else if (referralData.newStatus === "in_progress") {
    message += `\n⚙️ Ваша рекомендация взята в работу.\n`;
  } else if (referralData.newStatus === "duplicate") {
    message += `\n🔁 Пациент уже был в базе клиники. Вознаграждение не начисляется.\n`;
  } else if (referralData.newStatus === "no_answer") {
    message += `\n📵 Не удалось дозвониться до пациента. Попробуем ещё раз.\n`;
  } else if (referralData.newStatus === "cancelled") {
    message += `\n❌ К сожалению, рекомендация отменена. Вознаграждение не начисляется.\n`;
  }
  
  message += `\n📱 Проверьте детали в личном кабинете или боте.`;

  return sendTelegramMessage(telegramId, message);
}

/**
 * Send notification when payment is processed
 */
export async function notifyPaymentProcessed(
  telegramId: string,
  paymentData: {
    id: number;
    amount: number;
    status: string;
    method?: string | null;
    transactionId?: string | null;
  }
): Promise<boolean> {
  // Only notify agent about final statuses (completed / failed).
  // Intermediate statuses (pending, processing, etc.) should NOT generate
  // notifications — the agent doesn't need to know until money actually arrives.
  if (paymentData.status !== "completed" && paymentData.status !== "failed") {
    return false;
  }

  if (paymentData.status === "completed") {
    let message = `✅ <b>Выплата завершена!</b>\n\n`;
    message += `<b>Сумма:</b> ${formatAmount(paymentData.amount)}\n`;
    if (paymentData.transactionId) {
      message += `<b>ID транзакции:</b> ${paymentData.transactionId}\n`;
    }
    message += `\nСредства должны поступить на ваш счёт в течение 1-3 рабочих дней.`;
    message += `\n\n📱 Проверьте детали в личном кабинете.`;
    return sendTelegramMessage(telegramId, message);
  }

  // failed
  let message = `❌ <b>Ошибка при выплате</b>\n\n`;
  message += `<b>Сумма:</b> ${formatAmount(paymentData.amount)}\n`;
  message += `\nПожалуйста, свяжитесь с поддержкой для уточнения деталей.`;
  message += `\n\n📱 Проверьте детали в личном кабинете.`;
  return sendTelegramMessage(telegramId, message);
}

/**
 * Send notification when new referral is created (for agent confirmation)
 */
export async function notifyNewReferral(
  telegramId: string,
  referralData: {
    id: number;
    patientFullName: string;
    clinic?: string | null;
  }
): Promise<boolean> {
  let message = `🎉 <b>Новая рекомендация создана!</b>\n\n`;
  message += `<b>Пациент:</b> ${referralData.patientFullName}\n`;
  message += `<b>Рекомендация №:</b> ${referralData.id}\n`;
  
  if (referralData.clinic) {
    message += `<b>Клиника:</b> ${referralData.clinic}\n`;
  }
  
  message += `\n✅ Рекомендация принята в обработку.\n`;
  message += `📞 Наш координатор свяжется с пациентом в течение 2 часов.\n`;
  message += `\n📱 Отслеживайте статус в личном кабинете или боте.`;

  return sendTelegramMessage(telegramId, message);
}

/**
 * Send notification when agent earns bonus points from referral
 */
export async function notifyBonusPointsEarned(
  telegramId: string,
  data: {
    points: number;
    referredAgentName: string;
    totalPoints: number;
  }
): Promise<boolean> {
  let message = `🎁 <b>Вы получили бонусные баллы!</b>\n\n`;
  message += `<b>+${data.points} баллов</b> за приглашение агента\n`;
  message += `<b>Приглашенный агент:</b> ${data.referredAgentName}\n`;
  message += `\n<b>Всего баллов:</b> ${data.totalPoints}\n`;
  message += `\n💡 Бонусные баллы можно вывести после 5+ собственных рекомендаций.\n`;
  message += `📱 Проверьте баланс в личном кабинете или боте.`;

  return sendTelegramMessage(telegramId, message);
}

/**
 * Send notification to admin about new payment request
 */
export async function notifyAdminsNewPaymentRequest(
  agent: {
    id: number;
    fullName: string;
    email: string | null;
    telegramId: string;
  },
  amountKopecks: number
): Promise<void> {
  // Get admin telegram IDs from environment or users table
  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminTelegramId) {
    console.warn("[Notifications] ADMIN_TELEGRAM_ID not set, skipping payment request notification");
    return;
  }

  let message = `💰 <b>Новая заявка на выплату</b>\n\n`;
  message += `<b>Агент:</b> ${agent.fullName} (#${agent.id})\n`;
  message += `<b>Email:</b> ${agent.email || "—"}\n`;
  message += `<b>Сумма:</b> ${formatAmount(amountKopecks)}\n\n`;
  message += `Проверьте заявку в админ-панели → Выплаты`;

  await sendTelegramMessage(adminTelegramId, message);
}

/**
 * Send notification when agent logs in from a new device
 */
export async function notifyNewDeviceLogin(
  telegramId: string,
  loginData: {
    deviceInfo: string | null;
    ipAddress: string | null;
    loginMethod: string;
    timestamp: Date;
  }
): Promise<boolean> {
  // Parse device info
  let deviceName = "Неизвестное устройство";
  let browser = "";
  let os = "";
  
  if (loginData.deviceInfo) {
    const ua = loginData.deviceInfo;
    
    // Browser detection
    if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
    else if (ua.includes("Edge")) browser = "Edge";
    else browser = "Браузер";
    
    // OS detection (check mobile first before desktop)
    if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
    else if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Mac OS")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    
    deviceName = os ? `${browser} на ${os}` : browser;
  }
  
  // Format login method
  const methodText = loginData.loginMethod === "telegram" ? "Telegram" : loginData.loginMethod;
  
  // Format timestamp
  const timeStr = loginData.timestamp.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  
  let message = `🔐 <b>Вход в личный кабинет</b>\n\n`;
  message += `Зафиксирован вход в ваш аккаунт:\n\n`;
  message += `<b>Устройство:</b> ${deviceName}\n`;
  message += `<b>IP-адрес:</b> ${loginData.ipAddress || "Неизвестен"}\n`;
  message += `<b>Метод входа:</b> ${methodText}\n`;
  message += `<b>Время:</b> ${timeStr}\n`;
  message += `\n⚠️ <b>Если это были не вы</b>, немедленно:\n`;
  message += `1. Завершите все сессии в разделе "Управление сессиями"\n`;
  message += `2. Смените пароль\n`;
  message += `3. Свяжитесь с поддержкой\n`;
  message += `\n✅ Если это были вы, можете проигнорировать это сообщение.\n`;
  message += `\n📱 Управляйте активными сессиями в личном кабинете.`;

  return sendTelegramMessage(telegramId, message);
}

/**
 * Send a photo by URL or file_id with caption to a Telegram user
 */
async function sendTelegramPhotoByUrl(
  telegramId: string,
  photo: string,
  caption: string,
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<{ ok: boolean; fileId?: string }> {
  if (!telegramId || !/^\d+$/.test(telegramId)) {
    return { ok: false };
  }
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        photo,
        caption,
        parse_mode: parseMode,
      }),
    });
    const data = await response.json();
    if (!data.ok) {
      console.error(`Failed to send Telegram photo to ${telegramId}:`, data);
      return { ok: false };
    }
    // Extract file_id for reuse
    const photos = data.result?.photo;
    const fileId = photos?.[photos.length - 1]?.file_id;
    return { ok: true, fileId };
  } catch (error) {
    console.error(`Error sending Telegram photo to ${telegramId}:`, error);
    return { ok: false };
  }
}

/**
 * Send a photo from base64 data via multipart/form-data to a Telegram user
 * Returns file_id for subsequent sends
 */
async function sendTelegramPhotoBase64(
  telegramId: string,
  base64Data: string,
  caption: string,
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<{ ok: boolean; fileId?: string }> {
  if (!telegramId || !/^\d+$/.test(telegramId)) {
    return { ok: false };
  }
  try {
    // Parse base64 data URI: "data:image/jpeg;base64,/9j/..."
    const match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) {
      console.error(`Invalid base64 image data`);
      return { ok: false };
    }
    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const buffer = Buffer.from(match[2], "base64");
    const blob = new Blob([buffer], { type: `image/${match[1]}` });

    const formData = new FormData();
    formData.append("chat_id", telegramId);
    formData.append("photo", blob, `broadcast.${ext}`);
    formData.append("caption", caption);
    formData.append("parse_mode", parseMode);

    const response = await fetch(`${TELEGRAM_API_URL}/sendPhoto`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!data.ok) {
      console.error(`Failed to send Telegram photo (base64) to ${telegramId}:`, data);
      return { ok: false };
    }
    const photos = data.result?.photo;
    const fileId = photos?.[photos.length - 1]?.file_id;
    return { ok: true, fileId };
  } catch (error) {
    console.error(`Error sending Telegram photo (base64) to ${telegramId}:`, error);
    return { ok: false };
  }
}

/**
 * Broadcast a message (with optional image) to all agents with telegramId.
 * Supports image as URL or base64 data URI.
 * For base64: uploads once to first recipient, then reuses file_id for all others.
 * Returns stats: { sent, failed, total }
 */
export async function broadcastToAgents(
  agents: Array<{ telegramId: string; fullName: string }>,
  message: string,
  imageUrl?: string,
  imageBase64?: string
): Promise<{ sent: number; failed: number; total: number }> {
  let sent = 0;
  let failed = 0;
  const total = agents.length;

  const hasImage = !!(imageUrl || imageBase64);
  const isBase64 = !!imageBase64;
  let cachedFileId: string | undefined;

  for (const agent of agents) {
    try {
      let success = false;

      if (hasImage) {
        if (cachedFileId) {
          // Reuse file_id — instant, no re-upload
          const result = await sendTelegramPhotoByUrl(agent.telegramId, cachedFileId, message);
          success = result.ok;
        } else if (isBase64) {
          // First send with base64 — upload to Telegram
          const result = await sendTelegramPhotoBase64(agent.telegramId, imageBase64!, message);
          success = result.ok;
          if (result.fileId) cachedFileId = result.fileId;
        } else {
          // URL-based
          const result = await sendTelegramPhotoByUrl(agent.telegramId, imageUrl!, message);
          success = result.ok;
          if (result.fileId) cachedFileId = result.fileId;
        }
      } else {
        success = await sendTelegramMessage(agent.telegramId, message);
      }

      if (success) sent++;
      else failed++;
    } catch {
      failed++;
    }
    // Telegram rate limit: ~30 messages/sec, be safe with 50ms delay
    await new Promise((r) => setTimeout(r, 50));
  }

  return { sent, failed, total };
}
