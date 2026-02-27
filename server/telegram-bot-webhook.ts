/**
 * DocPartner Telegram Bot (Webhook Mode)
 * Registration bot for agent onboarding with Cyrillic validation
 */

import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { ENV } from './_core/env';
import { getDb } from './db';
import { agents } from '../drizzle/schema';
import * as schema from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import type { Express } from 'express';
import { validateFullName, validateEmailAdvanced, validatePhoneAdvanced, validateCity, capitalizeWords } from './validation';
import { calculateWithdrawalTax } from './payout-calculator';

const bot = new Telegraf(ENV.telegramBotToken);

// Session interface
interface SessionData {
  registrationStep?: 'fullName' | 'email' | 'phone' | 'role' | 'specialization' | 'city' | 'excluded_clinics' | 'contract' | 'patient_name' | 'patient_birthdate' | 'patient_phone' | 'patient_notes' | 'patient_contact_consent' | 'patient_clinic_select' | 'patient_consent' | 'payout_inn' | 'payout_self_employed' | 'payout_method' | 'payout_card_number' | 'payout_bank_name' | 'payout_bank_account' | 'payout_bank_bik' | 'link_email' | 'link_otp' | 'link_phone';
  tempData?: {
    fullName?: string;
    email?: string;
    phone?: string;
    role?: string;
    specialization?: string;
    city?: string;
    excludedClinics?: number[];
    agentId?: number;
    patientName?: string;
    patientBirthdate?: string;
    patientPhone?: string;
    contactConsent?: boolean;
    patientNotes?: string;
    targetClinicIds?: number[];
    referredBy?: string;
    // Account linking
    linkAgentId?: number;
    // Payout requisites input
    payoutInn?: string;
    payoutSelfEmployed?: "yes" | "no";
    payoutMethod?: "card" | "sbp";
    payoutCardNumber?: string;
    payoutBankName?: string;
    payoutBankAccount?: string;
    payoutBankBik?: string;
  };
  lastMessageTime?: number;
  lastCallbackTime?: number; // Prevent double-click on inline buttons
  processing?: boolean; // Lock to prevent concurrent DB writes
  createdAt: number; // Session creation timestamp for TTL
}

interface BotContext extends Context {
  session?: SessionData;
}

// Simple in-memory session storage
const sessions = new Map<number, SessionData>();

// Session TTL: 30 minutes
const SESSION_TTL_MS = 30 * 60 * 1000;

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  sessions.forEach((session, userId) => {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(userId);
    }
  });
}, 5 * 60 * 1000);

/**
 * Escape HTML special characters for Telegram HTML messages
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// validateBirthdate remains local — only used in bot patient flow

/**
 * Валидация даты рождения ДД.ММ.ГГГГ
 */
function validateBirthdate(dateStr: string): { valid: boolean; error?: string } {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    return {
      valid: false,
      error: 'Неверный формат. Используйте: ДД.ММ.ГГГГ (например: 15.03.1985)'
    };
  }

  const [day, month, year] = dateStr.split('.').map(Number);

  if (month < 1 || month > 12) {
    return { valid: false, error: 'Месяц должен быть от 01 до 12' };
  }

  if (day < 1 || day > 31) {
    return { valid: false, error: 'День должен быть от 01 до 31' };
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) {
    return {
      valid: false,
      error: `В ${month} месяце максимум ${daysInMonth} дней`
    };
  }

  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) {
    return {
      valid: false,
      error: `Год должен быть от 1900 до ${currentYear}`
    };
  }

  const inputDate = new Date(year, month - 1, day);
  const today = new Date();
  if (inputDate > today) {
    return { valid: false, error: 'Дата рождения не может быть в будущем' };
  }

  const age = Math.floor((today.getTime() - inputDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 1) {
    return { valid: false, error: 'Пациенту должно быть минимум 1 год' };
  }

  return { valid: true };
}

// ===============================
// SPAM PROTECTION
// ===============================

const SPAM_INTERVAL_MS = 1500; // 1.5 seconds between messages
const CALLBACK_COOLDOWN_MS = 3000; // 3 seconds between button clicks

/**
 * Проверка на спам сообщений
 */
function isSpamming(userId: number): boolean {
  const session = getSession(userId);
  const now = Date.now();

  if (session.lastMessageTime) {
    if (now - session.lastMessageTime < SPAM_INTERVAL_MS) {
      return true;
    }
  }

  session.lastMessageTime = now;
  return false;
}

/**
 * Проверка на повторный клик по inline-кнопке (double-click protection)
 */
function isCallbackSpamming(userId: number): boolean {
  const session = getSession(userId);
  const now = Date.now();

  if (session.lastCallbackTime) {
    if (now - session.lastCallbackTime < CALLBACK_COOLDOWN_MS) {
      return true;
    }
  }

  session.lastCallbackTime = now;
  return false;
}

/**
 * Логирование действий пользователя
 */
