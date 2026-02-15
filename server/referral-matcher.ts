/**
 * Referral Matcher — fuzzy-matches AI-extracted patient data to existing referrals
 */
import { getDb } from "./db";
import { referrals, clinics } from "../drizzle/schema";
import { desc } from "drizzle-orm";

export interface MatchResult {
  referralId: number | null;
  clinicId: number | null;
  matchConfidence: number; // 0-100
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

    if (bestIdx >= 0 && bestScore >= 60) {
      used.add(bestIdx);
      matchedTokens++;
      totalScore += bestScore;
    }
  }

  if (matchedTokens === 0) return 0;

  // Weight by proportion of tokens matched
  const maxTokens = Math.max(tokens1.length, tokens2.length);
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
 * Find the best matching referral for a parsed patient report.
 */
export async function findMatchingReferral(
  patientName: string | null,
  clinicName: string | null,
  visitDate: string | null
): Promise<MatchResult> {
  const result: MatchResult = { referralId: null, clinicId: null, matchConfidence: 0 };

  if (!patientName) return result;

  const db = await getDb();
  if (!db) return result;

  // Get recent referrals (last 6 months)
  const allReferrals = await db
    .select()
    .from(referrals)
    .orderBy(desc(referrals.createdAt));

  // Filter to relevant statuses (not cancelled, not paid already)
  const candidates = allReferrals.filter(r =>
    ["new", "in_progress", "contacted", "scheduled", "visited"].includes(r.status)
  );

  // Match clinic to clinics table
  if (clinicName) {
    const allClinics = await db.select().from(clinics);
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

  // Match patient name to referrals
  let bestScore = 0;
  let bestReferralId: number | null = null;

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

    if (score > bestScore) {
      bestScore = score;
      bestReferralId = ref.id;
    }
  }

  result.referralId = bestReferralId;
  result.matchConfidence = bestScore;

  return result;
}
