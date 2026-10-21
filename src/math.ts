/**
 * Excalidraw Geometric & Connector Math Utilities
 */

import type {
  Point,
  PointObject,
  Bounds,
  BoxElement,
  ArrowElement,
  ExcalidrawElement,
  AnchorPosition,
  ResizeHandle,
  ResizeHandleInfo,
  ArrowHandle,
  RoughOptions,
  StrokeStyle,
} from './types';

export function normalizeBounds(x: number, y: number, width: number, height: number): Bounds {
  const minX = Math.min(x, x + width);
  const maxX = Math.max(x, x + width);
  const minY = Math.min(y, y + height);
  const maxY = Math.max(y, y + height);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getBoxBounds(box: Pick<BoxElement, 'x' | 'y' | 'width' | 'height'>): Bounds {
  return normalizeBounds(box.x, box.y, box.width, box.height);
}

export function getElementBounds(element: ExcalidrawElement): Bounds {
  if (element.type === 'box') {
    return getBoxBounds(element);
  }
  const minX = Math.min(element.startX, element.endX);
  const maxX = Math.max(element.startX, element.endX);
  const minY = Math.min(element.startY, element.endY);
  const maxY = Math.max(element.startY, element.endY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getBoxAnchorPoints(
  box: Pick<BoxElement, 'x' | 'y' | 'width' | 'height'>
): Record<AnchorPosition, Point> {
  const { minX, minY, maxX, maxY, width, height } = getBoxBounds(box);
  const midX = minX + width / 2;
  const midY = minY + height / 2;

  return {
    top: [midX, minY],
    right: [maxX, midY],
    bottom: [midX, maxY],
    left: [minX, midY],
    center: [midX, midY],
  };
}

export function getClosestAnchorPoint(
  box: Pick<BoxElement, 'x' | 'y' | 'width' | 'height'>,
  targetPoint: Point
): { anchor: AnchorPosition; point: Point; distance: number } {
  const anchors = getBoxAnchorPoints(box);
  const positions: AnchorPosition[] = ['top', 'right', 'bottom', 'left'];

  let closestAnchor: AnchorPosition = 'top';
  let minDistance = Infinity;
  let closestPoint: Point = anchors.top;

  for (const pos of positions) {
    const pt = anchors[pos];
    const dist = distance(targetPoint, pt);
    if (dist < minDistance) {
      minDistance = dist;
      closestAnchor = pos;
      closestPoint = pt;
    }
  }

  return {
    anchor: closestAnchor,
    point: closestPoint,
    distance: minDistance,
  };
}

export function lineSegmentIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;
  const [x4, y4] = p4;

  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (Math.abs(denom) < 1e-9) {
    return null;
  }

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return [
      x1 + ua * (x2 - x1),
      y1 + ua * (y2 - y1),
    ];
  }

  return null;
}

export function intersectSegmentWithBox(
  p1: Point,
  p2: Point,
  box: Pick<BoxElement, 'x' | 'y' | 'width' | 'height'>,
  margin = 0
): Point | null {
  const { minX, minY, maxX, maxY } = getBoxBounds(box);
  const left = minX - margin;
  const right = maxX + margin;
  const top = minY - margin;
  const bottom = maxY + margin;

  const topLeft: Point = [left, top];
  const topRight: Point = [right, top];
  const bottomRight: Point = [right, bottom];
  const bottomLeft: Point = [left, bottom];

  const edges: [Point, Point][] = [
    [topLeft, topRight],
    [topRight, bottomRight],
    [bottomRight, bottomLeft],
    [bottomLeft, topLeft],
  ];

  let bestPoint: Point | null = null;
  let minDistance = Infinity;

  for (const [e1, e2] of edges) {
    const hit = lineSegmentIntersection(p1, p2, e1, e2);
    if (hit) {
      const d = distance(p1, hit);
      if (d < minDistance) {
        minDistance = d;
        bestPoint = hit;
      }
    }
  }

  return bestPoint;
}

export function intersectRayWithBox(
  origin: Point,
  direction: Point,
  box: Pick<BoxElement, 'x' | 'y' | 'width' | 'height'>,
  margin = 0
): Point | null {
  const { minX, minY, maxX, maxY } = getBoxBounds(box);
  const left = minX - margin;
  const right = maxX + margin;
  const top = minY - margin;
  const bottom = maxY + margin;

  const [ox, oy] = origin;
  const [dx, dy] = direction;

  let tMin = -Infinity;
  let tMax = Infinity;

  if (Math.abs(dx) > 1e-9) {
    const t1 = (left - ox) / dx;
    const t2 = (right - ox) / dx;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  } else if (ox < left || ox > right) {
    return null;
  }

  if (Math.abs(dy) > 1e-9) {
    const t3 = (top - oy) / dy;
    const t4 = (bottom - oy) / dy;
    tMin = Math.max(tMin, Math.min(t3, t4));
    tMax = Math.min(tMax, Math.max(t3, t4));
  } else if (oy < top || oy > bottom) {
    return null;
  }

  if (tMax < tMin) {
    return null;
  }

  const tHit = tMin >= 0 ? tMin : tMax >= 0 ? tMax : null;
  if (tHit === null) {
    return null;
  }

  return [ox + tHit * dx, oy + tHit * dy];
}

export function getBoundArrowEndpoints(
  arrow: ArrowElement,
  elementsMap: Map<string, ExcalidrawElement> | Record<string, ExcalidrawElement>,
  defaultGap = 4
): { start: Point; end: Point } {
  const getElement = (id: string): ExcalidrawElement | undefined => {
    return elementsMap instanceof Map ? elementsMap.get(id) : elementsMap[id];
  };

  const startEl = arrow.startBinding ? getElement(arrow.startBinding.elementId) : undefined;
  const endEl = arrow.endBinding ? getElement(arrow.endBinding.elementId) : undefined;

  const startBox = (startEl && startEl.type === 'box') ? startEl : null;
  const endBox = (endEl && endEl.type === 'box') ? endEl : null;

  let rawStart: Point = [arrow.startX, arrow.startY];
  let rawEnd: Point = [arrow.endX, arrow.endY];

  const startGap = arrow.startBinding?.gap ?? defaultGap;
  const endGap = arrow.endBinding?.gap ?? defaultGap;

  const startCenter: Point = startBox
    ? getBoxAnchorPoints(startBox).center
    : rawStart;
  const endCenter: Point = endBox
    ? getBoxAnchorPoints(endBox).center
    : rawEnd;

  if (startBox) {
    if (arrow.startBinding?.point) {
      rawStart = arrow.startBinding.point;
    } else {
      const hit = intersectSegmentWithBox(startCenter, endCenter, startBox, startGap);
      if (hit) {
        rawStart = hit;
      } else {
        const dir = normalizeVector([endCenter[0] - startCenter[0], endCenter[1] - startCenter[1]]);
        const rayHit = intersectRayWithBox(startCenter, dir, startBox, startGap);
        if (rayHit) rawStart = rayHit;
      }
    }
  }

  if (endBox) {
    if (arrow.endBinding?.point) {
      rawEnd = arrow.endBinding.point;
    } else {
      const hit = intersectSegmentWithBox(endCenter, startCenter, endBox, endGap);
      if (hit) {
        rawEnd = hit;
      } else {
        const dir = normalizeVector([startCenter[0] - endCenter[0], startCenter[1] - endCenter[1]]);
        const rayHit = intersectRayWithBox(endCenter, dir, endBox, endGap);
        if (rayHit) rawEnd = rayHit;
      }
    }
  }

  return { start: rawStart, end: rawEnd };
}

export interface ArrowheadResult {
  tip: Point;
  left: Point;
  right: Point;
  points: [Point, Point, Point];
  angle: number;
}

export function getArrowheadPoints(
  start: Point,
  end: Point,
  headLength = 16,
  apertureAngle = Math.PI / 6
): ArrowheadResult {
  const [x1, y1] = start;
  const [x2, y2] = end;

  const angle = Math.atan2(y2 - y1, x2 - x1);

  const leftX = x2 - headLength * Math.cos(angle - apertureAngle);
  const leftY = y2 - headLength * Math.sin(angle - apertureAngle);

  const rightX = x2 - headLength * Math.cos(angle + apertureAngle);
  const rightY = y2 - headLength * Math.sin(angle + apertureAngle);

  const tip: Point = [x2, y2];
  const left: Point = [leftX, leftY];
  const right: Point = [rightX, rightY];

  return {
    tip,
    left,
    right,
    points: [left, tip, right],
    angle,
  };
}

export function distance(p1: Point, p2: Point): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return Math.hypot(dx, dy);
}

