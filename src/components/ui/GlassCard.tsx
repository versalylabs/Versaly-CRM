'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

export type GlassLevel = 'subtle' | 'medium' | 'strong';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  level?: GlassLevel;
  glow?: boolean;
  glowColor?: string;
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({
  level = 'medium',
  glow = false,
  glowColor = 'rgba(252, 163, 17, 0.15)',
  children,
  className,
  ...props
}: GlassCardProps) {
  // 3-Level Glass Hierarchy defined in the specification:
  // Level 1 (Subtle): Navigation, small chips, secondary surfaces
  // Level 2 (Medium): Feature panels, interactive product cards, overlays
  // Level 3 (Strong): Hero floating surfaces, highlighted plan, primary CTA
  const levelStyles = {
    subtle:
      'bg-[#16233f]/40 backdrop-blur-md border border-white/[0.08] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.08)]',
    medium:
      'bg-[#1b2a4a]/50 backdrop-blur-xl border border-white/[0.12] shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_0_0_rgba(255,255,255,0.14)] hover:border-[#fca311]/40 hover:bg-[#1b2a4a]/65 transition-all duration-300',
    strong:
      'bg-gradient-to-b from-[#22355e]/75 via-[#1b2a4a]/80 to-[#0e172a]/90 backdrop-blur-2xl border border-[#fca311]/35 shadow-[0_20px_50px_0_rgba(0,0,0,0.45),inset_0_1px_1px_0_rgba(255,255,255,0.22)]',
  };

  return (
    <motion.div
      className={cn(
        'relative rounded-2xl transition-all',
        levelStyles[level],
        className
      )}
      style={{
        boxShadow: glow ? `0 0 40px ${glowColor}` : undefined,
        ...props.style,
      }}
      {...props}
    >
      {/* Specular Top Edge Light Refraction */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {children}
    </motion.div>
  );
}

export function GlassBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        'bg-[#fca311]/10 backdrop-blur-md border border-[#fca311]/25 text-[#fca311]',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]',
        className
      )}
    >
      {children}
    </span>
  );
}
