import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  disconnectAgent,
  getAgentAuthStatus,
  startAgentConnect
} from './codex-agent.js';
import { createJsonFileStore, type ArtifactEntry } from './store.js';
import { createDocumentService } from './documents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.resolve(ROOT_DIR, '..');
const PORT = Number(process.env.WORKSHOP_SERVER_PORT ?? 4174);
const DEFAULT_ARTIFACT_PATH = 'docs/project-brief.md';
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
    const artifact = await documentService.loadArtifact(String(request.query.path ?? ''));
    const currentStore = await artifactStore.readStore();
    artifactStore.touchRecentArtifact(currentStore, artifact);
    await artifactStore.writeStore(currentStore);
    response.json({ artifact });
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

    const artifact = await documentService.loadArtifact(artifactPath);
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