export function normalizeVector(vec: Point): Point {
  const len = Math.hypot(vec[0], vec[1]);
  if (len < 1e-9) return [1, 0];
  return [vec[0] / len, vec[1] / len];
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const [px, py] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 1e-9) {
    return Math.hypot(px - x1, py - y1);
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.hypot(px - projX, py - projY);
}

export function isPointInBox(
  point: Point,
  box: Pick<BoxElement, 'x' | 'y' | 'width' | 'height'>,
  margin = 0
): boolean {
  const { minX, minY, maxX, maxY } = getBoxBounds(box);
  const [px, py] = point;
  return (
    px >= minX - margin &&
    px <= maxX + margin &&
    py >= minY - margin &&
    py <= maxY + margin
  );
}

export function isPointOnBoxBorder(
  point: Point,
  box: Pick<BoxElement, 'x' | 'y' | 'width' | 'height'>,
  threshold = 6
): boolean {
  const { minX, minY, maxX, maxY } = getBoxBounds(box);
  const p = point;

  const edges: [Point, Point][] = [
    [[minX, minY], [maxX, minY]],
    [[maxX, minY], [maxX, maxY]],
    [[maxX, maxY], [minX, maxY]],
    [[minX, maxY], [minX, minY]],
  ];

  return edges.some(([a, b]) => distanceToSegment(p, a, b) <= threshold);
}

