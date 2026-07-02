import express from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

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

function sortComments(comments) {
  return [...comments].sort((left, right) => {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section';
}

function isWithinSourceRoot(candidatePath) {
  return candidatePath === SOURCE_ROOT || candidatePath.startsWith(`${SOURCE_ROOT}${path.sep}`);
}

async function pathExists(candidatePath) {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveArtifactPath(inputPath) {
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

function parseSections(markdown) {
  const lines = markdown.split('\n');
  const headings = [];

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
        renderedHtml: marked.parse(markdown)
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
      renderedHtml: marked.parse(sectionMarkdown)
    };
  });
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ artifacts: {} }, null, 2));
  }
}

async function readStore() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

async function writeStore(store) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

function getArtifactEntry(store, relativePath) {
  if (!store.artifacts[relativePath]) {
    store.artifacts[relativePath] = { comments: [] };
  }

  const artifactEntry = store.artifacts[relativePath];

  if (!Array.isArray(artifactEntry.comments)) {
    const migratedComments = [];
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

async function loadArtifactPayload(requestedPath) {
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
    renderedHtml: marked.parse(markdown),
    comments,
    sections: sections.map((section) => ({
      ...section,
      comments: comments.filter((comment) => comment.sectionId === section.id)
    }))
  };
}

function getAppOrigin(request) {
  if (APP_ORIGIN) {
    return APP_ORIGIN.replace(/\/+$/, '');
  }

  const forwardedHost = request.headers['x-forwarded-host'];
  const host = typeof forwardedHost === 'string' ? forwardedHost : request.headers.host;
  const forwardedProto = request.headers['x-forwarded-proto'];
  const proto = typeof forwardedProto === 'string' ? forwardedProto : 'http';

  if (!host) {
    return `http://127.0.0.1:4173`;
  }

  return `${proto}://${host.replace(/:\d+$/, ':4173')}`;
}

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    rootDir: ROOT_DIR,
    sourceRoot: SOURCE_ROOT,
    defaultArtifactPath: DEFAULT_ARTIFACT_PATH
  });
});

app.get('/api/config', (request, response) => {
  response.json({
    appOrigin: getAppOrigin(request),
    defaultArtifactPath: DEFAULT_ARTIFACT_PATH
  });
});

app.get('/api/artifact', async (request, response) => {
  try {
    const artifact = await loadArtifactPayload(String(request.query.path ?? ''));
    response.json({ artifact });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to load artifact.'
    });
  }
});

app.get('/api/artifact/meta', async (request, response) => {
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

app.get('/api/comments', async (request, response) => {
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

app.post('/api/comments', async (request, response) => {
  const { path: artifactPath, sectionId, body } = request.body ?? {};

  if (typeof artifactPath !== 'string' || typeof body !== 'string') {
    response.status(400).json({ error: 'Expected path and body.' });
    return;
  }

  if (!(typeof sectionId === 'string' || sectionId === null || typeof sectionId === 'undefined')) {
    response.status(400).json({ error: 'sectionId must be a string or null.' });
    return;
  }

  const trimmedBody = body.trim();

  if (!trimmedBody) {
    response.status(400).json({ error: 'Comment body cannot be empty.' });
    return;
  }

  try {
    const { relativePath } = await resolveArtifactPath(artifactPath);
    const store = await readStore();
    const artifactEntry = getArtifactEntry(store, relativePath);
    artifactEntry.comments.push({
      id: `${Date.now()}`,
      authorType: 'human',
      body: trimmedBody,
      createdAt: new Date().toISOString(),
      sectionId: typeof sectionId === 'string' ? sectionId : null
    });

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
