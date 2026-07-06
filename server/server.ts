import express, { type Request, type Response } from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMarkdownSections } from '../core/sections/parse-markdown-sections.js';
import type {
  Artifact,
  ProposalItemRecord,
  ProposalMutationResult,
  ProposalSetRecord,
  ProposalSetStatus,
  Section,
  RevisionRecord
} from '../core/types.js';
import {
  disconnectAgent,
  getAgentAuthStatus,
  runDocumentAgentTurn,
  startAgentConnect
} from './codex-agent.js';
import { createDocumentService } from './documents.js';
import { createJsonFileStore, type ArtifactEntry, type Store } from './store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.resolve(ROOT_DIR, '..');
const PORT = Number(process.env.WORKSHOP_SERVER_PORT ?? 4174);
const DEFAULT_ARTIFACT_PATH = 'docs/project-brief.md';
const DEFAULT_CREATION_DIR = 'docs';
const APP_ORIGIN = process.env.WORKSHOP_APP_ORIGIN?.trim() || '';

const app = express();
app.use(express.json());
const artifactStore = createJsonFileStore(ROOT_DIR);
const documentService = createDocumentService({
  rootDir: ROOT_DIR,
  sourceRoot: SOURCE_ROOT,
  defaultArtifactPath: DEFAULT_ARTIFACT_PATH,
  readArtifactEntry: async (relativePath: string): Promise<ArtifactEntry> => {
    const currentStore = await artifactStore.readStore();
    return artifactStore.getArtifactEntry(currentStore, relativePath);
  }
});

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function slugifyFileName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function getAppOrigin(request: Request): string {
  if (APP_ORIGIN) {
    return APP_ORIGIN.replace(/\/+$/, '');
  }

  const forwardedHost = request.headers['x-forwarded-host'];
  const host = typeof forwardedHost === 'string' ? forwardedHost : request.headers.host;
  const forwardedProto = request.headers['x-forwarded-proto'];
  const proto = typeof forwardedProto === 'string' ? forwardedProto : 'http';

  if (!host) {
    return 'http://127.0.0.1:4173';
  }

  return `${proto}://${host.replace(/:\d+$/, ':4173')}`;
}

function listLatestRevisions(store: Store, relativePath: string): RevisionRecord[] {
  return [...artifactStore.getRevisions(store, relativePath)].reverse();
}

function refreshProposalSetStatus(proposalSet: ProposalSetRecord): ProposalSetRecord {
  if (!Number.isFinite(proposalSet.version) || proposalSet.version < 1) {
    proposalSet.version = 1;
  }

  if (proposalSet.status === 'superseded') {
    return proposalSet;
  }

  const pendingCount = proposalSet.items.filter((item) => item.status === 'pending').length;
  const appliedCount = proposalSet.items.filter((item) => item.status === 'applied').length;

  let status: ProposalSetStatus;

  if (pendingCount === 0 && appliedCount === 0) {
    status = 'dismissed';
  } else if (pendingCount === 0 && appliedCount > 0) {
    status = 'applied';
  } else if (appliedCount > 0) {
    status = 'partially_applied';
  } else {
    status = 'pending';
  }

  proposalSet.status = status;
  return proposalSet;
}

function getActiveProposalSet(store: Store, relativePath: string): ProposalSetRecord | null {
  const proposalSets = artifactStore.getProposalSets(store, relativePath);

  for (let index = proposalSets.length - 1; index >= 0; index -= 1) {
    const proposalSet = refreshProposalSetStatus(proposalSets[index]);

    if (proposalSet.items.some((item) => item.status === 'pending')) {
      return proposalSet;
    }
  }

  return null;
}

function getLatestProposalSet(store: Store, relativePath: string): ProposalSetRecord | null {
  const proposalSets = listProposalHistory(store, relativePath);

  if (proposalSets.length === 0) {
    return null;
  }

  return proposalSets[proposalSets.length - 1];
}

