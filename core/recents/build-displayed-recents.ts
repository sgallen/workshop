import type { Artifact, RecentArtifact } from '../types.js';

export function buildDisplayedRecents(
  artifact: Pick<Artifact, 'title' | 'relativePath' | 'updatedAt'> | null,
  recentArtifacts: RecentArtifact[],
  activeCommentCount: number,
  seedCandidates: RecentArtifact[],
  minimumCount = 3
): RecentArtifact[] {
  if (!artifact) {
    if (recentArtifacts.length >= minimumCount) {
      return recentArtifacts;
    }

    const seen = new Set(recentArtifacts.map((recent) => recent.relativePath));
    const seeded = [...recentArtifacts];

    for (const candidate of seedCandidates) {
      if (seen.has(candidate.relativePath)) {
        continue;
      }

      seeded.push(candidate);
      seen.add(candidate.relativePath);

      if (seeded.length >= minimumCount) {
        break;
      }
    }

    return seeded;
  }

  const seeded = [...recentArtifacts];
  const activeIndex = seeded.findIndex((recent) => recent.relativePath === artifact.relativePath);

  if (activeIndex === -1) {
    seeded.unshift({
      title: artifact.title,
      relativePath: artifact.relativePath,
      updatedAt: artifact.updatedAt,
      lastOpenedAt: artifact.updatedAt,
      lastDiscussedAt: null,
      commentCount: activeCommentCount
    });
  } else {
    seeded[activeIndex] = {
      ...seeded[activeIndex],
      title: artifact.title,
      updatedAt: artifact.updatedAt,
      commentCount: activeCommentCount
    };
  }

  const seen = new Set(seeded.map((recent) => recent.relativePath));

  for (const candidate of seedCandidates) {
    if (seen.has(candidate.relativePath) || candidate.relativePath === artifact.relativePath) {
      continue;
    }

    seeded.push(candidate);
    seen.add(candidate.relativePath);

    if (seeded.length >= minimumCount) {
      break;
    }
  }

  return seeded;
}
