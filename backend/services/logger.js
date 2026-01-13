import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log directory (relative to backend root)
const logDir = path.join(__dirname, '../../logs');

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (stack) {
        msg += `\n${stack}`;
    }
    if (Object.keys(metadata).length > 0 && level !== 'error') {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat
    ),
    transports: [
        // Console transport for both dev and prod (PM2 captures console)
        new winston.transports.Console({
            format: combine(
                colorize(),
                logFormat
            )
        })
    ]
});

// Add file transports only in production
if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.DailyRotateFile({
        filename: path.join(logDir, 'backend-error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxFiles: '14d',
        zippedArchive: true
    }));

    logger.add(new winston.transports.DailyRotateFile({
        filename: path.join(logDir, 'backend-combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
        zippedArchive: true
    }));
}

export default logger;
