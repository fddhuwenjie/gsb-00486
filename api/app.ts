/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import recipeRoutes from './routes/recipes.js'
import userRoutes from './routes/users.js'
import mealPlanRoutes from './routes/mealplans.js'
import recommendationRoutes from './routes/recommendations.js'
import nutritionRoutes from './routes/nutrition.js'
import versionRoutes from './routes/versions.js'
import priceRoutes from './routes/prices.js'
import collectionRoutes from './routes/collections.js'
import challengeRoutes from './routes/challenges.js'
import translationRoutes from './routes/translations.js'
import { initDatabase } from './initDb.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

// init database
initDatabase()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/recipes', recipeRoutes)
app.use('/api/users', userRoutes)
app.use('/api/meal-plans', mealPlanRoutes)
app.use('/api/recommendations', recommendationRoutes)
app.use('/api/nutrition', nutritionRoutes)
app.use('/api/versions', versionRoutes)
app.use('/api/prices', priceRoutes)
app.use('/api/collections', collectionRoutes)
app.use('/api/challenges', challengeRoutes)
app.use('/api/translations', translationRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
