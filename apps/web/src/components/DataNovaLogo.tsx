/**
 * DataNova Atlas — Flagship Architectural Logo
 *
 * An iconic, mathematical isometric spatial mark with precision typography.
 * Represents multidimensional system architecture, connected topology, and empirical intelligence.
 */

import React from "react";

interface DataNovaLogoProps {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  darkMode?: boolean;
  className?: string;
  onClick?: () => void;
}

export const DataNovaLogo: React.FC<DataNovaLogoProps> = ({
  size = "md",
  showSubtitle = true,
  darkMode = true,
  className = "",
  onClick,
}) => {
  const iconDimensions = {
    sm: "w-7 h-7",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  }[size];

  const brandTextSize = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size];

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3 select-none group ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {/* Precision Geometric Isometric Emblem */}
      <div className={`relative ${iconDimensions} shrink-0 transition-transform duration-300 group-hover:scale-105`}>
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
        >
          <defs>
            <linearGradient id="facetTop" x1="20" y1="3" x2="20" y2="18" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="facetLeft" x1="5" y1="11" x2="20" y2="35" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#b45309" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
            <linearGradient id="facetRight" x1="35" y1="11" x2="20" y2="35" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <linearGradient id="coreGlow" x1="16" y1="16" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Outer Dimensional Frame */}
          <rect
            x="1.5"
            y="1.5"
            width="37"
            height="37"
            rx="9"
            fill={darkMode ? "#141416" : "#ffffff"}
            stroke={darkMode ? "#27272a" : "#e4e2dd"}
            strokeWidth="1.2"
          />

          {/* Isometric Prismatic Structure */}
          <g transform="translate(0, 0.5)">
            {/* Top Plane */}
            <path
              d="M20 7L31 13.5L20 20L9 13.5L20 7Z"
              fill="url(#facetTop)"
              stroke={darkMode ? "#18181b" : "#ffffff"}
              strokeWidth="0.8"
            />

            {/* Left Plane */}
            <path
              d="M9 13.5L20 20V32.5L9 26V13.5Z"
              fill="url(#facetLeft)"
              stroke={darkMode ? "#18181b" : "#ffffff"}
              strokeWidth="0.8"
            />

            {/* Right Plane */}
            <path
              d="M20 20L31 13.5V26L20 32.5V20Z"
              fill="url(#facetRight)"
              stroke={darkMode ? "#18181b" : "#ffffff"}
              strokeWidth="0.8"
            />

            {/* Dimensional Cross-Axes Lines */}
            <line x1="20" y1="7" x2="20" y2="20" stroke="#fef3c7" strokeWidth="0.6" strokeOpacity="0.4" />
            <line x1="9" y1="13.5" x2="20" y2="20" stroke="#fef3c7" strokeWidth="0.6" strokeOpacity="0.4" />
            <line x1="31" y1="13.5" x2="20" y2="20" stroke="#fef3c7" strokeWidth="0.6" strokeOpacity="0.4" />

            {/* Radiant Core Node */}
            <circle
              cx="20"
              cy="20"
              r="2.5"
              fill="url(#coreGlow)"
              filter="url(#glowFilter)"
            />
            <circle cx="20" cy="20" r="1.2" fill="#ffffff" />
          </g>
        </svg>
      </div>

      {/* Modern Wordmark */}
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-2 leading-none">
          <span
            className={`font-black tracking-[0.16em] uppercase transition-colors ${brandTextSize} ${
              darkMode ? "text-[#f4f4f5]" : "text-[#111113]"
            }`}
          >
            DATANOVA
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-[0.2em] uppercase bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/30">
            ATLAS
          </span>
        </div>
        {showSubtitle && (
          <div
            className={`text-[10px] tracking-wider uppercase font-medium mt-1 font-mono transition-colors ${
              darkMode ? "text-[#a1a1aa]" : "text-[#71717a]"
            }`}
          >
            Architecture Intelligence Studio
          </div>
        )}
      </div>
    </div>
  );
};

