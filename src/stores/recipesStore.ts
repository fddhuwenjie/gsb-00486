import { create } from 'zustand';
import type { Recipe } from '@shared/types';

interface RecipesState {
  recipes: Recipe[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  filters: {
    category?: string;
    tag?: string;
    difficulty?: string;
    sort?: string;
    search?: string;
  };
  fetchRecipes: (filters?: Record<string, string>, page?: number) => Promise<void>;
  fetchRecipe: (id: number) => Promise<Recipe>;
  createRecipe: (data: any) => Promise<Recipe>;
  updateRecipe: (id: number, data: any) => Promise<Recipe>;
  deleteRecipe: (id: number) => Promise<void>;
  setFilters: (filters: Partial<RecipesState['filters']>) => void;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const userId = localStorage.getItem('userId');
  if (userId) headers['x-user-id'] = userId;
  return headers;
}

export const useRecipesStore = create<RecipesState>((set, get) => ({
  recipes: [],
  total: 0,
  page: 1,
  limit: 12,
  loading: false,
  filters: {},

  fetchRecipes: async (filters?: Record<string, string>, page = 1) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      const f = filters || get().filters;
      if (f.category) params.set('category', f.category);
      if (f.tag) params.set('tag', f.tag);
      if (f.difficulty) params.set('difficulty', f.difficulty);
      if (f.sort) params.set('sort', f.sort);
      if (f.search) params.set('search', f.search);
      params.set('page', String(page));
      params.set('limit', '12');

      const res = await fetch(`/api/recipes?${params.toString()}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        set({
          recipes: data.data.recipes,
          total: data.data.total,
          page: data.data.page,
          loading: false,
        });
      }
    } catch {
      set({ loading: false });
    }
  },

  fetchRecipe: async (id: number) => {
    const res = await fetch(`/api/recipes/${id}`, { headers: getHeaders() });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  },

  createRecipe: async (data: any) => {
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  updateRecipe: async (id: number, data: any) => {
    const res = await fetch(`/api/recipes/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  deleteRecipe: async (id: number) => {
    const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE', headers: getHeaders() });
    const result = await res.json();
    if (!result.success) throw new Error(result.error);
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
  },
}));
