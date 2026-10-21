import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ExcalidrawElement,
  AppState,
  ToolType,
  StrokeWidth,
  StrokeStyle,
  FillStyle,
  Roughness,
} from './types';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Canvas } from './components/Canvas';
import { exportToPNG } from './renderer';
import { generateId } from './geometry';
import { Check } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'excalidraw_clone_elements_v1';
const MAX_HISTORY = 50;

const INITIAL_ELEMENTS: ExcalidrawElement[] = [
  {
    id: 'box-1',
    type: 'box',
    x: 200,
    y: 220,
    width: 220,
    height: 120,
    strokeColor: '#1971c2',
    backgroundColor: '#a5d8ff',
    fillStyle: 'hachure',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    seed: 101,
    text: 'Idea / Component A\n(Double-click me!)',
    fontSize: 20,
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  {
    id: 'box-2',
    type: 'box',
    x: 600,
    y: 220,
    width: 220,
    height: 120,
    strokeColor: '#2f9e44',
    backgroundColor: '#b2f2bb',
    fillStyle: 'cross-hatch',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    seed: 202,
    text: 'Idea / Component B\n(Connected!)',
    fontSize: 20,
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  {
    id: 'arrow-1',
    type: 'arrow',
    startX: 420,
    startY: 280,
    endX: 600,
    endY: 280,
    startBinding: { elementId: 'box-1' },
    endBinding: { elementId: 'box-2' },
    strokeColor: '#1e1e1e',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    seed: 303,
    arrowhead: 'arrow',
  },
];

export const App: React.FC = () => {
  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('excalidraw_theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleToggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('excalidraw_theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  // Load elements from LocalStorage or use initial
  const [elements, setElements] = useState<ExcalidrawElement[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
    return INITIAL_ELEMENTS;
  });

  // History stack for Undo/Redo
  const [history, setHistory] = useState<ExcalidrawElement[][]>([elements]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Auto-saved toast status
  const [savedStatus, setSavedStatus] = useState<string>('Saved');
  const saveTimeoutRef = useRef<number | null>(null);

  // AppState
  const [appState, setAppState] = useState<AppState>({
    zoom: 1.0,
    pan: { x: 0, y: 0 },
    selectedElementIds: [],
    tool: 'select',
    editingElementId: null,
    isDarkMode: isDarkMode,
    defaultStrokeColor: '#1e1e1e',
    defaultBackgroundColor: '#a5d8ff',
    defaultFillStyle: 'hachure',
    defaultStrokeWidth: 2,
    defaultStrokeStyle: 'solid',
    defaultRoughness: 1,
    defaultFontSize: 20,
  });

  // Sync isDarkMode with AppState
  useEffect(() => {
    setAppState((prev) => ({ ...prev, isDarkMode }));
  }, [isDarkMode]);

  // Save to localStorage whenever elements change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(elements));
      setSavedStatus('Saving...');
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        setSavedStatus('Saved');
      }, 600);
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [elements]);

  // Push new state to history
  const updateElementsWithHistory = useCallback(
    (newElements: ExcalidrawElement[]) => {
      setElements(newElements);

      setHistory((prev) => {
        const truncated = prev.slice(0, historyIndex + 1);
        const nextHistory = [...truncated, newElements];
        if (nextHistory.length > MAX_HISTORY) {
          return nextHistory.slice(nextHistory.length - MAX_HISTORY);
        }
        return nextHistory;
      });

      setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
    },
    [historyIndex]
  );

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      setElements(history[nextIndex]);
    }
  }, [historyIndex, history]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setElements(history[nextIndex]);
    }
  }, [historyIndex, history]);

  // Duplicate selected elements (Ctrl+D)
  const handleDuplicateSelected = useCallback(() => {
    if (appState.selectedElementIds.length === 0) return;

    const idMap = new Map<string, string>();
    const newElements: ExcalidrawElement[] = [];

    // First pass: generate new IDs
    for (const id of appState.selectedElementIds) {
      idMap.set(id, generateId());
    }

    for (const el of elements) {
      if (appState.selectedElementIds.includes(el.id)) {
        const newId = idMap.get(el.id)!;
        if (el.type === 'box') {
          newElements.push({
            ...el,
            id: newId,
            x: el.x + 24,
            y: el.y + 24,
            seed: Math.floor(Math.random() * 100000),
          });
        } else if (el.type === 'arrow') {
          newElements.push({
            ...el,
            id: newId,
            startX: el.startX + 24,
            startY: el.startY + 24,
            endX: el.endX + 24,
            endY: el.endY + 24,
            startBinding:
              el.startBinding && idMap.has(el.startBinding.elementId)
                ? { elementId: idMap.get(el.startBinding.elementId)! }
                : el.startBinding,
            endBinding:
              el.endBinding && idMap.has(el.endBinding.elementId)
                ? { elementId: idMap.get(el.endBinding.elementId)! }
                : el.endBinding,
            seed: Math.floor(Math.random() * 100000),
          });
        }
      }
    }

    if (newElements.length > 0) {
      const nextElements = [...elements, ...newElements];
      updateElementsWithHistory(nextElements);
      setAppState((prev) => ({
        ...prev,
        selectedElementIds: newElements.map((el) => el.id),
      }));
    }
  }, [appState.selectedElementIds, elements, updateElementsWithHistory]);

  // Delete selected elements
  const handleDeleteSelected = useCallback(() => {
    if (appState.selectedElementIds.length === 0) return;

    const toDelete = new Set(appState.selectedElementIds);
    const nextElements = elements
      .filter((el) => !toDelete.has(el.id))
      .map((el) => {
        if (el.type === 'arrow') {
          return {
            ...el,
            startBinding:
              el.startBinding && toDelete.has(el.startBinding.elementId)
                ? null
                : el.startBinding,
            endBinding:
              el.endBinding && toDelete.has(el.endBinding.elementId)
                ? null
                : el.endBinding,
          };
        }
        return el;
      });

    updateElementsWithHistory(nextElements);
    setAppState((prev) => ({ ...prev, selectedElementIds: [] }));
  }, [appState.selectedElementIds, elements, updateElementsWithHistory]);

  // Clear canvas
  const handleClearCanvas = useCallback(() => {
    if (window.confirm('Clear all drawings on the canvas?')) {
      updateElementsWithHistory([]);
      setAppState((prev) => ({ ...prev, selectedElementIds: [] }));
    }
  }, [updateElementsWithHistory]);

  // Update properties on selected elements
  const handleUpdateElement = useCallback(
    (updates: Partial<ExcalidrawElement>) => {
      if (appState.selectedElementIds.length === 0) return;

      const nextElements = elements.map((el) => {
        if (appState.selectedElementIds.includes(el.id)) {
          return {
            ...el,
            ...updates,
          } as ExcalidrawElement;
        }
        return el;
      });

      updateElementsWithHistory(nextElements);
    },
    [appState.selectedElementIds, elements, updateElementsWithHistory]
  );

  // Update default properties
  const handleUpdateDefaults = useCallback(
    (updates: {
      strokeColor?: string;
      backgroundColor?: string;
      fillStyle?: FillStyle;
      strokeWidth?: StrokeWidth;
      strokeStyle?: StrokeStyle;
      roughness?: Roughness;
    }) => {
      setAppState((prev) => ({
        ...prev,
        defaultStrokeColor: updates.strokeColor ?? prev.defaultStrokeColor,
        defaultBackgroundColor: updates.backgroundColor ?? prev.defaultBackgroundColor,
        defaultFillStyle: updates.fillStyle ?? prev.defaultFillStyle,
        defaultStrokeWidth: updates.strokeWidth ?? prev.defaultStrokeWidth,
        defaultStrokeStyle: updates.strokeStyle ?? prev.defaultStrokeStyle,
        defaultRoughness: updates.roughness ?? prev.defaultRoughness,
      }));
    },
    []
  );

  // Save to JSON file
  const handleSaveJson = useCallback(() => {
    const data = {
      type: 'excalidraw_recreated',
      version: 2,
      source: 'https://excalidraw.com clone',
      elements: elements,
      appState: {
        zoom: appState.zoom,
        pan: appState.pan,
      },
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.excalidraw.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [elements, appState.zoom, appState.pan]);

  // Load from JSON file
  const handleLoadJson = useCallback(
    (loadedElements: ExcalidrawElement[]) => {
      if (Array.isArray(loadedElements) && loadedElements.length > 0) {
        updateElementsWithHistory(loadedElements);
        setAppState((prev) => ({ ...prev, selectedElementIds: [] }));
      }
    },
    [updateElementsWithHistory]
  );

  // Export to PNG Image
  const handleExportPng = useCallback(() => {
    const dataUrl = exportToPNG(elements);
    if (!dataUrl) {
      alert('Canvas is empty. Draw some boxes first!');
      return;
    }

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [elements]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Duplicate: Ctrl+D / Cmd+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      // Delete: Backspace or Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

      // Escape: Deselect
      if (e.key === 'Escape') {
        setAppState((prev) => ({ ...prev, selectedElementIds: [] }));
        return;
      }

      // Tool shortcuts
      if (e.key === '1' || e.key.toLowerCase() === 'v') {
        setAppState((prev) => ({ ...prev, tool: 'select' }));
      } else if (e.key.toLowerCase() === 'h') {
        setAppState((prev) => ({ ...prev, tool: 'pan' }));
      } else if (e.key === '2' || e.key.toLowerCase() === 'r') {
        setAppState((prev) => ({ ...prev, tool: 'box' }));
      } else if (e.key === '3' || e.key.toLowerCase() === 'a') {
        setAppState((prev) => ({ ...prev, tool: 'arrow' }));
      }

      // Select All: Ctrl+A / Cmd+A
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAppState((prev) => ({
          ...prev,
          selectedElementIds: elements.map((el) => el.id),
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleDuplicateSelected, handleDeleteSelected, elements]);

  // Selected elements array
  const selectedElements = elements.filter((el) =>
    appState.selectedElementIds.includes(el.id)
  );

  return (
    <div className={`app-layout ${isDarkMode ? 'dark-mode' : ''}`}>
      {/* Top Floating Island Toolbar */}
      <Toolbar
        tool={appState.tool}
        onSelectTool={(tool: ToolType) => setAppState((prev) => ({ ...prev, tool }))}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={appState.zoom}
        onZoomIn={() =>
          setAppState((prev) => ({
            ...prev,
            zoom: Math.min(prev.zoom * 1.15, 3.0),
          }))
        }
        onZoomOut={() =>
          setAppState((prev) => ({
            ...prev,
            zoom: Math.max(prev.zoom * 0.85, 0.2),
          }))
        }
        onResetZoom={() =>
          setAppState((prev) => ({
            ...prev,
            zoom: 1.0,
            pan: { x: 0, y: 0 },
          }))
        }
        onSaveJson={handleSaveJson}
        onLoadJson={handleLoadJson}
        onExportPng={handleExportPng}
        onClearCanvas={handleClearCanvas}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />

      {/* Left Properties Panel */}
      <PropertiesPanel
        selectedElements={selectedElements}
        onUpdateElement={handleUpdateElement}
        onDeleteElements={handleDeleteSelected}
        defaultStrokeColor={appState.defaultStrokeColor}
        defaultBackgroundColor={appState.defaultBackgroundColor}
        defaultFillStyle={appState.defaultFillStyle}
        defaultStrokeWidth={appState.defaultStrokeWidth}
        defaultStrokeStyle={appState.defaultStrokeStyle}
        defaultRoughness={appState.defaultRoughness}
        onUpdateDefaults={handleUpdateDefaults}
      />

      {/* Auto-save Status Indicator (Bottom-left) */}
      <div
        className="auto-save-badge"
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          backgroundColor: isDarkMode ? '#1e1e24' : '#ffffff',
          border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 500,
          color: isDarkMode ? '#94a3b8' : '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          zIndex: 800,
        }}
      >
        <Check size={14} color="#10b981" />
        <span>{savedStatus}</span>
      </div>

      {/* Interactive Canvas */}
      <Canvas
        elements={elements}
        appState={appState}
        onUpdateElements={updateElementsWithHistory}
        onUpdateAppState={(updates) => setAppState((prev) => ({ ...prev, ...updates }))}
      />
    </div>
  );
};

export default App;
