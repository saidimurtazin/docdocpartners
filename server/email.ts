import nodemailer from 'nodemailer';
import dns from 'dns';
import net from 'net';

// Force IPv4 for DNS resolution — Railway's IPv6 can't reach smtp.mail.ru
dns.setDefaultResultOrder('ipv4first');

/** Custom DNS lookup that forces IPv4 (family=4) — fixes ENETUNREACH on Railway IPv6 */
function ipv4Lookup(hostname: string, options: any, callback: any) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  return dns.lookup(hostname, { ...options, family: 4 }, callback);
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

// --- Two SMTP transporters ---
// 1) noReply: noreply@doc-partner.ru — OTP codes + agent notifications
// 2) info:    info@doc-partner.ru     — clinic notifications + referral emails

let noReplyTransporter: nodemailer.Transporter | null = null;
let infoTransporter: nodemailer.Transporter | null = null;

/**
 * Transporter for noreply@doc-partner.ru (OTP, agent notifications)
 * Uses SMTP_NOREPLY_USER / SMTP_NOREPLY_PASS
 * Falls back to SMTP_USER / SMTP_PASS if noreply credentials are not set
 */
function getNoReplyTransporter() {
  if (!noReplyTransporter) {
    const smtpUser = process.env.SMTP_NOREPLY_USER || process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_NOREPLY_PASS || process.env.SMTP_PASS;

    console.log(`[Email] NoReply transporter init: user=${smtpUser || 'NOT SET'}, pass=${smtpPass ? '***SET***' : 'NOT SET'}`);

    if (!smtpUser || !smtpPass) {
      console.error('[Email] SMTP NoReply credentials not configured. Set SMTP_NOREPLY_USER/SMTP_NOREPLY_PASS or SMTP_USER/SMTP_PASS.');
      return null;
    }

    noReplyTransporter = nodemailer.createTransport({
      host: 'smtp.mail.ru',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      dnsLookup: ipv4Lookup as any,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    });

    // Verify SMTP connection on first creation
    noReplyTransporter.verify().then(() => {
      console.log('[Email] NoReply SMTP connection verified ✓');
    }).catch((err: any) => {
      console.error('[Email] NoReply SMTP verification FAILED:', err.code, err.responseCode, err.message);
    });
  }
  return noReplyTransporter;
}

/**
 * Transporter for info@doc-partner.ru (clinic notifications)
 * Uses SMTP_USER / SMTP_PASS
 */
function getInfoTransporter() {
  if (!infoTransporter) {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    console.log(`[Email] Info transporter init: user=${smtpUser || 'NOT SET'}, pass=${smtpPass ? '***SET***' : 'NOT SET'}`);

    if (!smtpUser || !smtpPass) {
      console.error('[Email] SMTP Info credentials not configured. Set SMTP_USER and SMTP_PASS environment variables.');
      return null;
    }

    infoTransporter = nodemailer.createTransport({
      host: 'smtp.mail.ru',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      dnsLookup: ipv4Lookup as any,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    });

    // Verify SMTP connection on first creation
    infoTransporter.verify().then(() => {
      console.log('[Email] Info SMTP connection verified ✓');
    }).catch((err: any) => {
      console.error('[Email] Info SMTP verification FAILED:', err.code, err.responseCode, err.message);
    });
  }
  return infoTransporter;
}

/**
 * Send email via noreply@doc-partner.ru (OTP codes, agent notifications)
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  try {
    const mailer = getNoReplyTransporter();

    if (!mailer) {
      console.error('[Email] NoReply transporter not initialized. Please configure SMTP credentials.');
      return false;
    }

    const fromUser = process.env.SMTP_NOREPLY_USER || process.env.SMTP_USER;
    console.log(`[Email] Sending via noreply to: ${to}, from: ${fromUser}, subject: ${subject}`);

    await mailer.sendMail({
      from: `"DocDocPartner" <${fromUser}>`,
      to,
      subject,
      html,
    });

    console.log(`[Email] ✓ Sent successfully to ${to} (via noreply)`);
    return true;
  } catch (error: any) {
    console.error('[Email] SMTP send error:', {
      code: error.code,
      responseCode: error.responseCode,
      response: error.response,
      command: error.command,
      message: error.message,
    });
    return false;
  }
}

/**
 * Send email via info@doc-partner.ru (clinic notifications, referrals)
 */