function logAction(userId: number, action: string, details?: any): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] User ${userId}: ${action}`, details || '');
}

// Main menu keyboard for registered agents
const mainMenuKeyboard = Markup.keyboard([
  ['📋 Отправить пациента', '📈 Моя статистика'],
  ['💰 Запросить выплату', '👥 Мои рекомендации'],
  ['🧾 Реквизиты', '📚 База знаний'],
  ['ℹ️ О программе', '🔗 Реферальная ссылка']
]).resize();

// Role selection keyboard
const roleKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('👨‍⚕️ Врач', 'role_doctor')],
  [Markup.button.callback('👔 Координатор', 'role_coordinator')],
  [Markup.button.callback('📋 Регистратор', 'role_registrar')],
  [Markup.button.callback('📝 Прочее', 'role_other')]
]);

// Specialization keyboard (for doctors)
const specializationKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🩺 Терапевт', 'spec_therapist')],
  [Markup.button.callback('🔪 Хирург', 'spec_surgeon')],
  [Markup.button.callback('❤️ Кардиолог', 'spec_cardiologist')],
  [Markup.button.callback('🧠 Невролог', 'spec_neurologist')],
  [Markup.button.callback('👶 Педиатр', 'spec_pediatrician')],
  [Markup.button.callback('🎗️ Онколог', 'spec_oncologist')],
  [Markup.button.callback('📝 Другая специальность', 'spec_other')]
]);

// Contract acceptance keyboard
const contractKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('✅ Принимаю условия', 'contract_accept')],
  [Markup.button.callback('❌ Отказаться', 'contract_decline')]
]);

// Get session helper
function getSession(userId: number): SessionData {
  if (!sessions.has(userId)) {
    sessions.set(userId, { createdAt: Date.now() });
  }
  return sessions.get(userId)!;
}

// /start command
bot.command('start', async (ctx) => {
  console.log('[Telegram Bot] Received /start command from user:', ctx.from?.id);
  const userId = ctx.from?.id;
  if (!userId) return;

  // Check if user is already registered
  try {
    const db = await getDb();
    if (db) {
      const [existingAgent] = await db.select().from(agents).where(eq(agents.telegramId, String(userId)));
      
      if (existingAgent) {
        const statusLabels: Record<string, string> = {
          pending: 'ожидает проверки',
          active: 'активен',
          rejected: 'отклонена',
          blocked: 'заблокирован'
        };
        
        // Show main menu keyboard for active users, remove keyboard for others
        const keyboard = existingAgent.status === 'active' 
          ? mainMenuKeyboard
          : Markup.removeKeyboard();
        
        await ctx.reply(
          '✅ <b>Вы уже зарегистрированы!</b>\n\n' +
          `👤 <b>Имя:</b> ${escapeHtml(existingAgent.fullName || '')}\n` +
          `📧 <b>Email:</b> ${escapeHtml(existingAgent.email || '')}\n` +
          `📍 <b>Город:</b> ${escapeHtml(existingAgent.city || '')}\n` +
          `🎯 <b>Статус:</b> <b>${statusLabels[existingAgent.status] || existingAgent.status}</b>\n\n` +
          (existingAgent.status === 'pending' 
            ? '⏳ Ваша заявка находится на проверке. Мы свяжемся с вами в течение 24 часов.'
            : existingAgent.status === 'active'
            ? '✅ Вы можете отправлять рекомендации пациентов. Выберите действие:'
            : existingAgent.status === 'rejected'
            ? '❌ К сожалению, ваша заявка была отклонена. Свяжитесь с поддержкой для уточнения деталей.'
            : '🚫 Ваш аккаунт заблокирован. Свяжитесь с поддержкой для получения информации.'),
          { 
            parse_mode: 'HTML', 
            ...keyboard
          }
        );
        return;
      }
    }
  } catch (error) {
    console.error('[Telegram Bot] Error checking existing user:', error);
  }

  // Clear any existing session for new registration
  sessions.delete(userId);

  // Parse referral code from deep link (e.g. /start ref_123)
  const startPayload = (ctx.message?.text || '').split(' ')[1];
  let referredBy: string | undefined;
  if (startPayload?.startsWith('ref_')) {
    const refValue = startPayload.replace('ref_', '');
    // Validate: must be a positive integer (agent ID)
    const parsedRefId = parseInt(refValue, 10);
    if (!isNaN(parsedRefId) && parsedRefId > 0 && String(parsedRefId) === refValue) {
      referredBy = refValue;
    } else {
      console.warn(`[Telegram Bot] Invalid referral ID: ${refValue}`);
    }
  }

  // Persist referral link in DB so it survives bot restarts
  if (referredBy) {
    try {
      const { setAppSetting } = await import('./db');
      await setAppSetting(`ref_pending_${userId}`, referredBy);
      console.log(`[Telegram Bot] Saved pending referral: user ${userId} -> ref ${referredBy}`);
    } catch (e) {
      console.error('[Telegram Bot] Failed to save pending referral:', e);
    }
  }

  // Initialize session with referral data
  const session = getSession(userId);
  session.tempData = { referredBy };

  // Ask if user already has an account (web registration)
  await ctx.reply(
    '👋 <b>Добро пожаловать в DocPartner!</b>\n\n' +
    '💰 Зарабатывайте за каждого направленного пациента\n' +
    '🏥 Работайте с проверенными клиниками\n' +
    '📱 Управляйте рекомендациями прямо в Telegram\n\n' +
    'Вы уже зарегистрированы на сайте <b>doc-partner.ru</b>?',
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Да, привязать Telegram', 'link_existing')],
        [Markup.button.callback('📝 Нет, зарегистрироваться', 'register_new')],
      ])
    }
  );
});

// Handle "Link existing account" button
bot.action('link_existing', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();
  if (isCallbackSpamming(userId)) return;

  await ctx.reply(
    '🔗 <b>Привязка аккаунта</b>\n\n' +
    'Выберите способ подтверждения:',
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📧 По Email (код подтверждения)', 'link_via_email')],
        [Markup.button.callback('📱 По номеру телефона', 'link_via_phone')],
        [Markup.button.callback('◀️ Назад', 'link_back')],
      ])
    }
  );
});

// Handle "Register new" button
bot.action('register_new', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();
  if (isCallbackSpamming(userId)) return;

  const session = getSession(userId);
  session.registrationStep = 'fullName';

  await ctx.reply(
    '📝 <b>Регистрация в DocPartner</b>\n\n' +
    'Я помогу вам зарегистрироваться в партнерской программе.\n\n' +
    '<b>Введите ваше полное имя (Фамилия Имя Отчество):</b>',
    { parse_mode: 'HTML' }
  );
});

// Handle "Restart registration" button (e.g. when phone already exists)
bot.action('restart_registration', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();
  if (isCallbackSpamming(userId)) return;

  // Clear old session and start fresh
  sessions.delete(userId);
  const session = getSession(userId);
  session.registrationStep = 'fullName';

  await ctx.reply(
    '📝 <b>Регистрация заново</b>\n\n' +
    '<b>Введите ваше полное имя (Фамилия Имя Отчество):</b>',
    { parse_mode: 'HTML', ...Markup.removeKeyboard() }
  );
});

// Handle "Back" button from link choice
bot.action('link_back', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();

  await ctx.reply(
    'Вы уже зарегистрированы на сайте <b>doc-partner.ru</b>?',
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Да, привязать Telegram', 'link_existing')],
        [Markup.button.callback('📝 Нет, зарегистрироваться', 'register_new')],
      ])
    }
  );
});

// Handle "Link via Email" button
bot.action('link_via_email', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();
  if (isCallbackSpamming(userId)) return;

  const session = getSession(userId);
  session.registrationStep = 'link_email';

  await ctx.reply(
    '📧 <b>Привязка по Email</b>\n\n' +
    'Введите email, который вы использовали при регистрации на сайте:',
    { parse_mode: 'HTML' }
  );
});

// Handle "Link via Phone" button
bot.action('link_via_phone', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();
  if (isCallbackSpamming(userId)) return;

  const session = getSession(userId);
  session.registrationStep = 'link_phone';

  await ctx.reply(
    '📱 <b>Привязка по номеру телефона</b>\n\n' +
    'Нажмите кнопку ниже, чтобы поделиться вашим номером телефона.\n' +
    'Номер должен совпадать с тем, что вы указали при регистрации.',
    {
      parse_mode: 'HTML',
      ...Markup.keyboard([
        [Markup.button.contactRequest('📱 Поделиться номером телефона')]
      ]).oneTime().resize()
    }
  );
});

// Handle text messages
bot.on(message('text'), async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Spam protection
  if (isSpamming(userId)) return;

  const session = getSession(userId);
  const text = ctx.message.text;

  // Handle cancel command in any flow
  if (text.toLowerCase() === 'отмена' || text.toLowerCase() === '/cancel') {
    if (session.registrationStep) {
      session.registrationStep = undefined;
      session.tempData = {};
      // Check if agent is registered — show main menu instead of removing keyboard
      try {
        const db = await getDb();
        if (db) {
          const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));
          if (agent?.status === 'active') {
            await ctx.reply('❌ Действие отменено.', mainMenuKeyboard);
            return;
          }
        }
      } catch {}
      await ctx.reply('❌ Действие отменено.', Markup.removeKeyboard());
      return;
    }
  }

  // Block menu/command actions while in a registration/patient flow
  const isInFlow = session.registrationStep !== undefined;
  const isMenuAction = text.startsWith('📋') || text.startsWith('📈') || text.startsWith('💰') ||
                        text.startsWith('👥') || text.startsWith('🧾') || text.startsWith('📚') ||
                        text.startsWith('ℹ️') || text.startsWith('🔗');
  if (isInFlow && isMenuAction) {
    await ctx.reply(
      '⚠️ Вы сейчас в процессе заполнения формы.\n' +
      'Завершите текущее действие или введите "Отмена" для выхода.'
    );
    return;
  }

  // Handle menu button clicks (ReplyKeyboardMarkup)
  if (text === '📋 Отправить пациента') {
    // Start patient submission flow directly
    try {
      const db = await getDb();
      if (!db) {
        await ctx.reply('❌ Ошибка подключения к базе данных.');
        return;
      }

      const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

      if (!agent) {
        await ctx.reply('Вы еще не зарегистрированы. Используйте /start для регистрации.');
        return;
      }

      if (agent.status !== 'active') {
        await ctx.reply('Ваша заявка еще не активирована. После активации вы сможете отправлять пациентов.');
        return;
      }

      // Start patient submission flow
      session.registrationStep = 'patient_name';
      session.tempData = { agentId: agent.id };

      await ctx.reply(
        '🎖️ <b>Отправка пациента</b>\n\n' +
        'Введите полное имя пациента (Фамилия Имя Отчество):\n\n' +
        '💡 Введите "Отмена" для отмены отправки пациента.',
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('[Telegram Bot] Patient submission error:', error);
      await ctx.reply('❌ Произошла ошибка.');
    }
    return;
  }
  if (text === '📈 Моя статистика') {
    // Show statistics directly
    try {
      const db = await getDb();
      if (!db) {
        await ctx.reply('❌ Ошибка подключения к базе данных.');
        return;
      }

      const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

      if (!agent) {
        await ctx.reply('Вы еще не зарегистрированы. Используйте /start');
        return;
      }

      if (agent.status !== 'active') {
        await ctx.reply('Ваша заявка еще не активирована. Статистика будет доступна после активации.');
        return;
      }

      const { getAgentCompletedPaymentsSum, getAgentReferralCount } = await import('./db');
      const [paidOutSum, referralCount] = await Promise.all([
        getAgentCompletedPaymentsSum(agent.id),
        getAgentReferralCount(agent.id),
      ]);
      const earnedRub = ((agent.totalEarnings || 0) / 100).toLocaleString('ru-RU');
      const paidOutRub = (paidOutSum / 100).toLocaleString('ru-RU');
      const bonusRub = ((agent.bonusPoints || 0) / 100).toLocaleString('ru-RU');
      const referralLink = `https://t.me/docpartnerbot?start=ref_${agent.id}`;
      const webReferralLink = `https://doc-partner.ru/register?ref=${agent.id}`;

      let message = '📊 <b>Моя статистика</b>\n\n';
      message += `👥 Отправлено пациентов: <b>${referralCount}</b>\n`;
      message += `💰 Заработано: <b>${earnedRub} ₽</b>\n`;
      message += `✅ Выплачено: <b>${paidOutRub} ₽</b>\n`;
      if ((agent.bonusPoints || 0) > 0) {
        message += `🎁 Бонусные баллы: <b>${bonusRub} ₽</b>\n`;
      }
      message += `\n🔗 <b>Ваша реферальная ссылка:</b>\n📱 Telegram: <code>${referralLink}</code>\n🌐 Веб: <code>${webReferralLink}</code>\n`;
      message += '📢 За каждого приглашённого агента — <b>1 000 ₽</b> бонус\n\n';
      message += '📈 <b>Как заработать больше:</b>\n';
      message += '• Отправляйте пациентов через меню\n';
      message += '• Приглашайте коллег по реферальной ссылке\n';
      message += '• Бонус разблокируется после 10 оплаченных пациентов';

      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('[Telegram Bot] Stats error:', error);
      await ctx.reply('❌ Произошла ошибка.');
    }
    return;
  }
  if (text === '💰 Запросить выплату') {
    // Redirect to web version for payouts
    try {
      const db = await getDb();
      if (!db) {
        await ctx.reply('❌ Ошибка подключения к базе данных.');
        return;
      }

      const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

      if (!agent) {
        await ctx.reply('Вы еще не зарегистрированы. Используйте /start');
        return;
      }

      const { getAgentAvailableBalance } = await import('./db');
      const availableBalanceKop = await getAgentAvailableBalance(agent.id);
      const availableBalance = availableBalanceKop / 100;

      let message = '💰 <b>Запрос выплаты</b>\n\n';
      message += `💵 Доступно к выводу: <b>${availableBalance.toLocaleString('ru-RU')} ₽</b>\n\n`;
      message += '📱 Заявка на вывод средств доступна только в личном кабинете:\n\n';
      message += '🔗 <b>https://doc-partner.ru/payments</b>\n\n';
      message += 'Войдите с тем же email, который указан при регистрации.';

      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error in payout redirect:', error);
      await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
    }
    return;
  }

  if (text === '👥 Мои рекомендации') {
    // Show referrals directly
    try {
      const db = await getDb();
      if (!db) {
        await ctx.reply('❌ Ошибка подключения к базе данных.');
        return;
      }

      const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

      if (!agent) {
        await ctx.reply('Вы еще не зарегистрированы. Используйте /start для регистрации.');
        return;
      }

      const referrals = await db.select().from(schema.referrals)
        .where(eq(schema.referrals.agentId, agent.id));

      if (referrals.length === 0) {
        await ctx.reply(
          '📊 <b>Мои рекомендации</b>\n\n' +
          'У вас пока нет отправленных рекомендаций.\n\n' +
          'Используйте меню "Отправить пациента" для создания первой рекомендации.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      const statusEmoji: Record<string, string> = {
        new: '🆕', in_progress: '⚙️', contacted: '📞', scheduled: '📅',
        visited: '✅', duplicate: '🔁', no_answer: '📵', cancelled: '❌'
      };

      const statusNames: Record<string, string> = {
        new: 'Новая', in_progress: 'В работе', contacted: 'Связались',
        scheduled: 'Записан на приём', visited: 'Приём состоялся',
        duplicate: 'Дубликат', no_answer: 'Не дозвонились', cancelled: 'Отменена'
      };

      let message = '📊 <b>Мои рекомендации</b>\n\n';
      const displayReferrals = referrals.slice(-5).reverse();

      for (const ref of displayReferrals) {
        const emoji = statusEmoji[ref.status] || '📋';
        const statusName = statusNames[ref.status] || ref.status;
        message += `${emoji} <b>${escapeHtml(ref.patientFullName)}</b>\n`;
        message += `   Статус: ${statusName}\n`;
        message += `   Дата: ${new Date(ref.createdAt).toLocaleDateString('ru-RU')}\n\n`;
      }

      if (referrals.length > 5) {
        message += `<i>Показаны последние 5 из ${referrals.length} рекомендаций</i>\n\n`;
        message += `🔗 <b>Больше информации в личном кабинете:</b>\n`;
        message += `${ENV.appUrl}/dashboard/referrals`;
      }

      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('[Telegram Bot] Referrals error:', error);
      await ctx.reply('❌ Произошла ошибка.');
    }
    return;
  }
  if (text === '🧾 Реквизиты') {
    // Show requisites directly
    try {
      const db = await getDb();
      if (!db) {
        await ctx.reply('❌ Ошибка подключения к базе данных.');
        return;
      }

      const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

      if (!agent) {
        await ctx.reply('Вы еще не зарегистрированы. Используйте /start');
        return;
      }

      let message = '💳 <b>Мои реквизиты</b>\n\n';
      message += `👤 <b>ФИО:</b> ${escapeHtml(agent.fullName || '')}\n`;
      message += `📧 <b>Email:</b> ${escapeHtml(agent.email || '')}\n`;
      message += `📞 <b>Телефон:</b> ${escapeHtml(agent.phone || '')}\n`;
      message += `🏙️ <b>Город:</b> ${escapeHtml(agent.city || '')}\n\n`;

      message += '<b>💳 Платёжные реквизиты:</b>\n';
      message += agent.inn ? `• ИНН: <code>${agent.inn}</code>\n` : '• ИНН: <i>не указан</i>\n';

      const pm3 = agent.payoutMethod || 'card';
      if (pm3 === 'card') {
        message += agent.cardNumber
          ? `• Способ: 💳 Карта (**** ${agent.cardNumber.slice(-4)})\n`
          : '• Способ: 💳 Карта (<i>не указана</i>)\n';
      } else if (pm3 === 'sbp') {
        message += `• Способ: 📱 СБП (${agent.phone || 'не указан'})\n`;
      } else {
        message += agent.bankName ? `• Банк: ${escapeHtml(agent.bankName)}\n` : '• Банк: <i>не указан</i>\n';
        message += agent.bankAccount ? `• Счёт: <code>${agent.bankAccount}</code>\n` : '• Счёт: <i>не указан</i>\n';
        message += agent.bankBik ? `• БИК: <code>${agent.bankBik}</code>\n` : '• БИК: <i>не указан</i>\n';
      }

      message += '\n';
      const selfEmployedStatus = agent.isSelfEmployed === 'yes' ? '✅ Самозанятый' :
        agent.isSelfEmployed === 'no' ? '❌ Не самозанятый' : '❓ Не указано';
      message += `<b>Статус:</b> ${selfEmployedStatus}\n\n`;

      if (agent.isSelfEmployed !== 'yes') {
        const { getCommissionRates } = await import('./db');
        const rates = await getCommissionRates();
        const rateText = rates.premiumRate
          ? `(${rates.premiumRate}% вместо ${rates.baseRate}%)`
          : `(до ${rates.baseRate}%)`;
        message += `💡 Рекомендуем оформить самозанятость для получения максимального вознаграждения ${rateText}.\n\n`;
      }

      message += `🔗 Изменить реквизиты: ${ENV.appUrl}/dashboard/profile`;

      const hasAllRequisites = agent.inn && (
        (pm3 === 'card' && agent.cardNumber) ||
        (pm3 === 'sbp' && agent.phone) ||
        (pm3 === 'bank_account' && agent.bankAccount && agent.bankName && agent.bankBik)
      );
      const buttons = [];
      if (!hasAllRequisites) {
        buttons.push([Markup.button.callback('📝 Заполнить реквизиты', 'payout_fill_requisites')]);
      } else {
        buttons.push([Markup.button.callback('✏️ Скорректировать реквизиты', 'payout_fill_requisites')]);
      }

      await ctx.reply(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
    } catch (error) {
      console.error('[Telegram Bot] Requisites error:', error);
      await ctx.reply('❌ Произошла ошибка.');
    }
    return;
  }
  if (text === '📚 База знаний') {
    // Show knowledge base directly
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🛡️ Гарантии выплат', 'kb_guarantees')],
      [Markup.button.callback('🔒 Прозрачность выплат', 'kb_security')],
      [Markup.button.callback('📅 Бесплатная запись', 'kb_booking')],
      [Markup.button.callback('📝 Подписание документов', 'kb_documents')],
      [Markup.button.callback('📈 Как стать самозанятым', 'kb_selfemployed')],
      [Markup.button.callback('🏥 Клиники-партнеры', 'kb_clinics')]
    ]);

    await ctx.reply(
      '📚 <b>База знаний DocPartner</b>\n\n' +
      'Выберите интересующий вопрос:',
      { parse_mode: 'HTML', ...keyboard }
    );
    return;
  }
  if (text === 'ℹ️ О программе') {
    // Show about info with dynamic rates from settings
    const { getCommissionRates } = await import('./db');
    const rates = await getCommissionRates();
    const rateInfo = rates.premiumRate
      ? `• Вознаграждение: от ${rates.baseRate}% от суммы лечения\n• ${rates.premiumRate}% при объёме >${(rates.premiumThresholdRub || 0).toLocaleString('ru-RU')} ₽/мес\n`
      : `• Вознаграждение: ${rates.baseRate}% от суммы лечения\n`;

    await ctx.reply(
      'ℹ️ <b>О программе DocPartner</b>\n\n' +
      'DocPartner — это B2B-платформа агентских рекомендаций в сфере здравоохранения.\n\n' +
      '<b>🎯 Наша миссия:</b>\n' +
      'Связывать врачей-агентов с проверенными клиниками для направления пациентов на платное лечение.\n\n' +
      '<b>💰 Условия:</b>\n' +
      rateInfo +
      '• Минимальная сумма вывода: 1 000 ₽\n' +
      '• Выплаты: 3-5 рабочих дней\n\n' +
      '<b>🏥 Партнеры:</b>\n' +
      '8 проверенных клиник в Москве, Санкт-Петербурге, Казани и Уфе\n\n' +
      '<b>🔒 Безопасность:</b>\n' +
      '• Все договоры оформляются официально\n' +
      '• Персональные данные защищены согласно 152-ФЗ\n' +
      '• Многоуровневая система проверок\n\n' +
      '🌐 Сайт: ' + ENV.appUrl + '\n' +
      '📧 Email: info@doc-partner.ru',
      { parse_mode: 'HTML' }
    );
    return;
  }
  if (text === '🔗 Реферальная ссылка') {
    // Show referral program directly
    try {
      const db = await getDb();
      if (!db) {
        await ctx.reply('❌ Ошибка подключения к базе данных.');
        return;
      }

      const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

      if (!agent) {
        await ctx.reply('Вы еще не зарегистрированы. Используйте /start');
        return;
      }

      const referralLink = `https://t.me/docpartnerbot?start=ref_${agent.id}`;
      const webReferralLink = `https://doc-partner.ru/register?ref=${agent.id}`;
      const bonusPoints = agent.bonusPoints || 0;

      // Count referred agents from DB (only active ones)
      const { and: andOp } = await import('drizzle-orm');
      const referredAgents = await db.select().from(agents)
        .where(andOp(eq(agents.referredBy, agent.id), eq(agents.status, 'active')));
      const referredCount = referredAgents.length;

      // Get paid referral count for bonus unlock progress
      const { getAgentPaidReferralCount } = await import('./db');
      const paidCount = await getAgentPaidReferralCount(agent.id);
      const bonusRub = (bonusPoints / 100).toLocaleString("ru-RU");
      const bonusUnlocked = paidCount >= 10;

      let message = '👥 <b>Реферальная программа</b>\n\n';
      message += '🎁 Приглашайте коллег и зарабатывайте!\n\n';
      message += `🔗 <b>Ваша реферальная ссылка:</b>\n📱 Telegram: <code>${referralLink}</code>\n🌐 Веб: <code>${webReferralLink}</code>\n\n`;
      message += `📈 <b>Ваша статистика:</b>\n`;
      message += `• Приглашено агентов: ${referredCount}\n`;
      message += `• Бонус за рефералов: ${bonusRub} ₽`;
      if (bonusPoints > 0 && !bonusUnlocked) {
        message += ` (🔒 заблокирован)\n`;
        message += `• Прогресс: ${paidCount}/10 оплаченных пациентов\n`;
      } else if (bonusPoints > 0 && bonusUnlocked) {
        message += ` (✅ доступен для вывода)\n`;
      } else {
        message += `\n`;
      }
      message += '\n💡 За каждого приглашённого — 1 000 ₽. Разблокировка после 10 оплаченных пациентов.';

      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('[Telegram Bot] Referral program error:', error);
      await ctx.reply('❌ Произошла ошибка.');
    }
    return;
  }

  // Handle account linking: email input
  if (session.registrationStep === 'link_email') {
    const emailLower = text.trim().toLowerCase();
    const emailValidation = validateEmailAdvanced(emailLower);
    if (!emailValidation.valid) {
      await ctx.reply(
        `❌ <b>Некорректный email:</b>\n${emailValidation.error}\n\nПопробуйте ещё раз:`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    try {
      const { getAgentByEmail } = await import('./db');
      const agent = await getAgentByEmail(emailLower);

      if (!agent) {
        await ctx.reply(
          '❌ <b>Аккаунт с таким email не найден.</b>\n\n' +
          'Проверьте email или зарегистрируйтесь: /start',
          { parse_mode: 'HTML' }
        );
        session.registrationStep = undefined;
        return;
      }

      if (agent.telegramId) {
        await ctx.reply(
          '⚠️ <b>Этот аккаунт уже привязан к другому Telegram.</b>\n\n' +
          'Если это ваш аккаунт, обратитесь в поддержку.',
          { parse_mode: 'HTML' }
        );
        session.registrationStep = undefined;
        return;
      }

      // Generate and send OTP
      const { createAndSendOTP } = await import('./otp');
      const sent = await createAndSendOTP(emailLower, 'login');
      if (!sent) {
        await ctx.reply('❌ Не удалось отправить код на email. Попробуйте позже.');
        session.registrationStep = undefined;
        return;
      }

      if (!session.tempData) session.tempData = {};
      session.tempData.linkAgentId = agent.id;
      session.tempData.email = emailLower;
      session.registrationStep = 'link_otp';

      await ctx.reply(
        `📧 <b>Код отправлен на ${escapeHtml(emailLower)}</b>\n\n` +
        'Введите 6-значный код подтверждения:',
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('[Telegram Bot] Error in link_email:', error);
      await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
      session.registrationStep = undefined;
    }
    return;
  }

  // Handle account linking: OTP verification
  if (session.registrationStep === 'link_otp') {
    const code = text.trim().replace(/\D/g, '');
    if (code.length !== 6) {
      await ctx.reply('❌ Код должен состоять из 6 цифр. Попробуйте ещё раз:');
      return;
    }

    const email = session.tempData?.email;
    const linkAgentId = session.tempData?.linkAgentId;
    if (!email || !linkAgentId) {
      await ctx.reply('❌ Сессия истекла. Начните заново: /start');
      session.registrationStep = undefined;
      return;
    }

    try {
      const { verifyOTP } = await import('./otp');
      const valid = await verifyOTP(email, code);

      if (!valid) {
        await ctx.reply(
          '❌ <b>Неверный или истекший код.</b>\n\nПопробуйте ещё раз или введите /start для начала заново.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      // OTP verified — link Telegram to the account
      const { updateAgentTelegramData } = await import('./db');
      await updateAgentTelegramData(linkAgentId, {
        telegramId: String(userId),
        firstName: ctx.from?.first_name || '',
        lastName: ctx.from?.last_name || null,
        username: ctx.from?.username || null,
        photoUrl: null,
      });

      // Get updated agent to show status
      const db = await getDb();
      const [agent] = await db!.select().from(agents).where(eq(agents.id, linkAgentId));

      sessions.delete(userId);

      const statusLabels: Record<string, string> = {
        pending: 'ожидает проверки',
        active: 'активен',
        rejected: 'отклонена',
        blocked: 'заблокирован'
      };

      const keyboard = agent?.status === 'active' ? mainMenuKeyboard : Markup.removeKeyboard();

      await ctx.reply(
        '✅ <b>Telegram успешно привязан к вашему аккаунту!</b>\n\n' +
        `👤 <b>Имя:</b> ${escapeHtml(agent?.fullName || '')}\n` +
        `📧 <b>Email:</b> ${escapeHtml(agent?.email || '')}\n` +
        `📍 <b>Город:</b> ${escapeHtml(agent?.city || '')}\n` +
        `🎯 <b>Статус:</b> <b>${statusLabels[agent?.status || ''] || agent?.status}</b>\n\n` +
        (agent?.status === 'active'
          ? '✅ Вы можете отправлять рекомендации пациентов. Выберите действие:'
          : agent?.status === 'pending'
          ? '⏳ Ваша заявка находится на проверке. Мы свяжемся с вами в течение 24 часов.'
          : ''),
        { parse_mode: 'HTML', ...keyboard }
      );
    } catch (error) {
      console.error('[Telegram Bot] Error in link_otp:', error);
      await ctx.reply('❌ Произошла ошибка при проверке кода. Попробуйте позже.');
      session.registrationStep = undefined;
    }
    return;
  }

  // Handle registration flow
  if (session.registrationStep === 'fullName') {
    const validation = validateFullName(text);
    if (!validation.valid) {
      await ctx.reply(
        `❌ <b>Ошибка валидации:</b>\n${validation.error}\n\n` +
        '💡 <i>Пример: Иванов Иван Петрович</i>\n\n' +
        'Попробуйте еще раз:',
        { parse_mode: 'HTML' }
      );
      return;
    }

    const capitalized = capitalizeWords(text);
    if (!session.tempData) session.tempData = {};
    session.tempData.fullName = capitalized;
    session.registrationStep = 'email';

    await ctx.reply(
      `✅ <b>Отлично, ${capitalized.split(' ')[1]}!</b>\n\n` +
      '📧 <b>Теперь укажите ваш email:</b>\n' +
      '<i>(На него будут приходить только важные уведомления)</i>\n\n' +
      '💡 <i>Пример: ivan@mail.ru</i>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  if (session.registrationStep === 'email') {
    const validation = validateEmailAdvanced(text);
    if (!validation.valid) {
      await ctx.reply(
        `❌ <b>Ошибка валидации:</b>\n${validation.error}\n\n` +
        '💡 <i>Пример: ivan@mail.ru</i>\n\n' +
        'Попробуйте еще раз:',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Проверка уникальности email
    const { getAgentByEmail } = await import('./db');
    const existingByEmail = await getAgentByEmail(text.toLowerCase());
    if (existingByEmail) {
      session.registrationStep = undefined;
      await ctx.reply(
        '❌ <b>Этот email уже зарегистрирован.</b>\n\n' +
        'Вы не можете использовать другой email. Варианты:\n\n' +
        '🔗 <b>Привязать аккаунт</b> — если вы уже регистрировались на сайте\n' +
        '🔄 <b>Начать заново</b> — использовать другие данные',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔗 Привязать существующий аккаунт', 'link_existing')],
            [Markup.button.callback('🔄 Начать заново', 'restart_registration')],
          ])
        }
      );
      return;
    }

    if (!session.tempData) session.tempData = {};
    session.tempData.email = text.toLowerCase();
    session.registrationStep = 'phone';

    await ctx.reply(
      '✅ <b>Email сохранен!</b>\n\n' +
      '📱 <b>Теперь поделитесь вашим номером телефона.</b>\n' +
      '<i>Нажмите кнопку ниже, чтобы отправить контакт:</i>',
      { parse_mode: 'HTML', ...Markup.keyboard([
        Markup.button.contactRequest('📱 Поделиться номером телефона')
      ]).oneTime().resize() }
    );
    return;
  }

  // Handle phone number typed as text (also accept text input, not only contact sharing)
  if (session.registrationStep === 'phone') {
    const validation = validatePhoneAdvanced(text);
    if (!validation.valid) {
      await ctx.reply(
        `❌ <b>Ошибка валидации:</b>\n${validation.error}\n\n` +
        '📱 <b>Поделитесь номером телефона</b> кнопкой ниже или введите вручную (например, +79991234567):',
        { parse_mode: 'HTML', ...Markup.keyboard([
          Markup.button.contactRequest('📱 Поделиться номером телефона')
        ]).oneTime().resize() }
      );
      return;
    }

    if (!session.tempData) { await ctx.reply('❌ Сессия истекла. Начните заново: /start'); return; }

    // Проверка уникальности телефона
    const { getAgentByPhone } = await import('./db');
    const existingByPhone = await getAgentByPhone(validation.normalized!);
    if (existingByPhone) {
      // Телефон уже в базе — нельзя вводить другой, только привязать существующий аккаунт
      session.registrationStep = undefined;
      await ctx.reply(
        '❌ <b>Этот номер телефона уже зарегистрирован.</b>\n\n' +
        'Вы не можете использовать другой номер. Варианты:\n\n' +
        '🔗 <b>Привязать аккаунт</b> — нажмите кнопку ниже\n' +
        '📱 <b>Поделитесь контактом</b> — чтобы подтвердить что это ваш номер',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔗 Привязать существующий аккаунт', 'link_existing')],
            [Markup.button.callback('🔄 Начать заново', 'restart_registration')],
          ])
        }
      );
      return;
    }

    session.tempData.phone = validation.normalized!;
    session.registrationStep = 'role';

    // Remove the contact keyboard first, then show role inline keyboard
    await ctx.reply('✅ Номер телефона сохранен!', Markup.removeKeyboard());
    await ctx.reply('Выберите вашу роль:', roleKeyboard);
    return;
  }

  if (session.registrationStep === 'city') {
    const validation = validateCity(text);
    if (!validation.valid) {
      await ctx.reply(
        `❌ <b>Ошибка валидации:</b>\n${validation.error}\n\n` +
        '💡 <i>Пример: Москва</i>\n\n' +
        'Попробуйте еще раз:',
        { parse_mode: 'HTML' }
      );
      return;
    }

    const capitalized = capitalizeWords(text);
    if (!session.tempData) session.tempData = {};
    session.tempData.city = capitalized;

    // Show clinic exclusion selection
    session.registrationStep = 'excluded_clinics';
    session.tempData.excludedClinics = [];

    // Fetch active clinics from DB
    const clinicDb = await getDb();
    const activeClinics = clinicDb
      ? await clinicDb.select({ id: schema.clinics.id, name: schema.clinics.name }).from(schema.clinics).where(eq(schema.clinics.isActive, 'yes'))
      : [];

    if (activeClinics.length === 0) {
      // No clinics — skip to contract
      session.registrationStep = 'contract';
      await ctx.reply(
        '📄 <b>Договор оферты DocPartner</b>\n\n' +
        'Основные условия:\n' +
        '• Вознаграждение: согласно тарифной сетке (от базовой ставки)\n' +
        '• Минимальная сумма выплаты: 1000 ₽\n' +
        '• Выплаты производятся после подтверждения лечения клиникой\n' +
        '• Все рекомендации фиксируются в системе\n' +
        '• Персональные данные защищены согласно 152-ФЗ\n\n' +
        'Полный текст договора: ' + ENV.appUrl + '/contract\n\n' +
        'Принимаете условия договора?',
        { ...contractKeyboard, parse_mode: 'HTML' }
      );
    } else {
      const buttons = activeClinics.map(c =>
        [Markup.button.callback(`${c.name}`, `excl_clinic_${c.id}`)]
      );
      buttons.push([Markup.button.callback('Пропустить ➡️', 'excl_clinics_done')]);
      buttons.push([Markup.button.callback('✅ Готово — сохранить выбор', 'excl_clinics_done')]);

      await ctx.reply(
        '🏥 <b>Исключение клиник</b>\n\n' +
        'Выберите клиники, куда <b>НЕ</b> желательно направлять ваших пациентов.\n' +
        'Нажмите на клинику чтобы добавить/убрать из списка исключений.\n\n' +
        'Когда закончите, нажмите «Готово» или «Пропустить».',
        { ...Markup.inlineKeyboard(buttons), parse_mode: 'HTML' }
      );
    }
    return;
  }

  // Handle specialization text input (for "Other")
  if (session.registrationStep === 'specialization' && session.tempData?.role === 'Врач') {
    if (!/^[А-Яа-яЁё\s\-,.]+$/.test(text)) {
      await ctx.reply('❌ Пожалуйста, используйте только кириллицу. Введите вашу специальность:');
      return;
    }

    const capitalized = capitalizeWords(text);
    if (!session.tempData) session.tempData = {};
    session.tempData.specialization = capitalized;
    session.registrationStep = 'city';

    await ctx.reply('✅ Специальность сохранена!\n\nТеперь укажите ваш город:');
    return;
  }

  // Handle patient submission flow
  if (session.registrationStep === 'patient_name') {
    const validation = validateFullName(text);
    if (!validation.valid) {
      await ctx.reply(
        `❌ <b>Ошибка валидации:</b>\n${validation.error}\n\n` +
        '💡 <i>Пример: Иванов Иван Петрович</i>\n\n' +
        'Попробуйте еще раз:',
        { parse_mode: 'HTML' }
      );
      return;
    }

    const capitalized = capitalizeWords(text);
    if (!session.tempData) { await ctx.reply('❌ Сессия истекла. Начните заново: /patient'); return; }
    session.tempData.patientName = capitalized;
    session.registrationStep = 'patient_birthdate';

    await ctx.reply(
      '✅ <b>Имя сохранено!</b>\n\n' +
      '📅 <b>Введите дату рождения пациента:</b>\n' +
      '<i>(Формат: ДД.ММ.ГГГГ)</i>\n\n' +
      '💡 <i>Пример: 15.03.1985</i>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  if (session.registrationStep === 'patient_birthdate') {
    const validation = validateBirthdate(text);
    if (!validation.valid) {
      await ctx.reply(
        `❌ <b>Ошибка валидации:</b>\n${validation.error}\n\n` +
        '💡 <i>Пример: 15.03.1985</i>\n\n' +
        'Попробуйте еще раз:',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Date is valid, continue
    const [day, month, year] = text.split('.').map(Number);
    const birthdate = new Date(year, month - 1, day);
    const today = new Date();
    const age = today.getFullYear() - birthdate.getFullYear();
    const monthDiff = today.getMonth() - birthdate.getMonth();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate()) ? age - 1 : age;

    // Validate date is valid
    if (birthdate.getDate() !== day || birthdate.getMonth() !== month - 1 || birthdate.getFullYear() !== year) {
      await ctx.reply('❌ Некорректная дата. Проверьте день, месяц и год.\n\nПример: 15.03.1985');
      return;
    }

    // Check date is in the past
    if (birthdate > today) {
      await ctx.reply('❌ Дата рождения не может быть в будущем. Проверьте дату.');
      return;
    }

    // Check reasonable age (0-120 years)
    if (actualAge < 0 || actualAge > 120) {
      await ctx.reply('❌ Некорректный возраст. Проверьте дату рождения.');
      return;
    }

    if (!session.tempData) { await ctx.reply('❌ Сессия истекла. Начните заново: /patient'); return; }
    session.tempData.patientBirthdate = text;
    session.registrationStep = 'patient_phone';

    await ctx.reply('✅ Дата рождения сохранена!\n\nВведите номер телефона пациента (+79XXXXXXXXX):');
    return;
  }

  if (session.registrationStep === 'patient_phone') {
    const validation = validatePhoneAdvanced(text.trim());
    if (!validation.valid) {
      await ctx.reply(
        `❗️ <b>Ошибка валидации:</b>\n${validation.error}\n\n` +
        'Попробуйте еще раз:',
        { parse_mode: 'HTML' }
      );
      return;
    }

    const phone = validation.normalized!;
    if (!session.tempData) { await ctx.reply('❌ Сессия истекла. Начните заново: /patient'); return; }
    session.tempData.patientPhone = phone;
    session.registrationStep = 'patient_notes';

    // Ask for optional notes
    const notesKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⏭ Пропустить', 'patient_notes_skip')]
    ]);

    await ctx.reply(
      '📝 <b>Примечание</b> (необязательно)\n\n' +
      'Хотите добавить примечание по пациенту?\n\n' +
      '💡 <i>Например: запись к конкретному врачу, важная информация о пациенте, особые пожелания</i>\n\n' +
      'Напишите примечание или нажмите «Пропустить»:',
      { parse_mode: 'HTML', ...notesKeyboard }
    );
    return;
  }

  // ===============================
  // PATIENT NOTES INPUT STEP
  // ===============================

  if (session.registrationStep === 'patient_notes') {
    const notes = text.trim();
    if (notes.length > 500) {
      await ctx.reply(
        '❌ <b>Примечание слишком длинное.</b>\n\n' +
        `Максимум 500 символов, вы ввели ${notes.length}.\nСократите текст и попробуйте снова:`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    if (!session.tempData) { await ctx.reply('❌ Сессия истекла. Начните заново: /patient'); return; }
    session.tempData.patientNotes = notes;
    session.registrationStep = 'patient_contact_consent';

    // Ask if patient wants DocDoc to contact them
    const contactConsentKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Да, хочет', 'contact_consent_yes')],
      [Markup.button.callback('❌ Нет', 'contact_consent_no')]
    ]);

    await ctx.reply(
      '✅ Примечание сохранено!\n\n' +
      '📞 <b>Согласие на связь</b>\n\n' +
      'Хочет ли пациент, чтобы сервис DocDoc связался с ним, помог <b>бесплатно записаться</b> к врачу и <b>проконсультировал</b>?',
      { parse_mode: 'HTML', ...contactConsentKeyboard }
    );
    return;
  }

  // ===============================
  // PAYOUT REQUISITES INPUT STEPS
  // ===============================

  if (session.registrationStep === 'payout_inn') {
    const cleaned = text.trim();
    if (!/^\d{12}$/.test(cleaned)) {
      await ctx.reply(
        '❌ <b>ИНН должен содержать ровно 12 цифр.</b>\n\n' +
        '💡 Пример: 771234567890\n\nПопробуйте еще раз:',
        { parse_mode: 'HTML' }
      );
      return;
    }

    if (!session.tempData) session.tempData = {};
    session.tempData.payoutInn = cleaned;
    session.registrationStep = 'payout_self_employed';

    await ctx.reply(
      '✅ ИНН сохранён!\n\n' +
      '2️⃣ Вы зарегистрированы как <b>самозанятый</b>?',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Да, я самозанятый', 'payout_se_yes')],
          [Markup.button.callback('❌ Нет', 'payout_se_no')],
        ])
      }
    );
    return;
  }

  if (session.registrationStep === 'payout_card_number') {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length < 13 || cleaned.length > 19) {
      await ctx.reply(
        '❌ <b>Номер карты должен содержать 16-19 цифр.</b>\n\n' +
        '💡 Принимаются только карты МИР (начинаются с 2200-2204)\n\nПопробуйте еще раз:',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Check MIR card (BIN prefix 2200-2204)
    const prefix = parseInt(cleaned.substring(0, 4), 10);
    if (prefix < 2200 || prefix > 2204) {
      await ctx.reply(
        '❌ <b>Принимаются только карты МИР.</b>\n\n' +
        'Номер карты МИР начинается с 2200-2204.\n' +
        'Visa/Mastercard не поддерживаются.\n\nВведите номер карты МИР:',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Validate with Luhn algorithm
    let sum = 0;
    let isEven = false;
    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i], 10);
      if (isEven) { digit *= 2; if (digit > 9) digit -= 9; }
      sum += digit;
      isEven = !isEven;
    }
    if (sum % 10 !== 0) {
      await ctx.reply(
        '❌ <b>Некорректный номер карты.</b>\n\n' +
        'Проверьте номер и попробуйте еще раз:',
        { parse_mode: 'HTML' }
      );
      return;
    }

    if (!session.tempData) session.tempData = {};
    session.tempData.payoutCardNumber = cleaned;
    session.registrationStep = undefined;

    // Show summary for confirmation
    const data = session.tempData;
    const seLabel = data.payoutSelfEmployed === 'yes' ? 'Да' : 'Нет';
    const maskedCard = `**** **** **** ${cleaned.slice(-4)}`;

    await ctx.reply(
      '📋 <b>Проверьте ваши реквизиты:</b>\n\n' +
      `• ИНН: <code>${data.payoutInn}</code>\n` +
      `• Самозанятый: ${seLabel}\n` +
      `• Способ: 💳 Карта\n` +
      `• Карта: <code>${maskedCard}</code>\n\n` +
      'Всё верно?',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Подтвердить и сохранить', 'payout_confirm_requisites')],
          [Markup.button.callback('✏️ Заполнить заново', 'payout_edit_requisites')],
          [Markup.button.callback('❌ Отмена', 'payout_cancel')]
        ])
      }
    );
    return;
  }

  if (session.registrationStep === 'payout_bank_name') {
    const cleaned = text.trim();
    if (cleaned.length < 2 || cleaned.length > 255) {
      await ctx.reply(
        '❌ <b>Название банка должно быть от 2 до 255 символов.</b>\n\n' +
        '💡 Пример: Сбербанк\n\nПопробуйте еще раз:',
        { parse_mode: 'HTML' }
      );
      return;
    }

    if (!session.tempData) session.tempData = {};
    session.tempData.payoutBankName = cleaned;
    session.registrationStep = 'payout_bank_account';

    await ctx.reply(
      '✅ Банк сохранён!\n\n' +
      '3️⃣ Введите <b>номер расчётного счёта</b> (20 цифр):',
      { parse_mode: 'HTML' }
    );
    return;
  }

  if (session.registrationStep === 'payout_bank_account') {
    const cleaned = text.trim();
    if (!/^\d{20}$/.test(cleaned)) {
      await ctx.reply(
        '❌ <b>Номер счёта должен содержать ровно 20 цифр.</b>\n\n' +
        '💡 Пример: 40817810099910004312\n\nПопробуйте еще раз:',
        { parse_mode: 'HTML' }
      );
      return;
    }

    if (!session.tempData) session.tempData = {};
    session.tempData.payoutBankAccount = cleaned;
    session.registrationStep = 'payout_bank_bik';

    await ctx.reply(
      '✅ Счёт сохранён!\n\n' +
      '4️⃣ Введите <b>БИК банка</b> (9 цифр):',
      { parse_mode: 'HTML' }
    );
    return;
  }

  if (session.registrationStep === 'payout_bank_bik') {
    const cleaned = text.trim();
    if (!/^\d{9}$/.test(cleaned)) {
      await ctx.reply(
        '❌ <b>БИК должен содержать ровно 9 цифр.</b>\n\n' +
        '💡 Пример: 044525225\n\nПопробуйте еще раз:',
        { parse_mode: 'HTML' }
      );
      return;
    }

    if (!session.tempData) session.tempData = {};
    session.tempData.payoutBankBik = cleaned;
    session.registrationStep = undefined;

    // Show summary for confirmation
    const data = session.tempData;
    await ctx.reply(
      '📋 <b>Проверьте ваши реквизиты:</b>\n\n' +
      `• ИНН: <code>${data.payoutInn}</code>\n` +
      `• Банк: ${escapeHtml(data.payoutBankName || '')}\n` +
      `• Счёт: <code>${data.payoutBankAccount}</code>\n` +
      `• БИК: <code>${data.payoutBankBik}</code>\n\n` +
      'Всё верно?',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Подтвердить и сохранить', 'payout_confirm_requisites')],
          [Markup.button.callback('✏️ Заполнить заново', 'payout_edit_requisites')],
          [Markup.button.callback('❌ Отмена', 'payout_cancel')]
        ])
      }
    );
    return;
  }
});

