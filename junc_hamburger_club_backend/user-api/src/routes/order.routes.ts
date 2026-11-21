import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { createOrder, getOrders, getOrderById, cancelOrder, previewOrder } from '../controllers/order.controller';
import { wrapAsync } from '../lib/errors';
import { idempotency } from '../middleware/idempotency.middleware';

const router = Router();

router.use(authenticate);

router.post('/', wrapAsync(idempotency), wrapAsync(createOrder));
router.post('/preview', wrapAsync(previewOrder));
router.get('/', wrapAsync(getOrders));
router.get('/:orderId', wrapAsync(getOrderById));
router.put('/:orderId/cancel', wrapAsync(cancelOrder));

export default router;
