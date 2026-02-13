/**
 * Payout Calculation Service
 * Handles commission calculations based on self-employment status and monthly volume
 */

export interface PayoutCalculationInput {
  treatmentAmount: number; // в копейках
  isSelfEmployed: boolean;
  monthlyVolume: number; // общая сумма рекомендаций за месяц в копейках
}

export interface PayoutCalculationResult {
  grossAmount: number; // валовая сумма до вычетов (в копейках)
  netAmount: number; // чистая сумма к выплате (в копейках)
  commissionRate: number; // процент комиссии (7% или 10%)
  taxAmount: number; // сумма налогов (в копейках)
  socialContributions: number; // соц. отчисления (в копейках)
  details: string; // описание расчета
}

/**
 * Рассчитать вознаграждение агента
 */
export function calculatePayout(input: PayoutCalculationInput): PayoutCalculationResult {
  const { treatmentAmount, isSelfEmployed, monthlyVolume } = input;

  // Определяем ставку комиссии
  const commissionRate = monthlyVolume > 100_000_000 ? 0.10 : 0.07; // >1M RUB = 10%, иначе 7%

  // Валовая сумма
  const grossAmount = Math.floor(treatmentAmount * commissionRate);

  let netAmount: number;
  let taxAmount: number;
  let socialContributions: number;
  let details: string;

  if (isSelfEmployed) {
    // Самозанятый: платит 6% налог сам
    netAmount = grossAmount;
    taxAmount = 0; // агент платит сам
    socialContributions = 0;
    details = `Самозанятый: ${commissionRate * 100}% от ${treatmentAmount / 100} ₽ = ${grossAmount / 100} ₽. Налог 6% (${Math.floor(grossAmount * 0.06) / 100} ₽) агент платит самостоятельно.`;
  } else {
    // Не самозанятый: вычитаем НДФЛ 13% + соц. отчисления ~30%
    const ndfl = Math.floor(grossAmount * 0.13); // 13% НДФЛ
    socialContributions = Math.floor(grossAmount * 0.30); // ~30% соц. отчисления
    taxAmount = ndfl;
    netAmount = grossAmount - ndfl - socialContributions;
    
    details = `Не самозанятый: ${commissionRate * 100}% от ${treatmentAmount / 100} ₽ = ${grossAmount / 100} ₽. Минус НДФЛ 13% (${ndfl / 100} ₽) и соц. отчисления 30% (${socialContributions / 100} ₽) = ${netAmount / 100} ₽ к выплате.`;
  }

  return {
    grossAmount,
    netAmount,
    commissionRate,
    taxAmount,
    socialContributions,
    details,
  };
}

/**
 * Проверить, может ли агент запросить выплату
 */
export function canRequestPayout(totalReferrals: number, bonusPoints: number): {
  canWithdraw: boolean;
  reason?: string;
} {
  // Для вывода бонусных баллов нужно минимум 10 собственных рекомендаций
  if (bonusPoints > 0 && totalReferrals < 10) {
    return {
      canWithdraw: false,
      reason: `Для вывода бонусных баллов необходимо минимум 10 собственных рекомендаций. У вас: ${totalReferrals}`,
    };
  }

  return { canWithdraw: true };
}
