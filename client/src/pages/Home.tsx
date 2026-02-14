/**
 * Design Philosophy: Premium Medical B2B Platform
 * - Color: Navy Blue + Premium Gold
 * - Typography: Large, bold headings with Manrope
 * - Layout: Modern bento grid, glassmorphism, mesh backgrounds
 * - Animation: Subtle, professional micro-interactions
 * - Inspiration: Stripe, Linear, Vercel
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  CheckCircle2, 
  Users, 
  Building2, 
  TrendingUp, 
  Shield, 
  Clock,
  ArrowRight,
  MessageSquare,
  BarChart3,
  FileText,
  Wallet,
  Sparkles,
  Globe
} from "lucide-react";
import { Link } from "wouter";
import DoctorChatbot from "@/components/DoctorChatbot";
import { useEffect, useRef } from "react";

export default function Home() {
  const { user, loading, error, isAuthenticated } = useAuth();

  // Scroll animation setup
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in');
          }
        });
      },
      { threshold: 0.1 }
    );

    // Observe all sections
    const sections = document.querySelectorAll('.animate-on-scroll');
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  return (
    <>
    <div className="min-h-screen flex flex-col bg-background">
      {/* Modern Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663256942923/xohsFKyBQyuhihyR.png" 
              alt="DocDocPartner Logo" 
              className="w-10 h-10 rounded-lg"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-lg">DocDoc</span>
              <span className="font-bold text-lg">Partner</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#about" className="text-sm font-medium hover:text-[oklch(0.35_0.08_250)] transition-colors">О программе</a>
            <Link href="/clinics" className="text-sm font-medium hover:text-[oklch(0.35_0.08_250)] transition-colors">
              Клиники
            </Link>
            <a href="#how-it-works" className="text-sm font-medium hover:text-[oklch(0.35_0.08_250)] transition-colors">Как работает</a>
            <a href="#benefits" className="text-sm font-medium hover:text-[oklch(0.35_0.08_250)] transition-colors">Преимущества</a>
            <Link href="/knowledge-base" className="text-sm font-medium hover:text-[oklch(0.35_0.08_250)] transition-colors">
              База знаний
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <Button variant="outline">Личный кабинет</Button>
                </Link>
                <Link href="/admin">
                  <Button variant="outline">Админ-панель</Button>
                </Link>
              </>
            ) : (
              <Button onClick={() => window.location.href = '/login'}>Войти</Button>
            )}
            <Button 
              className="btn-premium text-[oklch(0.15_0.05_75)] font-semibold h-11 px-6"
              onClick={() => window.open('https://t.me/docpartnerbot', '_blank')}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Начать в Telegram
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </header>

      {/* Modern Hero Section with Mesh Background */}
      <section className="relative overflow-hidden mesh-bg py-24 md:py-32">
        <div className="container relative">
          <div className="max-w-7xl mx-auto">
            {/* Badge */}
            <div className="flex justify-center mb-8 animate-on-scroll opacity-0">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass-card">
                <Sparkles className="w-4 h-4 text-[oklch(0.70_0.15_75)]" />
                <span className="text-sm font-semibold bg-gradient-to-r from-[oklch(0.35_0.08_250)] to-[oklch(0.55_0.12_250)] bg-clip-text text-transparent">
                  Легальная партнерская программа
                </span>
              </div>
            </div>

            {/* Main Heading */}
            <h1 className="text-center text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.1] mb-8 animate-on-scroll opacity-0" style={{animationDelay: '0.1s'}}>
              Рекомендуйте пациентов.{" "}
              <span className="gradient-gold-text">
                Зарабатывайте легально.
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-center text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed animate-on-scroll opacity-0" style={{animationDelay: '0.2s'}}>
              Присоединяйтесь к партнерской программе DocDocPartner и получайте{" "}
              <strong className="text-foreground font-semibold">до 10% вознаграждения</strong>{" "}
              за каждого направленного пациента в проверенные клиники России.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-on-scroll opacity-0" style={{animationDelay: '0.3s'}}>
              <Button 
                size="lg" 
                className="btn-premium text-[oklch(0.15_0.05_75)] font-semibold text-lg h-16 px-10"
                onClick={() => window.open('https://t.me/docpartnerbot', '_blank')}
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                Начать работу
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-5xl mx-auto mb-16 animate-on-scroll opacity-0" style={{animationDelay: '0.4s'}}>
              <div className="glass-card p-8 rounded-2xl text-center hover:scale-105 transition-transform">
                <div className="text-5xl font-bold gradient-gold-text mb-2">10%</div>
                <div className="text-sm text-muted-foreground font-medium">Вознаграждение</div>
              </div>
              <div className="glass-card p-8 rounded-2xl text-center hover:scale-105 transition-transform">
                <div className="text-4xl font-bold gradient-text mb-2">150+</div>
                <div className="text-sm text-muted-foreground font-medium">Отделений</div>
              </div>
              <div className="glass-card p-8 rounded-2xl text-center hover:scale-105 transition-transform">
                <div className="text-4xl font-bold gradient-text mb-2">30+</div>
                <div className="text-sm text-muted-foreground font-medium">Городов России</div>
              </div>
              <div className="glass-card p-8 rounded-2xl text-center hover:scale-105 transition-transform">
                <div className="text-5xl font-bold gradient-text mb-2">100%</div>
                <div className="text-sm text-muted-foreground font-medium">Прозрачность</div>
              </div>
            </div>

            {/* Country Expansion Flags */}
            <div className="flex flex-col items-center gap-6 pt-8 border-t border-border/40 animate-on-scroll opacity-0" style={{animationDelay: '0.5s'}}>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="w-4 h-4" />
                <span className="font-medium">Расширяемся на СНГ</span>
              </div>
              <div className="flex items-center gap-6">
                {[
                  { flag: "🇰🇿", country: "Казахстан" },
                  { flag: "🇦🇲", country: "Армения" },
                  { flag: "🇰🇬", country: "Киргизия" },
                  { flag: "🇺🇿", country: "Узбекистан" }
                ].map((item) => (
                  <div 
                    key={item.country}
                    className="group relative cursor-pointer"
                  >
                    <div className="text-5xl transition-all group-hover:scale-125 group-hover:drop-shadow-lg">
                      {item.flag}
                    </div>
                    {/* Tooltip */}
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="glass-card px-4 py-2 rounded-lg whitespace-nowrap">
                        <span className="text-sm font-medium">Скоро в {item.country}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section with Modern Cards */}
      <section id="about" className="py-24 bg-background">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6 mb-20 animate-on-scroll opacity-0">
            <h2 className="text-5xl md:text-6xl font-bold">
              Что такое <span className="gradient-text">DocDocPartner</span>?
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              DocDocPartner — это <strong className="text-foreground">B2B-платформа агентских рекомендаций</strong> в сфере здравоохранения. Мы связываем врачей-агентов с проверенными клиниками для направления пациентов на платное лечение.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: Users,
                title: "Для врачей",
                desc: "Врачи хотят помочь пациенту найти профильного врача, но не имеют инфраструктуры для легальных рекомендаций и проверенные клиники в одном месте. Приходится иметь разные договоры и отслеживать выплаты вручную.",
                gradient: "from-[oklch(0.35_0.08_250)] to-[oklch(0.55_0.12_250)]"
              },
              {
                icon: Building2,
                title: "Для клиник",
                desc: "Клиники получают качественный поток пациентов от проверенных врачей-агентов без огромных затрат на маркетинг и бухгалтерское сопровождение платежей.",
                gradient: "from-[oklch(0.35_0.08_250)] to-[oklch(0.55_0.12_250)]"
              },
              {
                icon: Shield,
                title: "Для пациентов",
                desc: "Пациенты получают рекомендации от доверенных врачей и попадают в проверенные клиники с гарантией качества.",
                gradient: "from-[oklch(0.35_0.08_250)] to-[oklch(0.55_0.12_250)]"
              }
            ].map((item, index) => (
              <Card key={index} className="glass-card border-2 border-white/20 hover:border-[oklch(0.55_0.12_250)]/30 transition-all hover:scale-105 hover:shadow-2xl animate-on-scroll opacity-0" style={{animationDelay: `${0.1 * index}s`}}>
                <CardContent className="pt-10 pb-8 space-y-5">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-lg`}>
                    <item.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Problem & Solution Section */}
      <section className="py-24 mesh-bg">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-7xl mx-auto">
            <div className="space-y-8 animate-on-scroll opacity-0">
              <div className="inline-block">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-semibold">
                  Проблема рынка
                </span>
              </div>
              <h2 className="text-5xl md:text-6xl font-bold leading-tight">
                Каждый 3 пациент получает <span className="gradient-gold-text">рекомендацию</span> на посещение платной клиники
              </h2>
              <p className="text-lg text-muted-foreground">
                По данным <a href="https://sk.ru" target="_blank" rel="noopener noreferrer" className="text-[oklch(0.35_0.08_250)] hover:underline font-semibold">исследования Сколково (2024)</a>, 57% взрослых россиян оплачивали медуслуги за последние 12 месяцев. Основная причина — долгое ожидание бесплатной помощи (54%) и отсутствие нужных технологий/врачей в ОМС (22%).
              </p>
              <div className="space-y-6">
                {[
                  {
                    num: "1",
                    title: "Пациенты не знают, куда обратиться",
                    desc: "Ориентируются на рекомендации лечащего врача, но часто сталкиваются с высоким риском ошибки при выборе клиники."
                  },
                  {
                    num: "2",
                    title: "Врачи хотят помочь, но нет инструментов",
                    desc: "Готовы рекомендовать лечение в платных клиниках, но не имеют единой платформы и боятся бумажной волокиты с каждой клиникой."
                  },
                  {
                    num: "3",
                    title: "Клиники несут высокие расходы",
                    desc: "Тратят огромные бюджеты на маркетинг и не могут эффективно масштабировать работу с врачами-рекомендателями из-за операционной отчетности."
                  }
                ].map((item) => (
                  <div key={item.num} className="flex gap-5">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                      <span className="text-destructive font-bold text-lg">{item.num}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-lg mb-2">{item.title}</h4>
                      <p className="text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative animate-on-scroll opacity-0" style={{animationDelay: '0.2s'}}>
              <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.55_0.12_250)]/20 to-transparent rounded-3xl blur-3xl" />
              <img 
                src="/clinic-partnership.jpg"
                alt="Консультация врача"
                className="relative rounded-3xl shadow-2xl w-full h-auto max-h-[600px] object-contain glass-card"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-background">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6 mb-20 animate-on-scroll opacity-0">
            <h2 className="text-5xl md:text-6xl font-bold">
              Как это <span className="gradient-gold-text">работает</span>?
            </h2>
            <p className="text-xl text-muted-foreground">
              Простой и прозрачный процесс от регистрации до получения вознаграждения
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {[
              {
                step: "01",
                title: "Регистрация",
                description: "Зарегистрируйтесь в Telegram-боте и подпишите договор оферты. Процесс занимает 5 минут.",
                icon: MessageSquare
              },
              {
                step: "02",
                title: "Отправка пациента",
                description: "Введите ФИО и дату рождения пациента. Данные передаются в CRM и клиники-партнеры.",
                icon: Users
              },
              {
                step: "03",
                title: "Лечение",
                description: "Пациент получает помощь в клинике. Вы отслеживаете статус в реальном времени через бот.",
                icon: Building2
              },
              {
                step: "04",
                title: "Вознаграждение",
                description: "Получаете 10% от суммы лечения. Выплаты от 1000 ₽ доступны в любое время.",
                icon: Wallet
              }
            ].map((item, index) => (
              <div key={index} className="relative group animate-on-scroll opacity-0" style={{animationDelay: `${0.1 * index}s`}}>
                <Card className="h-full glass-card border-2 border-white/20 hover:border-[oklch(0.70_0.15_75)]/50 transition-all hover:scale-105">
                  <CardContent className="pt-10 pb-8 space-y-5">
                    <div className="text-7xl font-bold text-[oklch(0.70_0.15_75)]/20">{item.step}</div>
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[oklch(0.35_0.08_250)] to-[oklch(0.55_0.12_250)] flex items-center justify-center shadow-lg">
                      <item.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-24 mesh-bg">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6 mb-20 animate-on-scroll opacity-0">
            <h2 className="text-5xl md:text-6xl font-bold">
              Почему выбирают <span className="gradient-text">DocDocPartner</span>?
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {[
              {
                icon: Shield,
                title: "Полная легальность",
                description: "Все выплаты проходят через официальный договор. Вы работаете как самозанятый или ИП."
              },
              {
                icon: TrendingUp,
                title: "Прозрачная система",
                description: "Отслеживайте статус каждой рекомендации в реальном времени через Telegram-бот."
              },
              {
                icon: Wallet,
                title: "Быстрые выплаты",
                description: "Минимальная сумма вывода — 1000 ₽. Выплаты в течение 3 рабочих дней."
              },
              {
                icon: Users,
                title: "Проверенные клиники",
                description: "Работаем только с лицензированными медицинскими учреждениями с хорошей репутацией."
              },
              {
                icon: BarChart3,
                title: "Детальная статистика",
                description: "Полная аналитика по вашим рекомендациям, заработку и бонусным баллам."
              },
              {
                icon: FileText,
                title: "База знаний",
                description: "Подробные инструкции, FAQ и поддержка на каждом этапе работы."
              }
            ].map((benefit, index) => (
              <Card key={index} className="glass-card border-2 border-white/20 hover:border-[oklch(0.55_0.12_250)]/30 transition-all hover:scale-105 animate-on-scroll opacity-0" style={{animationDelay: `${0.1 * index}s`}}>
                <CardContent className="pt-10 pb-8 space-y-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[oklch(0.70_0.15_75)] to-[oklch(0.75_0.18_65)] flex items-center justify-center shadow-lg">
                    <benefit.icon className="w-7 h-7 text-[oklch(0.15_0.05_75)]" />
                  </div>
                  <h3 className="text-xl font-bold">{benefit.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Partner Clinics Section */}
      <section className="py-24 bg-background">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6 mb-20 animate-on-scroll opacity-0">
            <h2 className="text-5xl md:text-6xl font-bold">
              Наши <span className="gradient-gold-text">клиники-партнеры</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Работаем только с проверенными медицинскими учреждениями, имеющими все необходимые лицензии и сертификаты качества
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {[
              {
                name: "Евроонко",
                type: "Онкология",
                since: "2011",
                image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=300&fit=crop"
              },
              {
                name: "ЕМС",
                type: "Многопрофильная",
                since: "1989",
                image: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=400&h=300&fit=crop"
              },
              {
                name: "МИБС",
                type: "Онкология",
                since: "2006",
                image: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=400&h=300&fit=crop"
              },
              {
                name: "Медси",
                type: "Многопрофильная",
                since: "1957",
                image: "https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?w=400&h=300&fit=crop"
              },
              {
                name: "Клиника Ройтберга",
                type: "Многопрофильная",
                since: "1990",
                image: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=400&h=300&fit=crop"
              },
              {
                name: "Мать и дитя",
                type: "Акушерство",
                since: "2006",
                image: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=400&h=300&fit=crop"
              },
              {
                name: "Поликлиника.ру",
                type: "Многопрофильная",
                since: "1998",
                image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=300&fit=crop"
              },
              {
                name: "СМ-Клиника",
                type: "Многопрофильная",
                since: "2002",
                image: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=400&h=300&fit=crop"
              }
            ].map((clinic, index) => (
              <Card key={index} className="glass-card border-2 border-white/20 hover:border-[oklch(0.55_0.12_250)]/30 transition-all hover:scale-105 overflow-hidden animate-on-scroll opacity-0" style={{animationDelay: `${0.05 * index}s`}}>
                <div className="relative h-40 overflow-hidden">
                  <img 
                    src={clinic.image} 
                    alt={clinic.name}
                    className="w-full h-full object-cover transition-transform hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-white font-bold text-lg">{clinic.name}</h3>
                  </div>
                </div>
                <CardContent className="pt-4 pb-5 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{clinic.type}</span>
                    <span className="text-muted-foreground">с {clinic.since}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12 animate-on-scroll opacity-0" style={{animationDelay: '0.4s'}}>
            <a href="/clinics" className="inline-flex items-center gap-2 text-[oklch(0.35_0.08_250)] hover:text-[oklch(0.55_0.12_250)] font-semibold transition-colors">
              Посмотреть все клиники
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-32 bg-gradient-to-br from-[oklch(0.35_0.08_250)] to-[oklch(0.55_0.12_250)] text-white">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center space-y-8 animate-on-scroll opacity-0">
            <h2 className="text-5xl md:text-6xl font-bold leading-tight">
              Готовы начать зарабатывать легально?
            </h2>
            <p className="text-xl text-white/80">
              Присоединяйтесь к DocDocPartner и получайте до 10% от каждой рекомендации
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg" 
                className="btn-premium text-[oklch(0.15_0.05_75)] font-semibold text-lg h-16 px-10"
                onClick={() => window.open('https://t.me/docpartnerbot', '_blank')}
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                Начать работу в Telegram
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-background border-t border-border/40">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[oklch(0.35_0.08_250)] to-[oklch(0.55_0.12_250)] flex items-center justify-center">
                  <span className="text-white font-bold text-xl">M</span>
                </div>
                <span className="font-bold text-xl">DocDocPartner</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Легальная партнерская программа для врачей и медицинских специалистов
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Программа</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#about" className="hover:text-foreground transition-colors">О нас</a></li>
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors">Как работает</a></li>
                <li><Link href="/clinics" className="hover:text-foreground transition-colors">Клиники</Link></li>
                <li><a href="#benefits" className="hover:text-foreground transition-colors">Преимущества</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Ресурсы</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/knowledge-base" className="hover:text-foreground transition-colors">База знаний</Link></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Документы</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">FAQ</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Поддержка</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Контакты</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Email: info@docdocpartner.ru</li>
                <li>Telegram: @docpartnerbot</li>
                <li>Поддержка: support@docdocpartner.ru</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border/40 text-center text-sm text-muted-foreground">
            <p>© 2025 DocDocPartner. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
    <DoctorChatbot />
    </>
  );
}
