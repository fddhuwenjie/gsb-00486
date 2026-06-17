import db from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      cook_time INTEGER NOT NULL,
      servings INTEGER NOT NULL DEFAULT 1,
      cover_image TEXT DEFAULT '',
      author_id INTEGER NOT NULL,
      fork_from INTEGER DEFAULT NULL,
      rating REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id),
      FOREIGN KEY (fork_from) REFERENCES recipes(id)
    );

    CREATE TABLE IF NOT EXISTS recipe_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      version_number INTEGER NOT NULL DEFAULT 1,
      change_description TEXT DEFAULT '',
      ingredients_snapshot TEXT NOT NULL,
      steps_snapshot TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      UNIQUE(recipe_id, version_number)
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      unit TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recipe_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      step_order INTEGER NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recipe_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ingredient_nutrition (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      calories REAL NOT NULL DEFAULT 0,
      protein REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0,
      price_per_100g REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ingredient_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_name TEXT NOT NULL,
      price REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT '100g',
      market_name TEXT DEFAULT '',
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      weekly_budget REAL NOT NULL DEFAULT 200,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS meal_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT DEFAULT '本周膳食计划',
      week_start_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS meal_plan_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_plan_id INTEGER NOT NULL,
      day INTEGER NOT NULL,
      meal_type TEXT NOT NULL,
      recipe_id INTEGER,
      custom_title TEXT,
      custom_ingredients TEXT,
      FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id)
    );

    CREATE TABLE IF NOT EXISTS meal_plan_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      plan_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, recipe_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL,
      following_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id),
      FOREIGN KEY (follower_id) REFERENCES users(id),
      FOREIGN KEY (following_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS view_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shopping_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      meal_plan_id INTEGER,
      items TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id)
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      cover_image TEXT DEFAULT '',
      creator_id INTEGER NOT NULL,
      is_public INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS collection_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      sort_order INTEGER DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      UNIQUE(collection_id, recipe_id)
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      rules TEXT DEFAULT '',
      reward TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS challenge_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      recipe_submissions TEXT DEFAULT '[]',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(challenge_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS recipe_translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      language_code TEXT NOT NULL DEFAULT 'en',
      translated_title TEXT NOT NULL,
      translated_steps TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      UNIQUE(recipe_id, language_code)
    );
  `);

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    seedData();
  }
}

function seedData() {
  console.log('Seeding initial data...');

  const insertUser = db.prepare(`
    INSERT INTO users (username, password, avatar, bio)
    VALUES (?, ?, ?, ?)
  `);

  const users = [
    ['美食达人小王', '123456', 'https://i.pravatar.cc/150?img=1', '热爱烹饪，分享家常美味'],
    ['烘焙小姐姐', '123456', 'https://i.pravatar.cc/150?img=5', '专注甜品烘焙，治愈系美食'],
    ['健身教练阿杰', '123456', 'https://i.pravatar.cc/150?img=3', '高蛋白减脂餐，吃瘦不饿瘦'],
    ['日料老师傅', '123456', 'https://i.pravatar.cc/150?img=8', '20年日料经验，匠心制作'],
    ['汤羹达人', '123456', 'https://i.pravatar.cc/150?img=9', '养生汤羹，四季滋补'],
  ];

  const userIds: number[] = [];
  for (const user of users) {
    const result = insertUser.run(user[0], user[1], user[2], user[3]);
    userIds.push(Number(result.lastInsertRowid));
  }

  const insertIngredientNutrition = db.prepare(`
    INSERT INTO ingredient_nutrition (name, category, calories, protein, carbs, fat, price_per_100g)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const ingredientsNutrition = [
    ['鸡胸肉', '肉类', 165, 31, 0, 3.6, 2.5],
    ['鸡蛋', '蛋类', 155, 13, 1.1, 11, 0.8],
    ['大米', '主食', 130, 2.7, 28, 0.3, 0.6],
    ['西红柿', '蔬菜', 18, 0.9, 3.9, 0.2, 0.5],
    ['西兰花', '蔬菜', 34, 2.8, 7, 0.4, 0.8],
    ['牛奶', '奶类', 42, 3.4, 5, 1, 0.7],
    ['面粉', '主食', 364, 10, 76, 1, 0.5],
    ['黄油', '调料', 717, 0.9, 0.1, 81, 8],
    ['三文鱼', '肉类', 208, 20, 0, 13, 15],
    ['豆腐', '豆制品', 76, 8, 1.9, 4.8, 0.6],
    ['青菜', '蔬菜', 15, 1.5, 2.7, 0.3, 0.4],
    ['土豆', '蔬菜', 77, 2, 17, 0.1, 0.4],
    ['牛肉', '肉类', 250, 26, 0, 15, 5],
    ['虾', '海鲜', 99, 24, 0.2, 0.3, 10],
    ['洋葱', '蔬菜', 40, 1.1, 9, 0.1, 0.5],
    ['胡萝卜', '蔬菜', 41, 0.9, 10, 0.2, 0.4],
    ['黄瓜', '蔬菜', 15, 0.7, 3.6, 0.1, 0.4],
    ['生菜', '蔬菜', 15, 1.4, 2.9, 0.2, 0.5],
    ['酱油', '调料', 53, 6, 6, 0.1, 0.6],
    ['食用油', '调料', 884, 0, 0, 100, 9],
  ];

  for (const ing of ingredientsNutrition) {
    insertIngredientNutrition.run(ing[0], ing[1], ing[2], ing[3], ing[4], ing[5], ing[6]);
  }

  const insertRecipe = db.prepare(`
    INSERT INTO recipes (title, category, difficulty, cook_time, servings, cover_image, author_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertIngredient = db.prepare(`
    INSERT INTO recipe_ingredients (recipe_id, name, amount, unit, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertStep = db.prepare(`
    INSERT INTO recipe_steps (recipe_id, step_order, description, image_url)
    VALUES (?, ?, ?, ?)
  `);

  const insertTag = db.prepare(`
    INSERT INTO recipe_tags (recipe_id, tag)
    VALUES (?, ?)
  `);

  const recipes = [
    {
      title: '番茄炒蛋',
      category: '中餐',
      difficulty: '入门',
      cookTime: 15,
      servings: 2,
      coverImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
      authorIndex: 0,
      tags: ['快手菜', '减脂'],
      ingredients: [
        { name: '西红柿', amount: 200, unit: 'g' },
        { name: '鸡蛋', amount: 100, unit: 'g' },
        { name: '食用油', amount: 10, unit: 'g' },
        { name: '酱油', amount: 5, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '西红柿切块，鸡蛋打散备用', img: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300' },
        { order: 2, desc: '热锅下油，倒入蛋液炒至结块盛出', img: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300' },
        { order: 3, desc: '再放少许油，下西红柿翻炒出汁', img: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300' },
        { order: 4, desc: '倒入炒好的鸡蛋，加酱油调味翻炒均匀即可', img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300' },
      ],
    },
    {
      title: '香煎鸡胸肉',
      category: '西餐',
      difficulty: '入门',
      cookTime: 20,
      servings: 1,
      coverImage: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400',
      authorIndex: 2,
      tags: ['高蛋白', '减脂'],
      ingredients: [
        { name: '鸡胸肉', amount: 200, unit: 'g' },
        { name: '食用油', amount: 5, unit: 'g' },
        { name: '西兰花', amount: 100, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '鸡胸肉洗净沥干，用刀背拍松两面', img: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300' },
        { order: 2, desc: '加少许盐和黑胡椒腌制10分钟', img: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=300' },
        { order: 3, desc: '热锅少油，中火煎至两面金黄熟透', img: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=300' },
        { order: 4, desc: '搭配焯水的西兰花即可上桌', img: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300' },
      ],
    },
    {
      title: '三文鱼寿司卷',
      category: '日料',
      difficulty: '中等',
      cookTime: 45,
      servings: 4,
      coverImage: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400',
      authorIndex: 3,
      tags: ['高蛋白'],
      ingredients: [
        { name: '大米', amount: 200, unit: 'g' },
        { name: '三文鱼', amount: 150, unit: 'g' },
        { name: '黄瓜', amount: 50, unit: 'g' },
        { name: '胡萝卜', amount: 30, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '米洗净后蒸熟，加寿司醋拌匀冷却', img: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=300' },
        { order: 2, desc: '三文鱼、黄瓜、胡萝卜切成长条', img: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300' },
        { order: 3, desc: '海苔上铺上米饭，放上馅料卷起', img: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=300' },
        { order: 4, desc: '刀沾水切成厚段即可摆盘', img: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300' },
      ],
    },
    {
      title: '草莓蛋糕',
      category: '烘焙',
      difficulty: '中等',
      cookTime: 90,
      servings: 8,
      coverImage: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400',
      authorIndex: 1,
      tags: [],
      ingredients: [
        { name: '面粉', amount: 150, unit: 'g' },
        { name: '鸡蛋', amount: 150, unit: 'g' },
        { name: '牛奶', amount: 50, unit: 'g' },
        { name: '黄油', amount: 30, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '蛋白打发至硬性发泡，蛋黄加糖乳化', img: 'https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=300' },
        { order: 2, desc: '分三次混合蛋白霜与蛋黄糊，切拌均匀', img: 'https://images.unsplash.com/photo-1562440499-64c9a111f713?w=300' },
        { order: 3, desc: '倒入模具震荡排气，170度烤40分钟', img: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=300' },
        { order: 4, desc: '脱模冷却后抹奶油装饰草莓', img: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=300' },
      ],
    },
    {
      title: '番茄牛肉汤',
      category: '汤羹',
      difficulty: '中等',
      cookTime: 60,
      servings: 4,
      coverImage: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400',
      authorIndex: 4,
      tags: ['高蛋白'],
      ingredients: [
        { name: '牛肉', amount: 300, unit: 'g' },
        { name: '西红柿', amount: 300, unit: 'g' },
        { name: '土豆', amount: 150, unit: 'g' },
        { name: '洋葱', amount: 50, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '牛肉切块焯水去血沫，捞出洗净', img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300' },
        { order: 2, desc: '西红柿去皮切块，土豆洋葱切滚刀块', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300' },
        { order: 3, desc: '锅中加油，爆香洋葱后下西红柿炒出汁水', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300' },
        { order: 4, desc: '加水放入牛肉炖40分钟，加土豆再炖15分钟调味', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300' },
      ],
    },
    {
      title: '芒果奶昔',
      category: '饮品',
      difficulty: '入门',
      cookTime: 5,
      servings: 2,
      coverImage: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=400',
      authorIndex: 1,
      tags: ['快手菜'],
      ingredients: [
        { name: '牛奶', amount: 200, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '芒果去皮切小块', img: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=300' },
        { order: 2, desc: '将芒果块与牛奶放入料理机', img: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=300' },
        { order: 3, desc: '搅打30秒至顺滑', img: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=300' },
        { order: 4, desc: '倒入杯中，加冰块即可饮用', img: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=300' },
      ],
    },
    {
      title: '麻婆豆腐',
      category: '中餐',
      difficulty: '中等',
      cookTime: 25,
      servings: 3,
      coverImage: 'https://images.unsplash.com/photo-1582576163090-09d3b6f8a969?w=400',
      authorIndex: 0,
      tags: ['高蛋白', '快手菜'],
      ingredients: [
        { name: '豆腐', amount: 300, unit: 'g' },
        { name: '牛肉', amount: 50, unit: 'g' },
        { name: '食用油', amount: 15, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '豆腐切小块，用盐水浸泡5分钟', img: 'https://images.unsplash.com/photo-1582576163090-09d3b6f8a969?w=300' },
        { order: 2, desc: '牛肉剁成肉末，加料酒腌制', img: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=300' },
        { order: 3, desc: '热油下肉末炒散，加豆瓣酱炒出红油', img: 'https://images.unsplash.com/photo-1582576163090-09d3b6f8a969?w=300' },
        { order: 4, desc: '加入豆腐和少许水，小火炖煮5分钟勾芡', img: 'https://images.unsplash.com/photo-1582576163090-09d3b6f8a969?w=300' },
      ],
    },
    {
      title: '蔬菜沙拉',
      category: '西餐',
      difficulty: '入门',
      cookTime: 10,
      servings: 2,
      coverImage: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
      authorIndex: 2,
      tags: ['减脂', '快手菜', '无麸质'],
      ingredients: [
        { name: '生菜', amount: 100, unit: 'g' },
        { name: '西红柿', amount: 100, unit: 'g' },
        { name: '黄瓜', amount: 80, unit: 'g' },
        { name: '西兰花', amount: 50, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '生菜洗净撕成小片，沥干水分', img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300' },
        { order: 2, desc: '西红柿切块，黄瓜切片', img: 'https://images.unsplash.com/photo-1595475207225-428b62bda831?w=300' },
        { order: 3, desc: '西兰花焯水至断生', img: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=300' },
        { order: 4, desc: '所有材料混合，淋上油醋汁拌匀', img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300' },
      ],
    },
    {
      title: '味噌汤',
      category: '日料',
      difficulty: '入门',
      cookTime: 15,
      servings: 2,
      coverImage: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400',
      authorIndex: 3,
      tags: ['快手菜', '减脂'],
      ingredients: [
        { name: '豆腐', amount: 100, unit: 'g' },
        { name: '青菜', amount: 50, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '豆腐切小块，青菜切段', img: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=300' },
        { order: 2, desc: '锅中加水煮开，放入豆腐', img: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=300' },
        { order: 3, desc: '味噌用少许水调开，加入汤中', img: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=300' },
        { order: 4, desc: '加青菜稍煮，关火即可', img: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=300' },
      ],
    },
    {
      title: '巧克力曲奇',
      category: '烘焙',
      difficulty: '入门',
      cookTime: 30,
      servings: 20,
      coverImage: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400',
      authorIndex: 1,
      tags: [],
      ingredients: [
        { name: '面粉', amount: 200, unit: 'g' },
        { name: '黄油', amount: 100, unit: 'g' },
        { name: '鸡蛋', amount: 50, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '黄油软化加糖打发至蓬松', img: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=300' },
        { order: 2, desc: '分次加入蛋液，每次打匀', img: 'https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=300' },
        { order: 3, desc: '筛入面粉，拌入巧克力豆', img: 'https://images.unsplash.com/photo-1562440499-64c9a111f713?w=300' },
        { order: 4, desc: '挤成小饼，180度烤12-15分钟', img: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=300' },
      ],
    },
    {
      title: '黄瓜鸡蛋汤',
      category: '汤羹',
      difficulty: '入门',
      cookTime: 10,
      servings: 2,
      coverImage: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400',
      authorIndex: 4,
      tags: ['快手菜', '减脂'],
      ingredients: [
        { name: '黄瓜', amount: 100, unit: 'g' },
        { name: '鸡蛋', amount: 50, unit: 'g' },
        { name: '食用油', amount: 3, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '黄瓜切片，鸡蛋打散', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300' },
        { order: 2, desc: '锅中加水烧开，放入黄瓜片', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300' },
        { order: 3, desc: '淋入蛋液形成蛋花', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300' },
        { order: 4, desc: '加盐香油调味即可', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300' },
      ],
    },
    {
      title: '柠檬蜂蜜水',
      category: '饮品',
      difficulty: '入门',
      cookTime: 3,
      servings: 1,
      coverImage: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400',
      authorIndex: 0,
      tags: ['快手菜', '减脂'],
      ingredients: [
        { name: '蜂蜜', amount: 20, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '柠檬洗净切片', img: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300' },
        { order: 2, desc: '杯中加温水，放入蜂蜜搅拌', img: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300' },
        { order: 3, desc: '加入柠檬片浸泡', img: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300' },
        { order: 4, desc: '可加冰块饮用', img: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300' },
      ],
    },
    {
      title: '红烧牛肉',
      category: '中餐',
      difficulty: '困难',
      cookTime: 120,
      servings: 4,
      coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
      authorIndex: 0,
      tags: ['高蛋白'],
      ingredients: [
        { name: '牛肉', amount: 500, unit: 'g' },
        { name: '土豆', amount: 200, unit: 'g' },
        { name: '胡萝卜', amount: 100, unit: 'g' },
        { name: '洋葱', amount: 50, unit: 'g' },
        { name: '食用油', amount: 20, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '牛肉切块焯水，去血沫捞出', img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300' },
        { order: 2, desc: '热锅下油，爆香葱姜', img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300' },
        { order: 3, desc: '下牛肉翻炒，加酱油糖色调味', img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300' },
        { order: 4, desc: '加水炖1小时，下土豆胡萝卜炖至软烂收汁', img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300' },
      ],
    },
    {
      title: '牛排配蔬菜',
      category: '西餐',
      difficulty: '困难',
      cookTime: 25,
      servings: 1,
      coverImage: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400',
      authorIndex: 2,
      tags: ['高蛋白', '无麸质'],
      ingredients: [
        { name: '牛肉', amount: 200, unit: 'g' },
        { name: '西兰花', amount: 100, unit: 'g' },
        { name: '胡萝卜', amount: 50, unit: 'g' },
        { name: '土豆', amount: 100, unit: 'g' },
        { name: '黄油', amount: 10, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '牛排室温静置，用厨房纸吸干水分', img: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300' },
        { order: 2, desc: '两面撒盐和黑胡椒腌制', img: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300' },
        { order: 3, desc: '热锅下黄油，两面煎至喜欢的熟度', img: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300' },
        { order: 4, desc: '搭配烤土豆和时蔬上桌', img: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300' },
      ],
    },
    {
      title: '天妇罗',
      category: '日料',
      difficulty: '困难',
      cookTime: 40,
      servings: 2,
      coverImage: 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=400',
      authorIndex: 3,
      tags: [],
      ingredients: [
        { name: '虾', amount: 150, unit: 'g' },
        { name: '面粉', amount: 80, unit: 'g' },
        { name: '鸡蛋', amount: 50, unit: 'g' },
        { name: '胡萝卜', amount: 30, unit: 'g' },
        { name: '食用油', amount: 100, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '虾去壳留尾，开背挑虾线', img: 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=300' },
        { order: 2, desc: '低筋面粉加冰水和蛋黄调成面糊', img: 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=300' },
        { order: 3, desc: '食材先沾干面粉，再裹面糊', img: 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=300' },
        { order: 4, desc: '180度油炸至金黄酥脆', img: 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=300' },
      ],
    },
    {
      title: '提拉米苏',
      category: '烘焙',
      difficulty: '困难',
      cookTime: 60,
      servings: 6,
      coverImage: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400',
      authorIndex: 1,
      tags: [],
      ingredients: [
        { name: '马斯卡彭奶酪', amount: 250, unit: 'g' },
        { name: '鸡蛋', amount: 100, unit: 'g' },
        { name: '手指饼干', amount: 150, unit: 'g' },
        { name: '咖啡', amount: 100, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '蛋黄加糖打发至颜色变浅', img: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=300' },
        { order: 2, desc: '加入马斯卡彭奶酪拌匀', img: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=300' },
        { order: 3, desc: '蛋白打发至硬性发泡，分次拌入', img: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=300' },
        { order: 4, desc: '手指饼干沾咖啡，一层饼干一层奶酪糊，冷藏4小时', img: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=300' },
      ],
    },
    {
      title: '山药排骨汤',
      category: '汤羹',
      difficulty: '中等',
      cookTime: 90,
      servings: 4,
      coverImage: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400',
      authorIndex: 4,
      tags: [],
      ingredients: [
        { name: '排骨', amount: 400, unit: 'g' },
        { name: '胡萝卜', amount: 100, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '排骨焯水去血沫，洗净', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300' },
        { order: 2, desc: '山药胡萝卜去皮切滚刀块', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300' },
        { order: 3, desc: '所有材料放入砂锅，加水大火烧开', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300' },
        { order: 4, desc: '转小火炖1小时，加盐调味', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300' },
      ],
    },
    {
      title: '珍珠奶茶',
      category: '饮品',
      difficulty: '中等',
      cookTime: 50,
      servings: 3,
      coverImage: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=400',
      authorIndex: 1,
      tags: [],
      ingredients: [
        { name: '木薯粉', amount: 100, unit: 'g' },
        { name: '牛奶', amount: 200, unit: 'g' },
        { name: '红茶', amount: 5, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '木薯粉加红糖水和成面团，搓成小圆子', img: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=300' },
        { order: 2, desc: '锅中加水煮珍珠，煮至透明', img: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=300' },
        { order: 3, desc: '红茶泡出浓茶汁，加牛奶调匀', img: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=300' },
        { order: 4, desc: '杯中放珍珠，倒入奶茶即可', img: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=300' },
      ],
    },
    {
      title: '蒜蓉西兰花',
      category: '中餐',
      difficulty: '入门',
      cookTime: 10,
      servings: 2,
      coverImage: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400',
      authorIndex: 0,
      tags: ['快手菜', '减脂', '无麸质'],
      ingredients: [
        { name: '西兰花', amount: 300, unit: 'g' },
        { name: '食用油', amount: 10, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '西兰花切小朵，盐水浸泡5分钟', img: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=300' },
        { order: 2, desc: '锅中烧水焯烫1分钟捞出过凉', img: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=300' },
        { order: 3, desc: '热油爆香蒜末', img: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=300' },
        { order: 4, desc: '下西兰花快速翻炒，加盐调味', img: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=300' },
      ],
    },
    {
      title: '土豆泥',
      category: '西餐',
      difficulty: '入门',
      cookTime: 25,
      servings: 2,
      coverImage: 'https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=400',
      authorIndex: 2,
      tags: ['快手菜', '无麸质'],
      ingredients: [
        { name: '土豆', amount: 300, unit: 'g' },
        { name: '牛奶', amount: 50, unit: 'g' },
        { name: '黄油', amount: 20, unit: 'g' },
      ],
      steps: [
        { order: 1, desc: '土豆去皮切厚片', img: 'https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=300' },
        { order: 2, desc: '上锅蒸熟约15分钟', img: 'https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=300' },
        { order: 3, desc: '趁热压成泥', img: 'https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=300' },
        { order: 4, desc: '加黄油、牛奶、盐搅拌均匀', img: 'https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=300' },
      ],
    },
  ];

  const recipeIds: number[] = [];
  for (const recipe of recipes) {
    const result = insertRecipe.run(
      recipe.title,
      recipe.category,
      recipe.difficulty,
      recipe.cookTime,
      recipe.servings,
      recipe.coverImage,
      userIds[recipe.authorIndex]
    );
    const recipeId = Number(result.lastInsertRowid);
    recipeIds.push(recipeId);

    recipe.ingredients.forEach((ing, idx) => {
      insertIngredient.run(recipeId, ing.name, ing.amount, ing.unit, idx);
    });

    recipe.steps.forEach(step => {
      insertStep.run(recipeId, step.order, step.desc, step.img);
    });

    recipe.tags.forEach(tag => {
      insertTag.run(recipeId, tag);
    });
  }

  const insertFavorite = db.prepare(`
    INSERT INTO favorites (user_id, recipe_id)
    VALUES (?, ?)
  `);
  insertFavorite.run(userIds[0], recipeIds[1]);
  insertFavorite.run(userIds[0], recipeIds[2]);
  insertFavorite.run(userIds[1], recipeIds[0]);
  insertFavorite.run(userIds[2], recipeIds[4]);

  const insertFollow = db.prepare(`
    INSERT INTO follows (follower_id, following_id)
    VALUES (?, ?)
  `);
  insertFollow.run(userIds[0], userIds[1]);
  insertFollow.run(userIds[0], userIds[3]);
  insertFollow.run(userIds[1], userIds[0]);
  insertFollow.run(userIds[2], userIds[0]);
  insertFollow.run(userIds[3], userIds[0]);

  const insertReview = db.prepare(`
    INSERT INTO reviews (user_id, recipe_id, rating, comment)
    VALUES (?, ?, ?, ?)
  `);
  insertReview.run(userIds[1], recipeIds[0], 5, '超级好吃！做法简单，全家都喜欢');
  insertReview.run(userIds[2], recipeIds[0], 4, '很经典的家常菜，下次少放点盐');
  insertReview.run(userIds[0], recipeIds[1], 5, '减脂期必备，鸡胸肉做的很嫩');
  insertReview.run(userIds[3], recipeIds[2], 4, '寿司卷的不错，饭有点散');

  const updateRating = db.prepare(`
    UPDATE recipes SET rating = (
      SELECT AVG(rating) FROM reviews WHERE recipe_id = recipes.id
    ), rating_count = (
      SELECT COUNT(*) FROM reviews WHERE recipe_id = recipes.id
    )
    WHERE id IN (SELECT DISTINCT recipe_id FROM reviews)
  `);
  updateRating.run();

  const updateViewCount = db.prepare(`
    UPDATE recipes SET view_count = view_count + ? WHERE id = ?
  `);
  recipeIds.forEach((id, i) => {
    updateViewCount.run((i + 1) * 23 + 50, id);
  });

  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  const weekStart = monday.toISOString().split('T')[0];

  const prevMonday = new Date(monday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const prevWeekStart = prevMonday.toISOString().split('T')[0];

  const insertMealPlan = db.prepare(`
    INSERT INTO meal_plans (user_id, name, week_start_date)
    VALUES (?, ?, ?)
  `);
  const insertMealPlanItem = db.prepare(`
    INSERT INTO meal_plan_items (meal_plan_id, day, meal_type, recipe_id, custom_title, custom_ingredients)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const plan1Result = insertMealPlan.run(userIds[0], '本周膳食计划', weekStart);
  const plan1Id = Number(plan1Result.lastInsertRowid);
  insertMealPlanItem.run(plan1Id, 1, 'breakfast', recipeIds[11], null, null);
  insertMealPlanItem.run(plan1Id, 1, 'lunch', recipeIds[0], null, null);
  insertMealPlanItem.run(plan1Id, 1, 'dinner', recipeIds[4], null, null);
  insertMealPlanItem.run(plan1Id, 2, 'breakfast', recipeIds[5], null, null);
  insertMealPlanItem.run(plan1Id, 2, 'lunch', recipeIds[6], null, null);
  insertMealPlanItem.run(plan1Id, 2, 'dinner', recipeIds[12], null, null);
  insertMealPlanItem.run(plan1Id, 3, 'breakfast', null, '燕麦粥', null);
  insertMealPlanItem.run(plan1Id, 3, 'lunch', recipeIds[7], null, null);
  insertMealPlanItem.run(plan1Id, 3, 'dinner', recipeIds[16], null, null);

  const plan2Result = insertMealPlan.run(userIds[2], '健身减脂周计划', prevWeekStart);
  const plan2Id = Number(plan2Result.lastInsertRowid);
  insertMealPlanItem.run(plan2Id, 1, 'breakfast', recipeIds[7], null, null);
  insertMealPlanItem.run(plan2Id, 1, 'lunch', recipeIds[1], null, null);
  insertMealPlanItem.run(plan2Id, 1, 'dinner', recipeIds[19], null, null);
  insertMealPlanItem.run(plan2Id, 2, 'breakfast', recipeIds[5], null, null);
  insertMealPlanItem.run(plan2Id, 2, 'lunch', recipeIds[7], null, null);
  insertMealPlanItem.run(plan2Id, 2, 'dinner', recipeIds[1], null, null);
  insertMealPlanItem.run(plan2Id, 3, 'breakfast', recipeIds[9], null, null);
  insertMealPlanItem.run(plan2Id, 3, 'lunch', recipeIds[7], null, null);
  insertMealPlanItem.run(plan2Id, 3, 'dinner', recipeIds[19], null, null);

  const insertVersion = db.prepare(`
    INSERT INTO recipe_versions (recipe_id, version_number, change_description, ingredients_snapshot, steps_snapshot)
    VALUES (?, 1, ?, ?, ?)
  `);
  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    const ingredientsSnapshot = JSON.stringify(recipe.ingredients);
    const stepsSnapshot = JSON.stringify(recipe.steps.map(s => ({
      order: s.order,
      description: s.desc,
      imageUrl: s.img
    })));
    insertVersion.run(recipeIds[i], '初始版本', ingredientsSnapshot, stepsSnapshot);
  }

  const insertPrice = db.prepare(`
    INSERT INTO ingredient_prices (ingredient_name, price, unit, market_name, recorded_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const priceData = [
    ['西红柿', 5.5, '500g', '盒马生鲜', null],
    ['鸡蛋', 8.8, '500g', '盒马生鲜', null],
    ['鸡胸肉', 18.5, '500g', '盒马生鲜', null],
    ['西兰花', 6.5, '500g', '盒马生鲜', null],
    ['牛肉', 58.0, '500g', '盒马生鲜', null],
    ['土豆', 3.5, '500g', '盒马生鲜', null],
    ['胡萝卜', 4.2, '500g', '盒马生鲜', null],
    ['黄瓜', 4.8, '500g', '盒马生鲜', null],
    ['生菜', 5.0, '500g', '盒马生鲜', null],
    ['三文鱼', 88.0, '500g', '盒马生鲜', null],
    ['牛奶', 12.5, '1L', '盒马生鲜', null],
    ['面粉', 5.5, '500g', '盒马生鲜', null],
  ];
  const priceNow = new Date();
  for (let i = 0; i < priceData.length; i++) {
    const [name, price, unit, market] = priceData[i];
    for (let day = 29; day >= 0; day--) {
      const date = new Date(priceNow);
      date.setDate(date.getDate() - day);
      const variation = (Math.random() - 0.5) * price * 0.2;
      insertPrice.run(name, Math.round((price + variation) * 100) / 100, unit, market, date.toISOString());
    }
  }

  const insertCollection = db.prepare(`
    INSERT INTO collections (name, description, cover_image, creator_id, is_public)
    VALUES (?, ?, ?, ?, 1)
  `);
  const insertCollectionRecipe = db.prepare(`
    INSERT INTO collection_recipes (collection_id, recipe_id, sort_order)
    VALUES (?, ?, ?)
  `);
  
  const collection1 = insertCollection.run(
    '一周减脂餐',
    '低卡高蛋白，健康减脂不挨饿',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
    userIds[2]
  );
  const collection1Id = Number(collection1.lastInsertRowid);
  const collection1Recipes = [0, 1, 6, 7, 19];
  collection1Recipes.forEach((idx, i) => {
    insertCollectionRecipe.run(collection1Id, recipeIds[idx], i);
  });

  const collection2 = insertCollection.run(
    '新手入门10道菜',
    '厨房小白也能轻松上手',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400',
    userIds[0]
  );
  const collection2Id = Number(collection2.lastInsertRowid);
  const collection2Recipes = [0, 5, 8, 10, 11, 19];
  collection2Recipes.forEach((idx, i) => {
    insertCollectionRecipe.run(collection2Id, recipeIds[idx], i);
  });

  const insertChallenge = db.prepare(`
    INSERT INTO challenges (name, description, start_date, end_date, rules, reward)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertChallengeParticipant = db.prepare(`
    INSERT INTO challenge_participants (challenge_id, user_id, recipe_submissions)
    VALUES (?, ?, ?)
  `);

  const challengeStart = new Date();
  challengeStart.setDate(challengeStart.getDate() - 3);
  const challengeEnd = new Date();
  challengeEnd.setDate(challengeEnd.getDate() + 4);
  
  const challenge1 = insertChallenge.run(
    '本周主题：鸡蛋料理大挑战',
    '用鸡蛋做3道不同的菜，展示你的创意！',
    challengeStart.toISOString().split('T')[0],
    challengeEnd.toISOString().split('T')[0],
    '1. 必须使用鸡蛋作为主要食材\n2. 至少提交3道不同的菜\n3. 附上简单的做法说明\n4. 截止日期前提交有效',
    '最佳创意奖：获得专属徽章 + 7天会员体验'
  );
  const challenge1Id = Number(challenge1.lastInsertRowid);
  
  insertChallengeParticipant.run(challenge1Id, userIds[0], JSON.stringify([
    { id: 1, recipeTitle: '番茄炒蛋', submittedAt: new Date().toISOString() },
    { id: 2, recipeTitle: '黄瓜鸡蛋汤', submittedAt: new Date().toISOString() },
  ]));
  insertChallengeParticipant.run(challenge1Id, userIds[1], JSON.stringify([
    { id: 3, recipeTitle: '草莓蛋糕', submittedAt: new Date().toISOString() },
  ]));

  console.log('Data seeded successfully!');
  console.log(`Users: ${userIds.length}`);
  console.log(`Recipes: ${recipeIds.length}`);
  console.log('Ingredient nutrition data: 20 items');
  console.log('Meal plans: 2');
  console.log('Recipe versions: created');
  console.log('Ingredient prices: 30 days history');
  console.log('Collections: 2');
  console.log('Challenges: 1');
}

initDatabase();
