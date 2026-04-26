import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Icon, Logo } from '../components/atoms';
import { useCrm } from '../crm/CrmProvider';
import { CarsAdmin } from '../admin/CarsAdmin';
import { TimelineAdmin } from '../admin/TimelineAdmin';
import { FaqAdmin } from '../admin/FaqAdmin';
import { ReviewsAdmin } from '../admin/ReviewsAdmin';
import { FeedAdmin } from '../admin/FeedAdmin';
import { SettingsAdmin } from '../admin/SettingsAdmin';
import { LeadsAdmin } from '../admin/LeadsAdmin';

const TABS = [
  { to: 'cars', label: 'Машины' },
  { to: 'timeline', label: 'Процесс' },
  { to: 'faq', label: 'FAQ' },
  { to: 'reviews', label: 'Отзывы' },
  { to: 'feed', label: 'Лента' },
  { to: 'settings', label: 'Настройки' },
  { to: 'leads', label: 'Заявки' },
];

export const Admin = () => {
  const { state, resetToSeed } = useCrm();
  const navigate = useNavigate();

  return (
    <div className="admin-shell">
      <div style={{
        background: '#0a0a09',
        borderBottom: '1px solid var(--line)',
        padding: '20px 0',
        position: 'sticky', top: 0, zIndex: 10,
        backdropFilter: 'blur(18px)',
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Logo size={28} />
            <span className="num-marker" style={{ color: 'var(--cyan)' }}>CRM</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="mono small" style={{ color: 'var(--mute)', letterSpacing: '0.08em' }}>
              {state.cars.length} машин · {state.leads.length} заявок
            </span>
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (confirm('Сбросить весь контент к исходным данным? Заявки тоже удалятся.')) resetToSeed();
              }}>
              Сбросить
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              <Icon name="arrow-left" size={14} /> На&nbsp;сайт
            </button>
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: '32px 56px 80px' }}>
        <div className="admin-tabs">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => `admin-tab ${isActive ? 'is-active' : ''}`}>
              {t.label}
            </NavLink>
          ))}
        </div>

        <Routes>
          <Route index element={<Navigate to="cars" replace />} />
          <Route path="cars" element={<CarsAdmin />} />
          <Route path="timeline" element={<TimelineAdmin />} />
          <Route path="faq" element={<FaqAdmin />} />
          <Route path="reviews" element={<ReviewsAdmin />} />
          <Route path="feed" element={<FeedAdmin />} />
          <Route path="settings" element={<SettingsAdmin />} />
          <Route path="leads" element={<LeadsAdmin />} />
        </Routes>
      </div>
    </div>
  );
};
