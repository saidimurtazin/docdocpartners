import ExcelJS from 'exceljs';
import * as db from './db';

/**
 * Export referrals to Excel
 */
export async function exportReferralsToExcel(filters?: {
  agentId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Рекомендации');

  // Заголовки
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Дата создания', key: 'createdAt', width: 20 },
    { header: 'Агент ID', key: 'agentId', width: 12 },
    { header: 'ФИО пациента', key: 'patientFullName', width: 30 },
    { header: 'Дата рождения', key: 'patientBirthdate', width: 15 },
    { header: 'Город', key: 'patientCity', width: 20 },
    { header: 'Телефон', key: 'patientPhone', width: 18 },
    { header: 'Email', key: 'patientEmail', width: 25 },
    { header: 'Клиника', key: 'clinic', width: 30 },
    { header: 'Статус', key: 'status', width: 15 },
    { header: 'Сумма лечения', key: 'treatmentAmount', width: 18 },
    { header: 'Комиссия', key: 'commissionAmount', width: 15 },
  ];

  // Стиль заголовков
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF10b981' }
  };
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

  // Получаем данные
  const referrals = await db.getAllReferrals();
  
  // Фильтруем данные
  let filteredReferrals = referrals;
  if (filters?.agentId) {
    filteredReferrals = filteredReferrals.filter(r => r.agentId === filters.agentId);
  }
  if (filters?.status) {
    filteredReferrals = filteredReferrals.filter(r => r.status === filters.status);
  }
  if (filters?.startDate) {
    const startDate = new Date(filters.startDate);
    filteredReferrals = filteredReferrals.filter(r => new Date(r.createdAt) >= startDate);
  }
  if (filters?.endDate) {
    const endDate = new Date(filters.endDate);
    filteredReferrals = filteredReferrals.filter(r => new Date(r.createdAt) <= endDate);
  }

  // Добавляем данные
  filteredReferrals.forEach(referral => {
    worksheet.addRow({
      id: referral.id,
      createdAt: new Date(referral.createdAt).toLocaleString('ru-RU'),
      agentId: referral.agentId,
      patientFullName: referral.patientFullName,
      patientBirthdate: referral.patientBirthdate,
      patientCity: referral.patientCity || '',
      patientPhone: referral.patientPhone || '',
      patientEmail: referral.patientEmail || '',
      clinic: referral.clinic || '',
      status: referral.status,
      treatmentAmount: referral.treatmentAmount || 0,
      commissionAmount: referral.commissionAmount || 0,
    });
  });

  // Итоговая строка
  const totalTreatment = filteredReferrals.reduce((sum, r) => sum + (Number(r.treatmentAmount) || 0), 0);
  const totalCommission = filteredReferrals.reduce((sum, r) => sum + (Number(r.commissionAmount) || 0), 0);
  
  const summaryRow = worksheet.addRow({
    id: '',
    createdAt: '',
    agentId: '',
    patientFullName: '',
    patientBirthdate: '',
    patientCity: '',
    patientPhone: '',
    patientEmail: '',
    clinic: 'ИТОГО:',
    status: '',
    treatmentAmount: totalTreatment,
    commissionAmount: totalCommission,
  });
  summaryRow.font = { bold: true };
  summaryRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFf3f4f6' }
  };

  // Генерируем буфер
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Export payments to Excel
 */
