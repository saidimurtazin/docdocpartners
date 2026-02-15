/**
 * AI Clinic Report Parser — uses Gemini 2.5 Flash to extract structured data from clinic emails
 */
import { invokeLLM } from "./_core/llm";

export interface ParsedPatientReport {
  patientName: string | null;
  visitDate: string | null;
  treatmentAmount: number | null; // в рублях (конвертим в копейки при сохранении)
  services: string[];
  clinicName: string | null;
  confidence: number; // 0-100
}

const SYSTEM_PROMPT = `Ты — AI-ассистент для обработки email-отчётов от клиник-партнёров DocDocPartner.

Твоя задача: извлечь из текста письма информацию о визитах пациентов.

Из каждого письма извлеки следующие данные для КАЖДОГО упомянутого пациента:
1. patientName — ФИО пациента (полностью, как указано в письме)
2. visitDate — дата визита/приёма (в формате YYYY-MM-DD если возможно, иначе как указано)
3. treatmentAmount — сумма лечения в рублях (число без копеек; 0 если не указана)
4. services — список оказанных услуг (массив строк)
5. clinicName — название клиники-отправителя

Важные правила:
- Если в письме упоминается несколько пациентов, верни массив объектов для каждого
- Если данные неясны или отсутствуют, используй null
- Поле confidence (0-100) — твоя уверенность в корректности извлечённых данных
- Суммы указывай в рублях (целое число)
- Не придумывай данные — извлекай только то, что реально есть в тексте
- Если письмо не содержит информации о визитах пациентов (реклама, спам, автоответ), верни пустой массив patients

Ответ СТРОГО в формате JSON:
{
  "patients": [
    {
      "patientName": "Иванов Иван Иванович",
      "visitDate": "2025-01-15",
      "treatmentAmount": 150000,
      "services": ["Консультация терапевта", "УЗИ"],
      "clinicName": "МЕДСИ",
      "confidence": 85
    }
  ]
}`;

/**
 * Parse a clinic email body and extract patient visit data using AI
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

  // Truncate very long emails (Gemini context limit)
  const truncatedBody = emailBody.length > 15000 ? emailBody.substring(0, 15000) + "\n...(обрезано)" : emailBody;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Проанализируй это письмо от клиники:\n\nОт: ${emailFrom}\nТема: ${emailSubject}\n\nТекст письма:\n${truncatedBody}`,
        },
      ],
      responseFormat: { type: "json_object" },
    });

    // Extract content from LLM response
    const content = result.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      console.log("[ClinicParser] No content in LLM response");
      return [];
    }

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
