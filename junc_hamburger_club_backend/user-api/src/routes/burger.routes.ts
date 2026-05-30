import { Router } from 'express';
import { getBurgers, getBurgerById, getCategories, searchBurgers } from '../controllers/burger.controller';

const router = Router();

router.get('/', getBurgers);
router.get('/search', searchBurgers);
router.get('/categories', getCategories);
router.get('/:id', getBurgerById);

export default router;
