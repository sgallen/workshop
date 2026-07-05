import { ChildProcess, spawn, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ProposalSetRecord } from '../core/types.js';

export type AgentAuthState = 'not_connected' | 'connecting' | 'connected' | 'expired' | 'error';

export type AgentAuthStatus = {
  state: AgentAuthState;
  provider: 'openai-codex';
  authMode?: 'chatgpt';
  accountLabel?: string;
  authUrl?: string;
  code?: string | null;
  startedAt?: string;
  message?: string;
};

export type DocumentAgentTurnInput = {
  documentPath: string;
  markdown: string;
  prompt: string;
  focusedSection: {
    id: string;
    headingText: string;
    markdown: string;
  } | null;
  sections: Array<{
    id: string;
    headingText: string;
    markdown: string;
  }>;
  activeProposalSet: ProposalSetRecord | null;
};

type RawAgentTurnResult = {
  messages: Array<{
    body: string;
    sectionId: string | null;
  }>;
  proposal: null | {
    summary: string;
    rationale: string;
    items: Array<{
      summary: string;
      targetSectionId: string;
      afterMarkdown: string;
    }>;
  };
};

type ActiveLoginAttempt = {
  child: ChildProcess;
  output: string;
  authUrl: string;
  code: string | null;
  startedAt: string;
};

const AUTH_STATUS = {
  NOT_CONNECTED: 'not_connected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  EXPIRED: 'expired',
  ERROR: 'error'
} as const;

const DEVICE_AUTH_URL = 'https://auth.openai.com/codex/device';

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function resolveCodexHome(rootDir: string): string {
  return path.join(rootDir, '.workshop-data', 'codex');
}

function resolveAuthFile(rootDir: string): string {
  return path.join(resolveCodexHome(rootDir), 'auth.json');
}

function resolveCodexConfigFile(rootDir: string): string {
  return path.join(resolveCodexHome(rootDir), 'config.toml');
}

function createCodexEnv(rootDir: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CODEX_HOME: resolveCodexHome(rootDir)
  };
}

async function ensureCodexConfig(rootDir: string): Promise<void> {
  const codexHome = resolveCodexHome(rootDir);
  const configFile = resolveCodexConfigFile(rootDir);

  await fs.mkdir(codexHome, { recursive: true });
  await fs.writeFile(configFile, 'cli_auth_credentials_store = "file"\n');
}

async function authFileExists(rootDir: string): Promise<boolean> {
  try {
    await fs.access(resolveAuthFile(rootDir));
    return true;
  } catch {
    return false;
  }
}

function parseDeviceCode(output: string): { authUrl: string; code: string | null } {
  const clean = stripAnsi(output);
  const urlMatch = clean.match(/https:\/\/auth\.openai\.com\/codex\/device/);
  const codeMatch = clean.match(/\b[A-Z0-9]{4,6}-[A-Z0-9]{4,6}\b/);

  return {
    authUrl: urlMatch?.[0] ?? DEVICE_AUTH_URL,
    code: codeMatch?.[0] ?? null
  };
}

function parseConnectedIdentity(stdout: string): string {
  const clean = stripAnsi(stdout);
  const match = clean.match(/Logged in using (.+)/i);
  return match?.[1]?.trim() ?? 'ChatGPT';
}

