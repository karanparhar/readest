import { describe, it, expect } from 'vitest';

import {
  joinLinesToParagraphs,
  parseLayerDimensions,
  pdfLinesFromTextLayer,
} from '@/utils/pdfText';

// Page space used throughout: 612 x 792 px (US Letter). Estimated glyph
// advance is 0.5em per char for Latin text, so a 20-char run at em 10 spans
// 100px starting at its `left`.
const PAGE_W = 612;
const PAGE_H = 792;

const span = (text: string, leftPx: number, topPx: number, em = 10): HTMLSpanElement => {
  const el = document.createElement('span');
  el.textContent = text;
  el.style.left = `${((leftPx / PAGE_W) * 100).toFixed(2)}%`;
  el.style.top = `${((topPx / PAGE_H) * 100).toFixed(2)}%`;
  el.style.setProperty('--font-height', `${em}px`);
  return el;
};

const makeLayer = (rows: HTMLSpanElement[][], dims?: { width: number; height: number }) => {
  const layer = document.createElement('div');
  layer.className = 'textLayer';
  for (const row of rows) {
    for (const el of row) layer.append(el);
    const br = document.createElement('br');
    br.setAttribute('role', 'presentation');
    layer.append(br);
  }
  if (dims) {
    layer.style.width = `round(down, var(--total-scale-factor) * ${dims.width}px, 1px)`;
    layer.style.height = `round(down, var(--total-scale-factor) * ${dims.height}px, 1px)`;
  }
  return layer;
};

describe('parseLayerDimensions', () => {
  it('extracts the page-space size from a pdf.js layer dimension string', () => {
    expect(parseLayerDimensions('round(down, var(--total-scale-factor) * 612px, 1px)')).toBe(612);
  });

  it('parses fractional px values', () => {
    expect(parseLayerDimensions('round(down, var(--total-scale-factor) * 792.5px, 1px)')).toBe(
      792.5,
    );
  });

  it('returns null for garbage input', () => {
    expect(parseLayerDimensions('100%')).toBeNull();
    expect(parseLayerDimensions('')).toBeNull();
  });
});

describe('pdfLinesFromTextLayer', () => {
  it('builds lines from inline-style geometry without a live layout', () => {
    const layer = makeLayer([[span('Hello world line', 100, 200)]], {
      width: PAGE_W,
      height: PAGE_H,
    });

    const lines = pdfLinesFromTextLayer(layer, { width: PAGE_W, height: PAGE_H });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.text).toBe('Hello world line');
    expect(lines[0]!.left).toBeCloseTo(100, 0);
    expect(lines[0]!.top).toBeCloseTo(200, 0);
    expect(lines[0]!.em).toBe(10);
    // 16 chars x 0.5em x 10px
    expect(lines[0]!.right).toBeCloseTo(100 + 16 * 5, 0);
  });

  it('falls back to percent-space units when the page dimensions are unknown', () => {
    const layer = makeLayer([
      [span('First line of text', 100, 100)],
      [span('Second line of text', 100, 200)],
    ]);

    const lines = pdfLinesFromTextLayer(layer, null);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.left).toBeGreaterThan(0);
    expect(lines[0]!.em).toBeGreaterThan(0);
  });

  it('keeps a multi-span row as one line in reading order', () => {
    const layer = makeLayer(
      [[span('First ', 100, 100), span('second ', 135, 100), span('third', 170, 100)]],
      { width: PAGE_W, height: PAGE_H },
    );

    expect(pdfLinesFromTextLayer(layer, { width: PAGE_W, height: PAGE_H })[0]!.text).toBe(
      'First second third',
    );
  });
});

describe('joinLinesToParagraphs', () => {
  it('joins the wrapped lines of a justified paragraph with spaces', () => {
    const layer = makeLayer(
      [
        [span('If you are ever creating printed output, the most', 100, 100)],
        [span('accurate way to calibrate your monitor is to', 100, 112)],
        [span('print a test image first.', 100, 124)],
      ],
      { width: PAGE_W, height: PAGE_H },
    );
    const lines = pdfLinesFromTextLayer(layer, { width: PAGE_W, height: PAGE_H });

    expect(joinLinesToParagraphs(lines)).toEqual([
      'If you are ever creating printed output, the most accurate way to calibrate your monitor is to print a test image first.',
    ]);
  });

  it('keeps a paragraph break across a larger-than-usual vertical gap', () => {
    const layer = makeLayer(
      [
        [span('first line of paragraph one', 100, 100)],
        [span('second line of paragraph one', 100, 112)],
        [span('first line of paragraph two', 100, 148)],
        [span('second line of paragraph two', 100, 160)],
      ],
      { width: PAGE_W, height: PAGE_H },
    );
    const lines = pdfLinesFromTextLayer(layer, { width: PAGE_W, height: PAGE_H });

    expect(joinLinesToParagraphs(lines)).toEqual([
      'first line of paragraph one second line of paragraph one',
      'first line of paragraph two second line of paragraph two',
    ]);
  });

  it('keeps a paragraph break when the font size changes', () => {
    const layer = makeLayer(
      [
        [span('Chapter Heading', 100, 100, 16)],
        [span('Body text starts here and runs on', 100, 124)],
      ],
      { width: PAGE_W, height: PAGE_H },
    );
    const lines = pdfLinesFromTextLayer(layer, { width: PAGE_W, height: PAGE_H });

    expect(joinLinesToParagraphs(lines)).toEqual([
      'Chapter Heading',
      'Body text starts here and runs on',
    ]);
  });

  it('dehyphenates a word broken across lines', () => {
    const layer = makeLayer(
      [[span('a long printed hyphen-', 100, 100)], [span('ation joins without a space', 100, 112)]],
      { width: PAGE_W, height: PAGE_H },
    );
    const lines = pdfLinesFromTextLayer(layer, { width: PAGE_W, height: PAGE_H });

    expect(joinLinesToParagraphs(lines)).toEqual([
      'a long printed hyphenation joins without a space',
    ]);
  });

  it('joins CJK lines without a space', () => {
    const layer = makeLayer([[span('今天天气', 100, 100)], [span('非常好', 100, 112)]], {
      width: PAGE_W,
      height: PAGE_H,
    });
    const lines = pdfLinesFromTextLayer(layer, { width: PAGE_W, height: PAGE_H });

    expect(joinLinesToParagraphs(lines)).toEqual(['今天天气非常好']);
  });

  it('degrades to one paragraph per line when no geometry exists', () => {
    const layer = document.createElement('div');
    layer.className = 'textLayer';
    for (const text of ['first line', 'second line']) {
      const el = document.createElement('span');
      el.textContent = text;
      layer.append(el);
      const br = document.createElement('br');
      br.setAttribute('role', 'presentation');
      layer.append(br);
    }

    expect(joinLinesToParagraphs(pdfLinesFromTextLayer(layer, null))).toEqual([
      'first line',
      'second line',
    ]);
  });
});
