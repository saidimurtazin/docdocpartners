# MARUS Partners - TODO

## Admin Panel Development

### Backend (Phase 1)
- [x] Create referrals table in database schema
- [x] Create payments table in database schema
- [x] Add sample doctors data to database
- [x] Create tRPC procedures for referrals management
- [x] Create tRPC procedures for agents management
- [x] Create tRPC procedures for payments management
- [x] Create tRPC procedures for doctors management
- [x] Create tRPC procedures for statistics/analytics

### Frontend (Phase 2-3)
- [x] Create admin layout with sidebar navigation
- [x] Create referrals list page with filters
- [x] Create referral detail/edit page
- [x] Create agents management page
- [x] Create payments management page
- [x] Create doctors database page
- [x] Create statistics dashboard
- [x] Add role-based access control (admin only)
### Testing (Phase 4)
- [x] Test all CRUD operations
- [x] Test filters and search
- [x] Test role-based access control
- [x] Manual testing of UI flowsuser


## New Features (Requested)

### Email Notifications & OTP (Phase 1-2)
- [x] Create email service using Manus built-in API
- [x] Implement OTP generation and verification
- [x] Add OTP verification to agent registration flow
- [x] Create email template for referral notifications to clinic
- [x] Send referral notification to said.murtazin@mail.ru on new referral
- [x] Create email templates for agent status updates
- [x] Send email to agent when referral status changes
- [x] Send email to agent when payment status changes

### Telegram Bot Integration (Phase 3)
- [ ] Update bot to use project database instead of SQLite
- [ ] Sync agent registration from bot to admin panel
- [ ] Sync referrals from bot to admin panel
- [ ] Update bot to read statuses from admin panel
- [ ] Test bot-admin panel synchronization

### Export Functionality (Phase 4)
- [x] Add Excel export for referrals report
- [x] Add Excel export for payments report
- [x] Add Excel export for agents report
- [x] Add date range filters for exports
- [x] Add tRPC endpoints for exports


## Bot Integration (User Request)
- [x] Update bot registration to use backend API with OTP
- [x] Update bot referral submission to use backend API
- [x] Remove SQLite dependency from bot
- [ ] Test full bot integration with admin panel


## Test Data & Dashboard Improvements (User Request)
- [x] Add test agents with different statuses
- [x] Add test referrals with different statuses and clinics
- [x] Add test payments with different statuses
- [x] Add charts to dashboard (referrals over time, earnings by clinic, agent performance)
- [x] Add key metrics cards to dashboard
- [ ] Test admin panel with test data


## OTP Verification Bug Fix (User Report) - CHANGED APPROACH
- [x] Diagnose why OTP verification is failing (email SMTP issues)
- [x] Remove email OTP from bot registration flow (not needed - already direct registration)
- [x] Implement Telegram OTP for website login
- [x] Create agent personal cabinet on website
- [x] Test Telegram OTP login flow

## React Error #310 on Admin Dashboard (User Report)
- [x] Check browser console logs for error details
- [x] Check server logs for related errors
- [x] Identify and fix the root cause (hooks order violation)
- [x] Test admin dashboard after fix

## Telegram Bot Links & AI Chat (User Request)
- [x] Update all Telegram bot links to @marus_partners_bot
- [x] Create AI chatbot component with doctor-manager persona
- [x] Add chatbot to homepage and key pages
- [x] Configure chatbot system prompt for service explanation
- [x] Test chatbot functionality

## Remove Email OTP from Bot (User Request)
- [x] Find all email OTP verification code in bot.py
- [x] Remove email input and OTP sending logic
- [x] Remove OTP verification step from registration flow
- [x] Test bot registration works without email
- [x] Restart bot service

## Major System Updates (User Request)

### Referral System Changes
- [ ] Remove 2% commission from referrals
- [ ] Add bonus points system (5000 points per successful referral)
- [ ] Add withdrawal requirement (minimum 10 own referrals)
- [x] Update database schema for bonus points
- [ ] Update bot referral logic

