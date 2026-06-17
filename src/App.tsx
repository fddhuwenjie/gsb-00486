import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Recipes from '@/pages/Recipes';
import RecipeDetail from '@/pages/RecipeDetail';
import CreateRecipe from '@/pages/CreateRecipe';
import MealPlan from '@/pages/MealPlan';
import ShoppingList from '@/pages/ShoppingList';
import NutritionPage from '@/pages/NutritionPage';
import Profile from '@/pages/Profile';
import Recommend from '@/pages/Recommend';
import CookingMode from '@/pages/CookingMode';
import PriceDashboard from '@/pages/PriceDashboard';
import Collections from '@/pages/Collections';
import CollectionDetail from '@/pages/CollectionDetail';
import Challenges from '@/pages/Challenges';
import ChallengeDetail from '@/pages/ChallengeDetail';
import SettingsPage from '@/pages/SettingsPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/cooking/:id" element={<CookingMode />} />
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/recipes" element={<Recipes />} />
                <Route path="/recipes/:id" element={<RecipeDetail />} />
                <Route path="/create-recipe" element={<CreateRecipe />} />
                <Route path="/edit-recipe/:id" element={<CreateRecipe />} />
                <Route path="/meal-plan" element={<MealPlan />} />
                <Route path="/shopping" element={<ShoppingList />} />
                <Route path="/nutrition" element={<NutritionPage />} />
                <Route path="/profile/:id" element={<Profile />} />
                <Route path="/recommend" element={<Recommend />} />
                <Route path="/prices" element={<PriceDashboard />} />
                <Route path="/collections" element={<Collections />} />
                <Route path="/collections/:id" element={<CollectionDetail />} />
                <Route path="/challenges" element={<Challenges />} />
                <Route path="/challenges/:id" element={<ChallengeDetail />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </Router>
  );
}
