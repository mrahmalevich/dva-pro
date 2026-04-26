import { useState, type ChangeEvent } from 'react';
import { Drawer, EmptyState, Field, RowActions, SectionHeader } from './EditorShell';
import { useCrm } from '../crm/CrmProvider';
import type { FeedItem } from '../crm/types';

const blank = (id: string): FeedItem => ({ id, time: 'только что', text: '', icon: 'truck' });
const ICONS: FeedItem['icon'][] = ['truck', 'shield', 'sparkle', 'doc', 'check'];

export const FeedAdmin = () => {
  const { state, upsertFeedItem, deleteFeedItem, newId } = useCrm();
  const [editing, setEditing] = useState<FeedItem | null>(null);

  return (
    <>
      <SectionHeader title="Лента событий" subtitle="Показываются 5 самых первых пунктов." onAdd={() => setEditing(blank(newId('feed')))} addLabel="Новое событие" />
      {state.feed.length === 0 ? (
        <EmptyState message="Событий пока нет." />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Время</th><th>Иконка</th><th>Текст</th><th /></tr>
            </thead>
            <tbody>
              {state.feed.map((f) => (
                <tr key={f.id}>
                  <td className="mono small" style={{ color: 'var(--mute)' }}>{f.time}</td>
                  <td>{f.icon}</td>
                  <td>{f.text}</td>
                  <td><RowActions onEdit={() => setEditing({ ...f })} onDelete={() => deleteFeedItem(f.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={editing != null}
        onClose={() => setEditing(null)}
        title="Событие"
        onSave={() => { if (editing) { upsertFeedItem(editing); setEditing(null); } }}>
        {editing && (
          <div className="field-grid">
            <Field label="Время"><input className="input" value={editing.time} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditing({ ...editing, time: e.target.value })} placeholder="2 мин назад" /></Field>
            <Field label="Иконка">
              <select className="input" value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value as FeedItem['icon'] })}>
                {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Текст" full><input className="input" value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} /></Field>
          </div>
        )}
      </Drawer>
    </>
  );
};
