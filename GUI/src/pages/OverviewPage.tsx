import withAuthorization, { ROLES } from 'hoc/with-authorization';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { importServices } from 'utils/service-import';

import { Button, ExportServicesModal, Track } from '../components';
import ServicesTable from '../components/ServicesTable';
import { ROUTES } from '../resources/routes-constants';

const OverviewPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);

  const triggerFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  return (
    <div className="overview-page">
      <Track justify="between">
        <h1>{t('overview.services')}</h1>
        <Track gap={12}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={importServices}
            accept=".json"
            style={{ display: 'none' }}
            multiple
          />
          <Button onClick={triggerFileInput} appearance="outline" style={{ padding: '8px 20px' }}>
            {t('overview.importMany')}
          </Button>
          <Button onClick={() => setIsExportModalVisible(true)} appearance="outline" style={{ padding: '8px 20px' }}>
            {t('overview.exportMany')}
          </Button>
          <Button onClick={() => navigate(ROUTES.NEWSERVICE_ROUTE)} style={{ padding: '8px 20px' }}>
            {t('overview.create')}
          </Button>
        </Track>
      </Track>
      <ServicesTable />
      <ExportServicesModal isVisible={isExportModalVisible} onClose={() => setIsExportModalVisible(false)} />
    </div>
  );
};

const AuthorizedOverviewPage = withAuthorization(OverviewPage, [ROLES.ROLE_ADMINISTRATOR, ROLES.ROLE_SERVICE_MANAGER]);
export default AuthorizedOverviewPage;
