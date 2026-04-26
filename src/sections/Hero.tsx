import { useRef, type MouseEvent } from 'react';
import { Chip, Counter, FlagFor, Icon, Live, Reveal } from '../components/atoms';
import { useCrm } from '../crm/CrmProvider';

export const Hero = ({ onOpenQuiz }: { onOpenQuiz: () => void }) => {
  const { state } = useCrm();
  const { settings, cars } = state;
  const ref = useRef<HTMLElement>(null);

  const onMove = (e: MouseEvent<HTMLElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  const inWork = cars.slice(0, 3).map((c, i) => ({
    code: `${c.country.toUpperCase()}-${100 + i * 37}`,
    text: `${c.brand} ${c.model} — ${c.eta.split('·')[0].trim()}`,
    flag: c.country,
    accent: c.accent,
  }));

  const stats = [
    { n: settings.totalDelivered, label: 'авто доставлено', suf: '+' },
    { n: settings.yearsOnMarket, label: 'лет на рынке', suf: '' },
    { n: settings.avgDeliveryDays, label: 'дней доставка', suf: '' },
    { n: settings.satisfactionPct, label: '% довольных', suf: '' },
  ];

  return (
    <header
      id="top"
      ref={ref}
      onMouseMove={onMove}
      className="grain spotlight-host"
      style={{ position: 'relative', minHeight: '100vh', background: 'var(--ink)', color: '#fff', overflow: 'hidden', paddingTop: 140 }}>
      <div className="spotlight" />

      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url("https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?auto=format&fit=crop&w=2000&q=80")',
        backgroundSize: 'cover', backgroundPosition: 'center 60%',
        opacity: 0.32,
        filter: 'grayscale(0.4) contrast(1.1)',
      }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,10,9,0.55) 0%, rgba(10,10,9,0.4) 40%, rgba(10,10,9,0.92) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,10,9,0.95) 0%, rgba(10,10,9,0.4) 50%, rgba(10,10,9,0.1) 100%)' }} />

      <div style={{
        position: 'absolute', left: 0, right: 0, top: '38%',
        textAlign: 'center', pointerEvents: 'none',
        fontWeight: 900, fontStyle: 'italic',
        fontSize: 'min(34vw, 640px)', letterSpacing: '-0.06em',
        color: 'rgba(255,255,255,0.025)',
        whiteSpace: 'nowrap', lineHeight: 0.85,
      }}>DVApro</div>

      <div style={{ position: 'relative', zIndex: 3 }}>
        <div className="container">
          <Reveal>
            <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
              <Live>{settings.liveCount} авто в&nbsp;пути</Live>
              <Chip><Icon name="flag-jp" size={14} /> Япония</Chip>
              <Chip><Icon name="flag-cn" size={14} /> Китай</Chip>
              <Chip><Icon name="flag-kr" size={14} /> Корея</Chip>
              <Chip style={{ color: 'var(--mute)' }}>с&nbsp;2005</Chip>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <h1 className="h-display" style={{ marginBottom: 28 }}>
              Свои <span style={{ color: 'var(--coral)' }}>ребята</span><br />
              <span className="outline-italic">на&nbsp;авто-</span>рынке<span style={{ color: 'var(--cyan)' }}>.</span>
            </h1>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'flex-end', maxWidth: 1280, marginTop: 20 }}>
            <Reveal delay={220}>
              <p className="body-lg" style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 540, marginBottom: 36 }}>
                Подбираем и&nbsp;привозим автомобили из&nbsp;Кореи, Японии и&nbsp;Китая. Прозрачная смета, видео-осмотр, доставка к&nbsp;подъезду. Без переплат и&nbsp;«сюрпризов» в&nbsp;финале.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-primary btn-lg" onClick={onOpenQuiz}>
                  Подобрать за&nbsp;5&nbsp;минут <Icon name="arrow-right" size={18} />
                </button>
                <a className="btn btn-ghost btn-lg" href="#catalog">
                  Каталог · {cars.length * 40}+&nbsp;авто
                </a>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', padding: '28px 28px 24px' }}>
                <div className="num-marker" style={{ marginBottom: 14 }}>В работе сейчас</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {inWork.map((r) => (
                    <div key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                      <FlagFor country={r.flag} size={18} />
                      <span className="mono" style={{ fontSize: 11, color: 'var(--mute)', letterSpacing: '0.1em' }}>{r.code}</span>
                      <span style={{ flex: 1, fontSize: 14 }}>{r.text}</span>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.accent === 'coral' ? 'var(--coral)' : 'var(--cyan)' }} />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>+{Math.max(0, parseInt(settings.liveCount, 10) - 3)} в&nbsp;пути</span>
                  <a className="linkx" href="#catalog" style={{ fontSize: 13, fontWeight: 600 }}>Все авто →</a>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={420}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginTop: 96, paddingTop: 32, borderTop: '1px solid var(--line)' }}>
              {stats.map((s, i) => (
                <div key={s.label} style={{ paddingRight: 24, borderRight: i < 3 ? '1px solid var(--line)' : 'none', paddingLeft: i > 0 ? 24 : 0 }}>
                  <div className="stat-num" style={{ color: i % 2 ? 'var(--cyan)' : 'var(--coral)' }}>
                    <Counter to={s.n} suffix={s.suf} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 8, letterSpacing: '0.04em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </header>
  );
};
