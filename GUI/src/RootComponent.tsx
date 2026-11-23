import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Layout } from './components';
import ApiRegistryPage from './pages/ApiRegistryPage';
import FaultyServicesPage from './pages/FaultyServicesPage';
import NotFoundPage from './pages/NotFoundPage';
import OverviewPage from './pages/OverviewPage';
import ServiceFlowPage from './pages/ServiceFlowPage';
import ServiceSettingPage from './pages/ServiceSettingPage';
import { ROUTES } from './resources/routes-constants';

import './styles/main.scss';

const RootComponent: React.FC = () => {
  const location = useLocation();

  return (
    <Routes>
      <Route path={'/'} element={<Navigate to={ROUTES.OVERVIEW_ROUTE} />} />
      <Route index element={<Navigate to={ROUTES.OVERVIEW_ROUTE} />} />
      <Route path={ROUTES.NEWSERVICE_ROUTE} element={<ServiceFlowPage key={location.key} />} />
      <Route path={ROUTES.NEWSERVICE_ROUTE_WITH_INTENT_NAME} element={<ServiceFlowPage />} />
      <Route path={ROUTES.EDITSERVICE_ROUTE} element={<ServiceFlowPage />} />
      <Route path={ROUTES.FLOW_ROUTE} element={<ServiceFlowPage />} />
      <Route element={<Layout />}>
        <Route path={'/service'} element={<Navigate to="/services/overview" />} />
        <Route path={ROUTES.OVERVIEW_ROUTE} element={<OverviewPage />} />
        <Route path={ROUTES.API_REGISTRY_ROUTE} element={<ApiRegistryPage />} />
        <Route path={ROUTES.FAULTY_SERVICES_ROUTE} element={<FaultyServicesPage />} />
        <Route path={ROUTES.SERVICE_SETTINGS} element={<ServiceSettingPage />} />
        <Route path={ROUTES.FAULTY_SERVICES_ROUTE} element={<FaultyServicesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

export default RootComponent;
