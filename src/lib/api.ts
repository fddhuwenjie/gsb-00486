const BASE_URL = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const userId = localStorage.getItem('userId');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };
  if (userId) {
    headers['x-user-id'] = userId;
  }

  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || '请求失败');
  }

  return data.data;
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    register: (username: string, password: string) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
    me: () => request('/auth/me'),
  },
  recipes: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/recipes${qs}`);
    },
    get: (id: number) => request<any>(`/recipes/${id}`),
    create: (data: any) => request('/recipes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/recipes/${id}`, { method: 'DELETE' }),
    categories: () => request<string[]>('/recipes/categories'),
    tags: () => request<string[]>('/recipes/tags'),
  },
  users: {
    profile: (id: number) => request<any>(`/users/profile/${id}`),
    recipes: (id: number) => request<any[]>(`/users/profile/${id}/recipes`),
    favorites: (id: number) => request<any[]>(`/users/profile/${id}/favorites`),
    follow: (id: number) => request(`/users/follow/${id}`, { method: 'POST' }),
    favorite: (id: number) => request(`/users/favorite/${id}`, { method: 'POST' }),
    createReview: (data: any) => request('/users/reviews', { method: 'POST', body: JSON.stringify(data) }),
    getReviews: (recipeId: number) => request<any[]>(`/users/reviews/${recipeId}`),
  },
  mealPlans: {
    current: () => request('/meal-plans/current'),
    updateItem: (data: any) => request('/meal-plans/item', { method: 'PUT', body: JSON.stringify(data) }),
    shoppingList: (planId: number) => request(`/meal-plans/shopping-list/${planId}`),
    saveShoppingList: (planId: number, items: any[]) =>
      request(`/meal-plans/shopping-list/${planId}/save`, { method: 'POST', body: JSON.stringify({ items }) }),
    savedShoppingList: (planId: number) => request(`/meal-plans/shopping-list/${planId}/saved`),
    exportShoppingList: (planId: number) => request(`/meal-plans/shopping-list/${planId}/export`),
    nutrition: (planId: number) => request(`/meal-plans/nutrition/${planId}`),
    templates: () => request('/meal-plans/templates'),
    saveTemplate: (data: any) => request('/meal-plans/templates', { method: 'POST', body: JSON.stringify(data) }),
    deleteTemplate: (id: number) => request(`/meal-plans/templates/${id}`, { method: 'DELETE' }),
  },
  recommendations: {
    personalized: () => request('/recommendations/personalized'),
    byIngredients: (ingredients: string[]) =>
      request('/recommendations/by-ingredients', { method: 'POST', body: JSON.stringify({ ingredients }) }),
    seasonal: () => request('/recommendations/seasonal'),
    popular: (limit?: number) => request(`/recommendations/popular${limit ? `?limit=${limit}` : ''}`),
  },
  nutrition: {
    ingredients: () => request('/nutrition/ingredients'),
    search: (q: string) => request(`/nutrition/ingredients/search?q=${encodeURIComponent(q)}`),
    calculateRecipe: (data: any) => request('/nutrition/calculate-recipe', { method: 'POST', body: JSON.stringify(data) }),
  },
  versions: {
    list: (recipeId: number) => request<any>(`/versions/recipe/${recipeId}`),
    get: (recipeId: number, versionNumber: number) =>
      request<any>(`/versions/recipe/${recipeId}/${versionNumber}`),
    fork: (recipeId: number) =>
      request<any>(`/versions/recipe/${recipeId}/fork`, { method: 'POST' }),
    forkSource: (recipeId: number) => request<any>(`/versions/fork-source/${recipeId}`),
  },
  prices: {
    list: () => request<any[]>('/prices'),
    history: (ingredientName: string) => request<any[]>(`/prices/history/${encodeURIComponent(ingredientName)}`),
    add: (data: any) => request('/prices', { method: 'POST', body: JSON.stringify(data) }),
    budget: () => request<any>('/prices/budget'),
    setBudget: (weeklyBudget: number) =>
      request('/prices/budget', { method: 'PUT', body: JSON.stringify({ weeklyBudget }) }),
    mealPlanCost: (planId: number) => request<any>(`/prices/meal-plan-cost/${planId}`),
  },
  collections: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any[]>(`/collections${qs}`);
    },
    get: (id: number) => request<any>(`/collections/${id}`),
    create: (data: any) => request('/collections', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request(`/collections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/collections/${id}`, { method: 'DELETE' }),
    addRecipe: (collectionId: number, recipeId: number) =>
      request(`/collections/${collectionId}/recipes`, {
        method: 'POST',
        body: JSON.stringify({ recipeId }),
      }),
    removeRecipe: (collectionId: number, recipeId: number) =>
      request(`/collections/${collectionId}/recipes/${recipeId}`, { method: 'DELETE' }),
  },
  challenges: {
    list: () => request<any[]>('/challenges'),
    get: (id: number) => request<any>(`/challenges/${id}`),
    create: (data: any) => request('/challenges', { method: 'POST', body: JSON.stringify(data) }),
    join: (id: number) => request(`/challenges/${id}/join`, { method: 'POST' }),
    submit: (id: number, data: any) =>
      request(`/challenges/${id}/submit`, { method: 'POST', body: JSON.stringify(data) }),
    ranking: (id: number) => request<any[]>(`/challenges/${id}/ranking`),
  },
  translations: {
    list: (recipeId: number) => request<any[]>(`/translations/recipe/${recipeId}`),
    get: (recipeId: number, lang: string) =>
      request<any>(`/translations/recipe/${recipeId}?lang=${lang}`),
    create: (recipeId: number, data: any) =>
      request(`/translations/recipe/${recipeId}`, { method: 'POST', body: JSON.stringify(data) }),
    update: (recipeId: number, lang: string, data: any) =>
      request(`/translations/recipe/${recipeId}/${lang}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (recipeId: number, lang: string) =>
      request(`/translations/recipe/${recipeId}/${lang}`, { method: 'DELETE' }),
  },
};
