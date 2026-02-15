/**
 * Clinic Report Processor — orchestrates email polling → AI parsing → referral matching → DB insert
 */
import { pollNewEmails } from "./email-poller";
import { parseClinicEmail } from "./clinic-report-parser";
import { findMatchingReferral, findClinicByEmail } from "./referral-matcher";
import * as db from "./db";

export interface ProcessResult {
  processed: number;
  errors: number;
  created: number;
  skipped: number;
}

/**
 * Main processing pipeline: poll emails, parse with AI, match to referrals, store in DB.
 * Processes emails sequentially to avoid LLM rate limits.
 */
export async function processNewClinicEmails(): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, errors: 0, created: 0, skipped: 0 };

  try {
    // 1. Poll new emails
    const emails = await pollNewEmails();
    if (emails.length === 0) return result;

    for (const email of emails) {
      try {
        result.processed++;

        // 2. Check dedup — skip if this email was already processed
        const existing = await db.getClinicReportByEmailMessageId(email.messageId);
        if (existing) {
          console.log(`[Processor] Skipping duplicate email: ${email.messageId}`);
          result.skipped++;
          continue;
        }

        // 3. Try to identify clinic by sender email (from reportEmails field)
        const senderClinic = await findClinicByEmail(email.from);
        if (senderClinic.clinicId) {
          console.log(`[Processor] Identified clinic by email: ${email.from} → ${senderClinic.clinicName} (id=${senderClinic.clinicId})`);
        }

        // 4. Parse with AI
        const patients = await parseClinicEmail(email.textBody, email.from, email.subject);

        if (patients.length === 0) {
          // Save the email anyway with empty extraction (for admin review)
          await db.createClinicReport({
            clinicId: senderClinic.clinicId,
            emailFrom: email.from,
            emailSubject: email.subject,
            emailMessageId: email.messageId,
            emailReceivedAt: email.date,
            emailBodyRaw: email.textBody.substring(0, 50000), // Limit raw body size
            patientName: null,
            visitDate: null,
            treatmentAmount: 0,
            services: "[]",
            clinicName: senderClinic.clinicName,
            status: "pending_review",
            aiConfidence: 0,
            matchConfidence: 0,
          });
          result.created++;
          continue;
        }

        // 5. For each patient in the email
        for (let i = 0; i < patients.length; i++) {
          const patient = patients[i];

          // Unique messageId per patient in multi-patient emails
          const patientMessageId = patients.length > 1
            ? `${email.messageId}::patient-${i}`
            : email.messageId;

          // Check dedup for this patient-specific ID
          const existingPatient = await db.getClinicReportByEmailMessageId(patientMessageId);
          if (existingPatient) {
            result.skipped++;
            continue;
          }

          // Use clinic name from sender email detection if AI didn't extract one
          const effectiveClinicName = patient.clinicName || senderClinic.clinicName;

          // 6. Match to referral (pass known clinicId from email detection)
          const match = await findMatchingReferral(
            patient.patientName,
            effectiveClinicName,
            patient.visitDate,
            senderClinic.clinicId
          );

          // Determine status — boost confidence if clinic was identified by email
          let finalMatchConfidence = match.matchConfidence;
          if (senderClinic.clinicId && match.referralId) {
            finalMatchConfidence = Math.min(100, finalMatchConfidence + 10);
          }
          const status = finalMatchConfidence >= 85 ? "auto_matched" : "pending_review";

          // Convert treatment amount from rubles to kopecks
          const treatmentKopecks = patient.treatmentAmount ? Math.round(patient.treatmentAmount * 100) : 0;

          // 7. Insert into DB
          await db.createClinicReport({
            referralId: match.referralId,
            clinicId: senderClinic.clinicId || match.clinicId,
            emailFrom: email.from,
            emailSubject: email.subject,
            emailMessageId: patientMessageId,
            emailReceivedAt: email.date,
            emailBodyRaw: email.textBody.substring(0, 50000),
            patientName: patient.patientName,
            visitDate: patient.visitDate,
            treatmentAmount: treatmentKopecks,
            services: JSON.stringify(patient.services),
            clinicName: effectiveClinicName,
            status,
            aiConfidence: patient.confidence,
            matchConfidence: finalMatchConfidence,
          });

          result.created++;
          console.log(
            `[Processor] Created report: ${patient.patientName} | clinic: ${effectiveClinicName} | confidence: ${patient.confidence}% | match: ${finalMatchConfidence}% | status: ${status}`
          );
        }
      } catch (emailError) {
        console.error(`[Processor] Error processing email ${email.messageId}:`, emailError);
        result.errors++;
      }
    }
  } catch (error) {
    console.error("[Processor] Pipeline error:", error);
    result.errors++;
  }

  console.log(
    `[Processor] Done: processed=${result.processed}, created=${result.created}, skipped=${result.skipped}, errors=${result.errors}`
  );
  return result;
}
