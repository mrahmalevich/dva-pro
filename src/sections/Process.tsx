import { useState } from 'react';
import { CarPlaceholder, Icon, Reveal } from '../components/atoms';
import { useCrm } from '../crm/CrmProvider';

export const Process = ({ onOpenQuiz }: { onOpenQuiz: () => void }) => {
  const { state } = useCrm();
  const [active, setActive] = useState(0);
  const steps = state.timeline;
  const current = steps[active] ?? steps[0];

  if (!current) return null;

  return (
    <section id="process" style={{ background: 'var(--ink)', color: '#fff' }}>
      <div className="container">
        <Reveal>
          <div style={{ marginBottom: 64 }}>
            <div className="num-marker" style={{ marginBottom: 14 }}>03 / Как мы работаем</div>
            <h2 className="h1" style={{ maxWidth: 1000 }}>
              Шесть шагов от&nbsp;заявки<br />до&nbsp;ключей. <span className="outline-italic">Без сюрпризов.</span>
            </h2>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 64, alignItems: 'flex-start' }}>
          <div>
            {steps.map((t, i) => (
              <Reveal key={t.id} delay={i * 60}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                  style={{
                    width: '100%', textAlign: 'left',
                    display: 'flex', gap: 28, padding: '28px 0',
                    borderTop: '1px solid var(--line)',
                    borderBottom: i === steps.length - 1 ? '1px solid var(--line)' : 'none',
                    transition: 'padding-left .25s ease, background .25s',
                    paddingLeft: active === i ? 24 : 0,
                    background: active === i ? 'rgba(213,121,89,0.06)' : 'transparent',
                    color: '#fff',
                  }}>
                  <div className="mono" style={{ minWidth: 60, fontSize: 13, color: active === i ? 'var(--coral)' : 'var(--mute-2)', fontWeight: 700, paddingTop: 10, letterSpacing: '0.1em' }}>
                    {t.code}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
                      <h3 className="h2" style={{ fontSize: 32 }}>{t.title}</h3>
                      <span className="mono small" style={{ color: 'var(--mute-2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.dur}</span>
                    </div>
                    <p style={{ fontSize: 15, color: 'var(--mute)', marginTop: 10, marginBottom: 0, maxWidth: 580, lineHeight: 1.5 }}>{t.sub}</p>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div style={{
              position: 'sticky', top: 120,
              background: '#0F0F0E',
              border: '1px solid var(--line)',
              padding: 28,
            }}>
              <div style={{ marginBottom: 24 }}>
                <CarPlaceholder label={`STEP ${current.code}`} accent={active % 2 ? 'cyan' : 'coral'} height={300} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 16 }}>
                <span style={{ fontSize: 64, fontWeight: 900, fontStyle: 'italic', color: active % 2 ? 'var(--cyan)' : 'var(--coral)', letterSpacing: '-0.04em', lineHeight: 0.85 }}>
                  {current.code}
                </span>
                <div>
                  <div className="h3" style={{ color: '#fff', fontSize: 24 }}>{current.title}</div>
                  <div className="mono small" style={{ color: 'var(--mute-2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{current.dur}</div>
                </div>
              </div>
              <p style={{ fontSize: 15, color: 'var(--mute)', lineHeight: 1.55, marginBottom: 28 }}>
                {current.sub}
              </p>
              <button className="btn btn-primary" onClick={onOpenQuiz} style={{ width: '100%' }}>
                Начать с шага 01 <Icon name="arrow-right" size={16} />
              </button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
