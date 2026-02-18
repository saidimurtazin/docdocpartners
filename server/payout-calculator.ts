/**
 * Payout Calculation Service
 * Handles commission calculations based on self-employment status
 * Commission rate is now determined by global tiers in admin settings
 */

export interface PayoutCalculationInput {
  treatmentAmount: number; // в копейках
  isSelfEmployed: boolean;
  commissionRate: number;  // процент комиссии (определяется тирами)
}

export interface PayoutCalculationResult {
  grossAmount: number; // валовая сумма до вычетов (в копейках)
  netAmount: number; // чистая сумма к выплате (в копейках)
  commissionRate: number; // процент комиссии
  taxAmount: number; // сумма налогов (в копейках)
  socialContributions: number; // соц. отчисления (в копейках)
  details: string; // описание расчета
}

/**
 * Рассчитать вознаграждение агента
 */
export function calculatePayout(input: PayoutCalculationInput): PayoutCalculationResult {
  const { treatmentAmount, isSelfEmployed, commissionRate } = input;

  // Ставка как десятичная дробь
  const rate = commissionRate / 100;

  // Валовая сумма
  const grossAmount = Math.floor(treatmentAmount * rate);

  let netAmount: number;
  let taxAmount: number;
  let socialContributions: number;
  let details: string;

  if (isSelfEmployed) {
    // Самозанятый: платит 6% НПД сам, мы выплачиваем полную сумму
    netAmount = grossAmount;
    taxAmount = 0;
    socialContributions = 0;
    details = `Самозанятый: ${commissionRate}% от ${treatmentAmount / 100} ₽ = ${grossAmount / 100} ₽. Налог 6% НПД (${Math.floor(grossAmount * 0.06) / 100} ₽) агент платит самостоятельно.`;
  } else {
    // Физлицо: вычитаем НДФЛ 13% + соц. отчисления 30%
    const ndfl = Math.floor(grossAmount * 0.13);
    socialContributions = Math.floor(grossAmount * 0.30);
    taxAmount = ndfl;
    netAmount = grossAmount - ndfl - socialContributions;

    details = `Физлицо: ${commissionRate}% от ${treatmentAmount / 100} ₽ = ${grossAmount / 100} ₽. Минус НДФЛ 13% (${ndfl / 100} ₽) и соц. отчисления 30% (${socialContributions / 100} ₽) = ${netAmount / 100} ₽ к выплате.`;
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
