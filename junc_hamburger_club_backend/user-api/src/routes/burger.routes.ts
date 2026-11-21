import { Router } from 'express';
import { getBurgers, getBurgerById, getCategories, searchBurgers } from '../controllers/burger.controller';
import { wrapAsync } from '../lib/errors';

const router = Router();

router.get('/', wrapAsync(getBurgers));
router.get('/search', wrapAsync(searchBurgers));
router.get('/categories', wrapAsync(getCategories));
router.get('/:id', wrapAsync(getBurgerById));

export default router;
