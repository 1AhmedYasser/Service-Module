import {
  flexRender,
  getCoreRowModel,
  PaginationState,
  SortingState,
  Updater,
  useReactTable,
} from '@tanstack/react-table';
import clsx from 'clsx';
import useDelayedFlag from 'hooks/useDelayedFlag';
import { FC, Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdExpandLess, MdExpandMore, MdUnfoldMore } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from 'resources/routes-constants';
import useServiceListStore, {
  DEFAULT_SERVICES_FILTERS,
  ServicesFilters,
  ServiceStatusTarget,
} from 'store/services.store';
import useToastStore from 'store/toasts.store';
import { Service, ServiceState } from 'types';
import { ActivationBlocker } from 'types/activation-blocker';
import { ServiceDependency } from 'types/service-dependency';
import { getFlowCompletenessMessageKeys } from 'utils/flow-completeness';
import { AffectedService } from 'utils/service-draft-return';

import { Button, Modal, Track } from '..';
import ReturnToDraftModal from '../ReturnToDraftModal';
import { getColumns } from './columns';
import DependencyView from './DependencyView';
import { hasActiveFilters } from './filters';
import ServicesFilterBar from './ServicesFilterBar';
import ServicesPagination from './ServicesPagination';
import { ServicesEmpty, ServicesLoadError, ServicesNoMatch, ServicesTableSkeleton } from './ServicesTableStatus';
import ServiceStatusChip from './ServiceStatusChip';

import '../../styles/main.scss';
import './ServicesTable.scss';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];
const PAGE_SIZE_STORAGE_KEY = 'page-size';

const getStoredPageSize = (): number => {
  const stored = Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
  return PAGE_SIZE_OPTIONS.includes(stored) ? stored : DEFAULT_PAGE_SIZE;
};

const resolveUpdater = <T,>(updater: Updater<T>, previous: T): T =>
  typeof updater === 'function' ? (updater as (old: T) => T)(previous) : updater;

