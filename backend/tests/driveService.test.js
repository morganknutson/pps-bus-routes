import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listFolderFiles } from '../services/driveService.js';

test('collects all Drive pages, excludes trashed files, and requests content checksums', async t => {
  const urls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    const parsed = new URL(url);
    urls.push(parsed);
    const data = parsed.searchParams.has('pageToken')
      ? { files: [{ id: 'second', name: 'b.pdf', modifiedTime: '2026-09-17', md5Checksum: 'bbb' }] }
      : { nextPageToken: 'next', files: [{ id: 'first', name: 'a.pdf', modifiedTime: '2026-09-18', md5Checksum: 'aaa' }] };
    return { ok: true, json: async () => data };
  });
  const files = await listFolderFiles('folder', 'test-key');
  assert.deepEqual(files.map(file => file.id), ['first', 'second']);
  assert.equal(urls[1].searchParams.get('pageToken'), 'next');
  assert.match(urls[0].searchParams.get('q'), /trashed=false/);
  assert.match(urls[0].searchParams.get('fields'), /md5Checksum/);
});

test('refuses an incomplete Drive listing rather than treating missing files as removed', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ files: [], incompleteSearch: true }) }));
  await assert.rejects(listFolderFiles('folder', 'test-key'), /incomplete folder listing/);
});
