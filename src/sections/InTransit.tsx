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
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}
        >
          {state.inTransit.slice(0, 4).map((it, i) => {
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
              <Reveal key={it.id} delay={i * 60}>
                <div className="card zoom-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'relative' }}>
                    <CarPlaceholder label={`${it.brand} ${it.model}`} accent={it.accent} height={240} src={it.img} />
                    <div style={{ position: 'absolute', top: 14, left: 14 }}>
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
                    <div style={{ position: 'absolute', top: 14, right: 14, padding: 6, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
                      <FlagFor country={it.country} size={20} />
                    </div>
                  </div>

                  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div className="num-marker" style={{ marginBottom: 10, fontSize: 11 }}>
                      {it.country === 'jp' ? 'Япония' : it.country === 'cn' ? 'Китай' : 'Корея'} · {it.statusLabel}
                    </div>
                    <div className="h3" style={{ marginBottom: 6, color: '#fff', fontSize: 24, fontStyle: 'italic' }}>
                      {it.brand} {it.model}
                    </div>
                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                      <div>
                        <div className="num-marker" style={{ fontSize: 10 }}>под ключ</div>
                        <div style={{ fontWeight: 900, fontStyle: 'italic', fontSize: 26, color: it.accent === 'coral' ? 'var(--coral)' : 'var(--cyan)', letterSpacing: '-0.02em' }}>
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

      {/* Resizing: 4-col → 2-col at narrow desktop, 1-col on mobile (matches Catalog's collapse via gridTemplateColumns string-match in global.css:555). */}
      <style>{`
        @media (max-width: 1100px) and (min-width: 721px) {
          #in-transit .in-transit-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 720px) {
          #in-transit .in-transit-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
        }
      `}</style>
    </section>
  );
};
