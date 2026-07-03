import { promises as fs } from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { parseMarkdownSections } from '../core/sections/parse-markdown-sections.js';
import type { Artifact, Comment } from '../core/types.js';
import type { ArtifactEntry } from './store.js';

export type ResolvedArtifactPath = {
  requestedPath: string;
  absolutePath: string;
  relativePath: string;
};

type DocumentServiceOptions = {
  rootDir: string;
  sourceRoot: string;
  defaultArtifactPath: string;
  readArtifactEntry: (relativePath: string) => Promise<ArtifactEntry>;
};

function sortComments(comments: Comment[]): Comment[] {
  return [...comments].sort((left, right) => {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

export function createDocumentService(options: DocumentServiceOptions) {
  const {
    rootDir,
    sourceRoot,
    defaultArtifactPath,
    readArtifactEntry
  } = options;

  function isWithinSourceRoot(candidatePath: string): boolean {
    return candidatePath === sourceRoot || candidatePath.startsWith(`${sourceRoot}${path.sep}`);
  }

  async function pathExists(candidatePath: string): Promise<boolean> {
    try {
      await fs.access(candidatePath);
      return true;
    } catch {
      return false;
    }
  }

  async function resolveArtifactPath(inputPath: string): Promise<ResolvedArtifactPath> {
    const candidate = inputPath && inputPath.trim() ? inputPath.trim() : defaultArtifactPath;
    const candidatePaths = path.isAbsolute(candidate)
      ? [candidate]
      : [
          path.resolve(rootDir, candidate),
          path.resolve(sourceRoot, candidate)
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
      relativePath: path.relative(sourceRoot, resolved)
    };
  }

  async function loadArtifact(requestedPath: string): Promise<Artifact> {
    const { absolutePath, relativePath } = await resolveArtifactPath(requestedPath);
    const markdown = await fs.readFile(absolutePath, 'utf8');
    const stats = await fs.stat(absolutePath);
    const sections = parseMarkdownSections(markdown);
    const artifactEntry = await readArtifactEntry(relativePath);
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
        renderedHtml: marked.parse(section.markdown) as string,
        comments: comments.filter((comment) => comment.sectionId === section.id)
      }))
    };
  }

  async function inspectArtifact(requestedPath: string): Promise<{
    relativePath: string;
    absolutePath: string;
    updatedAt: string;
  }> {
    const { absolutePath, relativePath } = await resolveArtifactPath(requestedPath);
    const stats = await fs.stat(absolutePath);

    return {
      relativePath,
      absolutePath,
      updatedAt: stats.mtime.toISOString()
    };
  }

  return {
    resolveArtifactPath,
    loadArtifact,
    inspectArtifact
  };
}
