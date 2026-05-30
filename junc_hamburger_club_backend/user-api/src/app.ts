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

const app = express();

app.use(cors());
app.use(express.json());

// Swagger
const swaggerDoc = YAML.load(path.join(__dirname, '../swagger/openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/burgers', burgerRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/users', userRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'junc-user-api' });
});

app.use(errorHandler);

export default app;
