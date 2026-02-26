/**
 * Referral Matcher — fuzzy-matches AI-extracted patient data to existing referrals
 */
import { getDb } from "./db";
import { referrals, clinics } from "../drizzle/schema";
import { desc, sql } from "drizzle-orm";

// Cache clinics list (changes rarely, avoids repeated DB queries in batch processing)
let _clinicsCache: (typeof clinics.$inferSelect)[] | null = null;
let _clinicsCacheTime = 0;
const CLINICS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface AlternativeMatch {
  referralId: number;
  score: number;
  patientName: string;
  clinic: string | null;
}

export interface MatchResult {
  referralId: number | null;
  clinicId: number | null;
  matchConfidence: number; // 0-100
  hasAmbiguousMatch: boolean;
  alternativeMatches: AlternativeMatch[] | null;
}

/**
 * Simple Levenshtein distance
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Normalize a Russian name for comparison:
 * lowercase, trim, collapse whitespace, remove "ё" → "е"
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compare two Russian names (FIO) with fuzzy matching.
 * Returns similarity score 0-100.
 */
function compareNames(name1: string, name2: string): number {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  // Exact match
  if (n1 === n2) return 100;

  const tokens1 = n1.split(" ").filter(Boolean);
  const tokens2 = n2.split(" ").filter(Boolean);

  // Try matching tokens in any order (handle Last-First vs First-Last)
  let matchedTokens = 0;
  let totalScore = 0;
  const used = new Set<number>();

  for (const t1 of tokens1) {
    let bestScore = 0;
    let bestIdx = -1;

    for (let i = 0; i < tokens2.length; i++) {
      if (used.has(i)) continue;
      const t2 = tokens2[i];

      // Levenshtein-based similarity
      const maxLen = Math.max(t1.length, t2.length);
      if (maxLen === 0) continue;
      const dist = levenshtein(t1, t2);
      const sim = Math.round((1 - dist / maxLen) * 100);

      if (sim > bestScore) {
        bestScore = sim;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestScore >= 80) {
      used.add(bestIdx);
      matchedTokens++;
      totalScore += bestScore;
    }
  }

  if (matchedTokens === 0) return 0;

  // Require at least 67% of tokens to match (e.g., 2 of 3 for ФИО)
  const maxTokens = Math.max(tokens1.length, tokens2.length);
  if (matchedTokens < Math.ceil(maxTokens * 0.67)) {
    return 0;
  }

  // Weight by proportion of tokens matched
  const tokenCoverage = matchedTokens / maxTokens;
  const avgTokenScore = totalScore / matchedTokens;

  return Math.round(avgTokenScore * tokenCoverage);
}

/**
 * Compare clinic names with fuzzy matching. Returns similarity 0-100.
 */
function compareClinicNames(name1: string, name2: string): number {
  const n1 = normalizeName(name1)
    .replace(/[«»"]/g, "")
    .replace(/клиника\s*/g, "")
    .replace(/ооо\s*/g, "")
    .replace(/оао\s*/g, "")
    .trim();
  const n2 = normalizeName(name2)
    .replace(/[«»"]/g, "")
    .replace(/клиника\s*/g, "")
    .replace(/ооо\s*/g, "")
    .replace(/оао\s*/g, "")
    .trim();

  if (n1 === n2) return 100;

  // Substring match
  if (n1.includes(n2) || n2.includes(n1)) return 90;

  // Levenshtein
  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 0;
  const dist = levenshtein(n1, n2);
  return Math.round((1 - dist / maxLen) * 100);
}

/**
 * Extract bare email address from a "From" header value.
 * Handles formats like: "Display Name" <email@domain.com>, <email@domain.com>, email@domain.com
 */
function extractEmail(from: string): string {
  // Try to extract email from angle brackets: "Name" <email@domain.com>
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  // Try to find any email-like pattern
  const emailMatch = from.match(/[\w.+-]+@[\w.-]+\.\w+/);
  if (emailMatch) return emailMatch[0].toLowerCase().trim();
  // Fallback: return as-is
  return from.toLowerCase().trim();
}

/**
 * Find clinic by sender email address (matches against reportEmails JSON array).
 * Returns clinicId and clinicName if found.
 */
export async function findClinicByEmail(
  senderEmail: string
): Promise<{ clinicId: number | null; clinicName: string | null }> {
  const database = await getDb();
  if (!database) return { clinicId: null, clinicName: null };

  const allClinics = await database.select().from(clinics);
  const normalizedSender = extractEmail(senderEmail);

  for (const clinic of allClinics) {
    if (!clinic.reportEmails) continue;
    try {
      const emails: string[] = JSON.parse(clinic.reportEmails);
      if (Array.isArray(emails)) {
        for (const email of emails) {
          if (email.toLowerCase().trim() === normalizedSender) {
            return { clinicId: clinic.id, clinicName: clinic.name };
          }
        }
      }
    } catch {
      // ignore bad JSON
    }
  }

  return { clinicId: null, clinicName: null };
}

/**
 * Find clinic by name using fuzzy matching (for AI-extracted clinic names).
 * Returns clinicId and clinicName if a good match is found (>= 60% similarity).
 */
export async function findClinicByName(
  clinicNameQuery: string
): Promise<{ clinicId: number | null; clinicName: string | null }> {
  const database = await getDb();
  if (!database) return { clinicId: null, clinicName: null };

  const allClinics = await database.select().from(clinics);

  let bestScore = 0;
  let bestClinic: { id: number; name: string } | null = null;

  for (const clinic of allClinics) {
    const score = compareClinicNames(clinicNameQuery, clinic.name);
    if (score > bestScore) {
      bestScore = score;
      bestClinic = { id: clinic.id, name: clinic.name };
    }
  }

  if (bestScore >= 60 && bestClinic) {
    return { clinicId: bestClinic.id, clinicName: bestClinic.name };
  }

  return { clinicId: null, clinicName: null };
}

/**
 * Find the best matching referral for a parsed patient report.
 */
export async function findMatchingReferral(
  patientName: string | null,
  clinicName: string | null,
  visitDate: string | null,
  knownClinicId?: number | null
): Promise<MatchResult> {
  const result: MatchResult = { referralId: null, clinicId: null, matchConfidence: 0, hasAmbiguousMatch: false, alternativeMatches: null };

  if (!patientName) return result;

  const db = await getDb();
  if (!db) return result;

  // Get recent referrals (last 6 months) with date filter and limit
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const allReferrals = await db
    .select()
    .from(referrals)
    .where(sql`${referrals.createdAt} >= ${sixMonthsAgo}`)
    .orderBy(desc(referrals.createdAt))
    .limit(5000);

  // Filter to relevant statuses (not cancelled, not paid already)
  const candidates = allReferrals.filter(r =>
    ["new", "in_progress", "contacted", "scheduled", "visited"].includes(r.status)
  );

  // Match clinic — use known clinicId from email sender if available
  if (knownClinicId) {
    result.clinicId = knownClinicId;
  } else if (clinicName) {
    // Use cached clinics list to avoid repeated queries in batch processing
    if (!_clinicsCache || Date.now() - _clinicsCacheTime > CLINICS_CACHE_TTL) {
      _clinicsCache = await db.select().from(clinics);
      _clinicsCacheTime = Date.now();
    }
    const allClinics = _clinicsCache;
    let bestClinicScore = 0;
    for (const clinic of allClinics) {
      const score = compareClinicNames(clinicName, clinic.name);
      if (score > bestClinicScore) {
        bestClinicScore = score;
        result.clinicId = clinic.id;
      }
    }
    // Only keep if reasonable match
    if (bestClinicScore < 50) {
      result.clinicId = null;
    }
  }

  // Score all candidates
  const scoredCandidates: Array<{ referralId: number; score: number; patientName: string; clinic: string | null }> = [];

  for (const ref of candidates) {
    let score = compareNames(patientName, ref.patientFullName);

    // Boost if clinic matches
    if (clinicName && ref.clinic) {
      const clinicSim = compareClinicNames(clinicName, ref.clinic);
      if (clinicSim > 60) {
        score = Math.min(100, score + 10);
      }
    }

    // Boost if date is reasonable (referral created before visit)
    if (visitDate && ref.createdAt) {
      const visit = new Date(visitDate);
      const created = new Date(ref.createdAt);
      const daysDiff = (visit.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff >= 0 && daysDiff <= 90) {
        score = Math.min(100, score + 5);
      } else if (daysDiff < 0) {
        // Visit before referral? Suspicious, reduce score
        score = Math.max(0, score - 20);
      }
    }

    if (score > 0) {
      scoredCandidates.push({
        referralId: ref.id,
        score,
        patientName: ref.patientFullName,
        clinic: ref.clinic,
      });
    }
  }

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  const best = scoredCandidates[0];
  const secondBest = scoredCandidates[1];

  // Only link to referral if match confidence is strong enough (≥70)
  if (best && best.score >= 70) {
    result.referralId = best.referralId;
    result.matchConfidence = best.score;

    // Detect ambiguous match: second candidate is close to best AND also above threshold
    if (secondBest && secondBest.score >= 70 && (best.score - secondBest.score) <= 15) {
      result.hasAmbiguousMatch = true;
      result.alternativeMatches = scoredCandidates
        .filter(c => c.score >= 70)
        .slice(0, 5);
    }
  } else if (best) {
    result.matchConfidence = best.score;
  }

  return result;
}
