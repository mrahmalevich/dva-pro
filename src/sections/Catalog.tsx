import { useMemo, useState } from 'react';
import { CarPlaceholder, FlagFor, Icon, Reveal } from '../components/atoms';
import { useCrm } from '../crm/CrmProvider';
import type { Country } from '../crm/types';

type Filter = 'all' | Country;
const FILTERS: [Filter, string, Country | null][] = [
  ['all', 'Все', null],
  ['jp', 'Япония', 'jp'],
  ['cn', 'Китай', 'cn'],
  ['kr', 'Корея', 'kr'],
];

export const Catalog = ({ onOpenQuiz }: { onOpenQuiz: () => void }) => {
  const { state } = useCrm();
  const [filter, setFilter] = useState<Filter>('all');
  const filtered = useMemo(
    () => filter === 'all' ? state.cars : state.cars.filter((c) => c.country === filter),
    [state.cars, filter],
  );

  return (
    <section id="catalog" style={{ background: 'var(--ink)', color: '#fff' }}>
      <div className="container">
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 24 }}>
            <div>
              <div className="num-marker" style={{ marginBottom: 14 }}>03 / Каталог</div>
              <h2 className="h1">Свежие машины<br /><span className="outline-italic">в&nbsp;пути</span> и&nbsp;в&nbsp;наличии</h2>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {FILTERS.map(([v, label, flag]) => {
                const active = filter === v;
                return (
                  <button key={v}
                    onClick={() => setFilter(v)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '10px 18px', borderRadius: 999,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: '1px solid',
                      transition: 'all .2s',
                      background: active ? 'var(--coral)' : 'transparent',
                      color: '#fff',
                      borderColor: active ? 'var(--coral)' : 'var(--line-strong)',
                    }}>
                    {flag && <FlagFor country={flag} size={14} />}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        {filtered.length === 0 ? (
          <Reveal>
            <div style={{ padding: 64, border: '1px dashed var(--line-strong)', textAlign: 'center', color: 'var(--mute)' }}>
              По фильтру нет машин. <button onClick={() => setFilter('all')} className="linkx" style={{ color: 'var(--coral)' }}>Сбросить →</button>
            </div>
          </Reveal>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {filtered.map((c, i) => (
              <Reveal key={c.id} delay={i * 60}>
                <div className="card zoom-in">
                  <div style={{ position: 'relative' }}>
                    <CarPlaceholder label={`${c.brand} ${c.model}`} accent={c.accent} height={240} src={c.img} />
                    <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 6 }}>
                      {c.badges.map((b) => (
                        <span key={b} className="tag" style={{
                          background: b.includes('пути') ? 'var(--cyan)' : b.includes('наличии') ? '#36D399' : 'rgba(255,255,255,0.92)',
                          color: b.includes('пути') || b.includes('наличии') ? '#fff' : 'var(--ink)',
                        }}>{b}</span>
                      ))}
                    </div>
                    <div style={{ position: 'absolute', top: 14, right: 14, padding: 6, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
                      <FlagFor country={c.country} size={20} />
                    </div>
                  </div>
                  <div style={{ padding: 24 }}>
                    <div className="num-marker" style={{ marginBottom: 10, fontSize: 11 }}>
                      {c.year} · {c.body} · {c.drive}
                    </div>
                    <div className="h3" style={{ marginBottom: 6, color: '#fff', fontSize: 24, fontStyle: 'italic' }}>{c.brand} {c.model}</div>
                    <div style={{ fontSize: 13, color: 'var(--mute)', marginBottom: 18 }}>{c.spec} · {c.mileage}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                      <div>
                        <div className="num-marker" style={{ fontSize: 10 }}>под ключ</div>
                        <div style={{ fontWeight: 900, fontStyle: 'italic', fontSize: 26, color: c.accent === 'coral' ? 'var(--coral)' : 'var(--cyan)', letterSpacing: '-0.02em' }}>{c.price}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="truck" size={14} /> {c.eta}
                      </div>
                    </div>
                    <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onOpenQuiz}>
                      Подобрать похожее <Icon name="arrow-right" size={14} />
                    </button>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 32 }}>
            <button className="btn btn-primary btn-lg btn-wrap" onClick={onOpenQuiz}>
              Не нашли своё? Подберём под ваши параметры <Icon name="arrow-right" size={16} />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
