import React from 'react';
import {
  ExcalidrawElement,
  BoxElement,
  StrokeWidth,
  StrokeStyle,
  FillStyle,
  Roughness,
} from '../types';
import { Trash2 } from 'lucide-react';

const STROKE_COLORS = [
  '#1e1e1e',
  '#e03131',
  '#2f9e44',
  '#1971c2',
  '#f08c00',
  '#9c36b5',
];

const BACKGROUND_COLORS = [
  'transparent',
  '#ffc9c9',
  '#b2f2bb',
  '#a5d8ff',
  '#ffec99',
  '#eebefa',
];

interface PropertiesPanelProps {
  selectedElements: ExcalidrawElement[];
  onUpdateElement: (updates: Partial<ExcalidrawElement>) => void;
  onDeleteElements: () => void;
  defaultStrokeColor: string;
  defaultBackgroundColor: string;
  defaultFillStyle: FillStyle;
  defaultStrokeWidth: StrokeWidth;
  defaultStrokeStyle: StrokeStyle;
  defaultRoughness: Roughness;
  onUpdateDefaults: (updates: {
    strokeColor?: string;
    backgroundColor?: string;
    fillStyle?: FillStyle;
    strokeWidth?: StrokeWidth;
    strokeStyle?: StrokeStyle;
    roughness?: Roughness;
  }) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedElements,
  onUpdateElement,
  onDeleteElements,
  defaultStrokeColor,
  defaultBackgroundColor,
  defaultFillStyle,
  defaultStrokeWidth,
  defaultStrokeStyle,
  defaultRoughness,
  onUpdateDefaults,
}) => {
  const hasSelected = selectedElements.length > 0;
  const firstSelected = hasSelected ? selectedElements[0] : null;
  const isBox = firstSelected ? firstSelected.type === 'box' : true;

  // Active property values
  const currentStrokeColor = firstSelected ? firstSelected.strokeColor : defaultStrokeColor;
  const currentBackgroundColor =
    firstSelected && firstSelected.type === 'box'
      ? (firstSelected as BoxElement).backgroundColor
      : defaultBackgroundColor;
  const currentFillStyle =
    firstSelected && firstSelected.type === 'box'
      ? (firstSelected as BoxElement).fillStyle
      : defaultFillStyle;
  const currentStrokeWidth = firstSelected ? firstSelected.strokeWidth : defaultStrokeWidth;
  const currentStrokeStyle = firstSelected ? firstSelected.strokeStyle : defaultStrokeStyle;
  const currentRoughness = firstSelected ? firstSelected.roughness : defaultRoughness;

  const handleStrokeColorChange = (color: string) => {
    if (hasSelected) {
      onUpdateElement({ strokeColor: color });
    }
    onUpdateDefaults({ strokeColor: color });
  };

  const handleBackgroundColorChange = (color: string) => {
    if (color === 'transparent') {
      if (hasSelected) {
        onUpdateElement({ backgroundColor: 'transparent', fillStyle: 'none' } as Partial<BoxElement>);
      }
      onUpdateDefaults({ backgroundColor: 'transparent', fillStyle: 'none' });
    } else {
      const nextFillStyle = currentFillStyle === 'none' ? 'hachure' : currentFillStyle;
      if (hasSelected) {
        onUpdateElement({ backgroundColor: color, fillStyle: nextFillStyle } as Partial<BoxElement>);
      }
      onUpdateDefaults({ backgroundColor: color, fillStyle: nextFillStyle });
    }
  };

  const handleFillStyleChange = (style: FillStyle) => {
    let nextBg = currentBackgroundColor;
    if (style !== 'none' && currentBackgroundColor === 'transparent') {
      nextBg = '#a5d8ff';
    }
    if (hasSelected) {
      onUpdateElement({ fillStyle: style, backgroundColor: nextBg } as Partial<BoxElement>);
    }
    onUpdateDefaults({ fillStyle: style, backgroundColor: nextBg });
  };

  const handleStrokeWidthChange = (width: StrokeWidth) => {
    if (hasSelected) {
      onUpdateElement({ strokeWidth: width });
    }
    onUpdateDefaults({ strokeWidth: width });
  };

  const handleStrokeStyleChange = (style: StrokeStyle) => {
    if (hasSelected) {
      onUpdateElement({ strokeStyle: style });
    }
    onUpdateDefaults({ strokeStyle: style });
  };

  const handleRoughnessChange = (roughness: Roughness) => {
    if (hasSelected) {
      onUpdateElement({ roughness: roughness });
    }
    onUpdateDefaults({ roughness: roughness });
  };

  return (
    <div className="properties-panel">
      <div className="properties-title">
        {hasSelected ? `Selected (${selectedElements.length})` : 'Default Styles'}
      </div>

      {/* Stroke / Outline Color */}
      <div className="property-section">
        <label className="property-label">Stroke / Outline</label>
        <div className="color-swatches">
          {STROKE_COLORS.map((c) => (
            <button
              key={c}
              className={`color-swatch ${currentStrokeColor === c ? 'selected' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => handleStrokeColorChange(c)}
              title={c}
            />
          ))}
          <label className="color-picker-wrapper" title="Custom stroke color">
            <input
              type="color"
              value={currentStrokeColor.startsWith('#') ? currentStrokeColor : '#1e1e1e'}
              onChange={(e) => handleStrokeColorChange(e.target.value)}
            />
            <div
              className="color-picker-preview"
              style={{
                backgroundColor: currentStrokeColor,
                border: '1px solid #cbd5e1',
              }}
            />
          </label>
        </div>
      </div>

      {/* Inside Color / Fill (for boxes or default) */}
      {isBox && (
        <>
          <div className="property-section">
            <label className="property-label">Inside Color (Fill)</label>
            <div className="color-swatches">
              {BACKGROUND_COLORS.map((c) => (
                <button
                  key={c}
                  className={`color-swatch ${currentBackgroundColor === c ? 'selected' : ''} ${
                    c === 'transparent' ? 'transparent-swatch' : ''
                  }`}
                  style={{ backgroundColor: c === 'transparent' ? '#ffffff' : c }}
                  onClick={() => handleBackgroundColorChange(c)}
                  title={c === 'transparent' ? 'Transparent' : c}
                >
                  {c === 'transparent' && '×'}
                </button>
              ))}
              <label className="color-picker-wrapper" title="Custom inside color">
                <input
                  type="color"
                  value={
                    currentBackgroundColor.startsWith('#')
                      ? currentBackgroundColor
                      : '#a5d8ff'
                  }
                  onChange={(e) => handleBackgroundColorChange(e.target.value)}
                />
                <div
                  className="color-picker-preview"
                  style={{
                    backgroundColor:
                      currentBackgroundColor === 'transparent'
                        ? '#ffffff'
                        : currentBackgroundColor,
                    border: '1px solid #cbd5e1',
                  }}
                />
              </label>
            </div>
          </div>

          {/* Fill Style */}
          <div className="property-section">
            <label className="property-label">Fill Pattern</label>
            <div className="button-group">
              <button
                className={`prop-btn ${currentFillStyle === 'none' ? 'active' : ''}`}
                onClick={() => handleFillStyleChange('none')}
                title="None"
              >
                None
              </button>
              <button
                className={`prop-btn ${currentFillStyle === 'hachure' ? 'active' : ''}`}
                onClick={() => handleFillStyleChange('hachure')}
                title="Hachure"
              >
                Hachure
              </button>
              <button
                className={`prop-btn ${currentFillStyle === 'cross-hatch' ? 'active' : ''}`}
                onClick={() => handleFillStyleChange('cross-hatch')}
                title="Cross-hatch"
              >
                Cross
              </button>
              <button
                className={`prop-btn ${currentFillStyle === 'solid' ? 'active' : ''}`}
                onClick={() => handleFillStyleChange('solid')}
                title="Solid"
              >
                Solid
              </button>
            </div>
          </div>
        </>
      )}

      {/* Stroke Width */}
      <div className="property-section">
        <label className="property-label">Stroke Width</label>
        <div className="button-group">
          <button
            className={`prop-btn ${currentStrokeWidth === 1 ? 'active' : ''}`}
            onClick={() => handleStrokeWidthChange(1)}
            title="Thin"
          >
            <div className="stroke-width-indicator" style={{ height: '1.5px' }} />
          </button>
          <button
            className={`prop-btn ${currentStrokeWidth === 2 ? 'active' : ''}`}
            onClick={() => handleStrokeWidthChange(2)}
            title="Medium"
          >
            <div className="stroke-width-indicator" style={{ height: '3px' }} />
          </button>
          <button
            className={`prop-btn ${currentStrokeWidth === 4 ? 'active' : ''}`}
            onClick={() => handleStrokeWidthChange(4)}
            title="Bold"
          >
            <div className="stroke-width-indicator" style={{ height: '5px' }} />
          </button>
        </div>
      </div>

      {/* Stroke Style */}
      <div className="property-section">
        <label className="property-label">Stroke Style</label>
        <div className="button-group">
          <button
            className={`prop-btn ${currentStrokeStyle === 'solid' ? 'active' : ''}`}
            onClick={() => handleStrokeStyleChange('solid')}
            title="Solid"
          >
            <span className="stroke-style-sample sample-solid" />
          </button>
          <button
            className={`prop-btn ${currentStrokeStyle === 'dashed' ? 'active' : ''}`}
            onClick={() => handleStrokeStyleChange('dashed')}
            title="Dashed"
          >
            <span className="stroke-style-sample sample-dashed" />
          </button>
          <button
            className={`prop-btn ${currentStrokeStyle === 'dotted' ? 'active' : ''}`}
            onClick={() => handleStrokeStyleChange('dotted')}
            title="Dotted"
          >
            <span className="stroke-style-sample sample-dotted" />
          </button>
        </div>
      </div>

      {/* Roughness / Sloppiness */}
      <div className="property-section">
        <label className="property-label">Sloppiness (Roughness)</label>
        <div className="button-group">
          <button
            className={`prop-btn ${currentRoughness === 0 ? 'active' : ''}`}
            onClick={() => handleRoughnessChange(0)}
            title="Architect (Straight)"
          >
            Clean
          </button>
          <button
            className={`prop-btn ${currentRoughness === 1 ? 'active' : ''}`}
            onClick={() => handleRoughnessChange(1)}
            title="Artist (Slightly rough)"
          >
            Sketchy
          </button>
          <button
            className={`prop-btn ${currentRoughness === 2 ? 'active' : ''}`}
            onClick={() => handleRoughnessChange(2)}
            title="Cartoonist (Very rough)"
          >
            Rough
          </button>
        </div>
      </div>

      {/* Delete Action if elements are selected */}
      {hasSelected && (
        <div className="property-section property-section-actions">
          <button className="delete-btn" onClick={onDeleteElements} title="Delete selected (Del)">
            <Trash2 size={16} />
            <span>Delete Element</span>
            <span className="shortcut-hint">Del</span>
          </button>
        </div>
      )}
    </div>
  );
};
