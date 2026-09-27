import React from 'react';
import { CrowdAnalysisResult, CapacityPredictionResult, RiskLevel } from '../types';
import { RISK_LEVELS } from '../constants';

type ResultCardProps = {
  result: CrowdAnalysisResult | CapacityPredictionResult | null;
  mode: 'crowd' | 'capacity' | 'live';
  onAreaRecalibrate?: (newArea: number) => void;
};

const StatItem: React.FC<{
  label: string;
  value: string | number;
  valueClass?: string;
  subValue?: string;
}> = ({ label, value, valueClass = '', subValue }) => (
  <div className="flex justify-between items-center bg-background/60 p-3 rounded-md border border-border-accent/40">
    <span className="text-sm text-text-secondary">{label}</span>
    <div className="text-right">
      <span className={`text-base sm:text-lg font-bold ${valueClass}`}>{value}</span>
      {subValue && <p className="text-xs text-text-secondary">{subValue}</p>}
    </div>
  </div>
);

export const ResultCard: React.FC<ResultCardProps> = ({ result, mode, onAreaRecalibrate }) => {
  if (!result) return null;

  if (mode === 'crowd' || mode === 'live') {
    const data = result as CrowdAnalysisResult;
    const riskInfo = RISK_LEVELS[data.risk] || RISK_LEVELS[RiskLevel.SAFE];

    return (
      <div className={`p-6 rounded-xl border-2 bg-panel/70 ${riskInfo.borderColor} shadow-xl transition-all duration-500`}>
        <div className="flex flex-col space-y-4">
          {/* Main Risk Status Banner */}
          <div className={`text-center p-3.5 rounded-lg ${riskInfo.color} shadow-md`}>
            <p className="text-2xl font-black tracking-wider uppercase text-white">{riskInfo.label}</p>
            <p className="text-xs sm:text-sm text-white/90 font-medium">{riskInfo.description}</p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <StatItem
              label="Detected People"
              value={data.people.toLocaleString()}
              valueClass="text-text-primary text-xl font-mono"
              subValue={
                data.countRange
                  ? `Est. range: ${data.countRange.min} - ${data.countRange.max}`
                  : undefined
              }
            />

            <StatItem
              label="Ground Area"
              value={`${data.area.toLocaleString()} m²`}
              valueClass="text-text-primary font-mono"
              subValue={data.userCalibratedArea ? '✓ User calibrated' : 'AI visual scale'}
            />

            <StatItem
              label="Crowd Density"
              value={`${data.density} p/m²`}
              valueClass={`${riskInfo.textColor} text-xl font-mono`}
              subValue={
                data.density < 3
                  ? 'Fruin LoS A-B (Free Flow)'
                  : data.density <= 6
                  ? 'Fruin LoS C-D (Restricted)'
                  : 'Fruin LoS E-F (Crush Hazard)'
              }
            />

            {data.stabilityIndex !== undefined && (
              <StatItem
                label="Count Stability"
                value={`${data.stabilityIndex}%`}
                valueClass={data.stabilityIndex > 80 ? 'text-safe font-mono' : 'text-warning font-mono'}
                subValue="Temporal consistency"
              />
            )}

            {data.countMethod && (
              <StatItem
                label="Counting Method"
                value={
                  data.countMethod === 'individual_heads'
                    ? 'Individual Head Count'
                    : 'Jacob’s Density Integration'
                }
                valueClass="text-sm text-cta-primary font-semibold"
                subValue={data.countConfidence ? `Confidence: ${data.countConfidence.toUpperCase()}` : undefined}
              />
            )}
          </div>

          {/* Spatial Scale Basis & Flow Dynamics */}
          {data.areaCalculationBasis && (
            <div className="p-3 bg-background/50 rounded-lg border border-border-accent/50 text-xs">
              <span className="font-semibold text-text-secondary">Spatial Scale Reference: </span>
              <span className="text-text-primary/90">{data.areaCalculationBasis}</span>
            </div>
          )}

          {data.flowDynamics && (
            <div className="p-3 bg-background/50 rounded-lg border border-border-accent/50 text-xs flex items-center justify-between">
              <span className="font-semibold text-text-secondary">Crowd Flow Pattern:</span>
              <span className="text-cta-primary font-medium">{data.flowDynamics}</span>
            </div>
          )}

          {/* Choke Points */}
          {data.chokePoints && data.chokePoints.length > 0 && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg">
              <h4 className="text-xs font-bold text-danger uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Identified Choke Points & Hazards
              </h4>
              <ul className="text-xs text-text-primary/90 space-y-1 list-disc list-inside">
                {data.chokePoints.map((point, idx) => (
                  <li key={idx}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Explanation */}
          {data.explanation && (
            <div className="pt-3 border-t border-border-accent/50">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Explainable AI (XAI) Assessment
              </h4>
              <p className="text-xs sm:text-sm text-text-primary/90 leading-relaxed bg-background/40 p-3 rounded-lg border border-border-accent/30">
                {data.explanation}
              </p>
            </div>
          )}

          {/* Actionable Recommendations */}
          {data.recommendations && data.recommendations.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Safety Protocol Recommendations
              </h4>
              <ul className="space-y-1.5">
                {data.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start text-xs text-text-primary/90 space-x-2">
                    <span className="text-safe font-bold">✓</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'capacity') {
    const data = result as CapacityPredictionResult;

    return (
      <div className="p-6 rounded-xl border-2 border-cta-primary bg-panel/70 shadow-xl space-y-5">
        <div className="text-center p-3.5 rounded-lg bg-cta-primary shadow-md">
          <p className="text-2xl font-black tracking-wider uppercase text-white">Capacity & Safety Forecast</p>
          <p className="text-xs sm:text-sm text-white/90">Fruin Level of Service (LoS) & Egress Standards</p>
        </div>

        {/* Space Geometry Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <StatItem label="Total Area" value={`${data.area.toLocaleString()} m²`} valueClass="text-text-primary font-mono" />
          <StatItem
            label="Usable Footprint"
            value={`${(data.usableArea || data.area).toLocaleString()} m²`}
            valueClass="text-safe font-mono"
            subValue="Net walkable area"
          />
          {data.dimensions && (
            <StatItem
              label="Dimensions"
              value={`${data.dimensions.lengthMeters || '-'}m × ${data.dimensions.widthMeters || '-'}m`}
              valueClass="text-cta-primary font-mono text-sm"
              subValue="Length × Width"
            />
          )}
        </div>

        {/* Capacity Tiers (LoS) */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Crowd Capacity Thresholds</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 bg-safe/10 border border-safe/30 rounded-lg text-center">
              <span className="text-xs font-semibold text-safe uppercase">Safe Limit</span>
              <p className="text-xl font-bold text-safe font-mono mt-1">&lt; {data.safeCapacity.toLocaleString()}</p>
              <p className="text-[11px] text-text-secondary mt-0.5">&lt; 2.5 p/m² (Free flow)</p>
            </div>

            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-center">
              <span className="text-xs font-semibold text-warning uppercase">Warning Limit</span>
              <p className="text-xl font-bold text-warning font-mono mt-1">~ {data.warningCapacity.toLocaleString()}</p>
              <p className="text-[11px] text-text-secondary mt-0.5">3.0 - 4.5 p/m² (Restricted)</p>
            </div>

            <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-center">
              <span className="text-xs font-semibold text-danger uppercase">Crush Hazard</span>
              <p className="text-xl font-bold text-danger font-mono mt-1">&gt; {data.dangerCapacity.toLocaleString()}</p>
              <p className="text-[11px] text-text-secondary mt-0.5">&gt; 5.5 p/m² (High Stampede Risk)</p>
            </div>
          </div>
        </div>

        {/* Evacuation Throughput & Clearance Time */}
        {(data.evacuationThroughputPerMin || data.evacuationTimeMinutes) && (
          <div className="p-4 bg-background/60 border border-border-accent/60 rounded-lg space-y-3">
            <div className="flex justify-between items-center border-b border-border-accent/40 pb-2">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Egress & Evacuation Analysis</h4>
              <span className="text-xs text-cta-primary font-semibold">
                {data.exitCountEstimate || 2} Visible Egress Route(s)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-secondary">Egress Throughput:</span>
                <p className="text-sm font-bold text-text-primary mt-0.5">
                  ~{data.evacuationThroughputPerMin?.toLocaleString()} persons / min
                </p>
                <p className="text-[10px] text-text-secondary">Based on NFPA 101 flow standard</p>
              </div>

              {data.evacuationTimeMinutes && (
                <div>
                  <span className="text-text-secondary">Evacuation Time:</span>
                  <p className="text-sm font-bold text-text-primary mt-0.5">
                    Safe: {data.evacuationTimeMinutes.safe} min · Warning: {data.evacuationTimeMinutes.warning} min
                  </p>
                  <p className="text-[10px] text-danger font-medium">
                    At Danger load: {data.evacuationTimeMinutes.danger} min
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scale Anchors identified */}
        {data.scaleAnchors && data.scaleAnchors.length > 0 && (
          <div className="text-xs text-text-secondary">
            <span className="font-semibold">Visual Scale Anchors: </span>
            <span>{data.scaleAnchors.join(' • ')}</span>
          </div>
        )}

        {/* AI Explanation */}
        {data.explanation && (
          <div className="pt-2 border-t border-border-accent/50">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Architectural Analysis
            </h4>
            <p className="text-xs sm:text-sm text-text-primary/90 leading-relaxed bg-background/40 p-3 rounded-lg border border-border-accent/30">
              {data.explanation}
            </p>
          </div>
        )}

        {/* Recommendations */}
        {data.recommendations && data.recommendations.length > 0 && (
          <div className="pt-1">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Capacity Management Protocols
            </h4>
            <ul className="space-y-1.5">
              {data.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start text-xs text-text-primary/90 space-x-2">
                  <span className="text-safe font-bold">✓</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return null;
};