export function isPointOnSegment(
  point: Point,
  start: Point,
  end: Point,
  threshold = 6
): boolean {
  return distanceToSegment(point, start, end) <= threshold;
}

export function isPointOnArrow(
  point: Point,
  arrow: ArrowElement,
  elementsMap: Map<string, ExcalidrawElement> | Record<string, ExcalidrawElement>,
  threshold = 6
): boolean {
  const { start, end } = getBoundArrowEndpoints(arrow, elementsMap);

  if (isPointOnSegment(point, start, end, threshold)) {
    return true;
  }

  const head = getArrowheadPoints(start, end);
  if (isPointOnSegment(point, head.tip, head.left, threshold)) {
    return true;
  }
  if (isPointOnSegment(point, head.tip, head.right, threshold)) {
    return true;
  }

  return false;
}

export function hitTestElement(
  point: Point,
  element: ExcalidrawElement,
  elementsMap: Map<string, ExcalidrawElement> | Record<string, ExcalidrawElement>,
  threshold = 6
): boolean {
  if (element.type === 'box') {
    if (element.fillStyle !== 'none') {
      return isPointInBox(point, element, threshold);
    }
    return isPointOnBoxBorder(point, element, threshold);
  }

  if (element.type === 'arrow') {
    return isPointOnArrow(point, element, elementsMap, threshold);
  }

  return false;
}

export function getResizeHandles(
  box: Pick<BoxElement, 'x' | 'y' | 'width' | 'height'>,
  handleSize = 8
): ResizeHandleInfo[] {
  const { minX, minY, maxX, maxY, width, height } = getBoxBounds(box);
  const midX = minX + width / 2;
  const midY = minY + height / 2;
  const half = handleSize / 2;

  const handleDefs: { handle: ResizeHandle; cx: number; cy: number }[] = [
    { handle: 'nw', cx: minX, cy: minY },
    { handle: 'n',  cx: midX, cy: minY },
    { handle: 'ne', cx: maxX, cy: minY },
    { handle: 'e',  cx: maxX, cy: midY },
    { handle: 'se', cx: maxX, cy: maxY },
    { handle: 's',  cx: midX, cy: maxY },
    { handle: 'sw', cx: minX, cy: maxY },
    { handle: 'w',  cx: minX, cy: midY },
  ];

  return handleDefs.map(({ handle, cx, cy }) => ({
    handle,
    x: cx - half,
    y: cy - half,
    width: handleSize,
    height: handleSize,
  }));
}