function listProposalHistory(store: Store, relativePath: string): ProposalSetRecord[] {
  return [...artifactStore.getProposalSets(store, relativePath)]
    .map((proposalSet) => refreshProposalSetStatus(proposalSet))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

function saveProposalSet(store: Store, relativePath: string, proposalSet: ProposalSetRecord): void {
  const proposalSets = artifactStore.getProposalSets(store, relativePath);
  const existingIndex = proposalSets.findIndex((candidate) => candidate.id === proposalSet.id);

  if (existingIndex >= 0) {
    proposalSets[existingIndex] = proposalSet;
    return;
  }

  const previousActiveProposal = getActiveProposalSet(store, relativePath);

  if (previousActiveProposal && previousActiveProposal.id !== proposalSet.id) {
    previousActiveProposal.items = previousActiveProposal.items.map((item) => {
      return item.status === 'pending'
        ? {
            ...item,
            status: 'dismissed'
          }
        : item;
    });
    refreshProposalSetStatus(previousActiveProposal);
  }

  proposalSets.push(proposalSet);
}

function buildPendingReplaceSectionItem(
  proposalSetId: string,
  targetSection: Section,
  summary: string,
  afterMarkdown: string,
  createdAt: string
): ProposalItemRecord {
  return {
    id: createId('pi'),
    proposalSetId,
    kind: 'replace_section',
    status: 'pending',
    sectionId: targetSection.id,
    targetLabel: renderSectionTargetLabel(targetSection.markdown, targetSection.headingText),
    beforeMarkdown: targetSection.markdown,
    afterMarkdown,
    summary,
    createdAt
  };
}

function archiveSupersededProposalSetVersion(store: Store, relativePath: string, proposalSet: ProposalSetRecord): void {
  const archivedProposalSetId = createId('ps');
  const archivedProposalSet: ProposalSetRecord = {
    ...proposalSet,
    id: archivedProposalSetId,
    status: 'superseded',
    items: proposalSet.items.map((item) => ({
      ...item,
      id: createId('pi'),
      proposalSetId: archivedProposalSetId,
      status: item.status === 'pending' ? 'dismissed' : item.status
    }))
  };

  artifactStore.getProposalSets(store, relativePath).push(archivedProposalSet);
}

function upsertActiveProposalSet(
  store: Store,
  relativePath: string,
  artifact: Artifact,
  humanTurnId: string,
  agentCreatedAt: string,
  proposal: {
    summary: string;
    rationale: string;
    items: Array<{
      summary: string;
      targetSectionId: string;
      afterMarkdown: string;
    }>;
  }
): ProposalSetRecord | null {
  const validItems = proposal.items.flatMap((item) => {
    const targetSection = artifact.sections.find((section) => section.id === item.targetSectionId);
    const afterMarkdown = item.afterMarkdown.trim();

    if (!targetSection || !afterMarkdown) {
      return [];
    }

    return [{
      targetSection,
      afterMarkdown,
      summary: item.summary.trim() || `Update ${targetSection.headingText}`
    }];
  });

  if (validItems.length === 0) {
    return null;
  }

  const dedupedItems = validItems.filter((item, index, items) => {
    return items.findIndex((candidate) => candidate.targetSection.id === item.targetSection.id) === index;
  });
  const uniqueSectionIds = dedupedItems.map((item) => item.targetSection.id);
  const summary = proposal.summary.trim()
    || (dedupedItems.length === 1
      ? dedupedItems[0].summary
      : `Update ${dedupedItems.length} sections`);
  const scope = uniqueSectionIds.length === 1 ? 'section' : 'mixed';
  const focusedSectionId = uniqueSectionIds.length === 1 ? uniqueSectionIds[0] : null;
  const existingActiveProposal = getActiveProposalSet(store, relativePath);

  if (existingActiveProposal) {
    archiveSupersededProposalSetVersion(store, relativePath, existingActiveProposal);
    existingActiveProposal.conversationTurnId = humanTurnId;
    existingActiveProposal.status = 'pending';
    existingActiveProposal.version = (existingActiveProposal.version ?? 1) + 1;
    existingActiveProposal.summary = summary;
    existingActiveProposal.rationale = proposal.rationale.trim();
    existingActiveProposal.scope = scope;
    existingActiveProposal.focusedSectionId = focusedSectionId;
    existingActiveProposal.createdAt = agentCreatedAt;
    existingActiveProposal.items = dedupedItems.map((item) => {
      return buildPendingReplaceSectionItem(
        existingActiveProposal.id,
        item.targetSection,
        item.summary,
        item.afterMarkdown,
        agentCreatedAt
      );
    });
    return existingActiveProposal;
  }

  const proposalSetId = createId('ps');
  const proposalSet: ProposalSetRecord = {
    id: proposalSetId,
    documentId: artifact.relativePath,
    conversationTurnId: humanTurnId,
    status: 'pending',
    version: 1,
    summary,
    rationale: proposal.rationale.trim(),
    scope,
    focusedSectionId,
    createdAt: agentCreatedAt,
    items: dedupedItems.map((item) => {
      return buildPendingReplaceSectionItem(
        proposalSetId,
        item.targetSection,
        item.summary,
        item.afterMarkdown,
        agentCreatedAt
      );
    })
  };

  saveProposalSet(store, relativePath, proposalSet);
  return proposalSet;
}

function appendRevision(store: Store, relativePath: string, revision: RevisionRecord): void {
  artifactStore.getRevisions(store, relativePath).push(revision);
}

function getUndoTargetRevision(store: Store, relativePath: string): {
  latestRevision: RevisionRecord;
  targetRevision: RevisionRecord;
} {
  const revisions = artifactStore.getRevisions(store, relativePath);

  if (revisions.length < 2) {
    throw new Error('nothing_to_undo');
  }

  const latestRevision = revisions[revisions.length - 1];
  const targetRevision = revisions[revisions.length - 2];

  return {
    latestRevision,
    targetRevision
  };
}

function getRevisionById(store: Store, relativePath: string, revisionId: string): RevisionRecord {
  const revision = artifactStore.getRevisions(store, relativePath).find((candidate) => candidate.id === revisionId);

  if (!revision) {
    throw new Error('invalid_request');
  }

  return revision;
}

async function loadArtifactPayload(relativePath: string): Promise<Artifact> {
  return documentService.loadArtifact(relativePath);
}

async function buildArtifactState(relativePath: string): Promise<{
  artifact: Artifact;
  proposalSet: ProposalSetRecord | null;
  latestProposalSet: ProposalSetRecord | null;
  proposalHistory: ProposalSetRecord[];
  revisions: RevisionRecord[];
}> {
  const store = await artifactStore.readStore();

  return {
    artifact: await loadArtifactPayload(relativePath),
    proposalSet: getActiveProposalSet(store, relativePath),
    latestProposalSet: getLatestProposalSet(store, relativePath),
    proposalHistory: listProposalHistory(store, relativePath),
    revisions: listLatestRevisions(store, relativePath)
  };
}

async function buildProposalMutationResult(
  relativePath: string,
  appliedRevision: RevisionRecord | null
): Promise<ProposalMutationResult> {
  const state = await buildArtifactState(relativePath);

  return {
    artifact: state.artifact,
    proposalSet: state.proposalSet,
    latestProposalSet: state.latestProposalSet,
    proposalHistory: state.proposalHistory,
    revisions: state.revisions,
    appliedRevision
  };
}

async function syncArtifactRecency(store: Store, relativePath: string): Promise<void> {
  const artifact = await loadArtifactPayload(relativePath);
  artifactStore.touchRecentArtifact(store, artifact);
  await artifactStore.writeStore(store);
}

function replaceSectionMarkdown(markdown: string, targetSection: Section, afterMarkdown: string): string {
  const lines = markdown.split('\n');
  const originalLines = lines.slice(targetSection.startLine - 1, targetSection.endLine);
  let trailingBlankCount = 0;

  for (let index = originalLines.length - 1; index >= 0; index -= 1) {
    if (originalLines[index].trim()) {
      break;
    }

    trailingBlankCount += 1;
  }

  const replacementLines = afterMarkdown.trim().split('\n');

  if (trailingBlankCount > 0) {
    replacementLines.push(...Array.from({ length: trailingBlankCount }, () => ''));
  }

  lines.splice(targetSection.startLine - 1, targetSection.endLine - targetSection.startLine + 1, ...replacementLines);
  return lines.join('\n');
}

function applyReplaceSectionProposalToMarkdown(markdown: string, proposalItem: ProposalItemRecord): string {
  if (proposalItem.kind !== 'replace_section' || !proposalItem.sectionId) {
    throw new Error('invalid_request');
  }

  const sections = parseMarkdownSections(markdown);
  const targetSection = sections.find((section) => section.id === proposalItem.sectionId);

  if (!targetSection) {
    throw new Error('proposal_conflict');
  }

  if (targetSection.markdown.trim() !== proposalItem.beforeMarkdown.trim()) {
    throw new Error('proposal_conflict');
  }

  return replaceSectionMarkdown(markdown, targetSection, proposalItem.afterMarkdown);
}

function applyReplaceSectionProposalsToMarkdown(markdown: string, proposalItems: ProposalItemRecord[]): string {
  const originalSections = parseMarkdownSections(markdown);
  const replacements = proposalItems.map((proposalItem) => {
    if (proposalItem.kind !== 'replace_section' || !proposalItem.sectionId) {
      throw new Error('invalid_request');
    }

    const targetSection = originalSections.find((section) => section.id === proposalItem.sectionId);

    if (!targetSection) {
      throw new Error('proposal_conflict');
    }

    if (targetSection.markdown.trim() !== proposalItem.beforeMarkdown.trim()) {
      throw new Error('proposal_conflict');
    }

    return {
      targetSection,
      afterMarkdown: proposalItem.afterMarkdown
    };
  });

  let nextMarkdown = markdown;

  for (const replacement of replacements.sort((left, right) => right.targetSection.startLine - left.targetSection.startLine)) {
    nextMarkdown = replaceSectionMarkdown(nextMarkdown, replacement.targetSection, replacement.afterMarkdown);
  }

  return nextMarkdown;
}

async function writeDocumentAndStoreSafely(
  absolutePath: string,
  originalMarkdown: string,
  nextMarkdown: string,
  store: Store
): Promise<void> {
  let documentWritten = false;

  try {
    await fs.writeFile(absolutePath, nextMarkdown);
    documentWritten = true;
    await artifactStore.writeStore(store);
  } catch (error) {
    if (documentWritten) {
      try {
        await fs.writeFile(absolutePath, originalMarkdown);
      } catch {
        throw new Error('document_write_failed');
      }
    }

    throw error;
  }
}

function dismissPendingItems(proposalSet: ProposalSetRecord): void {
  for (const proposalItem of proposalSet.items) {
    if (proposalItem.status === 'pending') {
      proposalItem.status = 'dismissed';
    }
  }

  refreshProposalSetStatus(proposalSet);
}

function updateProposalItemStatus(
  proposalSet: ProposalSetRecord,
  proposalItemId: string,
  status: 'applied' | 'dismissed'
): ProposalItemRecord {
  const proposalItem = proposalSet.items.find((item) => item.id === proposalItemId);

  if (!proposalItem) {
    throw new Error('invalid_request');
  }

  if (proposalItem.status !== 'pending') {
    throw new Error('invalid_request');
  }

  proposalItem.status = status;
  refreshProposalSetStatus(proposalSet);
  return proposalItem;
}

function renderSectionTargetLabel(markdown: string, fallback: string): string {
  const firstLine = markdown.split('\n').find((line) => line.trim());

  if (!firstLine) {
    return fallback;
  }

  const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(firstLine.trim());
  return headingMatch?.[2]?.trim() || fallback;
}

function resolveMessageSectionId(
  messageSectionId: string | null,
  artifact: Artifact,
  proposalTargetSectionId: string | null
): string | null {
  if (messageSectionId && artifact.sections.some((section) => section.id === messageSectionId)) {
    return messageSectionId;
  }

  if (proposalTargetSectionId && artifact.sections.some((section) => section.id === proposalTargetSectionId)) {
    return proposalTargetSectionId;
  }

  return null;
}

function toErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Request failed.';
  }

  switch (error.message) {
    case 'agent_unavailable':
      return 'Connect Codex before running an agent turn.';
    case 'proposal_conflict':
      return 'That proposal no longer matches the current document. Refresh and try again.';
    case 'invalid_request':
      return 'That action is no longer available.';
    case 'document_write_failed':
      return 'Workshop could not safely apply that proposal. The document was restored.';
    case 'stale_document':
      return 'This document changed while you were editing. Reload before saving.';
    case 'nothing_to_undo':
      return 'There is no earlier saved revision to undo to yet.';
    default:
      return error.message || 'Request failed.';
  }
}

