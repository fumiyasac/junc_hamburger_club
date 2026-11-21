import { Router } from 'express';
import { getAppConfig } from '../controllers/app_config.controller';
import { wrapAsync } from '../lib/errors';

const router = Router();
router.get('/', wrapAsync(getAppConfig));
export default router;
