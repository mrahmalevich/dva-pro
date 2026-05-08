import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Accent, Country } from '../crm/types';

export const Logo = ({ size: _size = 36 }: { size?: number }) => (
  <div className="logo-wordmark" style={{ display: 'inline-flex', alignItems: 'baseline' }}>
    <span style={{ fontStyle: 'italic' }}>DVA</span>
    <span className="pro" style={{ fontStyle: 'italic' }}>pro</span>
    <span style={{ color: 'var(--coral)', fontStyle: 'italic', marginLeft: 1 }}>.</span>
  </div>
);

export type IconName =
  | 'arrow-right' | 'arrow-up-right' | 'arrow-left' | 'arrow-down'
  | 'check' | 'plus' | 'close'
  | 'phone' | 'mail' | 'tg' | 'wa'
  | 'doc' | 'shield' | 'truck' | 'globe' | 'sparkle' | 'play' | 'star'
  | 'wallet' | 'gauge' | 'calendar'
  | 'flag-jp' | 'flag-cn' | 'flag-kr'
  | 'edit' | 'trash' | 'save';

export const Icon = ({ name, size = 20, stroke = 1.6 }: { name: IconName; size?: number; stroke?: number }) => {
  const s = { width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'arrow-right': return <svg viewBox="0 0 24 24" {...s}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case 'arrow-up-right': return <svg viewBox="0 0 24 24" {...s}><path d="M7 17L17 7M9 7h8v8" /></svg>;
    case 'arrow-left': return <svg viewBox="0 0 24 24" {...s}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
    case 'arrow-down': return <svg viewBox="0 0 24 24" {...s}><path d="M12 5v14M6 13l6 6 6-6" /></svg>;
    case 'check': return <svg viewBox="0 0 24 24" {...s}><path d="M5 12l5 5L20 7" /></svg>;
    case 'plus': return <svg viewBox="0 0 24 24" {...s}><path d="M12 5v14M5 12h14" /></svg>;
    case 'close': return <svg viewBox="0 0 24 24" {...s}><path d="M18 6L6 18M6 6l12 12" /></svg>;
    case 'phone': return <svg viewBox="0 0 24 24" {...s}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" /></svg>;
    case 'mail': return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="5" width="18" height="14" /><path d="M3 7l9 6 9-6" /></svg>;
    case 'tg': return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 4L2 12l6 2 2 6 4-4 6 4 2-16zM10 14l8-7-10 6 2 1z" /></svg>;
    case 'wa': return <svg viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" clipRule="evenodd" width={size} height={size}><path d="M16.003 0C7.174 0 .008 7.162.005 15.97a15.91 15.91 0 0 0 2.136 7.984L0 32l8.236-2.158a16.002 16.002 0 0 0 7.76 1.974h.007c8.828 0 15.997-7.162 16-15.972C32.003 7.16 24.836 0 16.003 0zm9.327 22.815c-.397 1.114-2.305 2.131-3.221 2.268-.823.122-1.864.173-3.008-.189-.694-.219-1.583-.513-2.722-1.005-4.788-2.067-7.916-6.886-8.155-7.205-.239-.32-1.95-2.591-1.95-4.942s1.234-3.506 1.671-3.984c.437-.479.954-.598 1.273-.598l.916.017c.293.013.687-.111 1.075.82.398.957 1.353 3.307 1.473 3.547.119.24.198.519.039.838-.157.319-.238.518-.477.799-.239.279-.502.624-.717.838-.239.239-.488.498-.21.978.279.479 1.241 2.046 2.66 3.31 1.83 1.628 3.371 2.133 3.851 2.371.479.239.762.199 1.041-.119.279-.319 1.193-1.394 1.512-1.872.319-.479.638-.399 1.075-.24.437.16 2.787 1.314 3.265 1.553.477.24.794.358.913.557.121.197.121 1.155-.276 2.27z"/></svg>;
    case 'doc': return <svg viewBox="0 0 24 24" {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>;
    case 'shield': return <svg viewBox="0 0 24 24" {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>;
    case 'truck': return <svg viewBox="0 0 24 24" {...s}><path d="M1 8h13v9H1zM14 11h5l3 4v2h-8z" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>;
    case 'globe': return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2c3 3 4.5 6 4.5 10S15 19 12 22M12 2c-3 3-4.5 6-4.5 10S9 19 12 22" /></svg>;
    case 'sparkle': return <svg viewBox="0 0 24 24" {...s}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>;
    case 'play': return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
    case 'star': return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" /></svg>;
    case 'wallet': return <svg viewBox="0 0 24 24" {...s}><path d="M3 7v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9H5a2 2 0 0 1 0-4h13" /><circle cx="17" cy="14" r="1.5" /></svg>;
    case 'gauge': return <svg viewBox="0 0 24 24" {...s}><path d="M12 22a10 10 0 1 0-10-10" /><path d="M12 12l5-5" /></svg>;
    case 'calendar': return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="5" width="18" height="16" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
    case 'flag-jp': return <svg width={size} height={size} viewBox="0 0 24 24"><rect width="24" height="24" fill="#fff" /><circle cx="12" cy="12" r="5" fill="#BC002D" /></svg>;
    case 'flag-cn': return <svg width={size} height={size} viewBox="0 0 24 24"><rect width="24" height="24" fill="#DE2910" /><path d="M5 6l.7 1.7 1.8.1-1.4 1 .5 1.7-1.6-.9-1.6.9.5-1.7-1.4-1 1.8-.1z" fill="#FFDE00" /></svg>;
    case 'flag-kr': return <svg width={size} height={size} viewBox="0 0 24 24"><rect width="24" height="24" fill="#fff" /><path d="M12 8a4 4 0 0 1 0 8 4 4 0 0 0 0-8z" fill="#CD2E3A" /><path d="M12 8a4 4 0 0 0 0 8 4 4 0 0 1 0-8z" fill="#0047A0" /></svg>;
    case 'edit': return <svg viewBox="0 0 24 24" {...s}><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>;
    case 'trash': return <svg viewBox="0 0 24 24" {...s}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>;
    case 'save': return <svg viewBox="0 0 24 24" {...s}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>;
    default: return null;
  }
};

export const FlagFor = ({ country, size = 18 }: { country: Country; size?: number }) =>
  <Icon name={`flag-${country}` as IconName} size={size} />;

export const Live = ({ children }: { children: ReactNode }) => (
  <span className="pill live"><span className="dot" />{children}</span>
);

export const Chip = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '8px 14px', borderRadius: 999,
    fontSize: 12, fontWeight: 500, letterSpacing: '0.04em',
    border: '1px solid var(--line-strong)',
    background: 'rgba(255,255,255,0.04)', color: '#fff',
    backdropFilter: 'blur(20px)',
    ...style,
  }}>{children}</span>
);

