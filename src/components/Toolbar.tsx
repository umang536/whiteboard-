import React, { useRef } from 'react';
import {
  MousePointer,
  Square,
  ArrowUpRight,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  FolderOpen,
  Download,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import { ToolType, ExcalidrawElement } from '../types';

interface ToolbarProps {
  tool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onSaveJson: () => void;
  onLoadJson: (elements: ExcalidrawElement[]) => void;
  onExportPng: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onSaveJson,
  onLoadJson,
  onExportPng,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        const elementsToLoad = Array.isArray(data)
          ? data
          : data.elements && Array.isArray(data.elements)
          ? data.elements
          : null;

        if (elementsToLoad) {
          onLoadJson(elementsToLoad);
        } else {
          alert('Invalid Excalidraw JSON file format');
        }
      } catch (err) {
        alert('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="toolbar-island">
      {/* Tool Selection Group */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${tool === 'select' ? 'active' : ''}`}
          onClick={() => onSelectTool('select')}
          title="Selection tool (1)"
        >
          <MousePointer size={18} />
          <span className="shortcut-badge">1</span>
        </button>

        <button
          className={`toolbar-btn ${tool === 'box' ? 'active' : ''}`}
          onClick={() => onSelectTool('box')}
          title="Box / Rectangle tool (2)"
        >
          <Square size={18} />
          <span className="shortcut-badge">2</span>
        </button>

        <button
          className={`toolbar-btn ${tool === 'arrow' ? 'active' : ''}`}
          onClick={() => onSelectTool('arrow')}
          title="Arrow tool (3)"
        >
          <ArrowUpRight size={18} />
          <span className="shortcut-badge">3</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Undo / Redo Group */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo size={17} />
        </button>

        <button
          className="toolbar-btn"
          disabled={!canRedo}
          onClick={onRedo}
          title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
        >
          <Redo size={17} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Zoom Group */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={onZoomOut}
          title="Zoom out (-)"
        >
          <ZoomOut size={16} />
        </button>

        <button
          className="toolbar-btn zoom-percent-btn"
          onClick={onResetZoom}
          title="Reset zoom to 100% (0)"
        >
          <span>{zoomPercent}%</span>
        </button>

        <button
          className="toolbar-btn"
          onClick={onZoomIn}
          title="Zoom in (+)"
        >
          <ZoomIn size={16} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Actions Group */}
      <div className="toolbar-group">
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".json,application/json"
          onChange={handleFileChange}
        />

        <button
          className="toolbar-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Open drawing from JSON"
        >
          <FolderOpen size={17} />
        </button>

        <button
          className="toolbar-btn"
          onClick={onSaveJson}
          title="Save drawing to JSON"
        >
          <Download size={17} />
        </button>

        <button
          className="toolbar-btn highlight-action"
          onClick={onExportPng}
          title="Export as PNG image"
        >
          <ImageIcon size={17} />
        </button>
      </div>
    </div>
  );
};
