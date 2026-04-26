import { EmptyState, RowActions, SectionHeader } from './EditorShell';
import { useCrm } from '../crm/CrmProvider';
import { fmtRub } from '../quiz/quizSpec';
import type { Lead } from '../crm/types';

const STATUSES: Lead['status'][] = ['new', 'in-progress', 'pdf-sent', 'closed'];
const STATUS_LABEL: Record<Lead['status'], string> = {
  new: 'Новая',
  'in-progress': 'В работе',
  'pdf-sent': 'PDF отправлен',
  closed: 'Закрыта',
};
const STATUS_COLOR: Record<Lead['status'], string> = {
  new: 'var(--coral)',
  'in-progress': 'var(--cyan)',
  'pdf-sent': '#36D399',
  closed: 'var(--mute)',
};

export const LeadsAdmin = () => {
  const { state, updateLeadStatus, deleteLead } = useCrm();

  return (
    <>
      <SectionHeader title="Заявки с сайта" subtitle={`Всего: ${state.leads.length}. Заявки приходят из квиза подбора.`} />
      {state.leads.length === 0 ? (
        <EmptyState message="Заявок пока нет. Откройте сайт и пройдите анкету — заявка появится здесь." />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Когда</th>
                <th>Имя</th>
                <th>Контакты</th>
                <th>Бюджет</th>
                <th>Параметры</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.leads.map((l) => (
                <tr key={l.id}>
                  <td className="mono small" style={{ color: 'var(--mute)' }}>
                    {new Date(l.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td style={{ fontWeight: 700 }}>{l.name}</td>
                  <td>
                    <div style={{ fontSize: 13 }}>{l.phone}</div>
                    {l.email && <div style={{ fontSize: 12, color: 'var(--mute)' }}>{l.email}</div>}
                    {l.tg && <div style={{ fontSize: 12, color: 'var(--cyan)' }}>{l.tg}</div>}
                  </td>
                  <td className="mono small">
                    {fmtRub(l.budgetMin)}<br />— {fmtRub(l.budgetMax)}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--mute)' }}>
                    {l.body.length > 0 && <div>Кузов: {l.body.join(', ')}</div>}
                    {l.condition && <div>Состояние: {l.condition}</div>}
                    {l.use && <div>Цель: {l.use}</div>}
                    {l.timing && <div>Срок: {l.timing}</div>}
                  </td>
                  <td>
                    <select
                      className="input"
                      style={{ padding: '8px 10px', fontSize: 12, color: STATUS_COLOR[l.status] }}
                      value={l.status}
                      onChange={(e) => updateLeadStatus(l.id, e.target.value as Lead['status'])}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td><RowActions onEdit={() => alert('Просмотр пока не нужен — все поля видны в строке.')} onDelete={() => deleteLead(l.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};
