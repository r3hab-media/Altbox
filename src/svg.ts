import { Align, escapeXML, wrapText } from './util';

export interface SvgOptions {
  width: number;
  height: number;
  background: string;
  foreground: string;
  text?: string;
  fontFamily?: string;
  fontSize: number;
  fontWeight?: string;
  pad: number;
  align: Align;
  wrap: boolean;
  scale?: number;
  radius?: number;
  stroke?: string;
  strokeWidth?: number;
  shadow?: boolean;
}

const DEFAULT_FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function buildSVG(options: SvgOptions): string {
  const {
    width,
    height,
    background,
    foreground,
    text,
    fontFamily,
    fontSize,
    fontWeight,
    pad,
    align,
    wrap,
    scale = 1,
    radius = 0,
    stroke,
    strokeWidth = 0,
    shadow = false,
  } = options;

  const clampedScale = Math.max(1, Math.min(scale, 4));
  const scaledWidth = Math.max(1, Math.round(width * clampedScale));
  const scaledHeight = Math.max(1, Math.round(height * clampedScale));
  const scaledPad = Math.max(0, pad * clampedScale);
  const effectiveFontSize = fontSize * clampedScale;
  const lineHeight = effectiveFontSize * 1.2;

  const availableWidth = Math.max(0, scaledWidth - scaledPad * 2);
  const lines = text
    ? wrapText({
        text,
        maxWidth: availableWidth,
        fontSize: effectiveFontSize,
        wrap,
      })
    : [];

  const anchor = alignToAnchor(align);
  const textX = align === 'center'
    ? scaledWidth / 2
    : align === 'left'
      ? scaledPad
      : scaledWidth - scaledPad;

  const textElements = lines.length
    ? buildText(lines, {
        x: textX,
        yStart: scaledHeight / 2,
        lineHeight,
        fill: foreground,
        anchor,
        fontFamily: fontFamily ?? DEFAULT_FONT,
        fontSize: effectiveFontSize,
        fontWeight,
      })
    : '';

  const rectAttributes = buildRect({
    width: scaledWidth,
    height: scaledHeight,
    background,
    radius,
    stroke,
    strokeWidth,
    shadow,
  });

  const filterDefs = shadow ? buildShadowFilter() : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${scaledWidth} ${scaledHeight}" role="img" aria-label="${escapeXML(text ?? `${width}x${height}`)}">`,
    filterDefs,
    rectAttributes,
    textElements,
    '</svg>',
  ]
    .filter(Boolean)
    .join('');
}

function alignToAnchor(align: Align): 'start' | 'middle' | 'end' {
  switch (align) {
    case 'left':
      return 'start';
    case 'right':
      return 'end';
    default:
      return 'middle';
  }
}

interface TextOptions {
  x: number;
  yStart: number;
  lineHeight: number;
  fill: string;
  anchor: 'start' | 'middle' | 'end';
  fontFamily: string;
  fontSize: number;
  fontWeight?: string;
}

function buildText(lines: string[], options: TextOptions): string {
  const { x, yStart, lineHeight, fill, anchor, fontFamily, fontSize, fontWeight } =
    options;
  const offset = lineHeight * (lines.length - 1) * 0.5;
  const baseY = yStart - offset;

  const tspans = lines
    .map((line, index) => {
      const y = baseY + index * lineHeight;
      return `<tspan x="${x}" y="${y}">${escapeXML(line)}</tspan>`;
    })
    .join('');

  const weightAttr = fontWeight ? ` font-weight="${escapeXML(fontWeight)}"` : '';

  return `<text x="${x}" fill="${fill}" text-anchor="${anchor}" font-family="${escapeXML(fontFamily)}" font-size="${fontSize}" dominant-baseline="middle"${weightAttr}>${tspans}</text>`;
}

interface RectOptions {
  width: number;
  height: number;
  background: string;
  radius: number;
  stroke?: string;
  strokeWidth: number;
  shadow: boolean;
}

function buildRect(options: RectOptions): string {
  const { width, height, background, radius, stroke, strokeWidth, shadow } = options;

  if (background === 'transparent') {
    return `<rect width="${width}" height="${height}" fill="none"${roundCornerAttr(radius)}${strokeAttributes(stroke, strokeWidth)}${shadowAttr(shadow)} />`;
  }

  return `<rect width="${width}" height="${height}" fill="${background}"${roundCornerAttr(radius)}${strokeAttributes(stroke, strokeWidth)}${shadowAttr(shadow)} />`;
}

function roundCornerAttr(radius: number): string {
  if (!radius) {
    return '';
  }
  return ` rx="${radius}" ry="${radius}"`;
}

function strokeAttributes(stroke?: string, strokeWidth?: number): string {
  if (!stroke || !strokeWidth) {
    return '';
  }
  return ` stroke="${stroke}" stroke-width="${strokeWidth}"`;
}

function shadowAttr(shadow: boolean): string {
  return shadow ? ' filter="url(#dropShadow)"' : '';
}

function buildShadowFilter(): string {
  return '<defs><filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.25"/></filter></defs>';
}
