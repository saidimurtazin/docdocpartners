/**
 * Shared referral status labels, colors, and utility functions.
 * Single source of truth — used across Dashboard, Referrals, and other agent pages.
 */

export const referralStatusLabels: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  contacted: "Связались",
  scheduled: "Записан",
  booked: "Забронирован",
  booked_elsewhere: "В другой клинике",
  visited: "Приём состоялся",
  paid: "Оплачено",
  duplicate: "Дубликат",
  no_answer: "Не дозвонились",
  cancelled: "Отменена",
};

/** CSS classes for status badges (border style) */
export const referralStatusColors: Record<string, string> = {
  new: "bg-amber-100 text-amber-800 border-amber-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  contacted: "bg-sky-100 text-sky-800 border-sky-200",
  scheduled: "bg-purple-100 text-purple-800 border-purple-200",
  booked: "bg-indigo-100 text-indigo-800 border-indigo-200",
  booked_elsewhere: "bg-violet-100 text-violet-800 border-violet-200",
  visited: "bg-emerald-100 text-emerald-800 border-emerald-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  duplicate: "bg-gray-100 text-gray-800 border-gray-200",
  no_answer: "bg-orange-100 text-orange-800 border-orange-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

/** Hex colors for chart fills */
export const referralStatusHexColors: Record<string, string> = {
  new: "#f59e0b",
  in_progress: "#3b82f6",
  contacted: "#0ea5e9",
  scheduled: "#8b5cf6",
  booked: "#6366f1",
  booked_elsewhere: "#a855f7",
  visited: "#10b981",
  paid: "#059669",
  duplicate: "#9ca3af",
  no_answer: "#f97316",
  cancelled: "#ef4444",
};

/** Format card number with spaces: "2200123456781234" → "2200 1234 5678 1234" */
export function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

/** Validate INN: must be exactly 10 or 12 digits. Returns error message or null. */
export function validateINN(inn: string): string | null {
  if (!inn) return null; // empty is OK (optional field)
  const digits = inn.replace(/\D/g, "");
  if (digits.length !== 10 && digits.length !== 12) {
    return "ИНН должен содержать 10 или 12 цифр";
  }
  return null;
}

/** Common currency formatter for kopecks → rubles */
export function formatCurrency(kopecks: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
  }).format(kopecks / 100);
}

/** Format date to Russian locale string */
export function formatDateRu(date: Date | string): string {
  return new Date(date).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
