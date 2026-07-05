export type AgentConnectionState = 'connected' | 'disconnected' | 'connecting' | 'error';

type AgentConnectionStatusProps = {
  providerName: string;
  connectionState: AgentConnectionState;
  accountLabel?: string | null;
  message?: string | null;
  authUrl?: string;
  deviceCode?: string | null;
  actionDisabled?: boolean;
  manageOpen?: boolean;
  onManage?: () => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

function getStatusLabel(connectionState: AgentConnectionState): string {
  switch (connectionState) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'error':
      return 'Connection issue';
    default:
      return 'Not connected';
  }
}

function getHeaderTitle(providerName: string, connectionState: AgentConnectionState): string {
  return connectionState === 'disconnected' ? 'No agent connected' : providerName;
}

function getPrimaryActionLabel(providerName: string, connectionState: AgentConnectionState): string | null {
  switch (connectionState) {
    case 'connected':
      return 'Manage';
    case 'disconnected':
      return `Connect ${providerName}`;
    case 'error':
      return `Connect ${providerName}`;
    default:
      return null;
  }
}

export function AgentConnectionStatus({
  providerName,
  connectionState,
  accountLabel,
  message,
  authUrl,
  deviceCode,
  actionDisabled = false,
  manageOpen = false,
  onManage,
  onConnect,
  onDisconnect
}: AgentConnectionStatusProps) {
  const statusLabel = getStatusLabel(connectionState);
  const headerTitle = getHeaderTitle(providerName, connectionState);
  const primaryActionLabel = getPrimaryActionLabel(providerName, connectionState);
  const showCompactConnectedLabel = connectionState === 'connected';
  const showManagePanel = connectionState === 'connected' && manageOpen;
  const showConnectFlow = connectionState === 'connecting';
  const showIssuePanel = connectionState === 'error' && Boolean(message);

  return (
    <div
      className={`agent-connection-card agent-connection-card-${connectionState}${showManagePanel || showConnectFlow || showIssuePanel ? ' agent-connection-card-expanded' : ''}`}
      role="group"
      aria-label={`${providerName} ${statusLabel.toLowerCase()}`}
    >
      <div className="agent-connection-row">
        <div className="agent-connection-main">
          <div className="agent-connection-copy">
            {showCompactConnectedLabel ? (
              <p className="agent-connection-title agent-connection-title-connected">
                <span className={`agent-connection-status-dot agent-connection-status-dot-${connectionState}`} aria-hidden="true" />
                <span>{providerName}</span>
                <span className="agent-connection-sr-only">{statusLabel}</span>
              </p>
            ) : (
              <>
                <p className="agent-connection-title">{headerTitle}</p>
                <p className="agent-connection-status-line">
                  <span className={`agent-connection-status-dot agent-connection-status-dot-${connectionState}`} aria-hidden="true" />
                  <span>{statusLabel}</span>
                </p>
              </>
            )}
          </div>
        </div>

        {primaryActionLabel ? (
          <button
            className="secondary-button compact-button agent-connection-action"
            type="button"
            onClick={() => {
              if (connectionState === 'connected') {
                onManage?.();
                return;
              }

              onConnect?.();
            }}
            disabled={actionDisabled}
            aria-expanded={connectionState === 'connected' ? manageOpen : undefined}
          >
            {primaryActionLabel}
          </button>
        ) : null}
      </div>

      {showManagePanel ? (
        <div className="agent-connection-panel">
          <p className="agent-connection-detail">
            {accountLabel ? `Connected as ${accountLabel}.` : `${providerName} is connected for this workspace.`}
          </p>
          <div className="agent-connection-panel-actions">
            <button
              className="text-button text-button-muted agent-connection-inline-action"
              type="button"
              onClick={onDisconnect}
              disabled={actionDisabled}
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : null}

      {showConnectFlow ? (
        <div className="agent-connection-panel agent-connect-flow">
          <p className="agent-connect-copy">
            Open{' '}
            <a href={authUrl} target="_blank" rel="noreferrer">
              {authUrl ?? 'the device login page'}
            </a>{' '}
            and enter:
          </p>
          <p className="agent-device-code">{deviceCode ?? 'Waiting for code…'}</p>
          <p className="context-subtle">Workshop will notice once the login finishes.</p>
        </div>
      ) : null}

      {showIssuePanel ? (
        <div className="agent-connection-panel">
          <p className="agent-connection-detail">{message}</p>
        </div>
      ) : null}
    </div>
  );
}