export async function sendInfoEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  try {
    const mailer = getInfoTransporter();

    if (!mailer) {
      console.error('[Email] Info transporter not initialized. Please configure SMTP_USER/SMTP_PASS.');
      return false;
    }

    console.log(`[Email] Sending via info to: ${to}, from: ${process.env.SMTP_USER}, subject: ${subject}`);

    await mailer.sendMail({
      from: `"DocDocPartner" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`[Email] ✓ Sent successfully to ${to} (via info)`);
    return true;
  } catch (error: any) {
    console.error('[Email] SMTP info send error:', {
      code: error.code,
      responseCode: error.responseCode,
      response: error.response,
      command: error.command,
      message: error.message,
    });
    return false;
  }
}

/**
 * Generate 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send referral notification to clinic
 */
export async function sendReferralNotification(params: {
  to: string;
  referralId: number;
  agentName: string;
  patientName: string;
  patientBirthdate: string;
  patientCity?: string;
  patientPhone?: string;
  patientEmail?: string;
  clinic?: string;
}): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .label { font-weight: bold; color: #10b981; }
        .value { margin-left: 10px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏥 Новая рекомендация пациента</h1>
          <p>DocDocPartner</p>
        </div>
        <div class="content">
          <div class="card">
            <h2>📋 Карточка рекомендации #${params.referralId}</h2>
            <p><span class="label">👨‍⚕️ Агент:</span><span class="value">${params.agentName}</span></p>
            <p><span class="label">📅 Дата:</span><span class="value">${new Date().toLocaleDateString('ru-RU')}</span></p>
          </div>
          
          <div class="card">
            <h3>👤 Данные пациента</h3>
            <p><span class="label">ФИО:</span><span class="value">${params.patientName}</span></p>
            <p><span class="label">Дата рождения:</span><span class="value">${params.patientBirthdate}</span></p>
            ${params.patientCity ? `<p><span class="label">Город:</span><span class="value">${params.patientCity}</span></p>` : ''}
            ${params.patientPhone ? `<p><span class="label">Телефон:</span><span class="value">${params.patientPhone}</span></p>` : ''}
            ${params.patientEmail ? `<p><span class="label">Email:</span><span class="value">${params.patientEmail}</span></p>` : ''}
            ${params.clinic ? `<p><span class="label">Клиника:</span><span class="value">${params.clinic}</span></p>` : ''}
          </div>
          
          <div class="card">
            <h3>📝 Следующие шаги</h3>
            <ol>
              <li>Свяжитесь с пациентом для записи на консультацию</li>
              <li>Подтвердите визит пациента в CRM-системе</li>
              <li>После завершения лечения укажите сумму для расчёта вознаграждения агенту</li>
            </ol>
          </div>
          
          <div class="footer">
            <p>Это автоматическое уведомление от системы DocDocPartner</p>
            <p>По вопросам обращайтесь: support@docdocpartner.ru</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendInfoEmail({
    to: params.to,
    subject: `🏥 Новая рекомендация пациента #${params.referralId} от ${params.agentName}`,
    html,
  });
}

/**
 * Send OTP code via email
 * @param purpose - 'registration' for new signup, 'login' for existing user login
 */
export async function sendOTPEmail(to: string, code: string, purpose: 'registration' | 'login' = 'registration'): Promise<boolean> {
  const isLogin = purpose === 'login';
  const subject = isLogin ? 'Код для входа в DocDocPartner' : 'Подтверждение регистрации в DocDocPartner';
  const headerText = isLogin ? 'Вход в личный кабинет' : 'Подтверждение регистрации';
  const titleText = isLogin ? 'Вход в DocDocPartner' : 'Добро пожаловать в DocDocPartner!';
  const descText = isLogin ? 'Для входа в личный кабинет введите код:' : 'Для завершения регистрации введите код подтверждения:';
  const ignoreText = isLogin
    ? 'Если вы не запрашивали вход, просто проигнорируйте это письмо.'
    : 'Если вы не регистрировались в DocDocPartner, просто проигнорируйте это письмо.';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .otp-code { background: white; border: 2px solid #10b981; border-radius: 8px; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10b981; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏥 DocDocPartner</h1>
          <p>${headerText}</p>
        </div>
        <div class="content">
          <h2>${titleText}</h2>
          <p>${descText}</p>
          <div class="otp-code">${code}</div>
          <p><strong>Код действителен 10 минут.</strong></p>
          <p>${ignoreText}</p>
        </div>
        <div class="footer">
          <p>© 2026 DocDocPartner. Все права защищены.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: to,
    subject,
    html,
  });
}

