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
    logger: false,
  });

  const emails: EmailMessage[] = [];

  try {
    await client.connect();
    console.log("[EmailPoller] Connected to IMAP");

    const lock = await client.getMailboxLock("INBOX");
    try {
      // Step 1: Search for unseen message UIDs
      const unseenUids = await client.search({ seen: false }, { uid: true });
      console.log(`[EmailPoller] Found ${unseenUids.length} unseen messages`);

      if (unseenUids.length === 0) {
        console.log("[EmailPoller] No unseen messages, nothing to fetch");
      } else {
        // Step 2: Fetch each message by UID individually
        for (const uid of unseenUids) {
          try {
            const { content } = await client.download(String(uid), undefined, { uid: true });

            if (!content) {
              console.log(`[EmailPoller] No content for UID ${uid}, skipping`);
              continue;
            }

            // Read stream into buffer
            const chunks: Buffer[] = [];
            for await (const chunk of content) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const rawSource = Buffer.concat(chunks);

            // Parse email
            const parsed = await simpleParser(rawSource);

            const messageId = parsed.messageId || `no-id-${Date.now()}-${uid}`;
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
            await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });

            console.log(`[EmailPoller] Fetched UID ${uid}: "${subject}" from ${from}`);
          } catch (msgError: any) {
            console.error(`[EmailPoller] Error processing UID ${uid}:`, msgError.message);
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    console.log(`[EmailPoller] Done, fetched ${emails.length} emails`);
  } catch (error: any) {
    console.error("[EmailPoller] IMAP error:", error.message);
    try { await client.logout(); } catch { /* ignore */ }
  }

  return emails;
}
