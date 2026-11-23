import clsx from 'clsx';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlineWarningAmber } from 'react-icons/md';
import { ServiceDependency } from 'types/service-dependency';

import DependencyCounts from './DependencyCounts';
import ServiceStatusButton from './ServiceStatusButton';

type DependencyNodeProps = {
  readonly dependency: ServiceDependency;
  readonly isBeingChecked: boolean;
  readonly onOpen: (dependency: ServiceDependency) => void;
  readonly onLocate: (dependency: ServiceDependency) => void;
  readonly onChangeStatus: (dependency: ServiceDependency) => void;
};

const DependencyNode = forwardRef<HTMLDivElement, DependencyNodeProps>(
  ({ dependency, isBeingChecked, onOpen, onLocate, onChangeStatus }, ref) => {
    const { t } = useTranslation();
    const { deleted, name, state } = dependency;

    return (
      <div ref={ref} className={clsx('dependency-node', deleted && 'dependency-node--deleted')}>
        <div className="dependency-node__header">
          {deleted ? (
            <span className="dependency-node__name" title={name}>
              {name}
            </span>
          ) : (
            <button
              type="button"
              className="dependency-node__name dependency-node__name--link"
              title={name}
              onClick={() => onOpen(dependency)}
            >
              {name}
            </button>
          )}
          <ServiceStatusButton
            state={deleted || !state ? 'deleted' : state}
            isLoading={isBeingChecked}
            onClick={() => onChangeStatus(dependency)}
          />
        </div>
        <div className="dependency-node__footer">
          {deleted ? (
            <span className="dependency-node__problem">
              <MdOutlineWarningAmber aria-hidden />
              {t('overview.dependencies.deletedReference')}
            </span>
          ) : (
            <DependencyCounts
              incoming={dependency.incomingCount}
              outgoing={dependency.outgoingCount}
              onClick={() => onLocate(dependency)}
            />
          )}
        </div>
      </div>
    );
  },
);

DependencyNode.displayName = 'DependencyNode';

export default DependencyNode;
