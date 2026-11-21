import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from '../controllers/cart.controller';
import { wrapAsync } from '../lib/errors';

const router = Router();

router.use(authenticate);

router.get('/', wrapAsync(getCart));
router.post('/', wrapAsync(addToCart));
router.put('/:itemId', wrapAsync(updateCartItem));
router.delete('/:itemId', wrapAsync(removeFromCart));
router.delete('/', wrapAsync(clearCart));

export default router;
