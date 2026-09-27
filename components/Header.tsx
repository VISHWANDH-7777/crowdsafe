import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="w-full p-4 border-b border-border-accent/50 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-7xl mx-auto text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cta-primary to-violet-500">
          Crowd-Density Stampede Prevention System
        </h1>
        <p className="text-sm text-text-secondary mt-1">AI-Powered Crowd Safety Analysis</p>
      </div>
    </header>
  );
};