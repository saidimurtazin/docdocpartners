import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";

/**
 * Animated visualization: referral cards fly from left/top toward a "cabinet" on the right,
 * then a money amount pops out. Loops infinitely. Desktop + mobile adaptive.
 */

interface FlyingCard {
  id: number;
  icon: string;
  text: string;
  amount: string;
  // Start position (percentage of container)
  startX: number;
  startY: number;
  // Midpoint for arc trajectory
  midX: number;
  midY: number;
  // Delay before this card starts (seconds)
  delay: number;
}

const CARDS_DATA: Omit<FlyingCard, "id">[] = [
  { icon: "🏥", text: "Пациент Иванов", amount: "+ 12 500 ₽", startX: -8, startY: 15, midX: 25, midY: 8, delay: 0 },
  { icon: "📋", text: "Рекомендация #42", amount: "+ 8 000 ₽", startX: 30, startY: -8, midX: 50, midY: 20, delay: 2.5 },
  { icon: "👤", text: "Пациент Петрова", amount: "+ 15 000 ₽", startX: -6, startY: 55, midX: 20, midY: 45, delay: 5 },
  { icon: "🏥", text: "Рекомендация #87", amount: "+ 5 500 ₽", startX: 45, startY: -8, midX: 55, midY: 15, delay: 7.5 },
  { icon: "👤", text: "Пациент Сидоров", amount: "+ 22 000 ₽", startX: -8, startY: 35, midX: 30, midY: 30, delay: 10 },
];

// Total animation cycle = last card delay + card flight duration + pause
const CARD_FLIGHT_DURATION = 4; // seconds per card flight
const CYCLE_DURATION = 14; // seconds total cycle before restart

// Target position (cabinet) — percentage
const TARGET_X = 88;
const TARGET_Y = 42;

function FlyingCardComponent({
  card,
  onArrive,
}: {
  card: FlyingCard;
  onArrive: (card: FlyingCard) => void;
}) {
  return (
    <motion.div
      className="absolute"
      style={{ left: 0, top: 0 }}
      initial={{ x: `${card.startX}vw`, y: `${card.startY}vh`, scale: 0, opacity: 0 }}
      animate={{
        x: [`${card.startX}vw`, `${card.midX}vw`, `${TARGET_X}vw`],
        y: [`${card.startY}vh`, `${card.midY}vh`, `${TARGET_Y}vh`],
        scale: [0, 1, 0.4],
        opacity: [0, 0.9, 0],
      }}
      transition={{
        duration: CARD_FLIGHT_DURATION,
        delay: card.delay,
        ease: [0.4, 0, 0.2, 1],
        repeat: Infinity,
        repeatDelay: CYCLE_DURATION - CARD_FLIGHT_DURATION,
      }}
      onUpdate={(latest) => {
        // Trigger amount popup near end of animation
        if (latest.opacity !== undefined && Number(latest.opacity) < 0.15 && Number(latest.scale) < 0.5) {
          onArrive(card);
        }
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 dark:bg-white/10 backdrop-blur-md border border-white/30 shadow-lg whitespace-nowrap">
        <span className="text-base">{card.icon}</span>
        <span className="text-xs font-medium text-foreground/80">{card.text}</span>
      </div>
    </motion.div>
  );
}

function AmountPopup({ amount, id }: { amount: string; id: number }) {
  return (
    <motion.div
      key={id}
      className="absolute pointer-events-none"
      style={{ left: `${TARGET_X}vw`, top: `${TARGET_Y}vh` }}
      initial={{ opacity: 0, y: 0, scale: 0.5 }}
      animate={{ opacity: [0, 1, 1, 0], y: [0, -15, -35, -55], scale: [0.5, 1.1, 1, 0.8] }}
      transition={{ duration: 2, ease: "easeOut" }}
    >
      <span className="text-sm md:text-base font-bold gradient-gold-text whitespace-nowrap drop-shadow-sm">
        {amount}
      </span>
    </motion.div>
  );
}

function CabinetIcon() {
  return (
    <motion.div
      className="absolute hidden md:flex items-center justify-center"
      style={{ left: `${TARGET_X - 2}vw`, top: `${TARGET_Y - 3}vh` }}
      animate={{
        scale: [1, 1.05, 1],
        boxShadow: [
          "0 0 0px rgba(16,185,129,0)",
          "0 0 20px rgba(16,185,129,0.3)",
          "0 0 0px rgba(16,185,129,0)",
        ],
      }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/70 dark:bg-white/10 backdrop-blur-md border border-white/40 shadow-xl flex items-center justify-center">
        <span className="text-2xl md:text-3xl">💼</span>
      </div>
    </motion.div>
  );
}

export function ReferralFlowAnimation() {
  const [amounts, setAmounts] = useState<{ id: number; amount: string }[]>([]);
  const [arrivedIds, setArrivedIds] = useState<Set<string>>(new Set());
  const [counter, setCounter] = useState(0);

  // Reset arrived tracking periodically (for repeat cycles)
  useEffect(() => {
    const interval = setInterval(() => {
      setArrivedIds(new Set());
    }, CYCLE_DURATION * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleArrive = useCallback(
    (card: FlyingCard) => {
      // Deduplicate within same cycle
      const cycleKey = `${card.id}-${Math.floor(Date.now() / (CYCLE_DURATION * 1000))}`;
      if (arrivedIds.has(cycleKey)) return;

      setArrivedIds((prev) => new Set(prev).add(cycleKey));
      setCounter((c) => c + 1);
      const popupId = Date.now() + card.id;
      setAmounts((prev) => [...prev, { id: popupId, amount: card.amount }]);

      // Remove popup after animation
      setTimeout(() => {
        setAmounts((prev) => prev.filter((a) => a.id !== popupId));
      }, 2200);
    },
    [arrivedIds]
  );

  const cards: FlyingCard[] = CARDS_DATA.map((c, i) => ({ ...c, id: i }));

  // On mobile, show fewer cards
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const visibleCards = isMobile ? cards.slice(0, 2) : cards;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
      <CabinetIcon />

      {visibleCards.map((card) => (
        <FlyingCardComponent key={card.id} card={card} onArrive={handleArrive} />
      ))}

      <AnimatePresence>
        {amounts.map((a) => (
          <AmountPopup key={a.id} id={a.id} amount={a.amount} />
        ))}
      </AnimatePresence>
    </div>
  );
}
