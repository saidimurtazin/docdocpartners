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
      // Search for unseen messages
      const unseenMessages = await client.search({ seen: false });

      if (unseenMessages.length === 0) {
        console.log("[EmailPoller] No new emails");
        return [];
      }

      console.log(`[EmailPoller] Found ${unseenMessages.length} unread emails`);

      for (const uid of unseenMessages) {
        try {
          // Fetch full message source
          const download = await client.download(uid.toString(), undefined, { uid: true });

          if (!download || !download.content) continue;

          // Collect stream chunks
          const chunks: Buffer[] = [];
          for await (const chunk of download.content) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const rawEmail = Buffer.concat(chunks);

          // Parse email
          const parsed = await simpleParser(rawEmail);

          const messageId = parsed.messageId || `no-id-${Date.now()}-${uid}`;
          const from = typeof parsed.from?.text === "string" ? parsed.from.text : (parsed.from?.value?.[0]?.address || "unknown");
          const subject = parsed.subject || "(без темы)";
          const date = parsed.date || new Date();

          // Extract text: prefer text, fallback to stripped HTML
          let textBody = parsed.text || "";
          if (!textBody && parsed.html) {
            // Simple HTML-to-text: strip tags
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
          await client.messageFlagsAdd(uid.toString(), ["\\Seen"], { uid: true });
        } catch (msgError) {
          console.error(`[EmailPoller] Error processing message ${uid}:`, msgError);
          // Continue with next message
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
