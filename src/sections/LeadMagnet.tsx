import { CarPlaceholder, Chip, FlagFor, Icon, Reveal } from '../components/atoms';
import { useCrm } from '../crm/CrmProvider';

export const LeadMagnet = ({ onOpenQuiz }: { onOpenQuiz: () => void }) => (
  <section id="lead-magnet" className="grain" style={{ background: 'var(--ink)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
    <div style={{
      position: 'absolute', top: -100, right: -150, width: 700, height: 700, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(213,121,89,0.4), transparent 60%)', filter: 'blur(80px)',
    }} />
    <div className="container" style={{ position: 'relative', zIndex: 2 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
        <Reveal>
          <Chip style={{ marginBottom: 24 }}>
            <Icon name="doc" size={14} /> Бесплатно · PDF
          </Chip>
          <h2 className="h1" style={{ marginBottom: 28 }}>
            Подборка из&nbsp;<span style={{ color: 'var(--coral)' }}>6–8&nbsp;авто</span><br />
            <span className="outline-italic">под&nbsp;ваши</span> параметры
          </h2>
          <p className="body-lg" style={{ color: 'var(--mute)', marginBottom: 36, maxWidth: 520 }}>
            Ответьте на&nbsp;5&nbsp;вопросов&nbsp;— через 5&nbsp;минут Денис пришлёт в&nbsp;Telegram персональный PDF с&nbsp;ценами под&nbsp;ключ, фото и&nbsp;сроками доставки.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              'Цены «под ключ» — без скрытых платежей',
              'Только реальные машины — в наличии или на аукционе',
              'Фото каждой, спецификации, сроки доставки',
              'Подбор сделают лично Денис и Алексей',
            ].map((p) => (
              <li key={p} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <span style={{ width: 24, height: 24, background: 'var(--coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="check" size={13} stroke={3} />
                </span>
                <span style={{ color: 'rgba(255,255,255,0.9)' }}>{p}</span>
              </li>
            ))}
          </ul>
          <button className="btn btn-primary btn-lg" onClick={onOpenQuiz}>
            Пройти анкету · 5&nbsp;вопросов <Icon name="arrow-right" size={18} />
          </button>
        </Reveal>

        <Reveal delay={200}>
          <PdfPreview />
        </Reveal>
      </div>
    </div>
  </section>
);

const PdfPreview = () => {
  const { state } = useCrm();
  const sample = state.cars.slice(0, 3);
  return (
    <div style={{ position: 'relative', perspective: 1600 }}>
      <div style={{
        transform: 'rotateY(-12deg) rotateX(4deg)',
        transformStyle: 'preserve-3d',
        transition: 'transform .6s cubic-bezier(.2,.7,.2,1)',
      }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'rotateY(-6deg) rotateX(2deg)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'rotateY(-12deg) rotateX(4deg)'; }}>
        <div style={{
          background: '#fff', color: 'var(--ink)',
          padding: 32,
          boxShadow: '0 60px 120px -30px rgba(0,0,0,0.7)',
          aspectRatio: '3/4', maxWidth: 460, margin: '0 auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '2px solid var(--ink)' }}>
            <div style={{ fontWeight: 900, fontStyle: 'italic', fontSize: 18, letterSpacing: '-0.03em' }}>DVA<span style={{ fontWeight: 400, opacity: 0.5 }}>pro</span></div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', color: 'rgba(0,0,0,0.5)' }}>
              ПОДБОРКА · 26.04.26
            </div>
          </div>
          <div className="num-marker" style={{ marginBottom: 8, color: 'rgba(0,0,0,0.5)' }}>Для Артёма К.</div>
          <h3 style={{ fontStyle: 'italic', fontWeight: 900, fontSize: 26, lineHeight: 0.95, marginBottom: 16, letterSpacing: '-0.02em' }}>
            SUV · 8–12 млн&nbsp;₽<br />Япония / Корея
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
            {sample.map((c) => (
              <div key={c.id} style={{ display: 'flex', gap: 10, padding: 10, background: 'var(--paper)' }}>
                <div style={{ width: 70, flexShrink: 0 }}>
                  <CarPlaceholder label="" accent={c.accent} height={50} src={c.img} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, fontStyle: 'italic' }}>{c.brand} {c.model}</div>
                  <div className="mono" style={{ fontSize: 10, color: 'rgba(0,0,0,0.5)' }}>{c.year} · {c.mileage}</div>
                  <div style={{ fontSize: 13, fontWeight: 900, fontStyle: 'italic', color: c.accent === 'coral' ? 'var(--coral)' : 'var(--cyan)', marginTop: 2 }}>{c.price}</div>
                </div>
                <FlagFor country={c.country} size={14} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, padding: 14, background: 'var(--ink)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: 11, letterSpacing: '0.1em' }}>+ ЕЩЁ {Math.max(0, state.cars.length - 3)} ВАРИАНТОВ</span>
            <Icon name="arrow-right" size={14} />
          </div>
        </div>
        <div style={{
          position: 'absolute', top: -16, right: -16,
          background: 'var(--cyan)', color: '#fff',
          padding: '10px 16px', fontSize: 12, fontWeight: 700,
          transform: 'rotate(8deg)',
          boxShadow: '0 12px 24px -8px rgba(29,163,203,0.6)',
          letterSpacing: '0.06em',
        }}>
          PDF · 8 СТРАНИЦ
        </div>
      </div>
    </div>
  );
};
