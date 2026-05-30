import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from '../controllers/cart.controller';

const router = Router();

router.use(authenticate);

router.get('/', getCart);
router.post('/', addToCart);
router.put('/:itemId', updateCartItem);
router.delete('/:itemId', removeFromCart);
router.delete('/', clearCart);

export default router;
