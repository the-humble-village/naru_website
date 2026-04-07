import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ZScoreBadge from '../ZScoreBadge';

describe('ZScoreBadge', () => {
  describe('Normal z-score values', () => {
    it('should render severe classification for z-score <= -3', () => {
      render(<ZScoreBadge zScore={-3.5} />);

      expect(screen.getByText(/Z-Score: Severe/)).toBeInTheDocument();
      expect(screen.getByText(/\(-3\.50\)/)).toBeInTheDocument();
      expect(screen.getByText(/Z-Score: Severe/)).toHaveClass('bg-red-600', 'text-white');
    });

    it('should render moderate classification for z-score between -3 and -2', () => {
      render(<ZScoreBadge zScore={-2.5} />);

      expect(screen.getByText(/Z-Score: Moderate/)).toBeInTheDocument();
      expect(screen.getByText(/\(-2\.50\)/)).toBeInTheDocument();
      expect(screen.getByText(/Z-Score: Moderate/)).toHaveClass('bg-red-400', 'text-white');
    });

    it('should render mild classification for z-score between -2 and -1', () => {
      render(<ZScoreBadge zScore={-1.5} />);

      expect(screen.getByText(/Z-Score: Mild/)).toBeInTheDocument();
      expect(screen.getByText(/\(-1\.50\)/)).toBeInTheDocument();
      expect(screen.getByText(/Z-Score: Mild/)).toHaveClass('bg-yellow-500', 'text-white');
    });

    it('should render normal classification for z-score between -1 and 1', () => {
      render(<ZScoreBadge zScore={0.5} />);

      expect(screen.getByText(/Z-Score: Normal/)).toBeInTheDocument();
      expect(screen.getByText(/\(0\.50\)/)).toBeInTheDocument();
      expect(screen.getByText(/Z-Score: Normal/)).toHaveClass('bg-green-500', 'text-white');
    });

    it('should render above normal classification for z-score between 1 and 2', () => {
      render(<ZScoreBadge zScore={1.5} />);

      expect(screen.getByText(/Z-Score: Above Normal/)).toBeInTheDocument();
      expect(screen.getByText(/\(1\.50\)/)).toBeInTheDocument();
      expect(screen.getByText(/Z-Score: Above Normal/)).toHaveClass('bg-blue-500', 'text-white');
    });

    it('should render high classification for z-score > 2', () => {
      render(<ZScoreBadge zScore={2.5} />);

      expect(screen.getByText(/Z-Score: High/)).toBeInTheDocument();
      expect(screen.getByText(/\(2\.50\)/)).toBeInTheDocument();
      expect(screen.getByText(/Z-Score: High/)).toHaveClass('bg-purple-500', 'text-white');
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

    it('should handle boundary values correctly', () => {
      render(<ZScoreBadge zScore={-3.0} />);
      expect(screen.getByText(/Z-Score: Severe/)).toBeInTheDocument();

      render(<ZScoreBadge zScore={-2.0} />);
      expect(screen.getByText(/Z-Score: Moderate/)).toBeInTheDocument();

      render(<ZScoreBadge zScore={-1.0} />);
      expect(screen.getByText(/Z-Score: Mild/)).toBeInTheDocument();

      render(<ZScoreBadge zScore={1.0} />);
      expect(screen.getByText(/Z-Score: Normal/)).toBeInTheDocument();

      render(<ZScoreBadge zScore={2.0} />);
      expect(screen.getByText(/Z-Score: Above Normal/)).toBeInTheDocument();
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