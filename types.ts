export enum RiskLevel {
  SAFE = 'SAFE',
  WARNING = 'WARNING',
  DANGER = 'DANGER',
  NONE = 'NONE',
}

export interface DetectedPerson {
  box_2d?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  x?: number; // 0-100% or px
  y?: number; // 0-100% or px
  label?: string;
  confidence?: number;
}

export interface DenseSector {
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  estimatedPeople: number;
  densityPerM2: number;
  name: string;
}

export interface CrowdAnalysisResult {
  people: number;
  area: number;
  density: number;
  risk: RiskLevel;
  heatmapOverlay?: string; // Base64 encoded PNG for XAI
  stabilityIndex?: number; // 0-100% confidence in the count's stability
  explanation?: string; // XAI: Text-based explanation of the result
  
  // Extended high-accuracy fields
  detectedPersons?: DetectedPerson[];
  denseSectors?: DenseSector[];
  countMethod?: 'individual_heads' | 'quadrant_density_integration' | 'hybrid';
  countConfidence?: 'high' | 'medium' | 'low';
  countRange?: { min: number; max: number };
  sceneType?: string;
  areaCalculationBasis?: string;
  chokePoints?: string[];
  flowDynamics?: string;
  recommendations?: string[];
  userCalibratedArea?: boolean;
}

export interface CapacityPredictionResult {
  area: number;
  safeCapacity: number;
  warningCapacity: number;
  dangerCapacity: number;
  explanation?: string;
  
  // Extended high-accuracy fields
  usableArea?: number;
  spaceType?: string;
  scaleAnchors?: string[];
  dimensions?: { lengthMeters?: number; widthMeters?: number };
  exitCountEstimate?: number;
  evacuationThroughputPerMin?: number;
  evacuationTimeMinutes?: { safe: number; warning: number; danger: number };
  recommendations?: string[];
}

export interface ScenarioInputs {
  expectedAttendance: number;
  entrances: number;
  exits: number;
  temperature: number; // in Celsius
  noiseLevel: number; // in dB
}

export interface DigitalTwinResult {
  spi: number; // Stampede Probability Index (0-100)
  riskSummary: string;
  preventiveSuggestions: string[];
  riskAreaDescription: string;
  heatmapOverlay?: string;
  density?: number;
  area?: number;
}