// Handle contact sharing
bot.on(message('contact'), async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const session = getSession(userId);

  // Handle account linking via phone contact
  if (session.registrationStep === 'link_phone') {
    const contact = ctx.message.contact;
    if (!contact?.phone_number) {
      await ctx.reply('❌ Не удалось получить номер. Попробуйте ещё раз.');
      return;
    }

    // Security: verify this is the user's own contact
    if (contact.user_id !== userId) {
      await ctx.reply(
        '⚠️ <b>Необходимо поделиться своим номером телефона.</b>\n\nНажмите кнопку «📱 Поделиться номером телефона» ниже.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    const validation = validatePhoneAdvanced(contact.phone_number);
    if (!validation.valid) {
      await ctx.reply(
        `❌ <b>Ошибка валидации:</b>\n${validation.error}`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    try {
      const { getAgentByPhone, updateAgentTelegramData } = await import('./db');
      const agent = await getAgentByPhone(validation.normalized!);

      if (!agent) {
        await ctx.reply(
          '❌ <b>Аккаунт с таким номером телефона не найден.</b>\n\n' +
          'Проверьте номер или зарегистрируйтесь: /start',
          { parse_mode: 'HTML', ...Markup.removeKeyboard() }
        );
        session.registrationStep = undefined;
        return;
      }

      if (agent.telegramId) {
        await ctx.reply(
          '⚠️ <b>Этот аккаунт уже привязан к другому Telegram.</b>\n\n' +
          'Если это ваш аккаунт, обратитесь в поддержку.',
          { parse_mode: 'HTML', ...Markup.removeKeyboard() }
        );
        session.registrationStep = undefined;
        return;
      }

      // Phone verified — link Telegram to the account
      await updateAgentTelegramData(agent.id, {
        telegramId: String(userId),
        firstName: ctx.from?.first_name || '',
        lastName: ctx.from?.last_name || null,
        username: ctx.from?.username || null,
        photoUrl: null,
      });

      sessions.delete(userId);

      const statusLabels: Record<string, string> = {
        pending: 'ожидает проверки',
        active: 'активен',
        rejected: 'отклонена',
        blocked: 'заблокирован'
      };

      const keyboard = agent.status === 'active' ? mainMenuKeyboard : Markup.removeKeyboard();

      await ctx.reply(
        '✅ <b>Telegram успешно привязан к вашему аккаунту!</b>\n\n' +
        `👤 <b>Имя:</b> ${escapeHtml(agent.fullName || '')}\n` +
        `📧 <b>Email:</b> ${escapeHtml(agent.email || '')}\n` +
        `📍 <b>Город:</b> ${escapeHtml(agent.city || '')}\n` +
        `🎯 <b>Статус:</b> <b>${statusLabels[agent.status || ''] || agent.status}</b>\n\n` +
        (agent.status === 'active'
          ? '✅ Вы можете отправлять рекомендации пациентов. Выберите действие:'
          : agent.status === 'pending'
          ? '⏳ Ваша заявка находится на проверке. Мы свяжемся с вами в течение 24 часов.'
          : ''),
        { parse_mode: 'HTML', ...keyboard }
      );
    } catch (error) {
      console.error('[Telegram Bot] Error in link_phone:', error);
      await ctx.reply('❌ Произошла ошибка. Попробуйте позже.', Markup.removeKeyboard());
      session.registrationStep = undefined;
    }
    return;
  }

  // Handle phone number during registration
  if (session.registrationStep === 'phone') {
    const contact = ctx.message.contact;
    if (!contact?.phone_number) {
      await ctx.reply('❌ Не удалось получить номер. Попробуйте ещё раз.');
      return;
    }

    const validation = validatePhoneAdvanced(contact.phone_number);
    if (!validation.valid) {
      await ctx.reply(
        `❌ <b>Ошибка валидации:</b>\n${validation.error}\n\n` +
        'Пожалуйста, поделитесь корректным номером телефона.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    if (!session.tempData) { await ctx.reply('❌ Сессия истекла. Начните заново: /start'); return; }

    // Проверка уникальности телефона
    const { getAgentByPhone: getByPhone } = await import('./db');
    const existingPhone = await getByPhone(validation.normalized!);
    if (existingPhone) {
      // Телефон уже в базе — нельзя вводить другой, только привязать существующий аккаунт
      session.registrationStep = undefined;
      await ctx.reply(
        '❌ <b>Этот номер телефона уже зарегистрирован.</b>\n\n' +
        'Вы не можете использовать другой номер. Варианты:\n\n' +
        '🔗 <b>Привязать аккаунт</b> — нажмите кнопку ниже\n' +
        '📱 <b>Поделитесь контактом</b> — чтобы подтвердить что это ваш номер',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔗 Привязать существующий аккаунт', 'link_existing')],
            [Markup.button.callback('🔄 Начать заново', 'restart_registration')],
          ])
        }
      );
      return;
    }

    session.tempData.phone = validation.normalized!;
    session.registrationStep = 'role';

    await ctx.reply(
      '✅ Номер телефона сохранен!\n\n' +
      'Выберите вашу роль:',
      roleKeyboard
    );
  }
});

// Handle role selection
bot.action(/^role_(.+)$/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (isCallbackSpamming(userId)) { await ctx.answerCbQuery(); return; }

  const session = getSession(userId);
  const roleKey = ctx.match[1];

  const roleMap: Record<string, string> = {
    doctor: 'Врач',
    coordinator: 'Координатор',
    registrar: 'Регистратор',
    other: 'Прочее'
  };

  const role = roleMap[roleKey];
  if (!role || !session.tempData) { await ctx.answerCbQuery(); return; }
  session.tempData.role = role;

  await ctx.answerCbQuery();

  if (role === 'Врач') {
    session.registrationStep = 'specialization';
    await ctx.editMessageText(
      '✅ Роль: Врач\n\n' +
      'Выберите вашу специальность:',
      specializationKeyboard
    );
  } else {
    session.registrationStep = 'city';
    await ctx.editMessageText(`✅ Роль: ${role}\n\nТеперь укажите ваш город:`);
  }
});

// Handle specialization selection
bot.action(/^spec_(.+)$/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (isCallbackSpamming(userId)) { await ctx.answerCbQuery(); return; }

  const session = getSession(userId);
  const specKey = ctx.match[1];

  await ctx.answerCbQuery();

  if (specKey === 'other') {
    session.registrationStep = 'specialization';
    await ctx.editMessageText('Введите вашу специальность:');
    return;
  }

  const specMap: Record<string, string> = {
    therapist: 'Терапевт',
    surgeon: 'Хирург',
    cardiologist: 'Кардиолог',
    neurologist: 'Невролог',
    pediatrician: 'Педиатр',
    oncologist: 'Онколог'
  };

  const specialization = specMap[specKey];
  if (!specialization || !session.tempData) { return; }
  session.tempData.specialization = specialization;
  session.registrationStep = 'city';

  await ctx.editMessageText(`✅ Специальность: ${specialization}\n\nТеперь укажите ваш город:`);
});

