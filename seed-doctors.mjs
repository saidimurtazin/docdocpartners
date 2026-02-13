import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { doctors } from './drizzle/schema.ts';
import * as dotenv from 'dotenv';

dotenv.config();

const sampleDoctors = [
  {
    fullName: "Иванов Сергей Петрович",
    specialization: "Офтальмолог",
    clinic: "MEDSI Network of Medical Centers",
    clinicLocation: "Москва",
    experience: 15,
    education: "Первый МГМУ им. И.М. Сеченова, 2009",
    achievements: "Кандидат медицинских наук, более 5000 успешных операций",
    services: "Лазерная коррекция зрения, Катаракта, Глаукома, Диагностика",
    phone: "+7 (495) 123-45-67",
    email: "ivanov@medsi.ru",
    bio: "Ведущий офтальмолог с 15-летним опытом. Специализируется на лазерной коррекции зрения и хирургии катаракты."
  },
  {
    fullName: "Петрова Анна Владимировна",
    specialization: "Гинеколог",
    clinic: "Olymp Clinic",
    clinicLocation: "Москва",
    experience: 12,
    education: "РНИМУ им. Н.И. Пирогова, 2012",
    achievements: "Специалист по репродуктивному здоровью",
    services: "Гинекологические осмотры, УЗИ, Планирование беременности",
    phone: "+7 (495) 234-56-78",
    email: "petrova@olympclinic.ru",
    bio: "Опытный гинеколог, специализирующийся на репродуктивном здоровье женщин."
  },
  {
    fullName: "Смирнов Дмитрий Александрович",
    specialization: "Онколог",
    clinic: "MIBS Medical Institute named after Sergei Berezin",
    clinicLocation: "Санкт-Петербург",
    experience: 20,
    education: "СПбГМУ им. акад. И.П. Павлова, 2004",
    achievements: "Доктор медицинских наук, автор 50+ научных публикаций",
    services: "Радиохирургия, Лучевая терапия, Химиотерапия, Диагностика",
    phone: "+7 (812) 345-67-89",
    email: "smirnov@mibs.ru",
    bio: "Ведущий онколог с международным опытом. Специализируется на радиохирургии и лучевой терапии."
  },
  {
    fullName: "Кузнецова Елена Игоревна",
    specialization: "Стоматолог",
    clinic: "Millenium clinic",
    clinicLocation: "Казань",
    experience: 10,
    education: "Казанский ГМУ, 2014",
    achievements: "Сертификат по имплантологии",
    services: "Имплантация, Протезирование, Эстетическая стоматология",
    phone: "+7 (843) 456-78-90",
    email: "kuznetsova@millenium.ru",
    bio: "Стоматолог-имплантолог с 10-летним опытом работы."
  }
];

async function seed() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);

  try {
    for (const doctor of sampleDoctors) {
      await db.insert(doctors).values(doctor);
    }
    console.log('✅ Sample doctors added successfully!');
  } catch (error) {
    console.error('Error seeding doctors:', error);
  } finally {
    await connection.end();
  }
}

seed();
