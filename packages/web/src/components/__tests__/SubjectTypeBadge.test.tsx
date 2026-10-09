import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { SubjectType } from '@naru/shared';
import SubjectTypeBadge from '../SubjectTypeBadge';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

const ALL_TYPES: SubjectType[] = ['MOTHER', 'CHILD', 'PERSON', 'FAMILY'];

describe('SubjectTypeBadge', () => {
  it('renders a small chip for every subject type', () => {
    ALL_TYPES.forEach((type) => {
      const { unmount } = render(<SubjectTypeBadge type={type} />);
      const chip = screen.getByText(`subject_type.${type.toLowerCase()}`);
      expect(chip).toHaveClass('px-2', 'py-1', 'rounded-full', 'text-xs');
      unmount();
    });
  });

  it('gives each type its own colour', () => {
    const tones: Record<SubjectType, string> = {
      MOTHER: 'bg-hv-terracotta',
      CHILD: 'bg-hv-accent',
      PERSON: 'bg-hv-sage',
      FAMILY: 'bg-hv-green',
    };

    ALL_TYPES.forEach((type) => {
      const { unmount } = render(<SubjectTypeBadge type={type} />);
      expect(screen.getByText(`subject_type.${type.toLowerCase()}`)).toHaveClass(
        tones[type],
        'text-white'
      );
      unmount();
    });
  });
});
