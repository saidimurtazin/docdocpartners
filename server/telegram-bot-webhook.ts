/**
 * DocDocPartner Telegram Bot (Webhook Mode)
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

const bot = new Telegraf(ENV.telegramBotToken);

// Session interface
interface SessionData {
  registrationStep?: 'fullName' | 'email' | 'phone' | 'role' | 'specialization' | 'city' | 'contract' | 'patient_name' | 'patient_birthdate' | 'patient_phone' | 'patient_consent';
  tempData?: {
    fullName?: string;
    email?: string;
    phone?: string;
    role?: string;
    specialization?: string;
    city?: string;
    agentId?: number;
    patientName?: string;
    patientBirthdate?: string;
    patientPhone?: string;
    referredBy?: string;
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

// ===============================
// VALIDATION FUNCTIONS (IMPROVED)
// ===============================

/**
 * Валидация ФИО - только кириллица, 2-4 слова, минимум 2 буквы в каждом слове
 */
function validateFullName(text: string): { valid: boolean; error?: string } {
  const trimmed = text.trim();

  if (trimmed.length > 150) {
    return { valid: false, error: 'Слишком длинное имя (максимум 150 символов)' };
  }

  // Проверка на кириллицу, пробелы, дефисы
  if (!/^[А-Яа-яЁё\s-]+$/.test(trimmed)) {
    return { valid: false, error: 'Используйте только русские буквы (кириллицу)' };
  }

  // Проверка количества слов (2-4 слова)
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) {
    return { valid: false, error: 'Введите минимум Фамилию и Имя' };
  }
  if (words.length > 4) {
    return { valid: false, error: 'Слишком много слов. Формат: Фамилия Имя Отчество' };
  }

  // Проверка длины каждого слова (минимум 2 буквы)
  for (const word of words) {
    if (word.length < 2) {
      return { valid: false, error: 'Каждое слово должно содержать минимум 2 буквы' };
    }
  }

  return { valid: true };
}

/**
 * Валидация email с проверкой формата и длины домена
 */
function validateEmailAdvanced(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim().toLowerCase();

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email слишком длинный' };
  }

  // Проверка формата: local@domain.tld
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Неверный формат email. Пример: ivan@mail.ru' };
  }

  // Проверка длины домена (минимум "a.ru" = 4 символа)
  const domain = trimmed.split('@')[1];
  if (domain && domain.length < 4) {
    return { valid: false, error: 'Слишком короткий домен email' };
  }

  return { valid: true };
}

/**
 * Валидация любого международного номера телефона
 * Принимает номера в формате +[country_code][number]
 */
function validatePhoneAdvanced(phone: string): { valid: boolean; error?: string; normalized?: string } {
  // Убираем пробелы, дефисы, скобки
  let cleaned = phone.replace(/[\s\-()]/g, '');

  // Автоматическая нормализация
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  if (cleaned.startsWith('+8') && cleaned.length === 12) cleaned = '+7' + cleaned.slice(2);

  // Проверка общего формата: + и 11-15 цифр (минимум 11 для РФ/СНГ)
  if (!/^\+\d{11,15}$/.test(cleaned)) {
    return {
      valid: false,
      error: 'Неверный формат. Минимум 11 цифр с кодом страны.\nПримеры: +79001234567, +77011234567, +996555123456'
    };
  }

  return { valid: true, normalized: cleaned };
}

/**
 * Валидация даты рождения ДД.ММ.ГГГГ
 */
function validateBirthdate(dateStr: string): { valid: boolean; error?: string } {
  // Проверка формата ДД.ММ.ГГГГ
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    return { 
      valid: false, 
      error: 'Неверный формат. Используйте: ДД.ММ.ГГГГ (например: 15.03.1985)' 
    };
  }
  
  const [day, month, year] = dateStr.split('.').map(Number);
  
  // Проверка диапазонов
  if (month < 1 || month > 12) {
    return { valid: false, error: 'Месяц должен быть от 01 до 12' };
  }
  
  if (day < 1 || day > 31) {
    return { valid: false, error: 'День должен быть от 01 до 31' };
  }
  
  // Проверка количества дней в месяце
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) {
    return { 
      valid: false, 
      error: `В ${month} месяце максимум ${daysInMonth} дней` 
    };
  }
  
  // Проверка года (от 1900 до текущего года)
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) {
    return { 
      valid: false, 
      error: `Год должен быть от 1900 до ${currentYear}` 
    };
  }
  
  // Проверка что дата не в будущем
  const inputDate = new Date(year, month - 1, day);
  const today = new Date();
  if (inputDate > today) {
    return { valid: false, error: 'Дата рождения не может быть в будущем' };
  }
  
  // Проверка минимального возраста (1 год)
  const age = Math.floor((today.getTime() - inputDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 1) {
    return { valid: false, error: 'Пациенту должно быть минимум 1 год' };
  }
  
  return { valid: true };
}

