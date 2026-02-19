/**
 * AI Clinic Report Parser — uses Google Gemini 2.5 Flash to extract structured data from clinic emails
 * Supports: plain text, PDF (native), images (native), Excel (text extraction), Word (text extraction)
 */
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { ENV } from "./_core/env";
import type { EmailAttachment } from "./email-poller";

export interface ParsedPatientReport {
  patientName: string | null;
  visitDate: string | null;
  treatmentAmount: number | null; // в рублях (конвертим в копейки при сохранении)
  services: string[];
  clinicName: string | null;
  confidence: number; // 0-100
}

const SYSTEM_PROMPT = `Ты — AI-ассистент для обработки email-отчётов от клиник-партнёров DocPartner.

Твоя задача: извлечь из текста письма информацию о пациентах и их визитах.

Из каждого письма извлеки следующие данные для КАЖДОГО упомянутого пациента:
1. patientName — ФИО пациента (полностью, как указано в письме). Это САМОЕ ВАЖНОЕ поле.
2. visitDate — дата визита/приёма (в формате YYYY-MM-DD). Если указан только день.месяц — используй текущий год.
3. treatmentAmount — сумма лечения/оплаты в рублях (целое число). Парси "300 000,00 ₽" как 300000, "1 000 000 руб" как 1000000. Если указана сумма с пробелами между разрядами — убери пробелы.
4. services — список оказанных услуг (массив строк)
5. clinicName — название клиники, ГДЕ пациент лечился/был на приёме (НЕ отправитель письма, а клиника из текста). Примеры: "Olymp Clinic", "МЕДСИ", "СМ-Клиника".

Важные правила:
- Если в письме есть хотя бы ФИО человека — это пациент, извлеки его данные
- Даже если в письме минимум информации (только ФИО, телефон, дата рождения) — всё равно верни пациента с patientName
- Если в письме упоминается несколько пациентов, верни массив объектов для каждого
- Если данные неясны или отсутствуют, используй null для этого поля
- Поле confidence (0-100) — твоя уверенность в корректности извлечённых данных
- Суммы указывай строго в рублях как целое число (без копеек, без пробелов)
- Не придумывай данные — извлекай только то, что реально есть в тексте
- Анализируй ВСЮ информацию: текст письма + вложенные файлы (PDF, Excel таблицы, Word документы, изображения)
- Если данные есть и в тексте и в файле — объедини их
- Если письмо явно спам, реклама или автоответ без упоминания пациентов — верни пустой массив patients

Ответ СТРОГО в формате JSON:
{
  "patients": [
    {
      "patientName": "Иванов Иван Иванович",
      "visitDate": "2025-01-15",
      "treatmentAmount": 300000,
      "services": ["Консультация терапевта", "УЗИ"],
      "clinicName": "Olymp Clinic",
      "confidence": 85
    }
  ]
}`;

// MIME types that Gemini can process natively (as inline data)
const GEMINI_NATIVE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

/**
 * Extract text from Excel file (xlsx/xls) using xlsx library
 */
async function extractExcelText(buffer: Buffer): Promise<string> {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const lines: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      lines.push(`=== Лист: ${sheetName} ===`);
      // Convert to CSV-like text
      const csv = XLSX.utils.sheet_to_csv(sheet, { FS: " | ", RS: "\n" });
      lines.push(csv);
    }

    const text = lines.join("\n").trim();
    console.log(`[ClinicParser] Excel extracted: ${text.length} chars from ${workbook.SheetNames.length} sheets`);
    return text;
  } catch (error: any) {
    console.error("[ClinicParser] Excel extraction error:", error.message);
    return "";
  }
}

/**
 * Extract text from Word file (docx) using mammoth library
 */
async function extractWordText(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    console.log(`[ClinicParser] Word extracted: ${text.length} chars`);
    return text;
  } catch (error: any) {
    console.error("[ClinicParser] Word extraction error:", error.message);
    return "";
  }
}

/**
 * Parse a clinic email body and extract patient visit data using Google Gemini.
 * Supports attachments: PDF/images sent natively to Gemini, Excel/Word converted to text.
 */
