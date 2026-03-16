// SVG icons for UFO shape types
// Each icon is 24x24 viewBox, rendered at the size passed via props

const shapes = {
  light: (
    <>
      <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.3" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  triangle: (
    <path d="M12 4L3 20h18L12 4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  ),
  circle: (
    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
  ),
  fireball: (
    <>
      <circle cx="12" cy="13" r="5" fill="currentColor" opacity="0.2" />
      <path d="M12 3c0 4-3 6-3 9a3 3 0 006 0c0-3-3-5-3-9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="14" r="1.5" fill="currentColor" />
    </>
  ),
  sphere: (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="12" cy="12" rx="8" ry="3" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <path d="M12 4c2 2 3 5 3 8s-1 6-3 8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <path d="M12 4c-2 2-3 5-3 8s1 6 3 8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </>
  ),
  disk: (
    <>
      <ellipse cx="12" cy="13" rx="9" ry="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 13c0-3 2.2-6 5-6s5 3 5 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="10" r="1" fill="currentColor" opacity="0.5" />
    </>
  ),
  oval: (
    <ellipse cx="12" cy="12" rx="9" ry="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
  ),
  cigar: (
    <rect x="3" y="9" width="18" height="6" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
  ),
  formation: (
    <>
      <circle cx="6" cy="8" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="12" cy="5" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="18" cy="8" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="8" cy="16" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="16" cy="16" r="2" fill="currentColor" opacity="0.6" />
      <line x1="6" y1="8" x2="12" y2="5" stroke="currentColor" strokeWidth="0.75" opacity="0.3" />
      <line x1="12" y1="5" x2="18" y2="8" stroke="currentColor" strokeWidth="0.75" opacity="0.3" />
      <line x1="6" y1="8" x2="8" y2="16" stroke="currentColor" strokeWidth="0.75" opacity="0.3" />
      <line x1="18" y1="8" x2="16" y2="16" stroke="currentColor" strokeWidth="0.75" opacity="0.3" />
    </>
  ),
  changing: (
    <>
      <path d="M6 12a6 6 0 0112 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" />
      <path d="M18 12a6 6 0 01-12 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  chevron: (
    <path d="M4 16L12 6l8 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  ),
  diamond: (
    <path d="M12 3L21 12 12 21 3 12z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  ),
  cylinder: (
    <>
      <ellipse cx="12" cy="6" rx="5" ry="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7" y1="6" x2="7" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <line x1="17" y1="6" x2="17" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 18c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  rectangle: (
    <rect x="4" y="7" width="16" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
  ),
  egg: (
    <path d="M12 3c-4.4 0-7 5.4-7 10 0 3.3 3.1 8 7 8s7-4.7 7-8c0-4.6-2.6-10-7-10z" fill="none" stroke="currentColor" strokeWidth="1.5" />
  ),
  star: (
    <path d="M12 2l2.9 6.3L22 9.3l-5 4.5L18.2 21 12 17.5 5.8 21 7 13.8 2 9.3l7.1-1L12 2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  ),
  cross: (
    <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  ),
  cone: (
    <>
      <path d="M12 4L5 18h14L12 4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <ellipse cx="12" cy="18" rx="7" ry="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </>
  ),
  flash: (
    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  ),
  other: (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="10" fontWeight="600">?</text>
    </>
  ),
  unknown: (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="10" fontWeight="600">?</text>
    </>
  ),
};

export default function ShapeIcon({ shape, size = 16, className = "" }) {
  const key = String(shape || "unknown").toLowerCase().trim();
  const icon = shapes[key] || shapes.unknown;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className}`}
    >
      {icon}
    </svg>
  );
}
