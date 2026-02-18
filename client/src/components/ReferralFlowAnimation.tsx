import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useMemo } from "react";

/**
 * Flying referral cards animation — visual cards (no text) with SVG icons,
 * trailing glow effect, flying toward a target "cabinet" that emits money amounts.
 */

// --- SVG Icon Components ---

function IconUser({ color = "#3b82f6" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconHeart({ color = "#ef4444" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconClipboard({ color = "#8b5cf6" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function IconStethoscope({ color = "#10b981" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

function IconActivity({ color = "#f59e0b" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconShield({ color = "#0ea5e9" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

// Cabinet target icon (wallet/dashboard)
function IconWallet() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#walletGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="walletGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
    </svg>
  );
}

// --- Types ---

interface CardData {
  id: number;
  IconComponent: React.FC<{ color?: string }>;
  color: string;       // Card accent color
  glowColor: string;   // Trail glow color
  amount: string;
  startX: number;      // vw
  startY: number;      // %  of container height
  midX: number;
  midY: number;
  delay: number;       // seconds
  rotation: number;    // degrees for slight tilt
}

const CARDS: CardData[] = [
  { id: 0, IconComponent: IconUser, color: "#3b82f6", glowColor: "rgba(59,130,246,0.4)", amount: "+ 12 500 ₽", startX: -5, startY: 18, midX: 28, midY: 5, delay: 0, rotation: -8 },
  { id: 1, IconComponent: IconClipboard, color: "#8b5cf6", glowColor: "rgba(139,92,246,0.4)", amount: "+ 8 000 ₽", startX: 25, startY: -6, midX: 48, midY: 22, delay: 1.8, rotation: 6 },
  { id: 2, IconComponent: IconHeart, color: "#ef4444", glowColor: "rgba(239,68,68,0.4)", amount: "+ 15 000 ₽", startX: -4, startY: 58, midX: 22, midY: 42, delay: 3.6, rotation: -5 },
  { id: 3, IconComponent: IconStethoscope, color: "#10b981", glowColor: "rgba(16,185,129,0.4)", amount: "+ 5 500 ₽", startX: 42, startY: -6, midX: 58, midY: 12, delay: 5.4, rotation: 10 },
  { id: 4, IconComponent: IconActivity, color: "#f59e0b", glowColor: "rgba(245,158,11,0.4)", amount: "+ 22 000 ₽", startX: -5, startY: 38, midX: 32, midY: 28, delay: 7.2, rotation: -12 },
  { id: 5, IconComponent: IconShield, color: "#0ea5e9", glowColor: "rgba(14,165,233,0.4)", amount: "+ 18 700 ₽", startX: 15, startY: -6, midX: 40, midY: 8, delay: 9, rotation: 4 },
];

const CARD_FLIGHT_DURATION = 3.5;
const CYCLE_DURATION = 12.5;

// Target position
const TARGET_X = 86;
const TARGET_Y = 40;

// --- Components ---

function FlyingCard({ card, onArrive }: { card: CardData; onArrive: (card: CardData) => void }) {
  const Icon = card.IconComponent;

  return (
    <>
      {/* Glow trail — slightly delayed, lower opacity, blurred */}
      <motion.div
        className="absolute rounded-full"
        style={{
          left: 0,
          top: 0,
          width: 40,
          height: 40,
          background: `radial-gradient(circle, ${card.glowColor} 0%, transparent 70%)`,
          filter: "blur(12px)",
        }}
        initial={{ x: `${card.startX}vw`, y: `${card.startY}cqh`, scale: 0, opacity: 0 }}
        animate={{
          x: [`${card.startX}vw`, `${card.midX}vw`, `${TARGET_X}vw`],
          y: [`${card.startY}%`, `${card.midY}%`, `${TARGET_Y}%`],
          scale: [0, 1.5, 0.3],
          opacity: [0, 0.6, 0],
        }}
        transition={{
          duration: CARD_FLIGHT_DURATION + 0.3,
          delay: card.delay + 0.15,
          ease: [0.4, 0, 0.2, 1],
          repeat: Infinity,
          repeatDelay: CYCLE_DURATION - CARD_FLIGHT_DURATION - 0.3,
        }}
      />

      {/* Main card */}
      <motion.div
        className="absolute"
        style={{ left: 0, top: 0 }}
        initial={{ x: `${card.startX}vw`, y: `${card.startY}%`, scale: 0, opacity: 0, rotate: card.rotation }}
        animate={{
          x: [`${card.startX}vw`, `${card.midX}vw`, `${TARGET_X}vw`],
          y: [`${card.startY}%`, `${card.midY}%`, `${TARGET_Y}%`],
          scale: [0, 1, 0.2],
          opacity: [0, 0.95, 0],
          rotate: [card.rotation, card.rotation * 0.3, 0],
        }}
        transition={{
          duration: CARD_FLIGHT_DURATION,
          delay: card.delay,
          ease: [0.25, 0.46, 0.45, 0.94],
          repeat: Infinity,
          repeatDelay: CYCLE_DURATION - CARD_FLIGHT_DURATION,
        }}
        onUpdate={(latest) => {
          if (latest.opacity !== undefined && Number(latest.opacity) < 0.1 && Number(latest.scale) < 0.3) {
            onArrive(card);
          }
        }}
      >
        <div
          className="w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center backdrop-blur-md border shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${card.color}15 0%, ${card.color}08 100%)`,
            borderColor: `${card.color}30`,
            boxShadow: `0 4px 20px ${card.glowColor}, 0 0 0 1px ${card.color}10`,
          }}
        >
          <Icon color={card.color} />
        </div>
      </motion.div>
    </>
  );
}

function AmountPopup({ amount, id }: { amount: string; id: number }) {
  return (
    <motion.div
      key={id}
      className="absolute pointer-events-none"
      style={{ left: `${TARGET_X - 1}vw`, top: `${TARGET_Y}%` }}
      initial={{ opacity: 0, y: 0, scale: 0.3 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: [10, -10, -30, -55],
        scale: [0.3, 1.15, 1, 0.85],
      }}
      transition={{ duration: 1.8, ease: "easeOut" }}
    >
      <span className="text-xs md:text-sm font-bold gradient-gold-text whitespace-nowrap drop-shadow-md">
        {amount}
      </span>
    </motion.div>
  );
}

function CabinetTarget() {
  return (
    <motion.div
      className="absolute hidden md:flex items-center justify-center"
      style={{ left: `${TARGET_X - 1.5}vw`, top: `${TARGET_Y - 4}%` }}
      animate={{
        scale: [1, 1.08, 1],
      }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-md border border-emerald-500/20"
        style={{
          background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(245,158,11,0.06) 100%)",
          boxShadow: "0 0 30px rgba(16,185,129,0.15), 0 0 60px rgba(16,185,129,0.05)",
        }}
      >
        <IconWallet />
      </div>
      {/* Pulse ring */}
      <motion.div
        className="absolute inset-0 rounded-2xl border border-emerald-500/20"
        animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
      />
    </motion.div>
  );
}

// --- Main Component ---

export function ReferralFlowAnimation() {
  const [amounts, setAmounts] = useState<{ id: number; amount: string }[]>([]);
  const [arrivedIds, setArrivedIds] = useState<Set<string>>(new Set());

  // Reset tracking per cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setArrivedIds(new Set());
    }, CYCLE_DURATION * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleArrive = useCallback(
    (card: CardData) => {
      const cycleKey = `${card.id}-${Math.floor(Date.now() / (CYCLE_DURATION * 1000))}`;
      if (arrivedIds.has(cycleKey)) return;

      setArrivedIds((prev) => new Set(prev).add(cycleKey));
      const popupId = Date.now() + card.id;
      setAmounts((prev) => [...prev, { id: popupId, amount: card.amount }]);

      setTimeout(() => {
        setAmounts((prev) => prev.filter((a) => a.id !== popupId));
      }, 2000);
    },
    [arrivedIds]
  );

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const visibleCards = useMemo(
    () => (isMobile ? CARDS.slice(0, 3) : CARDS),
    [isMobile]
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
      <CabinetTarget />

      {visibleCards.map((card) => (
        <FlyingCard key={card.id} card={card} onArrive={handleArrive} />
      ))}

      <AnimatePresence>
        {amounts.map((a) => (
          <AmountPopup key={a.id} id={a.id} amount={a.amount} />
        ))}
      </AnimatePresence>
    </div>
  );
}
