import { FormSelect } from 'components';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdClose } from 'react-icons/md';
import { DEFAULT_SERVICES_FILTERS, ServicesFilters } from 'store/services.store';

import { DEPENDENCY_FILTER_OPTIONS, hasActiveFilters, STATUS_FILTER_OPTIONS } from './filters';

const SEARCH_DEBOUNCE_MS = 300;

type ServicesFilterBarProps = {
  readonly filters: ServicesFilters;
  readonly onChange: (filters: ServicesFilters) => void;
};

const ServicesFilterBar: FC<ServicesFilterBarProps> = ({ filters, onChange }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState(filters.search);

  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === filters.search) return;
    const timeout = setTimeout(() => onChange({ ...filters, search: trimmed }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search, filters, onChange]);

  const dependencyOptions = useMemo(
    () => DEPENDENCY_FILTER_OPTIONS.map((value) => ({ value, label: t(`overview.filters.dependencies.${value}`) })),
    [t],
  );

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('overview.filters.status.all') },
      ...STATUS_FILTER_OPTIONS.map((state) => ({
        value: state as string,
        label: t(`overview.service.states.${state}`),
      })),
    ],
    [t],
  );

  return (
    <div className="services-filter-bar">
      <input
        type="search"
        className="services-filter-bar__search"
        value={search}
        placeholder={t('overview.filters.searchPlaceholder') ?? ''}
        aria-label={t('overview.filters.searchLabel') ?? ''}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="services-filter-bar__select">
        <FormSelect
          name="dependencies"
          label={t('overview.filters.dependenciesLabel')}
          hideLabel
          options={dependencyOptions}
          defaultValue={filters.dependencies}
          onSelectionChange={(selection) =>
            selection && onChange({ ...filters, dependencies: selection.value as ServicesFilters['dependencies'] })
          }
        />
      </div>
      <div className="services-filter-bar__select">
        <FormSelect
          name="state"
          label={t('overview.filters.statusLabel')}
          hideLabel
          options={statusOptions}
          defaultValue={filters.state}
          onSelectionChange={(selection) => selection && onChange({ ...filters, state: selection.value })}
        />
      </div>
      {(hasActiveFilters(filters) || search.trim() !== '') && (
        <button
          type="button"
          className="services-filter-bar__clear"
          aria-label={t('overview.filters.clear') ?? ''}
          title={t('overview.filters.clear') ?? ''}
          onClick={() => {
            setSearch('');
            onChange(DEFAULT_SERVICES_FILTERS);
          }}
        >
          <MdClose />
        </button>
      )}
    </div>
  );
};

export default ServicesFilterBar;
