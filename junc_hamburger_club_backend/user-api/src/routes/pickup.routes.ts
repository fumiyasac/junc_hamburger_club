import { Router } from 'express';
import { getPickupSlots } from '../controllers/pickup.controller';

const router = Router();

// 認証不要
router.get('/', getPickupSlots);

export default router;
