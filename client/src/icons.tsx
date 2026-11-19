// Fresh & Friendly icon set — one consistent inline-SVG line-icon language.
// Lucide-style: 24x24 viewBox, 1.5px stroke, round caps/joins. No emoji anywhere.
import type { ReactNode } from "react";

export type IconName =
  | "sun"
  | "cloud"
  | "lifebuoy"
  | "calendar"
  | "calendarCheck"
  | "home"
  | "wallet"
  | "users"
  | "leaf"
  | "hourglass"
  | "refresh"
  | "package"
  | "sliders"
  | "help"
  | "lock"
  | "pin"
  | "pencil"
  | "trash"
  | "check"
  | "plus"
  | "flame"
  | "sparkles"
  | "clock"
  | "battery"
  | "zap"
  | "dots"
  | "arrowRight"
  | "mail";

const PATHS: Record<IconName, ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  cloud: (
    <>
      <path d="M17.5 19a4.5 4.5 0 0 0 .42-8.98 6 6 0 0 0-11.7 1.6A4 4 0 0 0 7 19h10.5Z" />
      <circle cx="7.5" cy="21.5" r="0.9" />
      <circle cx="4.8" cy="23" r="0.55" />
    </>
  ),
  lifebuoy: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M5.6 5.6l3.2 3.2M15.2 15.2l3.2 3.2M18.4 5.6l-3.2 3.2M8.8 15.2l-3.2 3.2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
      <path d="M16 2.5v4M8 2.5v4M3 10h18" />
    </>
  ),
  calendarCheck: (
    <>
      <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
      <path d="M16 2.5v4M8 2.5v4M3 10h18" />
      <path d="M9 16l2 2 4-4.5" />
    </>
  ),
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  wallet: (
    <>
      <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
      <path d="M2.5 10h19" />
      <path d="M16 15h2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" />
      <circle cx="17" cy="9" r="2.8" />
      <path d="M16 15.2c2.6.3 4.7 1.8 5.5 4.3" />
    </>
  ),
  leaf: (
    <>
      <path d="M11 20A7 7 0 0 1 4 13C4 7.5 8.5 4 20 4c0 11.5-3.5 16-9 16Z" />
      <path d="M4 21c3.5-5.5 8-9 12.5-10.5" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M7 3c0 5 5 5 5 9s-5 4-5 9M17 3c0 5-5 5-5 9s5 4 5 9" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </>
  ),
  package: (
    <>
      <path d="M21 8.5v7a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 15.5v-7a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8.5Z" />
      <path d="M3.3 7 12 11.5 20.7 7" />
      <path d="M12 22V11.5" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9a2.6 2.6 0 1 1 3.7 2.4c-.8.4-1.1 1-1.1 1.9" />
      <path d="M12 17h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
      <path d="M12 15v2.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  pencil: (
    <>
      <path d="M17 3.5 20.5 7 8.5 19H5v-3.5L17 3.5Z" />
      <path d="M14.5 6 18 9.5" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  flame: (
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />
  ),
  sparkles: (
    <>
      <path d="M12 3l1.7 4.6L18 9.2l-4.3 1.6L12 15.5l-1.7-4.7L6 9.2l4.3-1.6L12 3Z" />
      <path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8L19 15Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  battery: (
    <>
      <rect x="2.5" y="8" width="16" height="8" rx="2" />
      <path d="M21 11v2" />
      <path d="M6.5 11.5v1M10 11.5v1" />
    </>
  ),
  zap: <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />,
  dots: (
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
  mail: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  className,
  filled = false,
}: {
  name: IconName;
  size?: number;
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

// Logo mark — thin sage reset arrow inside a gold ring.
export function LogoMark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="none" stroke="#c9a227" strokeWidth="2.5" />
      <path
        d="M46.5 32a14.5 14.5 0 1 1-4.3-10.3"
        fill="none"
        stroke="#3f7d5c"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M42.5 17.5v6.5h-6.5"
        fill="none"
        stroke="#3f7d5c"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Gradient progress ring (sage -> coral) with the percentage in the middle.
export function ProgressRing({ pct, size = 84 }: { pct: number; size?: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 84 84"
      className="ring"
      role="img"
      aria-label={`${clamped}% done`}
    >
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3f7d5c" />
          <stop offset="100%" stopColor="#e07856" />
        </linearGradient>
      </defs>
      <circle cx="42" cy="42" r={r} fill="none" stroke="#efe7d2" strokeWidth="9" />
      <circle
        cx="42"
        cy="42"
        r={r}
        fill="none"
        stroke="url(#ringGrad)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped / 100)}
        transform="rotate(-90 42 42)"
        className="ring-fill"
      />
      <text x="42" y="47" textAnchor="middle" className="ring-text">
        {clamped}%
      </text>
    </svg>
  );
}

// Small hand-drawn spot illustrations for empty states and the sign-in screen.
export type ArtVariant = "sun" | "leaf" | "clock" | "cloud";

export function EmptyArt({ variant, width = 96 }: { variant: ArtVariant; width?: number }) {
  const h = Math.round(width * 0.75);
  return (
    <svg
      width={width}
      height={h}
      viewBox="0 0 96 72"
      fill="none"
      aria-hidden="true"
      className="empty-art"
    >
      {variant === "sun" && (
        <g strokeLinecap="round">
          <circle cx="48" cy="28" r="11" fill="#faf3d9" stroke="#c9a227" strokeWidth="2" />
          <path
            d="M48 9v4M48 43v4M29 28h4M63 28h4M35 15l3 3M58 38l3 3M61 15l-3 3M38 38l-3 3"
            stroke="#c9a227"
            strokeWidth="2"
          />
          <path d="M8 60 Q28 44 48 56 T88 58" stroke="#a9bfa4" strokeWidth="2" fill="none" />
          <path d="M20 66 Q40 54 62 64" stroke="#dfe8dc" strokeWidth="2" fill="none" />
        </g>
      )}
      {variant === "leaf" && (
        <g stroke="#3f7d5c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M48 66V28" fill="none" />
          <path d="M48 46C36 42 29 32 29 20c12 2 19 12 19 26Z" fill="#e3efe0" />
          <path d="M48 40c12-4 19-14 19-26-12 2-19 12-19 26Z" fill="#f6efe0" />
          <path d="M48 30c-7-3-11-10-11-18 8 2 11 9 11 18Z" fill="#e3efe0" />
        </g>
      )}
      {variant === "clock" && (
        <g strokeLinecap="round">
          <circle cx="48" cy="34" r="19" fill="#fffdf8" stroke="#e07856" strokeWidth="2" />
          <path
            d="M48 23v11l8 5"
            stroke="#e07856"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M22 62h52" stroke="#a9bfa4" strokeWidth="2" />
          <circle cx="30" cy="62" r="2" fill="#c9a227" stroke="none" />
          <circle cx="66" cy="62" r="2" fill="#c9a227" stroke="none" />
        </g>
      )}
      {variant === "cloud" && (
        <g strokeLinecap="round">
          <path
            d="M28 48a11 11 0 0 1 .8-21.9A15 15 0 0 1 57 31a9.5 9.5 0 0 1-1.5 17H28Z"
            fill="#e3efe0"
            stroke="#3f7d5c"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="34" cy="60" r="2.5" fill="#a9bfa4" stroke="none" />
          <circle cx="25" cy="66" r="1.8" fill="#c9a227" stroke="none" />
        </g>
      )}
    </svg>
  );
}
