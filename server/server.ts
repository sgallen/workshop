import express, { type Request, type Response } from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import {
  disconnectAgent,
  getAgentAuthStatus,
  startAgentConnect
} from './codex-agent.js';

type AuthorType = 'human' | 'agent';

type CommentRecord = {
  id: string;
  authorType: AuthorType;
  body: string;
  createdAt: string;
  sectionId: string | null;
};

type LegacyCommentRecord = Omit<CommentRecord, 'sectionId'>;

type SectionRecord = {
  id: string;
  headingText: string;
  level: number;
  startLine: number;
  endLine: number;
  markdown: string;
  renderedHtml: string;
};

type ArtifactPayload = {
  title: string;
  relativePath: string;
  absolutePath: string;
  updatedAt: string;
  renderedHtml: string;
  comments: CommentRecord[];
  sections: Array<SectionRecord & { comments: CommentRecord[] }>;
};

type ArtifactEntry = {
  comments: CommentRecord[];
  title?: string;
  updatedAt?: string | null;
  lastOpenedAt?: string | null;
  lastActivityAt?: string | null;
  lastDiscussedAt?: string | null;
  commentsBySection?: Record<string, LegacyCommentRecord[]>;
};

type RecentEntry = {
  title: string;
  relativePath: string;
  updatedAt: string | null;
  lastOpenedAt: string | null;
  lastDiscussedAt?: string | null;
};

type RecentArtifactIdentity = {
  title: string;
  relativePath: string;
  updatedAt: string | null;
};

type Store = {
  artifacts: Record<string, ArtifactEntry>;
  recents?: RecentEntry[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.resolve(ROOT_DIR, '..');
const DATA_DIR = path.join(ROOT_DIR, '.workshop-data');
const DATA_FILE = path.join(DATA_DIR, 'comments.json');
const PORT = Number(process.env.WORKSHOP_SERVER_PORT ?? 4174);
const DEFAULT_ARTIFACT_PATH = 'docs/project-brief.md';
const APP_ORIGIN = process.env.WORKSHOP_APP_ORIGIN?.trim() || '';

marked.setOptions({ gfm: true, breaks: true });

const app = express();
app.use(express.json());

function sortComments(comments: CommentRecord[]): CommentRecord[] {
  return [...comments].sort((left, right) => {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section';
}

function isWithinSourceRoot(candidatePath: string): boolean {
  return candidatePath === SOURCE_ROOT || candidatePath.startsWith(`${SOURCE_ROOT}${path.sep}`);
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveArtifactPath(inputPath: string): Promise<{
  requestedPath: string;
  absolutePath: string;
  relativePath: string;
}> {
  const candidate = inputPath && inputPath.trim() ? inputPath.trim() : DEFAULT_ARTIFACT_PATH;
  const candidatePaths = path.isAbsolute(candidate)
    ? [candidate]
    : [
        path.resolve(ROOT_DIR, candidate),
        path.resolve(SOURCE_ROOT, candidate)
      ];

  const allowedPaths = [...new Set(candidatePaths)].filter(isWithinSourceRoot);

  if (allowedPaths.length === 0) {
    throw new Error('Artifact path must stay inside the source workspace.');
  }

  let resolved = allowedPaths[0];

  for (const candidatePath of allowedPaths) {
    if (await pathExists(candidatePath)) {
      resolved = candidatePath;
      break;
    }
  }

  if (!isWithinSourceRoot(resolved)) {
    throw new Error('Artifact path must stay inside the source workspace.');
  }

  return {
    requestedPath: candidate,
    absolutePath: resolved,
    relativePath: path.relative(SOURCE_ROOT, resolved)
  };
}

function parseSections(markdown: string): SectionRecord[] {
  const lines = markdown.split('\n');
  const headings: Array<Pick<SectionRecord, 'level' | 'headingText' | 'startLine'>> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index]);

    if (!match) {
      continue;
    }

    headings.push({
      level: match[1].length,
      headingText: match[2].trim(),
      startLine: index + 1
    });
  }

  if (headings.length === 0) {
    return [
      {
        id: 'document',
        headingText: 'Document',
        level: 1,
        startLine: 1,
        endLine: lines.length,
        markdown,
        renderedHtml: marked.parse(markdown) as string
      }
    ];
  }

  return headings.map((heading, index) => {
    const nextHeading = headings[index + 1];
    const endLine = nextHeading ? nextHeading.startLine - 1 : lines.length;
    const sectionMarkdown = lines.slice(heading.startLine - 1, endLine).join('\n').trim();

    return {
      id: `${slugify(heading.headingText)}-${index + 1}`,
      headingText: heading.headingText,
      level: heading.level,
      startLine: heading.startLine,
      endLine,
      markdown: sectionMarkdown,
      renderedHtml: marked.parse(sectionMarkdown) as string
    };
  });
}

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ artifacts: {} }, null, 2));
  }
}

function ensureStoreShape(store: unknown): Store {
  const candidate = store && typeof store === 'object' ? (store as Partial<Store>) : {};

  return {
    artifacts: candidate.artifacts && typeof candidate.artifacts === 'object' ? candidate.artifacts : {},
    recents: Array.isArray(candidate.recents) ? candidate.recents : []
  };
}

async function readStore(): Promise<Store> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const store = ensureStoreShape(JSON.parse(raw));
  migrateRecentsIntoArtifacts(store);
  return store;
}

async function writeStore(store: Store): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(ensureStoreShape(store), null, 2));
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
    artifactEntry.lastActivityAt = artifactEntry.lastActivityAt ?? recent.lastDiscussedAt ?? null;
  }

  delete store.recents;
}

