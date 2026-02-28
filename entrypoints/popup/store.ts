import { createStore } from 'zustand/vanilla';
import { CachedResultSchema } from '../../lib/schemas';
import { z } from 'zod';

interface PopupState {
  state: 'idle' | 'loading' | 'result' | 'error' | 'rescanning';
  result: z.infer<typeof CachedResultSchema> | null;
  error: string | null;
  domain: string | null;
}

interface PopupActions {
  setLoading: (domain: string) => PopupActions;
  setResult: (result: z.infer<typeof CachedResultSchema>) => PopupActions;
  setError: (error: string) => PopupActions;
  setRescanning: () => PopupActions;
  reset: () => PopupActions;
}

export const popupStore = createStore<PopupState & PopupActions>()(
  (set, get) => ({
    state: 'idle',
    result: null,
    error: null,
    domain: null,
    
    setLoading: (domain) => { set({ state: 'loading', domain, error: null, result: null }); return get(); },
    setResult: (result) => { set({ state: 'result', result, error: null }); return get(); },
    setError: (error) => { set({ state: 'error', error }); return get(); },
    setRescanning: () => { set({ state: 'rescanning' }); return get(); },
    reset: () => { set({ state: 'idle', result: null, error: null, domain: null }); return get(); }
  })
);

export type PopupStore = typeof popupStore;