export async function exportPaymentsToExcel(filters?: {
  agentId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Выплаты');

  // Заголовки
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Дата создания', key: 'createdAt', width: 20 },
    { header: 'Агент ID', key: 'agentId', width: 12 },
    { header: 'Сумма', key: 'amount', width: 15 },
    { header: 'Статус', key: 'status', width: 15 },
    { header: 'Метод', key: 'paymentMethod', width: 20 },
    { header: 'Детали', key: 'paymentDetails', width: 30 },
    { header: 'ID транзакции', key: 'transactionId', width: 25 },
    { header: 'Дата выплаты', key: 'paidAt', width: 20 },
  ];

  // Стиль заголовков
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF10b981' }
  };
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

  // Получаем данные
  const payments = await db.getAllPayments();
  
  // Фильтруем данные
  let filteredPayments = payments;
  if (filters?.agentId) {
    filteredPayments = filteredPayments.filter(p => p.agentId === filters.agentId);
  }
  if (filters?.status) {
    filteredPayments = filteredPayments.filter(p => p.status === filters.status);
  }
  if (filters?.startDate) {
    const startDate = new Date(filters.startDate);
    filteredPayments = filteredPayments.filter(p => new Date(p.createdAt) >= startDate);
  }
  if (filters?.endDate) {
    const endDate = new Date(filters.endDate);
    filteredPayments = filteredPayments.filter(p => new Date(p.createdAt) <= endDate);
  }

  // Добавляем данные
  filteredPayments.forEach(payment => {
    worksheet.addRow({
      id: payment.id,
      createdAt: new Date(payment.createdAt).toLocaleString('ru-RU'),
      agentId: payment.agentId,
      amount: payment.amount,
      status: payment.status,
      paymentMethod: payment.method || '',
      paymentDetails: payment.notes || '',
      transactionId: payment.transactionId || '',
      paidAt: payment.completedAt ? new Date(payment.completedAt).toLocaleString('ru-RU') : '',
    });
  });

  // Итоговая строка
  const totalAmount = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const completedAmount = filteredPayments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  
  const summaryRow = worksheet.addRow({
    id: '',
    createdAt: '',
    agentId: '',
    amount: totalAmount,
    status: `Выплачено: ${completedAmount} ₽`,
    paymentMethod: '',
    paymentDetails: '',
    transactionId: '',
    paidAt: '',
  });
  summaryRow.font = { bold: true };
  summaryRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFf3f4f6' }
  };

  // Генерируем буфер
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Export agents to Excel
 */
export async function exportAgentsToExcel(filters?: {
  status?: string;
  city?: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Агенты');

  // Заголовки
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Telegram ID', key: 'telegramId', width: 15 },
    { header: 'ФИО', key: 'fullName', width: 30 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Телефон', key: 'phone', width: 18 },
    { header: 'Роль', key: 'role', width: 20 },
    { header: 'Город', key: 'city', width: 20 },
    { header: 'Специализация', key: 'specialization', width: 25 },
    { header: 'Статус', key: 'status', width: 15 },
    { header: 'Дата регистрации', key: 'createdAt', width: 20 },
  ];

  // Стиль заголовков
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF10b981' }
  };
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

  // Получаем данные
  const agents = await db.getAllAgents();
  
  // Фильтруем данные
  let filteredAgents = agents;
  if (filters?.status) {
    filteredAgents = filteredAgents.filter(a => a.status === filters.status);
  }
  if (filters?.city) {
    filteredAgents = filteredAgents.filter(a => a.city === filters.city);
  }

  // Добавляем данные
  filteredAgents.forEach(agent => {
    worksheet.addRow({
      id: agent.id,
      telegramId: agent.telegramId,
      fullName: agent.fullName,
      email: agent.email,
      phone: agent.phone,
      role: agent.role,
      city: agent.city,
      specialization: agent.specialization || '',
      status: agent.status,
      createdAt: new Date(agent.createdAt).toLocaleString('ru-RU'),
    });
  });

  // Итоговая строка
  const summaryRow = worksheet.addRow({
    id: '',
    telegramId: '',
    fullName: `ВСЕГО АГЕНТОВ: ${filteredAgents.length}`,
    email: '',
    phone: '',
    role: '',
    city: '',
    specialization: '',
    status: '',
    createdAt: '',
  });
  summaryRow.font = { bold: true };
  summaryRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFf3f4f6' }
  };

  // Генерируем буфер
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Export payment registry to Excel
 * Format: ФИО агента | Дата выплаты | Период | Сумма | Реквизиты (ИНН, банк, счёт, БИК)
 */