// Handle contract acceptance
bot.action('contract_accept', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (isCallbackSpamming(userId)) { await ctx.answerCbQuery(); return; }

  const session = getSession(userId);

  // Prevent double-click: if already processing, ignore
  if (session.processing) { await ctx.answerCbQuery('⏳ Обработка...'); return; }
  session.processing = true;

  // Validate session data exists
  const data = session.tempData;
  if (!data?.fullName || !data?.email || !data?.phone || !data?.role || !data?.city) {
    session.processing = false;
    await ctx.answerCbQuery();
    await ctx.editMessageText('❌ Сессия истекла. Начните регистрацию заново: /start');
    sessions.delete(userId);
    return;
  }

  await ctx.answerCbQuery();

  try {
    // Save to database
    const db = await getDb();
    if (!db) {
      session.processing = false;
      await ctx.editMessageText('❌ Ошибка подключения к базе данных. Попробуйте позже.');
      return;
    }

    // Check if user already registered
    const [existingAgent] = await db.select().from(agents).where(eq(agents.telegramId, String(userId)));

    if (existingAgent) {
      const statusLabels: Record<string, string> = {
        pending: 'ожидает проверки',
        active: 'активен',
        rejected: 'отклонена',
        blocked: 'заблокирован'
      };

      await ctx.editMessageText(
        '⚠️ <b>Вы уже зарегистрированы!</b>\n\n' +
        `Ваш статус: <b>${statusLabels[existingAgent.status] || existingAgent.status}</b>\n\n` +
        (existingAgent.status === 'pending'
          ? '⏳ Ваша заявка находится на проверке. Мы свяжемся с вами в течение 24 часов.'
          : existingAgent.status === 'active'
          ? '✅ Вы можете отправлять рекомендации пациентов.'
          : existingAgent.status === 'rejected'
          ? '❌ К сожалению, ваша заявка была отклонена. Свяжитесь с поддержкой для уточнения деталей.'
          : '🚫 Ваш аккаунт заблокирован. Свяжитесь с поддержкой для получения информации.'),
        { parse_mode: 'HTML' }
      );

      if (existingAgent.status === 'active') {
        await ctx.reply('Выберите действие:', mainMenuKeyboard);
      }
      sessions.delete(userId);
      return;
    }

    // Generate unique referral code
    const crypto = await import('crypto');
    const referralCode = crypto.randomBytes(6).toString('hex');

    // Validate referredBy agent exists (if provided)
    // First check session, then fallback to DB (survives bot restarts)
    let referredByValue = data.referredBy;
    if (!referredByValue) {
      try {
        const { getAppSetting } = await import('./db');
        const dbRef = await getAppSetting(`ref_pending_${userId}`);
        if (dbRef) {
          referredByValue = dbRef;
          console.log(`[Telegram Bot] Restored referral from DB: user ${userId} -> ref ${dbRef}`);
        }
      } catch (e) {
        console.error('[Telegram Bot] Failed to read pending referral:', e);
      }
    }

    let referredByAgentId: number | null = null;
    if (referredByValue) {
      const parsedId = parseInt(referredByValue, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        const [referrer] = await db.select({ id: agents.id, status: agents.status }).from(agents).where(eq(agents.id, parsedId));
        if (referrer && referrer.status === 'active') {
          referredByAgentId = referrer.id;
        } else if (referrer) {
          console.warn(`[Telegram Bot] Referrer ${parsedId} is not active (status: ${referrer.status}), skipping bonus`);
        }
      }
    }

    // Create agent in database
    const excludedClinicsJson = data.excludedClinics && data.excludedClinics.length > 0
      ? JSON.stringify(data.excludedClinics)
      : null;

    await db.insert(agents).values({
      telegramId: String(userId),
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      role: data.role,
      specialization: data.specialization || null,
      city: data.city,
      status: 'pending',
      referralCode,
      referredBy: referredByAgentId,
      excludedClinics: excludedClinicsJson,
    });

    // Clean up pending referral from DB
    try {
      const { setAppSetting } = await import('./db');
      // Delete by setting empty — or we could add a delete function, but this is fine
      const settingsDb = await getDb();
      if (settingsDb) {
        const { appSettings } = await import('../drizzle/schema');
        await settingsDb.delete(appSettings).where(eq(appSettings.key, `ref_pending_${userId}`));
      }
    } catch (e) { /* ignore cleanup errors */ }

    // Credit referral bonus to inviting agent (1000 RUB = 100000 kopecks)
    if (referredByAgentId) {
      try {
        const { addBonusPoints } = await import('./db');
        await addBonusPoints(referredByAgentId, 100000);
        console.log(`[Telegram Bot] Referral bonus +1000₽ credited to agent ${referredByAgentId}`);

        // Notify inviting agent
        const [inviter] = await db.select().from(agents).where(eq(agents.id, referredByAgentId));
        if (inviter?.telegramId) {
          await notifyAgent(
            inviter.telegramId,
            `🎁 <b>Новый реферал!</b>\n\n` +
            `Агент ${escapeHtml(data.fullName || "")} зарегистрировался по вашей ссылке.\n` +
            `+1 000 ₽ начислено в бонусы.\n\n` +
            `💡 Бонусы станут доступны для вывода после 10 оплаченных пациентов.`
          );
        } else {
          console.warn(`[Telegram Bot] Referrer ${referredByAgentId} has no telegramId, cannot notify`);
        }
      } catch (err) {
        console.error('[Telegram Bot] Failed to credit referral bonus to agent', referredByAgentId, ':', err);
      }
    }

    // Clear session before sending messages (prevents double-submit on retry)
    sessions.delete(userId);

    // Send registration confirmation
    await ctx.editMessageText(
      '🎉 <b>Регистрация завершена!</b>\n\n' +
      'Ваша заявка отправлена на проверку. Мы свяжемся с вами в течение 24 часов.\n\n' +
      'После одобрения вы сможете:\n' +
      '• Отправлять рекомендации пациентов\n' +
      '• Отслеживать статус рекомендаций\n' +
      '• Получать уведомления о выплатах',
      { parse_mode: 'HTML' }
    );

    // Send registration confirmation email
    try {
      const { sendRegistrationConfirmation } = await import('./email');
      await sendRegistrationConfirmation({
        to: data.email,
        agentName: data.fullName,
      });
    } catch (err) {
      console.error('[Telegram Bot] Failed to send registration confirmation email:', err);
    }

    // Send web access info
    await ctx.reply(
      '🔐 <b>Доступ к веб-кабинету</b>\n\n' +
      `📧 Ваш email: <code>${escapeHtml(data.email)}</code>\n\n` +
      `🌐 Войдите на сайт: ${ENV.appUrl}/login\n` +
      '💡 Для входа используйте код, который придёт в этот Telegram.',
      { parse_mode: 'HTML' }
    );

    // Send main menu keyboard
    await ctx.reply(
      '📱 <b>Главное меню</b>\n\n' +
      'Выберите действие из меню ниже или используйте команду /help для справки.',
      { parse_mode: 'HTML', ...mainMenuKeyboard }
    );
  } catch (error) {
    session.processing = false;
    console.error('[Telegram Bot] Registration error:', error);
    await ctx.editMessageText(
      '❌ Произошла ошибка при регистрации. Пожалуйста, попробуйте позже или свяжитесь с поддержкой.',
      { parse_mode: 'HTML' }
    );
  }
});

// Handle clinic exclusion toggle
bot.action(/^excl_clinic_(\d+)$/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (isCallbackSpamming(userId)) { await ctx.answerCbQuery(); return; }

  const session = getSession(userId);

  // If session was lost (e.g. after bot restart), restore it for clinic exclusion
  if (session.registrationStep !== 'excluded_clinics') {
    // Check if this user is in the middle of registration (agent exists but pending, or not yet created)
    const checkDb = await getDb();
    if (checkDb) {
      const [existingAgent] = await checkDb.select().from(schema.agents).where(eq(schema.agents.telegramId, userId.toString()));
      if (!existingAgent) {
        // Agent not yet created — session was lost during registration, restore excluded_clinics step
        session.registrationStep = 'excluded_clinics';
        if (!session.tempData) session.tempData = {};
        if (!session.tempData.excludedClinics) session.tempData.excludedClinics = [];
      } else {
        await ctx.answerCbQuery('Регистрация уже завершена');
        return;
      }
    } else {
      await ctx.answerCbQuery();
      return;
    }
  }

  const clinicId = parseInt(ctx.match[1], 10);
  if (!session.tempData) session.tempData = {};
  if (!session.tempData.excludedClinics) session.tempData.excludedClinics = [];

  const idx = session.tempData.excludedClinics.indexOf(clinicId);
  if (idx >= 0) {
    session.tempData.excludedClinics.splice(idx, 1);
    await ctx.answerCbQuery('Клиника убрана из исключений');
  } else {
    session.tempData.excludedClinics.push(clinicId);
    await ctx.answerCbQuery('Клиника добавлена в исключения');
  }

  // Update the message with checkmarks
  try {
    const clinicDb = await getDb();
    const activeClinics = clinicDb
      ? await clinicDb.select({ id: schema.clinics.id, name: schema.clinics.name }).from(schema.clinics).where(eq(schema.clinics.isActive, 'yes'))
      : [];

    const excluded = session.tempData.excludedClinics;
    const buttons = activeClinics.map(c => {
      const isExcluded = excluded.includes(c.id);
      return [Markup.button.callback(`${isExcluded ? '❌ ' : ''}${c.name}`, `excl_clinic_${c.id}`)];
    });
    buttons.push([Markup.button.callback('Пропустить ➡️', 'excl_clinics_done')]);
    buttons.push([Markup.button.callback('✅ Готово — сохранить выбор', 'excl_clinics_done')]);

    const excludedNames = activeClinics
      .filter(c => excluded.includes(c.id))
      .map(c => c.name);
    const excludedText = excludedNames.length > 0
      ? `\n\nИсключены: ${excludedNames.join(', ')}`
      : '';

    await ctx.editMessageText(
      '🏥 <b>Исключение клиник</b>\n\n' +
      'Выберите клиники, куда <b>НЕ</b> желательно направлять ваших пациентов.\n' +
      'Нажмите на клинику чтобы добавить/убрать из списка исключений.' +
      excludedText,
      { ...Markup.inlineKeyboard(buttons), parse_mode: 'HTML' }
    );
  } catch (e) {
    console.error('[Bot] Error updating clinic exclusion message:', e);
  }
});

