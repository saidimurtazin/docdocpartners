/**
 * DocDocPartner Telegram Bot
 * Registration bot for agent onboarding with Cyrillic validation
 */

import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { ENV } from './_core/env';
import { getDb } from './db';
import { agents } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const bot = new Telegraf(ENV.telegramBotToken);

// Session interface
interface SessionData {
  registrationStep?: 'fullName' | 'email' | 'phone' | 'role' | 'specialization' | 'city' | 'contract';
  tempData?: {
    fullName?: string;
    email?: string;
    phone?: string;
    role?: string;
    specialization?: string;
    city?: string;
  };
}

interface BotContext extends Context {
  session?: SessionData;
}

// Simple in-memory session storage
const sessions = new Map<number, SessionData>();

// Helper functions
function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function validateCyrillic(text: string): boolean {
  // Only Cyrillic letters, spaces, and hyphens
  return /^[А-Яа-яЁё\s-]+$/.test(text);
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone: string): boolean {
  // Russian phone format: +7XXXXXXXXXX
  return /^\+7\d{10}$/.test(phone);
}

// Main menu keyboard
const mainMenuKeyboard = Markup.keyboard([
  ['📊 Мои рекомендации', '💰 Мои выплаты'],
  ['📈 Статистика', '👥 Реферальная программа'],
  ['⚙️ Настройки', '❓ Помощь']
]).resize();

// Role selection keyboard
const roleKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('Врач', 'role_doctor')],
  [Markup.button.callback('Медсестра', 'role_nurse')],
  [Markup.button.callback('Координатор', 'role_coordinator')],
  [Markup.button.callback('Администратор', 'role_admin')],
  [Markup.button.callback('Регистратор', 'role_registrar')],
  [Markup.button.callback('Прочее', 'role_other')]
]);

// Specialization keyboard (for doctors)
const specializationKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('Терапевт', 'spec_therapist')],
  [Markup.button.callback('Хирург', 'spec_surgeon')],
  [Markup.button.callback('Кардиолог', 'spec_cardiologist')],
  [Markup.button.callback('Невролог', 'spec_neurologist')],
  [Markup.button.callback('Педиатр', 'spec_pediatrician')],
  [Markup.button.callback('Стоматолог', 'spec_dentist')],
  [Markup.button.callback('Прочее', 'spec_other')]
]);

// /start command
bot.command('start', async (ctx) => {
  const telegramId = ctx.from.id;
  const db = await getDb();
  if (!db) return;

  // Check if already registered
  const [existingAgent] = await db
    .select()
    .from(agents)
    .where(eq(agents.telegramId, String(telegramId)))
    .limit(1);

  if (existingAgent) {
    await ctx.reply(
      `Добро пожаловать обратно, ${existingAgent.fullName}! 👋\n\n` +
      `Ваш статус: ✅ Активен\n` +
      `Используйте меню ниже для работы с платформой.`,
      mainMenuKeyboard
    );
    return;
  }

  // Start registration
  sessions.set(telegramId, { registrationStep: 'fullName', tempData: {} });
  
  await ctx.reply(
    `👋 Добро пожаловать в DocDocPartner!\n\n` +
    `Мы рады приветствовать вас в нашей партнерской программе.\n\n` +
    `📝 Для начала работы необходимо пройти регистрацию.\n\n` +
    `Введите ваше ФИО (полностью):`
  );
});

