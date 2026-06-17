import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { getUserIdFromHeader } from '../utils.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT c.*,
           (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id) as participant_count
    FROM challenges c
    ORDER BY c.start_date DESC
  `).all() as any[];

  const challenges = rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    rules: row.rules,
    reward: row.reward,
    participantCount: row.participant_count,
    createdAt: row.created_at,
  }));

  res.json({
    success: true,
    data: challenges,
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);

  const row = db.prepare(`
    SELECT c.*,
           (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id) as participant_count
    FROM challenges c
    WHERE c.id = ?
  `).get(id) as any;

  if (!row) {
    res.status(404).json({ success: false, error: '挑战不存在' });
    return;
  }

  let isParticipating = false;
  let submissions: any[] = [];
  if (currentUserId) {
    const participant = db.prepare(
      'SELECT recipe_submissions FROM challenge_participants WHERE challenge_id = ? AND user_id = ?'
    ).get(id, currentUserId) as any;
    if (participant) {
      isParticipating = true;
      submissions = JSON.parse(participant.recipe_submissions || '[]');
    }
  }

  const challenge = {
    id: row.id,
    name: row.name,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    rules: row.rules,
    reward: row.reward,
    participantCount: row.participant_count,
    isParticipating,
    mySubmissions: submissions,
    createdAt: row.created_at,
  };

  res.json({
    success: true,
    data: challenge,
  });
});

router.post('/', (req: Request, res: Response) => {
  const { name, description, startDate, endDate, rules, reward } = req.body;

  if (!name || !startDate || !endDate) {
    res.status(400).json({ success: false, error: '请填写完整信息' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO challenges (name, description, start_date, end_date, rules, reward)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    name,
    description || '',
    startDate,
    endDate,
    rules || '',
    reward || ''
  );

  const newChallenge = {
    id: Number(result.lastInsertRowid),
    name,
    description: description || '',
    startDate,
    endDate,
    rules: rules || '',
    reward: reward || '',
    createdAt: new Date().toISOString(),
  };

  res.json({
    success: true,
    data: newChallenge,
  });
});

router.post('/:id/join', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);

  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }

  const challenge = db.prepare('SELECT id FROM challenges WHERE id = ?').get(id);
  if (!challenge) {
    res.status(404).json({ success: false, error: '挑战不存在' });
    return;
  }

  try {
    db.prepare(`
      INSERT INTO challenge_participants (challenge_id, user_id)
      VALUES (?, ?)
    `).run(id, currentUserId);

    res.json({
      success: true,
      message: '参与成功',
    });
  } catch {
    res.status(400).json({ success: false, error: '已经参与过了' });
  }
});

router.post('/:id/submit', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);
  const { recipeId, recipeTitle } = req.body;

  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }

  const participant = db.prepare(
    'SELECT * FROM challenge_participants WHERE challenge_id = ? AND user_id = ?'
  ).get(id, currentUserId) as any;

  if (!participant) {
    res.status(400).json({ success: false, error: '请先参与挑战' });
    return;
  }

  const submissions = JSON.parse(participant.recipe_submissions || '[]');
  submissions.push({
    recipeId: recipeId || null,
    recipeTitle: recipeTitle || '',
    submittedAt: new Date().toISOString(),
  });

  db.prepare(`
    UPDATE challenge_participants
    SET recipe_submissions = ?
    WHERE challenge_id = ? AND user_id = ?
  `).run(JSON.stringify(submissions), id, currentUserId);

  res.json({
    success: true,
    data: submissions,
    message: '提交成功',
  });
});

router.get('/:id/ranking', (req: Request, res: Response) => {
  const { id } = req.params;

  const rows = db.prepare(`
    SELECT cp.user_id, cp.recipe_submissions, u.username, u.avatar, u.bio
    FROM challenge_participants cp
    JOIN users u ON cp.user_id = u.id
    WHERE cp.challenge_id = ?
    ORDER BY json_array_length(cp.recipe_submissions) DESC, cp.joined_at ASC
  `).all(id) as any[];

  const ranking = rows.map((row, index) => {
    const submissions = JSON.parse(row.recipe_submissions || '[]');
    return {
      rank: index + 1,
      userId: row.user_id,
      username: row.username,
      avatar: row.avatar,
      bio: row.bio,
      submissionCount: submissions.length,
      submissions,
    };
  });

  res.json({
    success: true,
    data: ranking,
  });
});

export default router;