/**
 * Send referral notification to clinic
 */
export async function sendReferralNotificationToClinic(referral: {
  patientName: string;
  patientBirthDate: string;
  patientPhone?: string;
  patientEmail?: string;
  agentName: string;
  agentPhone: string;
  clinic: string;
  notes?: string;
}): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; }
        .card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .card-title { font-size: 18px; font-weight: bold; color: #10b981; margin-bottom: 15px; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
        .info-row { display: flex; margin: 10px 0; }
        .info-label { font-weight: bold; min-width: 150px; color: #6b7280; }
        .info-value { color: #111827; }
        .footer { text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: #6b7280; background: white; border-radius: 0 0 10px 10px; }
        .badge { display: inline-block; background: #10b981; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 Новая рекомендация пациента</h1>
          <p>DocDocPartner</p>
        </div>
        <div class="content">
          <p><span class="badge">НОВАЯ ЗАЯВКА</span></p>
          
          <div class="card">
            <div class="card-title">👤 Информация о пациенте</div>
            <div class="info-row">
              <div class="info-label">ФИО:</div>
              <div class="info-value">${referral.patientName}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Дата рождения:</div>
              <div class="info-value">${referral.patientBirthDate}</div>
            </div>
            ${referral.patientPhone ? `
            <div class="info-row">
              <div class="info-label">Телефон:</div>
              <div class="info-value">${referral.patientPhone}</div>
            </div>
            ` : ''}
            ${referral.patientEmail ? `
            <div class="info-row">
              <div class="info-label">Email:</div>
              <div class="info-value">${referral.patientEmail}</div>
            </div>
            ` : ''}
          </div>

          <div class="card">
            <div class="card-title">👨‍⚕️ Информация об агенте</div>
            <div class="info-row">
              <div class="info-label">ФИО агента:</div>
              <div class="info-value">${referral.agentName}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Телефон агента:</div>
              <div class="info-value">${referral.agentPhone}</div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">🏥 Клиника назначения</div>
            <div class="info-row">
              <div class="info-value">${referral.clinic}</div>
            </div>
          </div>

          ${referral.notes ? `
          <div class="card">
            <div class="card-title">📝 Дополнительная информация</div>
            <div class="info-value">${referral.notes}</div>
          </div>
          ` : ''}

          <p style="margin-top: 30px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
            <strong>⚡ Действие требуется:</strong> Пожалуйста, свяжитесь с пациентом в течение 24 часов для записи на приём.
          </p>
        </div>
        <div class="footer">
          <p>© 2026 DocDocPartner. Все права защищены.</p>
          <p>Это автоматическое уведомление. Пожалуйста, не отвечайте на это письмо.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendInfoEmail({
    to: 'said.murtazin@mail.ru',
    subject: `Новая рекомендация пациента: ${referral.patientName}`,
    html,
  });
}

/**
 * Send agent status update notification
 */
export async function sendAgentStatusUpdate(params: {
  to: string;
  agentName: string;
  status: 'active' | 'rejected' | 'blocked';
  reason?: string;
}): Promise<boolean> {
  const statusMessages = {
    active: {
      title: '✅ Ваша заявка одобрена!',
      message: 'Поздравляем! Вы успешно зарегистрированы в программе DocDocPartner. Теперь вы можете начать отправлять рекомендации пациентов и зарабатывать.',
      color: '#10b981',
    },
    rejected: {
      title: '❌ Ваша заявка отклонена',
      message: 'К сожалению, ваша заявка на участие в программе DocDocPartner была отклонена.',
      color: '#ef4444',
    },
    blocked: {
      title: '🚫 Ваш аккаунт заблокирован',
      message: 'Ваш аккаунт в программе DocDocPartner был заблокирован.',
      color: '#dc2626',
    },
  };

  const statusInfo = statusMessages[params.status];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${statusInfo.color}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${statusInfo.title}</h1>
          <p>DocDocPartner</p>
        </div>
        <div class="content">
          <p>Здравствуйте, ${params.agentName}!</p>
          <p>${statusInfo.message}</p>
          ${params.reason ? `<p><strong>Причина:</strong> ${params.reason}</p>` : ''}
          ${params.status === 'active' ? '<p>Вернитесь в Telegram-бот, чтобы начать работу.</p>' : ''}
        </div>
        <div class="footer">
          <p>© 2026 DocDocPartner. Все права защищены.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: params.to,
    subject: statusInfo.title,
    html,
  });
}

/**
 * Send referral status update notification to agent
 */
export async function sendReferralStatusUpdate(params: {
  to: string;
  agentName: string;
  patientName: string;
  referralId: number;
  status: 'contacted' | 'scheduled' | 'completed' | 'cancelled';
  treatmentAmount?: number;
  commissionAmount?: number;
}): Promise<boolean> {
  const statusMessages = {
    contacted: {
      title: '📞 Клиника связалась с пациентом',
      message: 'Клиника связалась с вашим пациентом для записи на консультацию.',
      color: '#3b82f6',
    },
    scheduled: {
      title: '📅 Визит запланирован',
      message: 'Визит вашего пациента в клинику успешно запланирован.',
      color: '#8b5cf6',
    },
    completed: {
      title: '✅ Лечение завершено',
      message: 'Лечение вашего пациента завершено. Вознаграждение начислено.',
      color: '#10b981',
    },
    cancelled: {
      title: '❌ Рекомендация отменена',
      message: 'Рекомендация была отменена.',
      color: '#ef4444',
    },
  };

  const statusInfo = statusMessages[params.status];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${statusInfo.color}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${statusInfo.title}</h1>
          <p>DocDocPartner</p>
        </div>
        <div class="content">
          <p>Здравствуйте, ${params.agentName}!</p>
          <p>${statusInfo.message}</p>
          <div class="card">
            <p><strong>Пациент:</strong> ${params.patientName}</p>
            <p><strong>Рекомендация:</strong> #${params.referralId}</p>
            ${params.treatmentAmount ? `<p><strong>Сумма лечения:</strong> ${(params.treatmentAmount / 100).toLocaleString('ru-RU')} ₽</p>` : ''}
            ${params.commissionAmount ? `<p><strong>Ваше вознаграждение:</strong> ${(params.commissionAmount / 100).toLocaleString('ru-RU')} ₽</p>` : ''}
          </div>
        </div>
        <div class="footer">
          <p>© 2026 DocDocPartner. Все права защищены.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: params.to,
    subject: `${statusInfo.title} - ${params.patientName}`,
    html,
  });
}