app.get('/api/health', (_request: Request, response: Response) => {
  response.json({
    ok: true,
    rootDir: ROOT_DIR,
    sourceRoot: SOURCE_ROOT,
    defaultArtifactPath: DEFAULT_ARTIFACT_PATH
  });
});

app.get('/api/config', (request: Request, response: Response) => {
  response.json({
    appOrigin: getAppOrigin(request),
    defaultArtifactPath: DEFAULT_ARTIFACT_PATH,
    defaultCreationDir: DEFAULT_CREATION_DIR
  });
});

app.get('/api/artifact', async (request: Request, response: Response) => {
  try {
    const artifact = await documentService.loadArtifact(String(request.query.path ?? ''));
    const currentStore = await artifactStore.readStore();
    const registered = artifactStore.touchRecentArtifact(currentStore, artifact, { onlyIfUntracked: true });

    if (registered) {
      await artifactStore.writeStore(currentStore);
    }

    response.json({
      artifact,
      proposalSet: getActiveProposalSet(currentStore, artifact.relativePath),
      latestProposalSet: getLatestProposalSet(currentStore, artifact.relativePath),
      proposalHistory: listProposalHistory(currentStore, artifact.relativePath),
      revisions: listLatestRevisions(currentStore, artifact.relativePath)
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to load artifact.'
    });
  }
});

