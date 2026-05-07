import { CarPlaceholder, Chip, FlagFor, Icon, Reveal } from '../components/atoms';
import { useCrm } from '../crm/CrmProvider';
import type { IconName } from '../components/atoms';

export const InTransit = () => {
  const { state } = useCrm();
  if (!state.inTransit || state.inTransit.length === 0) return null;

  return (
    <section id="in-transit" style={{ background: '#0a0a09', color: '#fff' }}>
      <div className="container">
        <Reveal>
          <div style={{ marginBottom: 32 }}>
            <div className="num-marker" style={{ marginBottom: 14 }}>04 / В&nbsp;пути</div>
            <h2 className="h1" style={{ maxWidth: 980 }}>
              Реальные авто <span className="outline-italic">в&nbsp;пути.</span>
            </h2>
          </div>
        </Reveal>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(state.inTransit.length, 4)}, 1fr)`,
          gap: 0,
        }}>
          {state.inTransit.slice(0, 4).map((it, i) => {
            const count = Math.min(state.inTransit.length, 4);
            const statusIcon: IconName =
              it.status === 'ready' ? 'check' :
              it.status === 'customs' ? 'shield' :
              'truck';
            return (
              <Reveal key={it.id} delay={i * 80}>
                <div style={{
                  background: '#0F0F0E',
                  border: '1px solid var(--line)',
                  borderRight: i < count - 1 ? 'none' : '1px solid var(--line)',
                  padding: 24,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}>
                  <CarPlaceholder label={it.brand} accent={it.accent} height={180} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Chip><FlagFor country={it.country} /> {it.country.toUpperCase()}</Chip>
                    <Chip>
                      <Icon name={statusIcon} size={12} />
                      {it.statusLabel}
                    </Chip>
                  </div>
                  <div>
                    <div className="mono small" style={{ color: 'var(--mute-2)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{it.brand}</div>
                    <div className="h3" style={{ fontSize: 22 }}>{it.model}</div>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--coral)' }}>{it.priceLandedRu}</span>
                    <span className="mono small" style={{ color: 'var(--mute-2)', letterSpacing: '0.08em' }}>{it.eta}</span>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};
