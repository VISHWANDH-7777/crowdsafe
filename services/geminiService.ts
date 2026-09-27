import {
  CrowdAnalysisResult,
  CapacityPredictionResult,
  RiskLevel,
  ScenarioInputs,
  DigitalTwinResult,
  DetectedPerson,
  DenseSector,
} from '../types';

export const getRiskLevel = (density: number): RiskLevel => {
  if (density > 6) return RiskLevel.DANGER;
  if (density >= 3) return RiskLevel.WARNING;
  return RiskLevel.SAFE;
};

/**
 * Generate a genuine Kernel Density Estimation (KDE) Heatmap overlay
 * based on actual detected coordinates and sectors from Gemini.
 */
export const generateRealHeatmap = (
  width: number,
  height: number,
  detectedPersons?: DetectedPerson[],
  denseSectors?: DenseSector[],
  overallDensity: number = 0
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const points: { x: number; y: number; weight: number; radius: number }[] = [];

  // 1. Add detected individuals / heads
  if (detectedPersons && detectedPersons.length > 0) {
    for (const p of detectedPersons) {
      if (p.box_2d && p.box_2d.length === 4) {
        const [ymin, xmin, ymax, xmax] = p.box_2d;
        const cx = ((xmin + xmax) / 2 / 1000) * width;
        const cy = ((ymin + ymax) / 2 / 1000) * height;
        const boxW = ((xmax - xmin) / 1000) * width;
        const boxH = ((ymax - ymin) / 1000) * height;
        const r = Math.max(20, Math.min(65, Math.max(boxW, boxH) * 1.3));
        points.push({ x: cx, y: cy, weight: 1.0, radius: r });
      }
    }
  }

  // 2. Add dense sectors
  if (denseSectors && denseSectors.length > 0) {
    for (const s of denseSectors) {
      if (s.box_2d && s.box_2d.length === 4) {
        const [ymin, xmin, ymax, xmax] = s.box_2d;
        const cx = ((xmin + xmax) / 2 / 1000) * width;
        const cy = ((ymin + ymax) / 2 / 1000) * height;
        const sectorW = ((xmax - xmin) / 1000) * width;
        const sectorH = ((ymax - ymin) / 1000) * height;
        const r = Math.max(40, Math.min(130, (sectorW + sectorH) / 2));
        const weight = Math.max(1.5, Math.min(3.5, (s.densityPerM2 || 4) / 2));
        points.push({ x: cx, y: cy, weight, radius: r });
      }
    }
  }

  // 3. Fallback if no specific coordinates detected but overall density is high
  if (points.length === 0 && overallDensity > 0) {
    const numPoints = Math.min(30, Math.max(5, Math.floor(overallDensity * 4)));
    for (let i = 0; i < numPoints; i++) {
      points.push({
        x: (0.2 + 0.6 * ((i * 37) % 100) / 100) * width,
        y: (0.3 + 0.5 * ((i * 53) % 100) / 100) * height,
        weight: overallDensity > 6 ? 2.5 : 1.2,
        radius: 45,
      });
    }
  }

  // Draw points with radial gradients (additive blend)
  ctx.globalCompositeOperation = 'lighter';
  for (const pt of points) {
    const rad = pt.radius;
    const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rad);
    const alpha = Math.min(0.85, 0.45 * pt.weight);

    if (pt.weight >= 2.0 || overallDensity > 6) {
      grad.addColorStop(0, `rgba(239, 68, 68, ${alpha})`); // Red (Crush risk)
      grad.addColorStop(0.4, `rgba(249, 115, 22, ${alpha * 0.7})`); // Orange
      grad.addColorStop(0.8, `rgba(234, 179, 8, ${alpha * 0.3})`); // Yellow
      grad.addColorStop(1, 'rgba(234, 179, 8, 0)');
    } else if (pt.weight >= 1.2 || overallDensity >= 3) {
      grad.addColorStop(0, `rgba(234, 179, 8, ${alpha})`); // Amber Yellow
      grad.addColorStop(0.5, `rgba(249, 115, 22, ${alpha * 0.5})`);
      grad.addColorStop(1, 'rgba(234, 179, 8, 0)');
    } else {
      grad.addColorStop(0, `rgba(34, 197, 94, ${alpha})`); // Green (Safe)
      grad.addColorStop(0.6, `rgba(59, 130, 246, ${alpha * 0.4})`);
      grad.addColorStop(1, 'rgba(34, 197, 94, 0)');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toDataURL('image/png').split(',')[1];
};

/**
 * Call server-side Gemini API for high-precision crowd analysis
 */
export const analyzeCrowdImage = async (
  base64ImageData: string,
  userSpecifiedArea?: number,
  venueContext?: string
): Promise<CrowdAnalysisResult> => {
  const response = await fetch('/api/gemini/analyze-crowd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64Image: base64ImageData,
      userSpecifiedArea: userSpecifiedArea ? userSpecifiedArea : undefined,
      venueContext: venueContext || undefined,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.statusText}`);
  }

  const data = await response.json();
  const density = data.density ?? (data.area > 0 ? parseFloat((data.people / data.area).toFixed(2)) : 0);
  const risk = (data.risk as RiskLevel) || getRiskLevel(density);

  // Generate genuine KDE heatmap from detected coordinates
  const heatmapOverlay = generateRealHeatmap(640, 480, data.detectedPersons, data.denseSectors, density);

  return {
    people: data.people,
    area: data.area,
    density,
    risk,
    heatmapOverlay,
    explanation: data.explanation,
    countMethod: data.countMethod,
    countConfidence: data.countConfidence,
    countRange: data.countRange,
    sceneType: data.sceneType,
    areaCalculationBasis: data.areaCalculationBasis,
    chokePoints: data.chokePoints,
    flowDynamics: data.flowDynamics,
    recommendations: data.recommendations,
    detectedPersons: data.detectedPersons,
    denseSectors: data.denseSectors,
    userCalibratedArea: data.userCalibratedArea,
  };
};

/**
 * Call server-side Gemini API for accurate architectural capacity prediction
 */
export const predictCapacity = async (
  base64ImageData: string,
  userSpecifiedArea?: number,
  spaceTypeContext?: string
): Promise<CapacityPredictionResult> => {
  const response = await fetch('/api/gemini/predict-capacity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64Image: base64ImageData,
      userSpecifiedArea: userSpecifiedArea || undefined,
      spaceTypeContext: spaceTypeContext || undefined,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    area: data.area,
    safeCapacity: data.safeCapacity,
    warningCapacity: data.warningCapacity,
    dangerCapacity: data.dangerCapacity,
    usableArea: data.usableArea,
    spaceType: data.spaceType,
    dimensions: data.dimensions,
    scaleAnchors: data.scaleAnchors,
    exitCountEstimate: data.exitCountEstimate,
    evacuationThroughputPerMin: data.evacuationThroughputPerMin,
    evacuationTimeMinutes: data.evacuationTimeMinutes,
    explanation: data.explanation,
    recommendations: data.recommendations,
  };
};

// --- REAL-TIME STABILIZATION ENGINE FOR LIVE VIDEO ---
let liveCountHistory: number[] = [];
const MAX_LIVE_HISTORY = 12;

export const resetLiveStabilization = () => {
  liveCountHistory = [];
};

/**
 * Call server-side Gemini API for live frame analysis with temporal stabilization
 */
export const analyzeLiveFrame = async (
  base64FrameData: string,
  monitoredArea: number = 25
): Promise<CrowdAnalysisResult> => {
  const response = await fetch('/api/gemini/analyze-live-frame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64Frame: base64FrameData,
      monitoredArea,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Live analysis failed: ${response.statusText}`);
  }

  const data = await response.json();
  const rawPeople = Math.max(0, data.people || 0);

  // Temporal smoothing filter (reduces frame jitter and camera flicker)
  liveCountHistory.push(rawPeople);
  if (liveCountHistory.length > MAX_LIVE_HISTORY) {
    liveCountHistory.shift();
  }

  // Calculate moving average with exponential weight for latest frame
  let smoothedCount = rawPeople;
  if (liveCountHistory.length > 1) {
    const weights = liveCountHistory.map((_, idx) => Math.pow(1.3, idx));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const weightedSum = liveCountHistory.reduce((sum, count, idx) => sum + count * weights[idx], 0);
    smoothedCount = Math.round(weightedSum / totalWeight);
  }

  // Calculate stability index: how consistent the count has been
  let stabilityIndex = 95;
  if (liveCountHistory.length >= 3) {
    const mean = liveCountHistory.reduce((a, b) => a + b, 0) / liveCountHistory.length;
    const variance =
      liveCountHistory.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) /
      liveCountHistory.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;
    stabilityIndex = Math.max(40, Math.min(100, Math.round((1 - cv * 1.5) * 100)));
  }

  const density = parseFloat((smoothedCount / monitoredArea).toFixed(2));
  const risk = getRiskLevel(density);

  // Generate genuine KDE heatmap from detected coordinates
  const heatmapOverlay = generateRealHeatmap(640, 480, data.detectedPersons, data.denseSectors, density);

  return {
    people: smoothedCount,
    area: monitoredArea,
    density,
    risk,
    heatmapOverlay,
    stabilityIndex,
    explanation: data.summary,
    detectedPersons: data.detectedPersons,
    denseSectors: data.denseSectors,
  };
};

/**
 * Call server-side Gemini API for digital twin scenario simulation
 */
export const runCrowdSimulation = async (
  base64ImageData: string,
  inputs: ScenarioInputs
): Promise<DigitalTwinResult> => {
  const response = await fetch('/api/gemini/simulate-sandbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64Image: base64ImageData,
      inputs,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Simulation failed: ${response.statusText}`);
  }

  const data = await response.json();
  const density = data.density ?? (data.area > 0 ? parseFloat((inputs.expectedAttendance / data.area).toFixed(2)) : 5.0);
  const heatmapOverlay = generateRealHeatmap(640, 480, undefined, data.denseSectors, density);

  return {
    spi: data.spi,
    riskSummary: data.riskSummary,
    preventiveSuggestions: data.preventiveSuggestions,
    riskAreaDescription: data.riskAreaDescription,
    heatmapOverlay,
    density,
    area: data.area,
  };
};
