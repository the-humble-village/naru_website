import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ExitReason } from '@naru/shared';
import ExitReasonBadge from '../ExitReasonBadge';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

const ALL_REASONS: ExitReason[] = [
  'GRADUATED',
  'WITHDREW',
  'MOVED_AWAY',
  'DIED',
  'TRANSFERRED',
  'AGED_OUT',
  'LOST',
];

describe('ExitReasonBadge', () => {
  it('renders a styled badge for every exit reason', () => {
    ALL_REASONS.forEach((reason) => {
      const { unmount } = render(<ExitReasonBadge reason={reason} />);
      const badge = screen.getByText(`exit_reason.${reason.toLowerCase()}`);
      expect(badge).toHaveClass(
        'inline-flex',
        'items-center',
        'px-3',
        'py-1',
        'rounded-full',
        'text-sm',
        'font-medium'
      );
      unmount();
    });
  });

  it('reads positive for GRADUATED', () => {
    render(<ExitReasonBadge reason="GRADUATED" />);
    expect(screen.getByText('exit_reason.graduated')).toHaveClass('bg-hv-green', 'text-white');
  });

  it('reads sombre rather than alarming for DIED', () => {
    render(<ExitReasonBadge reason="DIED" />);
    const badge = screen.getByText('exit_reason.died');
    expect(badge).toHaveClass('text-hv-crisis');
    expect(badge.className).not.toContain('bg-red-600');
  });

  it('renders the remaining reasons muted', () => {
    (['WITHDREW', 'MOVED_AWAY', 'TRANSFERRED', 'AGED_OUT', 'LOST'] as ExitReason[]).forEach(
      (reason) => {
        const { unmount } = render(<ExitReasonBadge reason={reason} />);
        expect(screen.getByText(`exit_reason.${reason.toLowerCase()}`)).toHaveClass(
          'bg-hv-page',
          'text-hv-gray'
        );
        unmount();
      }
    );
  });
});
