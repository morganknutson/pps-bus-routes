import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PdfSyncPolicy } from '../services/pdfSyncPolicy.js';

test('same-name revisions and checksum mismatches survive checkout timestamp resets', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pps-sync-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const pdf = path.join(dir, 'route.pdf');
  fs.writeFileSync(pdf, 'old content');
  fs.utimesSync(pdf, new Date(), new Date());
  const previous = { filename: 'route.pdf', modifiedTime: '2026-06-01T00:00:00Z' };
  const revision = { id: 'same-id', name: 'route.pdf', modifiedTime: '2026-06-16T00:00:00Z' };
  assert.equal(PdfSyncPolicy.needsDownload(revision, previous, pdf), true);
  assert.equal(PdfSyncPolicy.needsDownload(revision, { ...previous, modifiedTime: revision.modifiedTime }, pdf), false);
  revision.md5Checksum = createHash('md5').update('new content').digest('hex');
  assert.equal(PdfSyncPolicy.needsDownload(revision, { ...previous, modifiedTime: revision.modifiedTime }, pdf), true);
  fs.writeFileSync(pdf, 'new content');
  assert.equal(PdfSyncPolicy.needsDownload(revision, { ...previous, modifiedTime: revision.modifiedTime }, pdf), false);
  assert.equal(PdfSyncPolicy.needsDownload(revision, undefined, pdf), true);
});

test('missing, corrupt, and school-only routes require repair', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pps-route-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const json = path.join(dir, 'route.json');
  assert.equal(PdfSyncPolicy.needsProcessing(json), true);
  fs.writeFileSync(json, '{bad json');
  assert.equal(PdfSyncPolicy.needsProcessing(json), true);
  fs.writeFileSync(json, JSON.stringify({ stops: [{ isSchoolStop: true }] }));
  assert.equal(PdfSyncPolicy.needsProcessing(json), true);
  fs.writeFileSync(json, JSON.stringify({ stops: [{ isSchoolStop: true }, { address: 'NE 1st & NE Main' }] }));
  assert.equal(PdfSyncPolicy.needsProcessing(json), false);
});

test('finds orphan route JSON even when its source PDF was already removed', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pps-orphan-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'processed-routes'));
  fs.writeFileSync(path.join(dir, 'processed-routes', 'old.json'), '{}');
  fs.writeFileSync(path.join(dir, 'processed-routes', 'current.json'), '{}');
  assert.deepEqual(PdfSyncPolicy.orphanedRoutes([{ name: 'current.pdf' }], dir), ['old.json']);
});
