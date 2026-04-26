import { Icon, Live, Reveal } from '../components/atoms';
import { useCrm } from '../crm/CrmProvider';

export const FeedStrip = () => {
  const { state } = useCrm();
  if (state.feed.length === 0) return null;

  return (
    <section style={{ padding: '80px 0', background: '#0a0a09', color: '#fff' }}>
      <div className="container">
        <Reveal>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
            <Live>Лента событий</Live>
            <span className="small mono" style={{ color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>обновляется в реальном времени</span>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(state.feed.length, 5)}, 1fr)`, gap: 0 }}>
          {state.feed.slice(0, 5).map((f, i) => (
            <Reveal key={f.id} delay={i * 80}>
              <div style={{
                padding: '22px 26px',
                background: '#0F0F0E',
                border: '1px solid var(--line)',
                borderRight: i < state.feed.length - 1 ? 'none' : '1px solid var(--line)',
                height: '100%',
              }}>
                <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>
                  <Icon name={f.icon} size={14} /> {f.time}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.45 }}>{f.text}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};
