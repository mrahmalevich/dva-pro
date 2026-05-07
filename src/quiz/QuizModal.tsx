import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Icon, Logo } from '../components/atoms';
import { useCrm } from '../crm/CrmProvider';
import { fmtRub, QUIZ, type QuizQuestion } from './quizSpec';

interface Answers {
  budget: [number, number];
  body: string[];
  condition: string | null;
  use: string | null;
  timing: string | null;
}

interface Contact {
  name: string;
  phone: string;
  email: string;
  tg: string;
}

const initialAnswers = (): Answers => ({
  budget: [3000000, 8000000],
  body: [],
  condition: null,
  use: null,
  timing: null,
});

export const QuizModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { addLead, state } = useCrm();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [contact, setContact] = useState<Contact>({ name: '', phone: '', email: '', tg: '' });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setSubmitted(false);
      setAnswers(initialAnswers());
      setContact({ name: '', phone: '', email: '', tg: '' });
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const total = QUIZ.length + 1;
  const progress = ((step + 1) / total) * 100;
  const isContact = step === QUIZ.length;
  const q = QUIZ[step];

  const canNext = (): boolean => {
    if (isContact) return Boolean(contact.name.trim() && contact.phone.trim() && (contact.email.trim() || contact.tg.trim()));
    if (!q) return false;
    if (q.type === 'budget') return true;
    if (q.type === 'multi') return answers.body.length > 0;
    return answers[q.id] != null;
  };

  const next = () => {
    if (isContact) {
      addLead({
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        tg: contact.tg,
        budgetMin: answers.budget[0],
        budgetMax: answers.budget[1],
        body: answers.body,
        condition: answers.condition,
        use: answers.use,
        timing: answers.timing,
      });
      setSubmitted(true);
      return;
    }
    setStep((s) => Math.min(QUIZ.length, s + 1));
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="quiz-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="quiz-card" role="dialog" aria-modal="true" aria-label="Анкета подбора авто">
        {!submitted ? (
          <>
            <div className="quiz-header">
              <Logo size={26} />
              <div className="quiz-progress">
                <div className="quiz-progress-bar" style={{ width: `${progress}%` }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--mute)', letterSpacing: '0.08em' }}>{step + 1} / {total}</span>
                <button onClick={onClose} aria-label="Закрыть" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line-strong)', color: '#fff', cursor: 'pointer', background: 'transparent' }}>
                  <Icon name="close" size={16} />
                </button>
              </div>
            </div>

            <div className="quiz-body">
              {q?.type === 'budget' && (
                <BudgetStep q={q} value={answers.budget} onChange={(v) => setAnswers((a) => ({ ...a, budget: v }))} />
              )}
              {q?.type === 'multi' && (
                <MultiStep q={q} value={answers.body} onChange={(v) => setAnswers((a) => ({ ...a, body: v }))} />
              )}
              {q?.type === 'single' && (
                <SingleStep q={q} value={answers[q.id] as string | null} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
              )}
              {isContact && <ContactStep contact={contact} setContact={setContact} answers={answers} />}
            </div>

            <div className="quiz-footer">
              <button className="btn btn-ghost" onClick={prev}
                style={{ opacity: step === 0 ? 0.4 : 1, pointerEvents: step === 0 ? 'none' : 'auto' }}>
                <Icon name="arrow-left" size={16} /> Назад
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  ESC — закрыть
                </span>
                <button className="btn btn-primary"
                  onClick={next}
                  disabled={!canNext()}>
                  {isContact ? 'Получить подборку' : 'Дальше'}
                  <Icon name="arrow-right" size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <SuccessStep onClose={onClose} contact={contact} telegramUrl={state.settings.telegram} whatsappUrl={state.settings.whatsapp} />
        )}
      </div>
    </div>
  );
};

const StepHeader = ({ q, idx }: { q: QuizQuestion; idx: number }) => (
  <div style={{ marginBottom: 36 }}>
    <div className="num-marker" style={{ marginBottom: 16, color: 'var(--coral)' }}>
      ШАГ {String(idx + 1).padStart(2, '0')} / {String(QUIZ.length).padStart(2, '0')}
    </div>
    <h2 className="h1" style={{ marginBottom: 12, fontSize: 'clamp(28px, 3.5vw, 48px)', color: '#fff' }}>{q.title}</h2>
    <p className="body-lg" style={{ color: 'var(--mute)', maxWidth: 580 }}>{q.sub}</p>
  </div>
);