function buildDocumentTurnPrompt(input: DocumentAgentTurnInput): string {
  const sectionSummaries = input.sections.map((section) => {
    return [
      `Section ID: ${section.id}`,
      `Heading: ${section.headingText}`,
      '<section_markdown>',
      section.markdown,
      '</section_markdown>'
    ].join('\n');
  }).join('\n\n');

  const focusBlock = input.focusedSection
    ? [
        'Focused section:',
        `- id: ${input.focusedSection.id}`,
        `- heading: ${input.focusedSection.headingText}`,
        '<focused_section_markdown>',
        input.focusedSection.markdown,
        '</focused_section_markdown>'
      ].join('\n')
    : 'Focused section: none';

  const activeProposalItem = input.activeProposalSet?.items.find((item) => item.status === 'pending') ?? null;
  const activeProposalItems = input.activeProposalSet?.items.filter((item) => item.status === 'pending') ?? [];
  const activeProposalBlock = input.activeProposalSet
    ? [
        'There is already one active pending proposal set.',
        'By default, treat the next user prompt as a refinement of that pending proposal, not as a separate proposal round.',
        'If you return a new proposal, it replaces the current pending proposal instead of stacking on top of it.',
        'Only return discussion with proposal = null when the user is clearly discussing, asking a question, or not yet asking for a revised draft.',
        `Current proposal summary: ${input.activeProposalSet.summary}`,
        `Current proposal focused section id: ${input.activeProposalSet.focusedSectionId ?? 'none'}`,
        activeProposalItems.length > 0
          ? activeProposalItems.map((item, index) => {
              return [
                `Current proposal item ${index + 1} target section id: ${item.sectionId ?? 'none'}`,
                '<current_pending_proposal_markdown>',
                item.afterMarkdown,
                '</current_pending_proposal_markdown>'
              ].join('\n');
            }).join('\n')
          : activeProposalItem
            ? `Current proposal target section id: ${activeProposalItem.sectionId ?? 'none'}`
            : 'There is no pending proposal item markdown.',
        'Any refined proposal must still be written against the canonical document provided below, not against an imagined layered draft.'
      ].join('\n')
    : 'There is no active proposal set.';

  return `
You are helping a human refine a Markdown document inside Workshop.

Return valid JSON matching the provided schema.

Rules:
- Always return at least one short agent discussion message in messages.
- Each message must include body and sectionId.
- sectionId must be one of the provided section ids when the message is clearly about exactly one section.
- Otherwise sectionId must be null.
- The full document is in context.
- The focused section is only a hint, not a hard boundary.
- Only create a proposal when you can honestly express it as one or more replace_section items against existing section ids.
- If the request spans a few sections but can still be expressed as explicit section replacements, prefer returning a multi-item proposal instead of discussion only.
- If the request is mainly critique, clarification, or too broad to express as a small set of concrete section replacements, return discussion only and set proposal to null.
- If there is already an active pending proposal set and the user is pushing on the wording or direction, prefer returning a refined replacement proposal.
- If you create a proposal, each proposal item must include summary, targetSectionId, and afterMarkdown.
- If you create a proposal, each item's afterMarkdown must be complete Markdown for the replacement section, including the heading line.
- Keep proposal item count small and focused.
- If you create a proposal, your discussion messages must describe it as a proposal or suggested revision, not as an already-applied document change.
- Avoid implementation wording like "I changed", "I updated", or "I tightened" when proposal is not null. Prefer phrasing like "I propose", "A tighter version would be", or "This proposal would".
- If the user is focused on a section and asks for a rewrite there, prefer that section id.
- Never invent section ids. Use one of the provided ids exactly.

Document path: ${input.documentPath}

${focusBlock}

${activeProposalBlock}

User prompt:
${input.prompt}

Available sections:
${sectionSummaries}

Full document markdown:
<document_markdown>
${input.markdown}
</document_markdown>
  `.trim();
}

async function runCodexExec(rootDir: string, prompt: string): Promise<RawAgentTurnResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workshop-agent-turn-'));
  const schemaPath = path.join(tempDir, 'schema.json');
  const outputPath = path.join(tempDir, 'result.json');

  const schema = {
    type: 'object',
    properties: {
      messages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            body: {
              type: 'string'
            },
            sectionId: {
              anyOf: [
                { type: 'string' },
                { type: 'null' }
              ]
            }
          },
          required: ['body', 'sectionId'],
          additionalProperties: false
        },
        minItems: 1
      },
      proposal: {
        anyOf: [
          { type: 'null' },
          {
              type: 'object',
              properties: {
                summary: { type: 'string' },
                rationale: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      summary: { type: 'string' },
                      targetSectionId: { type: 'string' },
                      afterMarkdown: { type: 'string' }
                    },
                    required: ['summary', 'targetSectionId', 'afterMarkdown'],
                    additionalProperties: false
                  },
                  minItems: 1
                }
              },
            required: ['summary', 'rationale', 'items'],
            additionalProperties: false
          }
        ]
      }
    },
    required: ['messages', 'proposal'],
    additionalProperties: false
  };

  await fs.writeFile(schemaPath, JSON.stringify(schema, null, 2));

  try {
    const args = [
      'exec',
      '-C',
      rootDir,
      '-m',
      'gpt-5.4-mini',
      '-s',
      'read-only',
      '--skip-git-repo-check',
      '--color',
      'never',
      '--output-schema',
      schemaPath,
      '-o',
      outputPath,
      prompt
    ];

    const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
      const child = spawn('codex', args, {
        cwd: rootDir,
        env: createCodexEnv(rootDir),
        stdio: ['ignore', 'ignore', 'pipe']
      });

      let stderr = '';

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += String(chunk);
      });

      child.on('error', reject);
      child.on('exit', (code) => {
        resolve({ code, stderr });
      });
    });

    if (result.code !== 0) {
      throw new Error(stripAnsi(result.stderr).trim() || 'Codex did not complete the document turn.');
    }

    const raw = await fs.readFile(outputPath, 'utf8');
    return JSON.parse(raw) as RawAgentTurnResult;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

let activeLoginAttempt: ActiveLoginAttempt | null = null;
let lastAuthError: string | null = null;

