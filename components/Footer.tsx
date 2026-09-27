import React from 'react';
import { RISK_LEVELS } from '../constants';
import { RiskLevel } from '../types';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full p-6 mt-12 border-t border-border-accent/50">
      <div className="max-w-7xl mx-auto">
        <h3 className="text-center text-lg font-semibold mb-4 text-text-primary">Risk Level Thresholds</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-lg bg-safe/10 border border-safe/30">
            <h4 className="font-bold text-safe">{RISK_LEVELS[RiskLevel.SAFE].label}</h4>
            <p className="text-sm text-text-primary">&lt; 3 people / m²</p>
          </div>
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
            <h4 className="font-bold text-warning">{RISK_LEVELS[RiskLevel.WARNING].label}</h4>
            <p className="text-sm text-text-primary">3-6 people / m²</p>
          </div>
          <div className="p-4 rounded-lg bg-danger/10 border border-danger/30">
            <h4 className="font-bold text-danger">{RISK_LEVELS[RiskLevel.DANGER].label}</h4>
            <p className="text-sm text-text-primary">&gt; 6 people / m²</p>
          </div>
        </div>
      </div>
    </footer>
  );
};