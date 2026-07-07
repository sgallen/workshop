import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createJsonFileStore } from './store.js';
import type { CheckpointRecord, RevisionRecord } from '../core/types.js';

async function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'workshop-store-test-'));
}

function createRevision(overrides: Partial<RevisionRecord> = {}): RevisionRecord {
  return {
    id: overrides.id ?? 'rev-1',
    documentId: overrides.documentId ?? 'docs/project-brief.md',
    createdAt: overrides.createdAt ?? '2026-07-07T04:00:00.000Z',
    summary: overrides.summary ?? 'Manual save.',
    source: overrides.source ?? 'manual_save',
    proposalSetId: overrides.proposalSetId ?? null,
    markdown: overrides.markdown ?? '# Draft\n'
  };
}

function createCheckpoint(overrides: Partial<CheckpointRecord> = {}): CheckpointRecord {
  return {
    id: overrides.id ?? 'chk-1',
    documentId: overrides.documentId ?? 'docs/project-brief.md',
    revisionId: overrides.revisionId ?? 'rev-1',
    createdAt: overrides.createdAt ?? '2026-07-07T04:05:00.000Z',
    label: overrides.label ?? 'Before rewrite',
    summary: overrides.summary ?? 'Before rewrite',
    source: overrides.source ?? 'manual',
    sourceCheckpointId: overrides.sourceCheckpointId ?? null
  };
}

test('createJsonFileStore defaults checkpoints to an empty map and migrates legacy recents', async () => {
  const rootDir = await createTempRoot();

  try {
    const dataDir = path.join(rootDir, '.workshop-data');
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(path.join(dataDir, 'comments.json'), JSON.stringify({
      artifacts: {},
      recents: [{
        title: 'Project Brief',
        relativePath: 'docs/project-brief.md',
        updatedAt: '2026-07-07T04:00:00.000Z',
        lastOpenedAt: '2026-07-07T04:01:00.000Z',
        lastDiscussedAt: '2026-07-07T04:02:00.000Z',
        commentCount: 0
      }]
    }, null, 2));

    const storeApi = createJsonFileStore(rootDir);
    const store = await storeApi.readStore();

    assert.deepEqual(store.checkpointsByDocument, {});
    assert.equal(store.recents, undefined);
    assert.equal(store.artifacts['docs/project-brief.md']?.title, 'Project Brief');
    assert.equal(store.artifacts['docs/project-brief.md']?.lastDiscussedAt, '2026-07-07T04:02:00.000Z');
    assert.deepEqual(storeApi.getCheckpoints(store, 'docs/project-brief.md'), []);
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test('createJsonFileStore persists checkpoints alongside revisions', async () => {
  const rootDir = await createTempRoot();

  try {
    const storeApi = createJsonFileStore(rootDir);
    const store = await storeApi.readStore();
    const relativePath = 'docs/project-brief.md';
    const revision = createRevision();
    const checkpoint = createCheckpoint();

    storeApi.getRevisions(store, relativePath).push(revision);
    storeApi.getCheckpoints(store, relativePath).push(checkpoint);
    await storeApi.writeStore(store);

    const reloaded = await storeApi.readStore();

    assert.deepEqual(reloaded.revisionsByDocument?.[relativePath], [revision]);
    assert.deepEqual(reloaded.checkpointsByDocument?.[relativePath], [checkpoint]);
    assert.deepEqual(storeApi.getCheckpoints(reloaded, relativePath), [checkpoint]);
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test('touchRecentArtifact onlyIfUntracked does not treat file metadata alone as a resumed open', async () => {
  const rootDir = await createTempRoot();

  try {
    const storeApi = createJsonFileStore(rootDir);
    const store = await storeApi.readStore();
    const artifact = {
      title: 'Project Brief',
      relativePath: 'docs/project-brief.md',
      updatedAt: '2026-07-07T12:00:00.000Z'
    };

    const firstTouch = storeApi.touchRecentArtifact(store, artifact, { onlyIfUntracked: true });
    const secondTouch = storeApi.touchRecentArtifact(store, artifact, { onlyIfUntracked: true });

    assert.equal(firstTouch, true);
    assert.equal(secondTouch, false);
    assert.ok(store.artifacts['docs/project-brief.md']?.lastOpenedAt);
    assert.equal(store.artifacts['docs/project-brief.md']?.updatedAt, '2026-07-07T12:00:00.000Z');
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});
