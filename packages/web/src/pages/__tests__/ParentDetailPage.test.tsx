import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ParentDetailPage from '../parents/ParentDetailPage';
import { parentsApi } from '../../api/parents';
import { ParentRead } from '@naru/shared';

// Mock the API module
vi.mock('../../api/parents', () => ({
  parentsApi: {
    fetchParent: vi.fn(),
    updateParent: vi.fn(),
  },
}));

const mockParent: ParentRead = {
  id: 1,
  localId: null,
  familyId: 123,
  name: 'Maria Rodriguez',
  role: 'mother',
  birthDate: '1985-03-15T00:00:00.000Z',
  dateEntered: '2024-01-10T00:00:00.000Z',
  photoId: null,
  reasonEnroll: 'Expecting second child',
  dueDate: '2024-09-15T00:00:00.000Z',
  notes: 'Attends all appointments regularly',
  createdAt: '2024-01-10T12:00:00.000Z',
  updatedAt: '2024-01-15T14:30:00.000Z',
};

const renderWithProviders = (component: React.ReactElement = <ParentDetailPage />, initialPath = '/families/123/parents/1') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/families/:id/parents/:pid" element={component} />
          <Route path="/families/invalid/parents/invalid" element={component} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ParentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading and Error States', () => {
    it('should show loading state while fetching parent data', () => {
      vi.mocked(parentsApi.fetchParent).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithProviders();

      expect(screen.getByText('Loading parent details...')).toBeInTheDocument();
    });

    it('should show error state when API call fails', async () => {
      vi.mocked(parentsApi.fetchParent).mockRejectedValue(new Error('Failed to fetch parent'));

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch parent')).toBeInTheDocument();
      });
    });

    it('should show error for invalid parameters', () => {
      renderWithProviders(undefined, '/families/invalid/parents/invalid');

      expect(screen.getByText('Invalid family or parent ID provided.')).toBeInTheDocument();
    });

    it('should show not found message when parent is not found', async () => {
      vi.mocked(parentsApi.fetchParent).mockResolvedValue(null as any);

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Parent not found.')).toBeInTheDocument();
      });
    });
  });

  describe('Parent Information Display', () => {
    beforeEach(() => {
      vi.mocked(parentsApi.fetchParent).mockResolvedValue(mockParent);
    });

    it('should render parent details successfully', async () => {
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Maria Rodriguez' })).toBeInTheDocument();
      });

      expect(screen.getByText('← Back to Family')).toBeInTheDocument();
      expect(screen.getByText('Parent Information')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();

      // Check parent details
      expect(screen.getByText('Mother')).toBeInTheDocument(); // Capitalized role
      expect(screen.getByText(/3\/1[45]\/1985/)).toBeInTheDocument(); // Birth date formatted (could be 14 or 15 depending on timezone)
      // Find the Date Entered Program label and check its sibling paragraph
      const dateEnteredLabel = screen.getByText('Date Entered Program');
      const dateEnteredSection = dateEnteredLabel.parentElement;
      expect(dateEnteredSection).toHaveTextContent(/1\/1?[09]\/2024/);
      expect(screen.getByText(/9\/1[45]\/2024/)).toBeInTheDocument(); // Due date formatted
      expect(screen.getByText('Expecting second child')).toBeInTheDocument();
      expect(screen.getByText('Attends all appointments regularly')).toBeInTheDocument();
    });

    it('should handle unnamed parent gracefully', async () => {
      vi.mocked(parentsApi.fetchParent).mockResolvedValue({
        ...mockParent,
        name: null,
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Unnamed Parent')).toBeInTheDocument();
      });
    });

    it('should handle missing optional fields gracefully', async () => {
      vi.mocked(parentsApi.fetchParent).mockResolvedValue({
        ...mockParent,
        role: null,
        birthDate: null,
        dateEntered: null,
        dueDate: null,
        reasonEnroll: null,
        notes: null,
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Maria Rodriguez' })).toBeInTheDocument();
      });

      // Check that em dashes are shown for missing fields
      const emDashes = screen.getAllByText('—');
      expect(emDashes.length).toBeGreaterThan(0);
    });
  });

  describe('Edit Functionality', () => {
    beforeEach(() => {
      vi.mocked(parentsApi.fetchParent).mockResolvedValue(mockParent);
    });

    it('should enter edit mode when Edit button is clicked', async () => {
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit'));

      // Should show edit form
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Role')).toBeInTheDocument();
      expect(screen.getByLabelText('Birth Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Date Entered Program')).toBeInTheDocument();
      expect(screen.getByLabelText('Due Date (if pregnant)')).toBeInTheDocument();
      expect(screen.getByLabelText('Reason for Enrollment')).toBeInTheDocument();
      expect(screen.getByLabelText('Notes')).toBeInTheDocument();

      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should populate edit form with current parent data', async () => {
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit'));

      // Check that form is populated with current data
      expect(screen.getByDisplayValue('Maria Rodriguez')).toBeInTheDocument();
      expect(screen.getByDisplayValue('mother')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1985-03-15')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2024-01-10')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2024-09-15')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Expecting second child')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Attends all appointments regularly')).toBeInTheDocument();
    });

    it('should cancel edit mode when Cancel button is clicked', async () => {
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit'));
      fireEvent.click(screen.getByText('Cancel'));

      // Should return to view mode
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    });

    it('should update form state when inputs are changed', async () => {
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit'));

      const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Maria Carmen Rodriguez' } });

      expect(nameInput.value).toBe('Maria Carmen Rodriguez');

      const roleInput = screen.getByLabelText('Role') as HTMLInputElement;
      fireEvent.change(roleInput, { target: { value: 'caregiver' } });

      expect(roleInput.value).toBe('caregiver');
    });

    it('should save changes when Save button is clicked', async () => {
      vi.mocked(parentsApi.updateParent).mockResolvedValue({
        ...mockParent,
        name: 'Maria Carmen Rodriguez',
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit'));

      const nameInput = screen.getByLabelText('Name');
      fireEvent.change(nameInput, { target: { value: 'Maria Carmen Rodriguez' } });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(parentsApi.updateParent).toHaveBeenCalledWith(123, 1, {
          name: 'Maria Carmen Rodriguez',
        });
      });
    });

    it('should show error message when save fails', async () => {
      vi.mocked(parentsApi.updateParent).mockRejectedValue(new Error('Save failed'));

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit'));

      const nameInput = screen.getByLabelText('Name');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText(/Error saving parent: Save failed/)).toBeInTheDocument();
      });
    });

    it('should disable buttons while saving', async () => {
      vi.mocked(parentsApi.updateParent).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit'));

      const nameInput = screen.getByLabelText('Name');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeDisabled();
      });
    });
  });

  describe('Data Formatting', () => {
    beforeEach(() => {
      vi.mocked(parentsApi.fetchParent).mockResolvedValue(mockParent);
    });

    it('should format dates correctly', async () => {
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText(/3\/1[45]\/1985/)).toBeInTheDocument();
        // Find the Date Entered Program label and check its sibling paragraph
        const dateEnteredLabel = screen.getByText('Date Entered Program');
        const dateEnteredSection = dateEnteredLabel.parentElement;
        expect(dateEnteredSection).toHaveTextContent(/1\/1?[09]\/2024/);
        expect(screen.getByText(/9\/1[45]\/2024/)).toBeInTheDocument();
      });
    });

    it('should format role with proper capitalization', async () => {
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Mother')).toBeInTheDocument();
      });
    });

    it('should preserve whitespace in text areas', async () => {
      vi.mocked(parentsApi.fetchParent).mockResolvedValue({
        ...mockParent,
        notes: 'Line 1\nLine 2\n\nLine 4',
      });

      renderWithProviders();

      await waitFor(() => {
        // Find the notes section by label, then check the paragraph element
        const notesLabel = screen.getByText('Notes');
        const notesSection = notesLabel.parentElement;
        const notesParagraph = notesSection?.querySelector('p.whitespace-pre-wrap');
        expect(notesParagraph).toBeInTheDocument();
        expect(notesParagraph).toHaveClass('whitespace-pre-wrap');
        expect(notesParagraph?.textContent).toBe('Line 1\nLine 2\n\nLine 4');
      });
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      vi.mocked(parentsApi.fetchParent).mockResolvedValue(mockParent);
    });

    it('should have correct back link', async () => {
      renderWithProviders();

      await waitFor(() => {
        const backLink = screen.getByText('← Back to Family');
        expect(backLink.closest('a')).toHaveAttribute('href', '/families/123');
      });
    });
  });

  describe('API Integration', () => {
    it('should call fetchParent with correct parameters', async () => {
      vi.mocked(parentsApi.fetchParent).mockResolvedValue(mockParent);

      renderWithProviders();

      expect(parentsApi.fetchParent).toHaveBeenCalledWith(123, 1);
    });

    it('should handle date formatting for API calls', async () => {
      vi.mocked(parentsApi.fetchParent).mockResolvedValue(mockParent);
      vi.mocked(parentsApi.updateParent).mockResolvedValue(mockParent);

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit'));

      const birthDateInput = screen.getByLabelText('Birth Date');
      fireEvent.change(birthDateInput, { target: { value: '1986-05-20' } });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(parentsApi.updateParent).toHaveBeenCalledWith(123, 1, {
          birthDate: '1986-05-20T00:00:00.000Z',
        });
      });
    });

    it('should only send changed fields in update', async () => {
      vi.mocked(parentsApi.fetchParent).mockResolvedValue(mockParent);
      vi.mocked(parentsApi.updateParent).mockResolvedValue(mockParent);

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit'));

      // Only change the name
      const nameInput = screen.getByLabelText('Name');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(parentsApi.updateParent).toHaveBeenCalledWith(123, 1, {
          name: 'New Name',
        });
      });

      // Should not include unchanged fields
      expect(parentsApi.updateParent).not.toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({
          role: expect.anything(),
        })
      );
    });
  });
});