app.get('/api/artifact/meta', async (request: Request, response: Response) => {
  try {
    response.json(await documentService.inspectArtifact(String(request.query.path ?? '')));
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to inspect artifact.'
    });
  }
});

app.get('/api/comments', async (request: Request, response: Response) => {
  try {
    const artifact = await documentService.loadArtifact(String(request.query.path ?? ''));
    const currentStore = await artifactStore.readStore();
    response.json({
      comments: artifact.comments,
      artifact,
      proposalSet: getActiveProposalSet(currentStore, artifact.relativePath),
      latestProposalSet: getLatestProposalSet(currentStore, artifact.relativePath),
      proposalHistory: listProposalHistory(currentStore, artifact.relativePath),
      revisions: listLatestRevisions(currentStore, artifact.relativePath)
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to load comments.'
    });
  }
});

app.get('/api/recents', async (_request: Request, response: Response) => {
  try {
    const currentStore = await artifactStore.readStore();
    response.json({
      recents: artifactStore.listRecentArtifacts(currentStore)
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load recents.'
    });
  }
});

app.get('/api/agent/auth-status', async (_request: Request, response: Response) => {
  try {
    const auth = await getAgentAuthStatus(ROOT_DIR);
    response.json({ auth });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to inspect agent auth.'
    });
  }
});

