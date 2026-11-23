import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import useServiceStore from 'store/new-services.store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UnsavedChangesDialog from './unsavedChangesDialog';

vi.mock('i18next', () => {
  const mockI18n = {
    use: vi.fn().mockReturnThis(),
    init: vi.fn().mockResolvedValue(undefined),
    t: (key: string) => key,
  };
  return { default: mockI18n, t: mockI18n.t };
});

vi.mock('i18n', () => ({
  default: { t: (key: string) => key },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('UnsavedChangesDialog', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    useServiceStore.setState({
      hasUnsavedChanges: true,
      nextLocation: '/edit/other-service-id',
      beforeNavigationSave: null,
      canDiscardNavigation: true,
    });
  });

  it('renders nothing when there is no pending navigation', () => {
    useServiceStore.setState({ nextLocation: null });
    const { container } = render(
      <MemoryRouter>
        <UnsavedChangesDialog />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('discards changes and navigates on Continue', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UnsavedChangesDialog />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'global.continue' }));

    expect(mockNavigate).toHaveBeenCalledWith('/edit/other-service-id', { replace: true });
    expect(useServiceStore.getState().hasUnsavedChanges).toBe(false);
  });

  it('cancels and keeps the user on the current service', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UnsavedChangesDialog />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'global.cancel' }));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(useServiceStore.getState().nextLocation).toBeNull();
    expect(useServiceStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('saves the service before navigating on Save and continue', async () => {
    const onServiceSave = vi.fn().mockResolvedValue(undefined);
    useServiceStore.setState({ onServiceSave });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UnsavedChangesDialog />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'newService.popup.saveAndContinue' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/edit/other-service-id', { replace: true }));
    expect(onServiceSave).toHaveBeenCalledWith('draft', false);
  });

  it('applies pending popup edits before saving', async () => {
    const calls: string[] = [];
    const beforeSave = vi.fn(() => calls.push('beforeSave'));
    const onServiceSave = vi.fn(() => {
      calls.push('save');
      return Promise.resolve();
    });
    useServiceStore.setState({ onServiceSave, nextLocation: '/newService', beforeNavigationSave: beforeSave });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UnsavedChangesDialog />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'newService.popup.saveAndContinue' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/newService', { replace: true }));
    expect(calls).toEqual(['beforeSave', 'save']);
  });

  it('stays on the current service when saving fails', async () => {
    const beforeSave = vi.fn();
    const onServiceSave = vi.fn().mockRejectedValue(new Error('failed'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    useServiceStore.setState({ onServiceSave, nextLocation: '/newService', beforeNavigationSave: beforeSave });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UnsavedChangesDialog />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'newService.popup.saveAndContinue' }));
    await waitFor(() => expect(onServiceSave).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'newService.popup.saveAndContinue' }));

    await waitFor(() => expect(onServiceSave).toHaveBeenCalledTimes(2));
    expect(beforeSave).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(useServiceStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('hides Continue when discarding is not allowed', () => {
    useServiceStore.setState({ canDiscardNavigation: false });
    render(
      <MemoryRouter>
        <UnsavedChangesDialog />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'global.continue' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'global.cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'newService.popup.saveAndContinue' })).toBeInTheDocument();
  });

  it('clears pending popup edits on cancel', async () => {
    useServiceStore.setState({ beforeNavigationSave: vi.fn() });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UnsavedChangesDialog />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'global.cancel' }));

    expect(useServiceStore.getState().beforeNavigationSave).toBeNull();
  });
});
