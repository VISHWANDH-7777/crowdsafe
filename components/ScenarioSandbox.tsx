
import React, { useState, useCallback } from 'react';
import { runCrowdSimulation } from '../services/geminiService';
import { DigitalTwinResult, ScenarioInputs } from '../types';
import { Spinner } from './Spinner';
import { InteractiveHeatmap } from './InteractiveHeatmap';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // remove the "data:image/jpeg;base64," part
    };
    reader.onerror = error => reject(error);
  });
};

const ImageUploadPlaceholder: React.FC<{ onFileSelect: (file: File) => void }> = ({ onFileSelect }) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
        }
    };

    return (
        <div className="relative w-full h-full min-h-[300px] border-2 border-dashed border-border-accent rounded-lg flex flex-col justify-center items-center text-center p-6 hover:border-cta-primary transition-colors duration-300">
             <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-text-secondary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9.75l-9-5.25m9 5.25v9.75" />
            </svg>
            <h3 className="text-xl font-semibold text-text-primary">Upload Area Image</h3>
            <p className="text-text-secondary mt-1">Provide an image for the simulation</p>
            <input
                type="file"
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileChange}
            />
        </div>
    );
};

const SliderInput: React.FC<{
    label: string;
    id: keyof ScenarioInputs;
    min: number;
    max: number;
    step: number;
    value: number;
    unit: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    tooltip: string;
}> = ({ label, id, min, max, step, value, unit, onChange, tooltip }) => (
    <div title={tooltip}>
        <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
        <div className="flex items-center space-x-4">
            <input
                id={id}
                name={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={onChange}
                className="w-full h-2 bg-border-accent rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm font-semibold text-text-primary w-20 text-right">{value}{unit}</span>
        </div>
    </div>
);


export const ScenarioSandbox: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<DigitalTwinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<ScenarioInputs>({
    expectedAttendance: 10000,
    entrances: 4,
    exits: 4,
    temperature: 22,
    noiseLevel: 90,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setInputs(prev => ({...prev, [name]: Number(value) }));
  };

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);
    setError(null);
    const previewUrl = URL.createObjectURL(selectedFile);
    setPreview(previewUrl);
  }, []);

  const handleRunSimulation = async () => {
    if (!file) {
      setError("Please select an image for the simulation area.");
      return;
    }
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const base64Image = await fileToBase64(file);
      const simulationResult = await runCrowdSimulation(base64Image, inputs);
      setResult(simulationResult);
    // FIX: Added curly braces to the catch block to fix syntax error.
    } catch (err) {
      setError("Failed to run simulation. Please try again.");
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
    setInputs({
        expectedAttendance: 10000,
        entrances: 4,
        exits: 4,
        temperature: 22,
        noiseLevel: 90,
    });
  };
  
  const getSpiColor = (spi: number) => {
    if (spi > 75) return 'text-danger';
    if (spi > 50) return 'text-orange-500';
    if (spi > 25) return 'text-warning';
    return 'text-safe';
  };
  const getSpiRingColor = (spi: number) => {
    if (spi > 75) return 'ring-danger';
    if (spi > 50) return 'ring-orange-500';
    if (spi > 25) return 'ring-warning';
    return 'ring-safe';
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* LEFT COLUMN - INPUTS */}
      <div className="flex flex-col space-y-6">
        {preview ? (
            <InteractiveHeatmap
                baseImageSrc={preview}
                heatmapSrc={result?.heatmapOverlay ? `data:image/png;base64,${result.heatmapOverlay}` : null}
                baseDensity={result?.density}
            />
        ) : (
            <ImageUploadPlaceholder onFileSelect={handleFileSelect} />
        )}
        
        {result?.heatmapOverlay && !isLoading && (
            <div className="text-center text-xs text-text-secondary -mt-4">
                Hover over the image for localized risk insights.
            </div>
        )}

        <div className="p-4 rounded-lg bg-background/50 border border-border-accent/50 space-y-4">
            <h3 className="text-lg font-semibold text-text-primary border-b border-border-accent pb-2">Simulation Parameters</h3>
            <fieldset className="space-y-3">
                <legend className="sr-only">Event Details</legend>
                 <div>
                    <label htmlFor="expectedAttendance" className="block text-sm font-medium text-text-secondary">Expected Attendance</label>
                    <input type="number" name="expectedAttendance" id="expectedAttendance" value={inputs.expectedAttendance} onChange={handleInputChange} min="1" max="1000000" className="mt-1 block w-full bg-background/70 border border-border-accent rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cta-primary focus:border-cta-primary sm:text-sm"/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label htmlFor="entrances" className="block text-sm font-medium text-text-secondary">Entrances</label>
                        <input type="number" name="entrances" id="entrances" value={inputs.entrances} onChange={handleInputChange} min="1" max="100" className="mt-1 block w-full bg-background/70 border border-border-accent rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cta-primary focus:border-cta-primary sm:text-sm"/>
                    </div>
                     <div>
                        <label htmlFor="exits" className="block text-sm font-medium text-text-secondary">Exits</label>
                        <input type="number" name="exits" id="exits" value={inputs.exits} onChange={handleInputChange} min="1" max="100" className="mt-1 block w-full bg-background/70 border border-border-accent rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cta-primary focus:border-cta-primary sm:text-sm"/>
                    </div>
                </div>
            </fieldset>
             <fieldset className="space-y-3 pt-4 border-t border-border-accent">
                <legend className="text-sm font-medium text-text-secondary">Environmental Factors</legend>
                <SliderInput 
                    label="Temperature" 
                    id="temperature" 
                    min={0} 
                    max={50} 
                    step={1} 
                    value={inputs.temperature} 
                    unit="°C" 
                    onChange={handleInputChange} 
                    tooltip="Higher temperatures can increase crowd discomfort and agitation, slightly raising the Stampede Probability Index (SPI)."
                />
                <SliderInput 
                    label="Noise Level" 
                    id="noiseLevel" 
                    min={40} 
                    max={120} 
                    step={1} 
                    value={inputs.noiseLevel} 
                    unit=" dB" 
                    onChange={handleInputChange} 
                    tooltip="High noise levels can cause confusion and stress, slightly increasing the Stampede Probability Index (SPI)."
                />
            </fieldset>
        </div>
        
        <div className="flex space-x-4">
            <button
                onClick={handleRunSimulation}
                disabled={!file || isLoading}
                className="flex-grow bg-cta-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-cta-hover disabled:bg-border-accent disabled:cursor-not-allowed transition-colors duration-300"
            >
                {isLoading ? 'Simulating...' : 'Run Simulation'}
            </button>
            <button
                onClick={handleReset}
                className="bg-panel text-text-primary font-bold py-3 px-4 rounded-lg hover:bg-border-accent transition-colors duration-300"
            >
                Reset
            </button>
        </div>
        {error && <p className="text-error text-center">{error}</p>}
      </div>
      
      {/* RIGHT COLUMN - RESULTS */}
      <div className="w-full">
        {isLoading && <Spinner text="Running crowd behavior simulation..." />}
        {result && !isLoading && (
            <div className="space-y-6">
                <div className={`p-6 rounded-lg bg-panel/50 border ${getSpiRingColor(result.spi)}/50`}>
                    <div className="text-center">
                        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Stampede Probability Index (SPI)</h3>
                         <div className={`my-4 w-40 h-40 mx-auto rounded-full flex items-center justify-center ring-4 ${getSpiRingColor(result.spi)} bg-background`}>
                            <p className={`text-5xl font-bold ${getSpiColor(result.spi)}`}>{result.spi}<span className="text-3xl">%</span></p>
                        </div>
                        <p className="font-semibold text-text-primary text-lg">{result.riskSummary}</p>
                    </div>
                </div>

                <div className="p-6 rounded-lg bg-panel/50 border border-border-accent/50">
                    <h3 className="text-base font-semibold text-text-secondary uppercase tracking-wider mb-3">Risk Area Analysis</h3>
                    <p className="text-text-primary/90 leading-relaxed">{result.riskAreaDescription}</p>
                </div>

                 <div className="p-6 rounded-lg bg-panel/50 border border-border-accent/50">
                    <h3 className="text-base font-semibold text-text-secondary uppercase tracking-wider mb-4">Preventive Suggestions</h3>
                    <ul className="space-y-3">
                        {result.preventiveSuggestions.map((suggestion, index) => (
                             <li key={index} className="flex items-start space-x-3">
                                <svg className="w-5 h-5 text-cta-primary flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-text-primary/90">{suggestion}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        )}
        {!isLoading && !result && (
            <div className="p-6 rounded-lg border-2 border-dashed border-border-accent text-center h-full flex flex-col justify-center">
                <h3 className="text-lg font-semibold text-text-secondary">Simulation results will appear here.</h3>
                <p className="text-sm text-text-secondary">Configure your scenario and click "Run Simulation".</p>
            </div>
        )}
      </div>
    </div>
  );
};