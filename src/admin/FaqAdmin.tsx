import { useState, type ChangeEvent } from 'react';
import { Drawer, EmptyState, Field, RowActions, SectionHeader } from './EditorShell';
import { useCrm } from '../crm/CrmProvider';
import type { FaqItem } from '../crm/types';

const blank = (id: string): FaqItem => ({ id, q: '', a: '' });

export const FaqAdmin = () => {
  const { state, upsertFaq, deleteFaq, newId } = useCrm();
  const [editing, setEditing] = useState<FaqItem | null>(null);

  return (
    <>
      <SectionHeader title="FAQ" subtitle="Вопросы и ответы в секции FAQ на сайте." onAdd={() => setEditing(blank(newId('faq')))} addLabel="Новый вопрос" />
      {state.faq.length === 0 ? (
        <EmptyState message="Вопросов пока нет." />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Вопрос</th><th>Ответ</th><th /></tr>
            </thead>
            <tbody>
              {state.faq.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 700, maxWidth: 320 }}>{f.q}</td>
                  <td style={{ color: 'var(--mute)', maxWidth: 540 }}>{f.a}</td>
                  <td><RowActions onEdit={() => setEditing({ ...f })} onDelete={() => deleteFaq(f.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={editing != null}
        onClose={() => setEditing(null)}
        title="Вопрос"
        onSave={() => { if (editing) { upsertFaq(editing); setEditing(null); } }}>
        {editing && (
          <div className="field-grid">
            <Field label="Вопрос" full>
              <input className="input" value={editing.q} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditing({ ...editing, q: e.target.value })} />
            </Field>
            <Field label="Ответ" full>
              <textarea className="textarea" rows={6} value={editing.a} onChange={(e) => setEditing({ ...editing, a: e.target.value })} />
            </Field>
          </div>
        )}
      </Drawer>
    </>
  );
};
