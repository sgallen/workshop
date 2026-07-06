import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProposalSetRecord } from '../core/types.js';
import { buildDocumentTurnPrompt, type DocumentAgentTurnInput } from './codex-agent.js';

function createInput(overrides: Partial<DocumentAgentTurnInput> = {}): DocumentAgentTurnInput {
  const activeProposalSet: ProposalSetRecord | null = overrides.activeProposalSet ?? null;

  return {
    documentPath: 'docs/project-brief.md',
    markdown: '# Project Brief\n\n## Problem\n\nExisting copy.\n',
    prompt: 'Please continue.',
    recentComments: overrides.recentComments ?? [],
    focusedSection: overrides.focusedSection ?? {
      id: 'problem',
      headingText: 'Problem',
      markdown: '## Problem\n\nExisting copy.\n'
    },
    sections: overrides.sections ?? [{
      id: 'problem',
      headingText: 'Problem',
      markdown: '## Problem\n\nExisting copy.\n'
    }],
    activeProposalSet
  };
}

test('buildDocumentTurnPrompt includes recent discussion continuity when comments exist', () => {
  const prompt = buildDocumentTurnPrompt(createInput({
    recentComments: [
      {
        authorType: 'human',
        body: 'Raise concerns one at a time and keep going.',
        sectionId: 'problem',
        createdAt: '2026-07-06T18:00:00.000Z'
      },
      {
        authorType: 'agent',
        body: 'What is the most important unresolved concern?',
        sectionId: null,
        createdAt: '2026-07-06T18:01:00.000Z'
      }
    ]
  }));

  assert.match(prompt, /Discussion thread so far:/);
  assert.match(prompt, /1\. Human \(2026-07-06T18:00:00\.000Z\)/);
  assert.match(prompt, /Section id: problem/);
  assert.match(prompt, /2\. Agent \(2026-07-06T18:01:00\.000Z\)/);
  assert.match(prompt, /Section id: null/);
  assert.match(prompt, /ask exactly one concrete unresolved question per turn/);
});

test('buildDocumentTurnPrompt calls out missing discussion history explicitly', () => {
  const prompt = buildDocumentTurnPrompt(createInput());

  assert.match(prompt, /Discussion thread so far: none/);
  assert.match(prompt, /There is no active proposal set\./);
});

test('buildDocumentTurnPrompt includes active pending proposal guidance and markdown', () => {
  const prompt = buildDocumentTurnPrompt(createInput({
    activeProposalSet: {
      id: 'ps_123',
      documentId: 'docs/project-brief.md',
      conversationTurnId: 'turn_123',
      status: 'pending',
      version: 2,
      summary: 'Tighten the problem section.',
      rationale: 'The current wording is too vague.',
      scope: 'section',
      focusedSectionId: 'problem',
      createdAt: '2026-07-06T18:02:00.000Z',
      items: [{
        id: 'pi_123',
        proposalSetId: 'ps_123',
        kind: 'replace_section',
        status: 'pending',
        sectionId: 'problem',
        targetLabel: 'Problem',
        beforeMarkdown: '## Problem\n\nExisting copy.\n',
        afterMarkdown: '## Problem\n\nTighter copy.\n',
        summary: 'Rewrite the problem section.',
        createdAt: '2026-07-06T18:02:00.000Z'
      }]
    }
  }));

  assert.match(prompt, /There is already one active pending proposal set\./);
  assert.match(prompt, /By default, treat the next user prompt as a refinement of that pending proposal/);
  assert.match(prompt, /Current proposal summary: Tighten the problem section\./);
  assert.match(prompt, /Current proposal focused section id: problem/);
  assert.match(prompt, /<current_pending_proposal_markdown>/);
  assert.match(prompt, /## Problem\n\nTighter copy\./);
});

test('buildDocumentTurnPrompt includes all pending proposal items in a multi-item active set', () => {
  const prompt = buildDocumentTurnPrompt(createInput({
    sections: [
      {
        id: 'problem',
        headingText: 'Problem',
        markdown: '## Problem\n\nExisting copy.\n'
      },
      {
        id: 'solution',
        headingText: 'Solution',
        markdown: '## Solution\n\nExisting solution.\n'
      }
    ],
    activeProposalSet: {
      id: 'ps_456',
      documentId: 'docs/project-brief.md',
      conversationTurnId: 'turn_456',
      status: 'pending',
      version: 1,
      summary: 'Tighten two sections.',
      rationale: 'Both sections need sharper wording.',
      scope: 'mixed',
      focusedSectionId: null,
      createdAt: '2026-07-06T18:03:00.000Z',
      items: [
        {
          id: 'pi_problem',
          proposalSetId: 'ps_456',
          kind: 'replace_section',
          status: 'pending',
          sectionId: 'problem',
          targetLabel: 'Problem',
          beforeMarkdown: '## Problem\n\nExisting copy.\n',
          afterMarkdown: '## Problem\n\nSharper problem framing.\n',
          summary: 'Rewrite problem.',
          createdAt: '2026-07-06T18:03:00.000Z'
        },
        {
          id: 'pi_solution',
          proposalSetId: 'ps_456',
          kind: 'replace_section',
          status: 'pending',
          sectionId: 'solution',
          targetLabel: 'Solution',
          beforeMarkdown: '## Solution\n\nExisting solution.\n',
          afterMarkdown: '## Solution\n\nSharper solution framing.\n',
          summary: 'Rewrite solution.',
          createdAt: '2026-07-06T18:03:00.000Z'
        }
      ]
    }
  }));

  assert.match(prompt, /Current proposal item 1 target section id: problem/);
  assert.match(prompt, /Current proposal item 2 target section id: solution/);
  assert.match(prompt, /## Problem\n\nSharper problem framing\./);
  assert.match(prompt, /## Solution\n\nSharper solution framing\./);
});