export async function parseClinicEmail(
  emailBody: string,
  emailFrom: string,
  emailSubject: string,
  attachments: EmailAttachment[] = []
): Promise<ParsedPatientReport[]> {
  const hasAttachments = attachments.length > 0;
  const bodyTooShort = !emailBody || emailBody.trim().length < 10;

  if (bodyTooShort && !hasAttachments) {
    console.log("[ClinicParser] Email body too short and no attachments, skipping");
    return [];
  }

  if (!ENV.geminiApiKey) {
    console.error("[ClinicParser] GEMINI_API_KEY not configured, skipping AI parsing");
    return [];
  }

  // Truncate very long emails
  const truncatedBody = emailBody && emailBody.length > 15000
    ? emailBody.substring(0, 15000) + "\n...(обрезано)"
    : (emailBody || "");

  try {
    const genAI = new GoogleGenerativeAI(ENV.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
      },
    });

    // Build multimodal content parts
    const parts: Part[] = [];

    // 1. Text prompt (always first)
    let textPrompt = `${SYSTEM_PROMPT}\n\nПроанализируй это письмо от клиники:\n\nОт: ${emailFrom}\nТема: ${emailSubject}\n`;

    if (truncatedBody) {
      textPrompt += `\nТекст письма:\n${truncatedBody}\n`;
    }

    // 2. Process attachments
    const extraTexts: string[] = [];

    for (const att of attachments) {
      const ext = att.filename.split(".").pop()?.toLowerCase() || "";
      const isNative = GEMINI_NATIVE_TYPES.has(att.contentType) ||
        att.contentType === "image/jpg" ||
        ext === "pdf" || ["png", "jpg", "jpeg", "webp"].includes(ext);

      if (isNative) {
        // PDF and images — send as inline data to Gemini (native multimodal)
        const mimeType = att.contentType === "image/jpg" ? "image/jpeg" : att.contentType;
        console.log(`[ClinicParser] Adding native attachment: "${att.filename}" (${mimeType}, ${Math.round(att.size / 1024)}KB)`);
        // Add text part first, then inline data
        textPrompt += `\n[Вложение: ${att.filename}]\n`;
      } else if (["xlsx", "xls"].includes(ext) || att.contentType.includes("spreadsheet") || att.contentType.includes("excel")) {
        // Excel — extract text
        const excelText = await extractExcelText(att.content);
        if (excelText) {
          extraTexts.push(`\n--- Данные из файла "${att.filename}" (Excel) ---\n${excelText}\n`);
        }
      } else if (["docx", "doc"].includes(ext) || att.contentType.includes("word")) {
        // Word — extract text
        const wordText = await extractWordText(att.content);
        if (wordText) {
          extraTexts.push(`\n--- Данные из файла "${att.filename}" (Word) ---\n${wordText}\n`);
        }
      }
    }

    // Append extracted texts to prompt
    if (extraTexts.length > 0) {
      textPrompt += extraTexts.join("\n");
    }

    // Add text part
    parts.push({ text: textPrompt });

    // Add native file parts (PDF, images) as inline data
    for (const att of attachments) {
      const ext = att.filename.split(".").pop()?.toLowerCase() || "";
      const isNative = GEMINI_NATIVE_TYPES.has(att.contentType) ||
        att.contentType === "image/jpg" ||
        ext === "pdf" || ["png", "jpg", "jpeg", "webp"].includes(ext);

      if (isNative) {
        let mimeType = att.contentType;
        if (mimeType === "image/jpg") mimeType = "image/jpeg";
        if (ext === "pdf" && !mimeType.includes("pdf")) mimeType = "application/pdf";

        parts.push({
          inlineData: {
            mimeType,
            data: att.content.toString("base64"),
          },
        });
      }
    }

    const attachmentInfo = hasAttachments
      ? ` + ${attachments.length} attachments (${attachments.map(a => a.filename).join(", ")})`
      : "";
    console.log(`[ClinicParser] Calling Gemini: "${emailSubject}" (body: ${truncatedBody.length} chars${attachmentInfo})`);

    const result = await model.generateContent(parts);
    const content = result.response.text();

    if (!content) {
      console.log("[ClinicParser] No content in Gemini response");
      return [];
    }

    console.log(`[ClinicParser] Gemini raw response: ${content.substring(0, 500)}`);

    const parsed = JSON.parse(content);
    const patients: ParsedPatientReport[] = [];

    if (Array.isArray(parsed.patients)) {
      for (const p of parsed.patients) {
        patients.push({
          patientName: typeof p.patientName === "string" ? p.patientName : null,
          visitDate: typeof p.visitDate === "string" ? p.visitDate : null,
          treatmentAmount: typeof p.treatmentAmount === "number" ? p.treatmentAmount : null,
          services: Array.isArray(p.services) ? p.services.filter((s: unknown) => typeof s === "string") : [],
          clinicName: typeof p.clinicName === "string" ? p.clinicName : null,
          confidence: typeof p.confidence === "number" ? Math.min(100, Math.max(0, p.confidence)) : 50,
        });
      }
    }

    console.log(`[ClinicParser] Extracted ${patients.length} patient reports`);
    return patients;
  } catch (error) {
    console.error("[ClinicParser] AI parsing error:", error);
    return [];
  }
}