export async function exportPaymentRegistryToExcel(filters: {
  periodStart: string;
  periodEnd: string;
  status?: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Реестр на оплату');

  worksheet.columns = [
    { header: '№', key: 'num', width: 6 },
    { header: 'ФИО агента', key: 'agentName', width: 30 },
    { header: 'Дата выплаты', key: 'paymentDate', width: 18 },
    { header: 'Период', key: 'period', width: 25 },
    { header: 'Сумма (₽)', key: 'amount', width: 15 },
    { header: 'ИНН', key: 'inn', width: 15 },
    { header: 'Банк', key: 'bankName', width: 25 },
    { header: 'Номер счёта', key: 'bankAccount', width: 25 },
    { header: 'БИК', key: 'bankBik', width: 12 },
    { header: 'Самозанятый', key: 'selfEmployed', width: 14 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Телефон', key: 'phone', width: 18 },
  ];

  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF10b981' }
  };

  const paymentsWithAgents = await db.getPaymentsWithAgents();

  const startDate = new Date(filters.periodStart);
  const endDate = new Date(filters.periodEnd);
  endDate.setHours(23, 59, 59, 999);

  let filtered = paymentsWithAgents.filter(row => {
    const paymentDate = new Date(row.payment.requestedAt || row.payment.createdAt);
    return paymentDate >= startDate && paymentDate <= endDate;
  });

  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(row => row.payment.status === filters.status);
  }

  const fmtDate = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${d.getFullYear()}`;
  };

  const periodStr = `${fmtDate(startDate)} — ${fmtDate(endDate)}`;

  filtered.forEach((row, idx) => {
    const payDate = row.payment.completedAt
      ? fmtDate(new Date(row.payment.completedAt))
      : fmtDate(new Date(row.payment.requestedAt || row.payment.createdAt));

    worksheet.addRow({
      num: idx + 1,
      agentName: row.agentFullName || `Агент #${row.payment.agentId}`,
      paymentDate: payDate,
      period: periodStr,
      amount: (row.payment.amount || 0) / 100,
      inn: row.agentInn || '',
      bankName: row.agentBankName || '',
      bankAccount: row.agentBankAccount || '',
      bankBik: row.agentBankBik || '',
      selfEmployed: row.agentIsSelfEmployed === 'yes' ? 'Да' : row.agentIsSelfEmployed === 'no' ? 'Нет' : '—',
      email: row.agentEmail || '',
      phone: row.agentPhone || '',
    });
  });

  const totalAmount = filtered.reduce((sum, row) => sum + (Number(row.payment.amount) || 0), 0);
  const regSummaryRow = worksheet.addRow({
    num: '',
    agentName: `ИТОГО (${filtered.length} записей):`,
    paymentDate: '',
    period: '',
    amount: totalAmount / 100,
    inn: '', bankName: '', bankAccount: '', bankBik: '', selfEmployed: '', email: '', phone: '',
  });
  regSummaryRow.font = { bold: true };
  regSummaryRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFf3f4f6' }
  };

  worksheet.getColumn('amount').numFmt = '#,##0.00';

  const regBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(regBuffer);
}

/**
 * Export signed acts registry for bank upload
 * Only includes payments with status ready_for_payment (signed acts)
 */