const ServicesTable: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isDeletePopupVisible, setIsDeletePopupVisible] = useState(false);
  const [isDeletingService, setIsDeletingService] = useState(false);
  const [activationBlockers, setActivationBlockers] = useState<ActivationBlocker[] | null>(null);
  const [serviceIdBeingChecked, setServiceIdBeingChecked] = useState<string | null>(null);
  const [draftConfirmation, setDraftConfirmation] = useState<{
    readonly service: ServiceStatusTarget;
    readonly affectedServices: AffectedService[];
  } | null>(null);
  const services = useServiceListStore((state) => state.services);
  const pinnedServices = useServiceListStore((state) => state.pinnedServices);
  const totalPages = useServiceListStore((state) => state.servicesTotalPages);
  const totalCount = useServiceListStore((state) => state.servicesTotalCount);
  const loadState = useServiceListStore((state) => state.servicesLoadState);
  const isRefreshing = useServiceListStore((state) => state.isRefreshingServices);
  const loadedFilters = useServiceListStore((state) => state.servicesFilters);
  const tableData = useMemo(() => [...pinnedServices, ...services], [pinnedServices, services]);

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: getStoredPageSize() });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<ServicesFilters>(() => useServiceListStore.getState().servicesFilters);

  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLTableSectionElement>(null);

  const loadServices = useCallback(() => {
    useServiceListStore.getState().loadServicesList(pagination, sorting, filters).catch(console.error);
  }, [pagination, sorting, filters]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const showSkeleton = useDelayedFlag(loadState === 'loading');
  const showRefreshing = useDelayedFlag(isRefreshing);

  const pendingFocusRef = useRef(pendingFocusId);
  pendingFocusRef.current = pendingFocusId;
  useEffect(() => {
    if (!pendingFocusRef.current) scrollRef.current?.scrollTo({ top: 0 });
  }, [pagination, sorting, filters]);

  useEffect(() => {
    if (pagination.pageIndex > 0 && pagination.pageIndex >= totalPages) {
      setPagination((current) => ({ ...current, pageIndex: Math.max(totalPages - 1, 0) }));
    }
  }, [pagination.pageIndex, totalPages]);

  const focusService = useCallback((serviceId: string) => {
    setExpandedIds(new Set([serviceId]));
    setFocusedId(serviceId);
    setScrollTargetId(serviceId);
  }, []);

  useEffect(() => {
    if (pendingFocusId && tableData.some((service) => service.serviceId === pendingFocusId)) {
      focusService(pendingFocusId);
      setPendingFocusId(null);
    }
  }, [pendingFocusId, tableData, focusService]);

  useEffect(() => {
    if (!scrollTargetId) return;
    const container = scrollRef.current;
    const row = container?.querySelector<HTMLElement>(`[data-service-row="${CSS.escape(scrollTargetId)}"]`);
    if (!container || !row) return;
    const headHeight = headRef.current?.offsetHeight ?? 0;
    const top = row.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top: Math.max(top - headHeight, 0), behavior: 'smooth' });
    setScrollTargetId(null);
  }, [scrollTargetId, tableData]);

  const toggleExpanded = useCallback(
    (service: Service) => {
      const next = new Set(expandedIds);
      if (next.has(service.serviceId)) {
        next.delete(service.serviceId);
        if (focusedId === service.serviceId) setFocusedId(null);
      } else {
        next.add(service.serviceId);
      }
      setExpandedIds(next);
    },
    [expandedIds, focusedId],
  );

  const toggleFocus = useCallback(
    (service: Service) => {
      const isOnlyOpenView =
        focusedId === service.serviceId && expandedIds.size === 1 && expandedIds.has(service.serviceId);
      if (isOnlyOpenView) {
        setExpandedIds(new Set());
        setFocusedId(null);
        return;
      }
      focusService(service.serviceId);
    },
    [expandedIds, focusedId, focusService],
  );

  const locateService = useCallback(
    async (serviceId: string) => {
      if (tableData.some((service) => service.serviceId === serviceId)) {
        focusService(serviceId);
        return;
      }

      const { locateService: locate } = useServiceListStore.getState();
      try {
        const location = await locate(serviceId, pagination.pageSize, sorting, filters);
        if (location?.page) {
          setPendingFocusId(serviceId);
          setPagination((current) => ({ ...current, pageIndex: location.page! - 1 }));
          return;
        }

        if (hasActiveFilters(filters)) {
          const unfiltered = await locate(serviceId, pagination.pageSize, sorting, DEFAULT_SERVICES_FILTERS);
          if (unfiltered?.page || unfiltered?.pinned) {
            setPendingFocusId(serviceId);
            setFilters(DEFAULT_SERVICES_FILTERS);
            setPagination((current) => ({ ...current, pageIndex: unfiltered.page ? unfiltered.page - 1 : 0 }));
            useToastStore.getState().info({ title: t('overview.filters.filtersCleared') });
            return;
          }
        }

        useToastStore.getState().error({ title: t('overview.filters.serviceNotFound') });
      } catch (error) {
        console.error(error);
        useToastStore.getState().error({ title: t('overview.filters.serviceNotFound') });
      }
    },
    [filters, focusService, pagination.pageSize, sorting, t, tableData],
  );

  const changeServiceStatus = useCallback(
    async (service: ServiceStatusTarget) => {
      if (serviceIdBeingChecked) return;

      const store = useServiceListStore.getState();
      setServiceIdBeingChecked(service.serviceId);
      try {
        if (service.state === ServiceState.Draft) {
          const completeness = await store.loadFlowCompleteness(service.serviceId);
          if (!completeness.isComplete) {
            getFlowCompletenessMessageKeys(completeness).forEach((key) => {
              useToastStore.getState().error({ title: t('newService.toast.incompleteFlow'), message: t(key) });
            });
            return;
          }
          await store.changeServiceState(service, ServiceState.Ready);
        } else if (service.state === ServiceState.Ready) {
          const blockers = await store.loadActivationBlockers(service.serviceId);
          if (blockers.length > 0) {
            setActivationBlockers(blockers);
            return;
          }
          await store.changeServiceState(service, ServiceState.Active);
        } else if (service.state === ServiceState.Active) {
          const affectedServices = await store.loadAffectedActiveServices(service.serviceId);
          setDraftConfirmation({ service, affectedServices });
        }
      } catch (e) {
        console.error(e);
        useToastStore.getState().error({ title: t('overview.service.toast.failed.state') });
      } finally {
        setServiceIdBeingChecked(null);
      }
    },
    [serviceIdBeingChecked, t],
  );

  const confirmDraft = async () => {
    if (!draftConfirmation) return;

    const { service } = draftConfirmation;
    setDraftConfirmation(null);
    setServiceIdBeingChecked(service.serviceId);
    try {
      await useServiceListStore.getState().changeServiceState(service, ServiceState.Draft);
    } finally {
      setServiceIdBeingChecked(null);
    }
  };

  const dependencyHandlers = useMemo(
    () => ({
      onOpen: (dependency: ServiceDependency) => {
        navigate(ROUTES.replaceWithId(ROUTES.EDITSERVICE_ROUTE, dependency.serviceId));
      },
      onLocate: (dependency: ServiceDependency) => {
        void locateService(dependency.serviceId);
      },
      onChangeStatus: (dependency: ServiceDependency) => {
        if (dependency.deleted || !dependency.state) return;
        void changeServiceStatus({ serviceId: dependency.serviceId, state: dependency.state, type: dependency.type });
      },
      onChangeServiceStatus: (service: Service) => {
        void changeServiceStatus(service);
      },
    }),
    [changeServiceStatus, locateService, navigate],
  );

  const columns = useMemo(
    () =>
      getColumns({
        navigate,
        hideDeletePopup: () => setIsDeletePopupVisible(true),
        onChangeStatus: (service: ServiceStatusTarget) => {
          void changeServiceStatus(service);
        },
        serviceIdBeingChecked,
        expandedIds,
        onToggleExpanded: toggleExpanded,
        onFocusService: toggleFocus,
        onReindex: (service: Service) => {
          void useServiceListStore.getState().reindexService(service);
        },
      }),
    [changeServiceStatus, expandedIds, navigate, serviceIdBeingChecked, toggleExpanded, toggleFocus],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting, pagination },
    filterFns: { fuzzy: () => true },
    getRowId: (service) => service.serviceId,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
    onSortingChange: (updater) => {
      setSorting((current) => resolveUpdater(updater, current));
      setPagination((current) => ({ ...current, pageIndex: 0 }));
    },
  });

  const changeFilters = useCallback((next: ServicesFilters) => {
    setFilters(next);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, []);

  const deleteSelectedService = () => {
    setIsDeletingService(true);
    useServiceListStore
      .getState()
      .deleteSelectedService(
        async () => {
          setIsDeletePopupVisible(false);
          await useServiceListStore.getState().loadServicesList(pagination, sorting);
        },
        t('overview.service.toast.deleted'),
        t('overview.service.toast.failed.delete'),
        pagination,
        sorting,
      )
      .then(() => {
        setIsDeletingService(false);
      })
      .catch(() => {
        setIsDeletingService(false);
      });
  };

  const rows = table.getRowModel().rows;
  const visibleRows = loadState === 'success' ? rows : [];
  const columnIds = table.getVisibleLeafColumns().map((column) => column.id);

  const renderStatusRows = () => {
    if (loadState === 'loading') return showSkeleton ? <ServicesTableSkeleton columnIds={columnIds} /> : null;
    if (loadState === 'error') return <ServicesLoadError colSpan={columnIds.length} onRetry={loadServices} />;
    if (rows.length > 0) return null;
    if (hasActiveFilters(loadedFilters)) {
      return (
        <ServicesNoMatch
          colSpan={columnIds.length}
          search={loadedFilters.search}
          onClearFilters={() => changeFilters(DEFAULT_SERVICES_FILTERS)}
        />
      );
    }
    return <ServicesEmpty colSpan={columnIds.length} onCreate={() => navigate(ROUTES.NEWSERVICE_ROUTE)} />;
  };
  const lastPinnedIndex = pinnedServices.length - 1;

  return (
    <>
      {isDeletePopupVisible && (
        <Modal title={t('overview.popup.delete')} onClose={() => setIsDeletePopupVisible(false)}>
          <Track justify="end" gap={16}>
            <Button appearance="secondary" onClick={() => setIsDeletePopupVisible(false)}>
              {t('overview.cancel')}
            </Button>
            <Button appearance={!isDeletingService ? 'error' : 'loading'} onClick={deleteSelectedService}>
              {t('overview.delete')}
            </Button>
          </Track>
        </Modal>
      )}
      {draftConfirmation && (
        <ReturnToDraftModal
          affectedServices={draftConfirmation.affectedServices}
          cancelLabel={t('overview.popup.setToDraftConfirm.cancel') ?? ''}
          confirmLabel={t('overview.popup.setToDraftConfirm.confirm') ?? ''}
          onCancel={() => setDraftConfirmation(null)}
          onConfirm={() => void confirmDraft()}
          onOpenService={(serviceId) => {
            setDraftConfirmation(null);
            navigate(ROUTES.replaceWithId(ROUTES.EDITSERVICE_ROUTE, serviceId));
          }}
        />
      )}
      {activationBlockers && activationBlockers.length > 0 && (
        <Modal
          title={t('overview.popup.activationBlocked.title')}
          onClose={() => setActivationBlockers(null)}
          footer={
            <Button appearance="primary" onClick={() => setActivationBlockers(null)}>
              {t('global.continue')}
            </Button>
          }
        >
          <ul className="activation-blockers-list">
            {activationBlockers.map((blocker) => {
              const content = (
                <Track justify="between">
                  <strong>{blocker.name}</strong>
                  <ServiceStatusChip state={blocker.state === 'missing' ? 'deleted' : blocker.state} />
                </Track>
              );

              return (
                <li key={blocker.serviceId}>
                  {blocker.state === 'missing' ? (
                    <div className="activation-blockers-list__item activation-blockers-list__item--static">
                      {content}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="activation-blockers-list__item"
                      onClick={() => {
                        setActivationBlockers(null);
                        navigate(ROUTES.replaceWithId(ROUTES.EDITSERVICE_ROUTE, blocker.serviceId));
                      }}
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Modal>
      )}
      <section className="services-panel services-panel--filters">
        <ServicesFilterBar filters={filters} onChange={changeFilters} />
      </section>
      <section className="services-panel services-panel--table">
        {showRefreshing && <div className="services-table__progress" aria-hidden="true" />}
        <div
          className={clsx('services-table', showRefreshing && 'services-table--refreshing')}
          ref={scrollRef}
          aria-busy={loadState === 'loading' || isRefreshing}
        >
          <table className="data-table services-table__table">
            <colgroup>
              {table.getVisibleLeafColumns().map((column) => (
                <col key={column.id} className={`services-table__col--${column.id}`} />
              ))}
            </colgroup>
            <thead ref={headRef}>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {/* The name header also spans the expander column so its sort icon lines up with the chevrons. */}
                  {headerGroup.headers
                    .filter((header) => header.column.id !== 'expander')
                    .map((header) => (
                      <th
                        key={header.id}
                        colSpan={header.column.id === 'name' ? 2 : 1}
                        className={`services-table__col--${header.column.id}`}
                        aria-sort={
                          { asc: 'ascending' as const, desc: 'descending' as const }[
                            header.column.getIsSorted() as string
                          ]
                        }
                      >
                        {header.isPlaceholder ? null : (
                          <span className={`services-table__header services-table__header--${header.column.id}`}>
                            {header.column.getCanSort() && (
                              <button
                                type="button"
                                className={clsx(
                                  'services-table__sort',
                                  header.column.getIsSorted() && 'services-table__sort--active',
                                )}
                                onClick={header.column.getToggleSortingHandler()}
                                aria-label={t('overview.table.sort') ?? ''}
                              >
                                {{
                                  asc: <MdExpandMore />,
                                  desc: <MdExpandLess />,
                                }[header.column.getIsSorted() as string] ?? <MdUnfoldMore />}
                              </button>
                            )}
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                        )}
                      </th>
                    ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {visibleRows.map((row, index) => {
                const service = row.original;
                const isExpanded = expandedIds.has(service.serviceId);
                const rowClassName = clsx(
                  'services-table__row',
                  service.isPinned && 'services-table__row--pinned',
                  index === lastPinnedIndex && services.length > 0 && 'services-table__row--last-pinned',
                  isExpanded && 'services-table__row--expanded',
                  focusedId === service.serviceId && 'services-table__row--focused',
                );

                return (
                  <Fragment key={row.id}>
                    <tr className={rowClassName} data-service-row={service.serviceId}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className={`services-table__col--${cell.column.id}`}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && (
                      <tr className={clsx(rowClassName, 'services-table__details-row')}>
                        <td colSpan={row.getVisibleCells().length}>
                          <DependencyView
                            service={service}
                            serviceIdBeingChecked={serviceIdBeingChecked}
                            {...dependencyHandlers}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {renderStatusRows()}
            </tbody>
          </table>
        </div>
        <ServicesPagination
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          pageCount={totalPages}
          totalCount={totalCount}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={(pageIndex) => setPagination((current) => ({ ...current, pageIndex }))}
          onPageSizeChange={(pageSize) => {
            localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
            setPagination({ pageIndex: 0, pageSize });
          }}
        />
      </section>
    </>
  );
};

export default ServicesTable;
