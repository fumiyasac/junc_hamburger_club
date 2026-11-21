import { Router } from 'express';
import { getPickupSlots } from '../controllers/pickup.controller';
import { wrapAsync } from '../lib/errors';

const router = Router();

// 認証不要
router.get('/', wrapAsync(getPickupSlots));

export default router;
