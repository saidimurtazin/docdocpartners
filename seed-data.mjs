/**
 * Seed script for test data: agents, referrals, payments, clinics
 * Run with: node --loader ts-node/esm seed-data.mjs
 * Or: npx tsx seed-data.mjs
 */
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

async function seed() {
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  console.log('Seeding test data...');

  // ========= CLINICS =========
  const clinicsData = [
    {
      name: "MEDSI",
      type: "Многопрофильная",
      ownership: "Частная",
      city: "Москва",
      address: "ул. Красная Пресня, 16",
      phone: "+7 (495) 023-60-84",
      email: "info@medsi.ru",
      website: "medsi.ru",
      specializations: "Терапия, Хирургия, Кардиология, Онкология, Неврология, Офтальмология",
      certifications: "JCI, ISO 9001, Л041-01137-77/00292835",
      description: "Крупнейшая частная медицинская сеть в России. Более 50 клиник по всей стране. Диагностика, лечение, реабилитация.",
      commissionRate: 10,
      averageCheck: 7500000,
      foundedYear: 1996,
      languages: "Русский, Английский",
      imageUrl: "https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?w=600&h=400&fit=crop",
    },
    {
      name: "МИБС (Международный институт биологических систем)",
      type: "Узкопрофильная",
      ownership: "Частная",
      city: "Санкт-Петербург",
      address: "ул. Карла Маркса, 43",
      phone: "+7 (812) 244-00-24",
      email: "info@mibs.ru",
      website: "mibs.ru",
      specializations: "Онкология, Радиохирургия, Радиотерапия, Диагностика",
      certifications: "Л041-01137-77/00340670, ISO 13485",
      description: "Международный институт биологических систем им. С.М. Березина. Лидер в области радиохирургии и лечения онкологии.",
      commissionRate: 10,
      averageCheck: 15000000,
      foundedYear: 2003,
      languages: "Русский, Английский",
      imageUrl: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=600&h=400&fit=crop",
    },
    {
      name: "Olymp Clinic",
      type: "Многопрофильная",
      ownership: "Частная",
      city: "Москва",
      address: "ул. 1905 года, 7с1",
      phone: "+7 (495) 191-96-26",
      email: "info@olympclinic.ru",
      website: "olympclinic.ru",
      specializations: "Гинекология, Стоматология, Пластическая хирургия, Косметология",
      certifications: "ISO 9001:2015",
      description: "Премиальная клиника с фокусом на женское здоровье, стоматологию и эстетическую медицину.",
      commissionRate: 12,
      averageCheck: 10000000,
      foundedYear: 2021,
      languages: "Русский, Английский",
      imageUrl: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&h=400&fit=crop",
    },
    {
      name: "Millenium Clinic",
      type: "Многопрофильная",
      ownership: "Частная",
      city: "Казань",
      address: "ул. Маршала Чуйкова, 2",
      phone: "+7 (843) 212-39-39",
      email: "info@millenium-clinic.ru",
      website: "millenium-clinic.ru",
      specializations: "Стоматология, Неврология, Эндокринология, Терапия",
      certifications: "Л041-01137-16/00395068",
      description: "Современная клиника в Казани. Стоматология полного цикла, неврология, эндокринология.",
      commissionRate: 10,
      averageCheck: 5000000,
      foundedYear: 2017,
      languages: "Русский",
      imageUrl: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=600&h=400&fit=crop",
    },
    {
      name: "Европейский медицинский центр (EMC)",
      type: "Многопрофильная",
      ownership: "Частная",
      city: "Москва",
      address: "Спиридоньевский пер., 5/1",
      phone: "+7 (495) 933-66-55",
      email: "info@emcmos.ru",
      website: "emcmos.ru",
      specializations: "Онкология, Кардиология, Неврология, Хирургия, Педиатрия, Репродукция",
      certifications: "JCI, ISO 45001:2018, ISO 9001:2015",
      description: "Один из ведущих многопрофильных медицинских центров в России. Международные стандарты лечения.",
      commissionRate: 8,
      averageCheck: 20000000,
      foundedYear: 1989,
      languages: "Русский, Английский, Немецкий",
      imageUrl: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=600&h=400&fit=crop",
    },
    {
      name: "СМ-Клиника",
      type: "Многопрофильная",
      ownership: "Частная",
      city: "Москва",
      address: "ул. Клары Цеткин, 33/28",
      phone: "+7 (495) 292-39-72",
      email: "info@sm-clinic.ru",
      website: "sm-clinic.ru",
      specializations: "Хирургия, Гинекология, Урология, ЛОР, Дерматология, Ортопедия",
      certifications: "Л041-01137-77/00368259",
      description: "Одна из крупнейших сетей медицинских центров в Москве. Более 20 клиник.",
      commissionRate: 10,
      averageCheck: 6000000,
      foundedYear: 2002,
      languages: "Русский, Английский",
      imageUrl: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=600&h=400&fit=crop",
    },
  ];

  console.log(`Inserting ${clinicsData.length} clinics...`);
  for (const clinic of clinicsData) {
    await connection.execute(
      `INSERT INTO clinics (name, type, ownership, city, address, phone, email, website, specializations, certifications, description, commissionRate, averageCheck, foundedYear, languages, imageUrl, isActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'yes')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [clinic.name, clinic.type, clinic.ownership, clinic.city, clinic.address, clinic.phone, clinic.email, clinic.website, clinic.specializations, clinic.certifications, clinic.description, clinic.commissionRate, clinic.averageCheck, clinic.foundedYear, clinic.languages, clinic.imageUrl]
    );
  }
  console.log('Clinics seeded!');

  // ========= TEST AGENTS =========
  const agentsData = [
    { telegramId: "test_100001", fullName: "Козлова Елена Андреевна", email: "kozlova@test.ru", phone: "+79001234501", role: "Врач", city: "Москва", specialization: "Терапевт", status: "active", referralCode: "REF_KOZLOVA", totalEarnings: 1500000, totalReferrals: 15 },
    { telegramId: "test_100002", fullName: "Морозов Дмитрий Сергеевич", email: "morozov@test.ru", phone: "+79001234502", role: "Врач", city: "Москва", specialization: "Кардиолог", status: "active", referralCode: "REF_MOROZOV", totalEarnings: 2800000, totalReferrals: 22 },
    { telegramId: "test_100003", fullName: "Новикова Ольга Петровна", email: "novikova@test.ru", phone: "+79001234503", role: "Координатор", city: "Санкт-Петербург", specialization: null, status: "active", referralCode: "REF_NOVIKOVA", totalEarnings: 850000, totalReferrals: 8 },
    { telegramId: "test_100004", fullName: "Соколов Артём Игоревич", email: "sokolov@test.ru", phone: "+79001234504", role: "Врач", city: "Казань", specialization: "Хирург", status: "active", referralCode: "REF_SOKOLOV", totalEarnings: 4200000, totalReferrals: 35 },
    { telegramId: "test_100005", fullName: "Волкова Мария Александровна", email: "volkova@test.ru", phone: "+79001234505", role: "Врач", city: "Москва", specialization: "Невролог", status: "active", referralCode: "REF_VOLKOVA", totalEarnings: 600000, totalReferrals: 6 },
    { telegramId: "test_100006", fullName: "Лебедев Иван Николаевич", email: "lebedev@test.ru", phone: "+79001234506", role: "Врач", city: "Санкт-Петербург", specialization: "Онколог", status: "active", referralCode: "REF_LEBEDEV", totalEarnings: 3500000, totalReferrals: 28 },
    { telegramId: "test_100007", fullName: "Кузнецова Анна Сергеевна", email: "kuznetsova@test.ru", phone: "+79001234507", role: "Медсестра", city: "Москва", specialization: null, status: "active", referralCode: "REF_KUZNETSOVA", totalEarnings: 320000, totalReferrals: 4 },
    { telegramId: "test_100008", fullName: "Попов Алексей Владимирович", email: "popov@test.ru", phone: "+79001234508", role: "Врач", city: "Москва", specialization: "Педиатр", status: "pending", referralCode: "REF_POPOV", totalEarnings: 0, totalReferrals: 0 },
    { telegramId: "test_100009", fullName: "Смирнова Татьяна Павловна", email: "smirnova@test.ru", phone: "+79001234509", role: "Врач", city: "Казань", specialization: "Стоматолог", status: "active", referralCode: "REF_SMIRNOVA", totalEarnings: 1900000, totalReferrals: 18 },
    { telegramId: "test_100010", fullName: "Федоров Максим Андреевич", email: "fedorov@test.ru", phone: "+79001234510", role: "Координатор", city: "Москва", specialization: null, status: "active", referralCode: "REF_FEDOROV", totalEarnings: 750000, totalReferrals: 9 },
  ];

  console.log(`Inserting ${agentsData.length} test agents...`);
  const agentIds = [];
  for (const agent of agentsData) {
    try {
      const [result] = await connection.execute(
        `INSERT INTO agents (telegramId, fullName, email, phone, \`role\`, city, specialization, status, referralCode, totalEarnings, totalReferrals, inn, bankAccount, bankName, bankBik, isSelfEmployed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE fullName = VALUES(fullName)`,
        [agent.telegramId, agent.fullName, agent.email, agent.phone, agent.role, agent.city, agent.specialization, agent.status, agent.referralCode, agent.totalEarnings, agent.totalReferrals,
         '77' + String(Math.floor(Math.random() * 9999999999)).padStart(10, '0'),
         '40817810' + String(Math.floor(Math.random() * 999999999999)).padStart(12, '0'),
         ['Сбербанк', 'Тинькофф', 'Альфа-Банк', 'ВТБ', 'Райффайзен'][Math.floor(Math.random() * 5)],
         '04452' + String(Math.floor(Math.random() * 9999)).padStart(4, '0'),
         ['yes', 'no', 'unknown'][Math.floor(Math.random() * 3)]
        ]
      );
      // Get inserted ID
      const [rows] = await connection.execute('SELECT id FROM agents WHERE telegramId = ?', [agent.telegramId]);
      if (rows.length > 0) agentIds.push(rows[0].id);
    } catch (err) {
      console.error(`Failed to insert agent ${agent.fullName}:`, err.message);
    }
  }
  console.log(`Agents seeded! IDs: ${agentIds.join(', ')}`);

  // ========= REFERRALS =========
  const clinicNames = ["MEDSI", "МИБС", "Olymp Clinic", "Millenium Clinic", "EMC", "СМ-Клиника"];
  const statuses = ["new", "in_progress", "contacted", "scheduled", "visited", "duplicate", "no_answer", "cancelled"];
  const patientNames = [
    "Андреева Светлана Олеговна", "Белов Кирилл Анатольевич", "Васильева Дарья Михайловна",
    "Григорьев Роман Павлович", "Дмитриева Юлия Сергеевна", "Егоров Николай Витальевич",
    "Жукова Наталья Александровна", "Зайцев Антон Дмитриевич", "Иванова Екатерина Николаевна",
    "Калинин Владимир Олегович", "Ларионова Полина Евгеньевна", "Миронов Станислав Петрович",
    "Никитина Алина Руслановна", "Орлов Павел Константинович", "Павлова Вероника Андреевна",
    "Романов Тимофей Игоревич", "Сидорова Оксана Валерьевна", "Тихонов Денис Алексеевич",
    "Ушакова Любовь Дмитриевна", "Филатов Егор Максимович", "Хомякова Ирина Владимировна",
    "Цветкова Елизавета Артемовна", "Шестакова Галина Борисовна", "Щербакова Мария Андреевна",
    "Яковлев Геннадий Сергеевич", "Борисов Кирилл Станиславович", "Власова Наталья Дмитриевна",
    "Гусева Анастасия Олеговна", "Данилов Артур Валерьевич", "Ежова Виктория Сергеевна",
  ];

  console.log('Inserting referrals...');
  let referralCount = 0;
  for (const agentId of agentIds) {
    // Random 2-8 referrals per agent
    const numReferrals = 2 + Math.floor(Math.random() * 7);
    for (let i = 0; i < numReferrals; i++) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const isPaid = status === 'visited';
      const treatmentAmount = isPaid ? (300000 + Math.floor(Math.random() * 1500000)) : 0; // 3k-18k rub in kopecks
      const commissionAmount = isPaid ? Math.round(treatmentAmount * 0.1) : 0;
      const patientName = patientNames[Math.floor(Math.random() * patientNames.length)];
      const clinic = clinicNames[Math.floor(Math.random() * clinicNames.length)];
      const contactConsent = Math.random() > 0.3 ? 1 : 0;

      // Random date within last 6 months
      const daysAgo = Math.floor(Math.random() * 180);
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const birthYear = 1950 + Math.floor(Math.random() * 55);
      const birthMonth = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
      const birthDay = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
      const birthdate = `${birthDay}.${birthMonth}.${birthYear}`;

      try {
        await connection.execute(
          `INSERT INTO referrals (agentId, patientFullName, patientBirthdate, patientCity, patientPhone, clinic, status, treatmentAmount, commissionAmount, contactConsent, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [agentId, patientName, birthdate, ['Москва', 'Санкт-Петербург', 'Казань'][Math.floor(Math.random() * 3)],
           '+7900' + String(Math.floor(Math.random() * 9999999)).padStart(7, '0'),
           clinic, status, treatmentAmount, commissionAmount, contactConsent, createdAt]
        );
        referralCount++;
      } catch (err) {
        console.error(`Failed to insert referral:`, err.message);
      }
    }
  }
  console.log(`${referralCount} referrals seeded!`);

  // ========= PAYMENTS =========
  console.log('Inserting payments...');
  let paymentCount = 0;
  const paymentStatuses = ["pending", "processing", "completed", "completed", "completed", "failed"];
  for (const agentId of agentIds) {
    const numPayments = Math.floor(Math.random() * 4); // 0-3 payments per agent
    for (let i = 0; i < numPayments; i++) {
      const status = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
      const amount = 100000 + Math.floor(Math.random() * 500000); // 1k-6k rub in kopecks
      const daysAgo = Math.floor(Math.random() * 120);
      const requestedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const completedAt = status === 'completed' ? new Date(requestedAt.getTime() + (2 + Math.floor(Math.random() * 5)) * 24 * 60 * 60 * 1000) : null;
      const transactionId = status === 'completed' ? 'TXN-' + String(Math.floor(Math.random() * 999999999)).padStart(9, '0') : null;

      try {
        await connection.execute(
          `INSERT INTO payments (agentId, amount, status, method, transactionId, requestedAt, completedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [agentId, amount, status, 'bank_transfer', transactionId, requestedAt, completedAt]
        );
        paymentCount++;
      } catch (err) {
        console.error(`Failed to insert payment:`, err.message);
      }
    }
  }
  console.log(`${paymentCount} payments seeded!`);

  console.log('\n=== SEED COMPLETE ===');
  console.log(`Clinics: ${clinicsData.length}`);
  console.log(`Agents: ${agentIds.length}`);
  console.log(`Referrals: ${referralCount}`);
  console.log(`Payments: ${paymentCount}`);

  await connection.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
