import { Router } from 'express';
import { getStore } from '../controllers/store.controller';
import { wrapAsync } from '../lib/errors';

const router = Router();
router.get('/', wrapAsync(getStore));
export default router;
