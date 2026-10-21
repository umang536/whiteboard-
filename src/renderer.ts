import rough from 'roughjs';
import { Options } from 'roughjs/bin/core';
import {
  ExcalidrawElement,
  BoxElement,
  ArrowElement,
  AppState,
  Bounds,
  AnchorPosition,
} from './types';
import {
  normalizeBox,
  getBoundArrowEndpoints,
  getResizeHandles,
  getBoxAnchors,
  getCommonBounds,
  BoxAnchor,
} from './geometry';

export interface RenderExtraOptions {
  marquee?: Bounds | null;
  hoveredBoxId?: string | null;
  hoveredAnchor?: { elementId: string; position: AnchorPosition } | null;
}

export function getRoughOptions(element: ExcalidrawElement): Options {
  const options: Options = {
    stroke: element.strokeColor,
    strokeWidth: element.strokeWidth,
    roughness: element.roughness,
    seed: element.seed,
    disableMultiStroke: element.roughness === 0,
  };

  if (element.strokeStyle === 'dashed') {
    options.strokeLineDash = [8, 8];
  } else if (element.strokeStyle === 'dotted') {
    options.strokeLineDash = [3, 4];
  }

  if (element.type === 'box') {
    if (element.backgroundColor && element.backgroundColor !== 'transparent' && element.fillStyle !== 'none') {
      options.fill = element.backgroundColor;
      options.fillStyle = element.fillStyle;
      if (element.fillStyle === 'hachure' || element.fillStyle === 'cross-hatch') {
        options.hachureGap = 6;
      }
    }
  }

  return options;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    const words = paragraph.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function renderBoxText(
  ctx: CanvasRenderingContext2D,
  box: BoxElement
) {
  if (!box.text || box.text.trim() === '') return;

  const norm = normalizeBox(box);
  const padding = Math.min(16, norm.width * 0.1);
  const maxWidth = Math.max(norm.width - padding * 2, 10);
  const fontSize = box.fontSize || 20;
  const lineHeight = fontSize * 1.35;

  ctx.save();
  ctx.font = `${fontSize}px 'Patrick Hand', 'Caveat', cursive, sans-serif`;
  ctx.fillStyle = box.strokeColor || '#1e1e1e';
  ctx.textBaseline = 'middle';

  const lines = wrapText(ctx, box.text, maxWidth);
  const totalTextHeight = lines.length * lineHeight;

  let startY: number;
  if (box.verticalAlign === 'top') {
    startY = norm.y + padding + lineHeight / 2;
  } else if (box.verticalAlign === 'bottom') {
    startY = norm.y + norm.height - padding - totalTextHeight + lineHeight / 2;
  } else {
    // middle (default)
    startY = norm.y + (norm.height - totalTextHeight) / 2 + lineHeight / 2;
  }

  let lineX: number;
  if (box.textAlign === 'left') {
    ctx.textAlign = 'left';
    lineX = norm.x + padding;
  } else if (box.textAlign === 'right') {
    ctx.textAlign = 'right';
    lineX = norm.x + norm.width - padding;
  } else {
    ctx.textAlign = 'center';
    lineX = norm.x + norm.width / 2;
  }

  for (let i = 0; i < lines.length; i++) {
    const curY = startY + i * lineHeight;
    // Only draw if inside vertical bounds
    if (curY >= norm.y && curY <= norm.y + norm.height + fontSize) {
      ctx.fillText(lines[i], lineX, curY);
    }
  }

  ctx.restore();
}

function renderArrow(
  rc: ReturnType<typeof rough.canvas>,
  ctx: CanvasRenderingContext2D,
  arrow: ArrowElement,
  elementsMap: Map<string, ExcalidrawElement>
) {
  const { startX, startY, endX, endY } = getBoundArrowEndpoints(arrow, elementsMap);
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.hypot(dx, dy);

  if (length < 1) return;

  const options = getRoughOptions(arrow);

  // Draw arrow line shaft
  rc.line(startX, startY, endX, endY, options);

  // Draw arrowhead wings
  const angle = Math.atan2(dy, dx);
  const arrowLength = Math.min(18, length * 0.4);
  const wingAngle = Math.PI / 6; // 30 degrees

  const wing1X = endX - arrowLength * Math.cos(angle - wingAngle);
  const wing1Y = endY - arrowLength * Math.sin(angle - wingAngle);
  const wing2X = endX - arrowLength * Math.cos(angle + wingAngle);
  const wing2Y = endY - arrowLength * Math.sin(angle + wingAngle);

  if (arrow.arrowhead === 'triangle') {
    rc.polygon([[endX, endY], [wing1X, wing1Y], [wing2X, wing2Y]], {
      ...options,
      fill: arrow.strokeColor,
      fillStyle: 'solid',
    });
  } else if (arrow.arrowhead !== 'none') {
    rc.line(endX, endY, wing1X, wing1Y, options);
    rc.line(endX, endY, wing2X, wing2Y, options);
  }
}

function renderAnchorPoints(
  ctx: CanvasRenderingContext2D,
  boxes: BoxElement[],
  zoom: number,
  hoveredAnchor?: { elementId: string; position: AnchorPosition } | null
) {
  const radius = 4 / zoom;
  const highlightRadius = 6.5 / zoom;

  for (const box of boxes) {
    const anchors = getBoxAnchors(box);
    for (const anchor of anchors) {
      if (anchor.position === 'center') continue; // Don't show center dot

      const isHovered =
        hoveredAnchor &&
        hoveredAnchor.elementId === box.id &&
        hoveredAnchor.position === anchor.position;

      ctx.save();
      ctx.beginPath();
      ctx.arc(
        anchor.x,
        anchor.y,
        isHovered ? highlightRadius : radius,
        0,
        Math.PI * 2
      );

      if (isHovered) {
        ctx.fillStyle = '#3b82f6';
        ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.lineWidth = 2 / zoom;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1.5 / zoom;
        ctx.strokeStyle = '#3b82f6';
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function renderSelectionHandles(
  ctx: CanvasRenderingContext2D,
  selectedElements: ExcalidrawElement[],
  zoom: number,
  elementsMap: Map<string, ExcalidrawElement>
) {
  if (selectedElements.length === 0) return;

  ctx.save();

  if (selectedElements.length === 1 && selectedElements[0].type === 'box') {
    const box = selectedElements[0] as BoxElement;
    const norm = normalizeBox(box);
    const padding = 3 / zoom;

    // Selection border
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5 / zoom;
    ctx.strokeRect(
      norm.x - padding,
      norm.y - padding,
      norm.width + padding * 2,
      norm.height + padding * 2
    );

    // 8 resize handles
    const handles = getResizeHandles(box, zoom);
    for (const h of handles) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5 / zoom;
      ctx.fillRect(h.x, h.y, h.width, h.height);
      ctx.strokeRect(h.x, h.y, h.width, h.height);
    }
  } else if (selectedElements.length === 1 && selectedElements[0].type === 'arrow') {
    const arrow = selectedElements[0] as ArrowElement;
    const { startX, startY, endX, endY } = getBoundArrowEndpoints(arrow, elementsMap);
    const size = 8 / zoom;
    const half = size / 2;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5 / zoom;

    // Start handle
    ctx.fillRect(startX - half, startY - half, size, size);
    ctx.strokeRect(startX - half, startY - half, size, size);

    // End handle
    ctx.fillRect(endX - half, endY - half, size, size);
    ctx.strokeRect(endX - half, endY - half, size, size);
  } else {
    // Multi-element selection bounding box
    const bounds = getCommonBounds(selectedElements, elementsMap);
    if (bounds) {
      const padding = 6 / zoom;
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.strokeRect(
        bounds.minX - padding,
        bounds.minY - padding,
        bounds.width + padding * 2,
        bounds.height + padding * 2
      );
    }
  }

  ctx.restore();
}

function renderMarquee(
  ctx: CanvasRenderingContext2D,
  marquee: Bounds,
  zoom: number
) {
  ctx.save();
  ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([4 / zoom, 4 / zoom]);

  ctx.fillRect(marquee.minX, marquee.minY, marquee.width, marquee.height);
  ctx.strokeRect(marquee.minX, marquee.minY, marquee.width, marquee.height);
  ctx.restore();
}

function renderDotGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: { x: number; y: number },
  zoom: number,
  isDark = false
) {
  let step = 20 * zoom;
  while (step < 12) step *= 2;
  while (step > 60) step /= 2;

  const offsetX = ((pan.x % step) + step) % step;
  const offsetY = ((pan.y % step) + step) % step;

  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.12)';

  for (let x = offsetX; x < width; x += step) {
    for (let y = offsetY; y < height; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Main render function for canvas
 */
export function renderCanvas(
  canvas: HTMLCanvasElement,
  elements: ExcalidrawElement[],
  appState: AppState,
  activeDrawingElement: ExcalidrawElement | null,
  extra?: RenderExtraOptions
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  // Clear canvas
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  // Background color
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.fillStyle = appState.isDarkMode ? '#121212' : '#f8f9fa';
  ctx.fillRect(0, 0, width, height);

  // Dot grid in screen space
  renderDotGrid(ctx, width, height, appState.pan, appState.zoom, !!appState.isDarkMode);
  ctx.restore();

  // Transform to canvas coordinates for elements
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.translate(appState.pan.x, appState.pan.y);
  ctx.scale(appState.zoom, appState.zoom);

  const rc = rough.canvas(canvas);

  // Combine elements with active drawing element
  const allElements = activeDrawingElement
    ? [...elements, activeDrawingElement]
    : elements;

  const elementsMap = new Map<string, ExcalidrawElement>();
  for (const el of allElements) {
    if (!el.isDeleted) {
      elementsMap.set(el.id, el);
    }
  }

  // 1. Render all non-deleted boxes first
  for (const element of allElements) {
    if (element.isDeleted || element.type !== 'box') continue;
    const norm = normalizeBox(element);
    const options = getRoughOptions(element);

    // Adjust black stroke in dark mode if needed
    if (appState.isDarkMode && options.stroke === '#1e1e1e') {
      options.stroke = '#f1f5f9';
    }

    rc.rectangle(norm.x, norm.y, norm.width, norm.height, options);

    // If currently editing this element, don't render its text on canvas
    if (appState.editingElementId !== element.id) {
      renderBoxText(ctx, element);
    }
  }

  // 2. Render all non-deleted arrows
  for (const element of allElements) {
    if (element.isDeleted || element.type !== 'arrow') continue;
    renderArrow(rc, ctx, element, elementsMap);
  }

  // 2.5 Highlight hovered box during arrow connection or mouseover
  if (extra?.hoveredBoxId) {
    const hoveredBox = allElements.find(
      (el) => el.id === extra.hoveredBoxId && el.type === 'box'
    ) as BoxElement | undefined;
    if (hoveredBox) {
      const norm = normalizeBox(hoveredBox);
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2 / appState.zoom;
      ctx.setLineDash([4 / appState.zoom, 4 / appState.zoom]);
      ctx.strokeRect(
        norm.x - 3 / appState.zoom,
        norm.y - 3 / appState.zoom,
        norm.width + 6 / appState.zoom,
        norm.height + 6 / appState.zoom
      );
      ctx.restore();
    }
  }

  // 3. Draw anchor points on boxes if drawing arrow or hovering near box edges
  const isArrowToolActive =
    appState.tool === 'arrow' ||
    activeDrawingElement?.type === 'arrow' ||
    !!extra?.hoveredBoxId;

  if (isArrowToolActive) {
    const boxes = allElements.filter(
      (el): el is BoxElement => !el.isDeleted && el.type === 'box'
    );
    renderAnchorPoints(ctx, boxes, appState.zoom, extra?.hoveredAnchor);
  }

  // 4. Selection handles for selected elements
  if (appState.selectedElementIds.length > 0 && !activeDrawingElement) {
    const selectedElements = elements.filter(
      (el) => !el.isDeleted && appState.selectedElementIds.includes(el.id)
    );
    renderSelectionHandles(ctx, selectedElements, appState.zoom, elementsMap);
  }

  // 5. Draw selection marquee
  if (extra?.marquee) {
    renderMarquee(ctx, extra.marquee, appState.zoom);
  }

  ctx.restore();
}

/**
 * Export canvas elements as PNG image Data URL
 */
export function exportToPNG(
  elements: ExcalidrawElement[],
  options?: { padding?: number; scale?: number }
): string | null {
  const activeElements = elements.filter((el) => !el.isDeleted);
  if (activeElements.length === 0) return null;

  const elementsMap = new Map<string, ExcalidrawElement>();
  for (const el of activeElements) {
    elementsMap.set(el.id, el);
  }

  const bounds = getCommonBounds(activeElements, elementsMap);
  if (!bounds) return null;

  const padding = options?.padding ?? 40;
  const scale = options?.scale ?? 2; // high res 2x export

  const exportCanvas = document.createElement('canvas');
  const width = (bounds.width + padding * 2) * scale;
  const height = (bounds.height + padding * 2) * scale;

  exportCanvas.width = width;
  exportCanvas.height = height;

  const ctx = exportCanvas.getContext('2d');
  if (!ctx) return null;

  // Fill background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-bounds.minX + padding, -bounds.minY + padding);

  const rc = rough.canvas(exportCanvas);

  // Render boxes
  for (const el of activeElements) {
    if (el.type === 'box') {
      const norm = normalizeBox(el);
      rc.rectangle(norm.x, norm.y, norm.width, norm.height, getRoughOptions(el));
      renderBoxText(ctx, el);
    }
  }

  // Render arrows
  for (const el of activeElements) {
    if (el.type === 'arrow') {
      renderArrow(rc, ctx, el, elementsMap);
    }
  }

  ctx.restore();

  return exportCanvas.toDataURL('image/png');
}
