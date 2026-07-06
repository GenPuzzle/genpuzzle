'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useRef } from 'react';

export const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

interface BookMockupProps {
  className?: string;
}

/** Stylized 3D puzzle book mockup with parallax tilt */
export function BookMockup({ className = '' }: BookMockupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 180, damping: 22 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 180, damping: 22 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      ref={ref}
      className={`relative flex items-center justify-center perspective-[1200px] ${className}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative w-[min(100%,280px)] sm:w-[320px]"
      >
        {/* Shadow */}
        <div className="absolute -bottom-6 left-1/2 h-8 w-[85%] -translate-x-1/2 rounded-[100%] bg-[#0a1628]/40 blur-2xl" />

        {/* Book spine */}
        <div
          className="absolute left-0 top-3 z-0 h-[94%] w-5 rounded-l-sm bg-gradient-to-r from-[#0f2744] to-[#1a5a8c]"
          style={{ transform: 'rotateY(-22deg) translateZ(-12px)' }}
        />

        {/* Cover */}
        <div className="relative z-10 overflow-hidden rounded-r-xl rounded-l-md border border-white/10 bg-gradient-to-br from-[#1a5a8c] via-[#2276b4] to-[#0f2744] shadow-2xl shadow-[#0a1628]/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_50%)]" />
          <div className="p-6 pb-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100/80">
              GenPuzzle
            </p>
            <h3 className="mt-2 text-xl font-bold leading-tight text-white">
              Word Search
              <br />
              Puzzle Book
            </h3>
            <div className="mt-5 grid grid-cols-8 gap-[3px] rounded-lg bg-white/95 p-3 shadow-inner">
              {Array.from({ length: 64 }).map((_, i) => (
                <span
                  key={i}
                  className="flex aspect-square items-center justify-center text-[7px] font-bold text-slate-700"
                >
                  {String.fromCharCode(65 + (i % 26))}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {['OCEAN', 'CORAL', 'WAVES', 'SHELL'].map((w) => (
                <span
                  key={w}
                  className="rounded-full bg-white/20 px-2 py-0.5 text-[8px] font-semibold text-white"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Page edge */}
        <div className="absolute -right-1 top-4 z-[5] h-[88%] w-2 rounded-r bg-gradient-to-r from-slate-100 to-slate-300 shadow-md" />
      </motion.div>
    </div>
  );
}