function getConnectingStatus(): AgentAuthStatus | null {
  if (!activeLoginAttempt) {
    return null;
  }

  return {
    state: AUTH_STATUS.CONNECTING,
    provider: 'openai-codex',
    authUrl: activeLoginAttempt.authUrl,
    code: activeLoginAttempt.code,
    startedAt: activeLoginAttempt.startedAt,
    message: 'Finish the device-code login to connect Workshop to your Codex account.'
  };
}

export async function getAgentAuthStatus(rootDir: string): Promise<AgentAuthStatus> {
  await ensureCodexConfig(rootDir);

  const connecting = getConnectingStatus();

  if (connecting) {
    return connecting;
  }

  const result = spawnSync('codex', ['login', 'status'], {
    env: createCodexEnv(rootDir),
    encoding: 'utf8'
  });

  if (result.status === 0) {
    lastAuthError = null;

    return {
      state: AUTH_STATUS.CONNECTED,
      provider: 'openai-codex',
      authMode: 'chatgpt',
      accountLabel: parseConnectedIdentity(result.stdout)
    };
  }

  const hasStoredAuth = await authFileExists(rootDir);

  if (lastAuthError) {
    return {
      state: AUTH_STATUS.ERROR,
      provider: 'openai-codex',
      message: lastAuthError
    };
  }

  if (hasStoredAuth) {
    return {
      state: AUTH_STATUS.EXPIRED,
      provider: 'openai-codex',
      message: 'Stored Codex credentials are present but not currently usable. Reconnect to continue.'
    };
  }

  return {
    state: AUTH_STATUS.NOT_CONNECTED,
    provider: 'openai-codex'
  };
}

export async function startAgentConnect(rootDir: string): Promise<AgentAuthStatus> {
  await ensureCodexConfig(rootDir);

  const currentStatus = await getAgentAuthStatus(rootDir);

  if (currentStatus.state === AUTH_STATUS.CONNECTED || currentStatus.state === AUTH_STATUS.CONNECTING) {
    return currentStatus;
  }

  lastAuthError = null;

  const child = spawn('codex', ['login', '--device-auth'], {
    env: createCodexEnv(rootDir),
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  activeLoginAttempt = {
    child,
    output: '',
    authUrl: DEVICE_AUTH_URL,
    code: null,
    startedAt: new Date().toISOString()
  };

  child.stdout.on('data', (chunk: Buffer) => {
    if (!activeLoginAttempt || activeLoginAttempt.child !== child) {
      return;
    }

    activeLoginAttempt.output += String(chunk);
    const parsed = parseDeviceCode(activeLoginAttempt.output);
    activeLoginAttempt.authUrl = parsed.authUrl;
    activeLoginAttempt.code = parsed.code;
  });

  child.stderr.on('data', (chunk: Buffer) => {
    if (!activeLoginAttempt || activeLoginAttempt.child !== child) {
      return;
    }

    activeLoginAttempt.output += String(chunk);
  });

  child.on('exit', async (code) => {
    const finishedAttempt = activeLoginAttempt && activeLoginAttempt.child === child ? activeLoginAttempt : null;

    if (finishedAttempt) {
      activeLoginAttempt = null;
    }

    if (!finishedAttempt) {
      return;
    }

    if (code === 0) {
      try {
        const status = await getAgentAuthStatus(rootDir);

        if (status.state !== AUTH_STATUS.CONNECTED) {
          lastAuthError = 'Codex login finished, but Workshop could not confirm a connected account.';
        }
      } catch {
        lastAuthError = 'Codex login finished, but Workshop could not confirm a connected account.';
      }

      return;
    }

    const output = stripAnsi(finishedAttempt.output).trim();
    lastAuthError = output || 'Codex login did not complete.';
  });

  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    const status = getConnectingStatus();

    if (status?.code) {
      return status;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  return getConnectingStatus() ?? {
    state: AUTH_STATUS.ERROR,
    provider: 'openai-codex',
    message: 'Codex login started, but Workshop could not read the device code.'
  };
}

export async function disconnectAgent(rootDir: string): Promise<AgentAuthStatus> {
  await ensureCodexConfig(rootDir);

  if (activeLoginAttempt) {
    activeLoginAttempt.child.kill('SIGINT');
    activeLoginAttempt = null;
  }

  const result = spawnSync('codex', ['logout'], {
    env: createCodexEnv(rootDir),
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    const message = stripAnsi(result.stderr || result.stdout || '').trim();
    throw new Error(message || 'Failed to disconnect Codex.');
  }

  lastAuthError = null;

  return {
    state: AUTH_STATUS.NOT_CONNECTED,
    provider: 'openai-codex'
  };
}

export async function runDocumentAgentTurn(
  rootDir: string,
  input: DocumentAgentTurnInput
): Promise<RawAgentTurnResult> {
  const status = await getAgentAuthStatus(rootDir);

  if (status.state !== AUTH_STATUS.CONNECTED) {
    throw new Error('agent_unavailable');
  }

  return runCodexExec(rootDir, buildDocumentTurnPrompt(input));
}
