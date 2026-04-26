import { useState, type ChangeEvent } from 'react';
import { Drawer, EmptyState, Field, RowActions, SectionHeader } from './EditorShell';
import { useCrm } from '../crm/CrmProvider';
import type { Car } from '../crm/types';

const blankCar = (id: string): Car => ({
  id, brand: '', model: '', year: new Date().getFullYear(),
  country: 'jp', mileage: '', body: 'SUV', drive: 'AWD',
  fuel: 'Бензин', transmission: 'Автомат',
  price: '', priceLocal: '',
  badges: [],
  accent: 'coral',
  eta: '', spec: '',
  img: '',
});

export const CarsAdmin = () => {
  const { state, upsertCar, deleteCar, newId } = useCrm();
  const [editing, setEditing] = useState<Car | null>(null);

  const startNew = () => setEditing(blankCar(newId('car')));
  const startEdit = (c: Car) => setEditing({ ...c });
  const save = () => {
    if (!editing) return;
    if (!editing.brand.trim() || !editing.model.trim()) {
      alert('Укажите марку и модель');
      return;
    }
    upsertCar(editing);
    setEditing(null);
  };

  return (
    <>
      <SectionHeader
        title="Каталог машин"
        subtitle="Добавляйте и редактируйте автомобили — они появятся в каталоге сайта."
        onAdd={startNew}
        addLabel="Новая машина"
      />

      {state.cars.length === 0 ? (
        <EmptyState message="Машин пока нет. Нажмите «Новая машина», чтобы добавить первую." />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Машина</th>
                <th>Год</th>
                <th>Страна</th>
                <th>Цена</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.cars.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 64, height: 40, background: 'var(--ink-3)', overflow: 'hidden', flexShrink: 0 }}>
                        {c.img && <img src={c.img} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontStyle: 'italic' }}>{c.brand} {c.model}</div>
                        <div style={{ fontSize: 12, color: 'var(--mute)' }}>{c.spec}</div>
                      </div>
                    </div>
                  </td>
                  <td>{c.year}</td>
                  <td style={{ textTransform: 'uppercase' }} className="mono">{c.country}</td>
                  <td style={{ color: c.accent === 'coral' ? 'var(--coral)' : 'var(--cyan)', fontWeight: 700, fontStyle: 'italic' }}>{c.price}</td>
                  <td><span style={{ fontSize: 12, color: 'var(--mute)' }}>{c.eta}</span></td>
                  <td><RowActions onEdit={() => startEdit(c)} onDelete={() => deleteCar(c.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={editing != null}
        onClose={() => setEditing(null)}
        title={state.cars.find((c) => editing && c.id === editing.id) ? 'Редактирование' : 'Новая машина'}
        onSave={save}>
        {editing && <CarForm car={editing} onChange={setEditing} />}
      </Drawer>
    </>
  );
};

const CarForm = ({ car, onChange }: { car: Car; onChange: (c: Car) => void }) => {
  const upd = <K extends keyof Car>(k: K) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    onChange({ ...car, [k]: k === 'year' ? Number(value) : value } as Car);
  };
  const setBadges = (e: ChangeEvent<HTMLInputElement>) => onChange({ ...car, badges: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) });

  return (
    <div className="field-grid">
      <Field label="Марка"><input className="input" value={car.brand} onChange={upd('brand')} /></Field>
      <Field label="Модель"><input className="input" value={car.model} onChange={upd('model')} /></Field>
      <Field label="Год"><input className="input" type="number" value={car.year} onChange={upd('year')} /></Field>
      <Field label="Страна">
        <select className="input" value={car.country} onChange={upd('country')}>
          <option value="jp">🇯🇵 Япония</option>
          <option value="cn">🇨🇳 Китай</option>
          <option value="kr">🇰🇷 Корея</option>
        </select>
      </Field>
      <Field label="Кузов"><input className="input" value={car.body} onChange={upd('body')} /></Field>
      <Field label="Привод"><input className="input" value={car.drive} onChange={upd('drive')} /></Field>
      <Field label="Топливо"><input className="input" value={car.fuel} onChange={upd('fuel')} /></Field>
      <Field label="КПП"><input className="input" value={car.transmission} onChange={upd('transmission')} /></Field>
      <Field label="Пробег"><input className="input" value={car.mileage} onChange={upd('mileage')} placeholder="12 000 км" /></Field>
      <Field label="Спецификация"><input className="input" value={car.spec} onChange={upd('spec')} placeholder="3.5 V6 · 415 л.с." /></Field>
      <Field label="Цена ₽"><input className="input" value={car.price} onChange={upd('price')} placeholder="14 800 000 ₽" /></Field>
      <Field label="Цена в стране"><input className="input" value={car.priceLocal} onChange={upd('priceLocal')} placeholder="¥ 21,400,000" /></Field>
      <Field label="Срок / статус" full><input className="input" value={car.eta} onChange={upd('eta')} placeholder="Доставка 28 апр." /></Field>
      <Field label="Бейджи (через запятую)" full><input className="input" value={car.badges.join(', ')} onChange={setBadges} placeholder="В пути, Premium" /></Field>
      <Field label="Акцент">
        <select className="input" value={car.accent} onChange={upd('accent')}>
          <option value="coral">Coral</option>
          <option value="cyan">Cyan</option>
        </select>
      </Field>
      <Field label="ID" ><input className="input" value={car.id} disabled /></Field>
      <Field label="URL изображения" full><input className="input" value={car.img} onChange={upd('img')} placeholder="https://..." /></Field>
      {car.img && (
        <Field label="Превью" full>
          <img src={car.img} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', border: '1px solid var(--line)' }} />
        </Field>
      )}
    </div>
  );
};
