import { Link } from 'react-router-dom';
import { Icon, Logo } from '../components/atoms';
import { useCrm } from '../crm/CrmProvider';

export const Footer = () => {
  const { state } = useCrm();
  const { settings } = state;
  return (
    <footer style={{ background: '#000', color: '#fff', padding: '100px 0 48px', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: -40,
        pointerEvents: 'none', textAlign: 'center',
        fontWeight: 900, fontStyle: 'italic',
        fontSize: 'min(28vw, 480px)', letterSpacing: '-0.06em',
        color: 'rgba(255,255,255,0.04)',
        lineHeight: 0.85,
      }}>DVApro</div>

      <div className="container" style={{ position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 56, marginBottom: 80 }}>
          <div>
            <Logo size={36} />
            <p style={{ marginTop: 24, color: 'var(--mute)', fontSize: 14, maxWidth: 320, lineHeight: 1.55 }}>
              Подбор и&nbsp;доставка авто из&nbsp;Японии, Китая, Кореи. Свои ребята с&nbsp;2005&nbsp;года.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 28 }}>
              <a className="dock-btn tg" href={settings.telegram} target="_blank" rel="noreferrer" style={{ position: 'static', width: 44, height: 44 }} aria-label="Telegram"><Icon name="tg" size={18} /></a>
              <a className="dock-btn wa" href={settings.whatsapp} target="_blank" rel="noreferrer" style={{ position: 'static', width: 44, height: 44 }} aria-label="WhatsApp"><Icon name="wa" size={18} /></a>
              <a className="dock-btn" href={`tel:${settings.phone.replace(/\D/g, '')}`} style={{ position: 'static', width: 44, height: 44 }} aria-label="Phone"><Icon name="phone" size={16} /></a>
              <a className="dock-btn" href={`mailto:${settings.email}`} style={{ position: 'static', width: 44, height: 44 }} aria-label="Email"><Icon name="mail" size={16} /></a>
            </div>
          </div>
          <div>
            <div className="num-marker" style={{ marginBottom: 18 }}>Сайт</div>
            {[
              ['Каталог', '#catalog'],
              ['Процесс', '#process'],
              ['В пути', '#in-transit'],
              ['Отзывы', '#reviews'],
              ['FAQ', '#faq'],
            ].map(([l, h]) => (
              <div key={l}><a className="linkx" href={h} style={{ display: 'inline-block', padding: '6px 0', fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{l}</a></div>
            ))}
          </div>
          <div>
            <div className="num-marker" style={{ marginBottom: 18 }}>Направления</div>
            {['DVApro Авто', 'DVApro Корея', 'DVApro Япония', 'DVApro Китай', 'DVApro BMW'].map((l) => (
              <div key={l}><a className="linkx" style={{ display: 'inline-block', padding: '6px 0', fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{l}</a></div>
            ))}
            <div style={{ marginTop: 8 }}>
              <Link to="/admin" className="linkx" style={{ display: 'inline-block', padding: '6px 0', fontSize: 14, color: 'var(--cyan)' }}>CRM Admin →</Link>
            </div>
          </div>
          <div>
            <div className="num-marker" style={{ marginBottom: 18 }}>Контакты</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.85 }}>
              {settings.phone}<br />
              {settings.email}<br />
              <span style={{ color: 'var(--mute)' }}>{settings.cities}</span>
            </div>
          </div>
        </div>
        <div className="mono" style={{ paddingTop: 32, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: 11, color: 'var(--mute-2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <span>© 2005–2026 DVApro · ООО «ДВА.ПРО»</span>
          <span>dva-pro.ru</span>
        </div>
      </div>
    </footer>
  );
};

export const FloatingDock = () => {
  const { state } = useCrm();
  return (
    <div className="dock">
      <a className="dock-btn tg" href={state.settings.telegram} target="_blank" rel="noreferrer" title="Telegram" aria-label="Telegram"><Icon name="tg" size={22} /></a>
      <a className="dock-btn wa" href={state.settings.whatsapp} target="_blank" rel="noreferrer" title="WhatsApp" aria-label="WhatsApp"><Icon name="wa" size={22} /></a>
    </div>
  );
};
