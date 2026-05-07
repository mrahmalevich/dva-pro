import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Car, CrmState, FaqItem, FeedItem, Lead, Review, SiteSettings, TimelineStep } from './types';
import { SEED } from './seed';

const STORAGE_KEY = 'dvapro:crm:v1';

function loadInitialState(): CrmState {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as Partial<CrmState>;
    return {
      cars: parsed.cars ?? SEED.cars,
      timeline: parsed.timeline ?? SEED.timeline,
      faq: parsed.faq ?? SEED.faq,
      reviews: parsed.reviews ?? SEED.reviews,
      feed: parsed.feed ?? SEED.feed,
      inTransit: parsed.inTransit ?? SEED.inTransit,
      settings: { ...SEED.settings, ...(parsed.settings ?? {}) },
      leads: parsed.leads ?? SEED.leads,
    };
  } catch {
    return SEED;
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

interface CrmContextValue {
  state: CrmState;
  // Cars
  upsertCar: (car: Car) => void;
  deleteCar: (id: string) => void;
  // Timeline
  upsertTimelineStep: (step: TimelineStep) => void;
  deleteTimelineStep: (id: string) => void;
  // FAQ
  upsertFaq: (item: FaqItem) => void;
  deleteFaq: (id: string) => void;
  // Reviews
  upsertReview: (item: Review) => void;
  deleteReview: (id: string) => void;
  // Feed
  upsertFeedItem: (item: FeedItem) => void;
  deleteFeedItem: (id: string) => void;
  // Settings
  updateSettings: (patch: Partial<SiteSettings>) => void;
  // Leads
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'status'>) => Lead;
  updateLeadStatus: (id: string, status: Lead['status']) => void;
  deleteLead: (id: string) => void;
  // Reset
  resetToSeed: () => void;

  newId: (prefix: string) => string;
}

const CrmContext = createContext<CrmContextValue | null>(null);

export function CrmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CrmState>(() => loadInitialState());
  const isFirstWriteRef = useRef(true);

  useEffect(() => {
    if (isFirstWriteRef.current) {
      isFirstWriteRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota / private mode
    }
  }, [state]);

  const upsertById = useCallback(<T extends { id: string }>(list: T[], item: T): T[] => {
    const idx = list.findIndex((x) => x.id === item.id);
    if (idx === -1) return [...list, item];
    const next = list.slice();
    next[idx] = item;
    return next;
  }, []);

  const value = useMemo<CrmContextValue>(() => ({
    state,
    upsertCar: (car) => setState((s) => ({ ...s, cars: upsertById(s.cars, car) })),
    deleteCar: (id) => setState((s) => ({ ...s, cars: s.cars.filter((c) => c.id !== id) })),

    upsertTimelineStep: (step) => setState((s) => ({ ...s, timeline: upsertById(s.timeline, step) })),
    deleteTimelineStep: (id) => setState((s) => ({ ...s, timeline: s.timeline.filter((t) => t.id !== id) })),

    upsertFaq: (item) => setState((s) => ({ ...s, faq: upsertById(s.faq, item) })),
    deleteFaq: (id) => setState((s) => ({ ...s, faq: s.faq.filter((f) => f.id !== id) })),

    upsertReview: (item) => setState((s) => ({ ...s, reviews: upsertById(s.reviews, item) })),
    deleteReview: (id) => setState((s) => ({ ...s, reviews: s.reviews.filter((r) => r.id !== id) })),

    upsertFeedItem: (item) => setState((s) => ({ ...s, feed: upsertById(s.feed, item) })),
    deleteFeedItem: (id) => setState((s) => ({ ...s, feed: s.feed.filter((f) => f.id !== id) })),

    updateSettings: (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),

    addLead: (data) => {
      const lead: Lead = {
        ...data,
        id: makeId('lead'),
        createdAt: new Date().toISOString(),
        status: 'new',
      };
      setState((s) => ({ ...s, leads: [lead, ...s.leads] }));
      return lead;
    },
    updateLeadStatus: (id, status) =>
      setState((s) => ({ ...s, leads: s.leads.map((l) => (l.id === id ? { ...l, status } : l)) })),
    deleteLead: (id) => setState((s) => ({ ...s, leads: s.leads.filter((l) => l.id !== id) })),

    resetToSeed: () => {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
      setState(SEED);
    },

    newId: makeId,
  }), [state, upsertById]);

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm(): CrmContextValue {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error('useCrm must be used within CrmProvider');
  return ctx;
}
