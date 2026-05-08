import { useState, type ChangeEvent } from 'react';
import { Drawer, EmptyState, Field, RowActions, SectionHeader } from './EditorShell';
import { useCrm } from '../crm/CrmProvider';
import type { Review } from '../crm/types';

const blank = (id: string): Review => ({ id, name: '', city: '', car: '', text: '', rating: 5, avatar: '', date: '', platform: 'yandex' });

export const ReviewsAdmin = () => {
  const { state, upsertReview, deleteReview, newId } = useCrm();
  const [editing, setEditing] = useState<Review | null>(null);

  return (
    <>
      <SectionHeader title="Отзывы" subtitle="Показываются на главной в секции «Реальные истории»." onAdd={() => setEditing(blank(newId('rev')))} addLabel="Новый отзыв" />
      {state.reviews.length === 0 ? (
        <EmptyState message="Отзывов пока нет." />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Имя</th><th>Город</th><th>Авто</th><th>Текст</th><th>Звёзд</th><th /></tr>
            </thead>
            <tbody>
              {state.reviews.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700 }}>{r.name}</td>
                  <td style={{ color: 'var(--mute)' }}>{r.city}</td>
                  <td style={{ color: 'var(--mute)' }}>{r.car}</td>
                  <td style={{ color: 'var(--mute)', maxWidth: 480 }}>{r.text}</td>
                  <td style={{ color: 'var(--coral)' }}>{'★'.repeat(r.rating)}</td>
                  <td><RowActions onEdit={() => setEditing({ ...r })} onDelete={() => deleteReview(r.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={editing != null}
        onClose={() => setEditing(null)}
        title="Отзыв"
        onSave={() => { if (editing) { upsertReview(editing); setEditing(null); } }}>
        {editing && (
          <div className="field-grid">
            <Field label="Имя"><input className="input" value={editing.name} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Город"><input className="input" value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></Field>
            <Field label="Авто" full><input className="input" value={editing.car} onChange={(e) => setEditing({ ...editing, car: e.target.value })} /></Field>
            <Field label="Текст" full><textarea className="textarea" rows={6} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} /></Field>
            <Field label="Звёзд (1–5)"><input className="input" type="number" min={1} max={5} value={editing.rating} onChange={(e) => setEditing({ ...editing, rating: Math.max(1, Math.min(5, Number(e.target.value))) })} /></Field>
          </div>
        )}
      </Drawer>
    </>
  );
};
