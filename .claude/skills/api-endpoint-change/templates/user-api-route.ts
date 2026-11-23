// junc_hamburger_club_backend/user-api/src/routes/<topic>.routes.ts
//
// テンプレート: 認証付きルート + バリデーション付き POST の典型例。
// #65 以降は controller 側で throw AppError するため、全 handler を wrapAsync で包む。

import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { wrapAsync } from '../lib/errors';
import { listReviews, getReview, createReview } from '../controllers/review.controller';

const router = Router();

// 一覧・詳細は認証不要 (例)、作成は認証必要
const createValidation = [
  body('burgerId').isString().notEmpty(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isString(),
];

router.get('/', wrapAsync(listReviews));
router.get('/:id', wrapAsync(getReview));

// 認証付きは authenticate を挟む。失敗時は middleware が TOKEN_* を返す。
router.post('/', authenticate, createValidation, validate, wrapAsync(createReview));

// 書き込みで Idempotency-Key を受けたい場合 (稀):
// import { idempotency } from '../middleware/idempotency.middleware';
// router.post('/', authenticate, createValidation, validate,
//   wrapAsync(idempotency), wrapAsync(createReview));

export default router;
