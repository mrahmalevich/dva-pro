import { Icon, Reveal } from '../components/atoms';
import { useCrm } from '../crm/CrmProvider';

export const Reviews = () => {
  const { state } = useCrm();
  if (state.reviews.length === 0) return null;
  return (
    <section id="reviews" style={{ background: '#0a0a09', color: '#fff' }}>
      <div className="container">
        <Reveal>
          <div style={{ marginBottom: 64 }}>
            <div className="num-marker" style={{ marginBottom: 14 }}>05 / Отзывы</div>
            <h2 className="h1">
              Реальные истории.<br />
              <span className="outline-italic">Не&nbsp;по&nbsp;скрипту.</span>
            </h2>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(state.reviews.length, 3)}, 1fr)`, gap: 0 }}>
          {state.reviews.slice(0, 3).map((r, i) => (
            <Reveal key={r.id} delay={i * 100}>
              <div style={{
                background: '#0F0F0E', padding: 32, height: '100%',
                border: '1px solid var(--line)',
                borderLeft: i > 0 ? 'none' : '1px solid var(--line)',
                color: '#fff',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, color: 'var(--coral)' }}>
                  {Array.from({ length: r.rating }).map((_, k) => <Icon key={k} name="star" size={16} />)}
                </div>
                <p style={{ fontSize: 17, lineHeight: 1.5, flex: 1, marginBottom: 28, fontWeight: 400 }}>«{r.text}»</p>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', paddingTop: 20, borderTop: '1px solid var(--line)' }}>
                  <div style={{ width: 44, height: 44, background: i % 2 ? 'var(--cyan)' : 'var(--coral)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, fontStyle: 'italic' }}>
                    {r.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--mute)' }}>{r.city} · {r.car}</div>
                  </div>
                  <button aria-label="Видео-отзыв" style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--line-strong)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Icon name="play" size={12} />
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};
