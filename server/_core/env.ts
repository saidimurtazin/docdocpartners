export const ENV = {
  cookieSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "https://oauth.manus.space",
  appId: process.env.VITE_APP_ID ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
};