function ensureArtifactMetadata(
  artifactEntry: ArtifactEntry,
  artifact: RecentArtifactIdentity,
  openedAt = new Date().toISOString()
): void {
  artifactEntry.title = artifact.title;
  artifactEntry.updatedAt = artifact.updatedAt ?? artifactEntry.updatedAt ?? null;
  artifactEntry.lastOpenedAt = artifactEntry.lastOpenedAt ?? openedAt;
}

function ensureRecentArtifact(store: Store, artifact: RecentArtifactIdentity): void {
  const openedAt = new Date().toISOString();
  const artifactEntry = getArtifactEntry(store, artifact.relativePath);
  ensureArtifactMetadata(artifactEntry, artifact, openedAt);
}

function recordRecentDiscussion(
  store: Store,
  artifact: RecentArtifactIdentity,
  discussedAt = new Date().toISOString()
): void {
  const artifactEntry = getArtifactEntry(store, artifact.relativePath);
  ensureArtifactMetadata(artifactEntry, artifact, discussedAt);
  artifactEntry.lastDiscussedAt = discussedAt;
  artifactEntry.lastActivityAt = discussedAt;
}

function listRecentArtifacts(store: Store): Array<RecentEntry & { commentCount: number }> {
  return Object.entries(store.artifacts)
    .map(([relativePath, artifactEntry]) => {
      return {
        title: typeof artifactEntry.title === 'string' && artifactEntry.title.trim() ? artifactEntry.title : path.basename(relativePath),
        relativePath,
        updatedAt: typeof artifactEntry.updatedAt === 'string' ? artifactEntry.updatedAt : null,
        lastOpenedAt: typeof artifactEntry.lastOpenedAt === 'string' ? artifactEntry.lastOpenedAt : null,
        lastDiscussedAt: typeof artifactEntry.lastDiscussedAt === 'string' ? artifactEntry.lastDiscussedAt : null,
        lastActivityAt: typeof artifactEntry.lastActivityAt === 'string' ? artifactEntry.lastActivityAt : null,
        commentCount: Array.isArray(artifactEntry.comments) ? artifactEntry.comments.length : 0
      };
    })
    .sort((left, right) => {
      const leftHasMeaningfulActivity = left.lastActivityAt !== null;
      const rightHasMeaningfulActivity = right.lastActivityAt !== null;

      if (leftHasMeaningfulActivity !== rightHasMeaningfulActivity) {
        return rightHasMeaningfulActivity ? 1 : -1;
      }

      const leftTime = left.lastActivityAt ?? left.lastOpenedAt;
      const rightTime = right.lastActivityAt ?? right.lastOpenedAt;
      return new Date(rightTime ?? 0).getTime() - new Date(leftTime ?? 0).getTime();
    })
    .filter((entry) => entry.lastActivityAt !== null || entry.lastOpenedAt !== null)
    .slice(0, 24)
    .map(({ lastActivityAt: _lastActivityAt, ...entry }) => entry);
}

async function loadArtifactPayload(requestedPath: string): Promise<ArtifactPayload> {
  const { absolutePath, relativePath } = await resolveArtifactPath(requestedPath);
  const markdown = await fs.readFile(absolutePath, 'utf8');
  const stats = await fs.stat(absolutePath);
  const sections = parseSections(markdown);
  const store = await readStore();
  const artifactEntry = getArtifactEntry(store, relativePath);
  const comments = sortComments(artifactEntry.comments ?? []);

  return {
    title: path.basename(relativePath),
    relativePath,
    absolutePath,
    updatedAt: stats.mtime.toISOString(),
    renderedHtml: marked.parse(markdown) as string,
    comments,
    sections: sections.map((section) => ({
      ...section,
      comments: comments.filter((comment) => comment.sectionId === section.id)
    }))
  };
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
    defaultArtifactPath: DEFAULT_ARTIFACT_PATH
  });
});

app.get('/api/artifact', async (request: Request, response: Response) => {
  try {
    const artifact = await loadArtifactPayload(String(request.query.path ?? ''));
    const store = await readStore();
    ensureRecentArtifact(store, artifact);
    await writeStore(store);
    response.json({ artifact });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to load artifact.'
    });
  }
});

app.get('/api/artifact/meta', async (request: Request, response: Response) => {
  try {
    const { absolutePath, relativePath } = await resolveArtifactPath(String(request.query.path ?? ''));
    const stats = await fs.stat(absolutePath);

    response.json({
      relativePath,
      absolutePath,
      updatedAt: stats.mtime.toISOString()
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to inspect artifact.'
    });
  }
});

app.get('/api/comments', async (request: Request, response: Response) => {
  try {
    const artifact = await loadArtifactPayload(String(request.query.path ?? ''));
    response.json({
      comments: artifact.comments,
      artifact
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to load comments.'
    });
  }
});

app.get('/api/recents', async (_request: Request, response: Response) => {
  try {
    const store = await readStore();
    response.json({
      recents: listRecentArtifacts(store)
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
    const { relativePath } = await resolveArtifactPath(artifactPath);
    const store = await readStore();
    const artifactEntry = getArtifactEntry(store, relativePath);
    const createdAt = new Date().toISOString();

    artifactEntry.comments.push({
      id: `${Date.now()}`,
      authorType: 'human',
      body: trimmedBody,
      createdAt,
      sectionId: typeof sectionId === 'string' ? sectionId : null
    });

    recordRecentDiscussion(store, {
      title: path.basename(relativePath),
      relativePath,
      updatedAt: null
    }, createdAt);

    await writeStore(store);

    const artifact = await loadArtifactPayload(artifactPath);
    response.json({ artifact });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to save comment.'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Workshop server listening on http://0.0.0.0:${PORT}`);
});
