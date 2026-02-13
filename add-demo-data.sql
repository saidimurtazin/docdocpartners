-- Add demo agents with different statuses
INSERT INTO agents (telegram_id, full_name, email, phone, city, role, specialization, status, total_earnings, created_at, updated_at)
VALUES
  -- Active agents with earnings
  ('demo_agent_1', 'Петров Дмитрий Александрович', 'petrov.dmitry@mail.ru', '+79161234567', 'Москва', 'doctor', 'cardiology', 'active', 125000, NOW(), NOW()),
  ('demo_agent_2', 'Смирнова Елена Викторовна', 'smirnova.elena@gmail.com', '+79162345678', 'Санкт-Петербург', 'doctor', 'neurology', 'active', 87500, NOW(), NOW()),
  ('demo_agent_3', 'Козлов Андрей Сергеевич', 'kozlov.andrey@yandex.ru', '+79163456789', 'Казань', 'coordinator', 'general', 'active', 62000, NOW(), NOW()),
  
  -- Pending agents
  ('demo_agent_4', 'Новикова Мария Ивановна', 'novikova.maria@mail.ru', '+79164567890', 'Екатеринбург', 'doctor', 'oncology', 'pending', 0, NOW(), NOW()),
  ('demo_agent_5', 'Волков Игорь Петрович', 'volkov.igor@gmail.com', '+79165678901', 'Новосибирск', 'doctor', 'orthopedics', 'pending', 0, NOW(), NOW()),
  
  -- Rejected agent
  ('demo_agent_6', 'Морозов Сергей Владимирович', 'morozov.sergey@mail.ru', '+79166789012', 'Краснодар', 'other', 'general', 'rejected', 0, NOW(), NOW());

-- Add demo referrals for active agents
INSERT INTO referrals (agent_id, patient_name, patient_birthdate, patient_phone, clinic, status, treatment_amount, commission, created_at, updated_at)
SELECT 
  a.id,
  CASE 
    WHEN n = 1 THEN 'Иванов Петр Сергеевич'
    WHEN n = 2 THEN 'Сидорова Анна Михайловна'
    WHEN n = 3 THEN 'Кузнецов Владимир Иванович'
    WHEN n = 4 THEN 'Павлова Ольга Дмитриевна'
    WHEN n = 5 THEN 'Соколов Алексей Николаевич'
    WHEN n = 6 THEN 'Лебедева Татьяна Александровна'
    WHEN n = 7 THEN 'Попов Михаил Викторович'
    WHEN n = 8 THEN 'Васильева Екатерина Сергеевна'
  END as patient_name,
  CASE 
    WHEN n = 1 THEN '1985-03-15'
    WHEN n = 2 THEN '1978-07-22'
    WHEN n = 3 THEN '1992-11-08'
    WHEN n = 4 THEN '1965-05-30'
    WHEN n = 5 THEN '1988-09-14'
    WHEN n = 6 THEN '1975-12-03'
    WHEN n = 7 THEN '1990-06-25'
    WHEN n = 8 THEN '1982-04-18'
  END as patient_birthdate,
  CASE 
    WHEN n = 1 THEN '+79171234567'
    WHEN n = 2 THEN '+79172345678'
    WHEN n = 3 THEN '+79173456789'
    WHEN n = 4 THEN '+79174567890'
    WHEN n = 5 THEN '+79175678901'
    WHEN n = 6 THEN '+79176789012'
    WHEN n = 7 THEN '+79177890123'
    WHEN n = 8 THEN '+79178901234'
  END as patient_phone,
  CASE 
    WHEN n % 4 = 1 THEN 'АО «Медицина», клиника академика Ройтберга'
    WHEN n % 4 = 2 THEN 'Сеть клиник «Мать и дитя»'
    WHEN n % 4 = 3 THEN 'Сеть частных медицинских клиник Поликлиника.ру'
    ELSE 'Сеть медицинских центров «СМ-Клиника»'
  END as clinic,
  CASE 
    WHEN n <= 3 THEN 'completed'
    WHEN n <= 5 THEN 'scheduled'
    WHEN n <= 7 THEN 'contacted'
    ELSE 'pending'
  END as status,
  CASE 
    WHEN n <= 3 THEN n * 50000
    ELSE NULL
  END as treatment_amount,
  CASE 
    WHEN n <= 3 THEN n * 5000
    ELSE NULL
  END as commission,
  DATE_SUB(NOW(), INTERVAL n DAY) as created_at,
  NOW() as updated_at
FROM 
  agents a
  CROSS JOIN (SELECT 1 as n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8) numbers
WHERE 
  a.telegram_id IN ('demo_agent_1', 'demo_agent_2', 'demo_agent_3')
  AND a.status = 'active';

-- Add demo payments for completed referrals
INSERT INTO payments (agent_id, amount, status, payment_method, created_at, updated_at)
SELECT 
  r.agent_id,
  r.commission,
  CASE 
    WHEN RAND() > 0.5 THEN 'completed'
    ELSE 'pending'
  END as status,
  'bank_transfer' as payment_method,
  r.updated_at as created_at,
  NOW() as updated_at
FROM 
  referrals r
WHERE 
  r.status = 'completed'
  AND r.commission IS NOT NULL;
