import { createColumnHelper } from '@tanstack/react-table';
import InfoCard from 'components/InfoCard';
import i18n from 'i18n';
import { AiOutlineInfoCircle } from 'react-icons/ai';
import { BsPin, BsPinAngle } from 'react-icons/bs';
import { MdDeleteOutline, MdKeyboardArrowDown, MdKeyboardArrowRight, MdOutlineEdit } from 'react-icons/md';
import { NavigateFunction } from 'react-router-dom';
import { ROUTES } from 'resources/routes-constants';
import useServiceListStore, { ServiceStatusTarget } from 'store/services.store';
import { Service, ServiceState } from 'types';

import { DependenciesLegendContent, ServiceInfoContent } from './CardContents';
import DependencyCounts from './DependencyCounts';
import IndexStatus from './IndexStatus';
import ServiceStatusButton from './ServiceStatusButton';

interface GetColumnsConfig {
  navigate: NavigateFunction;
  hideDeletePopup: () => void;
  onChangeStatus: (service: ServiceStatusTarget) => void;
  serviceIdBeingChecked: string | null;
  expandedIds: ReadonlySet<string>;
  onToggleExpanded: (service: Service) => void;
  onFocusService: (service: Service) => void;
  onReindex: (service: Service) => void;
}

const openService = (navigate: NavigateFunction, service: Service) => {
  useServiceListStore.getState().setSelectedService(service);
  navigate(ROUTES.replaceWithId(ROUTES.EDITSERVICE_ROUTE, service.serviceId));
};

export const getColumns = ({
  navigate,
  hideDeletePopup,
  onChangeStatus,
  serviceIdBeingChecked,
  expandedIds,
  onToggleExpanded,
  onFocusService,
  onReindex,
}: GetColumnsConfig) => {
  const columnHelper = createColumnHelper<Service>();

  return [
    columnHelper.display({
      id: 'expander',
      cell: (props) => {
        const isExpanded = expandedIds.has(props.row.original.serviceId);
        return (
          <button
            type="button"
            className="services-table__expander"
            aria-expanded={isExpanded}
            aria-label={i18n.t(isExpanded ? 'overview.dependencies.collapse' : 'overview.dependencies.expand') ?? ''}
            onClick={() => onToggleExpanded(props.row.original)}
          >
            {isExpanded ? <MdKeyboardArrowDown /> : <MdKeyboardArrowRight />}
          </button>
        );
      },
    }),
    columnHelper.accessor('name', {
      header: i18n.t('overview.table.name') ?? '',
      cell: (props) => {
        const service = props.row.original;
        return (
          <span className="services-table__name-cell">
            <button
              type="button"
              className="services-table__service-link"
              title={service.name}
              onClick={() => openService(navigate, service)}
            >
              {service.name}
            </button>
            <InfoCard title={i18n.t('overview.serviceInfo.title')} content={<ServiceInfoContent service={service} />}>
              <button
                type="button"
                className="services-table__info-button"
                aria-label={i18n.t('overview.serviceInfo.open') ?? ''}
              >
                <AiOutlineInfoCircle />
              </button>
            </InfoCard>
          </span>
        );
      },
    }),
    columnHelper.accessor((service) => (service.incomingCount ?? 0) + (service.outgoingCount ?? 0), {
      id: 'dependencies',
      header: () => (
        <span className="services-table__header-with-info">
          {i18n.t('overview.table.dependencies')}
          <InfoCard title={i18n.t('overview.dependencies.title')} content={<DependenciesLegendContent />}>
            <button
              type="button"
              className="services-table__info-button"
              aria-label={i18n.t('overview.dependencies.open') ?? ''}
            >
              <AiOutlineInfoCircle />
            </button>
          </InfoCard>
        </span>
      ),
      cell: (props) => (
        <DependencyCounts
          incoming={props.row.original.incomingCount ?? 0}
          outgoing={props.row.original.outgoingCount ?? 0}
          problems={props.row.original.problemCount ?? 0}
          onClick={() => onFocusService(props.row.original)}
        />
      ),
    }),
    columnHelper.accessor('state', {
      header: i18n.t('overview.table.status') ?? '',
      cell: (props) => {
        const service = props.row.original;
        return (
          <ServiceStatusButton
            state={service.state}
            isLoading={serviceIdBeingChecked === service.serviceId}
            onClick={() => onChangeStatus(service)}
          />
        );
      },
    }),
    columnHelper.accessor('indexStatus', {
      id: 'index',
      header: i18n.t('overview.table.index') ?? '',
      cell: (props) => (
        <IndexStatus
          status={props.row.original.indexStatus}
          canReindex={props.row.original.state === ServiceState.Active}
          onReindex={() => onReindex(props.row.original)}
        />
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: i18n.t('overview.table.actions') ?? '',
      cell: (props) => {
        const service = props.row.original;
        const canDelete = service.state === ServiceState.Draft || service.state === ServiceState.Ready;

        return (
          <span className="services-table__actions">
            <button
              type="button"
              className={`services-table__text-action services-table__pin${service.isPinned ? ' services-table__pin--pinned' : ''}`}
              aria-pressed={!!service.isPinned}
              onClick={() => void useServiceListStore.getState().togglePinService(service)}
            >
              {service.isPinned ? <BsPin aria-hidden /> : <BsPinAngle aria-hidden />}
              {i18n.t(service.isPinned ? 'overview.pin.pinned' : 'overview.pin.pin')}
            </button>
            <span className="services-table__actions-divider" aria-hidden />
            <button
              type="button"
              className="services-table__icon-action"
              aria-label={i18n.t('overview.edit') ?? ''}
              title={i18n.t('overview.edit') ?? ''}
              onClick={() => openService(navigate, service)}
            >
              <MdOutlineEdit />
            </button>
            <button
              type="button"
              className="services-table__icon-action"
              aria-label={i18n.t('overview.delete') ?? ''}
              title={i18n.t('overview.delete') ?? ''}
              disabled={!canDelete}
              onClick={() => {
                useServiceListStore.getState().setSelectedService(service);
                hideDeletePopup();
              }}
            >
              <MdDeleteOutline />
            </button>
          </span>
        );
      },
    }),
  ];
};