export async function exportSignedActsRegistryToExcel(filters: {
  periodStart: string;
  periodEnd: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Реестр подписанных актов');

  worksheet.columns = [
    { header: '№', key: 'num', width: 6 },
    { header: 'ФИО агента', key: 'agentName', width: 30 },
    { header: 'ИНН', key: 'inn', width: 15 },
    { header: 'Банк', key: 'bankName', width: 25 },
    { header: 'Номер счёта', key: 'bankAccount', width: 25 },
    { header: 'БИК', key: 'bankBik', width: 12 },
    { header: 'Сумма (₽)', key: 'amount', width: 15 },
    { header: 'Назначение платежа', key: 'purpose', width: 40 },
    { header: 'Акт №', key: 'actNumber', width: 22 },
    { header: 'Дата подписания', key: 'signedDate', width: 18 },
    { header: 'Самозанятый', key: 'selfEmployed', width: 14 },
  ];

  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF10b981' }
  };

  const actsWithAgents = await db.getReadyForPaymentActsWithAgents();

  const startDate = new Date(filters.periodStart);
  const endDate = new Date(filters.periodEnd);
  endDate.setHours(23, 59, 59, 999);

  const filtered = actsWithAgents.filter(row => {
    const actDate = new Date(row.act.actDate);
    return actDate >= startDate && actDate <= endDate;
  });

  const fmtDate = (d: Date | string) => {
    const date = new Date(d);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${date.getFullYear()}`;
  };

  filtered.forEach((row, idx) => {
    worksheet.addRow({
      num: idx + 1,
      agentName: row.act.agentFullNameSnapshot,
      inn: row.act.agentInnSnapshot,
      bankName: row.act.agentBankNameSnapshot,
      bankAccount: row.act.agentBankAccountSnapshot,
      bankBik: row.act.agentBankBikSnapshot,
      amount: (row.act.totalAmount || 0) / 100,
      purpose: `Оплата по Акту ${row.act.actNumber} от ${fmtDate(row.act.actDate)} за услуги по привлечению пациентов`,
      actNumber: row.act.actNumber,
      signedDate: row.act.signedAt ? fmtDate(row.act.signedAt) : '—',
      selfEmployed: row.agent.isSelfEmployed === 'yes' ? 'Да' : row.agent.isSelfEmployed === 'no' ? 'Нет' : '—',
    });
  });

  const totalAmount = filtered.reduce((sum, row) => sum + (Number(row.act.totalAmount) || 0), 0);
  const summaryRow = worksheet.addRow({
    num: '',
    agentName: `ИТОГО (${filtered.length} актов):`,
    inn: '', bankName: '', bankAccount: '', bankBik: '',
    amount: totalAmount / 100,
    purpose: '', actNumber: '', signedDate: '', selfEmployed: '',
  });
  summaryRow.font = { bold: true };
  summaryRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFf3f4f6' }
  };

  worksheet.getColumn('amount').numFmt = '#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Export clinic referrals to Excel (without patient phone/email for privacy)
 */
export async function exportClinicReferralsToExcel(clinicId: number, clinicName: string, filters?: {
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Направления');

  worksheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'ФИО пациента', key: 'patientFullName', width: 30 },
    { header: 'Дата рождения', key: 'patientBirthdate', width: 15 },
    { header: 'Дата направления', key: 'createdAt', width: 20 },
    { header: 'Статус', key: 'status', width: 15 },
    { header: 'Сумма лечения (руб)', key: 'treatmentAmount', width: 18 },
  ];

  // Style header row
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF10b981' }
  };

  const STATUS_LABELS: Record<string, string> = {
    new: 'Новый', in_progress: 'В работе', contacted: 'Связались',
    scheduled: 'Записан', visited: 'Пролечен', paid: 'Оплачен',
    duplicate: 'Дубликат', no_answer: 'Нет ответа', cancelled: 'Отменён',
  };

  const allReferrals = await db.getReferralsByTargetClinicId(clinicId, clinicName, filters);

  for (const r of allReferrals) {
    worksheet.addRow({
      id: r.id,
      patientFullName: r.patientFullName,
      patientBirthdate: r.patientBirthdate,
      createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString('ru-RU') : '',
      status: STATUS_LABELS[r.status] || r.status,
      treatmentAmount: r.treatmentAmount ? r.treatmentAmount / 100 : 0,
    });
  }

  worksheet.getColumn('treatmentAmount').numFmt = '#,##0.00';

  const exportBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(exportBuffer);
}
