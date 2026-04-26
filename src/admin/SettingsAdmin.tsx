import { type ChangeEvent } from 'react';
import { Field, SectionHeader } from './EditorShell';
import { useCrm } from '../crm/CrmProvider';
import type { SiteSettings } from '../crm/types';

export const SettingsAdmin = () => {
  const { state, updateSettings } = useCrm();
  const s = state.settings;

  const upd = <K extends keyof SiteSettings>(k: K) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    const isNum = ['totalDelivered', 'yearsOnMarket', 'avgDeliveryDays', 'satisfactionPct'].includes(k);
    updateSettings({ [k]: isNum ? Number(value) : value } as Partial<SiteSettings>);
  };

  const updFounder = (who: 'founderRu' | 'founderKr', field: keyof SiteSettings['founderRu']) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      updateSettings({ [who]: { ...s[who], [field]: e.target.value } });
    };

  return (
    <>
      <SectionHeader title="Настройки сайта" subtitle="Основные параметры, числа в hero, контакты, основатели." />
      <div className="field-grid">
        <Field label="Авто в пути (badge)"><input className="input" value={s.liveCount} onChange={upd('liveCount')} /></Field>
        <Field label="Всего доставлено"><input className="input" type="number" value={s.totalDelivered} onChange={upd('totalDelivered')} /></Field>
        <Field label="Лет на рынке"><input className="input" type="number" value={s.yearsOnMarket} onChange={upd('yearsOnMarket')} /></Field>
        <Field label="Средние дни доставки"><input className="input" type="number" value={s.avgDeliveryDays} onChange={upd('avgDeliveryDays')} /></Field>
        <Field label="% довольных"><input className="input" type="number" value={s.satisfactionPct} onChange={upd('satisfactionPct')} /></Field>
        <Field label="Города (через ·)" full><input className="input" value={s.cities} onChange={upd('cities')} /></Field>

        <Field label="Телефон"><input className="input" value={s.phone} onChange={upd('phone')} /></Field>
        <Field label="Email"><input className="input" value={s.email} onChange={upd('email')} /></Field>
        <Field label="Telegram URL"><input className="input" value={s.telegram} onChange={upd('telegram')} /></Field>
        <Field label="WhatsApp URL"><input className="input" value={s.whatsapp} onChange={upd('whatsapp')} /></Field>

        <Field label="Имя · Россия"><input className="input" value={s.founderRu.name} onChange={updFounder('founderRu', 'name')} /></Field>
        <Field label="Фамилия · Россия"><input className="input" value={s.founderRu.surname} onChange={updFounder('founderRu', 'surname')} /></Field>
        <Field label="Био · Россия" full><textarea className="textarea" value={s.founderRu.bio} onChange={updFounder('founderRu', 'bio')} /></Field>

        <Field label="Имя · Корея"><input className="input" value={s.founderKr.name} onChange={updFounder('founderKr', 'name')} /></Field>
        <Field label="Фамилия · Корея"><input className="input" value={s.founderKr.surname} onChange={updFounder('founderKr', 'surname')} /></Field>
        <Field label="Био · Корея" full><textarea className="textarea" value={s.founderKr.bio} onChange={updFounder('founderKr', 'bio')} /></Field>

        <Field label="Цитата основателей" full><textarea className="textarea" rows={4} value={s.brandQuote} onChange={upd('brandQuote')} /></Field>
      </div>
      <p className="mono small" style={{ color: 'var(--mute)', marginTop: 24, letterSpacing: '0.08em' }}>
        Изменения сохраняются автоматически в localStorage.
      </p>
    </>
  );
};
