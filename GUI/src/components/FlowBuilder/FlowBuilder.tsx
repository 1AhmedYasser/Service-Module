import { Background, ColorMode, Controls, Edge, MiniMap, Node, Panel, ReactFlow, useReactFlow } from '@xyflow/react';
import { Button, Icon, Modal, Switch, ThemeToggle, Tooltip, Track } from 'components';
import Chat from 'components/chat/chat';
import CopyPasteControls from 'components/Flow/Controls/CopyPasteControls';
import ImportExportControls from 'components/Flow/Controls/ImportExportControls';
import LassoSelectionControls from 'components/Flow/Controls/LassoSelectionControls';
import UndoRedoControls from 'components/Flow/Controls/UndoRedoControls';
import edgeTypes from 'components/Flow/EdgeTypes';
import { Lasso } from 'components/Flow/LassoSelection/Lasso';
import McqBranchSelectModal from 'components/Flow/McqBranchSelectModal';
import nodeTypes from 'components/Flow/NodeTypes';
import useLayout from 'hooks/flow/useLayout';
import useMcqConnect from 'hooks/flow/useMcqConnect';
import { useNodeHighlight } from 'hooks/flow/useNodeHighlight';
import { useOnNodesDelete } from 'hooks/flow/useOnNodeDelete';
import { ChangeEventHandler, FC, useCallback, useEffect, useState } from 'react';
import '@xyflow/react/dist/style.css';
import { useTranslation } from 'react-i18next';
import { MdCenterFocusStrong, MdOutlineCenterFocusStrong } from 'react-icons/md';
import useNewServiceStore from 'store/new-services.store';
import useServiceStore from 'store/services.store';
import { StepType } from 'types';
import { applySimpleConnection } from 'utils/mcq-flow-utils';
import '../Flow/LassoSelection/Lasso.css';
import './FlowBuilder.scss';

import { useThemeSyncWithFlow } from '../../hooks/useThemeSyncWithFlow';
import HorizontalFlow from '../../static/icons/horizontal_flow.svg';
import VerticalFlow from '../../static/icons/vertical_flow.svg';

type FlowBuilderProps = {
  nodes: Node[];
  edges: Edge[];
};

