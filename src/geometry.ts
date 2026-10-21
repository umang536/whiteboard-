import {
  Point,
  PointObject,
  Bounds,
  BoxElement,
  ArrowElement,
  ExcalidrawElement,
  ResizeHandle,
  ResizeHandleInfo,
  AnchorPosition,
} from './types';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
}

export function normalizeBox(box: { x: number; y: number; width: number; height: number }) {
  let { x, y, width, height } = box;
  if (width < 0) {
    x += width;
    width = Math.abs(width);
  }
  if (height < 0) {
    y += height;
    height = Math.abs(height);
  }
  return { x, y, width, height };
}

export function getBoxBounds(box: BoxElement): Bounds {
  const norm = normalizeBox(box);
  return {
    minX: norm.x,
    minY: norm.y,
    maxX: norm.x + norm.width,
    maxY: norm.y + norm.height,
    width: norm.width,
    height: norm.height,
  };
}

export function getBoxCenter(box: BoxElement): PointObject {
  const norm = normalizeBox(box);
  return {
    x: norm.x + norm.width / 2,
    y: norm.y + norm.height / 2,
  };
}

export interface BoxAnchor {
  position: AnchorPosition;
  x: number;
  y: number;
}

export function getBoxAnchors(box: BoxElement): BoxAnchor[] {
  const norm = normalizeBox(box);
  return [
    { position: 'top', x: norm.x + norm.width / 2, y: norm.y },
    { position: 'right', x: norm.x + norm.width, y: norm.y + norm.height / 2 },
    { position: 'bottom', x: norm.x + norm.width / 2, y: norm.y + norm.height },
    { position: 'left', x: norm.x, y: norm.y + norm.height / 2 },
    { position: 'center', x: norm.x + norm.width / 2, y: norm.y + norm.height / 2 },
  ];
}

/**
 * Calculates the exact intersection between a line from box center towards targetPoint
 * and the box's perimeter.
 */
export function getBoxPerimeterIntersection(box: BoxElement, targetPoint: PointObject): PointObject {
  const norm = normalizeBox(box);
  const cx = norm.x + norm.width / 2;
  const cy = norm.y + norm.height / 2;

  const dx = targetPoint.x - cx;
  const dy = targetPoint.y - cy;

  if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) {
    return { x: cx, y: cy };
  }

  const hw = Math.max(norm.width / 2, 1);
  const hh = Math.max(norm.height / 2, 1);

  const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity;

  const t = Math.min(tx, ty);

  return {
    x: cx + t * dx,
    y: cy + t * dy,
  };
}

/**
 * Calculate the exact endpoints for an arrow, resolving any bindings to box perimeters.
 */
export function getBoundArrowEndpoints(
  arrow: ArrowElement,
  elementsMap?: Map<string, ExcalidrawElement>
): { startX: number; startY: number; endX: number; endY: number } {
  const startEl = arrow.startBinding && elementsMap ? elementsMap.get(arrow.startBinding.elementId) : null;
  const endEl = arrow.endBinding && elementsMap ? elementsMap.get(arrow.endBinding.elementId) : null;

  const startBox = startEl && startEl.type === 'box' ? (startEl as BoxElement) : null;
  const endBox = endEl && endEl.type === 'box' ? (endEl as BoxElement) : null;

  let startX = arrow.startX;
  let startY = arrow.startY;
  let endX = arrow.endX;
  let endY = arrow.endY;

  if (startBox && endBox) {
    const startCenter = getBoxCenter(startBox);
    const endCenter = getBoxCenter(endBox);
    const startPt = getBoxPerimeterIntersection(startBox, endCenter);
    const endPt = getBoxPerimeterIntersection(endBox, startCenter);
    startX = startPt.x;
    startY = startPt.y;
    endX = endPt.x;
    endY = endPt.y;
  } else if (startBox) {
    const startPt = getBoxPerimeterIntersection(startBox, { x: arrow.endX, y: arrow.endY });
    startX = startPt.x;
    startY = startPt.y;
    endX = arrow.endX;
    endY = arrow.endY;
  } else if (endBox) {
    startX = arrow.startX;
    startY = arrow.startY;
    const endPt = getBoxPerimeterIntersection(endBox, { x: arrow.startX, y: arrow.startY });
    endX = endPt.x;
    endY = endPt.y;
  }

  return { startX, startY, endX, endY };
}

