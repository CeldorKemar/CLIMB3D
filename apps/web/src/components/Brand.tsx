export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg viewBox="0 0 36 32" aria-hidden="true">
        <path
          d="M3 27 15 5l8 14 4-7 7 15"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.6"
          strokeLinejoin="round"
        />
        <path
          d="m11 20 4-7 8 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.6"
        />
      </svg>
      {!compact && (
        <span>
          climbed<span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}
