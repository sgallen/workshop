import { MouseEvent } from 'react';

type ProposalThreadFooterProps = {
  activeProposalTargetSummary: string | null;
  interactionLocked: boolean;
  hasStalePendingProposals: boolean;
  loading: boolean;
  onReject: () => void | Promise<void>;
  onAccept: () => void | Promise<void>;
  onReloadDocument: () => void | Promise<void>;
};

export function ProposalThreadFooter({
  activeProposalTargetSummary,
  interactionLocked,
  hasStalePendingProposals,
  loading,
  onReject,
  onAccept,
  onReloadDocument
}: ProposalThreadFooterProps) {
  function stopAndRun(event: MouseEvent<HTMLButtonElement>, action: () => void | Promise<void>) {
    event.stopPropagation();
    void action();
  }

  return (
    <div className="proposal-thread-footer">
      {activeProposalTargetSummary ? (
        <p className="context-subtle">{activeProposalTargetSummary}</p>
      ) : null}
      <div
        className="proposal-actions proposal-actions-inline proposal-actions-inline-document proposal-thread-actions"
        role="group"
        aria-label="Proposal actions"
      >
        <button
          className="secondary-button compact-button proposal-review-button"
          type="button"
          disabled={interactionLocked}
          onClick={(event) => stopAndRun(event, onReject)}
        >
          Reject
        </button>
        <button
          className="primary-button compact-button action-primary-button proposal-review-button"
          type="button"
          disabled={interactionLocked || hasStalePendingProposals}
          title={hasStalePendingProposals ? 'Reload the document before accepting these changes.' : undefined}
          onClick={(event) => stopAndRun(event, onAccept)}
        >
          Accept
        </button>
      </div>
      {hasStalePendingProposals ? (
        <div className="proposal-inline-status" role="status" aria-live="polite">
          <span className="status-pill status-pill-warning">Reload required</span>
          <span className="context-subtle">Reload before accepting these changes.</span>
          <button
            className="text-button"
            type="button"
            disabled={interactionLocked}
            onClick={(event) => stopAndRun(event, onReloadDocument)}
          >
            {loading ? 'Reloading…' : 'Reload'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