app.post('/api/agent/connect', async (_request: Request, response: Response) => {
  try {
    const auth = await startAgentConnect(ROOT_DIR);
    response.json({ auth });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to start Codex login.'
    });
  }
});

app.post('/api/agent/disconnect', async (_request: Request, response: Response) => {
  try {
    const auth = await disconnectAgent(ROOT_DIR);
    response.json({ auth });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to disconnect Codex.'
    });
  }
});

app.post('/api/comments', async (request: Request, response: Response) => {
  const body = request.body as {
    path?: unknown;
    sectionId?: unknown;
    body?: unknown;
  } | undefined;
  const artifactPath = body?.path;
  const sectionId = body?.sectionId;
  const commentBody = body?.body;

  if (typeof artifactPath !== 'string' || typeof commentBody !== 'string') {
    response.status(400).json({ error: 'Expected path and body.' });
    return;
  }

  if (!(typeof sectionId === 'string' || sectionId === null || typeof sectionId === 'undefined')) {
    response.status(400).json({ error: 'sectionId must be a string or null.' });
    return;
  }

  const trimmedBody = commentBody.trim();

  if (!trimmedBody) {
    response.status(400).json({ error: 'Comment body cannot be empty.' });
    return;
  }

  try {
    const { relativePath } = await documentService.resolveArtifactPath(artifactPath);
    const currentStore = await artifactStore.readStore();
    const artifactEntry = artifactStore.getArtifactEntry(currentStore, relativePath);
    const createdAt = new Date().toISOString();

    artifactEntry.comments.push({
      id: `${Date.now()}`,
      authorType: 'human',
      body: trimmedBody,
      createdAt,
      sectionId: typeof sectionId === 'string' ? sectionId : null
    });

    artifactStore.recordRecentDiscussion(currentStore, {
      title: path.basename(relativePath),
      relativePath,
      updatedAt: null
    }, createdAt);

    await artifactStore.writeStore(currentStore);

    const state = await buildArtifactState(relativePath);
    response.json(state);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to save comment.'
    });
  }
});

app.post('/api/artifact/create', async (request: Request, response: Response) => {
  const body = request.body as {
    title?: unknown;
    markdown?: unknown;
  } | undefined;

  if (typeof body?.title !== 'string') {
    response.status(400).json({ error: 'Expected title.' });
    return;
  }

  const title = body.title.trim();

  if (!title) {
    response.status(400).json({ error: 'Title cannot be empty.' });
    return;
  }

  const slug = slugifyFileName(title);

  if (!slug) {
    response.status(400).json({ error: 'Title must contain at least one letter or number.' });
    return;
  }

  const normalizedTitle = title.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const requestedMarkdown = typeof body.markdown === 'string' ? body.markdown : null;

  try {
    const requestedPath = path.posix.join(DEFAULT_CREATION_DIR, `${slug}.md`);
    const { absolutePath, relativePath } = await documentService.resolveArtifactPath(requestedPath);

    try {
      await fs.access(absolutePath);
      response.status(409).json({ error: 'A document with that name already exists.' });
      return;
    } catch {
      // Expected when creating a new document.
    }

    const initialMarkdown = requestedMarkdown && requestedMarkdown.trim()
      ? requestedMarkdown
      : `# ${normalizedTitle}\n`;
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, initialMarkdown, { flag: 'wx' });

    const currentStore = await artifactStore.readStore();
    const artifact = await documentService.loadArtifact(relativePath);
    artifactStore.touchRecentArtifact(currentStore, artifact);
    await artifactStore.writeStore(currentStore);

    const state = await buildArtifactState(relativePath);
    response.status(201).json(state);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to create document.'
    });
  }
});

