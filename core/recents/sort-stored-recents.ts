import type { RecentArtifact } from '../types.js';

export type StoredRecentArtifact = RecentArtifact & {
  lastActivityAt?: string | null;
};

export function sortStoredRecents(
  entries: StoredRecentArtifact[],
  limit = 24
): RecentArtifact[] {
  return [...entries]
    .sort((left, right) => {
      const leftHasMeaningfulActivity = left.lastActivityAt !== null && typeof left.lastActivityAt !== 'undefined';
      const rightHasMeaningfulActivity = right.lastActivityAt !== null && typeof right.lastActivityAt !== 'undefined';

      if (leftHasMeaningfulActivity !== rightHasMeaningfulActivity) {
        return rightHasMeaningfulActivity ? 1 : -1;
      }

      const leftTime = left.lastActivityAt ?? left.lastOpenedAt;
      const rightTime = right.lastActivityAt ?? right.lastOpenedAt;
      return new Date(rightTime ?? 0).getTime() - new Date(leftTime ?? 0).getTime();
    })
    .filter((entry) => entry.lastActivityAt !== null || entry.lastOpenedAt !== null)
    .slice(0, limit)
    .map(({ lastActivityAt: _lastActivityAt, ...entry }) => entry);
}
