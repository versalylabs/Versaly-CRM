import React from 'react';

const ORANGE = '#ff6b01';
const CREAM = '#f8edd2';
const INK = '#051f20';

type Tone = 'onDark' | 'onLight';

/**
 * VersalyLabs "VL" mark, redrawn from the brand artwork.
 * onDark: orange V/L with cream accents (for ink backgrounds).
 * onLight: ink V/L with orange accents (for cream or white backgrounds).
 * `tile` draws the mark on a rounded ink square, as used for app icons.
 */
export default function VersalyLabsLogo({
  size = 36,
  className = '',
  tone = 'onDark',
  tile = true,
}: {
  size?: number;
  className?: string;
  tone?: Tone;
  tile?: boolean;
}) {
  const main = tone === 'onDark' ? ORANGE : INK;
  const accent = tone === 'onDark' ? CREAM : ORANGE;
  return (
    <svg
      width={size}
      height={size}
      viewBox="345 340 1250 1250"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="VersalyLabs logo"
    >
      {tile && <rect x="345" y="340" width="1250" height="1250" rx="280" fill={INK} />}
      <path d="M815 1063 L985 660 C1003 622 1050 625 1059 664 C1063 682 1058 697 1052 710 L858 1165 Z" fill={accent} />
      <path d="M1082 942 L960 1234 L1292 1234" fill="none" stroke={accent} strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M562 618 L838 1300 L1372 1307" fill="none" stroke={main} strokeWidth="80" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1082 775 L870 1262" fill="none" stroke={main} strokeWidth="62" strokeLinecap="round" />
    </svg>
  );
}

/** "VersalyLabs" wordmark set in the brand font (Quicksand). */
export function Wordmark({ className = '', tone = 'onDark' }: { className?: string; tone?: Tone }) {
  return (
    <span className={`font-heading font-bold tracking-tight ${className}`}>
      <span style={{ color: tone === 'onDark' ? CREAM : INK }}>Versaly</span>
      <span style={{ color: ORANGE }}>Labs</span>
    </span>
  );
}
