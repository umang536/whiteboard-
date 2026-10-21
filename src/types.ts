/**
 * Excalidraw Type Definitions
 * Reverse-engineered data structures for whiteboard canvas and Rough.js pipeline.
 */

export type Point = [number, number];

export interface PointObject {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export type FillStyle = 'hachure' | 'solid' | 'cross-hatch' | 'dots' | 'none';
export type StrokeWidth = 1 | 2 | 4;
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type Roughness = 0 | 1 | 2;
export type Arrowhead = 'arrow' | 'triangle' | 'none';

export type AnchorPosition = 'top' | 'right' | 'bottom' | 'left' | 'center';

export interface PointBinding {
  elementId: string;
  point?: Point;
  focus?: number;
  gap?: number;
}

export interface BaseElement {
  id: string;
  strokeColor: string;
  strokeWidth: StrokeWidth;
  strokeStyle: StrokeStyle;
  roughness: Roughness;
  seed: number;
  opacity?: number;
  isDeleted?: boolean;
}

export interface BoxElement extends BaseElement {
  type: 'box';
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor: string;
  fillStyle: FillStyle;
  text: string;
  fontSize: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
}

export interface ArrowElement extends BaseElement {
  type: 'arrow';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startBinding: PointBinding | null;
  endBinding: PointBinding | null;
  arrowhead?: Arrowhead;
}

export type ExcalidrawElement = BoxElement | ArrowElement;
export type ElementType = ExcalidrawElement['type'];

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type ArrowHandle = 'start' | 'end';

export interface ResizeHandleInfo {
  handle: ResizeHandle;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ToolType = 'select' | 'pan' | 'box' | 'arrow';

export type CanvasPointerMode =
  | 'idle'
  | 'drawing'
  | 'moving'
  | 'resizing'
  | 'panning'
  | 'binding'
  | 'editing_text';

export interface Pan {
  x: number;
  y: number;
}

export interface AppState {
  zoom: number;
  pan: Pan;
  selectedElementIds: string[];
  tool: ToolType;
  editingElementId: string | null;
  isDarkMode?: boolean;
  defaultStrokeColor: string;
  defaultBackgroundColor: string;
  defaultFillStyle: FillStyle;
  defaultStrokeWidth: StrokeWidth;
  defaultStrokeStyle: StrokeStyle;
  defaultRoughness: Roughness;
  defaultFontSize: number;
}

export interface RoughOptions {
  stroke: string;
  strokeWidth: number;
  roughness: number;
  seed: number;
  fill?: string;
  fillStyle?: FillStyle;
  strokeLineDash?: number[];
  hachureAngle?: number;
  hachureGap?: number;
  disableMultiStroke?: boolean;
}
