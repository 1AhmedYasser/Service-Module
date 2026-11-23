import clsx from 'clsx';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MdCheck, MdClose } from 'react-icons/md';
import { ServiceIndexStatus } from 'types/service';

import { ReactComponent as RefreshIcon } from '../../static/icons/referesh.svg';
import Tooltip from '../Tooltip';

type IndexStatusProps = {
  readonly status?: ServiceIndexStatus | null;
  readonly failureReason?: string | null;
  readonly canReindex: boolean;
  readonly onReindex?: () => void;
};

const STATUS_GLYPHS: Record<ServiceIndexStatus, ReactNode> = {
  SUCCESS: <MdCheck />,
  FAILED: <MdClose />,
  IN_PROGRESS: <span className="index-status__dot" />,
};

const IndexStatusIcon: FC<{ readonly status?: ServiceIndexStatus | null }> = ({ status }) => {
  const { t } = useTranslation();
  const title = t(`overview.index.status.${status ?? 'NONE'}`) ?? '';
  const icon = status ? STATUS_GLYPHS[status] : null;

  return (
    <span
      className={clsx('index-status__icon', `index-status__icon--${status?.toLowerCase() ?? 'none'}`)}
      title={title}
      aria-label={title}
    >
      {icon}
    </span>
  );
};

const IndexStatus: FC<IndexStatusProps> = ({ status, failureReason, canReindex, onReindex }) => {
  const { t } = useTranslation();

  const reindexButton = (
    <button
      type="button"
      className={clsx('services-table__text-action', 'index-status__reindex')}
      disabled={!canReindex || status === 'IN_PROGRESS'}
      title={canReindex ? undefined : (t('overview.index.reindexOnlyActive') ?? '')}
      onClick={onReindex}
    >
      <RefreshIcon className="index-status__reindex-icon" aria-hidden />
      {t('overview.index.reindex')}
    </button>
  );

  // Hovering the indexing button on a failed row shows the latest failure reason
  const failureText = failureReason
    ? t('overview.index.failureReason', { reason: failureReason })
    : t('overview.index.failureUnknown');

  return (
    <span className="index-status">
      <IndexStatusIcon status={status} />
      {status === 'FAILED' ? (
        <Tooltip content={failureText}>
          <span style={{ display: 'inline-flex' }}>{reindexButton}</span>
        </Tooltip>
      ) : (
        reindexButton
      )}
    </span>
  );
};

export default IndexStatus;
