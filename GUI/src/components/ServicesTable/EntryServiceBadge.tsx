import Tooltip from 'components/Tooltip';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlinedFlag } from 'react-icons/md';

import './EntryServiceBadge.scss';

const EntryServiceBadge: FC = () => {
  const { t } = useTranslation();

  return (
    <Tooltip content={t('newService.entryService.tooltip')}>
      <span className="entry-service-badge">
        <MdOutlinedFlag aria-hidden />
        {t('newService.entryService.title')}
      </span>
    </Tooltip>
  );
};

export default EntryServiceBadge;
