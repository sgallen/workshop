export type AgentAuthState = 'not_connected' | 'connecting' | 'connected' | 'expired' | 'error';

export type AgentAuthStatus = {
  state: AgentAuthState;
  provider: 'openai-codex';
  authMode?: string;
  accountLabel?: string;
  authUrl?: string;
  code?: string | null;
  startedAt?: string;
  message?: string;
};

export function summarizeAgentStatus(
  agentAuth: AgentAuthStatus | null,
  agentAuthLoading: boolean
): string {
  if (agentAuthLoading || !agentAuth) {
    return 'Checking agent…';
  }

  switch (agentAuth.state) {
    case 'connected':
      return 'Codex connected';
    case 'connecting':
      return agentAuth.code ? `Enter code ${agentAuth.code}` : 'Finish connecting Codex';
    case 'expired':
      return 'Codex needs reconnect';
    case 'error':
      return 'Codex connection error';
    default:
      return 'Codex not connected';
  }
}

export function renderRailAgentHint(
  agentAuth: AgentAuthStatus | null,
  agentAuthLoading: boolean
): string {
  if (agentAuthLoading || !agentAuth) {
    return 'Not connected';
  }

  return agentAuth.state === 'connected' ? 'Connected' : 'Not connected';
}

export function renderDrawerAgentStatusLabel(
  agentAuth: AgentAuthStatus | null,
  agentAuthLoading: boolean
): string {
  if (agentAuthLoading || !agentAuth) {
    return 'Checking';
  }

  switch (agentAuth.state) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'expired':
      return 'Reconnect';
    case 'error':
      return 'Error';
    default:
      return 'Not connected';
  }
}

export function renderDrawerAgentActionLabel(
  agentAuth: AgentAuthStatus | null,
  agentAuthLoading: boolean
): string {
  if (agentAuthLoading) {
    return 'Checking…';
  }

  if (agentAuth?.state === 'connected') {
    return 'Disconnect';
  }

  if (agentAuth?.state === 'expired') {
    return 'Reconnect';
  }

  return 'Connect';
}
