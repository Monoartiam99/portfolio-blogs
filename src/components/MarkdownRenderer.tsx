import React from 'react';
import { isValidHttpOrAssetUrl } from '../services/blogService';

export interface ArticleHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

export function extractHeadings(markdown: string): ArticleHeading[] {
  const headings: ArticleHeading[] = [];
  const lines = markdown.split('\n');
  let inCodeBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    if (line.startsWith('## ')) {
      const text = line.slice(3).trim();
      if (text) headings.push({ id: slugifyHeading(text), text, level: 2 });
    } else if (line.startsWith('### ')) {
      const text = line.slice(4).trim();
      if (text) headings.push({ id: slugifyHeading(text), text, level: 3 });
    }
  }

  return headings;
}

function renderInlineTokens(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    keyCounter += 1;

    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={keyCounter}
          className="font-mono text-[0.875em] px-1.5 py-0.5 bg-zinc-100 text-zinc-900 border border-zinc-200 rounded"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={keyCounter} className="font-semibold text-zinc-950">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={keyCounter} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch && isValidHttpOrAssetUrl(linkMatch[2])) {
        nodes.push(
          <a
            key={keyCounter}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1E3A8A] underline decoration-[#1E3A8A]/40 underline-offset-4 hover:decoration-[#1E3A8A] transition-colors"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

interface MarkdownRendererProps {
  content: string;
  dropCap?: boolean;
}

export function MarkdownRenderer({ content, dropCap = true }: MarkdownRendererProps) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let renderedFirstParagraph = false;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      elements.push(
        <div key={`code-${i}`} className="my-8 border border-zinc-200 bg-zinc-50 overflow-hidden">
          {lang && (
            <div className="px-4 py-2 border-b border-zinc-200 text-xs font-mono text-zinc-500">
              {lang}
            </div>
          )}
          <pre className="p-4 overflow-x-auto text-sm font-mono text-zinc-900 leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith('## ')) {
      const text = trimmed.slice(3).trim();
      elements.push(
        <h2
          key={`h2-${i}`}
          id={slugifyHeading(text)}
          className="font-serif text-2xl sm:text-[1.75rem] font-semibold text-zinc-950 mt-12 mb-4 scroll-mt-24 tracking-tight"
        >
          {text}
        </h2>
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      const text = trimmed.slice(4).trim();
      elements.push(
        <h3
          key={`h3-${i}`}
          id={slugifyHeading(text)}
          className="font-sans text-lg font-semibold text-zinc-950 mt-8 mb-3 scroll-mt-24"
        >
          {text}
        </h3>
      );
      i += 1;
      continue;
    }

    // Editorial pull-quote / blockquote (hairline top & bottom dividers, NO thick left accent border)
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i += 1;
      }
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-10 py-6 border-y border-zinc-200 font-serif italic text-xl sm:text-2xl text-zinc-800 leading-relaxed"
        >
          {renderInlineTokens(quoteLines.join(' '))}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
      ) {
        items.push(lines[i].trim().slice(2));
        i += 1;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-6 space-y-2.5 pl-5 list-disc text-zinc-700 leading-[1.75]">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineTokens(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-6 space-y-2.5 pl-5 list-decimal text-zinc-700 leading-[1.75]">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineTokens(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph (gather consecutive lines until blank line or block syntax)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('## ') &&
      !lines[i].trim().startsWith('### ') &&
      !lines[i].trim().startsWith('> ') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('- ') &&
      !lines[i].trim().startsWith('* ') &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }

    const isFirst = dropCap && !renderedFirstParagraph;
    renderedFirstParagraph = true;

    elements.push(
      <p
        key={`p-${i}`}
        className={`my-5 text-[1.0625rem] text-zinc-800 leading-[1.8] ${
          isFirst
            ? 'first-letter:font-serif first-letter:text-5xl first-letter:font-semibold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-none first-letter:text-zinc-950'
            : ''
        }`}
      >
        {renderInlineTokens(paraLines.join(' '))}
      </p>
    );
  }

  return <div className="max-w-[68ch]">{elements}</div>;
}