// Handle clinic exclusion done
bot.action('excl_clinics_done', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (isCallbackSpamming(userId)) { await ctx.answerCbQuery(); return; }

  const session = getSession(userId);

  // Restore session if lost after bot restart
  if (session.registrationStep !== 'excluded_clinics') {
    const checkDb = await getDb();
    if (checkDb) {
      const [existingAgent] = await checkDb.select().from(schema.agents).where(eq(schema.agents.telegramId, userId.toString()));
      if (!existingAgent) {
        session.registrationStep = 'excluded_clinics';
        if (!session.tempData) session.tempData = {};
        if (!session.tempData.excludedClinics) session.tempData.excludedClinics = [];
      } else {
        await ctx.answerCbQuery('Регистрация уже завершена');
        return;
      }
    } else {
      await ctx.answerCbQuery();
      return;
    }
  }

  await ctx.answerCbQuery();

  const excluded = session.tempData?.excludedClinics || [];
  const excludedInfo = excluded.length > 0
    ? `\n✅ Исключено клиник: ${excluded.length}`
    : '\n✅ Нет исключений';

  // Transition to contract
  session.registrationStep = 'contract';
  await ctx.editMessageText(
    `${excludedInfo}\n\n` +
    '📄 <b>Договор оферты DocPartner</b>\n\n' +
    'Основные условия:\n' +
    '• Вознаграждение: согласно тарифной сетке (от базовой ставки)\n' +
    '• Минимальная сумма выплаты: 1000 ₽\n' +
    '• Выплаты производятся после подтверждения лечения клиникой\n' +
    '• Все рекомендации фиксируются в системе\n' +
    '• Персональные данные защищены согласно 152-ФЗ\n\n' +
    'Полный текст договора: ' + ENV.appUrl + '/contract\n\n' +
    'Принимаете условия договора?',
    { ...contractKeyboard, parse_mode: 'HTML' }
  );
});

bot.action('contract_decline', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.answerCbQuery();
  await ctx.editMessageText(
    'Регистрация отменена.\n\n' +
    'Если передумаете, используйте команду /start для начала регистрации заново.'
  );

  sessions.delete(userId);
});

// Handle patient notes skip
bot.action('patient_notes_skip', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (isCallbackSpamming(userId)) { await ctx.answerCbQuery(); return; }

  const session = getSession(userId);
  if (!session.tempData) { await ctx.answerCbQuery(); await ctx.editMessageText('❌ Сессия истекла. Начните заново: /patient'); sessions.delete(userId); return; }

  session.registrationStep = 'patient_contact_consent';
  await ctx.answerCbQuery();

  // Ask if patient wants DocDoc to contact them
  const contactConsentKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Да, хочет', 'contact_consent_yes')],
    [Markup.button.callback('❌ Нет', 'contact_consent_no')]
  ]);

  await ctx.editMessageText(
    '📞 <b>Согласие на связь</b>\n\n' +
    'Хочет ли пациент, чтобы сервис DocDoc связался с ним, помог <b>бесплатно записаться</b> к врачу и <b>проконсультировал</b>?',
    { parse_mode: 'HTML', ...contactConsentKeyboard }
  );
});

// Helper: build clinic selection keyboard
async function buildClinicSelectionKeyboard(selectedIds: number[]) {
  const db = await getDb();
  if (!db) return { keyboard: Markup.inlineKeyboard([[Markup.button.callback('⏭ Пропустить (любая клиника)', 'clinic_select_skip')]]), clinics: [] };

  const allClinics = await db.select({ id: schema.clinics.id, name: schema.clinics.name })
    .from(schema.clinics)
    .where(eq(schema.clinics.isActive, "yes"))
    .orderBy(schema.clinics.name);

  const buttons = allClinics.map(c => {
    const isSelected = selectedIds.includes(c.id);
    return [Markup.button.callback(
      `${isSelected ? '✅' : '⬜'} ${c.name}`,
      `clinic_toggle_${c.id}`
    )];
  });

  buttons.push([Markup.button.callback('⏭ Пропустить (любая клиника)', 'clinic_select_skip')]);
  if (selectedIds.length > 0) {
    buttons.push([Markup.button.callback(`✅ Готово (${selectedIds.length} выбрано)`, 'clinic_select_done')]);
  }

  return { keyboard: Markup.inlineKeyboard(buttons), clinics: allClinics };
}

// Helper: show patient confirmation preview
function buildPatientPreview(session: SessionData, clinicNames: string[]) {
  const d = session.tempData!;
  let text = '📋 <b>Проверьте данные пациента:</b>\n\n' +
    `👤 <b>ФИО:</b> ${escapeHtml(d.patientName || '')}\n` +
    `🎂 <b>Дата рождения:</b> ${escapeHtml(d.patientBirthdate || '')}\n` +
    `📞 <b>Телефон:</b> ${escapeHtml(d.patientPhone || '')}\n` +
    (d.patientNotes ? `📝 <b>Примечание:</b> ${escapeHtml(d.patientNotes)}\n` : '') +
    `📲 <b>Связь DocDoc:</b> ${d.contactConsent ? '✅ Да, хочет' : '❌ Нет'}\n` +
    `🏥 <b>Клиники:</b> ${clinicNames.length > 0 ? clinicNames.join(', ') : 'Любая'}`;
  return text;
}

// Helper: go to clinic selection step
async function goToClinicSelect(ctx: any, session: SessionData, editMessage: boolean) {
  session.registrationStep = 'patient_clinic_select';
  if (!session.tempData!.targetClinicIds) session.tempData!.targetClinicIds = [];

  const { keyboard } = await buildClinicSelectionKeyboard(session.tempData!.targetClinicIds!);
  const msg = '🏥 <b>Выбор клиник</b>\n\n' +
    'Выберите клиники, в которые направить пациента.\n' +
    'Нажмите на клинику для выбора/отмены.\n\n' +
    '💡 Можно выбрать несколько или пропустить (любая клиника):';

  if (editMessage) {
    await ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard });
  } else {
    await ctx.reply(msg, { parse_mode: 'HTML', ...keyboard });
  }
}

// Handle contact consent (wants DocDoc to call)
bot.action('contact_consent_yes', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (isCallbackSpamming(userId)) { await ctx.answerCbQuery(); return; }

  const session = getSession(userId);
  if (!session.tempData) { await ctx.answerCbQuery(); await ctx.editMessageText('❌ Сессия истекла. Начните заново: /patient'); sessions.delete(userId); return; }

  session.tempData.contactConsent = true;
  await ctx.answerCbQuery();
  await goToClinicSelect(ctx, session, true);
});

bot.action('contact_consent_no', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (isCallbackSpamming(userId)) { await ctx.answerCbQuery(); return; }

  const session = getSession(userId);
  if (!session.tempData) { await ctx.answerCbQuery(); await ctx.editMessageText('❌ Сессия истекла. Начните заново: /patient'); sessions.delete(userId); return; }

  session.tempData.contactConsent = false;
  await ctx.answerCbQuery();
  await goToClinicSelect(ctx, session, true);
});

// Handle clinic toggle (multi-select)
bot.action(/^clinic_toggle_(\d+)$/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const session = getSession(userId);
  if (!session.tempData) { await ctx.answerCbQuery(); await ctx.editMessageText('❌ Сессия истекла. Начните заново: /patient'); sessions.delete(userId); return; }

  const clinicId = parseInt(ctx.match[1]);
  if (!session.tempData.targetClinicIds) session.tempData.targetClinicIds = [];

  const idx = session.tempData.targetClinicIds.indexOf(clinicId);
  if (idx >= 0) {
    session.tempData.targetClinicIds.splice(idx, 1);
  } else {
    session.tempData.targetClinicIds.push(clinicId);
  }

  await ctx.answerCbQuery();
  const { keyboard } = await buildClinicSelectionKeyboard(session.tempData.targetClinicIds);

  const msg = '🏥 <b>Выбор клиник</b>\n\n' +
    'Выберите клиники, в которые направить пациента.\n' +
    'Нажмите на клинику для выбора/отмены.\n\n' +
    '💡 Можно выбрать несколько или пропустить (любая клиника):';

  await ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard });
});

// Handle clinic select skip (any clinic)
bot.action('clinic_select_skip', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (isCallbackSpamming(userId)) { await ctx.answerCbQuery(); return; }

  const session = getSession(userId);
  if (!session.tempData) { await ctx.answerCbQuery(); await ctx.editMessageText('❌ Сессия истекла. Начните заново: /patient'); sessions.delete(userId); return; }

  session.tempData.targetClinicIds = [];
  session.registrationStep = 'patient_consent';
  await ctx.answerCbQuery();

  const confirmKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Всё верно', 'patient_consent_yes')],
    [Markup.button.callback('❌ Сделать запись заново', 'patient_redo')]
  ]);

  await ctx.editMessageText(
    buildPatientPreview(session, []),
    { parse_mode: 'HTML', ...confirmKeyboard }
  );
});

// Handle clinic select done (clinics chosen)
bot.action('clinic_select_done', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (isCallbackSpamming(userId)) { await ctx.answerCbQuery(); return; }

  const session = getSession(userId);
  if (!session.tempData || !session.tempData.targetClinicIds?.length) { await ctx.answerCbQuery(); return; }

  session.registrationStep = 'patient_consent';
  await ctx.answerCbQuery();

  // Resolve clinic names
  const db = await getDb();
  let clinicNames: string[] = [];
  if (db) {
    const allClinics = await db.select({ id: schema.clinics.id, name: schema.clinics.name })
      .from(schema.clinics)
      .where(eq(schema.clinics.isActive, "yes"));
    clinicNames = session.tempData.targetClinicIds
      .map(id => allClinics.find(c => c.id === id)?.name)
      .filter(Boolean) as string[];
  }

  const confirmKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Всё верно', 'patient_consent_yes')],
    [Markup.button.callback('❌ Сделать запись заново', 'patient_redo')]
  ]);

  await ctx.editMessageText(
    buildPatientPreview(session, clinicNames),
    { parse_mode: 'HTML', ...confirmKeyboard }
  );
});

// Handle patient consent confirmation
bot.action('patient_consent_yes', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (isCallbackSpamming(userId)) { await ctx.answerCbQuery(); return; }

  const session = getSession(userId);

  // Prevent double-click
  if (session.processing) { await ctx.answerCbQuery('⏳ Обработка...'); return; }
  session.processing = true;

  // Validate session data
  const data = session.tempData;
  if (!data?.agentId || !data?.patientName || !data?.patientBirthdate || !data?.patientPhone) {
    session.processing = false;
    await ctx.answerCbQuery();
    await ctx.editMessageText('❌ Сессия истекла. Начните заново: /patient');
    sessions.delete(userId);
    return;
  }

  await ctx.answerCbQuery('✅ Сохраняю данные...');

  try {
    const db = await getDb();
    if (!db) {
      session.processing = false;
      await ctx.editMessageText('❌ Ошибка подключения к базе данных. Попробуйте позже.');
      return;
    }

    await db.insert(schema.referrals).values({
      agentId: data.agentId,
      patientFullName: data.patientName,
      patientBirthdate: data.patientBirthdate,
      patientPhone: data.patientPhone,
      contactConsent: data.contactConsent ?? null,
      notes: data.patientNotes || null,
      targetClinicIds: data.targetClinicIds?.length ? JSON.stringify(data.targetClinicIds) : null,
      status: 'new'
    });

    // Resolve clinic names for success message
    let clinicLabel = 'Любая';
    if (data.targetClinicIds?.length) {
      const allClinics = await db.select({ id: schema.clinics.id, name: schema.clinics.name })
        .from(schema.clinics)
        .where(eq(schema.clinics.isActive, "yes"));
      const names = data.targetClinicIds
        .map(id => allClinics.find(c => c.id === id)?.name)
        .filter(Boolean);
      if (names.length > 0) clinicLabel = names.join(', ');
    }

    // Clear session before messages (prevents double-submit)
    sessions.delete(userId);

    await ctx.editMessageText(
      '🎉 <b>Пациент успешно отправлен!</b>\n\n' +
      `👤 <b>ФИО:</b> ${escapeHtml(data.patientName)}\n` +
      `🎂 <b>Дата рождения:</b> ${escapeHtml(data.patientBirthdate)}\n` +
      `📞 <b>Телефон:</b> ${escapeHtml(data.patientPhone)}\n` +
      (data.patientNotes ? `📝 <b>Примечание:</b> ${escapeHtml(data.patientNotes)}\n` : '') +
      `📲 <b>Связь DocDoc:</b> ${data.contactConsent ? '✅ Да' : '❌ Нет'}\n` +
      `🏥 <b>Клиники:</b> ${clinicLabel}\n\n` +
      (data.contactConsent
        ? '✅ Наш сервис бесплатно свяжется с пациентом, поможет записаться и проконсультирует\n'
        : '✅ Данные пациента переданы\n') +
      '🔔 Вы получите уведомление о статусе рекомендации\n\n' +
      '📝 Используйте /patient для отправки еще одного пациента',
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    session.processing = false;
    console.error('[Telegram Bot] Patient submission error:', error);
    await ctx.editMessageText(
      '❌ Произошла ошибка при сохранении данных.\n\n' +
      'Пожалуйста, попробуйте позже или свяжитесь с поддержкой.'
    );
  }
});

// Handle patient redo — restart patient submission flow
bot.action('patient_redo', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const session = getSession(userId);
  const agentId = session.tempData?.agentId;

  if (!agentId) {
    await ctx.answerCbQuery();
    await ctx.editMessageText('❌ Сессия истекла. Начните заново: /patient');
    sessions.delete(userId);
    return;
  }

  // Restart patient flow — reset tempData but keep agentId
  session.registrationStep = 'patient_name';
  session.tempData = { agentId };

  await ctx.answerCbQuery();
  await ctx.editMessageText(
    '🔄 <b>Начнём заново</b>\n\n' +
    'Введите полное имя пациента (Фамилия Имя Отчество):\n\n' +
    '💡 Введите "Отмена" для отмены отправки пациента.',
    { parse_mode: 'HTML' }
  );
})

// /cancel command - Отмена текущего действия
bot.command('cancel', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  
  logAction(userId, '/cancel command');
  
  const session = getSession(userId);
  const wasInProgress = session.registrationStep !== undefined;
  
  // Очистка сессии
  sessions.delete(userId);
  
  // Check if agent is registered — show main menu instead of removing keyboard
  try {
    const db = await getDb();
    if (db) {
      const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));
      if (agent?.status === 'active') {
        if (wasInProgress) {
          await ctx.reply('❌ <b>Действие отменено.</b>', { parse_mode: 'HTML', ...mainMenuKeyboard });
        } else {
          await ctx.reply('ℹ️ Нет активных действий для отмены.', mainMenuKeyboard);
        }
        return;
      }
    }
  } catch {}

  if (wasInProgress) {
    await ctx.reply(
      '❌ <b>Действие отменено.</b>\n\n' +
      '🔄 Используйте:\n' +
      '/start - Начать регистрацию\n' +
      '/help - Помощь',
      { parse_mode: 'HTML', ...Markup.removeKeyboard() }
    );
  } else {
    await ctx.reply(
      'ℹ️ Нет активных действий для отмены.\n\n' +
      'Используйте /help для просмотра доступных команд.'
    );
  }
});

