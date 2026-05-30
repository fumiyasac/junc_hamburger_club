import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { pool } from './config/database';

const PORT = process.env.PORT ?? 3000;

async function startServer(): Promise<void> {
  try {
    await pool.getConnection();
    console.log('✅ Database connected');

    app.listen(PORT, () => {
      console.log(`🚀 JUNC User API running on port ${PORT}`);
      console.log(`📚 Swagger docs: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
