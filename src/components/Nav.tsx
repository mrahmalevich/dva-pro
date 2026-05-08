import { useEffect, useState } from 'react';
import { Logo } from './atoms';

const LINKS: [string, string][] = [
  ['Каталог', '#catalog'],
  ['Процесс', '#process'],
  ['В пути', '#in-transit'],
  ['Отзывы', '#reviews'],
  ['FAQ', '#faq'],
];

export const Nav = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
        transition: 'background .25s, backdrop-filter .25s, border-color .25s',
        background: scrolled || menuOpen ? 'rgba(10,10,9,0.85)' : 'transparent',
        backdropFilter: scrolled || menuOpen ? 'blur(18px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--line)' : '1px solid transparent',
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0' }}>
          <a href="#top" onClick={() => setMenuOpen(false)}><Logo size={32} /></a>
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 32, fontSize: 14, fontWeight: 500 }}>
            {LINKS.map(([l, h]) => (
              <a key={l} className="linkx" href={h} style={{ color: 'rgba(255,255,255,0.85)' }}>{l}</a>
            ))}
          </div>
          <button
            className={`burger ${menuOpen ? 'is-open' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Меню"
            aria-expanded={menuOpen}>
            <span />
          </button>
        </div>
      </nav>

      <div className={`mobile-menu ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
        {LINKS.map(([l, h]) => (
          <a key={l} href={h} onClick={() => setMenuOpen(false)}>{l}</a>
        ))}
      </div>
    </>
  );
};