// /help command
bot.command('help', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    const db = await getDb();
    if (!db) {
      await ctx.reply('❌ Ошибка подключения к базе данных.');
      return;
    }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

    if (!agent || agent.status !== 'active') {
      await ctx.reply(
        '❓ <b>Помощь - DocPartner Bot</b>\n\n' +
        '<b>📋 Доступные команды:</b>\n' +
        '/start - Начать регистрацию\n' +
        '/cancel - Отменить текущее действие\n' +
        '/status - Проверить статус регистрации\n' +
        '/help - Показать эту справку\n\n' +
        '<b>💬 По вопросам:</b>\n' +
        '📧 Email: info@doc-partner.ru\n' +
        '📱 Telegram: @docpartnerbot\n\n' +
        '<i>После активации вашей заявки вам станут доступны дополнительные функции.</i>',
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.reply(
        '❓ <b>Помощь - DocPartner Bot</b>\n\n' +
        '<b>📋 Доступные команды:</b>\n\n' +
        '<b>Основные:</b>\n' +
        '/menu - Показать главное меню\n' +
        '/patient - Отправить пациента в клинику\n' +
        '/cancel - Отменить текущее действие\n' +
        '/referrals - Мои рекомендации\n' +
        '/stats - Моя статистика\n' +
        '/payments - Мои выплаты\n\n' +
        '<b>Дополнительно:</b>\n' +
        '/knowledge - База знаний (FAQ)\n' +
        '/referral_program - Реферальная программа\n' +
        '/status - Проверить статус\n' +
        '/help - Показать эту справку\n\n' +
        '<b>💡 Как это работает:</b>\n' +
        '1. Используйте /patient для отправки данных пациента\n' +
        '2. Клиника свяжется с пациентом\n' +
        '3. После лечения вы получите вознаграждение\n\n' +
        '<b>💬 По вопросам:</b>\n' +
        '📧 Email: info@doc-partner.ru\n' +
        '📱 Telegram: @docpartnerbot',
        { parse_mode: 'HTML' }
      );
    }
  } catch (error) {
    console.error('[Telegram Bot] Help command error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

// /status command
bot.command('status', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    const db = await getDb();
    if (!db) {
      await ctx.reply('❌ Ошибка подключения к базе данных.');
      return;
    }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString())).limit(1);

    if (!agent) {
      await ctx.reply(
        'Вы еще не зарегистрированы в системе.\n\n' +
        'Используйте /start для начала регистрации.'
      );
      return;
    }

    const statusMap: Record<string, string> = {
      pending: '⏳ На рассмотрении',
      active: '✅ Одобрен',
      rejected: '❌ Отклонен',
      blocked: '🚫 Заблокирован'
    };

    await ctx.reply(
      `<b>Ваш статус:</b> ${statusMap[agent.status] || agent.status}\n\n` +
      `<b>ФИО:</b> ${escapeHtml(agent.fullName || '')}\n` +
      `<b>Email:</b> ${escapeHtml(agent.email || '')}\n` +
      `<b>Роль:</b> ${escapeHtml(agent.role || '')}\n` +
      (agent.specialization ? `<b>Специальность:</b> ${escapeHtml(agent.specialization)}\n` : '') +
      `<b>Город:</b> ${escapeHtml(agent.city || '')}`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('[Telegram Bot] Status check error:', error);
    await ctx.reply('❌ Произошла ошибка при проверке статуса.');
  }
});

// /patient command - submit new patient referral
bot.command('patient', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    const db = await getDb();
    if (!db) {
      await ctx.reply('❌ Ошибка подключения к базе данных.');
      return;
    }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

    if (!agent) {
      await ctx.reply('Вы еще не зарегистрированы. Используйте /start для регистрации.');
      return;
    }

    if (agent.status !== 'active') {
      await ctx.reply('Ваша заявка еще не активирована. После активации вы сможете отправлять пациентов.');
      return;
    }

    // Start patient submission flow
    const session = getSession(userId);
    session.registrationStep = 'patient_name';
    session.tempData = { agentId: agent.id };

    await ctx.reply(
      '🎖️ <b>Отправка пациента</b>\n\n' +
      'Введите полное имя пациента (Фамилия Имя Отчество):\n\n' +
      '💡 Введите "Отмена" для отмены отправки пациента.',
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('[Telegram Bot] Patient command error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

// /referrals command - view list of submitted referrals
bot.command('referrals', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    const db = await getDb();
    if (!db) {
      await ctx.reply('❌ Ошибка подключения к базе данных.');
      return;
    }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

    if (!agent) {
      await ctx.reply('Вы еще не зарегистрированы. Используйте /start для регистрации.');
      return;
    }

    const referrals = await db.select().from(schema.referrals)
      .where(eq(schema.referrals.agentId, agent.id))
      .orderBy(schema.referrals.createdAt);

    if (referrals.length === 0) {
      await ctx.reply(
        '📊 <b>Мои рекомендации</b>\n\n' +
        'У вас пока нет отправленных рекомендаций.\n\n' +
        'Используйте /patient для создания первой рекомендации.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    const statusEmoji: Record<string, string> = {
      new: '🆕', in_progress: '⚙️', contacted: '📞', scheduled: '📅',
      visited: '✅', paid: '💰', duplicate: '🔁', no_answer: '📵', cancelled: '❌'
    };

    const statusNames: Record<string, string> = {
      new: 'Новая', in_progress: 'В работе', contacted: 'Связались',
      scheduled: 'Записан на приём', visited: 'Приём состоялся',
      paid: 'Оплачено', duplicate: 'Дубликат', no_answer: 'Не дозвонились', cancelled: 'Отменена'
    };

    let message = '📊 <b>Мои рекомендации</b>\n\n';

    // Show last 5 referrals
    const displayReferrals = referrals.slice(-5).reverse();

    for (const ref of displayReferrals) {
      const emoji = statusEmoji[ref.status] || '❓';
      const status = statusNames[ref.status] || ref.status;

      // Mask patient name for privacy
      const nameParts = ref.patientFullName.split(' ');
      const maskedName = nameParts.length >= 2
        ? `${nameParts[0]} ${nameParts[1][0]}.`
        : nameParts[0];

      const date = new Date(ref.createdAt).toLocaleDateString('ru-RU');

      message += `${emoji} #${ref.id} - ${maskedName}\n`;
      message += `   Статус: ${status}\n`;
      message += `   Дата: ${date}\n\n`;
    }

    if (referrals.length > 5) {
      message += `<i>Показаны последние 5 из ${referrals.length}</i>\n\n`;
      message += `🔗 <b>Больше информации в личном кабинете:</b>\n`;
      message += `${ENV.appUrl}/dashboard/referrals`;
    } else {
      message += `Всего рекомендаций: ${referrals.length}`;
    }

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[Telegram Bot] Referrals command error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

// /payments command - view earnings and withdrawals
bot.command('payments', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    const db = await getDb();
    if (!db) {
      await ctx.reply('❌ Ошибка подключения к базе данных.');
      return;
    }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

    if (!agent) {
      await ctx.reply('Вы еще не зарегистрированы. Используйте /start для регистрации.');
      return;
    }

    // Get all completed referrals with commission
    const completedReferrals = await db.select().from(schema.referrals)
      .where(eq(schema.referrals.agentId, agent.id));

    const totalEarned = agent.totalEarnings || 0; // in kopecks
    const totalEarnedRub = (totalEarned / 100).toFixed(2);

    const { getAgentAvailableBalance, getAgentCompletedPaymentsSum } = await import('./db');
    const totalPaid = await getAgentCompletedPaymentsSum(agent.id);
    const available = await getAgentAvailableBalance(agent.id);
    const availableRub = (available / 100).toFixed(2);

    let message = '💰 <b>Мои выплаты</b>\n\n';
    message += `💵 Всего заработано: ${totalEarnedRub} ₽\n`;
    message += `✅ Выплачено: ${(totalPaid / 100).toFixed(2)} ₽\n`;
    message += `💸 Доступно к выплате: ${availableRub} ₽\n\n`;

    if (available >= 100000) { // 1000 rubles in kopecks
      message += '✅ Вы можете запросить выплату!\n';
      message += 'Свяжитесь с администратором для оформления.';
    } else {
      const needed = ((100000 - available) / 100).toFixed(2);
      message += `⏳ Минимальная сумма для выплаты: 1 000 ₽\n`;
      message += `Осталось заработать: ${needed} ₽`;
    }

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[Telegram Bot] Payments command error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

// /stats command
// /referral_program command - show referral link and stats
bot.command('referral_program', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    const db = await getDb();
    if (!db) {
      await ctx.reply('❌ Ошибка подключения к базе данных.');
      return;
    }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

    if (!agent) {
      await ctx.reply('Вы еще не зарегистрированы. Используйте /start для регистрации.');
      return;
    }

    // Count referred agents
    const referredAgents = await db.select().from(agents)
      .where(eq(agents.referredBy, agent.id));

    const referralCount = referredAgents.length;
    const bonusPoints = agent.bonusPoints || 0;

    const referralLink = `https://t.me/docpartnerbot?start=ref_${agent.id}`;
      const webReferralLink = `https://doc-partner.ru/register?ref=${agent.id}`;

    // Get paid referral count for bonus unlock progress
    const { getAgentPaidReferralCount } = await import('./db');
    const paidCount = await getAgentPaidReferralCount(agent.id);
    const bonusRub = (bonusPoints / 100).toLocaleString("ru-RU");
    const bonusUnlocked = paidCount >= 10;

    let message = '🎁 <b>Реферальная программа</b>\n\n';
    message += '📢 Приглашайте коллег и зарабатывайте!\n\n';
    message += `🔗 <b>Ваша реферальная ссылка:</b>\n📱 Telegram: <code>${referralLink}</code>\n🌐 Веб: <code>${webReferralLink}</code>\n\n`;
    message += `👥 Приглашено агентов: ${referralCount}\n`;
    message += `💰 Бонус за рефералов: ${bonusRub} ₽`;
    if (bonusPoints > 0 && !bonusUnlocked) {
      message += ` (🔒 заблокирован)\n`;
      message += `📊 Прогресс разблокировки: ${paidCount}/10 оплаченных пациентов\n`;
    } else if (bonusPoints > 0 && bonusUnlocked) {
      message += ` (✅ доступен)\n`;
    } else {
      message += `\n`;
    }
    message += '\n<b>Как это работает:</b>\n';
    message += '• Поделитесь ссылкой с коллегами\n';
    message += '• За каждого зарегистрированного агента — 1 000 ₽\n';
    message += '• Бонус разблокируется после 10 ваших оплаченных пациентов\n';
    message += '• После разблокировки бонус доступен для вывода';

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[Telegram Bot] Referral program command error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

// /knowledge command - FAQ with inline keyboard
bot.command('knowledge', async (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🛡️ Гарантии выплат', 'kb_guarantees')],
    [Markup.button.callback('🔒 Прозрачность выплат', 'kb_security')],
    [Markup.button.callback('📅 Бесплатная запись', 'kb_booking')],
    [Markup.button.callback('📝 Подписание документов', 'kb_documents')],
    [Markup.button.callback('📈 Как стать самозанятым', 'kb_selfemployed')],
    [Markup.button.callback('🏥 Клиники-партнеры', 'kb_clinics')],
  ]);

  await ctx.reply(
    '📚 <b>База знаний DocPartner</b>\n\n' +
    'Выберите интересующую тему:',
    { parse_mode: 'HTML', ...keyboard }
  );
});

// Handle main menu callbacks from inline keyboard
bot.action('cmd_patient', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();
  
  try {
    const db = await getDb();
    if (!db) {
      await ctx.reply('❌ Ошибка подключения к базе данных.');
      return;
    }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

    if (!agent) {
      await ctx.reply('Вы еще не зарегистрированы. Используйте /start для регистрации.');
      return;
    }

    if (agent.status !== 'active') {
      await ctx.reply('Ваша заявка еще не активирована. После активации вы сможете отправлять пациентов.');
      return;
    }

    // Start patient submission flow
    const session = getSession(userId);
    session.registrationStep = 'patient_name';
    session.tempData = { agentId: agent.id };

    await ctx.reply(
      '🎖️ <b>Отправка пациента</b>\n\n' +
      'Введите полное имя пациента (Фамилия Имя Отчество):\n\n' +
      '💡 Введите "Отмена" для отмены отправки пациента.',
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('[Telegram Bot] cmd_patient callback error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

bot.action('cmd_referrals', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();
  
  try {
    const db = await getDb();
    if (!db) {
      await ctx.reply('❌ Ошибка подключения к базе данных.');
      return;
    }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

    if (!agent) {
      await ctx.reply('Вы еще не зарегистрированы. Используйте /start для регистрации.');
      return;
    }

    const referrals = await db.select().from(schema.referrals)
      .where(eq(schema.referrals.agentId, agent.id));

    if (referrals.length === 0) {
      await ctx.reply(
        '📊 <b>Мои рекомендации</b>\n\n' +
        'У вас пока нет отправленных рекомендаций.\n\n' +
        'Используйте /patient для создания первой рекомендации.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    const emojiMap: Record<string, string> = {
      new: '🆕', in_progress: '⚙️', contacted: '📞', scheduled: '📅',
      visited: '✅', paid: '💰', duplicate: '🔁', no_answer: '📵', cancelled: '❌'
    };
    const nameMap: Record<string, string> = {
      new: 'Новая', in_progress: 'В работе', contacted: 'Связались',
      scheduled: 'Записан', visited: 'Приём состоялся',
      paid: 'Оплачено', duplicate: 'Дубликат', no_answer: 'Не дозвонились', cancelled: 'Отменена'
    };
    let message = '📊 <b>Мои рекомендации</b>\n\n';
    referrals.slice(0, 5).forEach((ref) => {
      const emoji = emojiMap[ref.status] || '📋';
      message += `${emoji} <b>${escapeHtml(ref.patientFullName)}</b>\n`;
      message += `   Статус: ${nameMap[ref.status] || ref.status}\n\n`;
    });

    if (referrals.length > 5) {
      message += `<i>Показаны последние 5 из ${referrals.length}</i>\n\n`;
      message += `🔗 <b>Больше информации в личном кабинете:</b>\n`;
      message += `${ENV.appUrl}/dashboard/referrals`;
    }

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[Telegram Bot] Referrals callback error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

bot.action('cmd_stats', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();
  
  try {
    const db = await getDb();
    if (!db) {
      await ctx.reply('❌ Ошибка подключения к базе данных.');
      return;
    }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

    if (!agent) {
      await ctx.reply('Вы еще не зарегистрированы. Используйте /start');
      return;
    }

    if (agent.status !== 'active') {
      await ctx.reply('Ваша заявка еще не активирована. Статистика будет доступна после активации.');
      return;
    }

    const { getAgentCompletedPaymentsSum, getAgentReferralCount } = await import('./db');
    const [paidOutSum, referralCount] = await Promise.all([
      getAgentCompletedPaymentsSum(agent.id),
      getAgentReferralCount(agent.id),
    ]);
    const earnedRub = ((agent.totalEarnings || 0) / 100).toLocaleString('ru-RU');
    const paidOutRub = (paidOutSum / 100).toLocaleString('ru-RU');
    const bonusRub = ((agent.bonusPoints || 0) / 100).toLocaleString('ru-RU');
    const referralLink = `https://t.me/docpartnerbot?start=ref_${agent.id}`;
    const webReferralLink = `https://doc-partner.ru/register?ref=${agent.id}`;

    let message = '📊 <b>Моя статистика</b>\n\n';
    message += `👥 Отправлено пациентов: <b>${referralCount}</b>\n`;
    message += `💰 Заработано: <b>${earnedRub} ₽</b>\n`;
    message += `✅ Выплачено: <b>${paidOutRub} ₽</b>\n`;
    if ((agent.bonusPoints || 0) > 0) {
      message += `🎁 Бонусные баллы: <b>${bonusRub} ₽</b>\n`;
    }
    message += `\n🔗 <b>Ваша реферальная ссылка:</b>\n📱 Telegram: <code>${referralLink}</code>\n🌐 Веб: <code>${webReferralLink}</code>\n`;
    message += '📢 За каждого приглашённого агента — <b>1 000 ₽</b> бонус\n\n';
    message += '📈 <b>Как заработать больше:</b>\n';
    message += '• Отправляйте пациентов через /patient\n';
    message += '• Приглашайте коллег по реферальной ссылке\n';
    message += '• Бонус разблокируется после 10 оплаченных пациентов';

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[Telegram Bot] Stats callback error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

bot.action('cmd_knowledge', async (ctx) => {
  await ctx.answerCbQuery();
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🛡️ Гарантии выплат', 'kb_guarantees')],
    [Markup.button.callback('🔒 Прозрачность выплат', 'kb_security')],
    [Markup.button.callback('📅 Бесплатная запись', 'kb_booking')],
    [Markup.button.callback('📝 Подписание документов', 'kb_documents')],
    [Markup.button.callback('📈 Как стать самозанятым', 'kb_selfemployed')],
    [Markup.button.callback('🏥 Клиники-партнеры', 'kb_clinics')]
  ]);

  await ctx.reply(
    '📚 <b>База знаний DocPartner</b>\n\n' +
    'Выберите интересующий вопрос:',
    { parse_mode: 'HTML', ...keyboard }
  );
});

bot.action('cmd_referral_program', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();
  
  try {
    const db = await getDb();
    if (!db) {
      await ctx.reply('❌ Ошибка подключения к базе данных.');
      return;
    }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

    if (!agent) {
      await ctx.reply('Вы еще не зарегистрированы. Используйте /start');
      return;
    }

    const referralLink = `https://t.me/docpartnerbot?start=ref_${agent.id}`;
      const webReferralLink = `https://doc-partner.ru/register?ref=${agent.id}`;
    const bonusPoints = agent.bonusPoints || 0;

    // Count referred agents
    const referredAgents = await db.select().from(agents)
      .where(eq(agents.referredBy, agent.id));
    const referredCount = referredAgents.length;

    // Get paid referral count for bonus unlock progress
    const { getAgentPaidReferralCount } = await import('./db');
    const paidCount = await getAgentPaidReferralCount(agent.id);
    const bonusRub = (bonusPoints / 100).toLocaleString("ru-RU");
    const bonusUnlocked = paidCount >= 10;

    let message = '👥 <b>Реферальная программа</b>\n\n';
    message += '🎁 Приглашайте коллег и зарабатывайте!\n\n';
    message += `🔗 <b>Ваша реферальная ссылка:</b>\n📱 Telegram: <code>${referralLink}</code>\n🌐 Веб: <code>${webReferralLink}</code>\n\n`;
    message += `📈 <b>Ваша статистика:</b>\n`;
    message += `• Приглашено агентов: ${referredCount}\n`;
    message += `• Бонус за рефералов: ${bonusRub} ₽`;
    if (bonusPoints > 0 && !bonusUnlocked) {
      message += ` (🔒 заблокирован)\n`;
      message += `• Прогресс: ${paidCount}/10 оплаченных пациентов\n`;
    } else if (bonusPoints > 0 && bonusUnlocked) {
      message += ` (✅ доступен для вывода)\n`;
    } else {
      message += `\n`;
    }
    message += '\n💡 За каждого приглашённого — 1 000 ₽. Разблокировка после 10 оплаченных пациентов.';

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[Telegram Bot] Referral program callback error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

// ===============================
// PAYOUT FLOW CALLBACKS
// ===============================

// Callback from inline menu "Запросить выплату" — redirect to web
bot.action('cmd_request_payout', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();

  try {
    const db = await getDb();
    if (!db) { await ctx.reply('❌ Ошибка подключения к базе данных.'); return; }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));
    if (!agent) { await ctx.reply('Вы еще не зарегистрированы. Используйте /start'); return; }

    const { getAgentAvailableBalance } = await import('./db');
    const availableBalanceKop = await getAgentAvailableBalance(agent.id);
    const availableBalance = availableBalanceKop / 100;

    let message = '💰 <b>Запрос выплаты</b>\n\n';
    message += `💵 Доступно к выводу: <b>${availableBalance.toLocaleString('ru-RU')} ₽</b>\n\n`;
    message += '📱 Заявка на вывод средств доступна только в личном кабинете:\n\n';
    message += '🔗 <b>https://doc-partner.ru/payments</b>\n\n';
    message += 'Войдите с тем же email, который указан при регистрации.';

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[Telegram Bot] Request payout callback error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

// Self-employment answer callbacks
bot.action('payout_se_yes', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();

  const session = getSession(userId);
  if (!session.tempData) session.tempData = {};
  session.tempData.payoutSelfEmployed = 'yes';
  session.registrationStep = 'payout_method';

  await ctx.reply(
    '✅ Статус самозанятого сохранён!\n\n' +
    '3️⃣ Как вы хотите <b>получать выплаты</b>?',
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('💳 На карту', 'payout_method_card')],
        [Markup.button.callback('📱 По СБП (телефон)', 'payout_method_sbp')],
      ])
    }
  );
});

bot.action('payout_se_no', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();

  const session = getSession(userId);
  if (!session.tempData) session.tempData = {};
  session.tempData.payoutSelfEmployed = 'no';
  session.registrationStep = 'payout_method';

  const { getCommissionRates: getRates3 } = await import('./db');
  const rates3 = await getRates3();
  const seHint = rates3.premiumRate
    ? `(${rates3.premiumRate}% вместо ${rates3.baseRate}%)`
    : '';

  await ctx.reply(
    '✅ Понятно!\n\n' +
    `💡 Рекомендуем оформить самозанятость для получения повышенного вознаграждения ${seHint}.\n\n` +
    '3️⃣ Как вы хотите <b>получать выплаты</b>?',
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('💳 На карту', 'payout_method_card')],
        [Markup.button.callback('📱 По СБП (телефон)', 'payout_method_sbp')],
      ])
    }
  );
});

// Payout method selection callbacks
bot.action('payout_method_card', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();

  const session = getSession(userId);
  if (!session.tempData) session.tempData = {};
  session.tempData.payoutMethod = 'card';
  session.registrationStep = 'payout_card_number';

  await ctx.reply(
    '💳 <b>Выплата на карту</b>\n\n' +
    '4️⃣ Введите <b>номер карты МИР</b> (16 цифр):\n\n' +
    '⚠️ Принимаются только карты МИР (начинаются с 2200-2204)',
    { parse_mode: 'HTML' }
  );
});

bot.action('payout_method_sbp', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();

  const session = getSession(userId);
  if (!session.tempData) session.tempData = {};
  session.tempData.payoutMethod = 'sbp';
  session.registrationStep = undefined;

  // Get agent's phone to show
  try {
    const db = await getDb();
    if (!db) { await ctx.reply('❌ Ошибка подключения к базе данных.'); return; }
    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));
    const phone = agent?.phone || 'не указан';

    const data = session.tempData;
    const seLabel = data.payoutSelfEmployed === 'yes' ? 'Да' : 'Нет';

    await ctx.reply(
      '📋 <b>Проверьте ваши реквизиты:</b>\n\n' +
      `• ИНН: <code>${data.payoutInn}</code>\n` +
      `• Самозанятый: ${seLabel}\n` +
      `• Способ: 📱 СБП\n` +
      `• Телефон: <code>${phone}</code>\n\n` +
      'Всё верно?',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Подтвердить и сохранить', 'payout_confirm_requisites')],
          [Markup.button.callback('✏️ Заполнить заново', 'payout_edit_requisites')],
          [Markup.button.callback('❌ Отмена', 'payout_cancel')]
        ])
      }
    );
  } catch (error) {
    console.error('[Telegram Bot] SBP method error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

// Start filling requisites (from payout flow)
bot.action('payout_fill_requisites', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();

  const session = getSession(userId);
  session.registrationStep = 'payout_inn';
  if (!session.tempData) session.tempData = {};

  await ctx.reply(
    '📝 <b>Заполнение реквизитов</b>\n\n' +
    '1️⃣ Введите ваш <b>ИНН</b> (12 цифр):',
    { parse_mode: 'HTML' }
  );
});

// Cancel payout
bot.action('payout_cancel', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();

  const session = getSession(userId);
  session.registrationStep = undefined;
  session.tempData = {};

  await ctx.reply('❌ Запрос выплаты отменён.', mainMenuKeyboard);
});

