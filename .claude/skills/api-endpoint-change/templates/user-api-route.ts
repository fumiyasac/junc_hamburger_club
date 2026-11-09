// junc_hamburger_club_backend/user-api/src/routes/<topic>.routes.ts
//
// テンプレート: 認証付きルート + バリデーション付き POST の典型例。
// - 認証不要にする場合は router.use(authenticate) を外す
// - express-validator のルール定義の直後に `validate` を噛ますことで 400 を強制する

import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  listReviews,
  getReviewById,
  createReview,
} from '../controllers/review.controller';

const router = Router();

// 認証が必要なエンドポイントだけのルータなら、全体に適用
router.use(authenticate);

const createValidation = [
  body('burgerId').isString().notEmpty(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isString().isLength({ max: 500 }),
];

const idValidation = [param('id').isString().notEmpty()];

router.get('/', listReviews);
router.get('/:id', idValidation, validate, getReviewById);
router.post('/', createValidation, validate, createReview);

export default router;

// NOTE: 新規 topic の場合は src/app.ts に以下を追加
//   import reviewRoutes from './routes/review.routes';
//   app.use('/api/v1/reviews', reviewRoutes);
