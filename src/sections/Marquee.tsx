const ITEMS = ['LEXUS', 'BMW', 'MERCEDES-AMG', 'GENESIS', 'PORSCHE', 'AUDI', 'TOYOTA LAND CRUISER', 'NISSAN GT-R', 'LI AUTO', 'ZEEKR', 'HYUNDAI', 'KIA', 'INFINITI', 'RANGE ROVER'];

export const Marquee = () => (
  <section style={{ padding: '36px 0', background: '#0a0a09', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
    <div className="marquee">
      <div className="marquee-track">
        {[...ITEMS, ...ITEMS].map((it, i) => (
          <div key={`${it}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
            <span style={{ fontWeight: 900, fontStyle: 'italic', fontSize: 32, letterSpacing: '0.02em', color: 'rgba(255,255,255,0.5)' }}>{it}</span>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 28 }}>×</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);