// Text message handler
bot.on(message('text'), async (ctx) => {
  const telegramId = ctx.from.id;
  const session = sessions.get(telegramId);
  const text = ctx.message.text;

  if (!session || !session.registrationStep) {
    await ctx.reply('Используйте /start для начала работы.');
    return;
  }

  // Registration: Full Name
  if (session.registrationStep === 'fullName') {
    if (!validateCyrillic(text)) {
      await ctx.reply(
        '❌ Пожалуйста, введите ФИО только русскими буквами.\n\n' +
        'Пример: Иванов Иван Иванович'
      );
      return;
    }

    const fullName = capitalizeWords(text);
    session.tempData = { fullName };
    session.registrationStep = 'email';

    await ctx.reply(
      `Отлично, ${fullName}! ✅\n\n` +
      `📧 Теперь введите ваш email:\n\n` +
      `ℹ️ На email будут приходить только важные уведомления (подтверждение регистрации, изменение статуса выплат).`
    );
    sessions.set(telegramId, session);
    return;
  }

  // Registration: Email
  if (session.registrationStep === 'email') {
    const email = text.trim().toLowerCase();
    
    if (!validateEmail(email)) {
      await ctx.reply(
        '❌ Пожалуйста, введите корректный email.\n\n' +
        'Пример: doctor@example.com'
      );
      return;
    }

    const db = await getDb();
    if (!db) return;

    // Check if email already exists
    const [existing] = await db
      .select()
      .from(agents)
      .where(eq(agents.email, email))
      .limit(1);

    if (existing) {
      await ctx.reply(
        '❌ Этот email уже зарегистрирован в системе.\n\n' +
        'Введите другой email или свяжитесь с поддержкой.'
      );
      return;
    }

    session.tempData!.email = email;
    session.registrationStep = 'phone';

    await ctx.reply(
      `📱 Введите ваш номер телефона:\n\n` +
      `Формат: +79XXXXXXXXX`
    );
    sessions.set(telegramId, session);
    return;
  }

  // Registration: Phone
  if (session.registrationStep === 'phone') {
    const phone = text.trim();
    
    if (!validatePhone(phone)) {
      await ctx.reply(
        '❌ Пожалуйста, введите номер в формате +79XXXXXXXXX'
      );
      return;
    }

    session.tempData!.phone = phone;
    session.registrationStep = 'role';

    await ctx.reply(
      `👔 Выберите вашу роль:`,
      roleKeyboard
    );
    sessions.set(telegramId, session);
    return;
  }

  // Registration: City
  if (session.registrationStep === 'city') {
    if (!validateCyrillic(text)) {
      await ctx.reply('❌ Пожалуйста, введите название города русскими буквами.');
      return;
    }

    const city = capitalizeWords(text);
    session.tempData!.city = city;
    session.registrationStep = 'contract';

    const contractText = `
📄 Договор оферты

Прежде чем продолжить, ознакомьтесь с условиями:

✅ Вознаграждение: 7-10% от суммы лечения
✅ Выплаты: от 1000 ₽ в течение 3-5 дней
✅ Легальность: официальный договор оферты
✅ Прозрачность: отслеживание всех рекомендаций

Нажимая "Принять", вы соглашаетесь с условиями договора оферты.
`;

    const contractKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Принять', 'contract_accept')],
      [Markup.button.callback('❌ Отклонить', 'contract_decline')]
    ]);

    await ctx.reply(contractText, contractKeyboard);
    sessions.set(telegramId, session);
    return;
  }
});

// Role selection callbacks
bot.action(/^role_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = ctx.from!.id;
  const session = sessions.get(telegramId);
  
  if (!session) return;

  const roleMap: Record<string, string> = {
    doctor: 'Врач',
    nurse: 'Медсестра',
    coordinator: 'Координатор',
    admin: 'Администратор',
    registrar: 'Регистратор',
    other: 'Прочее'
  };

  const roleKey = ctx.match[1];
  const role = roleMap[roleKey];
  session.tempData!.role = role;

  if (roleKey === 'doctor') {
    session.registrationStep = 'specialization';
    await ctx.editMessageText(
      `Вы выбрали: ${role}\n\n` +
      `🩺 Выберите вашу специализацию:`,
      specializationKeyboard
    );
  } else {
    session.registrationStep = 'city';
    await ctx.editMessageText(`Вы выбрали: ${role} ✅`);
    await ctx.reply(`🏙️ Введите ваш город:`);
  }

  sessions.set(telegramId, session);
});

// Specialization selection callbacks
bot.action(/^spec_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = ctx.from!.id;
  const session = sessions.get(telegramId);
  
  if (!session) return;

  const specMap: Record<string, string> = {
    therapist: 'Терапевт',
    surgeon: 'Хирург',
    cardiologist: 'Кардиолог',
    neurologist: 'Невролог',
    pediatrician: 'Педиатр',
    dentist: 'Стоматолог',
    other: 'Прочее'
  };

  const specKey = ctx.match[1];
  const specialization = specMap[specKey];
  session.tempData!.specialization = specialization;
  session.registrationStep = 'city';

  await ctx.editMessageText(`Специализация: ${specialization} ✅`);
  await ctx.reply(`🏙️ Введите ваш город:`);
  sessions.set(telegramId, session);
});

// Contract acceptance
bot.action('contract_accept', async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = ctx.from!.id;
  const session = sessions.get(telegramId);
  
  if (!session || !session.tempData) return;

  const db = await getDb();
  if (!db) return;

  const data = session.tempData;

  // Create agent in database
  await db.insert(agents).values({
    telegramId: String(telegramId),
    fullName: data.fullName!,
    email: data.email!,
    phone: data.phone!,
    role: data.role!,
    specialization: data.specialization || null,
    city: data.city!,
    status: 'active'
  });

  await ctx.editMessageText(
    `🎉 Поздравляем! Регистрация завершена!\n\n` +
    `✅ Ваш аккаунт активирован\n` +
    `📧 Email: ${data.email}\n` +
    `📱 Телефон: ${data.phone}\n` +
    `👔 Роль: ${data.role}\n` +
    `🏙️ Город: ${data.city}\n\n` +
    `Теперь вы можете отправлять рекомендации и зарабатывать!`
  );

  await ctx.reply('Главное меню:', mainMenuKeyboard);
  sessions.delete(telegramId);
});

// Contract decline
bot.action('contract_decline', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    '❌ Регистрация отменена.\n\n' +
    'Если передумаете, используйте /start для повторной регистрации.'
  );
  sessions.delete(ctx.from!.id);
});

// Start bot
export async function startTelegramBot() {
  try {
    await bot.launch();
    console.log('[Telegram Bot] Started successfully');
  } catch (error) {
    console.error('[Telegram Bot] Failed to start:', error);
  }
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
