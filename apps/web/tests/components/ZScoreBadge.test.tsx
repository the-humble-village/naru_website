// AI-assisted: see AI-ATTRIBUTION.md
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ZScoreBadge from '@/components/ZScoreBadge';

describe('ZScoreBadge', () => {
  describe('Normal z-score values', () => {
    it.each([
      [-3.5, 'Severe', 'bg-red-100', 'text-red-800'],
      [-2.5, 'Moderate', 'bg-yellow-100', 'text-yellow-900'],
      [-1.5, 'Mild', 'bg-green-100', 'text-green-800'],
      [0.5, 'Normal', 'bg-slate-100', 'text-slate-700'],
      [1.5, 'Above Normal', 'bg-blue-500', 'text-white'],
      [2.5, 'High', 'bg-purple-500', 'text-white'],
    ] as const)('renders %s as %s', (zScore, label, background, foreground) => {
      render(<ZScoreBadge zScore={zScore} />);

      const badge = screen.getByText(new RegExp(`Z-Score: ${label}`));
      expect(badge).toHaveClass(background, foreground);
      expect(screen.getByText(new RegExp(`\\(${zScore.toFixed(2)}\\)`))).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle null z-score', () => {
      render(<ZScoreBadge zScore={null} />);

      expect(screen.getByText('Z-Score: No data')).toBeInTheDocument();
      expect(screen.getByText('Z-Score: No data')).toHaveClass('bg-gray-100', 'text-gray-600');
    });

    it('should handle undefined z-score', () => {
      render(<ZScoreBadge zScore={undefined as any} />);

      expect(screen.getByText('Z-Score: No data')).toBeInTheDocument();
    });

    it('should handle zero z-score', () => {
      render(<ZScoreBadge zScore={0} />);

      expect(screen.getByText(/Z-Score: Normal/)).toBeInTheDocument();
      expect(screen.getByText(/\(0\.00\)/)).toBeInTheDocument();
    });

    it.each([
      [-3, 'Severe'],
      [-2, 'Moderate'],
      [-1, 'Mild'],
      [1, 'Normal'],
      [2, 'Above Normal'],
    ] as const)('classifies the boundary value %s as %s', (zScore, label) => {
      render(<ZScoreBadge zScore={zScore} />);
      expect(screen.getByText(new RegExp(`Z-Score: ${label}`))).toBeInTheDocument();
    });
  });

  describe('Customization options', () => {
    it('should use custom label', () => {
      render(<ZScoreBadge zScore={0.5} label="Weight-for-Age" />);

      expect(screen.getByText(/Weight-for-Age: Normal/)).toBeInTheDocument();
    });

    it('should hide value when showValue is false', () => {
      render(<ZScoreBadge zScore={1.234} showValue={false} />);

      expect(screen.getByText('Z-Score: Above Normal')).toBeInTheDocument();
      expect(screen.queryByText(/\(1\.23\)/)).not.toBeInTheDocument();
    });

    it('should show value with proper precision when showValue is true', () => {
      render(<ZScoreBadge zScore={1.23456} showValue={true} />);

      expect(screen.getByText(/\(1\.23\)/)).toBeInTheDocument();
    });

    it('should combine custom label and hide value', () => {
      render(<ZScoreBadge zScore={-2.1} label="ACFA" showValue={false} />);

      expect(screen.getByText('ACFA: Moderate')).toBeInTheDocument();
      expect(screen.queryByText(/\(-2\.1\)/)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should render as accessible elements', () => {
      render(<ZScoreBadge zScore={-2.5} />);

      const badge = screen.getByText(/Z-Score: Moderate/);
      expect(badge.tagName).toBe('DIV');
      expect(badge).toHaveClass('inline-flex', 'items-center');
    });
  });
});
