import type { RecentArtifact } from '../../core/types';

function formatRecentDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  }).format(new Date(value));
}

export function formatArtifactTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

export function formatRecentActivity(recent: RecentArtifact): string {
  if (recent.lastDiscussedAt) {
    return `Discussed ${formatRecentDate(recent.lastDiscussedAt)}`;
  }

  if (recent.lastOpenedAt) {
    return `Opened ${formatRecentDate(recent.lastOpenedAt)}`;
  }

  return 'Recent document';
}
