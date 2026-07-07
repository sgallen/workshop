import type {
  Artifact,
  CheckpointRecord,
  ProposalSetRecord,
  RevisionRecord
} from '../core/types.js';

export type ArtifactOpenResult = {
  artifact: Artifact;
  proposalSet: ProposalSetRecord | null;
  latestProposalSet: ProposalSetRecord | null;
  proposalHistory: ProposalSetRecord[];
  revisions: RevisionRecord[];
  checkpoints: CheckpointRecord[];
  documentUrl: string;
  resolvedPath: string;
  title: string;
  resumed: boolean;
};

export function buildDocumentUrl(relativePath: string): string {
  const params = new URLSearchParams({ path: relativePath });
  return `/?${params.toString()}`;
}

export function buildArtifactOpenResult(input: {
  artifact: Artifact;
  proposalSet: ProposalSetRecord | null;
  latestProposalSet: ProposalSetRecord | null;
  proposalHistory: ProposalSetRecord[];
  revisions: RevisionRecord[];
  checkpoints: CheckpointRecord[];
  resumed: boolean;
}): ArtifactOpenResult {
  return {
    artifact: input.artifact,
    proposalSet: input.proposalSet,
    latestProposalSet: input.latestProposalSet,
    proposalHistory: input.proposalHistory,
    revisions: input.revisions,
    checkpoints: input.checkpoints,
    documentUrl: buildDocumentUrl(input.artifact.relativePath),
    resolvedPath: input.artifact.relativePath,
    title: input.artifact.title,
    resumed: input.resumed
  };
}
