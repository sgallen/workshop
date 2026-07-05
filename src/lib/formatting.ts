import { getRecentActivitySummary } from '../../core/recents/recent-activity';
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
  const activity = getRecentActivitySummary(recent);

  if (activity.kind === 'discussed' && activity.value) {
    return `Discussed ${formatRecentDate(activity.value)}`;
  }

  if (activity.kind === 'opened' && activity.value) {
    return `Opened ${formatRecentDate(activity.value)}`;
  }

  if (activity.kind === 'updated' && activity.value) {
    return `Saved ${formatRecentDate(activity.value)}`;
  }

  return 'Recent document';
}
