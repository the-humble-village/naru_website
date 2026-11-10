import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguagePage } from '../LanguagePage';

// Mock the auth store
const mockSetLanguage = vi.fn();
const mockUseAuthStore = vi.fn();

vi.mock('../../store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

// LanguagePage persists the choice through PATCH /users/me/language.
vi.mock('../../api/users', () => ({
  usersApi: {
    updateLanguage: vi.fn(),
  },
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguagePage />
    </QueryClientProvider>
  );
};

// Mock the translation hook
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'lang.title': 'Language Settings',
        'lang.label': 'Select Language',
        'lang.english': 'English',
        'lang.spanish': 'Spanish',
        'lang.button': 'Save',
        'lang.saved': 'Saved!',
      };
      return translations[key] ?? key;
    },
    lang: 'en',
  }),
}));

describe('LanguagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      lang: 'en',
      setLanguage: mockSetLanguage,
      user: {
        id: 1,
        login: 'testuser',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'CASEWORKER' as const,
        lang: 'en',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        localId: null,
      },
    });
  });

  it('should render the page heading', () => {
    renderPage();
    expect(screen.getByText('Language Settings')).toBeInTheDocument();
  });

  it('should render radio buttons for English and Spanish', () => {
    renderPage();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Spanish')).toBeInTheDocument();
  });

  it('should have English selected by default when lang is en', () => {
    renderPage();
    const enRadio = screen.getByDisplayValue('en');
    const esRadio = screen.getByDisplayValue('es');
    expect(enRadio).toBeChecked();
    expect(esRadio).not.toBeChecked();
  });

  it('should have save button disabled when no language change is made', () => {
    renderPage();
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();
  });

  it('should enable save button when a different language is selected', () => {
    renderPage();
    const esRadio = screen.getByDisplayValue('es');
    fireEvent.click(esRadio);

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeEnabled();
  });
});