export const CarPlaceholder = ({
  accent = 'coral',
  label,
  height = 220,
  src,
}: { accent?: Accent; label?: string; height?: number; src?: string }) => (
  <div style={{
    position: 'relative', width: '100%', height,
    background: 'linear-gradient(180deg, #1a1a18 0%, #0a0a09 100%)',
    overflow: 'hidden',
  }}>
    {src && (
      <>
        <img src={src} alt={label || ''} loading="lazy"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(1.05) saturate(0.95)' }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(10,10,9,0.15) 0%, rgba(10,10,9,0.45) 60%, rgba(10,10,9,0.85) 100%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.55,
          background: `radial-gradient(60% 80% at 70% 60%, ${accent === 'coral' ? 'rgba(213,121,89,0.55)' : 'rgba(29,163,203,0.45)'} 0%, transparent 70%)`,
        }} />
      </>
    )}
    {!src && (
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <radialGradient id={`g-${label}-${accent}`} cx="0.7" cy="0.6">
            <stop offset="0" stopColor={accent === 'coral' ? '#D57959' : '#1DA3CB'} stopOpacity="0.32" />
            <stop offset="0.6" stopColor={accent === 'coral' ? '#D57959' : '#1DA3CB'} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1600" height="900" fill={`url(#g-${label}-${accent})`} />
        <g transform="translate(220, 380)" opacity="0.95">
          <path d="M0 280 L80 180 L240 130 L640 110 L900 130 L1020 170 L1100 220 L1140 260 L1140 320 L0 320 Z" fill="#1c1c1a" stroke={accent === 'coral' ? '#D57959' : '#1DA3CB'} strokeWidth="1.5" strokeOpacity="0.45" />
          <circle cx="200" cy="320" r="50" fill="#0a0a09" />
          <circle cx="200" cy="320" r="38" fill="#1a1a18" stroke={accent === 'coral' ? '#D57959' : '#1DA3CB'} strokeWidth="2" />
          <circle cx="200" cy="320" r="20" fill="#0a0a09" />
          <circle cx="930" cy="320" r="50" fill="#0a0a09" />
          <circle cx="930" cy="320" r="38" fill="#1a1a18" stroke={accent === 'coral' ? '#D57959' : '#1DA3CB'} strokeWidth="2" />
          <circle cx="930" cy="320" r="20" fill="#0a0a09" />
        </g>
      </svg>
    )}
    {label && (
      <div style={{ position: 'absolute', top: 14, right: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
    )}
  </div>
);

export const FounderPortrait = ({ name, accent = 'coral', size = 240 }: { name: string; accent?: Accent; size?: number }) => (
  <div style={{
    position: 'relative', width: size, height: size * 1.3,
    background: '#0F0F0E', overflow: 'hidden', flexShrink: 0,
  }}>
    <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, transparent 0 12px, rgba(255,255,255,0.04) 12px 13px)' }} />
    <svg viewBox="0 0 200 260" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <circle cx="100" cy="95" r="44" fill={accent === 'coral' ? '#D57959' : '#1DA3CB'} opacity="0.85" />
      <path d="M30 260 Q30 170 100 165 Q170 170 170 260 Z" fill={accent === 'coral' ? '#B85E3F' : '#1485A8'} opacity="0.85" />
    </svg>
    <div style={{ position: 'absolute', left: 14, bottom: 14, color: '#fff', fontWeight: 900, fontStyle: 'italic', fontSize: 28, letterSpacing: '-0.02em' }}>{name}</div>
  </div>
);

export const Reveal = ({ children, delay = 0, className = '', style }: { children: ReactNode; delay?: number; className?: string; style?: CSSProperties }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isIn, setIsIn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) { setIsIn(true); obs.disconnect(); }
      });
    }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${isIn ? 'is-in' : ''} ${className}`} style={{ ...style, transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

export const Counter = ({ to, duration = 1800, suffix = '' }: { to: number; duration?: number; suffix?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let started = false;
    const obs = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting && !started) {
          started = true;
          const start = performance.now();
          const tick = (t: number) => {
            const p = Math.min(1, (t - start) / duration);
            setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);
  return <span ref={ref} className="tnum">{val.toLocaleString('ru-RU')}{suffix}</span>;
};