export function hitTestResizeHandles(
  point: Point,
  box: Pick<BoxElement, 'x' | 'y' | 'width' | 'height'>,
  handleSize = 8
): ResizeHandle | null {
  const [px, py] = point;
  const handles = getResizeHandles(box, handleSize);

  for (const h of handles) {
    if (
      px >= h.x &&
      px <= h.x + h.width &&
      py >= h.y &&
      py <= h.y + h.height
    ) {
      return h.handle;
    }
  }

  return null;
}

export function hitTestArrowHandles(
  point: Point,
  arrow: ArrowElement,
  elementsMap: Map<string, ExcalidrawElement> | Record<string, ExcalidrawElement>,
  handleSize = 10
): ArrowHandle | null {
  const [px, py] = point;
  const half = handleSize / 2;
  const { start, end } = getBoundArrowEndpoints(arrow, elementsMap);

  if (
    px >= start[0] - half &&
    px <= start[0] + half &&
    py >= start[1] - half &&
    py <= start[1] + half
  ) {
    return 'start';
  }

  if (
    px >= end[0] - half &&
    px <= end[0] + half &&
    py >= end[1] - half &&
    py <= end[1] + half
  ) {
    return 'end';
  }

  return null;
}

export function calculateResizedBox(
  originalBox: Pick<BoxElement, 'x' | 'y' | 'width' | 'height'>,
  handle: ResizeHandle,
  currentPoint: Point,
  keepAspectRatio = false
): { x: number; y: number; width: number; height: number } {
  const bounds = getBoxBounds(originalBox);
  let { minX, minY, maxX, maxY } = bounds;
  const [cx, cy] = currentPoint;

  switch (handle) {
    case 'nw':
      minX = cx;
      minY = cy;
      break;
    case 'n':
      minY = cy;
      break;
    case 'ne':
      maxX = cx;
      minY = cy;
      break;
    case 'e':
      maxX = cx;
      break;
    case 'se':
      maxX = cx;
      maxY = cy;
      break;
    case 's':
      maxY = cy;
      break;
    case 'sw':
      minX = cx;
      maxY = cy;
      break;
    case 'w':
      minX = cx;
      break;
  }

  let width = maxX - minX;
  let height = maxY - minY;

  if (keepAspectRatio && bounds.width > 0 && bounds.height > 0) {
    const origRatio = bounds.width / bounds.height;
    if (Math.abs(width / height) > origRatio) {
      width = height * origRatio * Math.sign(width);
    } else {
      height = (width / origRatio) * Math.sign(height);
    }
  }

  return {
    x: width < 0 ? minX + width : minX,
    y: height < 0 ? minY + height : minY,
    width: Math.abs(width),
    height: Math.abs(height),
  };
}

export function viewportToCanvas(screenPoint: Point, pan: PointObject, zoom: number): Point {
  return [
    (screenPoint[0] - pan.x) / zoom,
    (screenPoint[1] - pan.y) / zoom,
  ];
}

export function canvasToViewport(canvasPoint: Point, pan: PointObject, zoom: number): Point {
  return [
    canvasPoint[0] * zoom + pan.x,
    canvasPoint[1] * zoom + pan.y,
  ];
}

export function getStrokeLineDash(style: StrokeStyle, strokeWidth: number): number[] {
  switch (style) {
    case 'dashed':
      return [strokeWidth * 4, strokeWidth * 4];
    case 'dotted':
      return [strokeWidth, strokeWidth * 3];
    case 'solid':
    default:
      return [];
  }
}

export function getRoughOptions(element: ExcalidrawElement): RoughOptions {
  const isBox = element.type === 'box';
  const options: RoughOptions = {
    stroke: element.strokeColor,
    strokeWidth: element.strokeWidth,
    roughness: element.roughness,
    seed: element.seed,
    strokeLineDash: getStrokeLineDash(element.strokeStyle, element.strokeWidth),
  };

  if (isBox) {
    if (element.fillStyle !== 'none') {
      options.fill = element.backgroundColor;
      options.fillStyle = element.fillStyle;
    }
  }

  return options;
}
