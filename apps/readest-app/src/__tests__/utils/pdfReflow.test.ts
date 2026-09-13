import { describe, it, expect, vi } from 'vitest';

import type { BookDoc } from '@/libs/document';
import { CFI } from '@/libs/document';
import { makeReflowPDFBook } from '@/utils/pdfReflow';

const PAGE_W = 612;
const PAGE_H = 792;

const span = (text: string, leftPx: number, topPx: number): HTMLSpanElement => {
  const el = document.createElement('span');
  el.textContent = text;
  el.style.left = `${((leftPx / PAGE_W) * 100).toFixed(2)}%`;
  el.style.top = `${((topPx / PAGE_H) * 100).toFixed(2)}%`;
  el.style.setProperty('--font-height', '10px');
  return el;
};

// A synthetic pdf.js page document: canvas + textLayer with one styled span
// per row, a <br> between rows, and the pdf.js layer dimension string.
const makePageDoc = (rows: Array<{ top: number; spans: string[] }>): Document => {
  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = '<div id="canvas"></div><div class="textLayer"></div>';
  const layer = doc.querySelector('.textLayer') as HTMLElement;
  for (const row of rows) {
    row.spans.forEach((text, i) => layer.append(span(text, 100 + i * 200, row.top)));
    const br = doc.createElement('br');
    br.setAttribute('role', 'presentation');
    layer.append(br);
  }
  layer.style.width = `round(down, var(--total-scale-factor) * ${PAGE_W}px, 1px)`;
  layer.style.height = `round(down, var(--total-scale-factor) * ${PAGE_H}px, 1px)`;
  return doc;
};

const makeFakePdfBook = (pages: Document[]): BookDoc =>
  ({
    metadata: { title: 'Fake PDF', author: '', language: 'en' },
    rendition: { layout: 'pre-paginated', viewport: { width: PAGE_W, height: PAGE_H } },
    dir: 'ltr',
    toc: [{ label: 'Page 2', href: '1' }],
    pageList: [{ label: 'ii', href: '1' }],
    sections: pages.map((doc, index) => ({
      id: String(index),
      cfi: '',
      size: 1000,
      linear: 'yes',
      createDocument: async () => doc,
    })),
    splitTOCHref: (href: string) => (href ? href.split('#') : []),
    getCover: async () => null,
    destroy: vi.fn(),
  }) as unknown as BookDoc;

const paragraphTexts = async (book: BookDoc, index: number): Promise<string[]> => {
  const doc = await book.sections[index]!.createDocument!();
  return Array.from(doc.querySelectorAll('p')).map((p) => p.textContent ?? '');
};

describe('makeReflowPDFBook', () => {
  it('produces a reflowable book with one section per PDF page', () => {
    const pdfBook = makeFakePdfBook([
      makePageDoc([{ top: 100, spans: ['one'] }]),
      makePageDoc([{ top: 100, spans: ['two'] }]),
    ]);
    const book = makeReflowPDFBook(pdfBook);

    expect(book.rendition.layout).toBe('reflowable');
    expect(book.sections).toHaveLength(2);
  });

  it('gives each section the fake spine CFI foliate would synthesize', () => {
    const pdfBook = makeFakePdfBook([
      makePageDoc([{ top: 100, spans: ['one'] }]),
      makePageDoc([{ top: 100, spans: ['two'] }]),
    ]);
    const book = makeReflowPDFBook(pdfBook);

    book.sections.forEach((section, index) => {
      expect(section.cfi).toBe(CFI.fake.fromIndex(index));
    });
  });

  it('extracts the page text and joins wrapped lines into paragraphs', async () => {
    const pdfBook = makeFakePdfBook([
      makePageDoc([
        { top: 100, spans: ['first line of paragraph one'] },
        { top: 112, spans: ['second line of paragraph one'] },
        { top: 148, spans: ['first line of paragraph two'] },
        { top: 160, spans: ['second line of paragraph two'] },
      ]),
    ]);
    const book = makeReflowPDFBook(pdfBook);

    expect(await paragraphTexts(book, 0)).toEqual([
      'first line of paragraph one second line of paragraph one',
      'first line of paragraph two second line of paragraph two',
    ]);
  });

  it('emits a placeholder paragraph for a page without extractable text', async () => {
    const pdfBook = makeFakePdfBook([makePageDoc([])]);
    const book = makeReflowPDFBook(pdfBook);

    const texts = await paragraphTexts(book, 0);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBeTruthy();
  });

  it('runs loadContent through the transformTarget pipeline and caches it', async () => {
    const pdfBook = makeFakePdfBook([makePageDoc([{ top: 100, spans: ['hello reflow'] }])]);
    const book = makeReflowPDFBook(pdfBook);
    const handler = vi.fn((event: Event) => {
      const detail = (event as CustomEvent<{ data: string }>).detail;
      detail.data = detail.data.replace('hello', 'goodbye');
    });
    book.transformTarget!.addEventListener('data', handler);

    const section = book.sections[0] as unknown as { loadContent: () => Promise<string> };
    await expect(section.loadContent()).resolves.toContain('goodbye reflow');
    expect(handler).toHaveBeenCalledTimes(1);
    await section.loadContent();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('invalidates the transformed cache on unload', async () => {
    const pdfBook = makeFakePdfBook([makePageDoc([{ top: 100, spans: ['hello reflow'] }])]);
    const book = makeReflowPDFBook(pdfBook);
    const handler = vi.fn((event: Event) => {
      void (event as CustomEvent<{ data: string }>).detail;
    });
    book.transformTarget!.addEventListener('data', handler);

    const section = book.sections[0] as unknown as {
      loadContent: () => Promise<string>;
      unload: () => void;
    };
    await section.loadContent();
    section.unload();
    await section.loadContent();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('passes TOC, page list, metadata, and dir through from the PDF book', () => {
    const pdfBook = makeFakePdfBook([makePageDoc([{ top: 100, spans: ['one'] }])]);
    const book = makeReflowPDFBook(pdfBook);

    expect(book.toc).toBe(pdfBook.toc);
    expect(book.pageList).toBe(pdfBook.pageList);
    expect(book.metadata).toBe(pdfBook.metadata);
    expect(book.dir).toBe(pdfBook.dir);
  });

  it('destroy() revokes the reflow URLs without destroying the PDF book', async () => {
    const pdfBook = makeFakePdfBook([makePageDoc([{ top: 100, spans: ['one'] }])]);
    const book = makeReflowPDFBook(pdfBook);

    (book.sections[0] as unknown as { load: () => string }).load();
    book.destroy!();
    expect(pdfBook.destroy).not.toHaveBeenCalled();
  });
});