const SingleStep = ({ q, value, onChange }: {
  q: Extract<QuizQuestion, { type: 'single' }>;
  value: string | null;
  onChange: (v: string) => void;
}) => {
  const idx = QUIZ.findIndex((x) => x.id === q.id);
  return (
    <div>
      <StepHeader q={q} idx={idx} />
      <div className={`opt-grid ${q.options.length > 4 ? 'three' : ''}`}>
        {q.options.map((o) => (
          <button key={o.v}
            type="button"
            className={`opt ${value === o.v ? 'is-selected' : ''}`}
            onClick={() => onChange(o.v)}>
            <span className="opt-icon">{o.emoji}</span>
            <span style={{ flex: 1 }}>{o.label}</span>
            <span className="opt-check">{value === o.v && <Icon name="check" size={14} stroke={3} />}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const MultiStep = ({ q, value, onChange }: {
  q: Extract<QuizQuestion, { type: 'multi' }>;
  value: string[];
  onChange: (v: string[]) => void;
}) => {
  const idx = QUIZ.findIndex((x) => x.id === q.id);
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div>
      <StepHeader q={q} idx={idx} />
      <div className="opt-grid three">
        {q.options.map((o) => (
          <button key={o.v}
            type="button"
            className={`opt ${value.includes(o.v) ? 'is-selected' : ''}`}
            onClick={() => toggle(o.v)}>
            <span className="opt-icon">{o.emoji}</span>
            <span style={{ flex: 1 }}>{o.label}</span>
            <span className="opt-check">{value.includes(o.v) && <Icon name="check" size={14} stroke={3} />}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const BudgetStep = ({ q, value, onChange }: {
  q: Extract<QuizQuestion, { type: 'budget' }>;
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) => {
  const idx = QUIZ.findIndex((x) => x.id === q.id);
  const [lo, hi] = value;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'lo' | 'hi' | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const pctOf = (v: number) => ((v - q.min) / (q.max - q.min)) * 100;
  const setLo = useCallback((v: number) => {
    const [, currentHi] = valueRef.current;
    onChange([Math.min(v, currentHi - q.step), currentHi]);
  }, [q.step, onChange]);
  const setHi = useCallback((v: number) => {
    const [currentLo] = valueRef.current;
    onChange([currentLo, Math.max(v, currentLo + q.step)]);
  }, [q.step, onChange]);

  useEffect(() => {
    const onMove = (clientX: number) => {
      if (!dragging.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const raw = q.min + pct * (q.max - q.min);
      const snapped = Math.round(raw / q.step) * q.step;
      if (dragging.current === 'lo') setLo(snapped);
      else setHi(snapped);
    };
    const onMouse = (e: MouseEvent) => onMove(e.clientX);
    const onTouch = (e: TouchEvent) => { if (e.touches[0]) onMove(e.touches[0].clientX); };
    const stop = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchend', stop);
    };
  }, [q.min, q.max, q.step, setLo, setHi]);

  const presets: [number, number, string][] = [
    [2000000, 4000000, 'до 4 млн'],
    [4000000, 8000000, '4–8 млн'],
    [8000000, 15000000, '8–15 млн'],
    [15000000, 25000000, 'премиум'],
  ];

  return (
    <div>
      <StepHeader q={q} idx={idx} />
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 36, border: '1px solid var(--line-strong)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div>
            <div className="num-marker" style={{ marginBottom: 4 }}>От</div>
            <div style={{ fontWeight: 900, fontStyle: 'italic', fontSize: 36, color: '#fff', letterSpacing: '-0.03em' }}>{fmtRub(lo)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="num-marker" style={{ marginBottom: 4 }}>До</div>
            <div style={{ fontWeight: 900, fontStyle: 'italic', fontSize: 36, color: 'var(--coral)', letterSpacing: '-0.03em' }}>{fmtRub(hi)}</div>
          </div>
        </div>

        <div className="range-track" ref={trackRef}>
          <div className="range-fill" style={{ left: `${pctOf(lo)}%`, right: `${100 - pctOf(hi)}%` }} />
          <div
            className="range-knob"
            style={{ left: `${pctOf(lo)}%` }}
            role="slider"
            aria-label="Минимум бюджета"
            aria-valuenow={lo}
            aria-valuemin={q.min}
            aria-valuemax={q.max}
            tabIndex={0}
            onMouseDown={() => { dragging.current = 'lo'; }}
            onTouchStart={() => { dragging.current = 'lo'; }} />
          <div
            className="range-knob"
            style={{ left: `${pctOf(hi)}%` }}
            role="slider"
            aria-label="Максимум бюджета"
            aria-valuenow={hi}
            aria-valuemin={q.min}
            aria-valuemax={q.max}
            tabIndex={0}
            onMouseDown={() => { dragging.current = 'hi'; }}
            onTouchStart={() => { dragging.current = 'hi'; }} />
        </div>

        <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mute)', letterSpacing: '0.08em' }}>
          <span>{fmtRub(q.min)}</span>
          <span>{fmtRub(q.max)}+</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, marginTop: 28, background: 'var(--line)' }}>
          {presets.map(([a, b, label]) => (
            <button key={label}
              type="button"
              className={`opt ${lo === a && hi === b ? 'is-selected' : ''}`}
              style={{ padding: '14px 12px', fontSize: 13, justifyContent: 'center' }}
              onClick={() => onChange([a, b])}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const ContactStep = ({ contact, setContact, answers }: {
  contact: Contact;
  setContact: (fn: (c: Contact) => Contact) => void;
  answers: Answers;
}) => {
  const upd = (k: keyof Contact) => (e: ChangeEvent<HTMLInputElement>) => setContact((c) => ({ ...c, [k]: e.target.value }));
  const summary = [
    `Бюджет: ${fmtRub(answers.budget[0])} – ${fmtRub(answers.budget[1])}`,
    answers.body.length ? `Кузов: ${answers.body.length} типов` : null,
    answers.condition ? `Состояние: ${answers.condition === 'new' ? 'новый' : 'с пробегом'}` : null,
    answers.use ? `Цель: ${answers.use}` : null,
    answers.timing ? `Срок: ${answers.timing}` : null,
  ].filter(Boolean) as string[];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div className="num-marker" style={{ marginBottom: 16, color: 'var(--cyan)' }}>ПОСЛЕДНИЙ ШАГ</div>
        <h2 className="h1" style={{ marginBottom: 12, fontSize: 'clamp(28px, 3.5vw, 48px)', color: '#fff' }}>
          Куда отправить подборку?
        </h2>
        <p className="body-lg" style={{ color: 'var(--mute)', maxWidth: 580 }}>
          Соберём <b style={{ color: '#fff' }}>персональный PDF</b> с&nbsp;6–8&nbsp;авто под&nbsp;ваши параметры. Цены под&nbsp;ключ, сроки доставки, фото и&nbsp;характеристики.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <input className="input" placeholder="Как вас зовут?" value={contact.name} onChange={upd('name')} style={{ gridColumn: '1 / -1' }} />
        <input className="input" placeholder="+7 ___ ___-__-__" value={contact.phone} onChange={upd('phone')} />
        <input className="input" placeholder="Email (необязательно)" value={contact.email} onChange={upd('email')} />
        <input className="input" placeholder="Telegram / WhatsApp @username" value={contact.tg} onChange={upd('tg')} style={{ gridColumn: '1 / -1' }} />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18, alignItems: 'flex-start', color: 'var(--mute)' }}>
        <Icon name="shield" size={16} />
        <p className="small" style={{ margin: 0, lineHeight: 1.5 }}>
          Ваши данные не&nbsp;передаются третьим лицам. Никакого спама&nbsp;— только подборка и&nbsp;ответы Дениса лично.
        </p>
      </div>

      {summary.length > 0 && (
        <div className="mono" style={{ marginTop: 28, padding: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--mute)', letterSpacing: '0.06em' }}>
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: 8, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Ваш запрос</div>
          {summary.join(' · ')}
        </div>
      )}
    </div>
  );
};

const SuccessStep = ({ onClose, contact, telegramUrl, whatsappUrl }: {
  onClose: () => void;
  contact: Contact;
  telegramUrl: string;
  whatsappUrl: string;
}) => {
  const [secs, setSecs] = useState(300);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(secs / 60));
  const ss = String(secs % 60).padStart(2, '0');

  return (
    <div style={{ padding: '72px 56px', textAlign: 'center', minHeight: 520, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        width: 96, height: 96, borderRadius: '50%',
        background: 'linear-gradient(135deg, #25D366, #1da350)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 32, color: '#fff',
        boxShadow: '0 20px 60px -10px rgba(37,211,102,0.5)',
      }}>
        <Icon name="check" size={44} stroke={3} />
      </div>
      <h2 className="h1" style={{ marginBottom: 16, fontSize: 'clamp(32px, 4vw, 56px)', color: '#fff' }}>
        Готовим подборку,<br />
        <span style={{ color: 'var(--coral)' }}>{contact.name || 'друг'}</span>
      </h2>
      <p className="body-lg" style={{ color: 'var(--mute)', maxWidth: 540, marginBottom: 32 }}>
        Денис уже забирает заявку. Через <b style={{ color: '#fff' }}>5&nbsp;минут</b> в&nbsp;Telegram придёт PDF с&nbsp;6–8&nbsp;машинами под&nbsp;ваши параметры — с&nbsp;ценами под&nbsp;ключ и&nbsp;сроками.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
        <a className="btn btn-cyan" style={{ background: '#229ED9' }} href={telegramUrl} target="_blank" rel="noreferrer">
          <Icon name="tg" size={16} /> Открыть Telegram
        </a>
        <a className="btn btn-ghost" href={whatsappUrl} target="_blank" rel="noreferrer">
          <Icon name="wa" size={16} /> WhatsApp
        </a>
      </div>

      <div className="mono" style={{
        display: 'inline-flex', alignItems: 'center', gap: 14,
        padding: '14px 22px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--line-strong)',
        fontSize: 12, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        <span className="dot" />
        Ответ менеджера: <b style={{ color: '#fff' }}>{mm}:{ss}</b>
      </div>

      <button className="linkx" onClick={onClose} style={{ marginTop: 40, fontSize: 14, color: 'var(--mute)', cursor: 'pointer' }}>
        Вернуться на сайт
      </button>
    </div>
  );
};
