type ReaderStatusBannerProps = {
  reviewStateLabel: string | null;
  reviewStateCanCycle: boolean;
  reviewStateCycleLabel: string | null;
  reviewTargetCount: number;
  interactionLocked: boolean;
  editMode: boolean;
  loading: boolean;
  agentTurnPending: boolean;
  pendingTurnMessage: string;
  hasUnsavedEditChanges: boolean;
  editNotice: string | null;
  hasRemoteUpdate: boolean;
  hasStalePendingProposals: boolean;
  onCycleProposal: () => void;
  onReloadDocument: () => void | Promise<void>;
};

export function ReaderStatusBanner({
  reviewStateLabel,
  reviewStateCanCycle,
  reviewStateCycleLabel,
  reviewTargetCount,
  interactionLocked,
  editMode,
  loading,
  agentTurnPending,
  pendingTurnMessage,
  hasUnsavedEditChanges,
  editNotice,
  hasRemoteUpdate,
  hasStalePendingProposals,
  onCycleProposal,
  onReloadDocument
}: ReaderStatusBannerProps) {
  const reviewStateChevron = reviewStateCycleLabel === '›'
    ? <span className="reader-review-state-chevron" aria-hidden="true">›</span>
    : reviewStateCycleLabel;

  return (
    <div className="reader-status-banner">
      {reviewStateLabel ? (
        reviewStateCanCycle ? (
          <button
            className="reader-review-state reader-review-state-button"
            type="button"
            disabled={interactionLocked || editMode}
            onClick={onCycleProposal}
            title={reviewTargetCount > 1 ? 'Jump to the next pending change' : 'Jump to the pending change'}
          >
            <span className="reader-review-dot" aria-hidden="true" />
            <span>{reviewStateLabel}</span>
            {reviewStateChevron ? (
              <span className="reader-review-state-detail">{reviewStateChevron}</span>
            ) : null}
          </button>
        ) : (
          <p className="reader-review-state" role="status" aria-live="polite">
            <span className="reader-review-dot" aria-hidden="true" />
            <span>{reviewStateLabel}</span>
          </p>
        )
      ) : null}
      {!reviewStateLabel && loading ? (
        <p className="reader-review-state" role="status" aria-live="polite">
          <span className="reader-review-dot reader-review-dot-info" aria-hidden="true" />
          <span>Refreshing document…</span>
        </p>
      ) : null}
      {!reviewStateLabel && agentTurnPending ? (
        <p className="reader-review-state" role="status" aria-live="polite">
          <span className="reader-review-dot reader-review-dot-info" aria-hidden="true" />
          <span>
            {pendingTurnMessage}
            <span className="pending-ellipsis" aria-hidden="true">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </span>
        </p>
      ) : null}
      {editMode ? (
        <p className="reader-review-state" role="status" aria-live="polite">
          <span className="reader-review-dot reader-review-dot-info" aria-hidden="true" />
          <span>{hasUnsavedEditChanges ? 'Editing with unsaved changes' : 'Editing'}</span>
        </p>
      ) : null}
      {editNotice ? (
        <p className="reader-review-state" role="status" aria-live="polite">
          <span className="reader-review-dot" aria-hidden="true" />
          <span>{editNotice}</span>
        </p>
      ) : null}
      {hasRemoteUpdate ? (
        <div className="reader-meta-pills reader-meta-pills-compact">
          <span className={`meta-pill${hasStalePendingProposals ? ' meta-pill-warning' : ' meta-pill-info'}`}>
            {editMode ? 'Reload required before save' : hasStalePendingProposals ? 'Reload required before apply' : 'Changed on disk'}
          </span>
        </div>
      ) : null}
      {hasRemoteUpdate ? (
        <button className="text-button" type="button" disabled={interactionLocked} onClick={() => void onReloadDocument()}>
          {loading ? 'Reloading…' : 'Reload'}
        </button>
      ) : null}
    </div>
  );
}
