/**
 * Convert amount in kopecks to Russian words
 * e.g. 152300 → "одна тысяча пятьсот двадцать три рубля 00 копеек"
 */

const UNITS_M = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const UNITS_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

function pluralize(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

function tripletToWords(n: number, feminine: boolean): string {
  if (n === 0) return "";
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const t = Math.floor(rest / 10);
  const u = rest % 10;

  if (h > 0) parts.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    if (t > 0) parts.push(TENS[t]);
    if (u > 0) parts.push(feminine ? UNITS_F[u] : UNITS_M[u]);
  }
  return parts.join(" ");
}

export function amountToWordsRu(kopecks: number): string {
  const rubles = Math.floor(Math.abs(kopecks) / 100);
  const kop = Math.abs(kopecks) % 100;

  if (rubles === 0) {
    return `ноль рублей ${String(kop).padStart(2, "0")} ${pluralize(kop, ["копейка", "копейки", "копеек"])}`;
  }

  const parts: string[] = [];

  // Millions (masculine)
  const millions = Math.floor(rubles / 1_000_000);
  if (millions > 0) {
    parts.push(tripletToWords(millions, false));
    parts.push(pluralize(millions, ["миллион", "миллиона", "миллионов"]));
  }

  // Thousands (feminine: "одна тысяча", "две тысячи")
  const thousands = Math.floor((rubles % 1_000_000) / 1000);
  if (thousands > 0) {
    parts.push(tripletToWords(thousands, true));
    parts.push(pluralize(thousands, ["тысяча", "тысячи", "тысяч"]));
  }

  // Units (masculine: "один рубль", "два рубля")
  const units = rubles % 1000;
  if (units > 0) {
    parts.push(tripletToWords(units, false));
  }

  const rubWord = pluralize(rubles, ["рубль", "рубля", "рублей"]);
  const kopWord = pluralize(kop, ["копейка", "копейки", "копеек"]);

  return `${parts.join(" ")} ${rubWord} ${String(kop).padStart(2, "0")} ${kopWord}`;
}