app.post('/api/artifact/save', async (request: Request, response: Response) => {
  const body = request.body as {
    path?: unknown;
    markdown?: unknown;
    baseUpdatedAt?: unknown;
  } | undefined;

  if (
    typeof body?.path !== 'string'
    || typeof body?.markdown !== 'string'
    || typeof body?.baseUpdatedAt !== 'string'
  ) {
    response.status(400).json({ error: 'Expected path, markdown, and baseUpdatedAt.' });
    return;
  }

  try {
    const { absolutePath, relativePath } = await documentService.resolveArtifactPath(body.path);
    const stats = await fs.stat(absolutePath);
    const currentUpdatedAt = stats.mtime.toISOString();

    if (currentUpdatedAt !== body.baseUpdatedAt) {
      throw new Error('stale_document');
    }

    const currentStore = await artifactStore.readStore();
    const nextMarkdown = body.markdown;
    const currentMarkdown = await fs.readFile(absolutePath, 'utf8');

    if (nextMarkdown === currentMarkdown) {
      response.json(await buildProposalMutationResult(relativePath, null));
      return;
    }

    const activeProposalSet = getActiveProposalSet(currentStore, relativePath);

    if (activeProposalSet) {
      dismissPendingItems(activeProposalSet);
    }

    const revision: RevisionRecord = {
      id: createId('rev'),
      documentId: relativePath,
      createdAt: new Date().toISOString(),
      summary: 'Manual edit',
      source: 'manual_save',
      proposalSetId: null,
      markdown: nextMarkdown
    };

    appendRevision(currentStore, relativePath, revision);
    await writeDocumentAndStoreSafely(absolutePath, currentMarkdown, nextMarkdown, currentStore);
    await syncArtifactRecency(currentStore, relativePath);

    const state = await buildProposalMutationResult(relativePath, revision);
    response.json(state);
  } catch (error) {
    response.status(400).json({
      error: toErrorMessage(error)
    });
  }
});

app.post('/api/revisions/undo-last', async (request: Request, response: Response) => {
  try {
    const artifactPath = String(request.body?.path ?? '');
    const { absolutePath, relativePath } = await documentService.resolveArtifactPath(artifactPath);
    const currentStore = await artifactStore.readStore();
    const activeProposalSet = getActiveProposalSet(currentStore, relativePath);

    if (activeProposalSet) {
      throw new Error('invalid_request');
    }

    const { latestRevision, targetRevision } = getUndoTargetRevision(currentStore, relativePath);
    const originalMarkdown = await fs.readFile(absolutePath, 'utf8');

    if (originalMarkdown !== latestRevision.markdown) {
      throw new Error('proposal_conflict');
    }

    const revision: RevisionRecord = {
      id: createId('rev'),
      documentId: relativePath,
      createdAt: new Date().toISOString(),
      summary: `Undo ${latestRevision.summary}`,
      source: 'restore_revision',
      proposalSetId: latestRevision.proposalSetId,
      markdown: targetRevision.markdown
    };

    appendRevision(currentStore, relativePath, revision);
    await writeDocumentAndStoreSafely(absolutePath, originalMarkdown, targetRevision.markdown, currentStore);
    await syncArtifactRecency(currentStore, relativePath);

    response.json(await buildProposalMutationResult(relativePath, revision));
  } catch (error) {
    response.status(400).json({
      error: toErrorMessage(error)
    });
  }
});

app.post('/api/revisions/:revisionId/restore', async (request: Request, response: Response) => {
  try {
    const artifactPath = String(request.body?.path ?? '');
    const { absolutePath, relativePath } = await documentService.resolveArtifactPath(artifactPath);
    const currentStore = await artifactStore.readStore();
    const activeProposalSet = getActiveProposalSet(currentStore, relativePath);

    if (activeProposalSet) {
      throw new Error('invalid_request');
    }

    const targetRevision = getRevisionById(currentStore, relativePath, String(request.params.revisionId));
    const latestRevisions = listLatestRevisions(currentStore, relativePath);
    const latestRevision = latestRevisions[0] ?? null;

    if (!latestRevision || latestRevision.id === targetRevision.id) {
      throw new Error('invalid_request');
    }

    const originalMarkdown = await fs.readFile(absolutePath, 'utf8');

    if (originalMarkdown !== latestRevision.markdown) {
      throw new Error('proposal_conflict');
    }

    const revision: RevisionRecord = {
      id: createId('rev'),
      documentId: relativePath,
      createdAt: new Date().toISOString(),
      summary: `Restore ${targetRevision.summary}`,
      source: 'restore_revision',
      proposalSetId: targetRevision.proposalSetId,
      markdown: targetRevision.markdown
    };

    appendRevision(currentStore, relativePath, revision);
    await writeDocumentAndStoreSafely(absolutePath, originalMarkdown, targetRevision.markdown, currentStore);
    await syncArtifactRecency(currentStore, relativePath);

    response.json(await buildProposalMutationResult(relativePath, revision));
  } catch (error) {
    response.status(400).json({
      error: toErrorMessage(error)
    });
  }
});