/**
 * Валидация города - только кириллица
 */
function validateCity(text: string): { valid: boolean; error?: string } {
  const trimmed = text.trim();
  
  if (!/^[А-Яа-яЁё\s-]+$/.test(trimmed)) {
    return { valid: false, error: 'Используйте только русские буквы (кириллицу)' };
  }
  
  if (trimmed.length < 2) {
    return { valid: false, error: 'Название города слишком короткое' };
  }
  
  if (trimmed.length > 50) {
    return { valid: false, error: 'Название города слишком длинное' };
  }
  
  return { valid: true };
}

/**
 * Капитализация слов
 */
function capitalizeWords(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Legacy validators for backward compatibility
function validateCyrillic(text: string): boolean {
  return /^[А-Яа-яЁё\s-]+$/.test(text);
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone: string): boolean {
  return /^\+7\d{10}$/.test(phone);
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
  [Markup.button.callback('👩‍⚕️ Медсестра', 'role_nurse')],
  [Markup.button.callback('👔 Координатор', 'role_coordinator')],
  [Markup.button.callback('🔧 Администратор', 'role_admin')],
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
  const referredBy = startPayload && startPayload.startsWith('ref_') ? startPayload.replace('ref_', '') : undefined;

  await ctx.reply(
    '👋 <b>Добро пожаловать в DocDocPartner!</b>\n\n' +
    'Я помогу вам зарегистрироваться в партнерской программе для врачей и медицинских специалистов.\n\n' +
    '💰 Зарабатывайте до 10% за каждого направленного пациента\n' +
    '🏥 Работайте с проверенными клиниками\n' +
    '📱 Управляйте рекомендациями прямо в Telegram\n\n' +
    '📝 <b>Для начала регистрации введите ваше полное имя (Фамилия Имя Отчество):</b>',
    { parse_mode: 'HTML' }
  );

  const session = getSession(userId);
  session.registrationStep = 'fullName';
  session.tempData = { referredBy };
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

      await ctx.reply(
        '📊 <b>Моя статистика</b>\n\n' +
        `👥 Отправлено пациентов: <b>${agent.totalReferrals || 0}</b>\n` +
        `💰 Заработано: <b>${(agent.totalEarnings || 0).toLocaleString('ru-RU')} ₽</b>\n` +
        `🌟 Бонусные баллы: <b>${agent.bonusPoints || 0}</b>\n\n` +
        '📈 <b>Как заработать больше:</b>\n' +
        '• Отправляйте пациентов через меню\n' +
        '• Приглашайте других агентов (реферальная программа)\n' +
        '• Получайте бонусы за объем рекомендаций',
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('[Telegram Bot] Stats error:', error);
      await ctx.reply('❌ Произошла ошибка.');
    }
    return;
  }
  if (text === '💰 Запросить выплату') {
    // Request payout directly
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

      const availableBalance = agent.totalEarnings || 0;
      const minPayout = 1000;

      if (availableBalance < minPayout) {
        await ctx.reply(
          '💰 <b>Запрос выплаты</b>\n\n' +
          `Доступно к выводу: <b>${availableBalance.toLocaleString('ru-RU')} ₽</b>\n\n` +
          `⚠️ Минимальная сумма вывода: ${minPayout.toLocaleString('ru-RU')} ₽\n\n` +
          'Продолжайте отправлять рекомендации для накопления суммы.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      let message = '💰 <b>Запрос выплаты</b>\n\n';
      message += `💵 Доступно к выводу: <b>${availableBalance.toLocaleString('ru-RU')} ₽</b>\n\n`;
      message += '<b>📋 Ваши реквизиты:</b>\n';
      message += `👤 ФИО: ${escapeHtml(agent.fullName || '')}\n`;
      message += `📧 Email: ${escapeHtml(agent.email || '')}\n`;
      message += `📞 Телефон: ${escapeHtml(agent.phone || '')}\n`;
      if (agent.inn) {
        message += `💼 ИНН: ${agent.inn}\n`;
      }
      if (agent.bankAccount) {
        message += `🏦 Счет: ${agent.bankAccount}\n`;
      }
      message += '\n<b>📝 Процесс выплаты:</b>\n';
      message += '1️⃣ Запрос обрабатывается автоматически\n';
      message += '2️⃣ На ваш email отправляется письмо\n';
      message += '3️⃣ Подписываете документы в Контур.Сайн\n';
      message += '4️⃣ Выплата в течение 3 рабочих дней\n\n';
      
      if (!agent.inn || !agent.bankAccount) {
        message += '⚠️ <b>Внимание:</b> Для выплаты необходимо заполнить ИНН и банковский счет. Свяжитесь с поддержкой.\n\n';
      } else {
        message += '✅ Запрос на выплату отправлен! Ожидайте письмо на email.';
      }

      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('[Telegram Bot] Request payout error:', error);
      await ctx.reply('❌ Произошла ошибка.');
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
        pending: '📤',
        contacted: '📞',
        scheduled: '📅',
        completed: '✅',
        cancelled: '❌'
      };

      const statusNames: Record<string, string> = {
        pending: 'Отправлена',
        contacted: 'Клиника связалась',
        scheduled: 'Записан на прием',
        completed: 'Лечение завершено',
        cancelled: 'Отменена'
      };

      let message = '📊 <b>Мои рекомендации</b>\n\n';
      const displayReferrals = referrals.slice(-10).reverse();

      for (const ref of displayReferrals) {
        const emoji = statusEmoji[ref.status] || '📋';
        const statusName = statusNames[ref.status] || ref.status;
        message += `${emoji} <b>${escapeHtml(ref.patientFullName)}</b>\n`;
        message += `   Статус: ${statusName}\n`;
        message += `   Дата: ${new Date(ref.createdAt).toLocaleDateString('ru-RU')}\n\n`;
      }

      if (referrals.length > 10) {
        message += `\n<i>Показаны последние 10 из ${referrals.length} рекомендаций</i>`;
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
      
      if (agent.inn) {
        message += `💼 <b>ИНН:</b> ${agent.inn}\n`;
        message += `✅ <b>Статус:</b> Самозанятый\n\n`;
      } else {
        message += `⚠️ <b>Статус:</b> Не самозанятый\n\n`;
        message += '💡 Рекомендуем оформить самозанятость для получения полной суммы вознаграждения (7% вместо ~4%).\n';
        message += '\n📚 Подробнее: База знаний → Как стать самозанятым';
      }

      await ctx.reply(message, { parse_mode: 'HTML' });
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
      [Markup.button.callback('🔒 Проверки безопасности', 'kb_security')],
      [Markup.button.callback('📅 Бесплатная запись', 'kb_booking')],
      [Markup.button.callback('📝 Подписание документов', 'kb_documents')],
      [Markup.button.callback('📈 Как стать самозанятым', 'kb_selfemployed')],
      [Markup.button.callback('🏥 Клиники-партнеры', 'kb_clinics')]
    ]);

    await ctx.reply(
      '📚 <b>База знаний DocDocPartner</b>\n\n' +
      'Выберите интересующий вопрос:',
      { parse_mode: 'HTML', ...keyboard }
    );
    return;
  }
  if (text === 'ℹ️ О программе') {
    // Show about info directly
    await ctx.reply(
      'ℹ️ <b>О программе DocDocPartner</b>\n\n' +
      'DocDocPartner — это B2B-платформа агентских рекомендаций в сфере здравоохранения.\n\n' +
      '<b>🎯 Наша миссия:</b>\n' +
      'Связывать врачей-агентов с проверенными клиниками для направления пациентов на платное лечение.\n\n' +
      '<b>💰 Условия:</b>\n' +
      '• Вознаграждение: 7% от суммы лечения\n' +
      '• Бонус: 10% при объеме >1 млн ₽/мес\n' +
      '• Минимальная сумма вывода: 1 000 ₽\n' +
      '• Выплаты: 3-5 рабочих дней\n\n' +
      '<b>🏥 Партнеры:</b>\n' +
      '8 проверенных клиник в Москве, Санкт-Петербурге, Казани и Уфе\n\n' +
      '<b>🔒 Безопасность:</b>\n' +
      '• Все договоры оформляются официально\n' +
      '• Персональные данные защищены согласно 152-ФЗ\n' +
      '• Многоуровневая система проверок\n\n' +
      '🌐 Сайт: https://marus.partners\n' +
      '📧 Email: info@medigate.ru',
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
      const referredCount = 0; // TODO: implement referredAgentsCount tracking
      const bonusPoints = agent.bonusPoints || 0;

      await ctx.reply(
        '👥 <b>Реферальная программа</b>\n\n' +
        '🎁 Приглашайте других агентов и получайте бонусы!\n\n' +
        `🔗 <b>Ваша реферальная ссылка:</b>\n<code>${referralLink}</code>\n\n` +
        `📈 <b>Ваша статистика:</b>\n` +
        `• Приглашено агентов: ${referredCount}\n` +
        `• Бонусные баллы: ${bonusPoints}\n\n` +
        '💡 Бонусные баллы можно вывести после 10+ собственных рекомендаций.',
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('[Telegram Bot] Referral program error:', error);
      await ctx.reply('❌ Произошла ошибка.');
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

    // Show contract
    session.registrationStep = 'contract';
    await ctx.reply(
      '📄 <b>Договор оферты DocDocPartner</b>\n\n' +
      'Основные условия:\n' +
      '• Вознаграждение: 7% от стоимости лечения (10% для самозанятых)\n' +
      '• Минимальная сумма выплаты: 1000 ₽\n' +
      '• Выплаты производятся после подтверждения лечения клиникой\n' +
      '• Все рекомендации фиксируются в системе\n' +
      '• Персональные данные защищены согласно 152-ФЗ\n\n' +
      'Полный текст договора: https://marus.partners/contract\n\n' +
      'Принимаете условия договора?',
      { ...contractKeyboard, parse_mode: 'HTML' }
    );
    return;
  }

  // Handle specialization text input (for "Other")
  if (session.registrationStep === 'specialization' && session.tempData?.role === 'Врач') {
    if (!validateCyrillic(text)) {
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
    session.registrationStep = 'patient_consent';

    // Show preview with consent buttons
    const consentKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Да, согласие получено', 'patient_consent_yes')],
      [Markup.button.callback('❌ Отменить', 'patient_consent_no')]
    ]);

    await ctx.reply(
      '📋 <b>Проверьте данные пациента:</b>\n\n' +
      `👤 <b>ФИО:</b> ${escapeHtml(session.tempData.patientName || '')}\n` +
      `🎂 <b>Дата рождения:</b> ${escapeHtml(session.tempData.patientBirthdate || '')}\n` +
      `📞 <b>Телефон:</b> ${escapeHtml(phone)}\n\n` +
      '⚠️ <b>ВАЖНО:</b> Подтвердите, что пациент дал согласие на передачу его персональных данных в клиники-партнеры DocDocPartner.',
      { parse_mode: 'HTML', ...consentKeyboard }
    );
    return;
  }
});

