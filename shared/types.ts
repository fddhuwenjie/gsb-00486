export interface User {
  id: number;
  username: string;
  password: string;
  avatar: string;
  bio: string;
  createdAt: string;
}

export interface UserProfile {
  id: number;
  username: string;
  avatar: string;
  bio: string;
  recipeCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export interface Ingredient {
  id?: number;
  name: string;
  amount: number;
  unit: string;
}

export interface RecipeStep {
  id?: number;
  order: number;
  description: string;
  imageUrl: string;
}

export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Recipe {
  id: number;
  title: string;
  category: '中餐' | '西餐' | '日料' | '烘焙' | '饮品' | '汤羹';
  difficulty: '入门' | '中等' | '困难';
  cookTime: number;
  servings: number;
  tags: string[];
  coverImage: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  author: UserProfile;
  nutritionTotal: Nutrition;
  nutritionPerServing: Nutrition;
  rating: number;
  ratingCount: number;
  viewCount: number;
  isFavorite: boolean;
  createdAt: string;
}

export interface IngredientNutrition {
  id: number;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  pricePer100g: number;
}

export interface MealPlanItem {
  id: number;
  recipeId?: number;
  recipe?: Recipe;
  customTitle?: string;
  customIngredients?: Ingredient[];
}

export interface MealPlan {
  [day: number]: {
    breakfast?: MealPlanItem;
    lunch?: MealPlanItem;
    dinner?: MealPlanItem;
  };
}

export interface ShoppingItem {
  name: string;
  totalAmount: number;
  unit: string;
  category: string;
  estimatedPrice: number;
  purchased: boolean;
}

export interface MealPlanTemplate {
  id: number;
  name: string;
  plan: MealPlan;
  createdAt: string;
}

export interface Review {
  id: number;
  userId: number;
  user: UserProfile;
  recipeId: number;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface RecipeListResponse {
  recipes: Recipe[];
  total: number;
}

export interface WeeklyNutrition {
  dailyAverage: Nutrition;
  weeklyTotal: Nutrition;
  recommended: Nutrition;
}

export interface RecipeVersion {
  id: number;
  recipeId: number;
  versionNumber: number;
  changeDescription: string;
  ingredientsSnapshot: Ingredient[];
  stepsSnapshot: RecipeStep[];
  createdAt: string;
}

export interface ForkSource {
  id: number;
  title: string;
  coverImage: string;
  author: {
    id: number;
    username: string;
    avatar: string;
  };
}

export interface IngredientPrice {
  id: number;
  ingredientName: string;
  price: number;
  unit: string;
  marketName: string;
  recordedAt: string;
}

export interface UserBudget {
  weeklyBudget: number;
}

export interface Collection {
  id: number;
  name: string;
  description: string;
  coverImage: string;
  creator: {
    id: number;
    username: string;
    avatar: string;
  };
  isPublic: boolean;
  recipeCount: number;
  recipes?: Recipe[];
  createdAt: string;
}

export interface Challenge {
  id: number;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  rules: string;
  reward: string;
  participantCount: number;
  isParticipating?: boolean;
  mySubmissions?: ChallengeSubmission[];
  createdAt: string;
}

export interface ChallengeSubmission {
  recipeId: number | null;
  recipeTitle: string;
  submittedAt: string;
}

export interface ChallengeRankingItem {
  rank: number;
  userId: number;
  username: string;
  avatar: string;
  bio: string;
  submissionCount: number;
  submissions: ChallengeSubmission[];
}

export interface RecipeTranslation {
  id: number;
  recipeId: number;
  languageCode: string;
  translatedTitle: string;
  translatedSteps: RecipeStep[];
  createdAt: string;
  updatedAt: string;
}

export type UnitSystem = 'metric' | 'imperial';
export type Language = 'zh' | 'en';
