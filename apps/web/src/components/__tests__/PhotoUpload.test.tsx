import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhotoUpload } from '../PhotoUpload';
import { usePendingPhotoDeletions, type PendingPhotoDeletions } from '../../hooks/usePendingPhotoDeletions';
import { filesApi } from '../../api/files';

vi.mock('../../api/files', () => ({
  filesApi: {
    getPresignedDownloadUrls: vi.fn(),
    requestPresignedUpload: vi.fn(),
    confirmUpload: vi.fn(),
    uploadFileToS3: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

/** Renders PhotoUpload and exposes the staging hook to the test. */
const Harness: React.FC<{
  photos: number[];
  staged: boolean;
  onHook?: (h: PendingPhotoDeletions) => void;
}> = ({ photos: initial, staged, onHook }) => {
  const [photos, setPhotos] = React.useState(initial);
  const pendingDeletions = usePendingPhotoDeletions();
  React.useEffect(() => { onHook?.(pendingDeletions); });

  return (
    <PhotoUpload
      photos={photos}
      onChange={setPhotos}
      pendingDeletions={staged ? pendingDeletions : undefined}
    />
  );
};

const renderUpload = (props: { photos: number[]; staged: boolean; onHook?: (h: PendingPhotoDeletions) => void }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness {...props} />
    </QueryClientProvider>
  );
};

const confirmRemoval = async (fileId: number, buttonName: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: `Delete photo ${fileId}` }));
  const confirm = await screen.findByRole('button', { name: buttonName });
  fireEvent.click(confirm);
};

describe('PhotoUpload photo removal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (filesApi.getPresignedDownloadUrls as any).mockResolvedValue({
      urls: [{ fileId: 1, url: 'http://example.test/1.jpg' }, { fileId: 2, url: 'http://example.test/2.jpg' }],
    });
    (filesApi.deleteFile as any).mockResolvedValue(undefined);
  });

  describe('without pendingDeletions (create forms)', () => {
    it('deletes the file immediately on confirm', async () => {
      renderUpload({ photos: [1], staged: false });

      await confirmRemoval(1, /^Delete$/);

      await waitFor(() => {
        expect(filesApi.deleteFile).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('with pendingDeletions (edit forms)', () => {
    it('does not touch the server when the removal is confirmed', async () => {
      renderUpload({ photos: [1, 2], staged: true });

      await confirmRemoval(1, /^Remove$/);

      // The whole point: nothing is destroyed until the form saves.
      expect(filesApi.deleteFile).not.toHaveBeenCalled();
    });

    it('removes the photo from the form and stages the id', async () => {
      let hook: PendingPhotoDeletions | undefined;
      renderUpload({ photos: [1, 2], staged: true, onHook: (h) => { hook = h; } });

      await confirmRemoval(1, /^Remove$/);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Delete photo 1' })).not.toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Delete photo 2' })).toBeInTheDocument();
      expect(hook?.ids).toEqual([1]);
    });

    it('tells the user the deletion happens on save', async () => {
      renderUpload({ photos: [1], staged: true });

      await confirmRemoval(1, /^Remove$/);

      await waitFor(() => {
        expect(screen.getByText(/1 photo will be deleted when you save/)).toBeInTheDocument();
      });
    });

    it('deletes the staged files only when commit() is called', async () => {
      let hook: PendingPhotoDeletions | undefined;
      renderUpload({ photos: [1, 2], staged: true, onHook: (h) => { hook = h; } });

      await confirmRemoval(1, /^Remove$/);
      await confirmRemoval(2, /^Remove$/);
      expect(filesApi.deleteFile).not.toHaveBeenCalled();

      await act(async () => { await hook!.commit(); });

      expect(filesApi.deleteFile).toHaveBeenCalledWith(1);
      expect(filesApi.deleteFile).toHaveBeenCalledWith(2);
      expect(filesApi.deleteFile).toHaveBeenCalledTimes(2);
    });

    it('deletes nothing when the staged list is discarded, as on Cancel', async () => {
      let hook: PendingPhotoDeletions | undefined;
      renderUpload({ photos: [1], staged: true, onHook: (h) => { hook = h; } });

      await confirmRemoval(1, /^Remove$/);
      act(() => hook!.discard());

      await act(async () => { await hook!.commit(); });
      expect(filesApi.deleteFile).not.toHaveBeenCalled();
    });

    it('keeps the photo when the confirmation is cancelled', async () => {
      renderUpload({ photos: [1], staged: true });

      fireEvent.click(screen.getByRole('button', { name: 'Delete photo 1' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

      expect(screen.getByRole('button', { name: 'Delete photo 1' })).toBeInTheDocument();
      expect(filesApi.deleteFile).not.toHaveBeenCalled();
    });

    it('reports a failed cleanup without losing the rest', async () => {
      let hook: PendingPhotoDeletions | undefined;
      (filesApi.deleteFile as any)
        .mockRejectedValueOnce(new Error('storage down'))
        .mockResolvedValueOnce(undefined);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderUpload({ photos: [1, 2], staged: true, onHook: (h) => { hook = h; } });
      await confirmRemoval(1, /^Remove$/);
      await confirmRemoval(2, /^Remove$/);

      await act(async () => { await hook!.commit(); });

      // The record already saved without them, so a failure is reported, not thrown.
      expect(filesApi.deleteFile).toHaveBeenCalledTimes(2);
      await waitFor(() => {
        expect(screen.getByText(/One photo could not be deleted from storage/)).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });
  });
});