app.post('/api/agent/turn', async (request: Request, response: Response) => {
  const body = request.body as {
    path?: unknown;
    focusedSectionId?: unknown;
    prompt?: unknown;
  } | undefined;

  if (typeof body?.path !== 'string' || typeof body?.prompt !== 'string') {
    response.status(400).json({ error: 'Expected path and prompt.' });
    return;
  }

  if (!(typeof body?.focusedSectionId === 'string' || typeof body?.focusedSectionId === 'undefined' || body?.focusedSectionId === null)) {
    response.status(400).json({ error: 'focusedSectionId must be a string or null.' });
    return;
  }

  const prompt = body.prompt.trim();

  if (!prompt) {
    response.status(400).json({ error: 'Prompt cannot be empty.' });
    return;
  }

  try {
    const artifact = await documentService.loadArtifact(body.path);
    const { absolutePath } = await documentService.resolveArtifactPath(body.path);
    const fullMarkdown = await fs.readFile(absolutePath, 'utf8');
    const focusedSection = typeof body.focusedSectionId === 'string'
      ? artifact.sections.find((section) => section.id === body.focusedSectionId) ?? null
      : null;
    const currentStore = await artifactStore.readStore();
    const artifactEntry = artifactStore.getArtifactEntry(currentStore, artifact.relativePath);
    const humanTurnId = createId('turn_human');
    const humanCreatedAt = new Date().toISOString();

    artifactEntry.comments.push({
      id: humanTurnId,
      authorType: 'human',
      body: prompt,
      createdAt: humanCreatedAt,
      sectionId: focusedSection?.id ?? null
    });

    const turnResult = await runDocumentAgentTurn(ROOT_DIR, {
      documentPath: artifact.relativePath,
      markdown: fullMarkdown,
      prompt,
      recentComments: artifactEntry.comments.map((comment) => ({
        authorType: comment.authorType,
        body: comment.body,
        sectionId: comment.sectionId,
        createdAt: comment.createdAt
      })),
      focusedSection: focusedSection
        ? {
            id: focusedSection.id,
            headingText: focusedSection.headingText,
            markdown: focusedSection.markdown
          }
        : null,
      sections: artifact.sections.map((section) => ({
        id: section.id,
        headingText: section.headingText,
        markdown: section.markdown
      })),
      activeProposalSet: getActiveProposalSet(currentStore, artifact.relativePath)
    });

    const agentCreatedAt = new Date().toISOString();
    const proposalTargetSectionId = turnResult.proposal?.items[0]?.targetSectionId ?? null;
    const messages = turnResult.messages.map((message) => ({
      id: createId('turn_agent'),
      authorType: 'agent' as const,
      body: message.body.trim(),
      createdAt: agentCreatedAt,
      sectionId: resolveMessageSectionId(message.sectionId, artifact, proposalTargetSectionId)
    })).filter((message) => message.body);

    for (const message of messages) {
      artifactEntry.comments.push({
        id: message.id,
        authorType: 'agent',
        body: message.body,
        createdAt: message.createdAt,
        sectionId: message.sectionId
      });
    }

    if (turnResult.proposal) {
      upsertActiveProposalSet(
        currentStore,
        artifact.relativePath,
        artifact,
        humanTurnId,
        agentCreatedAt,
        turnResult.proposal
      );
    }

    artifactStore.recordRecentDiscussion(currentStore, {
      title: artifact.title,
      relativePath: artifact.relativePath,
      updatedAt: artifact.updatedAt
    }, agentCreatedAt);

    await artifactStore.writeStore(currentStore);

    const nextState = await buildArtifactState(artifact.relativePath);
    response.json({
      messages,
      proposalSet: nextState.proposalSet,
      latestProposalSet: nextState.latestProposalSet,
      proposalHistory: nextState.proposalHistory,
      artifact: nextState.artifact,
      revisions: nextState.revisions
    });
  } catch (error) {
    response.status(400).json({
      error: toErrorMessage(error)
    });
  }
});

