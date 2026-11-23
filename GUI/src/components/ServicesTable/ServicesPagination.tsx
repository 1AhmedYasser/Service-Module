import clsx from 'clsx';
import { FC, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlineEast, MdOutlineWest } from 'react-icons/md';

type ServicesPaginationProps = {
  readonly pageIndex: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly totalCount: number;
  readonly pageSizeOptions: number[];
  readonly onPageChange: (pageIndex: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
};

type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

const SIBLINGS = 2;

const getPageItems = (pageIndex: number, pageCount: number): PageItem[] => {
  const maxVisible = SIBLINGS * 2 + 5;
  if (pageCount <= maxVisible) return Array.from({ length: pageCount }, (_, i) => i);

  const start = Math.max(1, Math.min(pageIndex - SIBLINGS, pageCount - 2 - SIBLINGS * 2));
  const end = Math.min(pageCount - 2, Math.max(pageIndex + SIBLINGS, 1 + SIBLINGS * 2));
  const middle = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return [
    0,
    ...(start > 1 ? (['ellipsis-start'] as const) : []),
    ...middle,
    ...(end < pageCount - 2 ? (['ellipsis-end'] as const) : []),
    pageCount - 1,
  ];
};

const ServicesPagination: FC<ServicesPaginationProps> = ({
  pageIndex,
  pageSize,
  pageCount,
  totalCount,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}) => {
  const { t } = useTranslation();
  const pageSizeId = useId();
  const from = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalCount);

  return (
    <div className="services-pagination">
      <div className="services-pagination__pages">
        {pageCount > 1 && (
          <>
            <button
              type="button"
              className="services-pagination__arrow"
              aria-label={t('overview.pagination.previous') ?? ''}
              disabled={pageIndex === 0}
              onClick={() => onPageChange(pageIndex - 1)}
            >
              <MdOutlineWest />
            </button>
            <nav aria-label={t('global.paginationNavigation') ?? ''}>
              <ul className="services-pagination__links">
                {getPageItems(pageIndex, pageCount).map((item) =>
                  typeof item === 'number' ? (
                    <li key={item}>
                      <button
                        type="button"
                        className={clsx('services-pagination__page', item === pageIndex && 'is-active')}
                        aria-label={t('overview.pagination.page', { page: item + 1 }) ?? ''}
                        aria-current={item === pageIndex ? 'page' : undefined}
                        onClick={() => onPageChange(item)}
                      >
                        {item + 1}
                      </button>
                    </li>
                  ) : (
                    <li key={item} className="services-pagination__ellipsis" aria-hidden>
                      …
                    </li>
                  ),
                )}
              </ul>
            </nav>
            <button
              type="button"
              className="services-pagination__arrow"
              aria-label={t('overview.pagination.next') ?? ''}
              disabled={pageIndex >= pageCount - 1}
              onClick={() => onPageChange(pageIndex + 1)}
            >
              <MdOutlineEast />
            </button>
          </>
        )}
      </div>
      <div className="services-pagination__summary">
        <span>{t('overview.pagination.range', { from, to, total: totalCount })}</span>
        <span className="services-pagination__divider" aria-hidden />
        <label htmlFor={pageSizeId}>{t('overview.pagination.pageSize')}</label>
        <select id={pageSizeId} value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ServicesPagination;
