import React, { useState, useCallback } from 'react';
import { predictCapacity } from '../services/geminiService';
import { CapacityPredictionResult } from '../types';
import { Spinner } from './Spinner';
import { ResultCard } from './ResultCard';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-text-primary">Upload Empty Venue / Road Image</h3>
      <p className="text-text-secondary text-sm mt-1 max-w-sm">
        Provide an image of an empty hall, corridor, road, or courtyard to determine safe capacity
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

export const CapacityPredictor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CapacityPredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Calibration options
  const [useCustomDimensions, setUseCustomDimensions] = useState<boolean>(false);
  const [customArea, setCustomArea] = useState<string>('200');
  const [spaceTypeNote, setSpaceTypeNote] = useState<string>('');

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);
    setError(null);
    const previewUrl = URL.createObjectURL(selectedFile);
    setPreview(previewUrl);
  }, []);

  const handlePredict = async () => {
    if (!file) {
      setError('Please select an image first.');
      return;
    }
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const base64Image = await fileToBase64(file);
      const specifiedArea = useCustomDimensions && parseFloat(customArea) > 0 ? parseFloat(customArea) : undefined;
      const predictionResult = await predictCapacity(base64Image, specifiedArea, spaceTypeNote);
      setResult(predictionResult);
    } catch (err: any) {
      setError(err.message || 'Failed to predict capacity. Please try again.');
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
    setUseCustomDimensions(false);
    setSpaceTypeNote('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* Left Column */}
      <div className="flex flex-col space-y-4">
        {preview ? (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-background ring-2 ring-border-accent shadow-lg">
            <img src={preview} alt="Empty area preview" className="w-full h-full object-cover" />
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-white border border-white/20">
              Architectural Analysis View
            </div>
          </div>
        ) : (
          <ImageUploadPlaceholder onFileSelect={handleFileSelect} />
        )}

        {/* Spatial Dimension Calibration */}
        <div className="p-4 bg-background/50 border border-border-accent/60 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              Venue Calibration (Optional)
            </h4>
            <span className="text-[11px] text-cta-primary font-medium">Calibrated Fruin LoS</span>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="calibrateCapacityArea"
              checked={useCustomDimensions}
              onChange={(e) => setUseCustomDimensions(e.target.checked)}
              className="rounded bg-panel border-border-accent text-cta-primary focus:ring-cta-primary"
            />
            <label htmlFor="calibrateCapacityArea" className="text-xs text-text-primary cursor-pointer select-none">
              Override with known floor area (m²)
            </label>
          </div>

          {useCustomDimensions && (
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
                    placeholder="e.g. 200"
                  />
                  <span className="absolute right-3 top-2 text-xs text-text-secondary font-mono">m²</span>
                </div>
              </div>
              <div className="flex gap-1.5 pt-5">
                {[100, 250, 600].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCustomArea(val.toString())}
                    className="px-2 py-1 bg-panel text-[11px] rounded text-text-secondary hover:text-text-primary border border-border-accent/40"
                  >
                    {val}m²
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] text-text-secondary block mb-1">Space Typology / Architectural Notes:</label>
            <input
              type="text"
              value={spaceTypeNote}
              onChange={(e) => setSpaceTypeNote(e.target.value)}
              placeholder="e.g. Enclosed indoor hall, Pedestrian thoroughfare, Stairway..."
              className="w-full bg-background border border-border-accent rounded-lg px-3 py-1.5 text-xs text-text-primary focus:ring-1 focus:ring-cta-primary"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handlePredict}
            disabled={!file || isLoading}
            className="flex-grow bg-cta-primary text-white font-bold py-3 px-4 rounded-xl hover:bg-cta-hover disabled:bg-border-accent disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <span>Calculating Architectural Capacity...</span>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>Predict Safe Capacity</span>
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

      {/* Right Column */}
      <div className="w-full">
        {isLoading && <Spinner text="Measuring floor footprint, exit widths, and Fruin LoS capacity..." />}
        {result && <ResultCard result={result} mode="capacity" />}
        {!isLoading && !result && (
          <div className="p-8 rounded-xl border-2 border-dashed border-border-accent text-center h-full min-h-[350px] flex flex-col justify-center items-center bg-panel/20">
            <div className="w-12 h-12 rounded-full bg-border-accent/40 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text-primary">Awaiting Venue Image</h3>
            <p className="text-xs text-text-secondary mt-1 max-w-sm">
              Upload an image of an empty space to calculate net walkable area, architectural scale anchors, safe and emergency limits, and evacuation throughput.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
