import React from 'react';

interface VersalyLogoIconProps {
  className?: string;
  size?: number;
}

/** Versaly "VL" monogram: ember orange and ivory on deep forest ink. */
export default function VersalyLogoIcon({ className = '', size = 36 }: VersalyLogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Versaly Logo"
      role="img"
    >
      <rect width="64" height="64" rx="14" fill="#0A1A12" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" stroke="#FF6B00" strokeOpacity="0.28" />
      <path d="M13,17.12 C14.89,17.16 16.9,17.08 17.79,19.09 L29.25,45.83 L39.74,21.1 C39.82,20.5 39.66,20.3 39.62,20.18 C40.22,20.7 40.63,21.18 40.42,21.82 C40.38,21.99 40.34,22.07 40.3,22.15 L29.77,47.08 L43.24,47.08 C45.45,47.08 46.66,46.63 47.66,46.11 C49.27,45.03 50.28,43.22 51,41.81 C50.76,44.02 50.48,46.03 50.16,47.24 C49.95,47.88 49.47,47.96 47.86,48.04 L27.28,48.12 L15.29,19.49 C14.69,17.88 13.88,17.4 13,17.12 Z" fill="#FF6B00" />
      <path d="M35.64,16.68 C36.4,17.48 38.21,19.49 38.21,21.1 L29.17,43.22 L27.6,39.48 L35.8,19.89 C36.28,18.89 36.2,17.68 35.64,16.68 Z" fill="#FFFDF5" />
      <path d="M36.4,34.17 C37.01,33.89 37.61,33.85 38.01,33.85 C37.53,34.05 37.33,34.45 37.13,34.97 L33.39,45.11 L45.05,45.11 C45.45,45.03 45.77,44.83 45.85,44.62 C45.57,45.23 45.25,45.83 44.85,46.03 L32.18,46.07 C31.78,46.07 31.66,45.75 31.78,45.51 Z" fill="#FFFDF5" />
    </svg>
  );
}
