import type { CheckpointRecord, RevisionRecord } from '../../core/types';
import { formatArtifactTimestamp } from './formatting';

export type HistoryEntry = {
  id: string;
  revisionId: string;
  checkpointId: string | null;
  kind: 'manual' | 'automatic';
  createdAt: string;
  title: string;
  timestampLabel: string;
  distanceLabel: string | null;
  typeLabel: 'Manual' | 'Auto';
  current: boolean;
  highlighted: boolean;
};

export function getShortSentence(text: string | null | undefined): string | null {
  const normalized = text?.trim();

  if (!normalized) {
    return null;
  }

  const firstSentenceMatch = normalized.match(/^(.+?[.!?])(?:\s|$)/);
  const firstSentence = firstSentenceMatch ? firstSentenceMatch[1].trim() : normalized;

  if (firstSentence.length <= 160) {
    return firstSentence;
  }

  const sliced = firstSentence.slice(0, 157).trimEnd();
  return `${sliced}...`;
}

export function buildHistoryEntries({
  checkpoints,
  revisions,
  highlightedCheckpointId,
  highlightedRevisionId
}: {
  checkpoints: CheckpointRecord[];
  revisions: RevisionRecord[];
  highlightedCheckpointId?: string | null;
  highlightedRevisionId?: string | null;
}): HistoryEntry[] {
  const currentRevisionId = revisions[0]?.id ?? null;
  const currentCheckpointId = checkpoints.find((checkpoint) => checkpoint.revisionId === currentRevisionId)?.id ?? null;
  const checkpointIdsByRevisionId = new Set(checkpoints.map((checkpoint) => checkpoint.revisionId));

  const checkpointEntries = checkpoints.map((checkpoint) => {
    const revisionIndex = revisions.findIndex((revision) => revision.id === checkpoint.revisionId);
    const distanceLabel = revisionIndex > 0 ? `${revisionIndex} back` : null;
    const kind: HistoryEntry['kind'] = checkpoint.source === 'manual' ? 'manual' : 'automatic';
    const current = currentCheckpointId === checkpoint.id;
    const titledLabel = getShortSentence(checkpoint.label);

    return {
      id: checkpoint.id,
      revisionId: checkpoint.revisionId,
      checkpointId: checkpoint.id,
      kind,
      createdAt: checkpoint.createdAt,
      title: titledLabel ?? (current ? 'Current version' : kind === 'manual' ? 'Manual checkpoint' : 'Auto snapshot'),
      timestampLabel: formatArtifactTimestamp(checkpoint.createdAt),
      distanceLabel,
      typeLabel: kind === 'manual' ? ('Manual' as const) : ('Auto' as const),
      current,
      highlighted: highlightedCheckpointId === checkpoint.id || highlightedRevisionId === checkpoint.revisionId,
    };
  });

  const automaticEntries = revisions
    .filter((revision) => !checkpointIdsByRevisionId.has(revision.id))
    .map((revision) => {
      const revisionIndex = revisions.findIndex((candidate) => candidate.id === revision.id);
      const distanceLabel = revisionIndex > 0 ? `${revisionIndex} back` : null;
      const kind: HistoryEntry['kind'] = revision.source === 'manual_save' ? 'manual' : 'automatic';
      const current = currentRevisionId === revision.id;

      return {
        id: revision.id,
        revisionId: revision.id,
        checkpointId: null,
        kind,
        createdAt: revision.createdAt,
        title: current
          ? 'Current version'
          : kind === 'manual'
            ? 'Manual edit'
            : 'Auto snapshot',
        timestampLabel: formatArtifactTimestamp(revision.createdAt),
        distanceLabel,
        typeLabel: kind === 'manual' ? ('Manual' as const) : ('Auto' as const),
        current,
        highlighted: highlightedRevisionId === revision.id,
      };
    });

  return [...checkpointEntries, ...automaticEntries].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}