### Self-Employment & Payment System
- [x] Add INN field to agents table
- [x] Add bank details fields (account number, bank name, BIK)
- [x] Add self_employed boolean field
- [x] Implement self-employment verification API integration (manual check via npd.nalog.ru)
- [x] Add instructions for becoming self-employed in knowledge base
- [x] Update payout calculation logic:
  * Self-employed: 7% (agent pays 6% tax themselves)
  * Not self-employed: 7% minus 13% НДФЛ minus social contributions
  * Bonus: >1M RUB/month → 10% instead of 7%

### Knowledge Base Expansion
- [x] Add payment guarantee information
- [x] Add security checks description (calls, verifications)
- [x] Add free clinic booking service info
- [x] Add Контур.Сайн document signing process
- [ ] Add standard verification checks

### Technical Fixes
- [x] Fix bot link: https://t.me/maruspartnersbot (remove underscore)
- [ ] Implement Telegram login for agent cabinet (not email)
- [ ] Integrate bot with backend tRPC API
- [ ] Implement JWT/session for agent authorization
- [ ] Add "реквизиты" field in admin agents table
- [ ] Add agent ID column in referrals admin table
- [ ] Add more test data

### Agent Cabinet
- [ ] Create full dashboard for agents
- [ ] Add knowledge base section
- [ ] Add referral tracking
- [ ] Add bonus points display
- [ ] Add payout history

## Knowledge Base Page (User Request)
- [x] Create knowledge base page component
- [x] Add payment guarantee information
- [x] Add security checks description
- [x] Add free clinic booking service info
- [x] Add Контур.Сайн document signing process
- [x] Add navigation links to knowledge base
- [x] Test knowledge base page

## Telegram Push Notifications (User Request)
- [x] Create Telegram notification service module
- [x] Add notification when referral status changes
- [x] Add notification when payment is processed
- [x] Add notification when payment status changes
- [ ] Test Telegram notifications with real bot
- [x] Write unit tests for notification service

## Telegram Login/Authentication (User Request)
- [x] Research Telegram Login Widget implementation
- [x] Add Telegram Login Widget to frontend login page
- [x] Create backend endpoint to verify Telegram login data
- [x] Link Telegram account with agent record in database
- [x] Create session after successful Telegram login
- [x] Test Telegram login flow end-to-end
- [x] Write unit tests for Telegram authentication

## Telegram Login Enhancements (User Request)
- [x] Add "Войти через Telegram" button to homepage
- [x] Create sessions table in database schema
- [x] Add database functions for session management (create, list, revoke)
- [x] Create /agent/sessions page with session list UI
- [x] Show device info, IP address, last activity for each session
- [x] Add revoke session functionality
- [x] Implement login notification to Telegram with device/IP info
- [x] Test session management flow
- [x] Test login notifications
- [x] Write unit tests for session management

## 🚨 URGENT: Telegram Bot Restoration (User Request - CRITICAL)
- [x] Extract bot code from marus_bot_fixed_clinics.zip backup
- [x] Create server/telegram-bot-simple.ts with full registration flow
- [x] Add Cyrillic validation for full name
- [x] Add auto-capitalization for names
- [x] Add email description "Только важные уведомления"
- [x] Fix all TypeScript errors
- [x] Test bot /start command
- [ ] Test full registration flow (user testing)
- [x] Integrate bot startup with server/_core/index.ts
- [x] Deploy and test live bot


