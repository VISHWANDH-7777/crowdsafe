
import React, { useState } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CrowdAnalysis } from './components/CrowdAnalysis';
import { CapacityPredictor } from './components/CapacityPredictor';
import { LiveAnalysis } from './components/LiveAnalysis';
import { ScenarioSandbox } from './components/ScenarioSandbox';
import { ImageIcon } from './components/icons/ImageIcon';
import { CalculatorIcon } from './components/icons/CalculatorIcon';
import { CameraIcon } from './components/icons/CameraIcon';
import { SandboxIcon } from './components/icons/SandboxIcon';

type Feature = 'crowd' | 'capacity' | 'sandbox' | 'live';

const TABS: { id: Feature; label: string; icon: React.FC<{className?: string}> }[] = [
    { id: 'crowd', label: 'Crowd Analysis', icon: ImageIcon },
    { id: 'capacity', label: 'Capacity Predictor', icon: CalculatorIcon },
    { id: 'sandbox', label: 'Scenario Sandbox', icon: SandboxIcon },
    { id: 'live', label: 'Live Video', icon: CameraIcon },
];

const App: React.FC = () => {
    const [activeFeature, setActiveFeature] = useState<Feature>('crowd');

    const renderFeature = () => {
        switch (activeFeature) {
            case 'crowd':
                return <CrowdAnalysis />;
            case 'capacity':
                return <CapacityPredictor />;
            case 'sandbox':
                return <ScenarioSandbox />;
            case 'live':
                return <LiveAnalysis />;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <Header />
            <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <div className="flex justify-center border-b border-border-accent overflow-x-auto">
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeFeature === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveFeature(tab.id)}
                                    className={`flex items-center space-x-2 px-3 sm:px-4 py-3 text-sm sm:text-base font-medium border-b-2 transition-colors duration-300 flex-shrink-0 ${
                                        isActive
                                            ? 'border-cta-primary text-cta-primary'
                                            : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-accent'
                                    }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-panel/50 p-6 sm:p-8 rounded-xl shadow-2xl shadow-background/50 border border-border-accent/50">
                   {renderFeature()}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default App;
