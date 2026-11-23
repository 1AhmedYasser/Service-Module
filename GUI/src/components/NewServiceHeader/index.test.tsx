import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import api from 'services/api-dev';
import useServiceStore from 'store/new-services.store';
import { ServiceState } from 'types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NewServiceHeader from './index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: {},
}));

vi.mock('i18next', async () => {
  const actual = await vi.importActual<typeof import('i18next')>('i18next');
  return { ...actual, t: (key: string) => key };
});

vi.mock('i18n', () => ({
  default: { t: (key: string) => key },
}));

vi.mock('services/api-dev', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderHeader = ({ path = '/edit/current-service-id', saveOnClick = vi.fn() } = {}) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {['/edit/:id', '/newService'].map((routePath) => (
          <Route
            key={routePath}
            path={routePath}
            element={
              <NewServiceHeader
                activeStep={1}
                backOnClick={vi.fn()}
                continueOnClick={vi.fn()}
                saveOnClick={saveOnClick}
              />
            }
          />
        ))}
      </Routes>
    </MemoryRouter>,
  );

describe('NewServiceHeader service switcher dropdown', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    useServiceStore.setState({
      hasUnsavedChanges: false,
      nextLocation: null,
      name: 'Current Service',
      serviceState: undefined,
    });
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { serviceId: 'current-service-id', name: 'Current Service', state: ServiceState.Active },
        { serviceId: 'other-service-id', name: 'Other Service', state: ServiceState.Ready },
        { serviceId: 'draft-service-id', name: 'Draft Service', state: ServiceState.Draft },
      ],
    });
  });

  it('shows the current service status next to its name in the closed dropdown', () => {
    useServiceStore.setState({ serviceState: ServiceState.Active });
    renderHeader();

    expect(screen.getByRole('button', { name: 'Current_Service overview.service.states.active' })).toBeInTheDocument();
  });

  it('updates the closed dropdown status when the service status changes', async () => {
    useServiceStore.setState({ serviceState: ServiceState.Active });
    renderHeader();

    act(() => useServiceStore.setState({ serviceState: ServiceState.Draft }));

    expect(
      await screen.findByRole('button', { name: 'Current_Service overview.service.states.draft' }),
    ).toBeInTheDocument();
  });

  it('shows a status tag next to every listed service', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Current_Service' }));

    expect(
      await screen.findByRole('menuitem', { name: 'Other Service overview.service.states.ready' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Draft Service overview.service.states.draft' })).toBeInTheDocument();
  }, 45000);

  it('lists other services and navigates immediately with no unsaved changes', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Current_Service' }));

    const option = await screen.findByText('Other Service');
    // The current service should not be offered as a navigation target
    expect(screen.queryByText('Current Service')).not.toBeInTheDocument();

    await user.click(option);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/edit/other-service-id'));
  }, 45000);

  it('defers navigation through the unsaved-changes dialog when there are unsaved changes', async () => {
    useServiceStore.setState({ hasUnsavedChanges: true });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Current_Service' }));
    const option = await screen.findByText('Other Service');
    await user.click(option);

    await waitFor(() => expect(useServiceStore.getState().nextLocation).toBe('/edit/other-service-id'));
    expect(mockNavigate).not.toHaveBeenCalled();
  }, 45000);
});

describe('NewServiceHeader returning a service to Draft', () => {
  const onServiceSave = vi.fn();
  const dependency = (serviceId: string, state: string) => ({
    direction: 'incoming',
    serviceId,
    name: `Service ${serviceId}`,
    state,
    type: 'POST',
    deleted: false,
  });
  const mockDependencies = (edges: Record<string, unknown[]>) =>
    vi
      .mocked(api.post)
      .mockImplementation((_url: string, body: any) =>
        Promise.resolve({ data: { response: edges[body.service_id] ?? [] } }),
      );

  beforeEach(() => {
    mockNavigate.mockClear();
    onServiceSave.mockReset().mockResolvedValue(undefined);
    vi.mocked(api.post).mockReset();
    useServiceStore.setState({
      hasUnsavedChanges: false,
      name: 'Current Service',
      serviceId: 'current-service-id',
      serviceState: ServiceState.Active,
      onServiceSave,
    });
  });

  it('saves a Ready service without checking dependents', async () => {
    useServiceStore.setState({ serviceState: ServiceState.Ready });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'global.save' }));

    await waitFor(() => expect(onServiceSave).toHaveBeenCalledWith(ServiceState.Draft, false));
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.queryByText('overview.popup.returnToDraft.title')).not.toBeInTheDocument();
  });

  it('saves an Active service without a warning when nothing Active depends on it', async () => {
    mockDependencies({ 'current-service-id': [dependency('draft-service', ServiceState.Draft)] });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'global.save' }));

    await waitFor(() => expect(onServiceSave).toHaveBeenCalledWith(ServiceState.Draft, false));
    expect(screen.queryByText('overview.popup.returnToDraft.title')).not.toBeInTheDocument();
    expect(useServiceStore.getState().serviceState).toBe(ServiceState.Draft);
  });

  it('lists Active dependents and keeps the service Active on cancel', async () => {
    mockDependencies({ 'current-service-id': [dependency('a', ServiceState.Active)], a: [dependency('b', 'active')] });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'global.save' }));

    expect(await screen.findByText('overview.popup.returnToDraft.title')).toBeInTheDocument();
    expect(screen.getByText('Service a')).toBeInTheDocument();
    expect(screen.getByText('Service b')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'overview.popup.returnToDraft.cancel' }));

    expect(screen.queryByText('overview.popup.returnToDraft.title')).not.toBeInTheDocument();
    expect(onServiceSave).not.toHaveBeenCalled();
    expect(useServiceStore.getState().serviceState).toBe(ServiceState.Active);
  });

  it('returns the service to Draft on confirm', async () => {
    mockDependencies({ 'current-service-id': [dependency('a', ServiceState.Active)] });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'global.save' }));
    await user.click(await screen.findByRole('button', { name: 'overview.popup.returnToDraft.confirm' }));

    await waitFor(() => expect(onServiceSave).toHaveBeenCalledWith(ServiceState.Draft, false));
    expect(useServiceStore.getState().serviceState).toBe(ServiceState.Draft);
  });

  it('opens a listed service on the canvas', async () => {
    mockDependencies({ 'current-service-id': [dependency('a', ServiceState.Active)] });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'global.save' }));
    await user.click(await screen.findByText('Service a'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/edit/a'));
    expect(onServiceSave).not.toHaveBeenCalled();
  });
});

