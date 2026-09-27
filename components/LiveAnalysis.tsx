import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeLiveFrame, resetLiveStabilization } from '../services/geminiService';
import { CrowdAnalysisResult, RiskLevel } from '../types';
import { ResultCard } from './ResultCard';
import { RISK_LEVELS } from '../constants';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const videoFrameToBase64 = (videoElement: HTMLVideoElement): string => {
  const canvas = document.createElement('canvas');
  // Scale down slightly if 1080p+ to ensure fast upload and low latency
  const targetWidth = Math.min(800, videoElement.videoWidth || 640);
  const targetHeight = Math.round((targetWidth / (videoElement.videoWidth || 640)) * (videoElement.videoHeight || 480));
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(videoElement, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  }
  return '';
};

export const LiveAnalysis: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<number | null>(null);
  const isAnalyzingRef = useRef<boolean>(false);

  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [result, setResult] = useState<CrowdAnalysisResult | null>(null);
  const [densityHistory, setDensityHistory] = useState<{ time: number; density: number; people: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingFrame, setIsProcessingFrame] = useState<boolean>(false);

  // Monitored area calibration
  const [monitoredArea, setMonitoredArea] = useState<number>(25);
  const [showOverlays, setShowOverlays] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);

  const stopStreaming = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setIsProcessingFrame(false);
    isAnalyzingRef.current = false;
    resetLiveStabilization();
  }, []);

  const processCurrentFrame = useCallback(async () => {
    if (!videoRef.current || videoRef.current.readyState < 2 || isAnalyzingRef.current) {
      return;
    }

    try {
      isAnalyzingRef.current = true;
      setIsProcessingFrame(true);
      const base64Frame = videoFrameToBase64(videoRef.current);
      if (base64Frame) {
        const analysisResult = await analyzeLiveFrame(base64Frame, monitoredArea);
        setResult(analysisResult);

        const now = Date.now();
        setDensityHistory((prev) => {
          const newHistory = [
            ...prev,
            { time: now, density: analysisResult.density, people: analysisResult.people },
          ];
          // Keep past 90 seconds
          return newHistory.filter((pt) => now - pt.time <= 90000);
        });
      }
    } catch (err: any) {
      console.error('Frame analysis error:', err);
      // Keep going if transient network jitter
    } finally {
      isAnalyzingRef.current = false;
      setIsProcessingFrame(false);
    }
  }, [monitoredArea]);

  const startStreaming = async () => {
    setError(null);
    setResult(null);
    setDensityHistory([]);
    resetLiveStabilization();

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsStreaming(true);

          // Initial frame after video starts playing
          setTimeout(() => {
            processCurrentFrame();
          }, 800);

          // Periodic analysis every 2.5 seconds
          intervalRef.current = window.setInterval(() => {
            processCurrentFrame();
          }, 2500);
        }
      } catch (err: any) {
        console.error('Error accessing camera:', err);
        setError('Could not access camera. Please ensure camera permissions are granted in your browser.');
        setIsStreaming(false);
      }
    } else {
      setError('Your browser does not support camera media devices.');
    }
  };

  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  const riskInfo = result ? RISK_LEVELS[result.risk] : RISK_LEVELS[RiskLevel.NONE];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* Left Column: Video Feed & Live Controls */}
      <div className="flex flex-col space-y-4">
        {/* Monitored Area Calibration Bar */}
        <div className="p-3 bg-panel/70 border border-border-accent/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-text-secondary font-medium">Monitored Zone Area:</span>
            <span className="font-mono font-bold text-text-primary ml-1.5">{monitoredArea} m²</span>
          </div>

          <div className="flex items-center space-x-1.5">
            {[15, 25, 50, 100].map((areaVal) => (
              <button
                key={areaVal}
                onClick={() => setMonitoredArea(areaVal)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  monitoredArea === areaVal
                    ? 'bg-cta-primary text-white font-bold'
                    : 'bg-background text-text-secondary hover:text-text-primary'
                }`}
              >
                {areaVal}m²
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowOverlays(!showOverlays)}
              className={`px-2 py-0.5 rounded text-[11px] border ${
                showOverlays ? 'border-safe text-safe bg-safe/10' : 'border-border-accent text-text-secondary'
              }`}
            >
              Boxes {showOverlays ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`px-2 py-0.5 rounded text-[11px] border ${
                showHeatmap ? 'border-cta-primary text-cta-primary bg-cta-primary/10' : 'border-border-accent text-text-secondary'
              }`}
            >
              Heatmap {showHeatmap ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Video Canvas Container */}
        <div
          className={`relative w-full aspect-video rounded-xl overflow-hidden bg-black transition-all duration-300 ring-2 ${
            isStreaming ? riskInfo.borderColor : 'ring-border-accent'
          } shadow-2xl`}
        >
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

          {/* Genuine Real-time KDE Heatmap Overlay */}
          {isStreaming && showHeatmap && result?.heatmapOverlay && (
            <img
              src={`data:image/png;base64,${result.heatmapOverlay}`}
              alt="Live crowd heatmap"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-60 transition-opacity"
            />
          )}

          {/* Real Detected People Bounding Boxes & Head Markers */}
          {isStreaming && showOverlays && result?.detectedPersons && result.detectedPersons.length > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              {result.detectedPersons.map((p, idx) => {
                if (!p.box_2d || p.box_2d.length < 4) return null;
                const [ymin, xmin, ymax, xmax] = p.box_2d;
                return (
                  <div
                    key={idx}
                    style={{
                      top: `${ymin / 10}%`,
                      left: `${xmin / 10}%`,
                      width: `${Math.max(2, (xmax - xmin) / 10)}%`,
                      height: `${Math.max(2, (ymax - ymin) / 10)}%`,
                    }}
                    className="absolute border-2 border-safe bg-safe/20 rounded-sm shadow-md"
                  >
                    <span className="absolute -top-3.5 left-0 text-[8px] font-mono bg-black/80 text-safe px-1 rounded border border-safe/50">
                      #{idx + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Processing Indicator Badge */}
          {isStreaming && (
            <div className="absolute top-3 left-3 flex items-center space-x-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-xs">
              <span className={`w-2.5 h-2.5 rounded-full ${isProcessingFrame ? 'bg-warning animate-ping' : 'bg-safe'}`} />
              <span className="font-mono text-white">
                {isProcessingFrame ? 'Scanning Frame...' : 'Surveillance Active'}
              </span>
            </div>
          )}

          {/* Non-streaming Placeholder */}
          {!isStreaming && (
            <div className="absolute inset-0 flex flex-col justify-center items-center bg-black/70 p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-border-accent/40 flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">Live Camera Standby</h3>
              <p className="text-text-secondary text-xs mt-1 max-w-sm">
                Activate camera to execute high-frequency person detection, temporal count stabilization, and real-time crush alerts.
              </p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex space-x-3">
          <button
            onClick={isStreaming ? stopStreaming : startStreaming}
            className={`flex-grow font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg text-white flex items-center justify-center space-x-2 ${
              isStreaming
                ? 'bg-danger hover:bg-danger/80'
                : 'bg-safe hover:bg-safe/80'
            }`}
          >
            {isStreaming ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                <span>Stop Surveillance</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Start Live Camera</span>
              </>
            )}
          </button>

          {isStreaming && (
            <button
              onClick={processCurrentFrame}
              disabled={isProcessingFrame}
              title="Snap & analyze immediate frame"
              className="bg-panel hover:bg-border-accent text-text-primary px-4 py-3.5 rounded-xl border border-border-accent transition-colors flex items-center space-x-1.5"
            >
              <svg className="w-5 h-5 text-cta-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs font-semibold">Snap Now</span>
            </button>
          )}
        </div>
        {error && <p className="text-error text-center text-xs bg-error/10 p-2.5 rounded-lg border border-error/30">{error}</p>}
      </div>

      {/* Right Column: Live Result Cards & Historical Trend */}
      <div className="w-full space-y-6">
        {isStreaming && !result && (
          <div className="p-8 rounded-xl border-2 border-dashed border-border-accent text-center h-full min-h-[300px] flex flex-col justify-center items-center animate-pulse bg-panel/30">
            <h3 className="text-base font-semibold text-text-secondary">Analyzing First Live Frame...</h3>
            <p className="text-xs text-text-secondary mt-1">Calibrating detector to field of view.</p>
          </div>
        )}

        {result && <ResultCard result={result} mode="live" />}

        {/* Live Density Trend Chart */}
        {isStreaming && densityHistory.length > 1 && (
          <div className="p-4 rounded-xl bg-panel/60 border border-border-accent shadow-lg">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Real-Time Density & Headcount Trend
              </h4>
              <span className="text-[11px] font-mono text-safe">
                Latest: {result?.people} ppl ({result?.density} p/m²)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={densityHistory} margin={{ top: 5, right: 15, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(unixTime) =>
                    new Date(unixTime).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })
                  }
                  stroke="#94A3B8"
                  tick={{ fontSize: 10 }}
                />
                <YAxis stroke="#94A3B8" domain={[0, 'dataMax + 2']} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString()}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Line
                  type="monotone"
                  dataKey="density"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                  name="Density (p/m²)"
                />
                <Line
                  type="monotone"
                  dataKey="people"
                  stroke="#22C55E"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  name="People Count"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {!isStreaming && !result && (
          <div className="p-8 rounded-xl border-2 border-dashed border-border-accent text-center h-full min-h-[300px] flex flex-col justify-center items-center bg-panel/20">
            <div className="w-12 h-12 rounded-full bg-border-accent/40 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text-primary">Live Monitoring Station Ready</h3>
            <p className="text-xs text-text-secondary mt-1 max-w-sm">
              Point your camera at a corridor, gateway, or hall. AI will continuously track crowd fluctuations, count stabilization, and density surges.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
