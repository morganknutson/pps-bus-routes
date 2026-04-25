/**
 * Publishes generated route data after a successful sync run.
 *
 * This intentionally stages only generated data paths. It must never commit
 * application source changes that happen to be in a developer worktree.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..', '..');

const DEFAULT_PUBLISH_PATHS = [
    'data/schools',
    'data/cache',
    'data/routes.json',
    'data/schools.json',
    'data/neighborhoods.json',
    'data/attendance-boundaries.geojson',
    'data/school-photos.json',
    'data/file-ids-found.json',
];

function isEnabled(value) {
    return value === 'true' || value === '1' || value === 'yes';
}

function getPublishPaths() {
    const configured = process.env.GIT_PUBLISH_PATHS;
    if (!configured) return DEFAULT_PUBLISH_PATHS;

    return configured
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

function getCommitMessage(summary = {}) {
    const date = new Date().toISOString().slice(0, 10);
    const routesProcessed = summary.routesProcessed || 0;
    const pdfsDownloaded = summary.pdfsDownloaded || 0;

    return process.env.GIT_PUBLISH_COMMIT_MESSAGE
        || `Update PPS bus route data (${date})\n\nProcessed routes: ${routesProcessed}\nPDFs downloaded: ${pdfsDownloaded}`;
}

async function git(args, options = {}) {
    try {
        const result = await execFileAsync('git', args, {
            cwd: REPO_ROOT,
            maxBuffer: 10 * 1024 * 1024,
            env: {
                ...process.env,
                GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'PPS Bus Routes Bot',
                GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'automation@portlandschoolbuses.com',
                GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || process.env.GIT_AUTHOR_NAME || 'PPS Bus Routes Bot',
                GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || process.env.GIT_AUTHOR_EMAIL || 'automation@portlandschoolbuses.com',
            },
            ...options,
        });
        return result.stdout.trim();
    } catch (error) {
        error.message = sanitizeSecrets(error.message);
        error.cmd = sanitizeSecrets(error.cmd);
        error.stdout = sanitizeSecrets(error.stdout?.trim());
        error.stderr = sanitizeSecrets(error.stderr?.trim());
        throw error;
    }
}

function sanitizeSecrets(value) {
    if (!value) return value;
    const rawSecrets = [
        process.env.GITHUB_TOKEN,
        process.env.GH_TOKEN,
    ].filter(Boolean);
    const secrets = [
        ...rawSecrets,
        ...rawSecrets.map(secret => Buffer.from(`x-access-token:${secret}`).toString('base64')),
    ];

    return secrets.reduce((output, secret) => output.split(secret).join('[redacted]'), value);
}

async function getCurrentBranch() {
    const branch = await git(['branch', '--show-current']);
    if (!branch) {
        throw new Error('Cannot publish from a detached HEAD');
    }
    return branch;
}

async function getStagedFiles() {
    const output = await git(['diff', '--cached', '--name-only']);
    return output ? output.split('\n').filter(Boolean) : [];
}

async function hasStagedPublishChanges(paths) {
    try {
        await git(['diff', '--cached', '--quiet', '--', ...paths]);
        return false;
    } catch (error) {
        if (error.code === 1) return true;
        throw error;
    }
}

async function getPublishDiffSummary(paths) {
    const output = await git(['diff', '--cached', '--name-status', '--', ...paths]);
    if (!output) {
        return {
            filesChanged: 0,
            files: [],
        };
    }

    const files = output.split('\n').filter(Boolean);
    return {
        filesChanged: files.length,
        files: files.slice(0, 50),
    };
}

function getGithubAuthHeader() {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (!token) return null;
    const encoded = Buffer.from(`x-access-token:${token}`).toString('base64');
    return `Authorization: Basic ${encoded}`;
}

async function pushCommit(branch) {
    const remote = process.env.GIT_PUBLISH_REMOTE || 'origin';
    const remoteUrl = await git(['remote', 'get-url', '--push', remote]);
    const authHeader = remoteUrl.startsWith('https://github.com/') ? getGithubAuthHeader() : null;
    const pushArgs = authHeader
        ? ['-c', `http.extraHeader=${authHeader}`, 'push', remoteUrl, `HEAD:${branch}`]
        : ['push', remoteUrl, `HEAD:${branch}`];

    await git(pushArgs);
}

async function validatePushConfig() {
    if (process.env.GIT_PUBLISH_PUSH === 'false') return;

    const remote = process.env.GIT_PUBLISH_REMOTE || 'origin';
    const remoteUrl = await git(['remote', 'get-url', '--push', remote]);
    const isGithubHttps = remoteUrl.startsWith('https://github.com/');
    const hasToken = !!(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);

    if (isGithubHttps && !hasToken && !isEnabled(process.env.GIT_PUBLISH_ALLOW_CONTAINER_CREDENTIALS)) {
        throw new Error('GIT_PUBLISH_PUSH is enabled for a GitHub HTTPS remote, but GITHUB_TOKEN/GH_TOKEN is not configured');
    }
}

async function publishGeneratedData(summary = {}) {
    if (!isEnabled(process.env.ENABLE_GIT_PUBLISH)) {
        return {
            status: 'skipped',
            reason: 'ENABLE_GIT_PUBLISH is not true',
        };
    }

    const paths = getPublishPaths();
    if (paths.length === 0) {
        return {
            status: 'skipped',
            reason: 'No publish paths configured',
        };
    }

    logger.info(`[GitPublishService] Publishing generated data paths: ${paths.join(', ')}`);

    await validatePushConfig();

    const stagedFiles = await getStagedFiles();
    if (stagedFiles.length > 0) {
        throw new Error(`Refusing to publish with existing staged changes: ${stagedFiles.slice(0, 10).join(', ')}`);
    }

    await git(['add', '-A', '--', ...paths]);

    const hasChanges = await hasStagedPublishChanges(paths);
    if (!hasChanges) {
        return {
            status: 'skipped',
            reason: 'No generated data changes to commit',
            paths,
        };
    }

    const diffSummary = await getPublishDiffSummary(paths);
    const branch = await getCurrentBranch();
    await git(['commit', '-m', getCommitMessage(summary)]);

    let pushed = false;
    if (process.env.GIT_PUBLISH_PUSH !== 'false') {
        await pushCommit(branch);
        pushed = true;
    }

    return {
        status: 'completed',
        branch,
        pushed,
        paths,
        ...diffSummary,
    };
}

export {
    publishGeneratedData,
    DEFAULT_PUBLISH_PATHS,
};
