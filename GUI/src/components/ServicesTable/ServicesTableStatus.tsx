import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '..';

const SKELETON_ROW_WIDTHS = [
  [62, 84],
  [48, 70],
  [70, 90],
  [54, 66],
  [40, 78],
  [58, 74],
];

const SkeletonCell: FC<{ columnId: string; widths: number[] }> = ({ columnId, widths: [first, second] }) => {
  switch (columnId) {
    case 'expander':
      return null;
    case 'name':
      return (
        <>
          <span className="services-skeleton__bar" style={{ width: `${first}%` }} />
          <span className="services-skeleton__bar services-skeleton__bar--sub" style={{ width: `${second}%` }} />
        </>
      );
    case 'dependencies':
      return (
        <span className="services-skeleton__group">
          <span className="services-skeleton__bar services-skeleton__bar--chip" />
          <span className="services-skeleton__bar services-skeleton__bar--chip" />
        </span>
      );
    case 'state':
      return <span className="services-skeleton__bar services-skeleton__bar--pill" />;
    default:
      return <span className="services-skeleton__bar" style={{ width: `${first}%` }} />;
  }
};

export const ServicesTableSkeleton: FC<{ columnIds: string[] }> = ({ columnIds }) => (
  <>
    {SKELETON_ROW_WIDTHS.map((widths, index) => (
      <tr key={index} className="services-skeleton" aria-hidden="true">
        {columnIds.map((columnId) => (
          <td key={columnId} className={`services-table__col--${columnId}`}>
            <SkeletonCell columnId={columnId} widths={widths} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

const ErrorIllustration: FC = () => (
  <svg className="services-state__illustration" viewBox="0 0 200 120" aria-hidden="true">
    <rect className="ill-surface" x="10" y="36" width="58" height="48" rx="9" />
    <rect className="ill-muted" x="20" y="48" width="32" height="6" rx="3" />
    <rect className="ill-muted" x="20" y="60" width="22" height="6" rx="3" />
    <rect className="ill-muted" x="20" y="72" width="28" height="4" rx="2" />
    <rect className="ill-surface" x="132" y="36" width="58" height="48" rx="9" />
    <rect className="ill-muted" x="142" y="48" width="32" height="6" rx="3" />
    <rect className="ill-muted" x="142" y="60" width="22" height="6" rx="3" />
    <rect className="ill-muted" x="142" y="72" width="28" height="4" rx="2" />
    <g className="ill-plug">
      <path className="ill-accent-stroke" d="M68 60 H88" strokeWidth="3" strokeLinecap="round" fill="none" />
      <rect className="ill-accent-fill" x="86" y="53" width="10" height="14" rx="3" />
      <path className="ill-accent-stroke" d="M96 56.5 h5 M96 63.5 h5" strokeWidth="2.5" strokeLinecap="round" />
    </g>
    <g className="ill-socket">
      <path className="ill-accent-stroke" d="M114 60 H132" strokeWidth="3" strokeLinecap="round" fill="none" />
      <rect className="ill-soft-fill ill-accent-stroke" x="104" y="53" width="10" height="14" rx="3" strokeWidth="2" />
    </g>
    <g className="ill-spark ill-danger-stroke" strokeWidth="2" strokeLinecap="round">
      <path d="M102 44 l-2 -6" />
      <path d="M107 45 l3 -6" />
      <path d="M99 76 l-3 5" />
      <path d="M106 76 l2 6" />
    </g>
    <g className="ill-badge">
      <circle className="ill-danger-fill" cx="188" cy="38" r="9" />
      <path d="M188 33.5 v5.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="188" cy="42.6" r="1.3" fill="#fff" />
    </g>
  </svg>
);

const NoMatchIllustration: FC = () => (
  <svg className="services-state__illustration" viewBox="0 0 200 120" aria-hidden="true">
    <path className="ill-edge" d="M40 34 L96 22 M96 22 L160 40 M40 34 L58 92 M58 92 L142 96 M160 40 L142 96" />
    <rect className="ill-surface ill-ghost" x="26" y="26" width="28" height="18" rx="5" />
    <rect className="ill-surface ill-ghost ill-ghost--2" x="82" y="13" width="28" height="18" rx="5" />
    <rect className="ill-surface ill-ghost ill-ghost--3" x="146" y="31" width="28" height="18" rx="5" />
    <rect className="ill-surface" x="44" y="83" width="28" height="18" rx="5" opacity=".5" />
    <rect className="ill-surface" x="128" y="87" width="28" height="18" rx="5" opacity=".5" />
    <g className="ill-lens">
      <circle r="19" className="ill-soft-fill" opacity=".9" />
      <circle r="19" fill="none" className="ill-accent-stroke" strokeWidth="3.5" />
      <path d="M13.5 13.5 L27 27" className="ill-accent-stroke" strokeWidth="6" strokeLinecap="round" />
      <path d="M-6 0 h12" className="ill-accent-stroke" strokeWidth="2.5" strokeLinecap="round" opacity=".55" />
    </g>
  </svg>
);

const EmptyIllustration: FC = () => (
  <svg className="services-state__illustration" viewBox="0 0 200 120" aria-hidden="true">
    <path className="ill-edge ill-reach" d="M44 26 L72 44" />
    <path className="ill-edge ill-reach ill-reach--2" d="M156 26 L128 44" />
    <path className="ill-edge ill-reach ill-reach--3" d="M100 112 L100 90" />
    <rect className="ill-surface ill-reach" x="20" y="14" width="30" height="18" rx="5" />
    <rect className="ill-surface ill-reach ill-reach--2" x="150" y="14" width="30" height="18" rx="5" />
    <rect className="ill-surface ill-reach ill-reach--3" x="85" y="104" width="30" height="14" rx="5" />
    <rect
      className="ill-halo ill-accent-stroke"
      x="70"
      y="32"
      width="60"
      height="56"
      rx="12"
      fill="none"
      strokeWidth="2"
    />
    <rect
      className="ill-soft-fill ill-accent-stroke ill-march"
      x="70"
      y="32"
      width="60"
      height="56"
      rx="12"
      strokeWidth="2"
    />
    <path d="M100 48 v24 M88 60 h24" className="ill-accent-stroke" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

type ServicesTableStateProps = {
  readonly colSpan: number;
  readonly illustration: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly actions: ReactNode;
};

const ServicesTableState: FC<ServicesTableStateProps> = ({ colSpan, illustration, title, description, actions }) => (
  <tr className="services-state-row">
    <td colSpan={colSpan}>
      <div className="services-state">
        {illustration}
        <h2 className="services-state__title">{title}</h2>
        <p className="services-state__description">{description}</p>
        <div className="services-state__actions">{actions}</div>
      </div>
    </td>
  </tr>
);

export const ServicesLoadError: FC<{ colSpan: number; onRetry: () => void }> = ({ colSpan, onRetry }) => {
  const { t } = useTranslation();
  return (
    <ServicesTableState
      colSpan={colSpan}
      illustration={<ErrorIllustration />}
      title={t('overview.tableState.error.title')}
      description={t('overview.tableState.error.description')}
      actions={<Button onClick={onRetry}>{t('overview.tableState.error.retry')}</Button>}
    />
  );
};

export const ServicesNoMatch: FC<{ colSpan: number; search: string; onClearFilters: () => void }> = ({
  colSpan,
  search,
  onClearFilters,
}) => {
  const { t } = useTranslation();
  return (
    <ServicesTableState
      colSpan={colSpan}
      illustration={<NoMatchIllustration />}
      title={
        search
          ? t('overview.tableState.noMatch.titleWithSearch', { search, interpolation: { escapeValue: false } })
          : t('overview.tableState.noMatch.title')
      }
      description={t('overview.tableState.noMatch.description')}
      actions={
        <Button appearance="secondary" onClick={onClearFilters}>
          {t('overview.filters.clear')}
        </Button>
      }
    />
  );
};

export const ServicesEmpty: FC<{ colSpan: number; onCreate: () => void }> = ({ colSpan, onCreate }) => {
  const { t } = useTranslation();
  return (
    <ServicesTableState
      colSpan={colSpan}
      illustration={<EmptyIllustration />}
      title={t('overview.tableState.empty.title')}
      description={t('overview.tableState.empty.description')}
      actions={<Button onClick={onCreate}>{t('overview.create')}</Button>}
    />
  );
};
