/**
 * Clinic Report Processor — orchestrates email polling → AI parsing → referral matching → DB insert
 */
import { pollNewEmails } from "./email-poller";
import { parseClinicEmail } from "./clinic-report-parser";
import { findMatchingReferral, findClinicByEmail, findClinicByName } from "./referral-matcher";
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

        // 3. Identify clinic by sender email — only process emails from known clinic addresses
        const senderClinic = await findClinicByEmail(email.from);
        if (!senderClinic.clinicId) {
          console.log(`[Processor] Ignoring email from unknown sender: ${email.from} (not in any clinic's reportEmails)`);
          result.skipped++;
          continue;
        }
        console.log(`[Processor] Identified clinic by email: ${email.from} → ${senderClinic.clinicName} (id=${senderClinic.clinicId})`);

        // 4. Parse with AI (pass attachments for multimodal processing)
        const patients = await parseClinicEmail(email.textBody, email.from, email.subject, email.attachments);

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

          // Use AI-extracted clinic name as priority, fallback to sender clinic
          const effectiveClinicName = patient.clinicName || senderClinic.clinicName;

          // If AI found a different clinic name, try to resolve its ID from DB
          let effectiveClinicId = senderClinic.clinicId;
          if (patient.clinicName && patient.clinicName !== senderClinic.clinicName) {
            const resolved = await findClinicByName(patient.clinicName);
            if (resolved.clinicId) {
              effectiveClinicId = resolved.clinicId;
              console.log(`[Processor] AI clinic "${patient.clinicName}" resolved to DB clinic id=${resolved.clinicId} "${resolved.clinicName}"`);
            } else {
              console.log(`[Processor] AI clinic "${patient.clinicName}" not found in DB, keeping sender clinic id=${senderClinic.clinicId}`);
            }
          }

          // 6. Match to referral (pass resolved clinicId)
          const match = await findMatchingReferral(
            patient.patientName,
            effectiveClinicName,
            patient.visitDate,
            effectiveClinicId
          );

          // Determine status — boost confidence if clinic was identified by email
          let finalMatchConfidence = match.matchConfidence;
          if (effectiveClinicId && match.referralId) {
            finalMatchConfidence = Math.min(100, finalMatchConfidence + 5);
          }
          const status = finalMatchConfidence >= 95 ? "auto_matched" : "pending_review";

          // Convert treatment amount from rubles to kopecks
          const treatmentKopecks = patient.treatmentAmount ? Math.round(patient.treatmentAmount * 100) : 0;

          // 7. Insert into DB
          await db.createClinicReport({
            referralId: match.referralId,
            clinicId: effectiveClinicId || match.clinicId,
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