export function getArrowBounds(
  arrow: ArrowElement,
  elementsMap?: Map<string, ExcalidrawElement>
): Bounds {
  const { startX, startY, endX, endY } = getBoundArrowEndpoints(arrow, elementsMap);
  const minX = Math.min(startX, endX);
  const minY = Math.min(startY, endY);
  const maxX = Math.max(startX, endX);
  const maxY = Math.max(startY, endY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

export function getElementBounds(
  element: ExcalidrawElement,
  elementsMap?: Map<string, ExcalidrawElement>
): Bounds {
  if (element.type === 'box') {
    return getBoxBounds(element);
  }
  return getArrowBounds(element, elementsMap);
}

export function getCommonBounds(
  elements: ExcalidrawElement[],
  elementsMap?: Map<string, ExcalidrawElement>
): Bounds | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const b = getElementBounds(el, elementsMap);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  if (minX === Infinity) return null;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

export function hitTest(
  element: ExcalidrawElement,
  x: number,
  y: number,
  zoom: number,
  elementsMap?: Map<string, ExcalidrawElement>
): boolean {
  const hitThreshold = 8 / zoom;

  if (element.type === 'box') {
    const norm = normalizeBox(element);
    return (
      x >= norm.x - hitThreshold &&
      x <= norm.x + norm.width + hitThreshold &&
      y >= norm.y - hitThreshold &&
      y <= norm.y + norm.height + hitThreshold
    );
  }

  if (element.type === 'arrow') {
    const { startX, startY, endX, endY } = getBoundArrowEndpoints(element, elementsMap);
    return distanceToSegment(x, y, startX, startY, endX, endY) <= hitThreshold;
  }

  return false;
}

export function getResizeHandles(box: BoxElement, zoom: number): ResizeHandleInfo[] {
  const norm = normalizeBox(box);
  const size = 8 / zoom;
  const half = size / 2;

  const x = norm.x;
  const y = norm.y;
  const w = norm.width;
  const h = norm.height;

  return [
    { handle: 'nw', x: x - half, y: y - half, width: size, height: size },
    { handle: 'n', x: x + w / 2 - half, y: y - half, width: size, height: size },
    { handle: 'ne', x: x + w - half, y: y - half, width: size, height: size },
    { handle: 'e', x: x + w - half, y: y + h / 2 - half, width: size, height: size },
    { handle: 'se', x: x + w - half, y: y + h - half, width: size, height: size },
    { handle: 's', x: x + w / 2 - half, y: y + h - half, width: size, height: size },
    { handle: 'sw', x: x - half, y: y + h - half, width: size, height: size },
    { handle: 'w', x: x - half, y: y + h / 2 - half, width: size, height: size },
  ];
}

export function hitTestResizeHandle(
  box: BoxElement,
  x: number,
  y: number,
  zoom: number
): ResizeHandle | null {
  const handles = getResizeHandles(box, zoom);
  const hitPadding = 4 / zoom;

  for (const h of handles) {
    if (
      x >= h.x - hitPadding &&
      x <= h.x + h.width + hitPadding &&
      y >= h.y - hitPadding &&
      y <= h.y + h.height + hitPadding
    ) {
      return h.handle;
    }
  }

  return null;
}

export function getCursorForHandle(handle: ResizeHandle): string {
  switch (handle) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    default:
      return 'default';
  }
}

export function findNearbyAnchor(
  x: number,
  y: number,
  boxes: BoxElement[],
  threshold: number
): { box: BoxElement; anchor: BoxAnchor } | null {
  let closestDist = threshold;
  let match: { box: BoxElement; anchor: BoxAnchor } | null = null;

  for (const box of boxes) {
    const anchors = getBoxAnchors(box);
    for (const anchor of anchors) {
      const d = Math.hypot(anchor.x - x, anchor.y - y);
      if (d < closestDist) {
        closestDist = d;
        match = { box, anchor };
      }
    }
  }

  return match;
}

export function isElementInBounds(
  element: ExcalidrawElement,
  bounds: Bounds,
  elementsMap?: Map<string, ExcalidrawElement>
): boolean {
  const elBounds = getElementBounds(element, elementsMap);

  return !(
    elBounds.maxX < bounds.minX ||
    elBounds.minX > bounds.maxX ||
    elBounds.maxY < bounds.minY ||
    elBounds.minY > bounds.maxY
  );
}

export function viewportToCanvas(
  screenPoint: [number, number],
  pan: { x: number; y: number },
  zoom: number
): [number, number] {
  return [
    (screenPoint[0] - pan.x) / zoom,
    (screenPoint[1] - pan.y) / zoom,
  ];
}

export function canvasToViewport(
  canvasPoint: [number, number],
  pan: { x: number; y: number },
  zoom: number
): [number, number] {
  return [
    canvasPoint[0] * zoom + pan.x,
    canvasPoint[1] * zoom + pan.y,
  ];
}

export function hitTestElements(
  elements: ExcalidrawElement[],
  x: number,
  y: number,
  zoom: number,
  elementsMap?: Map<string, ExcalidrawElement>
): ExcalidrawElement | null {
  // Test from top to bottom (last element in array is on top)
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (hitTest(el, x, y, zoom, elementsMap)) {
      return el;
    }
  }
  return null;
}

