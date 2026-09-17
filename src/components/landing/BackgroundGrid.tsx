'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type BackgroundGridProps = {
  className?: string;
  pattern?: 'grid' | 'dots';
};

export function BackgroundGrid({ className, pattern = 'grid' }: BackgroundGridProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden',
        className
      )}
    >
      {/* Grid Pattern */}
      {pattern === 'grid' ? (
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#0b4a6828_1px,transparent_1px),linear-gradient(to_bottom,#0b4a6828_1px,transparent_1px)] bg-[size:4rem_4rem]"
          style={{
            maskImage: 'radial-gradient(ellipse 60% 50% at 50% 30%, #000 70%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 30%, #000 70%, transparent 100%)',
          }}
        />
      ) : (
        <div
          className="absolute inset-0 bg-[radial-gradient(#0b4a6840_1px,transparent_1px)] [background-size:24px_24px]"
          style={{
            maskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, #000 70%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, #000 70%, transparent 100%)',
          }}
        />
      )}

      {/* Atmospheric Ambient Glows */}
      <div className="absolute top-[-10%] left-[15%] h-[500px] w-[500px] rounded-full bg-sky-500/10 blur-[120px]" />
      <div className="absolute top-[20%] right-[10%] h-[400px] w-[400px] rounded-full bg-cyan-400/10 blur-[130px]" />
      <div className="absolute bottom-[10%] left-[30%] h-[600px] w-[600px] rounded-full bg-sky-600/5 blur-[140px]" />
    </div>
  );
}
