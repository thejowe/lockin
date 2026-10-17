/**
 * El subconjunto de Markdown de los documentos legales, en bloques que la app
 * pinta con sus propios componentes (ver `legal-document.tsx`).
 *
 * Es el mismo subconjunto que entiende `scripts/build-web.mjs` para la web —
 * títulos `#`–`###`, párrafos, listas `-` (con continuación indentada), y en
 * línea código, negrita y enlaces— más las citas `>`, que allí salen como
 * párrafo y aquí como nota. Nada de HTML: el texto se pinta tal cual.
 */

export type Span =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; url: string };

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; spans: Span[] }
  | { kind: 'paragraph'; spans: Span[] }
  | { kind: 'quote'; spans: Span[] }
  | { kind: 'list'; items: Span[][] };

const INLINE =
  /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<>)]+[^\s<>).,;:])/g;

export function parseInline(text: string): Span[] {
  const spans: Span[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) spans.push({ kind: 'text', text: text.slice(last, index) });
    if (match[1] !== undefined) spans.push({ kind: 'code', text: match[1] });
    else if (match[2] !== undefined) spans.push({ kind: 'bold', text: match[2] });
    else if (match[3] !== undefined) spans.push({ kind: 'link', text: match[3], url: match[4] });
    else spans.push({ kind: 'link', text: match[5], url: match[5] });
    last = index + match[0].length;
  }
  if (last < text.length) spans.push({ kind: 'text', text: text.slice(last) });
  return spans;
}

export function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  let items: string[] | null = null;
  let paragraph: string[] = [];
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0)
      blocks.push({ kind: 'paragraph', spans: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };
  const flushQuote = () => {
    if (quote.length > 0) blocks.push({ kind: 'quote', spans: parseInline(quote.join(' ')) });
    quote = [];
  };
  const closeList = () => {
    if (items) blocks.push({ kind: 'list', items: items.map(parseInline) });
    items = null;
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const item = /^-\s+(.*)$/.exec(line);
    const quoted = /^>\s?(.*)$/.exec(line);

    if (heading) {
      flushParagraph();
      flushQuote();
      closeList();
      blocks.push({
        kind: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        spans: parseInline(heading[2]),
      });
    } else if (quoted) {
      flushParagraph();
      closeList();
      quote.push(quoted[1].trim());
    } else if (item) {
      flushParagraph();
      flushQuote();
      items ??= [];
      items.push(item[1]);
    } else if (line.trim() === '') {
      // Una línea en blanco no cierra la lista: el siguiente elemento sigue en ella.
      flushParagraph();
      flushQuote();
    } else if (items && /^\s+/.test(line)) {
      items[items.length - 1] += ` ${line.trim()}`;
    } else {
      flushQuote();
      closeList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushQuote();
  closeList();
  return blocks;
}
