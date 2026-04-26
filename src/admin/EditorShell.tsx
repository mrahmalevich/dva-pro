import type { ReactNode } from 'react';
import { Icon } from '../components/atoms';

export const SectionHeader = ({ title, subtitle, onAdd, addLabel = 'Добавить' }: {
  title: string;
  subtitle?: string;
  onAdd?: () => void;
  addLabel?: string;
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
    <div>
      <h2 className="h2" style={{ fontSize: 32 }}>{title}</h2>
      {subtitle && <p style={{ color: 'var(--mute)', marginTop: 8, fontSize: 14 }}>{subtitle}</p>}
    </div>
    {onAdd && (
      <button className="btn btn-coral" onClick={onAdd}>
        <Icon name="plus" size={16} /> {addLabel}
      </button>
    )}
  </div>
);

export const Drawer = ({ open, onClose, title, children, onSave, saveLabel = 'Сохранить' }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSave?: () => void;
  saveLabel?: string;
}) => {
  if (!open) return null;
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(12px)',
        display: 'flex', justifyContent: 'flex-end',
      }}>
      <div style={{
        width: '100%', maxWidth: 640,
        background: 'var(--ink-1)',
        borderLeft: '1px solid var(--line-strong)',
        display: 'flex', flexDirection: 'column',
        animation: 'pop-in .35s cubic-bezier(.2,.7,.2,1)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="h3" style={{ fontStyle: 'italic' }}>{title}</h3>
          <button onClick={onClose} className="btn-icon" aria-label="Закрыть"><Icon name="close" size={16} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
        {onSave && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
            <button className="btn btn-primary" onClick={onSave}>
              <Icon name="save" size={16} /> {saveLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const Field = ({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) => (
  <div className={`field ${full ? 'field-full' : ''}`}>
    <label>{label}</label>
    {children}
  </div>
);

export const RowActions = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => (
  <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
    <button className="btn-icon" onClick={onEdit} aria-label="Редактировать"><Icon name="edit" size={14} /></button>
    <button
      className="btn-icon danger"
      onClick={() => { if (confirm('Удалить?')) onDelete(); }}
      aria-label="Удалить">
      <Icon name="trash" size={14} />
    </button>
  </div>
);

export const EmptyState = ({ message }: { message: string }) => (
  <div style={{ padding: 64, textAlign: 'center', color: 'var(--mute)', border: '1px dashed var(--line-strong)' }}>
    {message}
  </div>
);
