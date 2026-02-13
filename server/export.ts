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
