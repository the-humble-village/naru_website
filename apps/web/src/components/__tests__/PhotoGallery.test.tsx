import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PhotoGallery } from '../PhotoGallery';

vi.mock('../../api/files', () => ({
  filesApi: {
    getPresignedDownloadUrls: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

import { filesApi } from '../../api/files';

const mockedFilesApi = vi.mocked(filesApi);

const renderGallery = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const result = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { ...result, queryClient, invalidateSpy };
};

describe('PhotoGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFilesApi.getPresignedDownloadUrls.mockResolvedValue({
      urls: [
        { fileId: 1, url: 'https://cdn.test/1.jpg' },
        { fileId: 2, url: 'https://cdn.test/2.jpg' },
      ],
    });
    mockedFilesApi.deleteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when there are no photos', () => {
    const { container } = renderGallery(<PhotoGallery photos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a thumbnail per photo once urls resolve', async () => {
    renderGallery(<PhotoGallery photos={[1, 2]} />);

    await waitFor(() => {
      expect(screen.getByAltText('Photo 1')).toHaveAttribute('src', 'https://cdn.test/1.jpg');
    });
    expect(screen.getByAltText('Photo 2')).toHaveAttribute('src', 'https://cdn.test/2.jpg');
  });

  it('shows a delete affordance per photo by default', async () => {
    renderGallery(<PhotoGallery photos={[1, 2]} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete photo 1' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Delete photo 2' })).toBeInTheDocument();
  });

  it('hides the delete affordance when canDelete is false', async () => {
    renderGallery(<PhotoGallery photos={[1]} canDelete={false} />);

    await waitFor(() => {
      expect(screen.getByAltText('Photo 1')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Delete photo 1' })).not.toBeInTheDocument();
  });

  it('opens the confirm dialog instead of deleting immediately', async () => {
    renderGallery(<PhotoGallery photos={[1]} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete photo 1' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Delete photo' })).toBeInTheDocument();
    expect(mockedFilesApi.deleteFile).not.toHaveBeenCalled();
  });

  it('does not use window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderGallery(<PhotoGallery photos={[1]} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete photo 1' }));

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('cancelling the dialog leaves the photo alone', async () => {
    renderGallery(<PhotoGallery photos={[1]} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete photo 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockedFilesApi.deleteFile).not.toHaveBeenCalled();
    expect(screen.getByAltText('Photo 1')).toBeInTheDocument();
  });

  it('deletes the file, removes the tile and reports the deletion', async () => {
    const onDeleted = vi.fn();
    renderGallery(<PhotoGallery photos={[1, 2]} onDeleted={onDeleted} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete photo 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockedFilesApi.deleteFile).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.queryByAltText('Photo 1')).not.toBeInTheDocument();
    });
    expect(onDeleted).toHaveBeenCalledWith(1);
    // Untouched photos stay put.
    expect(screen.getByAltText('Photo 2')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marks the photo busy while the delete is in flight', async () => {
    let resolveDelete: () => void = () => {};
    mockedFilesApi.deleteFile.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      })
    );

    renderGallery(<PhotoGallery photos={[1]} onDeleted={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete photo 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByText('Deleting photo 1')).toBeInTheDocument();
    });
    expect(screen.getByAltText('Photo 1').closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Delete photo 1' })).toBeDisabled();
    // The confirm button is disabled while busy.
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();

    await act(async () => {
      resolveDelete();
    });

    await waitFor(() => {
      expect(screen.queryByAltText('Photo 1')).not.toBeInTheDocument();
    });
  });

  it('invalidates the photo url cache and the owning record on success', async () => {
    const onDeleted = vi.fn();
    const { invalidateSpy } = renderGallery(<PhotoGallery photos={[1]} onDeleted={onDeleted} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete photo 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['file-urls'] });
    });
    expect(onDeleted).toHaveBeenCalledWith(1);
    // With an onDeleted hook the owner decides what to refetch — no blanket invalidate.
    expect(invalidateSpy).not.toHaveBeenCalledWith();
  });

  it('falls back to a blanket invalidate when no onDeleted hook is supplied', async () => {
    const { invalidateSpy } = renderGallery(<PhotoGallery photos={[1]} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete photo 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith();
    });
  });

  it('keeps the photo and surfaces an error when the delete fails', async () => {
    mockedFilesApi.deleteFile.mockRejectedValue(new Error('Network down'));
    const onDeleted = vi.fn();

    renderGallery(<PhotoGallery photos={[1]} onDeleted={onDeleted} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete photo 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByText('Network down')).toBeInTheDocument();
    });
    expect(screen.getByAltText('Photo 1')).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
