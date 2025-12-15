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
import { verificationRouter } from './routes/verification.js';
import { pdfStatusRouter } from './routes/pdfStatus.js';
import { pdfSyncRouter } from './routes/pdfSync.js';
import { processPdfsRouter } from './routes/processPdfs.js';
import { jobsRouter } from './routes/jobs.js';
import { pdfsRouter } from './routes/pdfs.js';
import { serversRouter } from './routes/servers.js';
import { workerService } from './services/jobQueue/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Track server start time for uptime calculation
const serverStartTime = Date.now();

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
app.use('/api/verification', verificationRouter);
app.use('/api/pdf-status', pdfStatusRouter);
app.use('/api/pdf-sync', pdfSyncRouter);
app.use('/api/process-pdfs', processPdfsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/pdfs', pdfsRouter);
app.use('/api/servers', serversRouter);

// Health check
app.get('/api/health', (req, res) => {
  const uptimeMs = Date.now() - serverStartTime;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  const uptimeDays = Math.floor(uptimeHours / 24);
  
  // Format uptime
  let uptimeString = '';
  if (uptimeDays > 0) {
    uptimeString = `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m`;
  } else if (uptimeHours > 0) {
    uptimeString = `${uptimeHours}h ${uptimeMinutes % 60}m`;
  } else if (uptimeMinutes > 0) {
    uptimeString = `${uptimeMinutes}m ${uptimeSeconds % 60}s`;
  } else {
    uptimeString = `${uptimeSeconds}s`;
  }
  
  res.json({ 
    status: 'ok',
    serverType: 'Backend API Server',
    uptime: uptimeString,
    uptimeMs: uptimeMs
  });
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

// Start worker service
workerService.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await workerService.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await workerService.stop();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Worker service started with concurrency: ${process.env.WORKER_CONCURRENCY || 2}`);
});

