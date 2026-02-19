/**
 * Shared validation functions for DocPartner
 * Used by both Telegram bot and web registration
 */

/**
 * Валидация ФИО - только кириллица, ровно 3 слова (Фамилия Имя Отчество), минимум 2 буквы в каждом слове
 */
export function validateFullName(text: string): { valid: boolean; error?: string } {
  const trimmed = text.trim();

  if (trimmed.length > 150) {
    return { valid: false, error: 'Слишком длинное имя (максимум 150 символов)' };
  }

  // Проверка на кириллицу, пробелы, дефисы
  if (!/^[А-Яа-яЁё\s-]+$/.test(trimmed)) {
    return { valid: false, error: 'Используйте только русские буквы (кириллицу)' };
  }

  // Проверка количества слов (ровно 3 слова: Фамилия Имя Отчество)
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length !== 3) {
    return { valid: false, error: 'Введите Фамилию, Имя и Отчество (ровно 3 слова)' };
  }

  // Проверка длины каждого слова (минимум 2 буквы)
  for (const word of words) {
    if (word.length < 2) {
      return { valid: false, error: 'Каждое слово должно содержать минимум 2 буквы' };
    }
  }

  return { valid: true };
}

/**
 * Валидация email с проверкой формата и длины домена
 */
export function validateEmailAdvanced(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim().toLowerCase();

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email слишком длинный' };
  }

  // Проверка формата: local@domain.tld
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Неверный формат email. Пример: ivan@mail.ru' };
  }

  // Проверка длины домена (минимум "a.ru" = 4 символа)
  const domain = trimmed.split('@')[1];
  if (domain && domain.length < 4) {
    return { valid: false, error: 'Слишком короткий домен email' };
  }

  return { valid: true };
}

/**
 * Валидация любого международного номера телефона
 * Принимает номера в формате +[country_code][number]
 */
export function validatePhoneAdvanced(phone: string): { valid: boolean; error?: string; normalized?: string } {
  // Убираем пробелы, дефисы, скобки
  let cleaned = phone.replace(/[\s\-()]/g, '');

  // Автоматическая нормализация
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  if (cleaned.startsWith('+8') && cleaned.length === 12) cleaned = '+7' + cleaned.slice(2);

  // Проверка общего формата: + и 11-15 цифр (минимум 11 для РФ/СНГ)
  if (!/^\+\d{11,15}$/.test(cleaned)) {
    return {
      valid: false,
      error: 'Неверный формат. Минимум 11 цифр с кодом страны.\nПримеры: +79001234567, +77011234567, +996555123456'
    };
  }

  return { valid: true, normalized: cleaned };
}

/**
 * Валидация города - только кириллица
 */
export function validateCity(text: string): { valid: boolean; error?: string } {
  const trimmed = text.trim();

  if (!/^[А-Яа-яЁё\s-]+$/.test(trimmed)) {
    return { valid: false, error: 'Используйте только русские буквы (кириллицу)' };
  }

  if (trimmed.length < 2) {
    return { valid: false, error: 'Название города слишком короткое' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Название города слишком длинное' };
  }

  return { valid: true };
}

/**
 * Капитализация слов
 */
export function capitalizeWords(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
