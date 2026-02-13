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
    pending: { emoji: "⏳", text: "Ожидает обработки" },
    contacted: { emoji: "📞", text: "Пациент связан" },
    scheduled: { emoji: "📅", text: "Запись назначена" },
    completed: { emoji: "✅", text: "Завершено" },
    cancelled: { emoji: "❌", text: "Отменено" },
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
  if (referralData.newStatus === "completed" && referralData.commissionAmount) {
    message += `\n💰 <b>Ваше вознаграждение:</b> ${formatAmount(referralData.commissionAmount)}\n`;
    if (referralData.treatmentAmount) {
      message += `<b>Сумма лечения:</b> ${formatAmount(referralData.treatmentAmount)}\n`;
    }
  } else if (referralData.newStatus === "scheduled") {
    message += `\n📅 Пациент записан на прием. Ожидайте завершения лечения для начисления вознаграждения.\n`;
  } else if (referralData.newStatus === "contacted") {
    message += `\n📞 Наш координатор связался с пациентом. Скоро будет назначена консультация.\n`;
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
  const { emoji, text } = getPaymentStatusInfo(paymentData.status);
  
  let message = `${emoji} <b>Обновление выплаты</b>\n\n`;
  message += `<b>Выплата №:</b> ${paymentData.id}\n`;
  message += `<b>Сумма:</b> ${formatAmount(paymentData.amount)}\n`;
  message += `<b>Статус:</b> ${text}\n`;
  
  if (paymentData.method) {
    const methodText = paymentData.method === "bank_transfer" ? "Банковский перевод" : paymentData.method;
    message += `<b>Способ:</b> ${methodText}\n`;
  }
  
  if (paymentData.status === "completed") {
    message += `\n✅ <b>Выплата успешно завершена!</b>\n`;
    if (paymentData.transactionId) {
      message += `<b>ID транзакции:</b> ${paymentData.transactionId}\n`;
    }
    message += `\nСредства должны поступить на ваш счет в течение 1-3 рабочих дней.`;
  } else if (paymentData.status === "processing") {
    message += `\n🔄 Выплата обрабатывается. Ожидайте завершения.`;
  } else if (paymentData.status === "failed") {
    message += `\n❌ <b>Ошибка при выплате</b>\n`;
    message += `Пожалуйста, свяжитесь с поддержкой для уточнения деталей.`;
  }
  
  message += `\n\n📱 Проверьте детали в личном кабинете или боте.`;

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
  message += `\n💡 Бонусные баллы можно вывести после 10+ собственных рекомендаций.\n`;
  message += `📱 Проверьте баланс в личном кабинете или боте.`;

  return sendTelegramMessage(telegramId, message);
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
