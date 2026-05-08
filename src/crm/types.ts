export type Country = 'jp' | 'cn' | 'kr';
export type Accent = 'coral' | 'cyan';

export interface Car {
  id: string;
  brand: string;
  model: string;
  year: number;
  country: Country;
  mileage: string;
  body: string;
  drive: string;
  fuel: string;
  transmission: string;
  price: string;
  priceLocal: string;
  badges: string[];
  accent: Accent;
  eta: string;
  spec: string;
  img: string;
}

export interface TimelineStep {
  id: string;
  code: string;
  title: string;
  sub: string;
  dur: string;
}

export interface FaqItem {
  id: string;
  q: string;
  a: string;
}

export interface Review {
  id: string;
  name: string;
  city: string;
  car: string;
  text: string;
  rating: number;
  avatar: string;
  date: string;
  platform: 'yandex' | 'avito' | 'autoru';
}

export interface FeedItem {
  id: string;
  time: string;
  text: string;
  icon: 'truck' | 'shield' | 'sparkle' | 'doc' | 'check';
}

export interface SiteSettings {
  liveCount: string;
  totalDelivered: number;
  yearsOnMarket: number;
  avgDeliveryDays: number;
  satisfactionPct: number;
  phone: string;
  email: string;
  telegram: string;
  whatsapp: string;
  cities: string;
  founderRu: { name: string; surname: string; bio: string };
  founderKr: { name: string; surname: string; bio: string };
  brandQuote: string;
}

export interface Lead {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  tg: string;
  budgetMin: number;
  budgetMax: number;
  body: string[];
  condition: string | null;
  use: string | null;
  timing: string | null;
  status: 'new' | 'in-progress' | 'pdf-sent' | 'closed';
}

export interface InTransitItem {
  id: string;
  brand: string;
  model: string;
  country: Country;
  status: 'in-transit' | 'customs' | 'ready';
  statusLabel: string;
  eta: string;
  priceLandedRu: string;
  accent: Accent;
  img: string;
}

export interface CrmState {
  cars: Car[];
  timeline: TimelineStep[];
  faq: FaqItem[];
  reviews: Review[];
  feed: FeedItem[];
  inTransit: InTransitItem[];
  settings: SiteSettings;
  leads: Lead[];
}
