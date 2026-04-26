import { useState } from 'react';
import { Icon, Reveal } from '../components/atoms';
import { useCrm } from '../crm/CrmProvider';

export const Faq = () => {
  const { state } = useCrm();
  const [open, setOpen] = useState<number>(0);

  return (
    <section id="faq" style={{ background: 'var(--ink)', color: '#fff' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 96 }}>
          <Reveal>
            <div className="num-marker" style={{ marginBottom: 14 }}>06 / FAQ</div>
            <h2 className="h1" style={{ marginBottom: 28 }}>
              Вопросы,<br /><span className="outline-italic">которые задают</span><br />чаще всего
            </h2>
            <p className="body-lg" style={{ color: 'var(--mute)', maxWidth: 360 }}>
              Не нашли ответ? Напишите Денису в&nbsp;Telegram&nbsp;— обычно отвечает за&nbsp;5&nbsp;минут.
            </p>
            <a className="btn btn-cyan" style={{ marginTop: 28, background: '#229ED9' }} href={state.settings.telegram} target="_blank" rel="noreferrer">
              <Icon name="tg" size={16} /> Telegram
            </a>
          </Reveal>

          <div>
            {state.faq.map((f, i) => {
              const isOpen = open === i;
              return (
                <Reveal key={f.id} delay={i * 50}>
                  <button onClick={() => setOpen(isOpen ? -1 : i)} style={{
                    width: '100%', textAlign: 'left',
                    padding: '28px 0',
                    borderTop: '1px solid var(--line)',
                    borderBottom: i === state.faq.length - 1 ? '1px solid var(--line)' : 'none',
                    color: '#fff',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                      <h3 className="h3" style={{ fontSize: 21, color: '#fff', fontStyle: 'italic' }}>{f.q}</h3>
                      <span style={{
                        width: 36, height: 36, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isOpen ? 'var(--coral)' : 'rgba(255,255,255,0.05)',
                        color: isOpen ? '#fff' : 'inherit',
                        border: '1px solid',
                        borderColor: isOpen ? 'var(--coral)' : 'var(--line-strong)',
                        transition: 'all .25s',
                        transform: isOpen ? 'rotate(45deg)' : 'rotate(0)',
                      }}><Icon name="plus" size={16} /></span>
                    </div>
                    <div style={{
                      maxHeight: isOpen ? 320 : 0,
                      overflow: 'hidden',
                      transition: 'max-height .35s ease, margin-top .35s ease',
                      marginTop: isOpen ? 16 : 0,
                    }}>
                      <p style={{ margin: 0, color: 'var(--mute)', fontSize: 15, lineHeight: 1.6, maxWidth: 720 }}>
                        {f.a}
                      </p>
                    </div>
                  </button>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
