export type AuthorType = 'human' | 'agent';

export type ConversationTurn = {
  id: string;
  authorType: AuthorType;
  body: string;
  createdAt: string;
  focusedSectionId: string | null;
};

export type Comment = {
  id: string;
  authorType: AuthorType;
  body: string;
  createdAt: string;
  sectionId: string | null;
};

export type Section = {
  id: string;
  headingText: string;
  level: number;
  startLine: number;
  endLine: number;
  markdown: string;
};

export type RenderedSection = Section & {
  renderedHtml: string;
};

export type SectionWithComments = RenderedSection & {
  comments: Comment[];
};

export type Artifact = {
  title: string;
  relativePath: string;
  absolutePath: string;
  updatedAt: string;
  renderedHtml?: string;
  comments: Comment[];
  sections: SectionWithComments[];
};

export type RecentArtifact = {
  title: string;
  relativePath: string;
  updatedAt: string | null;
  lastOpenedAt: string | null;
  lastDiscussedAt?: string | null;
  commentCount: number;
};

export type RecentArtifactIdentity = Pick<RecentArtifact, 'title' | 'relativePath' | 'updatedAt'>;

export type ProposalItemKind =
  | 'replace_section'
  | 'replace_document'
  | 'insert_after_section'
  | 'insert_before_section';

export type ProposalItemStatus = 'pending' | 'applied' | 'dismissed';

export type ProposalSetStatus = 'pending' | 'partially_applied' | 'applied' | 'dismissed';

export type ProposalScope = 'section' | 'document' | 'mixed';

export type ProposalItemRecord = {
  id: string;
  proposalSetId: string;
  kind: ProposalItemKind;
  status: ProposalItemStatus;
  sectionId: string | null;
  targetLabel: string;
  beforeMarkdown: string;
  afterMarkdown: string;
  summary: string;
  createdAt: string;
};

export type ProposalSetRecord = {
  id: string;
  documentId: string;
  conversationTurnId: string;
  status: ProposalSetStatus;
  summary: string;
  rationale: string;
  scope: ProposalScope;
  focusedSectionId: string | null;
  createdAt: string;
  items: ProposalItemRecord[];
};

export type RevisionSource =
  | 'proposal_item_accept'
  | 'proposal_set_accept_all'
  | 'restore_revision'
  | 'manual_save';

export type RevisionRecord = {
  id: string;
  documentId: string;
  createdAt: string;
  summary: string;
  source: RevisionSource;
  proposalSetId: string | null;
  markdown: string;
};

export type AgentTurnMessage = {
  id: string;
  authorType: 'agent';
  body: string;
  createdAt: string;
  focusedSectionId: string | null;
};

export type AgentTurnResponse = {
  messages: AgentTurnMessage[];
  proposalSet: ProposalSetRecord | null;
};

export type ProposalMutationResult = {
  artifact: Artifact;
  proposalSet: ProposalSetRecord | null;
  revisions: RevisionRecord[];
  appliedRevision: RevisionRecord | null;
};
