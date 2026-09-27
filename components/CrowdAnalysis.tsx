import React, { useState, useCallback } from 'react';
import { analyzeCrowdImage } from '../services/geminiService';
import { CrowdAnalysisResult } from '../types';
import { Spinner } from './Spinner';
import { ResultCard } from './ResultCard';
import { InteractiveHeatmap } from './InteractiveHeatmap';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // remove the data:image/... prefix
    };
    reader.onerror = (error) => reject(error);
  });
};

const ImageUploadPlaceholder: React.FC<{ onFileSelect: (file: File) => void }> = ({ onFileSelect }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[300px] border-2 border-dashed border-border-accent rounded-xl flex flex-col justify-center items-center text-center p-6 hover:border-cta-primary bg-panel/30 transition-all duration-300">
      <div className="w-16 h-16 rounded-full bg-cta-primary/10 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-cta-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-text-primary">Upload Crowd Image</h3>
      <p className="text-text-secondary text-sm mt-1 max-w-sm">
        Drag & drop or click to upload a photo of a gathering, festival, concourse, or street
      </p>
      <input
        type="file"
        accept="image/*"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={handleFileChange}
      />
    </div>
  );
};

export const CrowdAnalysis: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CrowdAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Area calibration state
  const [useCustomArea, setUseCustomArea] = useState<boolean>(false);
  const [customArea, setCustomArea] = useState<string>('100');
  const [venueContext, setVenueContext] = useState<string>('');

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);
    setError(null);
    const previewUrl = URL.createObjectURL(selectedFile);
    setPreview(previewUrl);
  }, []);

  const handleAnalyze = async () => {
    if (!file) {
      setError('Please select an image first.');
      return;
    }
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const base64Image = await fileToBase64(file);
      const specifiedArea = useCustomArea && parseFloat(customArea) > 0 ? parseFloat(customArea) : undefined;
      const analysisResult = await analyzeCrowdImage(base64Image, specifiedArea, venueContext);
      setResult(analysisResult);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze crowd image. Please ensure server has API access.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setUseCustomArea(false);
    setVenueContext('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* Left Column: Image & Calibration Controls */}
      <div className="flex flex-col space-y-4">
        {preview ? (
          <InteractiveHeatmap
            baseImageSrc={preview}
            heatmapSrc={result?.heatmapOverlay ? `data:image/png;base64,${result.heatmapOverlay}` : null}
            baseDensity={result?.density}
            detectedPersons={result?.detectedPersons}
            denseSectors={result?.denseSectors}
            totalPeople={result?.people}
          />
        ) : (
          <ImageUploadPlaceholder onFileSelect={handleFileSelect} />
        )}

        {/* Calibration & Context Accordion */}
        <div className="p-4 bg-background/50 border border-border-accent/60 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              Spatial Calibration & Context
            </h4>
            <span className="text-[11px] text-cta-primary font-medium">Increases Count & Density Precision</span>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="calibrateArea"
              checked={useCustomArea}
              onChange={(e) => setUseCustomArea(e.target.checked)}
              className="rounded bg-panel border-border-accent text-cta-primary focus:ring-cta-primary"
            />
            <label htmlFor="calibrateArea" className="text-xs text-text-primary cursor-pointer select-none">
              Calibrate with known venue ground area (m²)
            </label>
          </div>

          {useCustomArea && (
            <div className="flex items-center space-x-3 pt-1">
              <div className="flex-1">
                <label className="text-[11px] text-text-secondary block mb-1">Known Area (Square Meters):</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    value={customArea}
                    onChange={(e) => setCustomArea(e.target.value)}
                    className="w-full bg-background border border-border-accent rounded-lg px-3 py-1.5 text-sm font-mono text-text-primary focus:ring-1 focus:ring-cta-primary"
                    placeholder="e.g. 150"
                  />
                  <span className="absolute right-3 top-2 text-xs text-text-secondary font-mono">m²</span>
                </div>
              </div>
              <div className="flex gap-1.5 pt-5">
                {[50, 150, 500].map((areaVal) => (
                  <button
                    key={areaVal}
                    type="button"
                    onClick={() => setCustomArea(areaVal.toString())}
                    className="px-2 py-1 bg-panel text-[11px] rounded text-text-secondary hover:text-text-primary border border-border-accent/40"
                  >
                    {areaVal}m²
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] text-text-secondary block mb-1">Optional Venue Type / Location Note:</label>
            <input
              type="text"
              value={venueContext}
              onChange={(e) => setVenueContext(e.target.value)}
              placeholder="e.g. Metro exit stairs, Outdoor concert stage, Temple corridor..."
              className="w-full bg-background border border-border-accent rounded-lg px-3 py-1.5 text-xs text-text-primary focus:ring-1 focus:ring-cta-primary"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handleAnalyze}
            disabled={!file || isLoading}
            className="flex-grow bg-cta-primary text-white font-bold py-3 px-4 rounded-xl hover:bg-cta-hover disabled:bg-border-accent disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <span>Analyzing People & Density...</span>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>Analyze Crowd</span>
              </>
            )}
          </button>
          {preview && (
            <button
              onClick={handleReset}
              className="bg-panel text-text-primary font-bold py-3 px-5 rounded-xl hover:bg-border-accent transition-colors border border-border-accent"
            >
              Reset
            </button>
          )}
        </div>
        {error && <p className="text-error text-center text-xs bg-error/10 p-2.5 rounded-lg border border-error/30">{error}</p>}
      </div>

      {/* Right Column: Results */}
      <div className="w-full">
        {isLoading && <Spinner text="Detecting individuals, computing area scale, and mapping density..." />}
        {result && <ResultCard result={result} mode="crowd" />}
        {!isLoading && !result && (
          <div className="p-8 rounded-xl border-2 border-dashed border-border-accent text-center h-full min-h-[350px] flex flex-col justify-center items-center bg-panel/20">
            <div className="w-12 h-12 rounded-full bg-border-accent/40 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text-primary">Precision Crowd Analysis Awaiting Image</h3>
            <p className="text-xs text-text-secondary mt-1 max-w-sm">
              Upload an image to perform deep individual head counting, spatial area scaling, Fruin LoS density scoring, and choke point detection.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
