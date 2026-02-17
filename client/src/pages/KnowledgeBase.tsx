import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  FileCheck,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Clock,
  Users,
  FileText,
  Lock,
  TrendingUp,
  Building2,
  Loader2
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function KnowledgeBase() {
  const { data: clinics, isLoading: clinicsLoading } = trpc.public.clinics.useQuery();
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">M</span>
            </div>
            <span className="font-bold text-xl">DocDocPartner</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="/" className="text-sm font-medium hover:text-primary transition-colors">Главная</a>
            <a href="/knowledge-base" className="text-sm font-medium text-primary">База знаний</a>
            <a href="/admin" className="text-sm font-medium hover:text-primary transition-colors">Админ-панель</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <Badge className="mb-4">База знаний</Badge>
            <h1 className="text-4xl md:text-5xl font-bold">Всё о программе DocDocPartner</h1>
            <p className="text-xl text-muted-foreground">
              Полная информация о том, как работает партнерская программа, гарантии выплат и процесс сотрудничества
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="container max-w-5xl">
          <div className="space-y-12">
            
            {/* Payment Guarantees */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Гарантии выплат</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="prose prose-sm max-w-none">
                  <p className="text-muted-foreground leading-relaxed">
                    DocDocPartner гарантирует выплату вознаграждения за каждого успешно направленного пациента. 
                    Выплата производится после подтверждения клиникой факта оказания услуг и получения оплаты от пациента.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex gap-3 p-4 rounded-lg bg-muted/50">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-1">Прозрачность</h4>
                      <p className="text-sm text-muted-foreground">
                        Вы видите статус каждой рекомендации в реальном времени через бот или личный кабинет
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-4 rounded-lg bg-muted/50">
                    <Banknote className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-1">Фиксированная ставка</h4>
                      <p className="text-sm text-muted-foreground">
                        7% от суммы лечения, 10% при объёме &gt;1 млн ₽/месяц
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-4 rounded-lg bg-muted/50">
                    <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-1">Быстрые выплаты</h4>
                      <p className="text-sm text-muted-foreground">
                        Выплата в течение 3-5 рабочих дней после запроса на выплату
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-4 rounded-lg bg-muted/50">
                    <FileCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-1">Легальность</h4>
                      <p className="text-sm text-muted-foreground">
                        Все выплаты оформляются официально с договором и документами
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-2">Условия выплаты</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Пациент должен пройти лечение в клинике-партнере</li>
                        <li>• Клиника подтверждает факт оказания услуг</li>
                        <li>• Пациент до этого не являлся клиентом клиники</li>
                        <li>• Минимальная сумма для вывода: 1000 ₽</li>
                        <li>• Для вывода бонусных баллов: минимум 10 собственных рекомендаций</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Transparency */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Прозрачность выплат</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="prose prose-sm max-w-none">
                  <p className="text-muted-foreground leading-relaxed">
                    Мы отправляем данные пациентов напрямую в клиники-партнеры. Если пациент посетит клинику и оплатит услуги — мы выплатим вам комиссию.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4 p-4 rounded-lg border">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold">1</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Верификация агента</h4>
                      <p className="text-sm text-muted-foreground">
                        При регистрации проверяем ФИО, email, телефон и профессиональную принадлежность.
                        Для самозанятых дополнительно проверяем ИНН через сайт ФНС.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-4 rounded-lg border">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold">2</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Звонок пациенту</h4>
                      <p className="text-sm text-muted-foreground">
                        Наш координатор связывается с пациентом для подтверждения данных и уточнения потребностей.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-4 rounded-lg border">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold">3</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Сверка с клиникой</h4>
                      <p className="text-sm text-muted-foreground">
                        Передаём данные в клинику-партнер. Клиника назначает консультацию.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-4 rounded-lg border">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold">4</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Подтверждение услуг</h4>
                      <p className="text-sm text-muted-foreground">
                        После лечения клиника подтверждает факт и сумму оказания услуг.
                        Только после этого начисляется вознаграждение.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Free Booking Service */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Бесплатная запись пациентов</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="prose prose-sm max-w-none">
                  <p className="text-muted-foreground leading-relaxed">
                    Мы берем на себя всю работу по записи пациента в клинику. Вам не нужно самостоятельно 
                    связываться с клиникой или организовывать визит.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-6 rounded-lg bg-muted/50">
                    <Phone className="w-8 h-8 text-primary mx-auto mb-3" />
                    <h4 className="font-semibold mb-2">Первичный звонок</h4>
                    <p className="text-sm text-muted-foreground">
                      Связываемся с пациентом в течение 2 часов после получения рекомендации
                    </p>
                  </div>

                  <div className="text-center p-6 rounded-lg bg-muted/50">
                    <Users className="w-8 h-8 text-primary mx-auto mb-3" />
                    <h4 className="font-semibold mb-2">Подбор клиники</h4>
                    <p className="text-sm text-muted-foreground">
                      Помогаем выбрать оптимальную клинику по специализации и расположению
                    </p>
                  </div>

                  <div className="text-center p-6 rounded-lg bg-muted/50">
                    <Calendar className="w-8 h-8 text-primary mx-auto mb-3" />
                    <h4 className="font-semibold mb-2">Запись на приём</h4>
                    <p className="text-sm text-muted-foreground">
                      Организуем запись на удобное для пациента время
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="font-semibold mb-3">Что получает пациент:</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>Бесплатную консультацию по выбору клиники и специалиста</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>Приоритетную запись без очередей</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>Сопровождение на всех этапах лечения</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>Гарантию качества от проверенных клиник-партнеров</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Document Signing */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Подписание документов</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="prose prose-sm max-w-none">
                  <p className="text-muted-foreground leading-relaxed">
                    Выплаты и подписание документов осуществляются через нашего партнёра <strong>Jump.Finance</strong> (юридическая сила согласно 63-ФЗ).
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg border">
                    <h4 className="font-semibold mb-3">📋 Договор оферты</h4>
                    <p className="text-sm text-muted-foreground">
                      При регистрации вы соглашаетесь с договором оферты, который размещён по ссылке:{' '}
                      <a href="/oferta" className="text-primary hover:underline font-medium">договор оферты</a>.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <h4 className="font-semibold mb-2">👤 Физическое лицо</h4>
                      <p className="text-sm text-muted-foreground mb-2">При выводе средств:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Вы подписываете <strong>Акт оказанных услуг</strong> через Jump.Finance</li>
                        <li>• После подписания получаете выплату</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <h4 className="font-semibold mb-2">📱 Самозанятый</h4>
                      <p className="text-sm text-muted-foreground mb-2">При выводе средств:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Вы получаете <strong>поручение на оказание услуг</strong> с суммой выплаты через Jump.Finance</li>
                        <li>• Получаете оплату на карту</li>
                        <li>• Чек формируется <strong>автоматически</strong> — он является фактом оказания услуг</li>
                        <li>• Отдельно подписывать акт <strong>не нужно</strong></li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border bg-primary/5">
                    <h4 className="font-semibold mb-2">Преимущества:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>✅ Юридическая сила (63-ФЗ)</li>
                      <li>✅ Быстрая выплата через Jump.Finance</li>
                      <li>✅ Автоматическое формирование чеков для самозанятых</li>
                      <li>✅ Электронное подписание за 1 минуту</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Partner Clinics - dynamic from DB */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Клиники-партнёры</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {clinicsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : clinics && clinics.length > 0 ? (
                  <>
                    <p className="text-muted-foreground">
                      {clinics.length} клиник в программе:
                    </p>
                    <div className="grid md:grid-cols-2 gap-3">
                      {clinics.map((clinic: any, idx: number) => (
                        <div key={clinic.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-medium">{clinic.name}</div>
                            {clinic.specialization && (
                              <div className="text-xs text-muted-foreground">{clinic.specialization}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                      Все клиники проверены и имеют лицензии Минздрава.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Список клиник загружается...</p>
                )}
              </CardContent>
            </Card>

            {/* Self-Employment Guide */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Как стать самозанятым</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="prose prose-sm max-w-none">
                  <p className="text-muted-foreground leading-relaxed">
                    Рекомендуем всем агентам оформить самозанятость для получения полной суммы вознаграждения 
                    без удержания НДФЛ и соц. отчислений.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <h4 className="font-semibold mb-2 text-green-700 dark:text-green-400">Самозанятый</h4>
                    <div className="text-2xl font-bold mb-1">7%</div>
                    <p className="text-sm text-muted-foreground mb-3">от стоимости лечения</p>
                    <p className="text-xs text-muted-foreground">Налог 6% от выплаты платите сами</p>
                  </div>

                  <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <h4 className="font-semibold mb-2 text-yellow-700 dark:text-yellow-400">Не самозанятый</h4>
                    <div className="text-2xl font-bold mb-1">~4%</div>
                    <p className="text-sm text-muted-foreground mb-3">после вычетов</p>
                    <p className="text-xs text-muted-foreground">Уже за вычетом НДФЛ 13% и соц. отчислений 30%</p>
                  </div>

                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <h4 className="font-semibold mb-2 text-primary">Бонус &gt;1M ₽/мес</h4>
                    <div className="text-2xl font-bold mb-1">10%</div>
                    <p className="text-sm text-muted-foreground mb-3">от стоимости лечения</p>
                    <p className="text-xs text-muted-foreground">Для самозанятых</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg border">
                  <h4 className="font-semibold mb-3">Как зарегистрироваться:</h4>
                  <ol className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 font-semibold text-primary">1.</span>
                      <div>
                        <strong>Скачайте приложение "Мой налог"</strong>
                        <div className="mt-1 space-y-1">
                          <div>iOS: <a href="https://apps.apple.com/ru/app/мой-налог/id1437518854" className="text-primary hover:underline" target="_blank" rel="noopener">App Store</a></div>
                          <div>Android: <a href="https://play.google.com/store/apps/details?id=com.gnivts.selfemployed" className="text-primary hover:underline" target="_blank" rel="noopener">Google Play</a></div>
                        </div>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 font-semibold text-primary">2.</span>
                      <span>Отсканируйте паспорт и сделайте селфи для подтверждения личности</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 font-semibold text-primary">3.</span>
                      <span>Укажите регион работы и получите ИНН (если его нет)</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 font-semibold text-primary">4.</span>
                      <span>Добавьте ИНН в профиль DocDocPartner через бот @docpartnerbot</span>
                    </li>
                  </ol>
                </div>

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="font-semibold mb-2">Важная информация:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Лимит дохода: 2,4 млн ₽ в год</li>
                    <li>• Налог платится автоматически через приложение</li>
                    <li>• Отчетность не требуется</li>
                    <li>• Регистрация занимает 10 минут</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">Остались вопросы?</h2>
            <p className="text-xl text-muted-foreground">
              Свяжитесь с нами через Telegram-бот или напишите на email
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="https://t.me/docpartnerbot" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Открыть бот
              </a>
              <a 
                href="mailto:info@docdocpartner.ru"
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-border font-medium hover:bg-muted transition-colors"
              >
                Написать на email
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
