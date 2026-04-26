import { useState, type ChangeEvent } from 'react';
import { Drawer, EmptyState, Field, RowActions, SectionHeader } from './EditorShell';
import { useCrm } from '../crm/CrmProvider';
import type { TimelineStep } from '../crm/types';

const blank = (id: string, code: string): TimelineStep => ({ id, code, title: '', sub: '', dur: '' });

export const TimelineAdmin = () => {
  const { state, upsertTimelineStep, deleteTimelineStep, newId } = useCrm();
  const [editing, setEditing] = useState<TimelineStep | null>(null);

  const startNew = () => {
    const next = String(state.timeline.length + 1).padStart(2, '0');
    setEditing(blank(newId('step'), next));
  };

  return (
    <>
      <SectionHeader title="Шаги процесса" subtitle="Шесть шагов «от заявки до ключей» в секции Process." onAdd={startNew} addLabel="Новый шаг" />
      {state.timeline.length === 0 ? (
        <EmptyState message="Шагов пока нет." />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Код</th><th>Заголовок</th><th>Длительность</th><th>Описание</th><th /></tr>
            </thead>
            <tbody>
              {state.timeline.map((t) => (
                <tr key={t.id}>
                  <td className="mono" style={{ color: 'var(--coral)', fontWeight: 700 }}>{t.code}</td>
                  <td style={{ fontStyle: 'italic', fontWeight: 700 }}>{t.title}</td>
                  <td className="mono small" style={{ color: 'var(--mute)' }}>{t.dur}</td>
                  <td style={{ color: 'var(--mute)', maxWidth: 480 }}>{t.sub}</td>
                  <td><RowActions onEdit={() => setEditing({ ...t })} onDelete={() => deleteTimelineStep(t.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={editing != null}
        onClose={() => setEditing(null)}
        title="Шаг процесса"
        onSave={() => { if (editing) { upsertTimelineStep(editing); setEditing(null); } }}>
        {editing && <Form step={editing} onChange={setEditing} />}
      </Drawer>
    </>
  );
};

const Form = ({ step, onChange }: { step: TimelineStep; onChange: (s: TimelineStep) => void }) => {
  const upd = <K extends keyof TimelineStep>(k: K) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...step, [k]: e.target.value });
  return (
    <div className="field-grid">
      <Field label="Код"><input className="input" value={step.code} onChange={upd('code')} placeholder="01" /></Field>
      <Field label="Длительность"><input className="input" value={step.dur} onChange={upd('dur')} placeholder="День 0" /></Field>
      <Field label="Заголовок" full><input className="input" value={step.title} onChange={upd('title')} /></Field>
      <Field label="Описание" full><textarea className="textarea" value={step.sub} onChange={upd('sub')} /></Field>
    </div>
  );
};
