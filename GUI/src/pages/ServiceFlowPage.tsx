import { ReactFlowProvider } from '@xyflow/react';
import withAuthorization, { ROLES } from 'hoc/with-authorization';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mosaic } from 'react-loading-indicators';
import { useNavigate, useParams } from 'react-router-dom';
import '@xyflow/react/dist/style.css';
import useServiceStore from 'store/new-services.store';
import useServiceListStore from 'store/services.store';

import { FlowBuilder, FlowElementsPopup, NewServiceHeader } from '../components';
import { ROUTES } from '../resources/routes-constants';
import './ServiceFlowPage.scss';
import ChooseSlotModel from './Integration/ChooseSlotModel';

const ServiceFlowPage: FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);

  const navigate = useNavigate();
  const [isChooseSlotsModalVisible, setIsChooseSlotsModalVisible] = useState(false);

  const { hasUnsavedChanges, setHasUnsavedChanges, handleProgrammaticNavigation } = useServiceStore();

  const { id } = useParams();

  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        await Promise.all([
          useServiceStore.getState().loadStepPreferences(),
          useServiceStore.getState().loadNavigableServiceIds(),
          useServiceStore.getState().loadAllEndpoints(
            false,
            1,
            10,
            'created_at asc',
            '', // To be added: search functionality in endpoints
          ),
        ]);
        return;
      }

      setLoading(true);
      await Promise.all([
        useServiceStore.getState().loadService(id),
        useServiceStore.getState().loadStepPreferences(),
        useServiceStore.getState().loadNavigableServiceIds(),
      ]);
      setLoading(false);
    };

    void loadData();

    // Cleanup function to reset state when component unmounts (including browser back button)
    return () => {
      useServiceStore.getState().resetState();
    };
  }, [id]);

  useEffect(() => {
    const handleFocus = () => {
      void useServiceStore.getState().loadNavigableServiceIds();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const edges = useServiceStore((state) => state.edges);
  const nodes = useServiceStore((state) => state.nodes);

  return (
    <>
      <NewServiceHeader
        activeStep={1}
        backOnClick={() => {
          if (hasUnsavedChanges) {
            handleProgrammaticNavigation(ROUTES.OVERVIEW_ROUTE);
          } else {
            useServiceStore.getState().resetState();
            navigate(ROUTES.OVERVIEW_ROUTE, { replace: true });
          }
        }}
        continueOnClick={() => {
          navigate(ROUTES.OVERVIEW_ROUTE, { replace: true });
          useServiceStore.getState().resetState();
        }}
        saveOnClick={async () => {
          setHasUnsavedChanges(false);
          if (id) {
            await useServiceStore.getState().loadService(id);
          } else {
            const serviceId = useServiceStore.getState().serviceId;
            const serviceResponse = await useServiceStore.getState().loadService(serviceId);
            if (serviceResponse) {
              useServiceListStore.getState().setSelectedService(serviceResponse?.data);
              navigate(ROUTES.replaceWithId(ROUTES.EDITSERVICE_ROUTE, serviceId));
            }
          }
        }}
      />
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Mosaic
            color="#005aa3"
            size="medium"
            text={`${t('global.loading')}...`}
            textColor="black"
            style={{ textAlign: 'end' }}
          />
        </div>
      ) : (
        <>
          <FlowElementsPopup />
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <ReactFlowProvider>
              <div style={{ width: '100%', height: '99%' }}>
                <FlowBuilder nodes={nodes} edges={edges} />
              </div>
            </ReactFlowProvider>
          </div>
          {isChooseSlotsModalVisible && (
            <ChooseSlotModel
              onModalClose={(selection) => {
                if (selection) {
                  setHasUnsavedChanges(true);
                }
                setIsChooseSlotsModalVisible(false);
              }}
            />
          )}
        </>
      )}
    </>
  );
};

const AuthorizedServiceFlowPage = withAuthorization(ServiceFlowPage, [
  ROLES.ROLE_ADMINISTRATOR,
  ROLES.ROLE_SERVICE_MANAGER,
]);
export default AuthorizedServiceFlowPage;