const FlowBuilder: FC<FlowBuilderProps> = ({ nodes, edges }) => {
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();
  const setReactFlowInstance = useNewServiceStore((state) => state.setReactFlowInstance);
  const [colorMode, setColorMode] = useState<ColorMode>('light');
  const { t } = useTranslation();

  useThemeSyncWithFlow();

  const {
    onNodesDelete,
    onEdgesDelete,
    isDeleteConnectionsModalVisible,
    setIsDeleteConnectionsModalVisible,
    onDeleteConfirmed,
    onKeepItConfirmed,
    hasConnectedNodes,
    setDeletedNodes,
    setNodeToDelete,
  } = useOnNodesDelete();
  const [isLassoActive, setIsLassoActive] = useState(false);
  const { saveToHistory, historyIndex, setFlowSelectedNodes, setHasUnsavedChanges } = useNewServiceStore();
  const orientation = useServiceStore((state) => state.orientation);
  const toggleOrientation = useServiceStore((state) => state.toggleOrientation);
  const { runLayout } = useLayout(orientation);
  const autoView = useServiceStore((state) => state.autoView);
  const toggleAutoView = useServiceStore((state) => state.toggleAutoView);
  const { fitView } = useReactFlow();

  const { pendingConnection, handleConnect, isValidConnection, confirmBranch, cancelBranchSelection } = useMcqConnect();
  const { displayNodes, displayEdges, handleNodeClick, handlePaneClick } = useNodeHighlight(nodes, edges);

  const onConnect = useCallback(
    (connection: { source?: string | null; target?: string | null; sourceHandle?: string | null }) => {
      if (handleConnect(connection)) return;

      const nodes = getNodes();
      const edges = getEdges();
      const { nodes: finalNodes, edges: finalEdges } = applySimpleConnection({
        nodes,
        edges,
        connection,
      });

      setNodes(finalNodes);
      setEdges(finalEdges);
      setHasUnsavedChanges(true);
      saveToHistory({ nodes: finalNodes, edges: finalEdges });
    },
    [getEdges, getNodes, handleConnect, setEdges, setHasUnsavedChanges, setNodes, saveToHistory],
  );

  const zIndexStyle = { zIndex: 20 };

  const onChange: ChangeEventHandler<HTMLSelectElement> = (evt) => {
    setColorMode(evt.target.value as ColorMode);
  };

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      setFlowSelectedNodes(selectedNodes);
    },
    [setFlowSelectedNodes],
  );

  const onBeforeDelete = useCallback(
    ({ nodes: nodesToDelete }: { nodes: Node[]; edges: Edge[] }) => {
      setDeletedNodes(null);
      try {
        if (
          nodesToDelete.length === 0 ||
          ![StepType.MultiChoiceQuestion, StepType.Condition, StepType.Input].includes(
            nodesToDelete[0]?.data.stepType as StepType,
          )
        )
          return Promise.resolve(true);

        const shouldPreventDelete = hasConnectedNodes(nodesToDelete[0].id);
        if (shouldPreventDelete) {
          setDeletedNodes(nodesToDelete);
          setIsDeleteConnectionsModalVisible(true);
        }
        return Promise.resolve(!shouldPreventDelete);
      } catch (error) {
        console.error('Error in onBeforeDelete:', error);
        return Promise.resolve(true);
      }
    },
    [hasConnectedNodes, setDeletedNodes, setIsDeleteConnectionsModalVisible],
  );

  const handleToggleLasso = useCallback(() => {
    setIsLassoActive((prev) => !prev);
  }, []);

  useEffect(() => {
    runLayout();
  }, [historyIndex, runLayout]);

  return (
    <>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={useNewServiceStore.getState().onNodesChange}
        onEdgesChange={useNewServiceStore.getState().onEdgesChange}
        snapToGrid
        proOptions={{ hideAttribution: true }}
        panOnScroll
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={async (instance) => {
          setReactFlowInstance(instance);
          useNewServiceStore.getState().loadEndpointsResponseVariables();
          await fitView({ duration: 200, padding: 5 });
        }}
        nodesDraggable={false}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onSelectionChange={onSelectionChange}
        onConnect={onConnect}
        onEdgesDelete={(edges) => {
          onEdgesDelete(edges);
          setHasUnsavedChanges(true);
          setTimeout(() => saveToHistory(), 0);
        }}
        onBeforeDelete={onBeforeDelete}
        onNodesDelete={(nodes) => {
          onNodesDelete(nodes);
          setHasUnsavedChanges(true);
          setTimeout(() => saveToHistory(), 0);
        }}
        fitView
        fitViewOptions={{ padding: 5 }}
        colorMode={colorMode}
        isValidConnection={isValidConnection}
        defaultEdgeOptions={{ type: 'step', deletable: false }}
      >
        <Chat />
        <MiniMap className={'minimap'} />
        <Background color="#D2D3D8" gap={16} lineWidth={9} />
        {isLassoActive && <Lasso />}
        <Panel position="top-left" style={zIndexStyle}>
          <Track gap={10} direction="vertical" align="left">
            <ImportExportControls />
            <CopyPasteControls onNodesDelete={onNodesDelete} />
            <UndoRedoControls />
          </Track>
        </Panel>
        <Panel position="top-right" style={{ zIndex: 20, marginRight: '30px' }}>
          <Track gap={10} direction="vertical" align="right">
            <LassoSelectionControls isLassoActive={isLassoActive} onToggleLasso={handleToggleLasso} />
            <ThemeToggle onChange={onChange} />
            <Tooltip content={t('serviceFlow.orientationTooltip')}>
              <Button onClick={toggleOrientation} size="s" style={{ backgroundColor: '#005aa3', height: '36px' }}>
                <img
                  src={orientation === 'horizontal' ? HorizontalFlow : VerticalFlow}
                  width={32}
                  className="logo"
                  loading="eager"
                  alt="orientation toggle"
                />
              </Button>
            </Tooltip>
          </Track>
        </Panel>
        <Panel position="bottom-left">
          <Track gap={10} direction="horizontal" align="center" style={{}}>
            <Controls
              orientation="horizontal"
              showInteractive={false}
              style={{ marginLeft: '0' }}
              className={'zoom-controls'}
              fitViewOptions={{ padding: 5 }}
            />
            <div className={'center-controls'}>
              <Tooltip content={t('serviceFlow.autoFocus')}>
                <span>
                  <Switch
                    checked={autoView}
                    onCheckedChange={toggleAutoView}
                    onLabel={<Icon icon={<MdCenterFocusStrong fontSize={30} />} size="medium" />}
                    offLabel={<Icon icon={<MdOutlineCenterFocusStrong fontSize={30} />} size="medium" />}
                  />
                </span>
              </Tooltip>
            </div>
          </Track>
        </Panel>
      </ReactFlow>
      {isDeleteConnectionsModalVisible && (
        <Modal
          title={t('overview.popup.deleteNodeConnections')}
          onClose={() => {
            setNodeToDelete(null);
            setIsDeleteConnectionsModalVisible(false);
          }}
        >
          <Track justify="end" gap={16}>
            <Button appearance="primary" onClick={onDeleteConfirmed}>
              {t('global.delete')}
            </Button>
            <Button appearance="primary" onClick={onKeepItConfirmed}>
              {t('global.keepIt')}
            </Button>
          </Track>
        </Modal>
      )}
      {pendingConnection && (
        <McqBranchSelectModal
          emptyBranches={pendingConnection.emptyBranches}
          onSelect={confirmBranch}
          onClose={cancelBranchSelection}
          description={
            pendingConnection.nodeType === StepType.Condition
              ? t('serviceFlow.condition.emptyPathsMessage', { count: pendingConnection.emptyBranches.length })
              : undefined
          }
        />
      )}
    </>
  );
};

export default FlowBuilder;