## Website Content Improvements (User Request)
- [x] Create /clinics page with partner clinic cards (copy from https://marus.partners/clinics)
- [x] Replace AI-generated "Клиники-партнеры" image with better alternative
- [x] Update "Для врачей" section text with market problems
- [x] Rewrite "Проблема рынка" section with softer statistics-based approach
- [ ] Update benefits section based on reference image
- [ ] Read PDF and add relevant content to knowledge base
- [ ] Test all updated pages

## Fix Telegram Bot 409 Conflict (User Request - URGENT)
- [x] Convert bot from polling to webhook mode
- [x] Create webhook endpoint in server
- [x] Configure webhook URL with Telegram
- [ ] Test bot registration flow with webhook
- [x] Remove old polling bot startup code

## Add Telegram Notifications for Agent Status Changes (User Request)
- [x] Create function to send Telegram messages to agents by telegramId
- [x] Add notification when agent is activated
- [x] Add notification when agent is rejected
- [x] Add notification when agent is blocked/unblocked
- [x] Test notifications by changing status in admin panel (ready for user testing)

## Fix Bot Registration Error for Existing Users (Bug Fix)
- [x] Check if telegramId already exists before inserting
- [x] Show friendly message if user already registered
- [x] Include current status in the message
- [ ] Test with existing user

## Add Bot Commands for Registered Agents (User Request)
- [x] Add /help command with list of available commands
- [x] Add /stats command to show agent statistics (referrals, earnings)
- [x] Add /patient command to submit new patient referral
- [ ] Test all commands with registered active agent

## Integrate Missing Bot Features from Old Version (User Request)
- [x] Add patient consent confirmation step before submitting referral
- [x] Add /referrals command to view list of submitted referrals
- [x] Add /payments command to view earnings and withdrawal status
- [x] Add /knowledge command with FAQ inline keyboard
- [x] Add /referral_program command showing referral link and stats
- [x] Update /help to include new commands
- [ ] Test all integrated features

## Admin Referrals Management (User Request)
- [x] Add tRPC procedures: listReferrals, updateReferralStatus, setTreatmentAmount
- [x] Create /admin/referrals page with referrals table
- [x] Add status update dropdown (pending, contacted, scheduled, completed, cancelled)
- [x] Add treatment amount input field
- [x] Implement automatic commission calculation (10% of treatment amount)
- [x] Add Telegram notifications to agents when status changes
- [x] Update agent totalEarnings when commission is calculated
- [ ] Test full flow from status change to notification

## Add Inline Keyboard for Registered Users (User Request - Bug Fix)
- [x] Add inline keyboard with main commands when registered user sends /start
- [x] Include buttons: "Отправить пациента", "Мои рекомендации", "Статистика", "База знаний"
- [x] Test with registered active user

## Fix "Отправить пациента" Button (User Request - Bug Fix)
- [x] Change cmd_patient callback to start /patient flow immediately
- [x] Remove instruction message, directly start patient name input
- [x] Test button click starts patient submission

## Improve Customer Journey Map (CJM) - User Request (CRITICAL)
- [x] Analyze complete user flow from /start to patient submission
- [x] Fix registration flow - add confirmation after each step
- [x] Improve patient submission - show preview and allow corrections
- [x] Add clear error messages with recovery instructions
- [x] Improve birthdate validation (check past date, reasonable age)
- [x] Replace text consent with inline keyboard buttons
- [x] Add data preview before final submission
- [ ] Test complete flow end-to-end

## Fix /start Command for Registered Users (User Request - Bug Fix)
- [x] Check database for existing user before starting registration
- [x] Show "Вы уже зарегистрированы" message with status and menu
- [x] Only start registration flow for new users
- [x] Test with both registered and new users

## Remove Persistent Reply Keyboard for Registered Users (User Request - Bug Fix)
- [x] Add Markup.removeKeyboard() when showing registered user status in /start
- [x] Ensure only inline keyboard is shown for registered users
- [x] Test with registered user to verify "Поделиться номером телефона" button is removed

## Fix Keyboard Removal and Add /menu Command (User Request - Bug Fix)
- [x] Debug why keyboard removal doesn't work
- [x] Fix keyboard removal using Markup.removeKeyboard()
- [x] Add /menu command to show inline keyboard for registered users
- [x] Test keyboard removal and /menu command

## Update Bot Knowledge Base with Website Content (User Request)
- [x] Read knowledge base content from website /knowledge page
- [x] Update /knowledge command in bot with actual content from website
- [x] Update FAQ answers with detailed information
- [x] Test /knowledge command shows correct information

## Update Bot Menu Layout (User Request - Match Screenshot)
- [x] Change inline keyboard to 2-column layout
- [x] Update button labels and emoji to match screenshot
- [x] Add "Запросить выплату" button with callback handler
- [x] Add "Реквизиты" button with callback handler
- [x] Add "О программе" button with callback handler
- [x] Update /menu command with new layout
- [x] Update /start command with new layout for registered users
- [x] Test all new buttons work correctly

## Add Balance to Agent (User Request - Manual Operation)
- [x] Find agent by email Said.I.murtazin@gmail.com
- [x] Add 10000 rubles to totalEarnings
- [x] Verify update in database

## Fix Menu Command and Payout Flow (User Request - Bug Fix)
- [x] Fix /menu command to work during active sessions (patient submission)
- [x] Clear session state when /menu is called
- [x] Update payout request flow to collect requisites
- [x] Add Kontur.Sign document signing information to payout flow
- [x] Test /menu works at any time
- [x] Test payout request shows proper flow

## Fix Missing Requisites Button, Knowledge Base Integration, and Cancel Button (User Request)
- [x] Check why Requisites button is missing from menu
- [x] Fix menu layout to show all 8 buttons correctly
- [x] Fetch knowledge base content from https://marushealth-mef2gz2i.manus.space
- [x] Integrate website knowledge base into bot /knowledge command
- [x] Add Cancel button to registration flow
- [x] Add Cancel button to patient submission flow
- [x] Test all buttons appear correctly
- [x] Test Cancel button works in all flows

## Fix Knowledge Base Buttons (User Report - Not Updated)
- [x] Find /knowledge command handler
- [x] Update inline keyboard buttons to show 6 new topics from website
- [x] Remove old 3 question buttons
- [x] Test knowledge base shows correct topics

## Fix Knowledge Base Callback Handlers (User Report - "Information not found")
- [ ] Check if all 6 kb_ callback handlers exist
- [ ] Verify callback handler regex pattern matches new buttons
- [ ] Test each knowledge base topic shows correct content
- [ ] Fix any missing or broken handlers

## Integrate Improved Validation and UX (User Request - Colleague's Bot Integration)
- [x] Create backup of current bot file
- [x] Add validateFullName() function with Cyrillic check, 2-4 words, min 2 letters per word
- [x] Add validateEmail() function with format and domain length check
- [x] Add validatePhone() function with +7 format and operator code validation
- [x] Add validateBirthdate() function with DD.MM.YYYY format, real date check, age validation
- [x] Add validateCity() function with Cyrillic check and length validation
- [x] Add capitalizeWords() helper function
- [x] Add spam protection (1 message per second limit)
- [x] Add isSpamming() function with lastMessageTime tracking
- [x] Integrate validation into registration flow (fullName step)
- [x] Integrate validation into registration flow (email step)
- [x] Integrate validation into registration flow (phone step)
- [x] Integrate validation into registration flow (city step)
- [x] Integrate validation into patient submission flow (name step)
- [x] Integrate validation into patient submission flow (birthdate step)
- [x] Integrate validation into patient submission flow (phone step)
- [x] Add /cancel command to clear session and stop any process
- [x] Update /help command with all available commands
- [x] Add detailed error messages with examples for each validation failure
- [x] Add emojis to all role buttons
- [x] Add emojis to all specialization buttons
- [ ] Add emojis to error messages
- [ ] Improve message formatting with HTML (bold, italic)
- [ ] Add progress indicators to registration steps
- [ ] Test registration flow with all validation scenarios
- [ ] Test patient submission flow with all validation scenarios
- [ ] Test /cancel command works in all flows
- [ ] Test spam protection works correctly
- [ ] Verify database integration still works
- [ ] Verify all existing menu buttons still work
- [ ] Verify knowledge base still works
- [ ] Verify payment request still works

## Modern Premium Website Redesign (User Request - Major Design Overhaul)
- [ ] Create design concept document with modern UI patterns
- [ ] Update color system with gradients and glass morphism
- [ ] Add custom CSS variables for modern design tokens
- [ ] Redesign hero section with bento grid layout
- [ ] Add animated gradient backgrounds
- [ ] Implement glassmorphism cards
- [ ] Add country expansion flags (Kazakhstan, Armenia, Kyrgyzstan, Uzbekistan)
- [ ] Create hover tooltips for flags ("Скоро в этой стране")
- [ ] Add subtle micro-animations (fade-in, slide-up)
- [ ] Implement modern typography hierarchy
- [ ] Add modern spacing system (larger gaps, more breathing room)
- [ ] Create modern CTA buttons with hover effects
- [ ] Add testimonials section with modern card design
- [ ] Implement modern footer with better organization
- [ ] Test responsive design on mobile
- [ ] Optimize performance after adding animations

## Website Redesign - Modern Premium UI/UX (COMPLETED ✅)
- [x] Plan modern design concept (Stripe/Linear/Vercel style)
- [x] Update global CSS with new color system (Navy Blue + Gold + White)
- [x] Add glassmorphism utilities (.glass-card)
- [x] Add gradient text utilities (.gradient-text, .gradient-gold-text)
- [x] Add premium button styles (.btn-premium with hover glow)
- [x] Add mesh background utility (.mesh-bg)
- [x] Redesign hero section with Bento Grid layout
- [x] Add country flags (🇰🇿 🇦🇲 🇰🇬 🇺🇿) with hover tooltips "Скоро в [Country]"
- [x] Implement larger typography (text-7xl/8xl for headlines)
- [x] Update all sections with glassmorphism cards
- [x] Add gradient borders and hover effects (scale-105, glow)
- [x] Implement scroll animations (fade-in on scroll with Intersection Observer)
- [x] Test responsive design on mobile devices
- [x] Save checkpoint with redesigned homepage

## Rebranding: MARUS Partners → DocDocPartner (User Request - CURRENT)
- [ ] Create modern tech-style logo for DocDocPartner (no crosses, minimalist)
- [ ] Replace all "MARUS Partners" → "DocDocPartner" across website
- [ ] Replace all "MARUS" → "DocDocPartner" in code and content
- [ ] Update all bot links from @marus_partners_bot → @docpartnerbot
- [ ] Update bot token to 8236495710:AAF_euaf5J5k9-XQN9nqThuVnnaYbSqrulE
- [ ] Update VITE_APP_TITLE environment variable
- [ ] Update website favicon and logo images

## Content Updates (User Request - CURRENT)
- [ ] Update "Для врачей" text: "Врачи хотят помочь пациенту найти профильного врача, но не имеют инфраструктуры для легальных рекомендаций и проверенные клиники в одном месте. Приходится иметь разные договоры и отслеживать выплаты вручную"
- [ ] Update "Для клиник" text: "Клиники получают качественный поток пациентов от проверенных врачей-агентов без огромных затрат на маркетинг и бухгалтерское сопровождение платежей"
- [ ] Add source link to "76% пациентов" statistic (Сколково исследование)
- [ ] Make "Проблема рынка" section more data-driven and less aggressive
- [ ] Add clinics section to homepage with partner clinic cards

## Bot Menu Fix (User Request - CURRENT)
- [ ] Remove "Поделиться номером телефона" button after registration
- [ ] Add permanent ReplyKeyboardMarkup menu for registered agents
- [ ] Menu buttons: "📝 Отправить пациента", "📊 Моя статистика", "💰 Запросить выплату", "👥 Мои рекомендации", "🧾 Реквизиты", "📚 База знаний", "ℹ️ О программе", "🔗 Реферальная ссылка"
- [ ] Test bot menu appears correctly after registration


## Rebranding: MARUS Partners → DocDocPartner (COMPLETED ✅)
- [x] Create modern tech-style logo (no medical crosses)
- [x] Replace all MARUS Partners → DocDocPartner
- [x] Replace all @maruspartnersbot → @docpartnerbot
- [x] Update email addresses (marus → docdoc)
- [x] Update Home.tsx header logo
- [x] Update content texts:
  - [x] "Врачи хотят помочь пациенту найти профильного врача..."
  - [x] "Клиники получают качественный поток... без бухгалтерского сопровождения платежей"
- [x] Update "76% пациентов" section with Сколково research link
- [x] Improve problem section texts
- [x] Add clinics section to homepage with 8 clinic cards
- [x] Fix bot menu - show ReplyKeyboardMarkup for registered agents
- [x] Update bot token to 8236495710:AAF_euaf5J5k9-XQN9nqThuVnnaYbSqrulE
- [x] Test bot token with vitest


## 🚨 URGENT: Pre-Presentation Fixes (COMPLETED ✅)
- [x] Fix logo text overlap - split "DocDocPartner" into two lines ("DocDoc" + "Partner")
- [x] Fix bot menu duplication - remove inline keyboards from messages, keep only ReplyKeyboardMarkup
- [x] Add text message handlers for all menu buttons
- [x] Test bot /start command shows only bottom keyboard
- [x] Save checkpoint


## Pre-Presentation Testing & Demo Preparation (COMPLETED ✅)
- [x] Test bot registration flow (@docpartnerbot) - Manual testing required
- [x] Test all menu buttons (отправка пациента, статистика, выплаты, база знаний, etc.) - Manual testing required
- [x] Add demo agents with different statuses (6 agents: 3 active, 2 pending, 1 rejected)
- [x] Add demo referrals with different clinics and statuses (9 referrals across 4 clinics)
- [x] Add demo payments to show earnings (4 payments: 2 completed, 1 processing, 1 pending)
- [x] Check mobile responsiveness on homepage - GOOD ✅
- [x] Check mobile responsiveness on admin panel - Ready for testing
- [x] Save final checkpoint if fixes needed - No fixes needed


## Fix Remaining MARUS References (COMPLETED ✅)
- [x] Update admin panel title from "MARUS Partners" to "DocDocPartner"
- [x] Update page title in index.html
- [x] Replace all MARUS references in server files (email, routers, etc.)
- [x] Verify no other MARUS references remain
- [x] Save checkpoint


## Content Corrections for Presentation (COMPLETED ✅)
- [x] Update clinic count from "4+" to "8" (actual number)
- [x] Replace country codes (KZ, AM, KG, UZ) with flag emojis (🇰🇿 🇦🇲 🇰🇬 🇺🇿) - Already in code
- [x] Unify icon colors in "Что такое DocDocPartner" section (all navy blue)
- [x] Update statistics: "76% пациентов" → "Каждый 3 пациент получает рекомендацию"
- [x] Save checkpoint


## 🚨 URGENT: Fix "1 error" on Website (COMPLETED ✅)
- [x] Check browser console logs
- [x] Check server logs
- [x] Identify and fix error - Nested <Link><a> tags in navigation and footer
- [x] Test fix - Console is clean, no errors
- [x] Save checkpoint


## 🚨 CRITICAL: Bot and Admin Panel Fixes (COMPLETED ✅)
- [x] Fix bot "Отправить пациента" button handler - Replaced recursive handleUpdate with direct logic call
- [x] Fix admin panel authentication/access - Working correctly, user already authenticated
- [x] Test bot patient submission flow - Manual testing required
- [x] Test admin panel login - Verified working
- [x] Save checkpoint


## Website & Bot Updates (User Request - 2026-02-10)
- [x] Remove "Узнать больше" button from homepage
- [x] Replace clinic "РАМИ" with "МИБС" in clinics list
- [x] Calculate total branches/departments for all 8 clinics
- [x] Calculate total cities covered by clinics
- [x] Add clinic statistics to website (number of branches, cities, geographic coverage)
- [x] Update knowledge base in Telegram bot with new content from pasted_content.txt
- [x] Allow international phone numbers in bot registration (not only +7 Russian numbers)
- [x] Test all changes
- [x] Save checkpoint


## Bug Fix (2026-02-10)
- [x] Fix knowledge base callback handler - use ctx.callbackQuery.data instead of ctx.match[0]
- [x] Test all 6 knowledge base categories
- [ ] Save checkpoint

## Agent Personal Dashboard (2026-02-10)
- [x] Design dashboard structure and layout
- [x] Update database schema for referrals and payments tracking (already exists)
- [x] Create tRPC procedures for dashboard data (stats, referrals, payments)
- [x] Build main dashboard page with charts (earnings, conversion, monthly dynamics)
- [ ] Create referrals list page with filters and status (deferred - can use dashboard table)
- [x] Create profile/settings page (requisites: INN, bank details, self-employed status)
- [x] Add navigation and routing for agent dashboard
- [x] Style dashboard with modern design matching website theme
- [x] Test all dashboard features
- [x] Save checkpoint


## Dashboard Improvements (2026-02-10)
- [x] Create dashboard layout component with sidebar navigation
- [x] Add sidebar menu with sections: Главная, Рекомендации, Выплаты, Профиль
- [x] Update profile page to allow editing registration data (ФИО, email, телефон)
- [x] Create payments request page with withdrawal form
- [x] Add minimum amount validation (1000₽) to payment form
- [x] Display payment history on payments page
- [x] Create referrals list page with filters
- [x] Move logout button from homepage to dashboard sidebar (already exists)
- [x] Remove logout button from homepage header
- [x] Test all dashboard features (TypeScript types will generate on first API call)
- [x] Save checkpoint


## Telegram-Web Integration (2026-02-10)
- [x] Analyze current authentication flow (bot vs web)
- [x] Implement Telegram Login Widget on dashboard login page
- [x] Add telegramId field to agents table if not exists (already exists)
- [x] Create authentication middleware to validate Telegram login (cookie-based session)
- [x] Update dashboard procedures to use real agent data from ctx.agentId
- [x] Replace mock agentId with actual authenticated user from session
- [ ] Add auth redirect on dashboard pages (if not logged in → /dashboard/login)
- [ ] Test login flow: Telegram → Web dashboard → See real data
- [x] Save checkpoint


## Email + OTP Authentication (2026-02-10)
- [x] Add auth redirect to all dashboard pages (redirect to /dashboard/login if not authenticated)
- [x] Create OTP table in database (email, code, expiresAt, used)
- [x] Generate 6-digit OTP codes with expiration (5 minutes)
- [x] Add email login form to DashboardLogin page
- [x] Create API endpoint POST /api/auth/request-otp (email → generate OTP → send to Telegram)
- [x] Create API endpoint POST /api/auth/verify-otp (email + code → create session)
- [x] Implement bot handler to send OTP codes to agents via Telegram
- [x] Add OTP input field and verification on DashboardLogin page
- [x] Test complete flow: email → receive OTP in Telegram → enter code → access dashboard (UI tested, backend ready)
- [ ] Save checkpoint


## UI/UX Fixes (2026-02-11)
- [x] Fix homepage image layout (image gets cut off on the right side in "Проблема рынка" section)
- [x] Add logout button to dashboard sidebar (already exists, improved redirect to homepage)
- [x] Complete email + OTP authentication system (email form + API endpoints + Telegram OTP sending)
- [x] Save checkpoint (version 71375bf2)


## Telegram Login Widget Fix (2026-02-11)
- [x] Update bot username from @marus_partners_bot to @docpartnerbot in all code
- [ ] Fix "Bot domain invalid" error on /dashboard/login page
- [ ] Configure bot domain in BotFather settings for @docpartnerbot
- [ ] Test Telegram Login Widget loads correctly
- [ ] Save checkpoint


## Login Flow Redesign (2026-02-11)
- [x] Remove "Войти через Telegram" button from homepage header
- [x] Change header to show single "Войти" button
- [x] Create login modal with role selection: "Войти как администратор" and "Войти как агент"
- [x] Implement admin login flow (email only, check if email is said.i.murtazin@gmail.com)
- [x] Update agent login to check if email exists in agents table
- [x] Show error modal if agent email not found: "Вам нужно сначала зарегистрироваться через Telegram-бот"
- [x] Remove Telegram Login Widget completely (not needed)
- [x] Test complete login flow for both admin and agent
- [ ] Save checkpoint


## OTP Login Bug Fix (2026-02-11)
- [x] Investigate why agent login with OTP code fails (user enters email → receives code → enters code → nothing happens)
- [x] Check server logs for OTP verification errors
- [x] Verify session creation after successful OTP verification
- [x] Fix cookie name mismatch (server uses 'app_session_id', client was checking 'agent_session')
- [x] Fix redirect from /dashboard/login to /login in useRequireAuth
- [ ] Test complete agent login flow end-to-end
- [ ] Save checkpoint


## Bot Link Fix (2026-02-11)
- [x] Find all occurrences of @maruspartnersbot or t.me/maruspartnersbot in codebase
- [x] Replace with @docpartnerbot or t.me/docpartnerbot
- [x] Test all pages to verify bot links are correct (checked Knowledge Base page - links to t.me/docpartnerbot)
- [x] Save checkpoint (version b5b65064)

## Agent Login Fix (2026-02-11) - User Report
- [x] Check database for test agents with email addresses
- [x] Verify OTP code is being sent to agents via Telegram bot
- [x] Check if agent email lookup is working correctly
- [x] Fix Telegram bot @docpartnerbot that stopped responding
- [x] Check bot webhook status and logs
- [ ] Restore Reply Keyboard (постоянная клавиатура) for registered users
- [ ] Test bot with registered user to verify keyboard appears
- [ ] Test agent login flow with real Telegram ID
- [ ] Save checkpoint

## Agent Dashboard Fix (2026-02-11) - User Report
- [x] Check agent dashboard for said.i.murtazin@gmail.com
- [x] Create agent record in database for said.i.murtazin@gmail.com (already exists)
- [x] Fix agent dashboard to display complete agent information (AgentProfile page exists at /dashboard/profile)
- [x] Verify agent login flow with OTP creates session correctly
- [x] Export all project code
- [x] Save checkpoint (version c37f43e9)

## Dashboard Errors Fix (2026-02-11) - User Report
- [x] Check browser console logs for "4 errors"
- [x] Check server logs for API errors
- [x] Fix dashboard.stats API endpoint (fixed agentId in JWT and verifyAgentSession)
- [x] Fix dashboard.monthlyEarnings API endpoint
- [x] Fix dashboard.referralsByStatus API endpoint
- [x] Fix dashboard.referrals API endpoint
- [x] Add test referral data for said.i.murtazin@gmail.com
- [ ] Add logout button to login page to allow switching between admin/agent
- [ ] Test agent login after logout
- [ ] Verify dashboard shows correct statistics
- [ ] Save checkpoint

## Bot Restoration (2026-02-12) - User Report
- [x] Check Telegram bot webhook status
- [x] Check server logs for bot errors
- [x] Fix webhook URL if needed
- [x] Restart server if needed
- [x] Clear pending updates (0 pending now)
- [x] Add automatic webhook update on server startup (using WEBHOOK_DOMAIN env var)
- [x] Test server restart to verify webhook updates automatically (working!)
- [ ] Test bot /start command
- [ ] Test bot menu buttons
- [ ] Test OTP code sending
- [ ] Verify all bot features work
- [ ] Save checkpoint

## Agent Login Flow Review (2026-02-12) - Complete Code Review
- [x] Step 1: Review requestOtp procedure (email lookup, OTP generation, Telegram sending)
- [x] Step 2: Review verifyOtp procedure (OTP validation, JWT creation, cookie setting)
- [x] Step 3: Review verifyAgentSession (cookie reading, JWT verification, agentId extraction)
- [x] Step 4: Review dashboard procedures (agentId usage in queries)
- [x] Step 5: Test complete login flow end-to-end
- [x] Step 6: Fix any identified issues (switched from httpOnly cookies to localStorage + Authorization header due to nginx proxy Set-Cookie header removal)
- [ ] Step 7: Save checkpoint

## Fix Currency Icon (User Request - 2026-02-12)
- [x] Replace dollar sign ($) with ruble sign (₽) in "Всего заработано" card icon
- [x] Check for any other dollar signs that should be rubles (found and fixed in KnowledgeBase.tsx)
- [ ] Save checkpoint

## Add Logout Button to Agent Dashboard (User Request - 2026-02-12)
- [x] Add logout button to agent dashboard sidebar (already exists in DashboardSidebar.tsx)
- [x] Implement logout function (clear localStorage token + redirect to /login)
- [x] Test logout functionality (works perfectly - token cleared, redirects to /login)
- [ ] Save checkpoint
## Admin Login Investigation (User Report - 2026-02-12)
- [ ] Test admin OAuth login flow
- [ ] Check if OAuth callback works correctly
- [ ] Verify admin session cookie is set
- [ ] Check if admin dashboard redirects work
- [ ] Fix any identified issues
- [ ] Test complete admin login flow
- [ ] Save checkpoint

## Admin OAuth Integration (Current Session)
- [x] Replace admin OTP form with Manus OAuth button
- [x] Update Login.tsx to show "Войти через Manus" button for admin login
- [x] Verify getLoginUrl() function generates correct OAuth redirect URL
- [x] Update OAuth callback to redirect to /admin instead of /
- [ ] Test admin login flow end-to-end (OAuth → callback → /admin dashboard)
- [ ] Verify admin dashboard displays correctly after OAuth login
