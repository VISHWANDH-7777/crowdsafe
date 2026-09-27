import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Initialize server-side GoogleGenAI client
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', hasApiKey: !!apiKey });
  });

  // 1. CROWD ANALYSIS ENDPOINT
  app.post('/api/gemini/analyze-crowd', async (req, res) => {
    try {
      const { base64Image, userSpecifiedArea, venueContext } = req.body;
      if (!base64Image) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      // Clean base64 data if header prefix is present
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

      const promptText = `Perform a high-precision crowd counting, ground area estimation, and stampede risk evaluation on this image.
${userSpecifiedArea ? `NOTE: The user has specified a calibrated ground area of ${userSpecifiedArea} m². Use this known area to calculate the final crowd density, but still assess whether the visual perspective matches.` : 'Estimate the physical ground area from visual perspective, architectural cues, and scale references.'}
${venueContext ? `Venue Context provided by user: ${venueContext}` : ''}

Strict requirements:
1. Count visible people accurately. If crowd is large/dense, use Jacob's density quadrant method and perspective depth gradient. If sparse/moderate, count individual heads.
2. Return bounding boxes [ymin, xmin, ymax, xmax] (normalized 0 to 1000) for prominent people/heads detected (provide up to 50 bounding boxes).
3. If dense clusters exist, return dense sectors with their coordinates [ymin, xmin, ymax, xmax], estimated headcount in that sector, and density.
4. Estimate walkable physical ground area (m²) and explain the scale anchors used (doors, road lanes, human height, paving, vehicles).
5. Calculate density (people / area) and assign Risk Level: SAFE (< 3 p/m²), WARNING (3-6 p/m²), DANGER (> 6 p/m²).
6. Detail choke points, flow dynamics, and actionable preventive suggestions.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: cleanBase64,
                },
              },
              {
                text: promptText,
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            'You are an expert Computer Vision and Crowd Safety Engineer specializing in crowd dynamics, head detection, Fruin Level of Service (LoS), and stampede disaster prevention. Return strict, valid JSON matching the requested schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              people: {
                type: Type.INTEGER,
                description: 'Accurate total count of visible people in the image',
              },
              area: {
                type: Type.NUMBER,
                description: 'Physical ground area in square meters (m²)',
              },
              density: {
                type: Type.NUMBER,
                description: 'Crowd density in people per square meter (people / area)',
              },
              risk: {
                type: Type.STRING,
                description: 'Risk level: SAFE (<3), WARNING (3-6), or DANGER (>6)',
              },
              countMethod: {
                type: Type.STRING,
                description: 'Counting technique: individual_heads, quadrant_density_integration, or hybrid',
              },
              countConfidence: {
                type: Type.STRING,
                description: 'Confidence level: high, medium, or low',
              },
              countMin: {
                type: Type.INTEGER,
                description: 'Lower bound of count range',
              },
              countMax: {
                type: Type.INTEGER,
                description: 'Upper bound of count range',
              },
              sceneType: {
                type: Type.STRING,
                description: 'Typology of scene (e.g., Narrow Street, Music Festival, Metro Concourse, Plaza, Religious Gathering, Stadium Gate)',
              },
              areaCalculationBasis: {
                type: Type.STRING,
                description: 'Physical scale anchors used to measure area (e.g., standard 0.9m doors, 3.5m road lane, human shoulder width)',
              },
              chokePoints: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Identified pinch points or bottlenecks',
              },
              flowDynamics: {
                type: Type.STRING,
                description: 'Crowd motion pattern (e.g., Static Congestion, Uni-directional, Turbulent Cross-flow)',
              },
              explanation: {
                type: Type.STRING,
                description: 'Explainable AI breakdown explaining the density, risks, and crush hazards',
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Actionable safety recommendations',
              },
              detectedPersons: {
                type: Type.ARRAY,
                description: 'Bounding boxes for detected individual heads or persons (normalized 0-1000)',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    box_2d: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                      description: '[ymin, xmin, ymax, xmax] in range 0..1000',
                    },
                    label: { type: Type.STRING },
                  },
                },
              },
              denseSectors: {
                type: Type.ARRAY,
                description: 'High-density quadrant zones with estimated people and density',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    box_2d: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                      description: '[ymin, xmin, ymax, xmax] in range 0..1000',
                    },
                    name: { type: Type.STRING },
                    estimatedPeople: { type: Type.INTEGER },
                    densityPerM2: { type: Type.NUMBER },
                  },
                },
              },
            },
            required: ['people', 'area', 'density', 'risk', 'explanation'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');

      // Normalize fields
      const people = Math.max(0, parsed.people || 0);
      let area = parsed.area || (userSpecifiedArea ? parseFloat(userSpecifiedArea) : 100);
      if (userSpecifiedArea && !isNaN(parseFloat(userSpecifiedArea)) && parseFloat(userSpecifiedArea) > 0) {
        area = parseFloat(userSpecifiedArea);
      }
      area = Math.max(1, Math.round(area * 10) / 10);
      const density = parseFloat((people / area).toFixed(2));

      let risk = 'SAFE';
      if (density > 6) risk = 'DANGER';
      else if (density >= 3) risk = 'WARNING';

      res.json({
        people,
        area,
        density,
        risk,
        countMethod: parsed.countMethod || (people < 100 ? 'individual_heads' : 'quadrant_density_integration'),
        countConfidence: parsed.countConfidence || 'high',
        countRange: {
          min: parsed.countMin || Math.floor(people * 0.9),
          max: parsed.countMax || Math.ceil(people * 1.1),
        },
        sceneType: parsed.sceneType || 'Public Gathering Space',
        areaCalculationBasis: parsed.areaCalculationBasis || 'Visual scale perspective and architectural reference anchors',
        chokePoints: parsed.chokePoints || [],
        flowDynamics: parsed.flowDynamics || 'Normal crowd distribution',
        explanation: parsed.explanation || `Detected ${people} individuals over ${area} m² yielding a density of ${density} p/m².`,
        recommendations: parsed.recommendations || [
          'Maintain regular visual monitoring of exit corridors.',
          'Ensure ingress and egress routes remain unblocked.',
        ],
        detectedPersons: parsed.detectedPersons || [],
        denseSectors: parsed.denseSectors || [],
        userCalibratedArea: !!userSpecifiedArea,
      });
    } catch (error: any) {
      console.error('Error in analyze-crowd:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze crowd image' });
    }
  });

  // 2. CAPACITY PREDICTOR ENDPOINT
  app.post('/api/gemini/predict-capacity', async (req, res) => {
    try {
      const { base64Image, userSpecifiedArea, spaceTypeContext } = req.body;
      if (!base64Image) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

      const promptText = `Analyze this image of an empty or semi-empty space/venue to predict its safe and maximum capacity according to Fruin's Level of Service (LoS) and international crowd safety standards.
${userSpecifiedArea ? `NOTE: The user has specified a known venue area of ${userSpecifiedArea} m². Use this known measurement to calculate precise safe, warning, and danger capacities.` : 'Calculate the physical ground area from perspective geometry and visual scale indicators.'}
${spaceTypeContext ? `User Notes on Space: ${spaceTypeContext}` : ''}

Strict requirements:
1. Identify architectural features and scale anchors (doors, pillars, floor tiles, roadway lanes, ceiling height, steps).
2. Estimate dimensions (approximate length in meters and width in meters) and walkable net area in square meters (excluding pillars, stage, fixtures).
3. Compute Capacities:
   - Safe Capacity: Fruin LoS A-B (< 2.5 people/m²). Unobstructed movement, standard safe holding capacity.
   - Warning Capacity: Fruin LoS C-D (~3.0 to 4.5 people/m²). Restricted movement, walking speed drops.
   - Danger / Stampede Threshold: Fruin LoS E-F (> 5.5 - 6.0 people/m²). Involuntary contact, high crush risk.
4. Estimate visible exits/egress passages and calculate evacuation throughput (NFPA 101 standard: ~80 people per meter of exit width per minute).
5. Provide actionable event layout and crowd management suggestions.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: cleanBase64,
                },
              },
              {
                text: promptText,
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            'You are a certified Architectural Crowd Safety Specialist and Fire Protection Engineer. Analyze empty venue spaces accurately and provide precise mathematical capacity calculations. Return strictly valid JSON.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              area: {
                type: Type.NUMBER,
                description: 'Total estimated physical ground area in square meters (m²)',
              },
              usableArea: {
                type: Type.NUMBER,
                description: 'Net walkable area excluding permanent fixtures, pillars, barriers in m²',
              },
              spaceType: {
                type: Type.STRING,
                description: 'Typology of space (e.g. Pedestrian Corridor, Exhibition Hall, Open Plaza, Staircase)',
              },
              lengthMeters: {
                type: Type.NUMBER,
                description: 'Estimated visible length in meters',
              },
              widthMeters: {
                type: Type.NUMBER,
                description: 'Estimated visible width in meters',
              },
              scaleAnchors: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Physical visual anchors used for spatial scaling',
              },
              safeCapacity: {
                type: Type.INTEGER,
                description: 'Safe holding capacity (< 2.5 people/m²)',
              },
              warningCapacity: {
                type: Type.INTEGER,
                description: 'Warning capacity (3.0 - 4.5 people/m²)',
              },
              dangerCapacity: {
                type: Type.INTEGER,
                description: 'Danger / crush threshold capacity (> 5.5 people/m²)',
              },
              exitCountEstimate: {
                type: Type.INTEGER,
                description: 'Estimated number of visible exits or egress pathways',
              },
              evacuationThroughputPerMin: {
                type: Type.INTEGER,
                description: 'Calculated evacuation flow rate (people evacuated per minute)',
              },
              evacMinutesSafe: {
                type: Type.NUMBER,
                description: 'Estimated evacuation time for safe capacity in minutes',
              },
              evacMinutesWarning: {
                type: Type.NUMBER,
                description: 'Estimated evacuation time for warning capacity in minutes',
              },
              evacMinutesDanger: {
                type: Type.NUMBER,
                description: 'Estimated evacuation time for danger capacity in minutes',
              },
              explanation: {
                type: Type.STRING,
                description: 'Detailed explainable AI breakdown of how the area, capacity, and evacuation metrics were derived',
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Safety guidelines for space configuration and crowd control',
              },
            },
            required: ['area', 'safeCapacity', 'warningCapacity', 'dangerCapacity', 'explanation'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      let area = parsed.area || (userSpecifiedArea ? parseFloat(userSpecifiedArea) : 250);
      if (userSpecifiedArea && !isNaN(parseFloat(userSpecifiedArea)) && parseFloat(userSpecifiedArea) > 0) {
        area = parseFloat(userSpecifiedArea);
      }
      area = Math.max(1, Math.round(area * 10) / 10);
      const usableArea = parsed.usableArea ? Math.min(area, parsed.usableArea) : Math.round(area * 0.9);

      const safeCapacity = parsed.safeCapacity || Math.floor(usableArea * 2.5);
      const warningCapacity = parsed.warningCapacity || Math.floor(usableArea * 4.5);
      const dangerCapacity = parsed.dangerCapacity || Math.floor(usableArea * 6.0) + 1;

      res.json({
        area,
        usableArea,
        spaceType: parsed.spaceType || 'Event Space / Venue',
        dimensions: {
          lengthMeters: parsed.lengthMeters || Math.round(Math.sqrt(area * 1.5)),
          widthMeters: parsed.widthMeters || Math.round(Math.sqrt(area / 1.5)),
        },
        scaleAnchors: parsed.scaleAnchors || ['Architectural grid', 'Doorway clearances', 'Floor paving'],
        safeCapacity,
        warningCapacity,
        dangerCapacity,
        exitCountEstimate: parsed.exitCountEstimate || 2,
        evacuationThroughputPerMin: parsed.evacuationThroughputPerMin || Math.round((parsed.exitCountEstimate || 2) * 1.5 * 80),
        evacuationTimeMinutes: {
          safe: parsed.evacMinutesSafe || parseFloat((safeCapacity / Math.max(1, (parsed.exitCountEstimate || 2) * 120)).toFixed(1)),
          warning: parsed.evacMinutesWarning || parseFloat((warningCapacity / Math.max(1, (parsed.exitCountEstimate || 2) * 120)).toFixed(1)),
          danger: parsed.evacMinutesDanger || parseFloat((dangerCapacity / Math.max(1, (parsed.exitCountEstimate || 2) * 120)).toFixed(1)),
        },
        explanation: parsed.explanation || `Based on an estimated walkable area of ${area} m², safe capacity is set at ${safeCapacity} people according to Fruin LoS standards.`,
        recommendations: parsed.recommendations || [
          'Designate clear, unobstructed ingress and egress pathways.',
          'Install visible emergency exit signage with emergency lighting.',
          'Maintain crowd flow direction to avoid opposing bottlenecks.',
        ],
      });
    } catch (error: any) {
      console.error('Error in predict-capacity:', error);
      res.status(500).json({ error: error.message || 'Failed to predict capacity' });
    }
  });

  // 3. LIVE FRAME ANALYSIS ENDPOINT (Speed + Precision Optimized)
  app.post('/api/gemini/analyze-live-frame', async (req, res) => {
    try {
      const { base64Frame, monitoredArea = 25 } = req.body;
      if (!base64Frame) {
        return res.status(400).json({ error: 'Frame data is required' });
      }

      const cleanBase64 = base64Frame.replace(/^data:image\/\w+;base64,/, '');

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: cleanBase64,
                },
              },
              {
                text: `You are monitoring a live video feed for stampede prevention.
Monitored Area: ${monitoredArea} m².
1. Accurately count ALL visible people in this frame. Count individual heads carefully.
2. Return normalized bounding boxes [ymin, xmin, ymax, xmax] (0 to 1000) for visible people/heads (up to 35 people).
3. If crowd is dense in certain quadrants, return sector bounding boxes with head count.
4. Calculate density = people / ${monitoredArea} m².
5. Assign risk: SAFE (< 3 p/m²), WARNING (3 - 6 p/m²), DANGER (> 6 p/m²).
6. Give a one-sentence urgent status summary.`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: 'Fast high-accuracy crowd detector for live surveillance. Output strict valid JSON.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              people: {
                type: Type.INTEGER,
                description: 'Accurate count of visible people in frame',
              },
              density: {
                type: Type.NUMBER,
                description: 'People per m²',
              },
              risk: {
                type: Type.STRING,
                description: 'SAFE, WARNING, or DANGER',
              },
              summary: {
                type: Type.STRING,
                description: 'Short real-time situation summary',
              },
              detectedPersons: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    box_2d: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                      description: '[ymin, xmin, ymax, xmax] 0-1000',
                    },
                    label: { type: Type.STRING },
                  },
                },
              },
              denseSectors: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    box_2d: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                    },
                    estimatedPeople: { type: Type.INTEGER },
                    densityPerM2: { type: Type.NUMBER },
                    name: { type: Type.STRING },
                  },
                },
              },
            },
            required: ['people', 'density', 'risk', 'summary'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      const people = Math.max(0, parsed.people ?? 0);
      const area = Math.max(1, parseFloat(monitoredArea) || 25);
      const density = parseFloat((people / area).toFixed(2));
      let risk = 'SAFE';
      if (density > 6) risk = 'DANGER';
      else if (density >= 3) risk = 'WARNING';

      res.json({
        people,
        area,
        density,
        risk,
        summary: parsed.summary || `Live count: ${people} people detected across ${area} m² (${density} p/m²).`,
        detectedPersons: parsed.detectedPersons || [],
        denseSectors: parsed.denseSectors || [],
      });
    } catch (error: any) {
      console.error('Error in analyze-live-frame:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze live frame' });
    }
  });

  // 4. SCENARIO SANDBOX (DIGITAL TWIN) ENDPOINT
  app.post('/api/gemini/simulate-sandbox', async (req, res) => {
    try {
      const { base64Image, inputs } = req.body;
      const cleanBase64 = base64Image ? base64Image.replace(/^data:image\/\w+;base64,/, '') : null;

      const promptText = `Simulate crowd behavior and stampede dynamics for the following scenario:
Expected Attendance: ${inputs.expectedAttendance}
Entrances: ${inputs.entrances}
Exits: ${inputs.exits}
Ambient Temperature: ${inputs.temperature}°C
Noise Level: ${inputs.noiseLevel} dB

Analyze the venue layout in the image:
1. Estimate venue capacity and ground area.
2. Calculate the Stampede Probability Index (SPI, 0 to 100) based on ingress/egress ratios, attendee density, thermal stress (>30°C elevates agitation), and auditory panic (>95 dB hampers instructions).
3. Identify high-risk choke zones and bottlenecks.
4. Provide prioritized preventive interventions.`;

      const contents: any[] = [];
      if (cleanBase64) {
        contents.push({
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64,
              },
            },
            { text: promptText },
          ],
        });
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: promptText }],
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: 'You are a Senior Crowd Dynamics Physicist and Simulation Specialist. Output strict valid JSON.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              spi: {
                type: Type.INTEGER,
                description: 'Stampede Probability Index 0 to 100',
              },
              area: {
                type: Type.NUMBER,
                description: 'Estimated venue area in m²',
              },
              density: {
                type: Type.NUMBER,
                description: 'Predicted crowd density (attendance / area)',
              },
              riskSummary: {
                type: Type.STRING,
                description: 'High-level risk summary',
              },
              riskAreaDescription: {
                type: Type.STRING,
                description: 'Spatial risk analysis of bottlenecks, gates, and crowd surges',
              },
              preventiveSuggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Concrete life-safety preventive interventions',
              },
              denseSectors: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    box_2d: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                    },
                    name: { type: Type.STRING },
                    estimatedPeople: { type: Type.INTEGER },
                    densityPerM2: { type: Type.NUMBER },
                  },
                },
              },
            },
            required: ['spi', 'area', 'density', 'riskSummary', 'riskAreaDescription', 'preventiveSuggestions'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      res.json(parsed);
    } catch (error: any) {
      console.error('Error in simulate-sandbox:', error);
      res.status(500).json({ error: error.message || 'Failed to simulate scenario' });
    }
  });

  // Serve Frontend
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
