function getJwtSecretSafe(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production!");
  }
  return "dev-secret-do-not-use-in-production";
}

export const ENV = {
  cookieSecret: getJwtSecretSafe(),
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "https://oauth.manus.space",
  appId: process.env.VITE_APP_ID ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  /** Telegram ID администратора для получения уведомлений о новых заявках на выплату */
  adminTelegramId: process.env.ADMIN_TELEGRAM_ID ?? "",
  /** Public-facing URL of the app (e.g. https://docdocpartners-production.up.railway.app) */
  appUrl: process.env.APP_URL
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:5173"),
  /** IMAP credentials for clinic reports email polling */
  imapHost: process.env.IMAP_HOST ?? "imap.mail.ru",
  imapPort: parseInt(process.env.IMAP_PORT ?? "993"),
  imapUser: process.env.IMAP_USER ?? "",
  imapPass: process.env.IMAP_PASS ?? "",
  /** Google Gemini API key for AI parsing of clinic emails */
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  /** Company requisites for payment acts */
  companyName: process.env.COMPANY_NAME ?? "",
  companyInn: process.env.COMPANY_INN ?? "",
  companyOgrn: process.env.COMPANY_OGRN ?? "",
  companyAddress: process.env.COMPANY_ADDRESS ?? "",
  companyBankName: process.env.COMPANY_BANK_NAME ?? "",
  companyBankAccount: process.env.COMPANY_BANK_ACCOUNT ?? "",
  companyBankBik: process.env.COMPANY_BANK_BIK ?? "",
  companyDirector: process.env.COMPANY_DIRECTOR ?? "",
  /** SMTP credentials for noreply@ transactional emails (OTP, agent notifications) */
  smtpNoReplyUser: process.env.SMTP_NOREPLY_USER ?? "",
  smtpNoReplyPass: process.env.SMTP_NOREPLY_PASS ?? "",
  /** Jump.Finance API integration */
  jumpFinanceApiKey: process.env.JUMP_FINANCE_API_KEY ?? "",
  jumpFinanceAgentId: process.env.JUMP_FINANCE_AGENT_ID ?? "",
  jumpFinanceBankAccountId: process.env.JUMP_FINANCE_BANK_ACCOUNT_ID ?? "",
};
