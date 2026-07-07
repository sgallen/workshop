import { promises as fs } from 'node:fs';
import path from 'node:path';
import { sortStoredRecents } from '../core/recents/sort-stored-recents.js';
import type {
  CheckpointRecord,
  Comment,
  ProposalSetRecord,
  RecentArtifact,
  RecentArtifactIdentity,
  RevisionRecord
} from '../core/types.js';

type CommentRecord = Comment;
type LegacyCommentRecord = Omit<CommentRecord, 'sectionId'>;

export type ArtifactEntry = {
  comments: CommentRecord[];
  title?: string;
  updatedAt?: string | null;
  lastOpenedAt?: string | null;
  lastActivityAt?: string | null;
  lastDiscussedAt?: string | null;
  commentsBySection?: Record<string, LegacyCommentRecord[]>;
};

export type Store = {
  artifacts: Record<string, ArtifactEntry>;
  recents?: RecentArtifact[];
  proposalSetsByDocument?: Record<string, ProposalSetRecord[]>;
  revisionsByDocument?: Record<string, RevisionRecord[]>;
  checkpointsByDocument?: Record<string, CheckpointRecord[]>;
};

function sortComments(comments: CommentRecord[]): CommentRecord[] {
  return [...comments].sort((left, right) => {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

export function createJsonFileStore(rootDir: string, fileName = 'comments.json') {
  const dataDir = path.join(rootDir, '.workshop-data');
  const dataFile = path.join(dataDir, fileName);

  async function ensureDataFile(): Promise<void> {
    await fs.mkdir(dataDir, { recursive: true });

    try {
      await fs.access(dataFile);
    } catch {
      await fs.writeFile(dataFile, JSON.stringify({ artifacts: {} }, null, 2));
    }
  }

  function ensureStoreShape(store: unknown): Store {
    const candidate = store && typeof store === 'object' ? (store as Partial<Store>) : {};

    return {
      artifacts: candidate.artifacts && typeof candidate.artifacts === 'object' ? candidate.artifacts : {},
      recents: Array.isArray(candidate.recents) ? candidate.recents : [],
      proposalSetsByDocument:
        candidate.proposalSetsByDocument && typeof candidate.proposalSetsByDocument === 'object'
          ? candidate.proposalSetsByDocument
          : {},
      revisionsByDocument:
        candidate.revisionsByDocument && typeof candidate.revisionsByDocument === 'object'
          ? candidate.revisionsByDocument
          : {},
      checkpointsByDocument:
        candidate.checkpointsByDocument && typeof candidate.checkpointsByDocument === 'object'
          ? candidate.checkpointsByDocument
          : {}
    };
  }

  function getArtifactEntry(store: Store, relativePath: string): ArtifactEntry {
    if (!store.artifacts[relativePath]) {
      store.artifacts[relativePath] = { comments: [] };
    }

    const artifactEntry = store.artifacts[relativePath];

    if (!Array.isArray(artifactEntry.comments)) {
      const migratedComments: CommentRecord[] = [];
      const commentsBySection = artifactEntry.commentsBySection ?? {};

      for (const [sectionId, comments] of Object.entries(commentsBySection)) {
        for (const comment of comments) {
          migratedComments.push({
            ...comment,
            sectionId
          });
        }
      }

      artifactEntry.comments = sortComments(migratedComments);
      delete artifactEntry.commentsBySection;
    }

    return artifactEntry;
  }

  function migrateRecentsIntoArtifacts(store: Store): void {
    for (const recent of store.recents ?? []) {
      if (!recent || typeof recent.relativePath !== 'string') {
        continue;
      }

      const artifactEntry = getArtifactEntry(store, recent.relativePath);
      artifactEntry.title = artifactEntry.title ?? recent.title;
      artifactEntry.updatedAt = artifactEntry.updatedAt ?? recent.updatedAt ?? null;
      artifactEntry.lastOpenedAt = artifactEntry.lastOpenedAt ?? recent.lastOpenedAt ?? null;
      artifactEntry.lastDiscussedAt = artifactEntry.lastDiscussedAt ?? recent.lastDiscussedAt ?? null;
      artifactEntry.lastActivityAt =
        artifactEntry.lastActivityAt
        ?? recent.lastDiscussedAt
        ?? recent.lastOpenedAt
        ?? recent.updatedAt
        ?? null;
    }

    delete store.recents;
  }

  function ensureArtifactMetadata(
    artifactEntry: ArtifactEntry,
    artifact: RecentArtifactIdentity
  ): void {
    artifactEntry.title = artifact.title;
    artifactEntry.updatedAt = artifact.updatedAt ?? artifactEntry.updatedAt ?? null;
  }

  async function readStore(): Promise<Store> {
    await ensureDataFile();
    const raw = await fs.readFile(dataFile, 'utf8');
    const store = ensureStoreShape(JSON.parse(raw));
    migrateRecentsIntoArtifacts(store);
    return store;
  }

  async function writeStore(store: Store): Promise<void> {
    await ensureDataFile();
    await fs.writeFile(dataFile, JSON.stringify(ensureStoreShape(store), null, 2));
  }

  function touchRecentArtifact(
    store: Store,
    artifact: RecentArtifactIdentity,
    options?: { onlyIfUntracked?: boolean }
  ): boolean {
    const openedAt = new Date().toISOString();
    const artifactEntry = getArtifactEntry(store, artifact.relativePath);
    ensureArtifactMetadata(artifactEntry, artifact);

    const alreadyTracked = Boolean(
      artifactEntry.lastActivityAt
      || artifactEntry.lastDiscussedAt
      || artifactEntry.lastOpenedAt
      || artifactEntry.comments.length
    );

    if (options?.onlyIfUntracked && alreadyTracked) {
      return false;
    }

    artifactEntry.lastOpenedAt = openedAt;
    artifactEntry.lastActivityAt = openedAt;
    return true;
  }

  function recordRecentDiscussion(
    store: Store,
    artifact: RecentArtifactIdentity,
    discussedAt = new Date().toISOString()
  ): void {
    const artifactEntry = getArtifactEntry(store, artifact.relativePath);
    ensureArtifactMetadata(artifactEntry, artifact);
    artifactEntry.lastDiscussedAt = discussedAt;
    artifactEntry.lastActivityAt = discussedAt;
  }

  function listRecentArtifacts(store: Store): RecentArtifact[] {
    const mapped = Object.entries(store.artifacts)
      .map(([relativePath, artifactEntry]) => {
        return {
          title:
            typeof artifactEntry.title === 'string' && artifactEntry.title.trim()
              ? artifactEntry.title
              : path.basename(relativePath),
          relativePath,
          updatedAt: typeof artifactEntry.updatedAt === 'string' ? artifactEntry.updatedAt : null,
          lastOpenedAt: typeof artifactEntry.lastOpenedAt === 'string' ? artifactEntry.lastOpenedAt : null,
          lastDiscussedAt: typeof artifactEntry.lastDiscussedAt === 'string' ? artifactEntry.lastDiscussedAt : null,
          lastActivityAt: typeof artifactEntry.lastActivityAt === 'string' ? artifactEntry.lastActivityAt : null,
          commentCount: Array.isArray(artifactEntry.comments) ? artifactEntry.comments.length : 0
        };
      });

    return sortStoredRecents(mapped, 24);
  }

  function getProposalSets(store: Store, relativePath: string): ProposalSetRecord[] {
    if (!store.proposalSetsByDocument) {
      store.proposalSetsByDocument = {};
    }

    if (!Array.isArray(store.proposalSetsByDocument[relativePath])) {
      store.proposalSetsByDocument[relativePath] = [];
    }

    return store.proposalSetsByDocument[relativePath];
  }

  function getRevisions(store: Store, relativePath: string): RevisionRecord[] {
    if (!store.revisionsByDocument) {
      store.revisionsByDocument = {};
    }

    if (!Array.isArray(store.revisionsByDocument[relativePath])) {
      store.revisionsByDocument[relativePath] = [];
    }

    return store.revisionsByDocument[relativePath];
  }

  function getCheckpoints(store: Store, relativePath: string): CheckpointRecord[] {
    if (!store.checkpointsByDocument) {
      store.checkpointsByDocument = {};
    }

    if (!Array.isArray(store.checkpointsByDocument[relativePath])) {
      store.checkpointsByDocument[relativePath] = [];
    }

    return store.checkpointsByDocument[relativePath];
  }

  return {
    readStore,
    writeStore,
    getArtifactEntry,
    getProposalSets,
    getRevisions,
    getCheckpoints,
    listRecentArtifacts,
    touchRecentArtifact,
    recordRecentDiscussion
  };
}