app.post('/api/proposals/:proposalSetId/items/:proposalItemId/accept', async (request: Request, response: Response) => {
  try {
    const artifactPath = String(request.body?.path ?? '');
    const { absolutePath, relativePath } = await documentService.resolveArtifactPath(artifactPath);
    const currentStore = await artifactStore.readStore();
    const proposalSet = getActiveProposalSet(currentStore, relativePath);

    if (!proposalSet || proposalSet.id !== request.params.proposalSetId) {
      throw new Error('invalid_request');
    }

    const proposalItem = proposalSet.items.find((item) => item.id === request.params.proposalItemId);

    if (!proposalItem) {
      throw new Error('invalid_request');
    }

    const originalMarkdown = await fs.readFile(absolutePath, 'utf8');
    const markdown = applyReplaceSectionProposalToMarkdown(originalMarkdown, proposalItem);
    updateProposalItemStatus(proposalSet, proposalItem.id, 'applied');

    const revision: RevisionRecord = {
      id: createId('rev'),
      documentId: relativePath,
      createdAt: new Date().toISOString(),
      summary: proposalItem.summary,
      source: 'proposal_item_accept',
      proposalSetId: proposalSet.id,
      markdown
    };

    appendRevision(currentStore, relativePath, revision);
    await writeDocumentAndStoreSafely(absolutePath, originalMarkdown, markdown, currentStore);
    await syncArtifactRecency(currentStore, relativePath);

    response.json(await buildProposalMutationResult(relativePath, revision));
  } catch (error) {
    response.status(400).json({
      error: toErrorMessage(error)
    });
  }
});

app.post('/api/proposals/:proposalSetId/items/:proposalItemId/dismiss', async (request: Request, response: Response) => {
  try {
    const artifactPath = String(request.body?.path ?? '');
    const { relativePath } = await documentService.resolveArtifactPath(artifactPath);
    const currentStore = await artifactStore.readStore();
    const proposalSet = getActiveProposalSet(currentStore, relativePath);

    if (!proposalSet || proposalSet.id !== request.params.proposalSetId) {
      throw new Error('invalid_request');
    }

    updateProposalItemStatus(proposalSet, String(request.params.proposalItemId), 'dismissed');
    await artifactStore.writeStore(currentStore);

    response.json(await buildProposalMutationResult(relativePath, null));
  } catch (error) {
    response.status(400).json({
      error: toErrorMessage(error)
    });
  }
});

app.post('/api/proposals/:proposalSetId/accept-all', async (request: Request, response: Response) => {
  try {
    const artifactPath = String(request.body?.path ?? '');
    const { absolutePath, relativePath } = await documentService.resolveArtifactPath(artifactPath);
    const currentStore = await artifactStore.readStore();
    const proposalSet = getActiveProposalSet(currentStore, relativePath);

    if (!proposalSet || proposalSet.id !== request.params.proposalSetId) {
      throw new Error('invalid_request');
    }

    const pendingItems = proposalSet.items.filter((item) => item.status === 'pending');

    if (pendingItems.length === 0) {
      throw new Error('invalid_request');
    }

    const originalMarkdown = await fs.readFile(absolutePath, 'utf8');
    const latestMarkdown = applyReplaceSectionProposalsToMarkdown(originalMarkdown, pendingItems);

    for (const proposalItem of pendingItems) {
      updateProposalItemStatus(proposalSet, proposalItem.id, 'applied');
    }

    const revision: RevisionRecord = {
      id: createId('rev'),
      documentId: relativePath,
      createdAt: new Date().toISOString(),
      summary: proposalSet.summary,
      source: 'proposal_set_accept_all',
      proposalSetId: proposalSet.id,
      markdown: latestMarkdown
    };

    appendRevision(currentStore, relativePath, revision);
    await writeDocumentAndStoreSafely(absolutePath, originalMarkdown, latestMarkdown, currentStore);
    await syncArtifactRecency(currentStore, relativePath);

    response.json(await buildProposalMutationResult(relativePath, revision));
  } catch (error) {
    response.status(400).json({
      error: toErrorMessage(error)
    });
  }
});

app.post('/api/proposals/:proposalSetId/dismiss', async (request: Request, response: Response) => {
  try {
    const artifactPath = String(request.body?.path ?? '');
    const { relativePath } = await documentService.resolveArtifactPath(artifactPath);
    const currentStore = await artifactStore.readStore();
    const proposalSet = getActiveProposalSet(currentStore, relativePath);

    if (!proposalSet || proposalSet.id !== request.params.proposalSetId) {
      throw new Error('invalid_request');
    }

    for (const proposalItem of proposalSet.items) {
      if (proposalItem.status === 'pending') {
        proposalItem.status = 'dismissed';
      }
    }

    refreshProposalSetStatus(proposalSet);
    await artifactStore.writeStore(currentStore);

    response.json(await buildProposalMutationResult(relativePath, null));
  } catch (error) {
    response.status(400).json({
      error: toErrorMessage(error)
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Workshop server listening on http://0.0.0.0:${PORT}`);
});
