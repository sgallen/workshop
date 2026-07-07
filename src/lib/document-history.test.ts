import test from 'node:test';
import assert from 'node:assert/strict';
import type { CheckpointRecord, RevisionRecord } from '../../core/types';
import { buildHistoryEntries, getShortSentence } from './document-history';

function createRevision(overrides: Partial<RevisionRecord> = {}): RevisionRecord {
  return {
    id: overrides.id ?? 'rev-1',
    documentId: overrides.documentId ?? 'docs/project-brief.md',
    createdAt: overrides.createdAt ?? '2026-07-06T21:00:00.000Z',
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
    createdAt: overrides.createdAt ?? '2026-07-06T21:05:00.000Z',
    label: overrides.label ?? 'Ready to review',
    summary: overrides.summary ?? 'Ready to review',
    source: overrides.source ?? 'manual',
    sourceCheckpointId: overrides.sourceCheckpointId ?? null
  };
}

test('getShortSentence keeps the first sentence and truncates long text', () => {
  assert.equal(getShortSentence('First sentence. Second sentence.'), 'First sentence.');
  assert.equal(getShortSentence('   '), null);
  assert.match(getShortSentence('x'.repeat(200)) ?? '', /\.\.\.$/);
});

test('buildHistoryEntries keeps checkpoints first-class and marks the newest current checkpoint', () => {
  const revisions = [
    createRevision({ id: 'rev-3', createdAt: '2026-07-06T22:10:00.000Z', summary: 'Current draft.' }),
    createRevision({ id: 'rev-2', createdAt: '2026-07-06T21:10:00.000Z', summary: 'Earlier draft.' }),
    createRevision({ id: 'rev-1', createdAt: '2026-07-06T20:10:00.000Z', summary: 'Oldest draft.' })
  ];
  const checkpoints = [
    createCheckpoint({ id: 'chk-3', revisionId: 'rev-3', createdAt: '2026-07-06T22:12:00.000Z', label: 'Current checkpoint' }),
    createCheckpoint({ id: 'chk-2', revisionId: 'rev-2', createdAt: '2026-07-06T21:12:00.000Z', label: 'Earlier checkpoint', source: 'restore' })
  ];

  const entries = buildHistoryEntries({
    revisions,
    checkpoints,
    highlightedCheckpointId: 'chk-2'
  });

  assert.deepEqual(entries.map((entry) => entry.id), ['chk-3', 'chk-2', 'rev-1']);
  assert.equal(entries[0]?.current, true);
  assert.equal(entries[0]?.kind, 'manual');
  assert.equal(entries[0]?.title, 'Current checkpoint');
  assert.equal(entries[1]?.kind, 'automatic');
  assert.equal(entries[1]?.highlighted, true);
  assert.equal(entries[2]?.checkpointId, null);
  assert.equal(entries[1]?.typeLabel, 'Auto');
  assert.match(entries[1]?.distanceLabel ?? '', /1 back/);
});

test('buildHistoryEntries falls back to the latest automatic revision when no checkpoint marks the current state', () => {
  const revisions = [
    createRevision({ id: 'rev-2', createdAt: '2026-07-06T22:10:00.000Z', summary: 'Current revision without checkpoint.' }),
    createRevision({ id: 'rev-1', createdAt: '2026-07-06T21:10:00.000Z', summary: 'Older revision.' })
  ];
  const checkpoints = [
    createCheckpoint({ id: 'chk-1', revisionId: 'rev-1', createdAt: '2026-07-06T21:12:00.000Z', label: 'Saved point' })
  ];

  const entries = buildHistoryEntries({
    revisions,
    checkpoints,
    highlightedRevisionId: 'rev-2'
  });

  assert.deepEqual(entries.map((entry) => entry.id), ['rev-2', 'chk-1']);
  assert.equal(entries[0]?.current, true);
  assert.equal(entries[0]?.kind, 'manual');
  assert.equal(entries[0]?.title, 'Current version');
  assert.equal(entries[0]?.highlighted, true);
  assert.equal(entries[1]?.current, false);
});

test('buildHistoryEntries keeps automatic entry distance tied to the full revision timeline', () => {
  const revisions = [
    createRevision({ id: 'rev-4', createdAt: '2026-07-06T23:10:00.000Z', summary: 'Current revision.' }),
    createRevision({ id: 'rev-3', createdAt: '2026-07-06T22:10:00.000Z', summary: 'Auto revision one back.' }),
    createRevision({ id: 'rev-2', createdAt: '2026-07-06T21:10:00.000Z', summary: 'Checkpointed revision.' }),
    createRevision({ id: 'rev-1', createdAt: '2026-07-06T20:10:00.000Z', summary: 'Older auto revision.' })
  ];
  const checkpoints = [
    createCheckpoint({ id: 'chk-4', revisionId: 'rev-4', createdAt: '2026-07-06T23:12:00.000Z', label: 'Current checkpoint' }),
    createCheckpoint({ id: 'chk-2', revisionId: 'rev-2', createdAt: '2026-07-06T21:12:00.000Z', label: 'Earlier checkpoint' })
  ];

  const entries = buildHistoryEntries({
    revisions,
    checkpoints
  });

  const autoOneBack = entries.find((entry) => entry.id === 'rev-3');
  const autoThreeBack = entries.find((entry) => entry.id === 'rev-1');

  assert.match(autoOneBack?.distanceLabel ?? '', /1 back/);
  assert.match(autoThreeBack?.distanceLabel ?? '', /3 back/);
});

test('buildHistoryEntries labels manual-save revisions as manual edits when they are not checkpoints', () => {
  const revisions = [
    createRevision({ id: 'rev-3', createdAt: '2026-07-06T23:10:00.000Z', summary: 'Current revision.', source: 'restore_revision' }),
    createRevision({ id: 'rev-2', createdAt: '2026-07-06T22:10:00.000Z', summary: 'Manual change.', source: 'manual_save' }),
    createRevision({ id: 'rev-1', createdAt: '2026-07-06T21:10:00.000Z', summary: 'Older auto revision.', source: 'proposal_item_accept' })
  ];

  const entries = buildHistoryEntries({
    revisions,
    checkpoints: []
  });

  assert.equal(entries[1]?.title, 'Manual edit');
  assert.equal(entries[1]?.kind, 'manual');
  assert.equal(entries[1]?.typeLabel, 'Manual');
});
