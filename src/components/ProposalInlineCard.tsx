type ProposalInlineCardProps = {
  proposalItemId: string;
  proposalSetId: string | null;
  proposalCompareMode: 'original' | 'proposed';
  proposalRenderedHtml: string;
  interactionLocked: boolean;
  hasStalePendingProposals: boolean;
  loading: boolean;
  onSetCompareMode: (mode: 'original' | 'proposed') => void;
  onReject: () => void | Promise<void>;
  onAccept: () => void | Promise<void>;
  onReloadDocument: () => void | Promise<void>;
};

export function ProposalInlineCard({
  proposalItemId,
  proposalSetId,
  proposalCompareMode,
  proposalRenderedHtml,
  interactionLocked,
  hasStalePendingProposals,
  loading,
  onSetCompareMode,
  onReject,
  onAccept,
  onReloadDocument
}: ProposalInlineCardProps) {
  return (
    <div className="proposal-inline-block" data-stale={hasStalePendingProposals ? 'true' : 'false'}>
      <div className="proposal-inline-topbar">
        <div className="proposal-compare-toggle" role="group" aria-label="Compare proposal versions">
          <button
            className={`proposal-toggle-button${proposalCompareMode === 'original' ? ' proposal-toggle-button-active' : ''}`}
            type="button"
            disabled={interactionLocked}
            aria-pressed={proposalCompareMode === 'original'}
            onClick={() => onSetCompareMode('original')}
          >
            Original
          </button>
          <button
            className={`proposal-toggle-button${proposalCompareMode === 'proposed' ? ' proposal-toggle-button-active' : ''}`}
            type="button"
            disabled={interactionLocked}
            aria-pressed={proposalCompareMode === 'proposed'}
            onClick={() => onSetCompareMode('proposed')}
          >
            Proposed
          </button>
        </div>
      </div>
      <div className="proposal-inline-body">
        <div
          className="section-rendered proposal-inline-rendered"
          dangerouslySetInnerHTML={{ __html: proposalRenderedHtml }}
        />
      </div>
      <div
        className="proposal-actions proposal-actions-inline proposal-actions-inline-document"
        role="group"
        aria-label="Proposal actions"
        data-proposal-item-id={proposalItemId}
      >
        <button
          className="secondary-button compact-button proposal-review-button"
          type="button"
          disabled={interactionLocked}
          onClick={() => void onReject()}
        >
          Reject
        </button>
        <button
          className="primary-button compact-button action-primary-button proposal-review-button"
          type="button"
          disabled={interactionLocked || hasStalePendingProposals}
          title={hasStalePendingProposals ? 'Reload the document before accepting this proposal.' : undefined}
          onClick={() => void onAccept()}
          data-proposal-set-id={proposalSetId ?? undefined}
        >
          Accept
        </button>
      </div>
      {hasStalePendingProposals ? (
        <div className="proposal-inline-status" role="status" aria-live="polite">
          <span className="status-pill status-pill-warning">Reload required</span>
          <span className="context-subtle">Reload the document before accepting this proposal.</span>
          <button className="text-button" type="button" disabled={interactionLocked} onClick={() => void onReloadDocument()}>
            {loading ? 'Reloading…' : 'Reload'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
