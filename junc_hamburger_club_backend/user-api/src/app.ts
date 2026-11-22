// 必ず最初に env を評価して、未設定の秘密鍵で起動しないようにする
import './config/env';

import express from 'express';
import cors from 'cors';
import path from 'path';
import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';

import { errorHandler } from './middleware/error.middleware';
import authRoutes from './routes/auth.routes';
import burgerRoutes from './routes/burger.routes';
import cartRoutes from './routes/cart.routes';
import orderRoutes from './routes/order.routes';
import userRoutes from './routes/user.routes';
import newsRoutes from './routes/news.routes';
import pickupRoutes from './routes/pickup.routes';
import storeRoutes from './routes/store.routes';
import appConfigRoutes from './routes/app_config.routes';

const app = express();

// 本番は LB / CDN の段数に合わせて設定する。開発 (docker compose + direct) は 1 hop。
// req.ip を rate limit や監査ログに使うため明示設定が必要。
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
app.use(cors());
// 大きすぎる refreshToken 攻撃対策を含め body サイズを明示
app.use(express.json({ limit: '100kb' }));

// Swagger
const swaggerDoc = YAML.load(path.join(__dirname, '../swagger/openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/burgers', burgerRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/news', newsRoutes);
app.use('/api/v1/pickup-slots', pickupRoutes);
app.use('/api/v1/store', storeRoutes);
app.use('/api/v1/app-config', appConfigRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'junc-user-api' });
});

app.use(errorHandler);

export default app;