// Handle contact sharing
bot.on(message('contact'), async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const session = getSession(userId);

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
    nurse: 'Медсестра',
    coordinator: 'Координатор',
    admin: 'Администратор',
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
    let referredByAgentId: number | null = null;
    if (data.referredBy) {
      const parsedId = parseInt(data.referredBy, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        const [referrer] = await db.select({ id: agents.id }).from(agents).where(eq(agents.id, parsedId));
        if (referrer) {
          referredByAgentId = referrer.id;
        }
      }
    }

    // Create agent in database
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
    });

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
      status: 'pending'
    });

    // Clear session before messages (prevents double-submit)
    sessions.delete(userId);

    await ctx.editMessageText(
      '🎉 <b>Пациент успешно отправлен!</b>\n\n' +
      `👤 <b>ФИО:</b> ${escapeHtml(data.patientName)}\n` +
      `🎂 <b>Дата рождения:</b> ${escapeHtml(data.patientBirthdate)}\n` +
      `📞 <b>Телефон:</b> ${escapeHtml(data.patientPhone)}\n\n` +
      '✅ Клиника свяжется с пациентом в течение 24 часов\n' +
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

// Handle patient consent decline
bot.action('patient_consent_no', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.answerCbQuery();
  await ctx.editMessageText(
    '❌ <b>Отправка отменена</b>\n\n' +
    'Без согласия пациента мы не можем обработать рекомендацию.\n\n' +
    '🔄 Получите согласие пациента и попробуйте снова: /patient',
    { parse_mode: 'HTML' }
  );
  sessions.delete(userId);
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
  
  if (wasInProgress) {
    await ctx.reply(
      '❌ <b>Действие отменено.</b>\n\n' +
      '🔄 Используйте:\n' +
      '/start - Начать регистрацию\n' +
      '/menu - Показать главное меню\n' +
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
        '❓ <b>Помощь - DocDocPartner Bot</b>\n\n' +
        '<b>📋 Доступные команды:</b>\n' +
        '/start - Начать регистрацию\n' +
        '/cancel - Отменить текущее действие\n' +
        '/status - Проверить статус регистрации\n' +
        '/help - Показать эту справку\n\n' +
        '<b>💬 По вопросам:</b>\n' +
        '📧 Email: support@marus.partners\n' +
        '📱 Telegram: @marus_support\n\n' +
        '<i>После активации вашей заявки вам станут доступны дополнительные функции.</i>',
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.reply(
        '❓ <b>Помощь - DocDocPartner Bot</b>\n\n' +
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
        '📧 Email: support@marus.partners\n' +
        '📱 Telegram: @marus_support',
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
      pending: '📤',
      contacted: '📞',
      scheduled: '📅',
      completed: '✅',
      cancelled: '❌'
    };

    const statusNames: Record<string, string> = {
      pending: 'Отправлена',
      contacted: 'Клиника связалась',
      scheduled: 'Записан на прием',
      completed: 'Лечение завершено',
      cancelled: 'Отменена'
    };

    let message = '📊 <b>Мои рекомендации</b>\n\n';

    // Show last 10 referrals
    const displayReferrals = referrals.slice(-10).reverse();

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

    if (referrals.length > 10) {
      message += `... и еще ${referrals.length - 10} рекомендаций\n\n`;
    }

    message += `Всего рекомендаций: ${referrals.length}`;

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

    // For now, assume no payments have been made (no payments table integration yet)
    const totalPaid = 0;
    const available = totalEarned - totalPaid;
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

    const referralLink = `https://t.me/docpartnerbot?start=${agent.referralCode}`;

    let message = '🎁 <b>Реферальная программа</b>\n\n';
    message += '📢 Приглашайте коллег и получайте бонусы!\n\n';
    message += `🔗 <b>Ваша реферальная ссылка:</b>\n${referralLink}\n\n`;
    message += `👥 Приглашено агентов: ${referralCount}\n`;
    message += `⭐ Бонусные баллы: ${bonusPoints}\n\n`;
    message += '<b>Как это работает:</b>\n';
    message += '• Поделитесь ссылкой с коллегами\n';
    message += '• Они регистрируются по вашей ссылке\n';
    message += '• Вы получаете бонусные баллы\n';
    message += '• Баллы можно обменять на вознаграждение';

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
    [Markup.button.callback('🔒 Проверки безопасности', 'kb_security')],
    [Markup.button.callback('📅 Бесплатная запись', 'kb_booking')],
    [Markup.button.callback('📝 Подписание документов', 'kb_documents')],
    [Markup.button.callback('📈 Как стать самозанятым', 'kb_selfemployed')],
    [Markup.button.callback('🏥 Клиники-партнеры', 'kb_clinics')],
  ]);

  await ctx.reply(
    '📚 <b>База знаний DocDocPartner</b>\n\n' +
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

    let message = '📊 <b>Мои рекомендации</b>\n\n';
    referrals.slice(0, 10).forEach((ref, idx) => {
      const statusEmoji = ref.status === 'completed' ? '✅' : ref.status === 'pending' ? '⏳' : '📅';
      message += `${statusEmoji} <b>${escapeHtml(ref.patientFullName)}</b>\n`;
      message += `   Статус: ${ref.status}\n\n`;
    });
    
    if (referrals.length > 10) {
      message += `\nИ еще ${referrals.length - 10} рекомендаций...`;
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

    await ctx.reply(
      '📊 <b>Моя статистика</b>\n\n' +
      `👥 Отправлено пациентов: <b>${agent.totalReferrals || 0}</b>\n` +
      `💰 Заработано: <b>${(agent.totalEarnings || 0).toLocaleString('ru-RU')} ₽</b>\n` +
      `🌟 Бонусные баллы: <b>${agent.bonusPoints || 0}</b>\n\n` +
      '📈 <b>Как заработать больше:</b>\n' +
      '• Отправляйте пациентов через /patient\n' +
      '• Получайте до 10% от стоимости лечения\n' +
      '• Выплаты от 1000 ₽',
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('[Telegram Bot] Stats callback error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

bot.action('cmd_knowledge', async (ctx) => {
  await ctx.answerCbQuery();
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🛡️ Гарантии выплат', 'kb_guarantees')],
    [Markup.button.callback('🔒 Проверки безопасности', 'kb_security')],
    [Markup.button.callback('📅 Бесплатная запись', 'kb_booking')],
    [Markup.button.callback('📝 Подписание документов', 'kb_documents')],
    [Markup.button.callback('📈 Как стать самозанятым', 'kb_selfemployed')],
    [Markup.button.callback('🏥 Клиники-партнеры', 'kb_clinics')]
  ]);

  await ctx.reply(
    '📚 <b>База знаний DocDocPartner</b>\n\n' +
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
    const referredCount = 0; // TODO: implement referredAgentsCount tracking
    const bonusPoints = agent.bonusPoints || 0;

    await ctx.reply(
      '👥 <b>Реферальная программа</b>\n\n' +
      '🎁 Приглашайте других агентов и получайте бонусы!\n\n' +
      `🔗 <b>Ваша реферальная ссылка:</b>\n<code>${referralLink}</code>\n\n` +
      `📈 <b>Ваша статистика:</b>\n` +
      `• Приглашено агентов: ${referredCount}\n` +
      `• Бонусные баллы: ${bonusPoints}\n\n` +
      '💡 Бонусные баллы можно вывести после 10+ собственных рекомендаций.',
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('[Telegram Bot] Referral program callback error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

// New callback handlers for updated menu
bot.action('cmd_request_payout', async (ctx) => {
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

    const availableBalance = agent.totalEarnings || 0;
    const minPayout = 1000;

    if (availableBalance < minPayout) {
      await ctx.reply(
        '💰 <b>Запрос выплаты</b>\n\n' +
        `Доступно к выводу: <b>${availableBalance.toLocaleString('ru-RU')} ₽</b>\n\n` +
        `⚠️ Минимальная сумма вывода: ${minPayout.toLocaleString('ru-RU')} ₽\n\n` +
        'Продолжайте отправлять рекомендации для накопления суммы.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Show requisites and payout process
    let message = '💰 <b>Запрос выплаты</b>\n\n';
    message += `Доступно к выводу: <b>${availableBalance.toLocaleString('ru-RU')} ₽</b>\n\n`;
    message += '✅ Вы можете запросить выплату!\n\n';
    
    message += '📝 <b>Ваши реквизиты:</b>\n';
    message += `• ФИО: ${agent.fullName}\n`;
    message += `• Email: ${agent.email}\n`;
    message += `• Телефон: ${agent.phone}\n`;
    if (agent.inn) {
      message += `• ИНН: ${agent.inn}\n`;
    }
    if (agent.bankAccount) {
      message += `• Счет: ${agent.bankAccount}\n`;
    }
    message += '\n';
    
    message += '🚀 <b>Процесс выплаты:</b>\n';
    message += '1️⃣ Мы отправили заявку на получение выплаты\n';
    message += '2️⃣ Вам придет письмо на <b>' + agent.email + '</b>\n';
    message += '3️⃣ Подпишите документы в <b>Контур.Сайн</b>\n';
    message += '4️⃣ Выплата производится в течение <b>3 рабочих дней</b>\n\n';
    
    message += 'ℹ️ <b>Контур.Сайн</b> — это сервис электронной подписи документов. Подписанные документы имеют юридическую силу.\n\n';
    
    if (!agent.inn || !agent.bankAccount) {
      message += '⚠️ <b>Внимание!</b> У вас не указаны все реквизиты.\n';
      message += 'Для обновления реквизитов напишите:\n';
      message += '📧 info@medigate.ru';
    } else {
      message += '✅ Заявка отправлена! Проверьте почту для подписания документов.';
    }
    
    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[Telegram Bot] Request payout callback error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
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
    message += `👤 <b>ФИО:</b> ${agent.fullName}\n`;
    message += `📧 <b>Email:</b> ${agent.email}\n`;
    message += `📞 <b>Телефон:</b> ${agent.phone}\n`;
    message += `🏙️ <b>Город:</b> ${agent.city}\n\n`;
    
    if (agent.inn) {
      message += `💼 <b>ИНН:</b> ${agent.inn}\n`;
      message += `✅ <b>Статус:</b> Самозанятый\n\n`;
    } else {
      message += `⚠️ <b>Статус:</b> Не самозанятый\n\n`;
      message += '💡 Рекомендуем оформить самозанятость для получения полной суммы вознаграждения (7% вместо ~4%).\n';
      message += 'Используйте Базу знаний → "Как стать самозанятым"\n\n';
    }
    
    message += '📝 Для изменения реквизитов напишите в поддержку: info@medigate.ru';

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[Telegram Bot] Requisites callback error:', error);
    await ctx.reply('❌ Произошла ошибка.');
  }
});

bot.action('cmd_about', async (ctx) => {
  await ctx.answerCbQuery();
  
  await ctx.reply(
    'ℹ️ <b>О программе DocDocPartner</b>\n\n' +
    'DocDocPartner — это B2B-платформа агентских рекомендаций в сфере здравоохранения.\n\n' +
    '<b>🎯 Наша миссия:</b>\n' +
    'Связывать врачей-агентов с проверенными клиниками для направления пациентов на платное лечение.\n\n' +
    '<b>💰 Условия:</b>\n' +
    '• Вознаграждение: 7% от суммы лечения\n' +
    '• Бонус: 10% при объеме >1 млн ₽/мес\n' +
    '• Минимальная сумма вывода: 1 000 ₽\n' +
    '• Выплаты: 3-5 рабочих дней\n\n' +
    '<b>🏥 Партнеры:</b>\n' +
    '8 проверенных клиник в Москве, Санкт-Петербурге, Казани и Уфе\n\n' +
    '<b>🔒 Безопасность:</b>\n' +
    '• Все договоры оформляются официально\n' +
    '• Персональные данные защищены согласно 152-ФЗ\n' +
    '• Многоуровневая система проверок\n\n' +
    '🌐 Сайт: https://marus.partners\n' +
    '📧 Email: info@medigate.ru',
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

    const payments = await db.select().from(schema.payments)
      .where(eq(schema.payments.agentId, agent.id));

    if (payments.length === 0) {
      await ctx.reply(
        '💰 <b>Мои выплаты</b>\n\n' +
        'У вас пока нет выплат.\n\n' +
        `💵 Доступно к выводу: <b>${(agent.totalEarnings || 0).toLocaleString('ru-RU')} ₽</b>\n\n` +
        '💡 Минимальная сумма вывода: 1 000 ₽',
        { parse_mode: 'HTML' }
      );
      return;
    }

    let message = '💰 <b>Мои выплаты</b>\n\n';
    payments.slice(0, 5).forEach((payment) => {
      const statusEmoji = payment.status === 'completed' ? '✅' : payment.status === 'pending' ? '⏳' : '🔄';
      message += `${statusEmoji} <b>${(payment.amount / 100).toLocaleString('ru-RU')} ₽</b>\n`;
      message += `   Статус: ${payment.status}\n\n`;
    });
    
    message += `\n💵 Доступно к выводу: <b>${(agent.totalEarnings || 0).toLocaleString('ru-RU')} ₽</b>`;

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
  const answers: Record<string, string> = {
    kb_guarantees:
      '🛡️ <b>Гарантии выплат</b>\n\n' +
      'DocDocPartner гарантирует выплату вознаграждения за каждого успешно направленного пациента. Выплата производится после подтверждения клиникой факта оказания услуг и получения оплаты от пациента.\n\n' +
      '✅ <b>Прозрачность</b>\nВы видите статус каждой рекомендации в реальном времени через бот или личный кабинет\n\n' +
      '💵 <b>Фиксированная ставка</b>\n7% от суммы лечения, 10% при объёме >1 млн ₽/месяц\n\n' +
      '⏱️ <b>Быстрые выплаты</b>\nВыплата в течение 3-5 рабочих дней после подтверждения клиникой\n\n' +
      '📝 <b>Легальность</b>\nВсе выплаты оформляются официально с договором и документами\n\n' +
      '<b>Условия выплаты:</b>\n' +
      '• Пациент должен пройти лечение в клинике-партнере\n' +
      '• Клиника подтверждает факт оказания услуг\n' +
      '• Минимальная сумма для вывода: 1000 ₽\n' +
      '• Для вывода бонусных баллов: минимум 10 собственных рекомендаций',
    kb_security:
      '🔒 <b>Проверки безопасности</b>\n\n' +
      'Многоуровневая система проверок для защиты всех сторон:\n\n' +
      '1️⃣ <b>Верификация агента</b>\n' +
      'Проверяем ФИО, email, телефон и профессию. Для самозанятых — ИНН через сайт ФНС.\n\n' +
      '2️⃣ <b>Звонок пациенту</b>\n' +
      'Координатор связывается для подтверждения данных и уточнения потребностей.\n\n' +
      '3️⃣ <b>Сверка с клиникой</b>\n' +
      'Передаем данные в клинику-партнер. Клиника назначает консультацию.\n\n' +
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
      '📝 <b>Подписание документов</b>\n\n' +
      'Все договоры подписываются электронно через <b>Контур.Сайн</b> — сервис ЭП от СКБ Контур, имеющий юридическую силу согласно 63-ФЗ.\n\n' +
      '<b>Процесс подписания:</b>\n' +
      '1️⃣ Получаете договор на email\n' +
      '2️⃣ Проверяете условия\n' +
      '3️⃣ Подписываете через SMS-код\n' +
      '4️⃣ Получаете подписанный экземпляр\n\n' +
      '<b>Какие документы:</b>\n' +
      '• Договор оферты (при регистрации)\n' +
      '• Акт оказанных услуг (при выплате)\n' +
      '• Дополнительные соглашения\n\n' +
      '<b>Преимущества:</b>\n' +
      '✅ Юридическая сила\n' +
      '✅ Подписание за 1 минуту\n' +
      '✅ Не нужна квалифицированная ЭП\n' +
      '✅ Хранение в облаке',
    kb_selfemployed:
      '📈 <b>Как стать самозанятым</b>\n\n' +
      'Рекомендуем оформить самозанятость для получения полной суммы вознаграждения.\n\n' +
      '<b>Сравнение:</b>\n' +
      '💚 Самозанятый: 7% (налог 6% платите сами)\n' +
      '💛 Не самозанятый: ~4% (минус НДФЛ 13% и соц. 30%)\n' +
      '💜 Бонус >1M ₽/мес: 10% (для самозанятых)\n\n' +
      '<b>Как зарегистрироваться:</b>\n' +
      '1️⃣ Скачайте приложение "Мой налог"\n' +
      '2️⃣ Отсканируйте паспорт и сделайте селфи\n' +
      '3️⃣ Укажите регион и получите ИНН\n' +
      '4️⃣ Добавьте ИНН в профиль DocDocPartner\n\n' +
      '<b>Важно:</b>\n' +
      '• Лимит: 2,4 млн ₽ в год\n' +
      '• Налог платится автоматически\n' +
      '• Отчетность не требуется\n' +
      '• Регистрация за 10 минут',
    kb_clinics:
      '🏥 <b>Клиники-партнеры</b>\n\n' +
      '8 клиник в программе:\n' +
      '1️⃣ Евроонко - онкология\n' +
      '2️⃣ ЕМС - многопрофильная (JCI)\n' +
      '3️⃣ МИБС - онкология, радиология\n' +
      '4️⃣ Медси - многопрофильная\n' +
      '5️⃣ Медицина (Ройтберга) - JCI\n' +
      '6️⃣ Мать и дитя - перинатальные центры\n' +
      '7️⃣ Поликлиника.ру\n' +
      '8️⃣ СМ-Клиника\n\n' +
      '🌍 <b>География:</b> 150+ отделений в 30+ городах России\n' +
      'От Москвы до Владивостока\n\n' +
      'Все клиники проверены и имеют лицензии Минздрава.'
  };

  await ctx.answerCbQuery();
  
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

    await ctx.reply(
      '📊 <b>Моя статистика</b>\n\n' +
      `👥 Отправлено пациентов: <b>${agent.totalReferrals || 0}</b>\n` +
      `💰 Заработано: <b>${(agent.totalEarnings || 0).toLocaleString('ru-RU')} ₽</b>\n` +
      `🌟 Бонусные баллы: <b>${agent.bonusPoints || 0}</b>\n\n` +
      '📈 <b>Как заработать больше:</b>\n' +
      '• Отправляйте пациентов через /patient\n' +
      '• Получайте до 10% от стоимости лечения\n' +
      '• Выплаты от 1000 ₽',
      { parse_mode: 'HTML' }
    );
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
  // Setup webhook endpoint first (always works)
  app.post(webhookPath, async (req, res) => {
    try {
      console.log('[Telegram Bot] Received webhook request');
      await bot.handleUpdate(req.body, res);
    } catch (error) {
      console.error('[Telegram Bot] Webhook error:', error);
      res.sendStatus(500);
    }
  });
  console.log('[Telegram Bot] Webhook endpoint ready');

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
