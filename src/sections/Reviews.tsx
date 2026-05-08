import { Icon, Reveal } from '../components/atoms';
import { useCrm } from '../crm/CrmProvider';

const PLATFORM_META = {
  yandex: { label: 'Яндекс',  bg: '#FC3F1D', fg: '#fff' },
  avito:  { label: 'Авито',   bg: '#0AF',    fg: '#fff' },
  autoru: { label: 'Auto.ru', bg: '#C00',    fg: '#fff' },
} as const;

export const Reviews = () => {
  const { state } = useCrm();
  if (state.reviews.length === 0) return null;
  return (
    <section id="reviews" style={{ background: '#0a0a09', color: '#fff' }}>
      <div className="container">
        <Reveal>
          <div style={{ marginBottom: 32 }}>
            <div className="num-marker" style={{ marginBottom: 14 }}>04 / Отзывы</div>
            <h2 className="h1">
              Отзывы наших клиентов.<br />
              <span className="outline-italic">Не&nbsp;по&nbsp;скрипту.</span>
            </h2>
          </div>
        </Reveal>

        <div className="reviews-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(state.reviews.length, 3)}, 1fr)`, gap: 24 }}>
          {state.reviews.slice(0, 3).map((r, i) => {
            const platform = PLATFORM_META[r.platform];
            return (
              <Reveal key={r.id} delay={i * 80}>
                <div className="card" style={{
                  background: '#0F0F0E', padding: 24, height: '100%',
                  color: '#fff',
                  display: 'flex', flexDirection: 'column',
                }}>
                  {/* Header: avatar + name/city/car */}
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
                    <img
                      src={r.avatar}
                      alt={r.name}
                      loading="lazy"
                      width={48}
                      height={48}
                      style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--line-strong)' }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>{r.city}</div>
                      <div style={{ fontSize: 12, color: 'var(--mute-2)', marginTop: 2 }}>{r.car}</div>
                    </div>
                  </div>

                  {/* Stars */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 14, color: 'var(--coral)' }}>
                    {Array.from({ length: r.rating }).map((_, k) => <Icon key={k} name="star" size={12} />)}
                  </div>

                  {/* Body */}
                  <p style={{ fontSize: 14, lineHeight: 1.5, flex: 1, marginBottom: 20, color: 'rgba(255,255,255,0.85)', fontWeight: 400 }}>
                    {r.text}
                  </p>

                  {/* Footer: date + platform tag */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 12, color: 'var(--mute)' }}>{r.date}</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '4px 10px', borderRadius: 4,
                      background: platform.bg, color: platform.fg,
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    }}>
                      {platform.label}
                    </span>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          #reviews .reviews-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
        }
      `}</style>
    </section>
  );
};
