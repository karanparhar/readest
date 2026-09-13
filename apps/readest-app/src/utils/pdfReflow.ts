/**
 * A reflowable book synthesized from a pdf.js PDF book, one section per page.
 *
 * Each section's text is extracted lazily from the PDF page's text layer
 * (`createDocument()` — the same offscreen pipeline PDF search uses), its rows
 * are reassembled into paragraphs (`pdfText.ts`), and the paragraphs are
 * serialized as XHTML so the standard reflowable renderer — with its font,
 * theme, and Paragraph Mode machinery — can present it. The original PDF book
 * stays alive alongside: the wrapper only delegates to it and never destroys
 * it, so Reading Mode can toggle back to the fixed layout at the same page.
 */

import type { BookDoc, SectionItem } from '@/libs/document';
import { CFI } from '@/libs/document';
import { joinLinesToParagraphs, parseLayerDimensions, pdfLinesFromTextLayer } from './pdfText';
import { stubTranslation } from './misc';

// Page HTML is ~1-4 KB; this bounds how many extracted pages a long session
// keeps around. unload() (the paginator destroys section views as the reader
// moves) drops entries earlier.
const MAX_EXTRACTED_PAGES = 32;

const EMPTY_PAGE_TEXT = stubTranslation('No extractable text on this page');

const XHTML_NS = 'http://www.w3.org/1999/xhtml';

const REFLOW_STYLE = 'p { margin: 0 0 1em; }';

const wrapXhtml = (inner: string): string =>
  '<?xml version="1.0" encoding="utf-8"?>\n' +
  `<html xmlns="${XHTML_NS}"><head><meta charset="utf-8"/>` +
  `<style>${REFLOW_STYLE}</style></head><body>${inner}</body></html>`;

const escapeXml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// Maps can serve as an LRU: re-inserting moves the key to the end, so the
// oldest entry is always the first key.
class LruMap<T> {
  private map = new Map<number, T>();
  constructor(private max: number) {}
  get(index: number): T | undefined {
    const value = this.map.get(index);
    if (value !== undefined) {
      this.map.delete(index);
      this.map.set(index, value);
    }
    return value;
  }
  set(index: number, value: T, onEvict?: (value: T) => void): void {
    const existing = this.map.get(index);
    if (existing !== undefined) this.map.delete(index);
    this.map.set(index, value);
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      const evicted = this.map.get(oldest)!;
      this.map.delete(oldest);
      onEvict?.(evicted);
    }
  }
  delete(index: number): void {
    this.map.delete(index);
  }
  values(): IterableIterator<T> {
    return this.map.values();
  }
}

type ReflowSection = SectionItem & {
  load: () => Promise<string>;
  loadContent: () => Promise<string>;
  unload: () => void;
};

export const makeReflowPDFBook = (pdfBook: BookDoc): BookDoc => {
  const extracted = new LruMap<string>(MAX_EXTRACTED_PAGES);
  const transformed = new LruMap<string>(MAX_EXTRACTED_PAGES);
  const urls = new LruMap<string>(MAX_EXTRACTED_PAGES);

  const revokeUrl = (url: string) => URL.revokeObjectURL(url);

  const extractPageHtml = async (index: number): Promise<string> => {
    const cached = extracted.get(index);
    if (cached !== undefined) return cached;
    let paragraphs: string[] = [];
    try {
      const doc = await pdfBook.sections[index]?.createDocument();
      const layer = doc?.querySelector('.textLayer') as HTMLElement | null;
      if (layer) {
        const width = parseLayerDimensions(layer.style.width);
        const height = parseLayerDimensions(layer.style.height);
        const pageDims = width && height ? { width, height } : (pdfBook.rendition.viewport ?? null);
        paragraphs = joinLinesToParagraphs(pdfLinesFromTextLayer(layer, pageDims));
      }
    } catch {
      // Fall through to the placeholder: a failed extraction must not break
      // the whole book.
    }
    const inner = (paragraphs.length ? paragraphs : [EMPTY_PAGE_TEXT])
      .map((text) => `<p>${escapeXml(text)}</p>`)
      .join('');
    const html = wrapXhtml(inner);
    extracted.set(index, html);
    return html;
  };

  const transformTarget = new EventTarget();
  const transformSection = async (index: number): Promise<string> => {
    const cached = transformed.get(index);
    if (cached !== undefined) return cached;
    const str = await extractPageHtml(index);
    let result = str;
    try {
      const detail: { data: string | Promise<string>; type: string } = {
        data: str,
        type: 'application/xhtml+xml',
      };
      Object.defineProperty(detail, 'name', { value: String(index) });
      transformTarget.dispatchEvent(new CustomEvent('data', { detail }));
      const out = await detail.data;
      // '' is the reader transform handler's error fallback.
      if (typeof out === 'string' && out) result = out;
    } catch {
      // Keep the raw section on any transform failure.
    }
    transformed.set(index, result);
    return result;
  };

  const sections: ReflowSection[] = pdfBook.sections.map((_, index) => ({
    id: String(index),
    // The fake spine CFI foliate would synthesize anyway (see makeMarkdownBook):
    // without it every saved position collapses to a section-less CFI and
    // reopening resumes from the start. It also makes progress mapping between
    // the reflow book and the original PDF exact: section index = page index.
    cfi: CFI.fake.fromIndex(index),
    size: 1000,
    linear: 'yes',
    load: async () => {
      let url = urls.get(index);
      if (url === undefined) {
        url = URL.createObjectURL(
          new Blob([await extractPageHtml(index)], { type: 'application/xhtml+xml' }),
        );
        urls.set(index, url, revokeUrl);
      }
      return url;
    },
    loadContent: () => transformSection(index),
    unload: () => {
      transformed.delete(index);
      extracted.delete(index);
      const url = urls.get(index);
      if (url !== undefined) {
        urls.delete(index);
        revokeUrl(url);
      }
    },
    createDocument: async () => {
      // Raw, mirroring EPUB/md books: TTS replays the transform pipeline
      // itself, and a pre-transformed document would double-apply it.
      const str = await extractPageHtml(index);
      return new DOMParser().parseFromString(str, 'application/xhtml+xml');
    },
  }));

  const book = {
    metadata: pdfBook.metadata,
    rendition: { layout: 'reflowable' as const, viewport: pdfBook.rendition.viewport },
    dir: pdfBook.dir,
    toc: pdfBook.toc,
    pageList: pdfBook.pageList,
    sections,
    transformTarget,
    splitTOCHref: (href: string) => pdfBook.splitTOCHref(href),
    getCover: () => pdfBook.getCover(),
    destroy: () => {
      for (const url of urls.values()) revokeUrl(url);
      // The wrapped PDF book is shared (toggle-back keeps using it), so its
      // destroy is not called here.
    },
  };

  return book as unknown as BookDoc;
};
