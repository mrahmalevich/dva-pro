import { Icon, Reveal } from '../components/atoms';

export const CtaShipFromAnywhere = ({ onOpenQuiz }: { onOpenQuiz: () => void }) => (
  <section
    id="cta-ship-from-anywhere"
    className="grain"
    style={{
      background: 'var(--ink)',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
      padding: '96px 0',
    }}
  >
    {/* Coral glow — mirrors Hero G-01 */}
    <div
      style={{
        position: 'absolute',
        top: -100,
        right: -150,
        width: 700,
        height: 700,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(213,121,89,0.4), transparent 60%)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
      }}
    />
    {/* Faint gradient overlay to anchor text */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.35) 100%)',
        pointerEvents: 'none',
      }}
    />

    <div className="container" style={{ position: 'relative', zIndex: 2 }}>
      <Reveal>
        <h2 className="h1" style={{ marginBottom: 28, textAlign: 'center', maxWidth: 900, marginLeft: 'auto', marginRight: 'auto' }}>
          Привезём вам автомобиль<br />
          из&nbsp;<span className="outline-italic">любого&nbsp;порта</span> мира<span style={{ color: 'var(--cyan)' }}>.</span>
        </h2>
      </Reveal>
      <Reveal delay={120}>
        <p className="body-lg" style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 540, margin: '0 auto 36px', textAlign: 'center' }}>
          Корея, Япония, Китай, Европа, ОАЭ — 19&nbsp;лет на&nbsp;рынке, 1840+ автомобилей у&nbsp;клиентов. Расскажите, что ищете — подберём с&nbsp;ценами «под&nbsp;ключ».
        </p>
      </Reveal>
      <Reveal delay={200}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={onOpenQuiz}>
            Открыть квиз — 5 минут <Icon name="arrow-right" size={18} />
          </button>
        </div>
      </Reveal>
    </div>
  </section>
);
