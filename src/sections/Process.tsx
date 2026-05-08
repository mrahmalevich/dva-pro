import { Icon, Reveal } from '../components/atoms';
import { useCrm } from '../crm/CrmProvider';

const FALLBACK_STEPS = [
  { code: '01', title: 'Заявка',  sub: 'Короткий квиз — мы понимаем бюджет, тип кузова и сроки.' },
  { code: '02', title: 'Подбор',  sub: 'Денис собирает 6–8 машин с зарубежных аукционов под ваш профиль.' },
  { code: '03', title: 'Покупка', sub: 'Мы выкупаем выбранное авто — договор, инспекция, оплата.' },
  { code: '04', title: 'Доставка',sub: 'Логистика, таможня, постановка на учёт. Машина у вашего подъезда.' },
] as const;

export const Process = ({ onOpenQuiz }: { onOpenQuiz: () => void }) => {
  const { state } = useCrm();
  const sourceSteps = state.timeline.slice(0, 4);
  const steps = FALLBACK_STEPS.map((fb, i) => {
    const src = sourceSteps[i];
    return {
      code: fb.code,
      title: src?.title?.trim() || fb.title,
      sub:   src?.sub?.trim()   || fb.sub,
    };
  });

  return (
    <section id="process" style={{ background: 'var(--ink)', color: '#fff' }}>
      <div className="container">
        <Reveal>
          <div style={{ marginBottom: 32 }}>
            <div className="num-marker" style={{ marginBottom: 14 }}>02 / Как мы работаем</div>
            <h2 className="h1" style={{ maxWidth: 1000 }}>
              Четыре шага от&nbsp;заявки<br />до&nbsp;ключей. <span className="outline-italic">Без сюрпризов.</span>
            </h2>
          </div>
        </Reveal>

        <div
          className="process-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 0,
            borderTop: '1px solid var(--line)',
          }}
        >
          {steps.map((s, i) => (
            <Reveal key={s.code} delay={i * 80}>
              <div style={{
                padding: '32px 28px 28px',
                borderRight: i < steps.length - 1 ? '1px solid var(--line)' : 'none',
                borderBottom: '1px solid var(--line)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}>
                <div className="mono" style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 700, letterSpacing: '0.12em' }}>
                  {s.code}
                </div>
                <h3 className="h3" style={{ fontSize: 26, marginBottom: 0 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.55, margin: 0 }}>{s.sub}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-start' }}>
          <button className="btn btn-primary" onClick={onOpenQuiz}>
            Начать с шага 01 <Icon name="arrow-right" size={16} />
          </button>
        </div>
      </div>

      {/* Mobile: stack to single column */}
      <style>{`
        @media (max-width: 720px) {
          #process .process-grid { grid-template-columns: 1fr !important; }
          #process .process-grid > * > div { border-right: none !important; }
        }
      `}</style>
    </section>
  );
};
