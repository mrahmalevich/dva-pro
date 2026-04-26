import { FounderPortrait, Icon, Reveal } from '../components/atoms';
import { useCrm } from '../crm/CrmProvider';

export const Founders = () => {
  const { state } = useCrm();
  const { settings } = state;

  return (
    <section id="founders" style={{ background: '#0a0a09', color: '#fff' }}>
      <div className="container">
        <Reveal>
          <div className="num-marker" style={{ marginBottom: 14 }}>04 / Свои ребята</div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 80, alignItems: 'flex-start' }}>
          <Reveal>
            <h2 className="h1">
              {settings.founderRu.name}<span style={{ color: 'var(--coral)' }}>&nbsp;+&nbsp;</span>{settings.founderKr.name}.<br />
              <span className="outline-italic">Два&nbsp;</span><span style={{ color: 'var(--cyan)', fontStyle: 'italic', fontWeight: 900 }}>профи.</span>
            </h2>
            <p className="body-lg" style={{ marginTop: 28, color: 'var(--mute)', maxWidth: 380 }}>
              Знакомы с&nbsp;корейским авто-рынком с&nbsp;2005&nbsp;года. Один в&nbsp;Корее, другой в&nbsp;России&nbsp;— замкнутый цикл без посредников.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginBottom: 48 }}>
              <div>
                <FounderPortrait name={settings.founderKr.name} accent="coral" size={240} />
                <div style={{ marginTop: 18 }}>
                  <div className="num-marker" style={{ marginBottom: 6 }}>в&nbsp;Корее</div>
                  <div className="h3" style={{ fontStyle: 'italic' }}>{settings.founderKr.surname}</div>
                  <p style={{ fontSize: 14, color: 'var(--mute)', marginTop: 8, lineHeight: 1.5 }}>
                    {settings.founderKr.bio}
                  </p>
                </div>
              </div>
              <div>
                <FounderPortrait name={settings.founderRu.name} accent="cyan" size={240} />
                <div style={{ marginTop: 18 }}>
                  <div className="num-marker" style={{ marginBottom: 6 }}>в&nbsp;России</div>
                  <div className="h3" style={{ fontStyle: 'italic' }}>{settings.founderRu.surname}</div>
                  <p style={{ fontSize: 14, color: 'var(--mute)', marginTop: 8, lineHeight: 1.5 }}>
                    {settings.founderRu.bio}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ padding: 32, border: '1px solid var(--line)', background: 'rgba(255,255,255,0.02)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -18, left: 24, fontSize: 64, fontStyle: 'italic', fontWeight: 900, color: 'var(--coral)', lineHeight: 1 }}>«</div>
              <p className="body-lg" style={{ color: 'rgba(255,255,255,0.85)', margin: 0, paddingTop: 8 }}>
                {settings.brandQuote}
              </p>
              <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <a className="btn btn-cyan" href={settings.telegram} target="_blank" rel="noreferrer" style={{ background: '#229ED9' }}>
                  <Icon name="tg" size={16} /> Telegram
                </a>
                <a className="btn btn-ghost" href={settings.whatsapp} target="_blank" rel="noreferrer">
                  <Icon name="wa" size={16} /> WhatsApp
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
