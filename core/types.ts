export type AuthorType = 'human' | 'agent';

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