// Confirm payout request — create payment + show self-employment notice
bot.action('payout_confirm_request', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (isCallbackSpamming(userId)) { await ctx.answerCbQuery(); return; }
  await ctx.answerCbQuery();

  try {
    const db = await getDb();
    if (!db) { await ctx.reply('❌ Ошибка подключения к базе данных.'); return; }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));
    if (!agent) { await ctx.reply('Вы еще не зарегистрированы.'); return; }

    // Check requisites based on payout method
    const payoutMethod = agent.payoutMethod || 'card';
    const hasRequisites = agent.inn && (
      (payoutMethod === 'card' && agent.cardNumber) ||
      (payoutMethod === 'sbp' && agent.phone) ||
      (payoutMethod === 'bank_account' && agent.bankAccount && agent.bankName && agent.bankBik)
    );
    if (!hasRequisites) {
      await ctx.reply('⚠️ Заполните все реквизиты перед запросом выплаты.');
      return;
    }

    // Use transactional payout with locking to prevent race conditions
    const { createPaymentWithLock, getAgentAvailableBalance } = await import('./db');
    const availableBalanceKop = await getAgentAvailableBalance(agent.id);

    if (availableBalanceKop < 100000) { // 1000 руб в копейках
      await ctx.reply('⚠️ Недостаточно средств для вывода.');
      return;
    }

    // Calculate tax breakdown based on self-employment status
    const isSelfEmployed = agent.isSelfEmployed === "yes";
    const breakdown = calculateWithdrawalTax(availableBalanceKop, isSelfEmployed);

    try {
      await createPaymentWithLock(agent.id, {
        amount: breakdown.grossAmount,
        grossAmount: breakdown.grossAmount,
        netAmount: breakdown.netAmount,
        taxAmount: breakdown.taxAmount,
        socialContributions: breakdown.socialContributions,
        isSelfEmployedSnapshot: isSelfEmployed ? "yes" : "no",
      });
    } catch (err: any) {
      const errMsg = (err as Error).message || '';
      if (errMsg.includes('Недостаточно средств')) {
        await ctx.reply('⚠️ Недостаточно средств для вывода.');
        return;
      }
      if (errMsg.includes('необработанная заявка')) {
        await ctx.reply(
          '⚠️ <b>У вас уже есть необработанная заявка на выплату.</b>\n\n' +
          'Дождитесь её обработки перед созданием новой.',
          { parse_mode: 'HTML' }
        );
        return;
      }
      throw err;
    }

    const grossRub = (breakdown.grossAmount / 100).toLocaleString('ru-RU');
    const netRub = (breakdown.netAmount / 100).toLocaleString('ru-RU');

    // Success message with tax breakdown
    let message = '✅ <b>Заявка на выплату создана!</b>\n\n';
    message += `💵 Сумма: <b>${grossRub} ₽</b>\n`;
    if (!isSelfEmployed && breakdown.taxAmount > 0) {
      message += `📊 НДФЛ 13%: ${(breakdown.taxAmount / 100).toLocaleString('ru-RU')} ₽\n`;
      message += `📊 Соц. отчисления 30%: ${(breakdown.socialContributions / 100).toLocaleString('ru-RU')} ₽\n`;
      message += `💰 К выплате: <b>${netRub} ₽</b>\n`;
    }
    message += '\n📝 <b>Процесс выплаты:</b>\n';
    message += '1️⃣ Мы проверим вашу заявку\n';
    message += '2️⃣ Выплата через Jump.Finance\n';
    if (!isSelfEmployed) {
      message += '3️⃣ Подпишите акт через Jump.Finance\n';
    } else {
      message += '3️⃣ Чек формируется автоматически\n';
    }
    message += '4️⃣ Деньги поступят на карту\n\n';

    if (!isSelfEmployed) {
      message += '💡 <b>Рекомендуем оформить самозанятость</b> для получения максимального вознаграждения (без удержаний НДФЛ и взносов).\n';
    }

    // Notify admin
    try {
      const { notifyAdminsNewPaymentRequest } = await import('./telegram-notifications');
      await notifyAdminsNewPaymentRequest(agent, availableBalanceKop);
    } catch (notifyErr) {
      console.error('[Telegram Bot] Failed to notify admins about payment:', notifyErr);
    }

    await ctx.reply(message, { parse_mode: 'HTML', ...mainMenuKeyboard });
  } catch (error) {
    console.error('[Telegram Bot] Payout confirm error:', error);
    await ctx.reply('❌ Произошла ошибка при создании заявки.');
  }
});

// Confirm requisites after filling — save and return to payout flow
bot.action('payout_confirm_requisites', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (isCallbackSpamming(userId)) { await ctx.answerCbQuery(); return; }
  await ctx.answerCbQuery();

  try {
    const session = getSession(userId);
    const data = session.tempData;
    if (!data?.payoutInn) {
      await ctx.reply('❌ Данные реквизитов утеряны. Попробуйте снова: нажмите "Запросить выплату".');
      return;
    }

    // Validate based on payout method
    const method = data.payoutMethod || 'card';
    if (method === 'card' && !data.payoutCardNumber) {
      await ctx.reply('❌ Не указан номер карты. Попробуйте снова.');
      return;
    }

    const db = await getDb();
    if (!db) { await ctx.reply('❌ Ошибка подключения к базе данных.'); return; }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));
    if (!agent) { await ctx.reply('Вы еще не зарегистрированы.'); return; }

    // Save requisites to agent profile
    const updateData: Record<string, any> = {
      inn: data.payoutInn,
      isSelfEmployed: data.payoutSelfEmployed || 'unknown',
      payoutMethod: method,
    };
    if (method === 'card' && data.payoutCardNumber) {
      updateData.cardNumber = data.payoutCardNumber;
    }
    // Keep old bank fields if they were previously set (for bank_account method)
    if (data.payoutBankName) updateData.bankName = data.payoutBankName;
    if (data.payoutBankAccount) updateData.bankAccount = data.payoutBankAccount;
    if (data.payoutBankBik) updateData.bankBik = data.payoutBankBik;

    await db.update(agents).set(updateData).where(eq(agents.id, agent.id));

    // Clear temp data
    session.registrationStep = undefined;
    session.tempData = {};

    const { getAgentAvailableBalance: getAvailBal } = await import('./db');
    const availableBalance = (await getAvailBal(agent.id)) / 100;
    const seLabel = data.payoutSelfEmployed === 'yes' ? 'Да' : 'Нет';
    let methodInfo = '';
    if (method === 'card') {
      methodInfo = `• Способ: 💳 Карта (**** ${data.payoutCardNumber?.slice(-4)})`;
    } else {
      methodInfo = `• Способ: 📱 СБП (${agent.phone || 'телефон из профиля'})`;
    }

    await ctx.reply(
      '✅ <b>Реквизиты сохранены!</b>\n\n' +
      '📋 <b>Ваши реквизиты:</b>\n' +
      `• ИНН: <code>${data.payoutInn}</code>\n` +
      `• Самозанятый: ${seLabel}\n` +
      `${methodInfo}\n\n` +
      `💵 Доступно к выводу: <b>${availableBalance.toLocaleString('ru-RU')} ₽</b>\n\n` +
      'Теперь вы можете запросить выплату:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Запросить выплату', 'payout_confirm_request')],
          [Markup.button.callback('❌ Отмена', 'payout_cancel')]
        ])
      }
    );
  } catch (error) {
    console.error('[Telegram Bot] Confirm requisites error:', error);
    await ctx.reply('❌ Произошла ошибка при сохранении реквизитов.');
  }
});

// Edit requisites — restart filling
bot.action('payout_edit_requisites', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();

  const session = getSession(userId);
  session.registrationStep = 'payout_inn';
  if (!session.tempData) session.tempData = {};

  await ctx.reply(
    '📝 <b>Корректировка реквизитов</b>\n\n' +
    '1️⃣ Введите ваш <b>ИНН</b> (12 цифр):',
    { parse_mode: 'HTML' }
  );
});

