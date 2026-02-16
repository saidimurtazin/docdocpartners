/**
 * IMAP Email Poller — reads unread emails from clinic reports mailbox
 * Uses connect-poll-disconnect pattern for Railway compatibility
 * Supports attachments: PDF, Excel (xlsx/xls), Word (docx)
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { ENV } from "./_core/env";

export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;  // raw file bytes
  size: number;
}

export interface EmailMessage {
  messageId: string;
  from: string;
  subject: string;
  date: Date;
  textBody: string;
  attachments: EmailAttachment[];
}

// Supported attachment MIME types
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel", // xls
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/msword", // doc
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

// Max attachment size: 10MB
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

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

            // Extract supported attachments
            const attachments: EmailAttachment[] = [];
            if (parsed.attachments && parsed.attachments.length > 0) {
              for (const att of parsed.attachments) {
                const mimeType = (att.contentType || "").toLowerCase();
                const filename = att.filename || "unnamed";
                const ext = filename.split(".").pop()?.toLowerCase() || "";

                // Check by MIME type or file extension
                const isSupportedMime = SUPPORTED_MIME_TYPES.has(mimeType);
                const isSupportedExt = ["pdf", "xlsx", "xls", "docx", "doc", "png", "jpg", "jpeg", "webp"].includes(ext);

                if ((isSupportedMime || isSupportedExt) && att.content && att.size <= MAX_ATTACHMENT_SIZE) {
                  attachments.push({
                    filename,
                    contentType: mimeType || `application/${ext}`,
                    content: att.content,
                    size: att.size,
                  });
                  console.log(`[EmailPoller] Attachment: "${filename}" (${mimeType}, ${Math.round(att.size / 1024)}KB)`);
                } else if (att.size > MAX_ATTACHMENT_SIZE) {
                  console.log(`[EmailPoller] Skipping attachment "${filename}" — too large (${Math.round(att.size / 1024 / 1024)}MB)`);
                }
              }
            }

            emails.push({ messageId, from, subject, date, textBody, attachments });

            // Mark as seen
            await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });

            console.log(`[EmailPoller] Fetched UID ${uid}: "${subject}" from ${from} (${attachments.length} attachments)`);
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
