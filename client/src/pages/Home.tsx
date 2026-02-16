/**
 * Design Philosophy: Premium Medical B2B Platform
 * - Color: Navy Blue + Premium Gold
 * - Typography: Large, bold headings with Manrope
 * - Layout: Modern bento grid, glassmorphism, mesh backgrounds
 * - Animation: Framer Motion + particles + animated counters
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
  ArrowRight,
  MessageSquare,
  BarChart3,
  FileText,
  Wallet,
  Sparkles,
  Globe,
  MapPin,
  ChevronRight,
  Star,
  Zap
} from "lucide-react";
import { Link } from "wouter";
import DoctorChatbot from "@/components/DoctorChatbot";
import { useRef, lazy, Suspense } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import AnimatedCounter from "@/components/AnimatedCounter";
import ParticleBackground from "@/components/ParticleBackground";
import { trpc } from "@/lib/trpc";

const ClinicMap = lazy(() => import("@/components/ClinicMap"));

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const fadeInScale = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, delay: i * 0.1, ease: "easeOut" },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: dbClinics } = trpc.public.clinics.useQuery(undefined, { retry: false });

  // Parallax for hero
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 150]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);

  // Map clinic data
  const mapClinics = (dbClinics || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    city: c.city || "",
    address: c.address,
    type: c.type,
    lat: c.latitude || 0,
    lng: c.longitude || 0,
    specializations: c.specializations,
    phone: c.phone,
  }));

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
            <a href="#about" className="text-sm font-medium hover:text-[oklch(0.35_0.08_250)] transition-colors">O программе</a>
            <Link href="/clinics" className="text-sm font-medium hover:text-[oklch(0.35_0.08_250)] transition-colors">
              Клиники
            </Link>
            <a href="#how-it-works" className="text-sm font-medium hover:text-[oklch(0.35_0.08_250)] transition-colors">Как работает</a>
            {/* Map link hidden while map section is hidden */}
            {/* <a href="#map" className="text-sm font-medium hover:text-[oklch(0.35_0.08_250)] transition-colors">Карта</a> */}
            <a href="#benefits" className="text-sm font-medium hover:text-[oklch(0.35_0.08_250)] transition-colors">Преимущества</a>
            <Link href="/knowledge-base" className="text-sm font-medium hover:text-[oklch(0.35_0.08_250)] transition-colors">
              База знаний
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button variant="outline" className="hidden sm:inline-flex">Личный кабинет</Button>
              </Link>
            ) : (
              <Button variant="outline" onClick={() => window.location.href = '/login'} className="hidden sm:inline-flex">Войти</Button>
            )}
            <Button
              className="btn-premium text-[oklch(0.15_0.05_75)] font-semibold h-11 px-6"
              onClick={() => window.open('https://t.me/docpartnerbot', '_blank')}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Начать в Telegram</span>
              <span className="sm:hidden">Telegram</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </header>

      {/* ============== HERO SECTION ============== */}
      <section className="relative overflow-hidden mesh-bg py-12 md:py-20">
        <ParticleBackground particleCount={40} color="rgba(26, 47, 90, 0.15)" />

        {/* Animated gradient orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-[oklch(0.55_0.12_250)] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[oklch(0.70_0.15_75)] rounded-full mix-blend-multiply filter blur-[120px] opacity-15 animate-float" style={{ animationDelay: "1.5s" }} />

        {/* Hero text with parallax — only heading and subheading fade on scroll */}
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="container relative z-10">
          <div className="max-w-7xl mx-auto">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex justify-center mb-8"
            >
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass-card animate-pulse-glow">
                <Sparkles className="w-4 h-4 text-[oklch(0.70_0.15_75)]" />
                <span className="text-sm font-semibold bg-gradient-to-r from-[oklch(0.35_0.08_250)] to-[oklch(0.55_0.12_250)] bg-clip-text text-transparent">
                  Легальная партнерская программа
                </span>
              </div>
            </motion.div>

            {/* Main Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="text-center text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.1] mb-8"
            >
              Рекомендуйте пациентов.{" "}
              <span className="gradient-gold-text">
                Зарабатывайте легально.
              </span>
            </motion.h1>

            {/* Subheading */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-center text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed"
            >
              Присоединяйтесь к партнерской программе DocDocPartner и получайте{" "}
              <strong className="text-foreground font-semibold">до 10% вознаграждения</strong>{" "}
              за каждого направленного пациента в проверенные клиники России.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button
                size="lg"
                className="btn-premium text-[oklch(0.15_0.05_75)] font-semibold text-lg h-16 px-10 animate-pulse-glow"
                onClick={() => window.open('https://t.me/docpartnerbot', '_blank')}
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                Начать работу
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-16 px-10 text-lg border-2"
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Узнать больше
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Stats and Country Expansion — outside parallax container so they stay visible */}
        <div className="container relative z-10 mt-16">
          <div className="max-w-7xl mx-auto">
            {/* Stats Grid with Animated Counters */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.6 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto mb-16"
            >
              {[
                { value: 10, suffix: "%", label: "Вознаграждение", gold: true },
                { value: 150, suffix: "+", label: "Отделений", gold: false },
                { value: 30, suffix: "+", label: "Городов России", gold: false },
                { value: 100, suffix: "%", label: "Прозрачность", gold: false },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  variants={fadeInScale}
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  className="glass-card p-6 md:p-8 rounded-2xl text-center card-glow"
                >
                  <div className={`text-4xl md:text-5xl font-bold mb-2 ${stat.gold ? "gradient-gold-text" : "gradient-text"}`}>
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} duration={2000} />
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground font-medium">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* Country Expansion */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex flex-col items-center gap-6 pt-8 border-t border-border/40"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="w-4 h-4" />
                <span className="font-medium">Расширяемся на СНГ</span>
              </div>
              <div className="flex items-center gap-6">
                {[
                  { flag: "\u{1F1F0}\u{1F1FF}", country: "Казахстан" },
                  { flag: "\u{1F1E6}\u{1F1F2}", country: "Армения" },
                  { flag: "\u{1F1F0}\u{1F1EC}", country: "Киргизия" },
                  { flag: "\u{1F1FA}\u{1F1FF}", country: "Узбекистан" }
                ].map((item) => (
                  <div key={item.country} className="group relative cursor-pointer">
                    <div className="text-5xl transition-all group-hover:scale-125 group-hover:drop-shadow-lg">
                      {item.flag}
                    </div>
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="glass-card px-4 py-2 rounded-lg whitespace-nowrap">
                        <span className="text-sm font-medium">Скоро в {item.country}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============== ABOUT SECTION ============== */}
      <section id="about" className="py-24 bg-background">
        <div className="container">
          <AnimatedSection className="max-w-3xl mx-auto text-center space-y-6 mb-20">
            <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl md:text-6xl font-bold">
              Что такое <span className="gradient-text">DocDocPartner</span>?
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              DocDocPartner — это <strong className="text-foreground">B2B-платформа агентских рекомендаций</strong> в сфере здравоохранения. Мы связываем врачей-агентов с проверенными клиниками для направления пациентов на платное лечение.
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: Users,
                title: "Для врачей",
                desc: "Врачи хотят помочь пациенту найти профильного врача, но не имеют инфраструктуры для легальных рекомендаций и проверенные клиники в одном месте.",
                gradient: "from-[oklch(0.35_0.08_250)] to-[oklch(0.55_0.12_250)]"
              },
              {
                icon: Building2,
                title: "Для клиник",
                desc: "Клиники получают качественный поток пациентов от проверенных врачей-агентов без огромных затрат на маркетинг и бухгалтерское сопровождение.",
                gradient: "from-[oklch(0.35_0.08_250)] to-[oklch(0.55_0.12_250)]"
              },
              {
                icon: Shield,
                title: "Для пациентов",
                desc: "Пациенты получают рекомендации от доверенных врачей и попадают в проверенные клиники с гарантией качества.",
                gradient: "from-[oklch(0.35_0.08_250)] to-[oklch(0.55_0.12_250)]"
              }
            ].map((item, index) => (
              <motion.div key={index} variants={fadeUp} custom={index}>
                <Card className="glass-card border-2 border-white/20 h-full card-glow">
                  <CardContent className="pt-10 pb-8 space-y-5">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-lg`}>
                      <item.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ============== PROBLEM & SOLUTION ============== */}
      <section className="py-24 mesh-bg">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-7xl mx-auto">
            <AnimatedSection className="space-y-8">
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-semibold">
                  <Zap className="w-4 h-4" />
                  Проблема рынка
                </span>
              </motion.div>
              <motion.h2 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
                Каждый 3-й пациент получает <span className="gradient-gold-text">рекомендацию</span> на платную клинику
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-lg text-muted-foreground">
                По данным <a href="https://sk.ru" target="_blank" rel="noopener noreferrer" className="text-[oklch(0.35_0.08_250)] hover:underline font-semibold">исследования Сколково (2024)</a>, 57% взрослых россиян оплачивали медуслуги за последние 12 месяцев.
              </motion.p>
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
                    desc: "Готовы рекомендовать лечение в платных клиниках, но не имеют единой платформы и боятся бумажной волокиты."
                  },
                  {
                    num: "3",
                    title: "Клиники несут высокие расходы",
                    desc: "Тратят огромные бюджеты на маркетинг и не могут эффективно масштабировать работу с врачами-рекомендателями."
                  }
                ].map((item, i) => (
                  <motion.div key={item.num} variants={fadeUp} custom={i + 3} className="flex gap-5 group">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center group-hover:bg-destructive/20 transition-colors">
                      <span className="text-destructive font-bold text-lg">{item.num}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-lg mb-2">{item.title}</h4>
                      <p className="text-muted-foreground">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatedSection>

            <AnimatedSection>
              <motion.div variants={fadeInScale} className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.55_0.12_250)]/20 to-transparent rounded-3xl blur-3xl" />
                <img
                  src="/clinic-partnership.jpg"
                  alt="Консультация врача"
                  className="relative rounded-3xl shadow-2xl w-full h-auto max-h-[600px] object-contain glass-card"
                />
                {/* Floating badge */}
                <div className="absolute -bottom-4 -right-4 md:bottom-8 md:right-8 glass-card rounded-xl px-5 py-3 shadow-xl animate-float">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">+12 пациентов</div>
                      <div className="text-xs text-muted-foreground">направлено сегодня</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ============== HOW IT WORKS ============== */}
      <section id="how-it-works" className="py-24 bg-background">
        <div className="container">
          <AnimatedSection className="max-w-3xl mx-auto text-center space-y-6 mb-20">
            <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl md:text-6xl font-bold">
              Как это <span className="gradient-gold-text">работает</span>?
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg md:text-xl text-muted-foreground">
              Простой и прозрачный процесс от регистрации до получения вознаграждения
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 max-w-7xl mx-auto">
            {[
              { step: "01", title: "Регистрация", description: "Зарегистрируйтесь в Telegram-боте и подпишите договор оферты. Процесс занимает 5 минут.", icon: MessageSquare },
              { step: "02", title: "Отправка пациента", description: "Введите ФИО и дату рождения пациента. Данные передаются в CRM и клиники-партнеры.", icon: Users },
              { step: "03", title: "Лечение", description: "Пациент получает помощь в клинике. Вы отслеживаете статус в реальном времени через бот.", icon: Building2 },
              { step: "04", title: "Вознаграждение", description: "Получаете 10% от суммы лечения. Выплаты от 1000 руб. доступны в любое время.", icon: Wallet }
            ].map((item, index) => (
              <motion.div key={index} variants={fadeUp} custom={index} className="relative">
                {index < 3 && (
                  <div className="hidden lg:block absolute top-16 right-0 w-full h-0.5 translate-x-1/2 z-0">
                    <div className="h-full bg-gradient-to-r from-[oklch(0.70_0.15_75)]/40 to-transparent" />
                  </div>
                )}
                <Card className="h-full glass-card border-2 border-white/20 card-glow relative z-10">
                  <CardContent className="pt-10 pb-8 space-y-5">
                    <div className="text-7xl font-bold text-[oklch(0.70_0.15_75)]/15">{item.step}</div>
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[oklch(0.35_0.08_250)] to-[oklch(0.55_0.12_250)] flex items-center justify-center shadow-lg">
                      <item.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ============== BENEFITS ============== */}
      <section id="benefits" className="py-24 mesh-bg">
        <div className="container">
          <AnimatedSection className="max-w-3xl mx-auto text-center space-y-6 mb-20">
            <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl md:text-6xl font-bold">
              Почему выбирают <span className="gradient-text">DocDocPartner</span>?
            </motion.h2>
          </AnimatedSection>

          <AnimatedSection className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
            {[
              { icon: Shield, title: "Полная легальность", description: "Все выплаты проходят через официальный договор. Вы работаете как самозанятый или ИП." },
              { icon: TrendingUp, title: "Прозрачная система", description: "Отслеживайте статус каждой рекомендации в реальном времени через Telegram-бот." },
              { icon: Wallet, title: "Быстрые выплаты", description: "Минимальная сумма вывода — 1000 руб. Выплаты в течение 3 рабочих дней." },
              { icon: Star, title: "Проверенные клиники", description: "Работаем только с лицензированными медицинскими учреждениями с хорошей репутацией." },
              { icon: BarChart3, title: "Детальная статистика", description: "Полная аналитика по вашим рекомендациям, заработку и бонусным баллам." },
              { icon: FileText, title: "База знаний", description: "Подробные инструкции, FAQ и поддержка на каждом этапе работы." }
            ].map((benefit, index) => (
              <motion.div key={index} variants={fadeUp} custom={index}>
                <Card className="glass-card border-2 border-white/20 h-full card-glow">
                  <CardContent className="pt-10 pb-8 space-y-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[oklch(0.70_0.15_75)] to-[oklch(0.75_0.18_65)] flex items-center justify-center shadow-lg">
                      <benefit.icon className="w-7 h-7 text-[oklch(0.15_0.05_75)]" />
                    </div>
                    <h3 className="text-xl font-bold">{benefit.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ============== PARTNER CLINICS ============== */}
      <section className="py-24 bg-background">
        <div className="container">
          <AnimatedSection className="max-w-3xl mx-auto text-center space-y-6 mb-20">
            <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl md:text-6xl font-bold">
              Наши <span className="gradient-gold-text">клиники-партнеры</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg md:text-xl text-muted-foreground">
              Работаем только с проверенными медицинскими учреждениями
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {[
              { name: "Евроонко", type: "Онкология", since: "2011", image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=300&fit=crop" },
              { name: "ЕМС", type: "Многопрофильная", since: "1989", image: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=400&h=300&fit=crop" },
              { name: "МИБС", type: "Онкология", since: "2006", image: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=400&h=300&fit=crop" },
              { name: "Медси", type: "Многопрофильная", since: "1957", image: "https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?w=400&h=300&fit=crop" },
              { name: "Клиника Ройтберга", type: "Многопрофильная", since: "1990", image: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=400&h=300&fit=crop" },
              { name: "Мать и дитя", type: "Акушерство", since: "2006", image: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=400&h=300&fit=crop" },
              { name: "Поликлиника.ру", type: "Многопрофильная", since: "1998", image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=300&fit=crop" },
              { name: "СМ-Клиника", type: "Многопрофильная", since: "2002", image: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=400&h=300&fit=crop" }
            ].map((clinic, index) => (
              <motion.div key={index} variants={fadeUp} custom={index}>
                <Card className="glass-card border-2 border-white/20 card-glow overflow-hidden h-full">
                  <div className="relative h-40 overflow-hidden group">
                    <img
                      src={clinic.image}
                      alt={clinic.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-white font-bold text-lg drop-shadow-lg">{clinic.name}</h3>
                    </div>
                  </div>
                  <CardContent className="pt-4 pb-5 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{clinic.type}</span>
                      <span className="text-muted-foreground">c {clinic.since}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatedSection>

          <AnimatedSection className="text-center mt-12">
            <motion.div variants={fadeUp}>
              <Link href="/clinics" className="inline-flex items-center gap-2 text-[oklch(0.35_0.08_250)] hover:text-[oklch(0.55_0.12_250)] font-semibold transition-colors group">
                Посмотреть все клиники
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ============== MAP SECTION (hidden, can be re-enabled later) ============== */}
      {/*
      <section id="map" className="py-24 mesh-bg">
        <div className="container">
          <AnimatedSection className="max-w-3xl mx-auto text-center space-y-6 mb-16">
            <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl md:text-6xl font-bold">
              <span className="gradient-text">География</span> партнеров
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg md:text-xl text-muted-foreground">
              Наши клиники-партнеры расположены по всей России. Интерактивная карта поможет найти ближайшую клинику.
            </motion.p>
          </AnimatedSection>

          <AnimatedSection>
            <motion.div variants={fadeInScale}>
              <Suspense fallback={
                <div className="w-full h-[500px] rounded-2xl skeleton flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-muted-foreground animate-bounce" />
                </div>
              }>
                <ClinicMap clinics={mapClinics} height="500px" />
              </Suspense>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>
      */}

      {/* ============== FINAL CTA ============== */}
      <section className="py-32 bg-gradient-to-br from-[oklch(0.35_0.08_250)] to-[oklch(0.55_0.12_250)] text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-10 right-20 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute bottom-10 left-20 w-60 h-60 bg-[oklch(0.70_0.15_75)]/10 rounded-full blur-3xl" />
        </div>

        <div className="container relative z-10">
          <AnimatedSection className="max-w-4xl mx-auto text-center space-y-8">
            <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
              Готовы начать зарабатывать легально?
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg md:text-xl text-white/80">
              Присоединяйтесь к DocDocPartner и получайте до 10% от каждой рекомендации
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                className="btn-premium text-[oklch(0.15_0.05_75)] font-semibold text-lg h-16 px-10"
                onClick={() => window.open('https://t.me/docpartnerbot', '_blank')}
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                Начать работу в Telegram
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="py-16 bg-background border-t border-border/40">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663256942923/xohsFKyBQyuhihyR.png"
                  alt="DocDocPartner Logo"
                  className="w-10 h-10 rounded-lg"
                />
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
            <p>&copy; 2025 DocDocPartner. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
    <DoctorChatbot />
    </>
  );
}