/**
 * Send payment status update notification to agent
 */
export async function sendPaymentStatusUpdate(params: {
  to: string;
  agentName: string;
  paymentId: number;
  amount: number;
  status: 'processing' | 'completed' | 'failed';
  transactionId?: string;
}): Promise<boolean> {
  const statusMessages = {
    processing: {
      title: '⏳ Выплата обрабатывается',
      message: 'Ваша выплата находится в обработке.',
      color: '#f59e0b',
    },
    completed: {
      title: '✅ Выплата завершена',
      message: 'Выплата успешно завершена. Средства поступят на ваш счёт в течение 1-3 рабочих дней.',
      color: '#10b981',
    },
    failed: {
      title: '❌ Ошибка выплаты',
      message: 'Произошла ошибка при обработке выплаты. Пожалуйста, свяжитесь с поддержкой.',
      color: '#ef4444',
    },
  };

  const statusInfo = statusMessages[params.status];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${statusInfo.color}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${statusInfo.title}</h1>
          <p>DocDocPartner</p>
        </div>
        <div class="content">
          <p>Здравствуйте, ${params.agentName}!</p>
          <p>${statusInfo.message}</p>
          <div class="card">
            <p><strong>Выплата:</strong> #${params.paymentId}</p>
            <p><strong>Сумма:</strong> ${(params.amount / 100).toLocaleString('ru-RU')} ₽</p>
            ${params.transactionId ? `<p><strong>ID транзакции:</strong> ${params.transactionId}</p>` : ''}
          </div>
        </div>
        <div class="footer">
          <p>© 2026 DocDocPartner. Все права защищены.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: params.to,
    subject: `${statusInfo.title} - ${(params.amount / 100).toLocaleString('ru-RU')} ₽`,
    html,
  });
}