describe('NewServiceHeader unsaved changes indicator', () => {
  const onServiceSave = vi.fn();
  const queryDot = () => screen.queryByRole('img', { name: 'newService.unsavedChangesIndicator' });

  beforeEach(() => {
    mockNavigate.mockClear();
    onServiceSave.mockReset().mockResolvedValue(undefined);
    vi.mocked(api.post).mockReset();
    useServiceStore.setState({
      hasUnsavedChanges: false,
      nextLocation: null,
      name: 'Current Service',
      serviceId: 'current-service-id',
      serviceState: ServiceState.Draft,
      onServiceSave,
    });
  });

  it('hides the dot for a saved service with no changes', () => {
    renderHeader();

    expect(queryDot()).not.toBeInTheDocument();
  });

  it('shows the dot for a saved service with unsaved changes', () => {
    useServiceStore.setState({ hasUnsavedChanges: true });
    renderHeader();

    expect(queryDot()).toBeInTheDocument();
  });

  it('shows the dot for a new service', () => {
    renderHeader({ path: '/newService' });

    expect(queryDot()).toBeInTheDocument();
  });

  it('does not change whether Save is enabled', () => {
    useServiceStore.setState({ hasUnsavedChanges: true });
    renderHeader();

    expect(screen.getByRole('button', { name: /global\.save/ })).toBeEnabled();
  });

  it('keeps the dot when the save fails', async () => {
    useServiceStore.setState({ hasUnsavedChanges: true });
    onServiceSave.mockRejectedValue(new Error('save failed'));
    const saveOnClick = vi.fn();
    const user = userEvent.setup();
    renderHeader({ saveOnClick });

    await user.click(screen.getByRole('button', { name: /global\.save/ }));

    await waitFor(() => expect(onServiceSave).toHaveBeenCalled());
    expect(saveOnClick).not.toHaveBeenCalled();
    expect(useServiceStore.getState().hasUnsavedChanges).toBe(true);
    expect(queryDot()).toBeInTheDocument();
  });

  it('keeps the dot when the save is blocked by a missing name', async () => {
    useServiceStore.setState({ hasUnsavedChanges: true, name: '' });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: /global\.save/ }));

    expect(onServiceSave).not.toHaveBeenCalled();
    expect(queryDot()).toBeInTheDocument();
  });

  it('keeps the dot and the Active status when the dependency confirmation is cancelled', async () => {
    useServiceStore.setState({ hasUnsavedChanges: true, serviceState: ServiceState.Active });
    vi.mocked(api.post).mockResolvedValue({
      data: {
        response: [
          { direction: 'incoming', serviceId: 'a', name: 'Service a', state: 'active', type: 'POST', deleted: false },
        ],
      },
    });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: /global\.save/ }));
    await user.click(await screen.findByRole('button', { name: 'overview.popup.returnToDraft.cancel' }));

    expect(onServiceSave).not.toHaveBeenCalled();
    expect(useServiceStore.getState().serviceState).toBe(ServiceState.Active);
    expect(queryDot()).toBeInTheDocument();
  });

  it('hides the dot once a successful save clears the unsaved changes', async () => {
    useServiceStore.setState({ hasUnsavedChanges: true });
    const saveOnClick = vi.fn(() => useServiceStore.setState({ hasUnsavedChanges: false }));
    const user = userEvent.setup();
    renderHeader({ saveOnClick });

    await user.click(screen.getByRole('button', { name: /global\.save/ }));

    await waitFor(() => expect(saveOnClick).toHaveBeenCalled());
    expect(queryDot()).not.toBeInTheDocument();
  });
});
