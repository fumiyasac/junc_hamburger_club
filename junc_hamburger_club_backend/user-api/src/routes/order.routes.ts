import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { createOrder, getOrders, getOrderById, cancelOrder } from '../controllers/order.controller';

const router = Router();

router.use(authenticate);

router.post('/', createOrder);
router.get('/', getOrders);
router.get('/:orderId', getOrderById);
router.put('/:orderId/cancel', cancelOrder);

export default router;
