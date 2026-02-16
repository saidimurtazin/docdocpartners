/**
 * AI Clinic Report Parser — uses Google Gemini 2.5 Flash to extract structured data from clinic emails
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ENV } from "./_core/env";

export interface ParsedPatientReport {
  patientName: string | null;
  visitDate: string | null;
  treatmentAmount: number | null; // в рублях (конвертим в копейки при сохранении)
  services: string[];
  clinicName: string | null;
  confidence: number; // 0-100
}

const SYSTEM_PROMPT = `Ты — AI-ассистент для обработки email-отчётов от клиник-партнёров DocDocPartner.

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

/**
 * Parse a clinic email body and extract patient visit data using Google Gemini
 */
export async function parseClinicEmail(
  emailBody: string,
  emailFrom: string,
  emailSubject: string
): Promise<ParsedPatientReport[]> {
  if (!emailBody || emailBody.trim().length < 10) {
    console.log("[ClinicParser] Email body too short, skipping");
    return [];
  }

  if (!ENV.geminiApiKey) {
    console.error("[ClinicParser] GEMINI_API_KEY not configured, skipping AI parsing");
    return [];
  }

  // Truncate very long emails
  const truncatedBody = emailBody.length > 15000 ? emailBody.substring(0, 15000) + "\n...(обрезано)" : emailBody;

  try {
    const genAI = new GoogleGenerativeAI(ENV.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
      },
    });

    const prompt = `${SYSTEM_PROMPT}\n\nПроанализируй это письмо от клиники:\n\nОт: ${emailFrom}\nТема: ${emailSubject}\n\nТекст письма:\n${truncatedBody}`;

    console.log(`[ClinicParser] Calling Gemini for email: "${emailSubject}" (body length: ${truncatedBody.length})`);
    const result = await model.generateContent(prompt);
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
