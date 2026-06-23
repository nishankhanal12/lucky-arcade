import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import gameRoutes from './routes/game.routes';
import adminRoutes from './routes/admin.routes';
import { initSocket } from './modules/socket';
import { seedAdmin } from './database/seed';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Lucky Arcade API' });
});

app.use('/api', gameRoutes);
app.use('/api/admin', adminRoutes);

const httpServer = http.createServer(app);
initSocket(httpServer);

async function start() {
  try {
    await seedAdmin();
    httpServer.listen(PORT, HOST, () => {
      console.log(`🎰 Lucky Arcade API running at http://${HOST}:${PORT}`);
      console.log(`   LAN access: http://<your-ip>:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export default app;
