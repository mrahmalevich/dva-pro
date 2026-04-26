export type QuizQuestion =
  | { id: 'budget'; type: 'budget'; title: string; sub: string; min: number; max: number; step: number; defaultRange: [number, number] }
  | { id: 'body'; type: 'multi'; title: string; sub: string; options: { v: string; label: string; emoji: string }[] }
  | { id: 'condition' | 'use' | 'timing'; type: 'single'; title: string; sub: string; options: { v: string; label: string; emoji: string }[] };

export const QUIZ: QuizQuestion[] = [
  {
    id: 'budget',
    type: 'budget',
    title: 'Какой бюджет рассматриваете?',
    sub: 'Под ключ, с доставкой и оформлением. Подберём оптимальный вариант.',
    min: 1500000, max: 25000000, step: 100000,
    defaultRange: [3000000, 8000000],
  },
  {
    id: 'body',
    type: 'multi',
    title: 'Какой тип кузова интересен?',
    sub: 'Можно выбрать несколько.',
    options: [
      { v: 'sedan', label: 'Седан', emoji: '🚘' },
      { v: 'suv', label: 'SUV / Кроссовер', emoji: '🚙' },
      { v: 'coupe', label: 'Купе / Кабриолет', emoji: '🏎️' },
      { v: 'minivan', label: 'Минивэн', emoji: '🚐' },
      { v: 'pickup', label: 'Пикап', emoji: '🛻' },
      { v: 'wagon', label: 'Универсал', emoji: '🚖' },
    ],
  },
  {
    id: 'condition',
    type: 'single',
    title: 'Новый или с пробегом?',
    sub: 'У нас прозрачный отчёт по каждой машине.',
    options: [
      { v: 'new', label: 'Только новый', emoji: '✨' },
      { v: 'lo', label: 'С пробегом до 30 000 км', emoji: '⚡' },
      { v: 'mid', label: 'С пробегом до 80 000 км', emoji: '🔧' },
      { v: 'any', label: 'Не принципиально — главное состояние', emoji: '👌' },
    ],
  },
  {
    id: 'use',
    type: 'single',
    title: 'Для чего будет использоваться?',
    sub: 'Это поможет подобрать комплектацию и ходовые характеристики.',
    options: [
      { v: 'city', label: 'Каждый день в городе', emoji: '🏙️' },
      { v: 'family', label: 'Семья, поездки за город', emoji: '👨‍👩‍👧‍👦' },
      { v: 'status', label: 'Статус, бизнес-встречи', emoji: '🎩' },
      { v: 'offroad', label: 'Бездорожье, путешествия', emoji: '⛰️' },
      { v: 'sport', label: 'Драйв и удовольствие', emoji: '🏁' },
    ],
  },
  {
    id: 'timing',
    type: 'single',
    title: 'Когда нужен автомобиль?',
    sub: 'У нас есть машины в наличии и под заказ.',
    options: [
      { v: 'now', label: 'Уже вчера', emoji: '⚡' },
      { v: '1m', label: 'В течение месяца', emoji: '📅' },
      { v: '3m', label: 'Спокойно жду 1–3 месяца', emoji: '🌱' },
      { v: 'browse', label: 'Просто смотрю варианты', emoji: '👀' },
    ],
  },
];

export const fmtRub = (n: number) => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
