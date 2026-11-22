import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, refresh, logout } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { wrapAsync } from '../lib/errors';
import { loginRateLimit, refreshRateLimit } from '../middleware/rate_limit.middleware';

const router = Router();

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

router.post('/register', loginRateLimit, registerValidation, validate, wrapAsync(register));
router.post('/login',    loginRateLimit, loginValidation, validate, wrapAsync(login));
router.post('/refresh',  refreshRateLimit, wrapAsync(refresh));
router.post('/logout',   wrapAsync(logout));

export default router;
