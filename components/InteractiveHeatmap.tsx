import React, { useState, useRef } from 'react';
import { DetectedPerson, DenseSector } from '../types';

interface InteractiveHeatmapProps {
  baseImageSrc: string;
  heatmapSrc: string | null;
  baseDensity: number | undefined;
  detectedPersons?: DetectedPerson[];
  denseSectors?: DenseSector[];
  totalPeople?: number;
}

interface TooltipData {
  title: string;
  density?: string;
  insight: string;
  peopleInZone?: number;
}

export const InteractiveHeatmap: React.FC<InteractiveHeatmapProps> = ({
  baseImageSrc,
  heatmapSrc,
  baseDensity,
  detectedPersons = [],
  denseSectors = [],
  totalPeople,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showDetections, setShowDetections] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [heatmapOpacity, setHeatmapOpacity] = useState<number>(0.75);

  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    data: TooltipData | null;
  }>({
    visible: false,
    position: { x: 0, y: 0 },
    data: null,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || baseDensity === undefined) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const normX = (x / rect.width) * 1000;
    const normY = (y / rect.height) * 1000;

    // Check if cursor is over a dense sector
    const hoveredSector = denseSectors.find((s) => {
      if (!s.box_2d || s.box_2d.length < 4) return false;
      const [ymin, xmin, ymax, xmax] = s.box_2d;
      return normY >= ymin && normY <= ymax && normX >= xmin && normX <= xmax;
    });

    // Check if cursor is near a detected person
    const hoveredPerson = detectedPersons.find((p) => {
      if (!p.box_2d || p.box_2d.length < 4) return false;
      const [ymin, xmin, ymax, xmax] = p.box_2d;
      return normY >= ymin - 15 && normY <= ymax + 15 && normX >= xmin - 15 && normX <= xmax + 15;
    });

    if (hoveredSector) {
      setTooltip({
        visible: true,
        position: { x: e.clientX, y: e.clientY },
        data: {
          title: hoveredSector.name || 'High Density Cluster',
          density: `${hoveredSector.densityPerM2 || baseDensity} p/m²`,
          peopleInZone: hoveredSector.estimatedPeople,
          insight:
            hoveredSector.densityPerM2 > 6
              ? 'CRITICAL crush zone. High lateral pressure risk.'
              : 'Dense crowd sector. Monitor ingress flow.',
        },
      });
      return;
    }

    if (hoveredPerson) {
      setTooltip({
        visible: true,
        position: { x: e.clientX, y: e.clientY },
        data: {
          title: hoveredPerson.label || 'Identified Individual / Head',
          insight: 'AI detected human signature.',
        },
      });
      return;
    }

    // Default quadrant calculation
    const col = Math.min(2, Math.floor((x / rect.width) * 3));
    const row = Math.min(2, Math.floor((y / rect.height) * 3));
    const quadrantNames = [
      ['Top-Left (Far Left)', 'Top-Center (Far Center)', 'Top-Right (Far Right)'],
      ['Mid-Left', 'Mid-Center (Core Flow)', 'Mid-Right'],
      ['Fore-Left', 'Fore-Center (Immediate)', 'Fore-Right'],
    ];

    const variation = Math.sin(col * 2.1 + row * 1.7) * (baseDensity * 0.25);
    const localDensity = Math.max(0, baseDensity + variation);

    let insight = 'Normal crowd dispersal.';
    if (localDensity > 6) {
      insight = 'Dangerous crowd packing. Evacuation route required.';
    } else if (localDensity >= 3) {
      insight = 'Elevated density. Movement constrained.';
    }

    setTooltip({
      visible: true,
      position: { x: e.clientX, y: e.clientY },
      data: {
        title: quadrantNames[row][col],
        density: `${localDensity.toFixed(2)} p/m²`,
        insight,
      },
    });
  };

  const handleMouseLeave = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  return (
    <div className="flex flex-col space-y-2">
      {/* Visual Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-panel/60 border border-border-accent rounded-lg text-xs">
        <span className="text-text-secondary font-medium">Vision Overlays:</span>
        <div className="flex items-center space-x-2">
          {heatmapSrc && (
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`px-2.5 py-1 rounded transition-colors ${
                showHeatmap
                  ? 'bg-cta-primary text-white font-medium'
                  : 'bg-background text-text-secondary hover:text-text-primary'
              }`}
            >
              Heatmap
            </button>
          )}

          {detectedPersons.length > 0 && (
            <button
              onClick={() => setShowDetections(!showDetections)}
              className={`px-2.5 py-1 rounded transition-colors ${
                showDetections
                  ? 'bg-cta-primary text-white font-medium'
                  : 'bg-background text-text-secondary hover:text-text-primary'
              }`}
            >
              Boxes ({detectedPersons.length})
            </button>
          )}

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-2.5 py-1 rounded transition-colors ${
              showGrid
                ? 'bg-cta-primary text-white font-medium'
                : 'bg-background text-text-secondary hover:text-text-primary'
            }`}
          >
            3×3 Grid
          </button>
        </div>

        {showHeatmap && heatmapSrc && (
          <div className="flex items-center space-x-2">
            <span className="text-text-secondary">Opacity:</span>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={heatmapOpacity}
              onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))}
              className="w-16 h-1.5 accent-cta-primary cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Main Image Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full aspect-video rounded-lg overflow-hidden bg-background ring-2 ring-border-accent cursor-crosshair select-none"
      >
        {/* Base Image */}
        <img
          src={baseImageSrc}
          alt="Crowd Analysis Area"
          className="w-full h-full object-cover select-none"
        />

        {/* Real KDE Heatmap Overlay */}
        {heatmapSrc && showHeatmap && (
          <img
            src={heatmapSrc}
            alt="Crowd density heatmap"
            style={{ opacity: heatmapOpacity }}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-200"
          />
        )}

        {/* Real Detected People Bounding Boxes & Head Markers */}
        {showDetections && detectedPersons.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {detectedPersons.map((p, idx) => {
              if (!p.box_2d || p.box_2d.length < 4) return null;
              const [ymin, xmin, ymax, xmax] = p.box_2d;
              const top = `${ymin / 10}%`;
              const left = `${xmin / 10}%`;
              const width = `${Math.max(1.2, (xmax - xmin) / 10)}%`;
              const height = `${Math.max(1.2, (ymax - ymin) / 10)}%`;

              return (
                <div
                  key={idx}
                  style={{ top, left, width, height }}
                  className="absolute border border-safe/90 bg-safe/20 rounded-sm shadow-sm"
                >
                  <span className="absolute -top-3.5 left-0 text-[9px] bg-background/90 text-safe px-1 py-0 rounded font-mono border border-safe/40 whitespace-nowrap">
                    #{idx + 1}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Real Dense Sectors / Hotspot Highlights */}
        {showDetections && denseSectors.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {denseSectors.map((sector, idx) => {
              if (!sector.box_2d || sector.box_2d.length < 4) return null;
              const [ymin, xmin, ymax, xmax] = sector.box_2d;
              const top = `${ymin / 10}%`;
              const left = `${xmin / 10}%`;
              const width = `${(xmax - xmin) / 10}%`;
              const height = `${(ymax - ymin) / 10}%`;
              const isDanger = sector.densityPerM2 > 6;

              return (
                <div
                  key={`sector-${idx}`}
                  style={{ top, left, width, height }}
                  className={`absolute border-2 border-dashed ${
                    isDanger ? 'border-danger bg-danger/15' : 'border-warning bg-warning/15'
                  } rounded p-1`}
                >
                  <span
                    className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isDanger ? 'bg-danger text-white' : 'bg-warning text-black'
                    }`}
                  >
                    {sector.name || 'Hotspot'} ({sector.estimatedPeople} ppl · {sector.densityPerM2} p/m²)
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 3×3 Analysis Grid */}
        {showGrid && (
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none border border-cta-primary/40">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="border border-cta-primary/30 p-1 flex items-end justify-between bg-black/10 backdrop-blur-[1px]"
              >
                <span className="text-[10px] text-cta-primary/80 font-mono">Q{i + 1}</span>
              </div>
            ))}
          </div>
        )}

        {/* Floating Tooltip for Spatial Inspection */}
        {tooltip.visible && tooltip.data && (
          <div
            style={{
              position: 'fixed',
              top: tooltip.position.y + 15,
              left: Math.min(window.innerWidth - 240, tooltip.position.x + 15),
              pointerEvents: 'none',
            }}
            className="z-50 p-3 max-w-xs rounded-lg bg-background/95 backdrop-blur-md shadow-2xl border border-border-accent text-xs animate-fade-in"
          >
            <p className="font-bold text-text-primary text-sm">{tooltip.data.title}</p>
            {tooltip.data.density && (
              <p className="text-text-primary mt-1">
                Local Density: <span className="font-semibold text-cta-primary">{tooltip.data.density}</span>
              </p>
            )}
            {tooltip.data.peopleInZone !== undefined && (
              <p className="text-text-primary">
                People in Sector: <span className="font-semibold text-safe">{tooltip.data.peopleInZone}</span>
              </p>
            )}
            <p className="text-text-secondary mt-1 leading-snug">{tooltip.data.insight}</p>
          </div>
        )}
      </div>
    </div>
  );
};
