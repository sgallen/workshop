import type { Section } from '../types.js';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section';
}

export function parseMarkdownSections(markdown: string): Section[] {
  const lines = markdown.split('\n');
  const headings: Array<Pick<Section, 'level' | 'headingText' | 'startLine'>> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index]);

    if (!match) {
      continue;
    }

    headings.push({
      level: match[1].length,
      headingText: match[2].trim(),
      startLine: index + 1
    });
  }

  if (headings.length === 0) {
    return [
      {
        id: 'document',
        headingText: 'Document',
        level: 1,
        startLine: 1,
        endLine: lines.length,
        markdown
      }
    ];
  }

  return headings.map((heading, index) => {
    const nextHeading = headings[index + 1];
    const endLine = nextHeading ? nextHeading.startLine - 1 : lines.length;
    const sectionMarkdown = lines.slice(heading.startLine - 1, endLine).join('\n').trim();

    return {
      id: `${slugify(heading.headingText)}-${index + 1}`,
      headingText: heading.headingText,
      level: heading.level,
      startLine: heading.startLine,
      endLine,
      markdown: sectionMarkdown
    };
  });
}
