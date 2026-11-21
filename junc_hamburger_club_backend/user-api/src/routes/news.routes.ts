import { Router } from 'express';
import { query, param } from 'express-validator';
import { validate } from '../middleware/validate.middleware';
import { getNewsList, getNewsById, getNewsCategories } from '../controllers/news.controller';
import { NEWS_CATEGORIES } from '../controllers/news.controller';
import { wrapAsync } from '../lib/errors';

const router = Router();

const listValidation = [
  query('category').optional().isIn([...NEWS_CATEGORIES]).withMessage('Invalid category'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be integer >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be integer between 1 and 100'),
];

const idValidation = [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')];

// 認証不要の公開エンドポイント。
// /categories を :id より先に登録し "categories" が id として解釈されないようにする。
router.get('/', listValidation, validate, wrapAsync(getNewsList));
router.get('/categories', wrapAsync(getNewsCategories));
router.get('/:id', idValidation, validate, wrapAsync(getNewsById));

export default router;
