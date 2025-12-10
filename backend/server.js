import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { driveRouter } from './routes/drive.js';
import { geocodeRouter } from './routes/geocode.js';
import { dataRouter } from './routes/data.js';
import { schedulerRouter } from './routes/scheduler.js';
import { schoolsRouter } from './routes/schools.js';
import { routesRouter } from './routes/routes.js';
import { streetsRouter } from './routes/streets.js';
import { neighborhoodsRouter } from './routes/neighborhoods.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/drive', driveRouter);
app.use('/api/geocode', geocodeRouter);
app.use('/api/data', dataRouter);
app.use('/api/scheduler', schedulerRouter);
app.use('/api/schools', schoolsRouter);
app.use('/api/routes', routesRouter);
app.use('/api/streets', streetsRouter);
app.use('/api/neighborhoods', neighborhoodsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Root route - helpful message
app.get('/', (req, res) => {
  res.json({ 
    message: 'PPS Bus Maps API Server',
    status: 'running',
    frontend: 'http://localhost:3000',
    endpoints: {
      health: '/api/health',
      drive: '/api/drive',
      geocode: '/api/geocode',
      routes: '/api/routes'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

