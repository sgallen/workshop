import type { RecentArtifact } from '../types.js';

export type StoredRecentArtifact = RecentArtifact & {
  lastActivityAt?: string | null;
};

function parseRecentTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getRecentSortTimestamp(recent: Pick<StoredRecentArtifact, 'updatedAt' | 'lastOpenedAt' | 'lastDiscussedAt' | 'lastActivityAt'>): number {
  return Math.max(
    parseRecentTimestamp(recent.lastActivityAt),
    parseRecentTimestamp(recent.lastDiscussedAt),
    parseRecentTimestamp(recent.lastOpenedAt),
    parseRecentTimestamp(recent.updatedAt)
  );
}

export function compareRecentArtifacts(left: Pick<StoredRecentArtifact, 'updatedAt' | 'lastOpenedAt' | 'lastDiscussedAt' | 'lastActivityAt' | 'relativePath'>, right: Pick<StoredRecentArtifact, 'updatedAt' | 'lastOpenedAt' | 'lastDiscussedAt' | 'lastActivityAt' | 'relativePath'>): number {
  const timestampDifference = getRecentSortTimestamp(right) - getRecentSortTimestamp(left);

  if (timestampDifference !== 0) {
    return timestampDifference;
  }

  return left.relativePath.localeCompare(right.relativePath);
}

export function getRecentActivitySummary(recent: Pick<StoredRecentArtifact, 'updatedAt' | 'lastOpenedAt' | 'lastDiscussedAt'>): {
  kind: 'discussed' | 'opened' | 'updated' | 'none';
  value: string | null;
} {
  const discussedAt = parseRecentTimestamp(recent.lastDiscussedAt);
  const openedAt = parseRecentTimestamp(recent.lastOpenedAt);
  const updatedAt = parseRecentTimestamp(recent.updatedAt);

  if (discussedAt >= openedAt && discussedAt >= updatedAt && discussedAt > 0) {
    return {
      kind: 'discussed',
      value: recent.lastDiscussedAt ?? null
    };
  }

  if (openedAt >= updatedAt && openedAt > 0) {
    return {
      kind: 'opened',
      value: recent.lastOpenedAt ?? null
    };
  }

  if (updatedAt > 0) {
    return {
      kind: 'updated',
      value: recent.updatedAt ?? null
    };
  }

  return {
    kind: 'none',
    value: null
  };
}
