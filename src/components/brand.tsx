export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="brand"><svg width="33" height="34" viewBox="0 0 33 34" fill="none" aria-hidden="true"><path d="M2 29 14.5 4h5L32 29h-8L17 14 10 29H2Z" fill="currentColor"/><path d="m13 26 4-8 4 8h-8Z" fill="#8dc63f"/></svg>{!compact && <span>atlas<span className="brand-dot">.</span></span>}</span>;
}
