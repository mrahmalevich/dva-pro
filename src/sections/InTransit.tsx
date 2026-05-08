import { CarPlaceholder, FlagFor, Icon, Reveal } from '../components/atoms';
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

        <div
          className="in-transit-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(state.inTransit.length, 4)}, 1fr)`,
            gap: 0,
          }}
        >
          {state.inTransit.slice(0, 4).map((it, i) => {
            const count = Math.min(state.inTransit.length, 4);
            const statusIcon: IconName =
              it.status === 'ready' ? 'check' :
              it.status === 'customs' ? 'shield' :
              'truck';
            const statusBg =
              it.status === 'ready' ? '#36D399' :
              it.status === 'customs' ? 'rgba(255,255,255,0.92)' :
              'var(--cyan)';
            const statusFg = it.status === 'customs' ? 'var(--ink)' : '#fff';
            return (
              <Reveal key={it.id} delay={i * 80}>
                <div className="card" style={{
                  background: '#0F0F0E',
                  border: '1px solid var(--line)',
                  borderRight: i < count - 1 ? 'none' : '1px solid var(--line)',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <div style={{ position: 'relative' }}>
                    <CarPlaceholder label={`${it.brand} ${it.model}`} accent={it.accent} height={200} src={it.img} />
                    <div style={{ position: 'absolute', top: 12, left: 12 }}>
                      <span className="tag" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px',
                        background: statusBg, color: statusFg,
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}>
                        <Icon name={statusIcon} size={12} />
                        {it.statusLabel}
                      </span>
                    </div>
                    <div style={{ position: 'absolute', top: 12, right: 12, padding: 6, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
                      <FlagFor country={it.country} size={18} />
                    </div>
                  </div>

                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                    <div className="num-marker" style={{ fontSize: 11 }}>
                      {it.country === 'jp' ? 'Япония' : it.country === 'cn' ? 'Китай' : 'Корея'} · {it.statusLabel}
                    </div>
                    <div className="h3" style={{ marginBottom: 0, color: '#fff', fontSize: 22, fontStyle: 'italic' }}>
                      {it.brand} {it.model}
                    </div>
                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                      <div>
                        <div className="num-marker" style={{ fontSize: 10 }}>под ключ</div>
                        <div style={{ fontWeight: 900, fontStyle: 'italic', fontSize: 22, color: it.accent === 'coral' ? 'var(--coral)' : 'var(--cyan)', letterSpacing: '-0.02em' }}>
                          {it.priceLandedRu}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="truck" size={14} /> {it.eta}
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      {/* Mobile: stack to single column (D-09 mobile guard) */}
      <style>{`
        @media (max-width: 720px) {
          #in-transit .in-transit-grid { grid-template-columns: 1fr !important; }
          #in-transit .in-transit-grid > div > div { border-right: 1px solid var(--line) !important; }
        }
      `}</style>
    </section>
  );
};
