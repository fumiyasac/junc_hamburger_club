import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getProfile, updateProfile, changePassword, deleteAccount } from '../controllers/user.controller';

const router = Router();

router.use(authenticate);

router.get('/me', getProfile);
router.put('/me', updateProfile);
router.put('/me/password', changePassword);
router.delete('/me', deleteAccount);

export default router;
