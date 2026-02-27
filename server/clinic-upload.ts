import ExcelJS from 'exceljs';
import * as db from './db';

/**
 * Generate empty template Excel for clinics to fill in treated patients
 */
export async function generateClinicUploadTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Пролеченные пациенты');

  worksheet.columns = [
    { header: 'ФИО пациента', key: 'patientName', width: 30 },
    { header: 'Дата рождения (ДД.ММ.ГГГГ)', key: 'birthdate', width: 25 },
    { header: 'Дата визита (ДД.ММ.ГГГГ)', key: 'visitDate', width: 25 },
    { header: 'Сумма лечения (руб)', key: 'amount', width: 20 },
    { header: 'Услуги (опционально)', key: 'services', width: 30 },
  ];

  // Style header
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF10b981' },
  };

  // Example row
  worksheet.addRow({
    patientName: 'Иванов Иван Иванович',
    birthdate: '15.03.1985',
    visitDate: '20.02.2026',
    amount: 5000,
    services: 'Консультация, Лечение',
  });

  // Make example row italic
  worksheet.getRow(2).font = { italic: true, color: { argb: 'FF999999' } };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Parse uploaded Excel from clinic and match with referrals
 */
export async function parseClinicUploadExcel(base64: string, clinicName: string, clinicId?: number) {
  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(base64, 'base64');
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error('Файл не содержит листов');
  }

  const matched: { rowIndex: number; patientName: string; birthdate: string; visitDate: string; amount: number; referralId: number }[] = [];
  const notFound: { rowIndex: number; patientName: string; birthdate: string; reason: string }[] = [];
  const alreadyTreated: { rowIndex: number; patientName: string; birthdate: string; referralId: number }[] = [];
  const errors: { rowIndex: number; message: string }[] = [];

  // Get all referrals targeted to this clinic (by ID + name fallback)
  const allReferrals = clinicId
    ? await db.getReferralsByTargetClinicId(clinicId, clinicName)
    : await db.getReferralsByClinicName(clinicName);

  // Process rows (skip header)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    try {
      const patientName = String(row.getCell(1).value || '').trim();
      const birthdateRaw = String(row.getCell(2).value || '').trim();
      const visitDateRaw = String(row.getCell(3).value || '').trim();
      const amountRaw = row.getCell(4).value;

      if (!patientName) return; // skip empty rows

      if (!birthdateRaw) {
        errors.push({ rowIndex: rowNumber, message: 'Не указана дата рождения' });
        return;
      }

      if (!visitDateRaw) {
        errors.push({ rowIndex: rowNumber, message: 'Не указана дата визита' });
        return;
      }

      if (!amountRaw && amountRaw !== 0) {
        errors.push({ rowIndex: rowNumber, message: 'Не указана сумма лечения' });
        return;
      }

      const amount = Math.round(parseFloat(String(amountRaw)) * 100); // рубли → копейки
      if (isNaN(amount) || amount <= 0) {
        errors.push({ rowIndex: rowNumber, message: 'Некорректная сумма лечения' });
        return;
      }

      // Normalize birthdate: try DD.MM.YYYY or YYYY-MM-DD
      const birthdate = normalizeDateStr(birthdateRaw);
      const visitDate = normalizeDateStr(visitDateRaw);

      if (!birthdate) {
        errors.push({ rowIndex: rowNumber, message: `Некорректный формат даты рождения: ${birthdateRaw}` });
        return;
      }
      if (!visitDate) {
        errors.push({ rowIndex: rowNumber, message: `Некорректный формат даты визита: ${visitDateRaw}` });
        return;
      }

      // Find matching referral
      const nameNorm = patientName.toLowerCase().replace(/\s+/g, ' ');
      const match = allReferrals.find(r => {
        const refName = (r.patientFullName || '').toLowerCase().replace(/\s+/g, ' ');
        const refBirth = normalizeDateStr(r.patientBirthdate || '');
        return refName === nameNorm && refBirth === birthdate;
      });

      if (!match) {
        notFound.push({ rowIndex: rowNumber, patientName, birthdate: birthdateRaw, reason: 'Не найдено в системе' });
        return;
      }

      // Check if already treated
      if (match.status === 'visited') {
        alreadyTreated.push({ rowIndex: rowNumber, patientName, birthdate: birthdateRaw, referralId: match.id });
        return;
      }

      matched.push({
        rowIndex: rowNumber,
        patientName,
        birthdate: birthdateRaw,
        visitDate: visitDateRaw,
        amount,
        referralId: match.id,
      });
    } catch (e: any) {
      errors.push({ rowIndex: rowNumber, message: e.message || 'Ошибка обработки строки' });
    }
  });

  return { matched, notFound, alreadyTreated, errors };
}

/**
 * Normalize date string to YYYY-MM-DD for comparison
 */
function normalizeDateStr(dateStr: string): string | null {
  if (!dateStr) return null;

  // Try DD.MM.YYYY
  const ddmmyyyy = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
  }

  // Try YYYY-MM-DD
  const isoDate = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2].padStart(2, '0')}-${isoDate[3].padStart(2, '0')}`;
  }

  // Try DD/MM/YYYY
  const slashDate = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDate) {
    return `${slashDate[3]}-${slashDate[2].padStart(2, '0')}-${slashDate[1].padStart(2, '0')}`;
  }

  // Try Date object (Excel often stores dates as JS Date)
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}

  return null;
}
