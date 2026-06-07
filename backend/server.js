import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
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
import logger from './services/logger.js';
import { posthog } from './services/posthog.js';

dotenv.config();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

// Track server start time for uptime calculation
const serverStartTime = Date.now();

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? false : true), // Allow all origins in development for mobile testing
  credentials: true,
};

// In production without FRONTEND_URL, allow all origins (since frontend is served from same domain)
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  corsOptions.origin = true;
}

app.use(cors(corsOptions));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

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
  try {
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
  } catch (error) {
    logger.error('Error in health endpoint:', error);
    res.status(500).json({
      status: 'error',
      error: error.message || 'Internal server error',
      serverType: 'Backend API Server'
    });
  }
});

// Serve static files from frontend/dist in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendPath, {
    etag: false,
    lastModified: false,
    setHeaders: (res, path) => {
      // Disable caching for HTML files
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));

  // Serve index.html for all non-API routes (SPA routing)
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    // Disable caching for index.html to ensure fresh content
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    // Read file fresh each time to bypass any caching
    const indexPath = path.join(frontendPath, 'index.html');
    const content = readFileSync(indexPath, 'utf8');
    res.send(content);
  });
} else {
  // Development: helpful message
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
}

// Global error handler middleware (must be after all routes)
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  posthog.captureException(err, req.ip || 'anonymous', {
    method: req.method,
    path: req.path,
  });
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'An unexpected error occurred'
  });
});

// Start worker service - triggered restart
try {
  workerService.start();
} catch (error) {
  logger.error('Error starting worker service:', error);
  // Don't crash the server if worker service fails to start
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.warn('SIGTERM received, shutting down gracefully...');
  try {
    await workerService.stop();
    logger.info('Worker service stopped successfully');
  } catch (error) {
    logger.error('Error stopping worker service:', error);
  }
  await posthog.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.warn('SIGINT received, shutting down gracefully...');
  try {
    await workerService.stop();
    logger.info('Worker service stopped successfully');
  } catch (error) {
    logger.error('Error stopping worker service:', error);
  }
  await posthog.shutdown();
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Exit if it's a port binding error or other critical startup error
  if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
    logger.error(`Critical error ${error.code}. Exiting.`);
    process.exit(1);
  }
  // For other errors, a process supervisor (e.g., Docker/Coolify/systemd) can restart the process if we exit.
  // It's often safer to exit on uncaughtException as the process may be in an unstable state.
  logger.error('Exiting due to uncaught exception...');
  process.exit(1);
});

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  logger.info(`Worker service started with concurrency: ${process.env.WORKER_CONCURRENCY || 2}`);
});

