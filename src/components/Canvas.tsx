import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ExcalidrawElement,
  BoxElement,
  ArrowElement,
  AppState,
  Point,
  AnchorPosition,
  ResizeHandle,
  Bounds,
} from '../types';
import { renderCanvas } from '../renderer';
import {
  generateId,
  hitTestResizeHandle,
  getCursorForHandle,
  findNearbyAnchor,
  normalizeBox,
  isElementInBounds,
  viewportToCanvas,
  hitTestElements,
} from '../geometry';

interface CanvasProps {
  elements: ExcalidrawElement[];
  appState: AppState;
  onUpdateElements: (elements: ExcalidrawElement[]) => void;
  onUpdateAppState: (updates: Partial<AppState>) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  appState,
  onUpdateElements,
  onUpdateAppState,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active interaction states
  const [activeDrawingElement, setActiveDrawingElement] = useState<ExcalidrawElement | null>(null);
  const [marquee, setMarquee] = useState<Bounds | null>(null);
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);
  const [hoveredAnchor, setHoveredAnchor] = useState<{
    elementId: string;
    position: AnchorPosition;
  } | null>(null);

  // Space key tracking for panning
  const isSpacePressedRef = useRef(false);

  // Text editing overlay state
  const [editingBox, setEditingBox] = useState<{
    id: string;
    text: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ref to hold current elements to avoid stale closure during mousemove/up
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  // Interaction tracking refs
  const interactionRef = useRef<{
    isMouseDown: boolean;
    startScreenX: number;
    startScreenY: number;
    startCanvasX: number;
    startCanvasY: number;
    mode: 'idle' | 'drawing_box' | 'drawing_arrow' | 'moving' | 'resizing' | 'marquee' | 'panning';
    activeHandle: ResizeHandle | null;
    initialElements: ExcalidrawElement[];
    initialBoxBounds?: { x: number; y: number; width: number; height: number };
    arrowStartBindingId?: string | null;
  }>({
    isMouseDown: false,
    startScreenX: 0,
    startScreenY: 0,
    startCanvasX: 0,
    startCanvasY: 0,
    mode: 'idle',
    activeHandle: null,
    initialElements: [],
  });

  // Track spacebar for pan mode & Enter for editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') {
        return;
      }

      if (e.code === 'Space') {
        isSpacePressedRef.current = true;
        if (containerRef.current) {
          containerRef.current.style.cursor = 'grab';
        }
      }

      // Enter key to edit selected box
      if (e.key === 'Enter' && appStateRef.current.selectedElementIds.length === 1) {
        const selectedId = appStateRef.current.selectedElementIds[0];
        const selectedEl = elementsRef.current.find((el) => el.id === selectedId);
        if (selectedEl && selectedEl.type === 'box') {
          e.preventDefault();
          setEditingBox({
            id: selectedEl.id,
            text: (selectedEl as BoxElement).text,
          });
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        if (containerRef.current) {
          containerRef.current.style.cursor =
            appStateRef.current.tool === 'pan' ? 'grab' : 'default';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Keep canvas size synced with window
  const updateCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    renderCanvas(
      canvas,
      elementsRef.current,
      appStateRef.current,
      activeDrawingElement,
      {
        marquee,
        hoveredBoxId,
        hoveredAnchor,
      }
    );
  }, [activeDrawingElement, marquee, hoveredBoxId, hoveredAnchor]);

  useEffect(() => {
    updateCanvasDimensions();
    window.addEventListener('resize', updateCanvasDimensions);
    return () => window.removeEventListener('resize', updateCanvasDimensions);
  }, [updateCanvasDimensions]);

  // Re-render when elements or state change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderCanvas(
      canvas,
      elements,
      appState,
      activeDrawingElement,
      {
        marquee,
        hoveredBoxId,
        hoveredAnchor,
      }
    );
  }, [elements, appState, activeDrawingElement, marquee, hoveredBoxId, hoveredAnchor]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (editingBox && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingBox]);

  // Screen to Canvas coordinate helper
  const getCanvasCoords = (e: React.MouseEvent | MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return viewportToCanvas([screenX, screenY], appStateRef.current.pan, appStateRef.current.zoom);
  };

  // Double click handler: inline text editing
  const handleDoubleClick = (e: React.MouseEvent) => {
    const [cx, cy] = getCanvasCoords(e);
    const elementsMap = new Map(elementsRef.current.map((el) => [el.id, el]));
    const hit = hitTestElements(elementsRef.current, cx, cy, appStateRef.current.zoom, elementsMap);

    if (hit && hit.type === 'box') {
      const box = hit as BoxElement;
      setEditingBox({
        id: box.id,
        text: box.text,
      });
      onUpdateAppState({ selectedElementIds: [box.id] });
    }
  };

  // Commit text change
  const handleTextCommit = () => {
    if (!editingBox) return;

    const nextElements = elementsRef.current.map((el) => {
      if (el.id === editingBox.id && el.type === 'box') {
        return {
          ...el,
          text: editingBox.text,
        };
      }
      return el;
    });

    onUpdateElements(nextElements);
    setEditingBox(null);
  };

  // Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
    if (editingBox) {
      handleTextCommit();
    }

    // Middle click, spacebar, or pan tool for panning
    if (e.button === 1 || isSpacePressedRef.current || appStateRef.current.tool === 'pan') {
      interactionRef.current = {
        isMouseDown: true,
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        startCanvasX: 0,
        startCanvasY: 0,
        mode: 'panning',
        activeHandle: null,
        initialElements: [],
      };
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grabbing';
      }
      return;
    }

    if (e.button !== 0) return; // Only primary button

    const [cx, cy] = getCanvasCoords(e);
    const currentTool = appStateRef.current.tool;
    const currentElements = elementsRef.current;
    const elementsMap = new Map(currentElements.map((el) => [el.id, el]));

    // 1. Tool: 'box' -> start drawing box
    if (currentTool === 'box') {
      const newBox: BoxElement = {
        id: generateId(),
        type: 'box',
        x: cx,
        y: cy,
        width: 0,
        height: 0,
        strokeColor: appStateRef.current.defaultStrokeColor,
        backgroundColor: appStateRef.current.defaultBackgroundColor,
        fillStyle: appStateRef.current.defaultFillStyle,
        strokeWidth: appStateRef.current.defaultStrokeWidth,
        strokeStyle: appStateRef.current.defaultStrokeStyle,
        roughness: appStateRef.current.defaultRoughness,
        seed: Math.floor(Math.random() * 100000),
        text: '',
        fontSize: appStateRef.current.defaultFontSize,
        textAlign: 'center',
        verticalAlign: 'middle',
      };

      interactionRef.current = {
        isMouseDown: true,
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        startCanvasX: cx,
        startCanvasY: cy,
        mode: 'drawing_box',
        activeHandle: null,
        initialElements: currentElements,
      };

      setActiveDrawingElement(newBox);
      return;
    }

    // 2. Tool: 'arrow' -> start drawing arrow
    if (currentTool === 'arrow') {
      const boxes = currentElements.filter((el): el is BoxElement => el.type === 'box');
      const nearbyAnchor = findNearbyAnchor(cx, cy, boxes, 24 / appStateRef.current.zoom);
      let startX = cx;
      let startY = cy;
      let startBindingId: string | null = null;

      if (nearbyAnchor) {
        startX = nearbyAnchor.anchor.x;
        startY = nearbyAnchor.anchor.y;
        startBindingId = nearbyAnchor.box.id;
      } else {
        const hitBox = hitTestElements(currentElements, cx, cy, appStateRef.current.zoom, elementsMap);
        if (hitBox && hitBox.type === 'box') {
          startBindingId = hitBox.id;
        }
      }

      const newArrow: ArrowElement = {
        id: generateId(),
        type: 'arrow',
        startX,
        startY,
        endX: cx,
        endY: cy,
        startBinding: startBindingId ? { elementId: startBindingId } : null,
        endBinding: null,
        strokeColor: appStateRef.current.defaultStrokeColor,
        strokeWidth: appStateRef.current.defaultStrokeWidth,
        strokeStyle: appStateRef.current.defaultStrokeStyle,
        roughness: appStateRef.current.defaultRoughness,
        seed: Math.floor(Math.random() * 100000),
        arrowhead: 'arrow',
      };

      interactionRef.current = {
        isMouseDown: true,
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        startCanvasX: startX,
        startCanvasY: startY,
        mode: 'drawing_arrow',
        activeHandle: null,
        initialElements: currentElements,
        arrowStartBindingId: startBindingId,
      };

      setActiveDrawingElement(newArrow);
      return;
    }

    // 3. Tool: 'select'
    // Check resize handles first if a single box is selected
    if (appStateRef.current.selectedElementIds.length === 1) {
      const selectedId = appStateRef.current.selectedElementIds[0];
      const selectedEl = currentElements.find((el) => el.id === selectedId);

      if (selectedEl && selectedEl.type === 'box') {
        const handle = hitTestResizeHandle(selectedEl as BoxElement, cx, cy, appStateRef.current.zoom);
        if (handle) {
          interactionRef.current = {
            isMouseDown: true,
            startScreenX: e.clientX,
            startScreenY: e.clientY,
            startCanvasX: cx,
            startCanvasY: cy,
            mode: 'resizing',
            activeHandle: handle,
            initialElements: currentElements,
            initialBoxBounds: {
              x: selectedEl.x,
              y: selectedEl.y,
              width: selectedEl.width,
              height: selectedEl.height,
            },
          };
          return;
        }
      }
    }

    // Hit test elements
    const hit = hitTestElements(currentElements, cx, cy, appStateRef.current.zoom, elementsMap);

    if (hit) {
      const isAlreadySelected = appStateRef.current.selectedElementIds.includes(hit.id);
      let nextSelectedIds: string[];

      if (e.shiftKey) {
        nextSelectedIds = isAlreadySelected
          ? appStateRef.current.selectedElementIds.filter((id) => id !== hit.id)
          : [...appStateRef.current.selectedElementIds, hit.id];
      } else {
        nextSelectedIds = isAlreadySelected ? appStateRef.current.selectedElementIds : [hit.id];
      }

      onUpdateAppState({ selectedElementIds: nextSelectedIds });

      interactionRef.current = {
        isMouseDown: true,
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        startCanvasX: cx,
        startCanvasY: cy,
        mode: 'moving',
        activeHandle: null,
        initialElements: currentElements,
      };
    } else {
      // Empty space click -> clear selection or start marquee
      if (!e.shiftKey) {
        onUpdateAppState({ selectedElementIds: [] });
      }

      interactionRef.current = {
        isMouseDown: true,
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        startCanvasX: cx,
        startCanvasY: cy,
        mode: 'marquee',
        activeHandle: null,
        initialElements: currentElements,
      };

      setMarquee({
        minX: cx,
        minY: cy,
        maxX: cx,
        maxY: cy,
        width: 0,
        height: 0,
      });
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    const [cx, cy] = getCanvasCoords(e);
    const { isMouseDown, mode, startCanvasX, startCanvasY } = interactionRef.current;
    const elementsMap = new Map(elementsRef.current.map((el) => [el.id, el]));

    // 1. Hover updates when mouse is UP
    if (!isMouseDown) {
      if (isSpacePressedRef.current || appStateRef.current.tool === 'pan') {
        if (containerRef.current) {
          containerRef.current.style.cursor = 'grab';
        }
        return;
      }

      if (appStateRef.current.tool === 'select') {
        // Update cursor for resize handles if 1 box selected
        if (appStateRef.current.selectedElementIds.length === 1) {
          const selectedId = appStateRef.current.selectedElementIds[0];
          const selectedEl = elementsRef.current.find((el) => el.id === selectedId);
          if (selectedEl && selectedEl.type === 'box') {
            const handle = hitTestResizeHandle(
              selectedEl as BoxElement,
              cx,
              cy,
              appStateRef.current.zoom
            );
            if (handle) {
              if (containerRef.current) {
                containerRef.current.style.cursor = getCursorForHandle(handle);
              }
              return;
            }
          }
        }

        const hit = hitTestElements(elementsRef.current, cx, cy, appStateRef.current.zoom, elementsMap);
        if (containerRef.current) {
          containerRef.current.style.cursor = hit ? 'move' : 'default';
        }
        setHoveredBoxId(hit && hit.type === 'box' ? hit.id : null);
        setHoveredAnchor(null);
      } else if (appStateRef.current.tool === 'arrow') {
        const boxes = elementsRef.current.filter((el): el is BoxElement => el.type === 'box');
        const nearbyAnchor = findNearbyAnchor(cx, cy, boxes, 24 / appStateRef.current.zoom);
        if (nearbyAnchor) {
          setHoveredAnchor({
            elementId: nearbyAnchor.box.id,
            position: nearbyAnchor.anchor.position,
          });
          setHoveredBoxId(nearbyAnchor.box.id);
        } else {
          setHoveredAnchor(null);
          const hit = hitTestElements(elementsRef.current, cx, cy, appStateRef.current.zoom, elementsMap);
          setHoveredBoxId(hit && hit.type === 'box' ? hit.id : null);
        }
        if (containerRef.current) {
          containerRef.current.style.cursor = 'crosshair';
        }
      } else if (appStateRef.current.tool === 'box') {
        if (containerRef.current) {
          containerRef.current.style.cursor = 'crosshair';
        }
        setHoveredBoxId(null);
        setHoveredAnchor(null);
      }
      return;
    }

    // 2. Active dragging behaviors
    // A. Panning
    if (mode === 'panning') {
      const dx = e.clientX - interactionRef.current.startScreenX;
      const dy = e.clientY - interactionRef.current.startScreenY;
      interactionRef.current.startScreenX = e.clientX;
      interactionRef.current.startScreenY = e.clientY;

      onUpdateAppState({
        pan: {
          x: appStateRef.current.pan.x + dx,
          y: appStateRef.current.pan.y + dy,
        },
      });
      return;
    }

    // B. Drawing Box
    if (mode === 'drawing_box' && activeDrawingElement && activeDrawingElement.type === 'box') {
      const width = cx - startCanvasX;
      const height = cy - startCanvasY;

      setActiveDrawingElement({
        ...activeDrawingElement,
        x: width < 0 ? cx : startCanvasX,
        y: height < 0 ? cy : startCanvasY,
        width: Math.abs(width),
        height: Math.abs(height),
      });
      return;
    }

    // C. Drawing Arrow
    if (mode === 'drawing_arrow' && activeDrawingElement && activeDrawingElement.type === 'arrow') {
      const boxes = elementsRef.current.filter((el): el is BoxElement => el.type === 'box');
      const nearbyAnchor = findNearbyAnchor(cx, cy, boxes, 24 / appStateRef.current.zoom);
      let endX = cx;
      let endY = cy;
      let endBindingId: string | null = null;

      if (nearbyAnchor) {
        endX = nearbyAnchor.anchor.x;
        endY = nearbyAnchor.anchor.y;
        endBindingId = nearbyAnchor.box.id;
        setHoveredAnchor({
          elementId: nearbyAnchor.box.id,
          position: nearbyAnchor.anchor.position,
        });
      } else {
        const hit = hitTestElements(elementsRef.current, cx, cy, appStateRef.current.zoom, elementsMap);
        if (hit && hit.type === 'box') {
          endBindingId = hit.id;
        }
        setHoveredAnchor(null);
      }

      setActiveDrawingElement({
        ...activeDrawingElement,
        endX,
        endY,
        endBinding: endBindingId ? { elementId: endBindingId } : null,
      });
      return;
    }

    // D. Moving Elements
    if (mode === 'moving') {
      const dx = cx - startCanvasX;
      const dy = cy - startCanvasY;
      const selectedIds = appStateRef.current.selectedElementIds;
      const initialElements = interactionRef.current.initialElements;

      // Update positions of selected elements
      const nextElements = initialElements.map((el) => {
        if (!selectedIds.includes(el.id)) return el;

        if (el.type === 'box') {
          return {
            ...el,
            x: el.x + dx,
            y: el.y + dy,
          };
        }

        if (el.type === 'arrow') {
          return {
            ...el,
            startX: el.startX + dx,
            startY: el.startY + dy,
            endX: el.endX + dx,
            endY: el.endY + dy,
          };
        }

        return el;
      });

      onUpdateElements(nextElements);
      return;
    }

    // E. Resizing Box
    if (mode === 'resizing') {
      const handle = interactionRef.current.activeHandle;
      const initialBounds = interactionRef.current.initialBoxBounds;
      const selectedId = appStateRef.current.selectedElementIds[0];

      if (!handle || !initialBounds || !selectedId) return;

      let { x, y, width, height } = initialBounds;
      const dx = cx - startCanvasX;
      const dy = cy - startCanvasY;

      switch (handle) {
        case 'se':
          width += dx;
          height += dy;
          break;
        case 's':
          height += dy;
          break;
        case 'sw':
          x += dx;
          width -= dx;
          height += dy;
          break;
        case 'w':
          x += dx;
          width -= dx;
          break;
        case 'nw':
          x += dx;
          y += dy;
          width -= dx;
          height -= dy;
          break;
        case 'n':
          y += dy;
          height -= dy;
          break;
        case 'ne':
          y += dy;
          width += dx;
          height -= dy;
          break;
        case 'e':
          width += dx;
          break;
      }

      const nextElements: ExcalidrawElement[] = elementsRef.current.map((el) => {
        if (el.id === selectedId && el.type === 'box') {
          const box = el as BoxElement;
          return {
            ...box,
            x: width < 0 ? x + width : x,
            y: height < 0 ? y + height : y,
            width: Math.abs(width),
            height: Math.abs(height),
          };
        }
        return el;
      });

      onUpdateElements(nextElements);
      return;
    }

    // F. Marquee Multi-Select
    if (mode === 'marquee') {
      const minX = Math.min(startCanvasX, cx);
      const maxX = Math.max(startCanvasX, cx);
      const minY = Math.min(startCanvasY, cy);
      const maxY = Math.max(startCanvasY, cy);

      const bounds: Bounds = {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
      };

      setMarquee(bounds);

      // Select elements inside bounds
      const matchingIds = elementsRef.current
        .filter((el) => isElementInBounds(el, bounds, elementsMap))
        .map((el) => el.id);

      onUpdateAppState({ selectedElementIds: matchingIds });
    }
  };

  // Mouse Up
  const handleMouseUp = () => {
    const { mode } = interactionRef.current;

    // Finish Drawing Box
    if (mode === 'drawing_box' && activeDrawingElement && activeDrawingElement.type === 'box') {
      const normalized = normalizeBox(activeDrawingElement);
      if (normalized.width > 5 && normalized.height > 5) {
        const fullBox: BoxElement = {
          ...activeDrawingElement,
          x: normalized.x,
          y: normalized.y,
          width: normalized.width,
          height: normalized.height,
        };
        const nextElements = [...elementsRef.current, fullBox];
        onUpdateElements(nextElements);
        onUpdateAppState({
          selectedElementIds: [fullBox.id],
          tool: 'select',
        });
      }
      setActiveDrawingElement(null);
    }

    // Finish Drawing Arrow
    if (mode === 'drawing_arrow' && activeDrawingElement && activeDrawingElement.type === 'arrow') {
      const dx = activeDrawingElement.endX - activeDrawingElement.startX;
      const dy = activeDrawingElement.endY - activeDrawingElement.startY;
      const len = Math.hypot(dx, dy);

      if (len > 10) {
        const nextElements = [...elementsRef.current, activeDrawingElement];
        onUpdateElements(nextElements);
        onUpdateAppState({
          selectedElementIds: [activeDrawingElement.id],
          tool: 'select',
        });
      }
      setActiveDrawingElement(null);
      setHoveredAnchor(null);
    }

    // Reset interaction state
    interactionRef.current = {
      isMouseDown: false,
      startScreenX: 0,
      startScreenY: 0,
      startCanvasX: 0,
      startCanvasY: 0,
      mode: 'idle',
      activeHandle: null,
      initialElements: [],
    };

    setMarquee(null);
  };

  // Wheel Zoom & Pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(appStateRef.current.zoom * zoomFactor, 0.2), 3.0);

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPanX = mouseX - (mouseX - appStateRef.current.pan.x) * (newZoom / appStateRef.current.zoom);
      const newPanY = mouseY - (mouseY - appStateRef.current.pan.y) * (newZoom / appStateRef.current.zoom);

      onUpdateAppState({
        zoom: newZoom,
        pan: { x: newPanX, y: newPanY },
      });
    } else {
      // Pan
      onUpdateAppState({
        pan: {
          x: appStateRef.current.pan.x - e.deltaX,
          y: appStateRef.current.pan.y - e.deltaY,
        },
      });
    }
  };

  // Inline textarea positioning for text editing
  const editingElement = editingBox
    ? (elements.find((el) => el.id === editingBox.id) as BoxElement | undefined)
    : undefined;

  let textareaStyle: React.CSSProperties = { display: 'none' };
  if (editingElement) {
    const screenLeft = editingElement.x * appState.zoom + appState.pan.x;
    const screenTop = editingElement.y * appState.zoom + appState.pan.y;
    const screenWidth = editingElement.width * appState.zoom;
    const screenHeight = editingElement.height * appState.zoom;

    textareaStyle = {
      position: 'absolute',
      left: `${screenLeft}px`,
      top: `${screenTop}px`,
      width: `${screenWidth}px`,
      height: `${screenHeight}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: `${12 * appState.zoom}px`,
      fontFamily: "'Patrick Hand', 'Caveat', cursive, sans-serif",
      fontSize: `${(editingElement.fontSize || 20) * appState.zoom}px`,
      color: editingElement.strokeColor || '#1e1e1e',
      backgroundColor: 'transparent',
      border: '2px dashed #3b82f6',
      borderRadius: '4px',
      outline: 'none',
      resize: 'none',
      textAlign: 'center',
      lineHeight: 1.25,
      zIndex: 100,
    };
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />

      {/* Inline Textarea overlay for editing text inside box */}
      {editingBox && editingElement && (
        <textarea
          ref={textareaRef}
          style={textareaStyle}
          value={editingBox.text}
          onChange={(e) => setEditingBox({ ...editingBox, text: e.target.value })}
          onBlur={handleTextCommit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              handleTextCommit();
            }
          }}
          placeholder="Type something..."
        />
      )}
    </div>
  );
};
