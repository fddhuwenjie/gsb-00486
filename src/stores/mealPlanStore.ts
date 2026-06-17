import { create } from 'zustand';
import type { MealPlan, ShoppingItem, MealPlanTemplate, WeeklyNutrition } from '@shared/types';

interface MealPlanState {
  planId: number | null;
  weekStartDate: string;
  plan: MealPlan;
  shoppingList: ShoppingItem[];
  savedShoppingList: ShoppingItem[] | null;
  totalPrice: number;
  nutrition: (WeeklyNutrition & { warnings?: string[] }) | null;
  templates: MealPlanTemplate[];
  loading: boolean;
  fetchCurrentPlan: () => Promise<void>;
  updateItem: (day: number, mealType: string, data: any) => Promise<void>;
  fetchShoppingList: () => Promise<void>;
  saveShoppingList: (items: ShoppingItem[]) => Promise<void>;
  fetchSavedShoppingList: () => Promise<void>;
  exportShoppingList: () => Promise<string>;
  fetchNutrition: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  saveTemplate: (name: string, plan: MealPlan) => Promise<void>;
  deleteTemplate: (id: number) => Promise<void>;
  applyTemplate: (templateId: number) => Promise<void>;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const userId = localStorage.getItem('userId');
  if (userId) headers['x-user-id'] = userId;
  return headers;
}

export const useMealPlanStore = create<MealPlanState>((set, get) => ({
  planId: null,
  weekStartDate: '',
  plan: {},
  shoppingList: [],
  savedShoppingList: null,
  totalPrice: 0,
  nutrition: null,
  templates: [],
  loading: false,

  fetchCurrentPlan: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/meal-plans/current', { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        set({
          planId: data.data.id,
          weekStartDate: data.data.weekStartDate,
          plan: data.data.plan,
          loading: false,
        });
      }
    } catch {
      set({ loading: false });
    }
  },

  updateItem: async (day, mealType, data) => {
    const { planId } = get();
    if (!planId) return;
    const res = await fetch('/api/meal-plans/item', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ planId, day, mealType, ...data }),
    });
    const result = await res.json();
    if (result.success) {
      set({ plan: result.data });
    }
  },

  fetchShoppingList: async () => {
    const { planId } = get();
    if (!planId) return;
    const res = await fetch(`/api/meal-plans/shopping-list/${planId}`, { headers: getHeaders() });
    const data = await res.json();
    if (data.success) {
      set({ shoppingList: data.data.items, totalPrice: data.data.totalPrice });
    }
  },

  saveShoppingList: async (items) => {
    const { planId } = get();
    if (!planId) return;
    await fetch(`/api/meal-plans/shopping-list/${planId}/save`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ items }),
    });
  },

  fetchSavedShoppingList: async () => {
    const { planId } = get();
    if (!planId) return;
    const res = await fetch(`/api/meal-plans/shopping-list/${planId}/saved`, { headers: getHeaders() });
    const data = await res.json();
    if (data.success && data.data) {
      set({ savedShoppingList: data.data.items });
    }
  },

  exportShoppingList: async () => {
    const { planId } = get();
    if (!planId) return '';
    const res = await fetch(`/api/meal-plans/shopping-list/${planId}/export`, { headers: getHeaders() });
    const data = await res.json();
    return data.success ? data.data.text : '';
  },

  fetchNutrition: async () => {
    const { planId } = get();
    if (!planId) return;
    const res = await fetch(`/api/meal-plans/nutrition/${planId}`, { headers: getHeaders() });
    const data = await res.json();
    if (data.success) {
      set({ nutrition: data.data });
    }
  },

  fetchTemplates: async () => {
    const res = await fetch('/api/meal-plans/templates', { headers: getHeaders() });
    const data = await res.json();
    if (data.success) {
      set({ templates: data.data });
    }
  },

  saveTemplate: async (name, plan) => {
    await fetch('/api/meal-plans/templates', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, plan }),
    });
    get().fetchTemplates();
  },

  deleteTemplate: async (id) => {
    await fetch(`/api/meal-plans/templates/${id}`, { method: 'DELETE', headers: getHeaders() });
    get().fetchTemplates();
  },

  applyTemplate: async (templateId) => {
    const { planId } = get();
    if (!planId) return;
    const res = await fetch('/api/meal-plans/apply-template', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ planId, templateId }),
    });
    const result = await res.json();
    if (result.success) {
      set({ plan: result.data });
    }
  },
}));
