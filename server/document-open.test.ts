import test from 'node:test';
import assert from 'node:assert/strict';
import type { Artifact } from '../core/types.js';
import { buildArtifactOpenResult, buildDocumentUrl } from './document-open.js';

function createArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    title: overrides.title ?? 'project-brief.md',
    relativePath: overrides.relativePath ?? 'docs/project-brief.md',
    absolutePath: overrides.absolutePath ?? '/tmp/project-brief.md',
    updatedAt: overrides.updatedAt ?? '2026-07-07T11:30:00.000Z',
    markdown: overrides.markdown ?? '# Project Brief\n',
    renderedHtml: overrides.renderedHtml ?? '<h1>Project Brief</h1>',
    comments: overrides.comments ?? [],
    sections: overrides.sections ?? []
  };
}

test('buildDocumentUrl returns a stable shareable path query', () => {
  assert.equal(buildDocumentUrl('docs/project brief.md'), '/?path=docs%2Fproject+brief.md');
});

test('buildArtifactOpenResult returns stable handoff metadata beside artifact state', () => {
  const artifact = createArtifact({ title: 'Workshop Project Brief' });
  const result = buildArtifactOpenResult({
    artifact,
    proposalSet: null,
    latestProposalSet: null,
    proposalHistory: [],
    revisions: [],
    checkpoints: [],
    resumed: true
  });

  assert.equal(result.documentUrl, '/?path=docs%2Fproject-brief.md');
  assert.equal(result.resolvedPath, 'docs/project-brief.md');
  assert.equal(result.title, 'Workshop Project Brief');
  assert.equal(result.resumed, true);
  assert.equal(result.artifact, artifact);
});

test('buildArtifactOpenResult preserves a fresh-open result distinctly from resume', () => {
  const artifact = createArtifact({ relativePath: 'notes/daily/2026-07-07.md' });
  const result = buildArtifactOpenResult({
    artifact,
    proposalSet: null,
    latestProposalSet: null,
    proposalHistory: [],
    revisions: [],
    checkpoints: [],
    resumed: false
  });

  assert.equal(result.documentUrl, '/?path=notes%2Fdaily%2F2026-07-07.md');
  assert.equal(result.resolvedPath, 'notes/daily/2026-07-07.md');
  assert.equal(result.resumed, false);
});
