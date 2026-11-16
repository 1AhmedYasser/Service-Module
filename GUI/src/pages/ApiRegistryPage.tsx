import { PaginationState, SortingState } from '@tanstack/react-table';
import { Button, Card, Modal, Track } from 'components';
import AddEndpointModal from 'components/Flow/EdgeTypes/AddEndpointModal';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EndpointData } from 'types/endpoint';

import useApiRegistryStore from '../store/api-registry.store';
import useToastStore from '../store/toasts.store';
import ApiRegistryTable from './ApiRegistryPage/ApiRegistryTable';

const INDEX_STATUS_POLL_INTERVAL_MS = 5000;

const ApiRegistryPage: React.FC = () => {
  const { t } = useTranslation();
  const [deleteEndpoint, setDeleteEndpoint] = useState<EndpointData | null>(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<EndpointData | null>(null);
  const [search, setSearch] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }]);

  const endpoints = useApiRegistryStore((s) => s.endpoints);
  const verificationMap = useApiRegistryStore((s) => s.verificationMap);
  const totalPages = useApiRegistryStore((s) => s.totalPages);
  const loading = useApiRegistryStore((s) => s.loading);
  const loadEndpoints = useApiRegistryStore((s) => s.loadEndpoints);
  const testEndpoint = useApiRegistryStore((s) => s.testEndpoint);
  const copyEndpoint = useApiRegistryStore((s) => s.copyEndpoint);
  const deleteEndpointFromStore = useApiRegistryStore((s) => s.deleteEndpoint);
  const reIndexEndpoint = useApiRegistryStore((s) => s.reIndexEndpoint);

  useEffect(() => {
    const load = async () => {
      await loadEndpoints(pagination, sorting, search);
    };
    void load();
  }, [loadEndpoints, pagination, sorting, search]);

  // Forget rows when leaving the page, so failures that happened while away are not announced on return
  useEffect(() => () => useApiRegistryStore.setState({ endpoints: [] }), []);

  // While any attempt is Processing, poll so the indexing status updates without a page refresh
  const hasIndexingInProgress = endpoints.some((e) => e.llm_index_status === 'IN_PROGRESS');
  useEffect(() => {
    if (!hasIndexingInProgress) return;
    const timer = setInterval(() => {
      void loadEndpoints(pagination, sorting, search, { silent: true });
    }, INDEX_STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasIndexingInProgress, loadEndpoints, pagination, sorting, search]);

  const handlePageChange = useCallback(
    (state: PaginationState) => {
      if (state.pageSize === pagination.pageSize) {
        setPagination(state);
      } else {
        setPagination({ pageIndex: 0, pageSize: state.pageSize });
      }
    },
    [pagination.pageSize],
  );

  const handleTest = useCallback(
    async (endpoint: EndpointData) => {
      setTestingId(endpoint.endpointId);
      await testEndpoint(endpoint);
      setTestingId(null);
    },
    [testEndpoint],
  );

  const handleCopy = useCallback(
    (endpoint: EndpointData) => {
      copyEndpoint(endpoint).catch(() => {
        // error handled in store (toast notification shown)
      });
    },
    [copyEndpoint],
  );

  const handleEdit = useCallback((endpoint: EndpointData) => {
    setEditingEndpoint(endpoint);
  }, []);

  const handleDeleteClick = useCallback((endpoint: EndpointData) => {
    setDeleteEndpoint(endpoint);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteEndpoint) return;
    deleteEndpointFromStore(deleteEndpoint)
      .then(() => setDeleteEndpoint(null))
      .catch(() => {
        // error handled in store (toast notification shown)
      });
  }, [deleteEndpoint, deleteEndpointFromStore]);

  const handleReindex = useCallback(
    async (endpoint: EndpointData) => {
      await reIndexEndpoint(endpoint.endpointId);
    },
    [reIndexEndpoint],
  );

  return (
    <>
      <Track justify="between" align="center" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{t('apiRegistry.title')}</h1>
        <Button appearance="primary" onClick={() => setIsCreateModalVisible(true)}>
          {t('apiRegistry.createEndpoint')}
        </Button>
      </Track>
      <input
        type="search"
        placeholder={`${t('global.search')}...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #c8cbd8',
          borderRadius: 4,
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
          marginBottom: 16,
          display: 'block',
        }}
      />
      <Card>
        <ApiRegistryTable
          t={t}
          loading={loading}
          endpoints={endpoints}
          verificationMap={verificationMap}
          totalPages={totalPages}
          pagination={pagination}
          sorting={sorting}
          setPagination={handlePageChange}
          setSorting={setSorting}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onReIndex={handleReindex}
          onTest={handleTest}
          onCopy={handleCopy}
          testingId={testingId}
        />
      </Card>

      {deleteEndpoint && (
        <Modal title={t('apiRegistry.deleteConfirm')} onClose={() => setDeleteEndpoint(null)}>
          <Track justify="end" gap={16}>
            <Button appearance="secondary" onClick={() => setDeleteEndpoint(null)}>
              {t('overview.cancel')}
            </Button>
            <Button appearance="error" onClick={handleConfirmDelete}>
              {t('apiRegistry.actions.delete')}
            </Button>
          </Track>
        </Modal>
      )}

      {isCreateModalVisible && (
        <AddEndpointModal
          context="registry"
          mode="create"
          onClose={() => setIsCreateModalVisible(false)}
          onSaveSuccess={() => {
            const reload = async () => {
              await loadEndpoints(pagination, sorting, search);
            };
            void reload();
          }}
        />
      )}

      {editingEndpoint && (
        <AddEndpointModal
          context="registry"
          mode="edit"
          initialEndpoint={editingEndpoint}
          onClose={() => setEditingEndpoint(null)}
          onSaveSuccess={() => {
            setEditingEndpoint(null);
            loadEndpoints(pagination, sorting, search).catch(() => {
              useToastStore.getState().error({ title: t('global.notificationError') });
            });
          }}
        />
      )}
    </>
  );
};

export default ApiRegistryPage;
