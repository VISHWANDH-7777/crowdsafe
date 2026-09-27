import { RiskLevel } from './types';

interface RiskLevelInfo {
  label: string;
  color: string;
  textColor: string;
  borderColor: string;
  threshold: number;
  description: string;
}

export const RISK_LEVELS: Record<RiskLevel, RiskLevelInfo> = {
  [RiskLevel.NONE]: {
    label: 'N/A',
    color: 'bg-panel',
    textColor: 'text-text-secondary',
    borderColor: 'border-border-accent',
    threshold: 0,
    description: 'No analysis performed yet.'
  },
  [RiskLevel.SAFE]: {
    label: 'Safe',
    color: 'bg-safe',
    textColor: 'text-safe',
    borderColor: 'border-safe',
    threshold: 3,
    description: 'Low crowd density.'
  },
  [RiskLevel.WARNING]: {
    label: 'Warning',
    color: 'bg-warning',
    textColor: 'text-warning',
    borderColor: 'border-warning',
    threshold: 6,
    description: 'Moderate density. Monitor situation.'
  },
  [RiskLevel.DANGER]: {
    label: 'Danger',
    color: 'bg-danger',
    textColor: 'text-danger',
    borderColor: 'border-danger',
    threshold: Infinity,
    description: 'High risk of crowd crush. Immediate action required.'
  },
};