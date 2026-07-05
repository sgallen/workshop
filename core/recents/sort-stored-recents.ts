import type { RecentArtifact } from '../types.js';
import { compareRecentArtifacts, getRecentSortTimestamp, type StoredRecentArtifact } from './recent-activity.js';

export function sortStoredRecents(
  entries: StoredRecentArtifact[],
  limit = 24
): RecentArtifact[] {
  return [...entries]
    .sort(compareRecentArtifacts)
    .filter((entry) => getRecentSortTimestamp(entry) > 0)
    .slice(0, limit)
    .map(({ lastActivityAt: _lastActivityAt, ...entry }) => entry);
}
