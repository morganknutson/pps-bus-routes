/**
 * Email Service
 * Sends email notifications for sync errors and status updates
 */

import nodemailer from 'nodemailer';
import logger from './logger.js';

// Create transporter (configured via environment variables)
let transporter = null;

/**
 * Initialize the email transporter
 * Returns null if email is not configured
 */
function getTransporter() {
    if (transporter) {
        return transporter;
    }

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        logger.warn('[EmailService] Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables.');
        return null;
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user,
            pass,
        },
    });

    return transporter;
}

/**
 * Get the admin email address
 */
function getAdminEmail() {
    return process.env.ADMIN_EMAIL || null;
}

/**
 * Get the from email address
 */
function getFromEmail() {
    return process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com';
}

/**
 * Send an error notification email
 * @param {Array} errors - Array of error objects with schoolId, phase, error message
 * @param {object} context - Additional context (startTime, endTime, totalSchools, etc.)
 */
async function sendErrorNotification(errors, context = {}) {
    const transport = getTransporter();
    const adminEmail = getAdminEmail();

    if (!transport) {
        logger.warn('[EmailService] Cannot send error notification - email not configured');
        return { success: false, reason: 'Email not configured' };
    }

    if (!adminEmail) {
        logger.warn('[EmailService] Cannot send error notification - ADMIN_EMAIL not set');
        return { success: false, reason: 'ADMIN_EMAIL not configured' };
    }

    const errorCount = errors.length;
    const timestamp = new Date().toISOString();

    // Group errors by phase
    const errorsByPhase = {};
    for (const error of errors) {
        const phase = error.phase || 'unknown';
        if (!errorsByPhase[phase]) {
            errorsByPhase[phase] = [];
        }
        errorsByPhase[phase].push(error);
    }

    // Build HTML email
    let html = `
    <h2>⚠️ Weekly Sync Errors</h2>
    <p>The weekly sync encountered <strong>${errorCount}</strong> error(s) on ${timestamp}.</p>
  `;

    if (context.totalSchools) {
        html += `<p>Schools processed: ${context.schoolsProcessed || 0} / ${context.totalSchools}</p>`;
    }

    if (context.duration) {
        html += `<p>Duration: ${context.duration}</p>`;
    }

    html += `<hr>`;

    for (const [phase, phaseErrors] of Object.entries(errorsByPhase)) {
        html += `<h3>${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase (${phaseErrors.length} errors)</h3>`;
        html += `<ul>`;
        for (const error of phaseErrors) {
            html += `<li><strong>${error.schoolId || 'Unknown'}</strong>: ${error.error || error.message || 'Unknown error'}</li>`;
        }
        html += `</ul>`;
    }

    html += `
    <hr>
    <p style="color: #666; font-size: 12px;">
      This is an automated message from the PPS Bus Maps weekly sync system.
    </p>
  `;

    // Build plain text version
    let text = `Weekly Sync Errors\n\n`;
    text += `The weekly sync encountered ${errorCount} error(s) on ${timestamp}.\n\n`;

    for (const [phase, phaseErrors] of Object.entries(errorsByPhase)) {
        text += `${phase.toUpperCase()} PHASE (${phaseErrors.length} errors):\n`;
        for (const error of phaseErrors) {
            text += `  - ${error.schoolId || 'Unknown'}: ${error.error || error.message || 'Unknown error'}\n`;
        }
        text += `\n`;
    }

    try {
        await transport.sendMail({
            from: getFromEmail(),
            to: adminEmail,
            subject: `⚠️ PPS Bus Maps: ${errorCount} Error(s) in Weekly Sync`,
            text,
            html,
        });

        logger.info(`[EmailService] Error notification sent to ${adminEmail}`);
        return { success: true };
    } catch (error) {
        logger.error('[EmailService] Failed to send error notification:', error);
        return { success: false, reason: error.message };
    }
}

/**
 * Send a success/summary notification email
 * @param {object} results - Sync results summary
 */
async function sendSuccessNotification(results) {
    const transport = getTransporter();
    const adminEmail = getAdminEmail();

    if (!transport || !adminEmail) {
        return { success: false, reason: 'Email not configured' };
    }

    const timestamp = new Date().toISOString();

    const html = `
    <h2>✅ Weekly Sync Completed</h2>
    <p>The weekly sync completed successfully on ${timestamp}.</p>
    
    <h3>Summary</h3>
    <ul>
      <li>Schools checked: ${results.totalSchools || 0}</li>
      <li>Schools with updates: ${results.schoolsWithUpdates || 0}</li>
      <li>PDFs downloaded: ${results.pdfsDownloaded || 0}</li>
      <li>Routes processed: ${results.routesProcessed || 0}</li>
      <li>Errors: ${results.errorCount || 0}</li>
    </ul>
    
    ${results.duration ? `<p>Duration: ${results.duration}</p>` : ''}
    
    <hr>
    <p style="color: #666; font-size: 12px;">
      This is an automated message from the PPS Bus Maps weekly sync system.
    </p>
  `;

    const text = `Weekly Sync Completed\n\n` +
        `The weekly sync completed successfully on ${timestamp}.\n\n` +
        `Summary:\n` +
        `  - Schools checked: ${results.totalSchools || 0}\n` +
        `  - Schools with updates: ${results.schoolsWithUpdates || 0}\n` +
        `  - PDFs downloaded: ${results.pdfsDownloaded || 0}\n` +
        `  - Routes processed: ${results.routesProcessed || 0}\n` +
        `  - Errors: ${results.errorCount || 0}\n`;

    try {
        await transport.sendMail({
            from: getFromEmail(),
            to: adminEmail,
            subject: `✅ PPS Bus Maps: Weekly Sync Completed`,
            text,
            html,
        });

        logger.info(`[EmailService] Success notification sent to ${adminEmail}`);
        return { success: true };
    } catch (error) {
        logger.error('[EmailService] Failed to send success notification:', error);
        return { success: false, reason: error.message };
    }
}

/**
 * Test email configuration
 */
async function testEmailConfig() {
    const transport = getTransporter();
    const adminEmail = getAdminEmail();

    if (!transport) {
        return { success: false, reason: 'Email not configured - missing SMTP_HOST, SMTP_USER, or SMTP_PASS' };
    }

    if (!adminEmail) {
        return { success: false, reason: 'ADMIN_EMAIL not configured' };
    }

    try {
        await transport.verify();
        return { success: true, message: `Email configured. Will send to ${adminEmail}` };
    } catch (error) {
        return { success: false, reason: `SMTP connection failed: ${error.message}` };
    }
}

export {
    sendErrorNotification,
    sendSuccessNotification,
    testEmailConfig,
};
