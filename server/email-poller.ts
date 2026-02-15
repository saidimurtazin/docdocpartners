/**
 * IMAP Email Poller — reads unread emails from clinic reports mailbox
 * Uses connect-poll-disconnect pattern for Railway compatibility
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { ENV } from "./_core/env";

export interface EmailMessage {
  messageId: string;
  from: string;
  subject: string;
  date: Date;
  textBody: string;
}

/**
 * Poll for new (UNSEEN) emails from the clinic reports mailbox.
 * Connects, fetches, marks as SEEN, disconnects.
 */
export async function pollNewEmails(): Promise<EmailMessage[]> {
  if (!ENV.imapUser || !ENV.imapPass) {
    console.log("[EmailPoller] IMAP credentials not configured, skipping poll");
    return [];
  }

  const client = new ImapFlow({
    host: ENV.imapHost,
    port: ENV.imapPort,
    secure: true,
    auth: {
      user: ENV.imapUser,
      pass: ENV.imapPass,
    },
    logger: false, // suppress verbose IMAP logs
  });

  const emails: EmailMessage[] = [];

  try {
    await client.connect();
    console.log("[EmailPoller] Connected to IMAP");

    const lock = await client.getMailboxLock("INBOX");
    try {
      // Use fetch iterator to get all unseen messages with full source
      for await (const msg of client.fetch({ seen: false }, { source: true, uid: true })) {
        try {
          if (!msg.source) {
            console.log(`[EmailPoller] No source for UID ${msg.uid}, skipping`);
            continue;
          }

          // Parse email from raw source
          const parsed = await simpleParser(msg.source);

          const messageId = parsed.messageId || `no-id-${Date.now()}-${msg.uid}`;
          const from = typeof parsed.from?.text === "string"
            ? parsed.from.text
            : (parsed.from?.value?.[0]?.address || "unknown");
          const subject = parsed.subject || "(без темы)";
          const date = parsed.date || new Date();

          // Extract text: prefer text, fallback to stripped HTML
          let textBody = parsed.text || "";
          if (!textBody && parsed.html) {
            textBody = parsed.html
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/&nbsp;/g, " ")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/\s+/g, " ")
              .trim();
          }

          emails.push({ messageId, from, subject, date, textBody });

          // Mark as seen
          await client.messageFlagsAdd(String(msg.uid), ["\\Seen"], { uid: true });

          console.log(`[EmailPoller] Fetched: ${subject} from ${from}`);
        } catch (msgError) {
          console.error(`[EmailPoller] Error processing message ${msg.uid}:`, msgError);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    console.log(`[EmailPoller] Done, fetched ${emails.length} emails`);
  } catch (error) {
    console.error("[EmailPoller] IMAP connection error:", error);
    try { await client.logout(); } catch { /* ignore */ }
  }

  return emails;
}