bot.action('cmd_requisites', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();

  try {
    const db = await getDb();
    if (!db) {
      await ctx.reply('❌ Ошибка подключения к базе данных.');
      return;
    }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

    if (!agent) {
      await ctx.reply('Вы еще не зарегистрированы. Используйте /start');
      return;
    }

    let message = '💳 <b>Мои реквизиты</b>\n\n';
    message += `👤 <b>ФИО:</b> ${escapeHtml(agent.fullName || '')}\n`;
    message += `📧 <b>Email:</b> ${escapeHtml(agent.email || '')}\n`;
    message += `📞 <b>Телефон:</b> ${escapeHtml(agent.phone || '')}\n`;
    message += `🏙️ <b>Город:</b> ${escapeHtml(agent.city || '')}\n\n`;

    message += '<b>💳 Платёжные реквизиты:</b>\n';
    message += agent.inn ? `• ИНН: <code>${agent.inn}</code>\n` : '• ИНН: <i>не указан</i>\n';

    const pm4 = agent.payoutMethod || 'card';
    if (pm4 === 'card') {
      message += agent.cardNumber
        ? `• Способ: 💳 Карта (**** ${agent.cardNumber.slice(-4)})\n`
        : '• Способ: 💳 Карта (<i>не указана</i>)\n';
    } else if (pm4 === 'sbp') {
      message += `• Способ: 📱 СБП (${agent.phone || 'не указан'})\n`;
    } else {
      message += agent.bankName ? `• Банк: ${escapeHtml(agent.bankName)}\n` : '• Банк: <i>не указан</i>\n';
      message += agent.bankAccount ? `• Счёт: <code>${agent.bankAccount}</code>\n` : '• Счёт: <i>не указан</i>\n';
      message += agent.bankBik ? `• БИК: <code>${agent.bankBik}</code>\n` : '• БИК: <i>не указан</i>\n';
    }

    message += '\n';
    const selfEmployedStatus2 = agent.isSelfEmployed === 'yes' ? '✅ Самозанятый' :
      agent.isSelfEmployed === 'no' ? '❌ Не самозанятый' : '❓ Не указано';
    message += `<b>Статус:</b> ${selfEmployedStatus2}\n\n`;

    if (agent.isSelfEmployed !== 'yes') {
      const { getCommissionRates: getRates4 } = await import('./db');
      const rates4 = await getRates4();
      const seHint4 = rates4.premiumRate
        ? `(${rates4.premiumRate}% вместо ${rates4.baseRate}%)`
        : '';
      message += `💡 Рекомендуем оформить самозанятость для максимального вознаграждения ${seHint4}.\n\n`;
    }

    message += `🔗 Изменить реквизиты: ${ENV.appUrl}/dashboard/profile`;

    const hasAllRequisites = agent.inn && (
      (pm4 === 'card' && agent.cardNumber) ||
      (pm4 === 'sbp' && agent.phone) ||
      (pm4 === 'bank_account' && agent.bankAccount && agent.bankName && agent.bankBik)
    );
    const buttons = [];
    if (!hasAllRequisites) {
      buttons.push([Markup.button.callback('📝 Заполнить реквизиты', 'payout_fill_requisites')]);
    } else {
      buttons.push([Markup.button.callback('✏️ Скорректировать реквизиты', 'payout_fill_requisites')]);
    }

    await ctx.reply(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (error) {
    console.error('[Telegram Bot] Requisites callback error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

bot.action('cmd_about', async (ctx) => {
  await ctx.answerCbQuery();

  const { getCommissionRates: getRatesAbout } = await import('./db');
  const ratesAbout = await getRatesAbout();
  const rateInfoAbout = ratesAbout.premiumRate
    ? `• Вознаграждение: от ${ratesAbout.baseRate}% от суммы лечения\n• ${ratesAbout.premiumRate}% при объёме >${(ratesAbout.premiumThresholdRub || 0).toLocaleString('ru-RU')} ₽/мес\n`
    : `• Вознаграждение: ${ratesAbout.baseRate}% от суммы лечения\n`;

  await ctx.reply(
    'ℹ️ <b>О программе DocPartner</b>\n\n' +
    'DocPartner — это B2B-платформа агентских рекомендаций в сфере здравоохранения.\n\n' +
    '<b>🎯 Наша миссия:</b>\n' +
    'Связывать врачей-агентов с проверенными клиниками для направления пациентов на платное лечение.\n\n' +
    '<b>💰 Условия:</b>\n' +
    rateInfoAbout +
    '• Минимальная сумма вывода: 1 000 ₽\n' +
    '• Выплаты: 3-5 рабочих дней\n\n' +
    '<b>🏥 Партнеры:</b>\n' +
    '8 проверенных клиник в Москве, Санкт-Петербурге, Казани и Уфе\n\n' +
    '<b>🔒 Безопасность:</b>\n' +
    '• Все договоры оформляются официально\n' +
    '• Персональные данные защищены согласно 152-ФЗ\n' +
    '• Многоуровневая система проверок\n\n' +
    '🌐 Сайт: ' + ENV.appUrl + '\n' +
    '📧 Email: info@doc-partner.ru',
    { parse_mode: 'HTML' }
  );
});

bot.action('cmd_payments', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCbQuery();
  
  try {
    const db = await getDb();
    if (!db) {
      await ctx.reply('❌ Ошибка подключения к базе данных.');
      return;
    }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

    if (!agent) {
      await ctx.reply('Вы еще не зарегистрированы. Используйте /start');
      return;
    }

    const agentPayments = await db.select().from(schema.payments)
      .where(eq(schema.payments.agentId, agent.id));

    const { getAgentAvailableBalance: getAvailBalance } = await import('./db');
    const availBalKop = await getAvailBalance(agent.id);
    const availBalRub = (availBalKop / 100).toLocaleString('ru-RU');

    if (agentPayments.length === 0) {
      await ctx.reply(
        '💰 <b>Мои выплаты</b>\n\n' +
        'У вас пока нет выплат.\n\n' +
        `💵 Доступно к выводу: <b>${availBalRub} ₽</b>\n\n` +
        '💡 Минимальная сумма вывода: 1 000 ₽',
        { parse_mode: 'HTML' }
      );
      return;
    }

    let message = '💰 <b>Мои выплаты</b>\n\n';
    agentPayments.slice(0, 5).forEach((payment) => {
      const statusEmoji = payment.status === 'completed' ? '✅' : payment.status === 'pending' ? '⏳' : '🔄';
      message += `${statusEmoji} <b>${(payment.amount / 100).toLocaleString('ru-RU')} ₽</b>\n`;
      message += `   Статус: ${payment.status}\n\n`;
    });

    message += `\n💵 Доступно к выводу: <b>${availBalRub} ₽</b>`;

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[Telegram Bot] Payments callback error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

// Handle knowledge base callbacks
bot.action(/^kb_/, async (ctx) => {
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
  console.log('[Telegram Bot] Knowledge base callback received:', callbackData);

  // Load rates from config for dynamic text
  const { getCommissionRates: getKbRates } = await import('./db');
  const kbRates = await getKbRates();
  const kbRateText = kbRates.premiumRate
    ? `от ${kbRates.baseRate}% от суммы лечения, ${kbRates.premiumRate}% при объёме >${(kbRates.premiumThresholdRub || 0).toLocaleString('ru-RU')} ₽/месяц`
    : `${kbRates.baseRate}% от суммы лечения`;

  const answers: Record<string, string> = {
    kb_guarantees:
      '🛡️ <b>Гарантии выплат</b>\n\n' +
      'DocPartner гарантирует выплату вознаграждения за каждого успешно направленного пациента. Выплата производится после подтверждения клиникой факта оказания услуг и получения оплаты от пациента.\n\n' +
      '✅ <b>Прозрачность</b>\nВы видите статус каждой рекомендации в реальном времени через бот или личный кабинет\n\n' +
      `💵 <b>Ставка</b>\n${kbRateText}\n\n` +
      '⏱️ <b>Быстрые выплаты</b>\nВыплата в течение 3-5 рабочих дней после запроса на выплату\n\n' +
      '📝 <b>Легальность</b>\nВсе выплаты оформляются официально с договором и документами\n\n' +
      '<b>Условия выплаты:</b>\n' +
      '• Пациент должен пройти лечение в клинике-партнере\n' +
      '• Клиника подтверждает факт оказания услуг\n' +
      '• Пациент до этого не являлся клиентом клиники\n' +
      '• Минимальная сумма для вывода: 1000 ₽\n' +
      '• Для вывода бонусных баллов: минимум 10 собственных рекомендаций',
    kb_security:
      '🔒 <b>Прозрачность выплат</b>\n\n' +
      'Мы отправляем данные пациентов напрямую в клиники-партнеры. Если пациент посетит клинику и оплатит услуги — мы выплатим вам комиссию.\n\n' +
      'Как это работает:\n\n' +
      '1️⃣ <b>Верификация агента</b>\n' +
      'Проверяем ФИО, email, телефон и профессию. Для самозанятых — ИНН через сайт ФНС.\n\n' +
      '2️⃣ <b>Звонок пациенту</b>\n' +
      'Наш координатор связывается с пациентом для подтверждения данных и уточнения потребностей.\n\n' +
      '3️⃣ <b>Сверка с клиникой</b>\n' +
      'Передаём данные в клинику-партнер. Клиника назначает консультацию.\n\n' +
      '4️⃣ <b>Подтверждение услуг</b>\n' +
      'После лечения клиника подтверждает факт и сумму. Только после этого начисляется вознаграждение.',
    kb_booking:
      '📅 <b>Бесплатная запись пациентов</b>\n\n' +
      'Мы берем на себя всю работу по записи пациента. Вам не нужно самостоятельно связываться с клиникой.\n\n' +
      '📞 <b>Быстрый контакт</b>\n' +
      'Связываемся с пациентом в течение 2 часов\n\n' +
      '👥 <b>Подбор клиники</b>\n' +
      'Помогаем выбрать оптимальную клинику\n\n' +
      '📅 <b>Запись на прием</b>\n' +
      'Организуем запись на удобное время\n\n' +
      '<b>Что получает пациент:</b>\n' +
      '✅ Бесплатную консультацию\n' +
      '✅ Приоритетную запись без очередей\n' +
      '✅ Сопровождение на всех этапах\n' +
      '✅ Гарантию качества',
    kb_documents:
      '📝 <b>Документы и выплаты</b>\n\n' +
      'Выплаты и подписание документов осуществляются через нашего партнёра <b>Jump.Finance</b> (юридическая сила согласно 63-ФЗ).\n\n' +
      '<b>📋 Договор оферты:</b>\n' +
      `При регистрации вы соглашаетесь с договором оферты, который размещён по ссылке: <a href="${ENV.appUrl}/oferta">doc-partner.ru/oferta</a>\n\n` +
      '<b>💰 При выводе средств:</b>\n\n' +
      '👤 <b>Физическое лицо:</b>\n' +
      '• Вы подписываете Акт оказанных услуг через Jump.Finance\n' +
      '• После подписания получаете выплату\n\n' +
      '📱 <b>Самозанятый:</b>\n' +
      '• Вы получаете поручение на оказание услуг с суммой выплаты через Jump.Finance\n' +
      '• Получаете оплату на карту\n' +
      '• Чек формируется автоматически — он является фактом оказания услуг\n' +
      '• Отдельно подписывать акт <b>не нужно</b>\n\n' +
      '<b>Преимущества:</b>\n' +
      '✅ Юридическая сила (63-ФЗ)\n' +
      '✅ Быстрая выплата через Jump.Finance\n' +
      '✅ Автоматическое формирование чеков для самозанятых\n' +
      '✅ Электронное подписание за 1 минуту',
    kb_selfemployed:
      '📈 <b>Как стать самозанятым</b>\n\n' +
      'Рекомендуем оформить самозанятость для получения полной суммы вознаграждения.\n\n' +
      '<b>Сравнение:</b>\n' +
      `💚 Самозанятый: ${kbRates.baseRate}% от стоимости лечения (налог 6% от выплаты платите сами)\n` +
      `💛 Не самозанятый: ~${Math.round(kbRates.baseRate * 0.57)}% (уже за вычетом НДФЛ 13% и соц. отчислений 30%)\n` +
      (kbRates.premiumRate ? `💜 Бонус >${(kbRates.premiumThresholdRub || 0).toLocaleString('ru-RU')} ₽/мес: ${kbRates.premiumRate}%\n\n` : '\n') +
      '<b>Как зарегистрироваться:</b>\n' +
      '1️⃣ Скачайте приложение "Мой налог"\n' +
      '2️⃣ Отсканируйте паспорт и сделайте селфи\n' +
      '3️⃣ Укажите регион и получите ИНН\n' +
      '4️⃣ Добавьте ИНН в профиль DocPartner\n\n' +
      '<b>Важно:</b>\n' +
      '• Лимит: 2,4 млн ₽ в год\n' +
      '• Налог платится автоматически\n' +
      '• Отчетность не требуется\n' +
      '• Регистрация за 10 минут',
  };

  await ctx.answerCbQuery();

  // Dynamic kb_clinics — load active clinics from DB
  if (callbackData === 'kb_clinics') {
    try {
      const { getAllClinics } = await import('./db');
      const activeClinics = await getAllClinics();
      let msg = '🏥 <b>Клиники-партнеры</b>\n\n';
      msg += `${activeClinics.length} клиник в программе:\n`;
      activeClinics.forEach((clinic: any, idx: number) => {
        const num = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'][idx] || `${idx + 1}.`;
        const spec = clinic.specialization ? ` - ${clinic.specialization}` : '';
        msg += `${num} ${clinic.name}${spec}\n`;
      });
      msg += '\nВсе клиники проверены и имеют лицензии Минздрава.';
      await ctx.reply(msg, { parse_mode: 'HTML' });
      return;
    } catch (error) {
      console.error('[Telegram Bot] kb_clinics dynamic error:', error);
    }
  }

  const answer = answers[callbackData] || 'Информация не найдена.';

  await ctx.reply(answer, { parse_mode: 'HTML' });
});
// /menu command - show inline keyboard for registered users
bot.command('menu', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Clear any active session to allow menu access at any time
  const session = getSession(userId);
  session.registrationStep = undefined;
  session.tempData = {};

  try {
    const db = await getDb();
    if (!db) {
      await ctx.reply('❌ Ошибка подключения к базе данных.');
      return;
    }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));
    
    if (!agent) {
      await ctx.reply(
        '❌ Вы не зарегистрированы в системе.\n\n' +
        'Используйте команду /start для регистрации.'
      );
      return;
    }

    if (agent.status !== 'active') {
      await ctx.reply(
        '⏳ Ваша заявка находится на проверке.\n\n' +
        'Меню будет доступно после активации вашего аккаунта.'
      );
      return;
    }

    // Show main menu keyboard
    await ctx.reply(
      '📱 <b>Главное меню</b>\n\n' +
      'Используйте кнопки ниже для выбора действия:',
      { parse_mode: 'HTML', ...mainMenuKeyboard }
    );
  } catch (error) {
    console.error('[Telegram Bot] Error in /menu command:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
  }
});

bot.command('stats', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    const db = await getDb();
    if (!db) {
      await ctx.reply('❌ Ошибка подключения к базе данных.');
      return;
    }

    const [agent] = await db.select().from(agents).where(eq(agents.telegramId, userId.toString()));

    if (!agent) {
      await ctx.reply('Вы еще не зарегистрированы. Используйте /start');
      return;
    }

    if (agent.status !== 'active') {
      await ctx.reply('Ваша заявка еще не активирована. Статистика будет доступна после активации.');
      return;
    }

    const { getAgentCompletedPaymentsSum: getCompletedSum, getAgentReferralCount } = await import('./db');
    const [paidOutSum, totalReferralCount] = await Promise.all([
      getCompletedSum(agent.id),
      getAgentReferralCount(agent.id),
    ]);
    const earnedRub = ((agent.totalEarnings || 0) / 100).toLocaleString('ru-RU');
    const paidOutRub = (paidOutSum / 100).toLocaleString('ru-RU');
    const bonusRub = ((agent.bonusPoints || 0) / 100).toLocaleString('ru-RU');
    const referralLink = `https://t.me/docpartnerbot?start=ref_${agent.id}`;
      const webReferralLink = `https://doc-partner.ru/register?ref=${agent.id}`;

    let message = '📊 <b>Моя статистика</b>\n\n';
    message += `👥 Отправлено пациентов: <b>${totalReferralCount}</b>\n`;
    message += `💰 Заработано: <b>${earnedRub} ₽</b>\n`;
    message += `✅ Выплачено: <b>${paidOutRub} ₽</b>\n`;
    if ((agent.bonusPoints || 0) > 0) {
      message += `🎁 Бонусные баллы: <b>${bonusRub} ₽</b>\n`;
    }
    message += `\n🔗 <b>Ваша реферальная ссылка:</b>\n📱 Telegram: <code>${referralLink}</code>\n🌐 Веб: <code>${webReferralLink}</code>\n`;
    message += '📢 За каждого приглашённого агента — <b>1 000 ₽</b> бонус\n\n';
    message += '📈 <b>Как заработать больше:</b>\n';
    message += '• Отправляйте пациентов через /patient\n';
    message += '• Приглашайте коллег по реферальной ссылке\n';
    message += '• Бонус разблокируется после 10 оплаченных пациентов';

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[Telegram Bot] Stats command error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

// Error handler
bot.catch((err, ctx) => {
  console.error('[Telegram Bot] Error:', err);
  ctx.reply('❌ Произошла ошибка. Пожалуйста, попробуйте позже.').catch(() => {});
});

/**
 * Setup webhook for Telegram bot
 * @param app Express application
 * @param webhookPath Path for webhook endpoint (e.g., '/telegram-webhook')
 * @param webhookDomain Your domain (e.g., 'https://yourdomain.com')
 */
export async function setupTelegramWebhook(app: Express, webhookPath: string, webhookDomain: string) {
  // Use Telegraf's webhookCallback — let Telegraf handle path matching internally
  // IMPORTANT: This must be registered BEFORE express.json() middleware
  // DO NOT use app.use(webhookPath, bot.webhookCallback(webhookPath)) — double-path bug!
  app.use(bot.webhookCallback(webhookPath));
  console.log('[Telegram Bot] Webhook endpoint ready at', webhookPath);

  // Try to set webhook URL (non-blocking)
  const webhookUrl = `${webhookDomain}${webhookPath}`;
  bot.telegram.setWebhook(webhookUrl)
    .then(() => {
      console.log(`[Telegram Bot] Webhook set to: ${webhookUrl}`);
    })
    .catch((error) => {
      console.error('[Telegram Bot] Failed to setup webhook (will retry on next restart):', error.message);
    });

  return bot;
}

/**
 * Send notification to agent via Telegram
 */
export async function notifyAgent(telegramId: string, message: string) {
  try {
    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML' });
    console.log(`[Telegram Bot] Notification sent to agent ${telegramId}`);
    return true;
  } catch (error) {
    console.error(`[Telegram Bot] Failed to send notification to ${telegramId}:`, error);
    return false;
  }
}

/**
 * Remove webhook and stop bot
 */
export async function stopTelegramBot() {
  try {
    await bot.telegram.deleteWebhook();
    console.log('[Telegram Bot] Webhook removed');
  } catch (error) {
    console.error('[Telegram Bot] Failed to remove webhook:', error);
  }
}

export { bot };
