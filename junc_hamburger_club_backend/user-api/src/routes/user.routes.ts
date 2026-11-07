import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { getProfile, updateProfile, changePassword, deleteAccount } from '../controllers/user.controller';

const router = Router();

router.use(authenticate);

const updateProfileValidation = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('profileImageUrl').optional({ nullable: true }).isString(),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];

router.get('/me', getProfile);
router.put('/me', updateProfileValidation, validate, updateProfile);
router.put('/me/password', changePasswordValidation, validate, changePassword);
router.delete('/me', deleteAccount);

export default router;
