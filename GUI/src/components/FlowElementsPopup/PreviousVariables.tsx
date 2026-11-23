import { Edge, Node } from '@xyflow/react';
import Collapsible from 'components/Collapsible';
import OutputElementBox from 'components/OutputElementBox';
import { CSSProperties, FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { environmentVariables, helperVariables } from 'resources/variables-constants';
import { StepType } from 'types';
import { EndpointResponseVariable } from 'types/endpoint/endpoint-response-variables';
import { NodeDataProps } from 'types/service-flow';
import { getHelperTooltips } from 'utils/constants';
import { getTypeColor, isObject } from 'utils/object-util';
import { stringToTemplate, templateToString } from 'utils/string-util';
import { v4 } from 'uuid';

import DateTimeBuilder from './DateTimeBuilder';
import { ObjectTree } from './ObjectTree';
import useServiceStore from '../../store/new-services.store';
import { Assign } from '../../types/assign';
import { useTheme } from '../../utils/useTheme';
import Tooltip from '../Tooltip';
import Track from '../Track';

import '../../styles/settings/variables/_colors.scss';

type PreviousVariablesProps = {
  readonly node: Node<NodeDataProps>;
};

// Unique key for predefined elements, used below to identify it
// All other assign element keys are UUIDs
const predefinedInputKeys = ['-1', '-2', '-3', '-4', '-5', '-6'];

const PreviousVariables: FC<PreviousVariablesProps> = ({ node }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  let endpointsVariables = useServiceStore((state) => state.endpointsResponseVariables);
  const nodes = useServiceStore((state) => state.nodes);
  const edges = useServiceStore((state) => state.edges);
  const serviceName = useServiceStore((state) => state.name);
  const [endpoints, setEndpoints] = useState<EndpointResponseVariable[]>([]);
  const [assignedVariables, setAssignedVariables] = useState<Assign[]>([]);
  const [endpointsObjectTree, setEndpointsObjectTree] = useState<{
    data: unknown;
    path: string | number;
  } | null>(null);
  const [assignedObjectTree, setAssignedObjectTree] = useState<{ data: unknown; path: string | number } | null>(null);
  // New elements added in Assign node before saving
  const newAssignElements = useServiceStore((state) => state.assignElements);
  const helperVariablesWithTooltips = helperVariables.map((variable, index) => {
    return {
      ...variable,
      tooltip: getHelperTooltips()[index],
    };
  });

  useEffect(() => {
    function getCurrentBranchNodesUp(nodes: Node[], edges: Edge[], currentNode: Node) {
      const branchNodes: Node[] = [];
      let parentNode: Node | undefined = getParentNode(nodes, edges, currentNode);

      while (parentNode) {
        if (parentNode.data?.stepType === StepType.MultiChoiceQuestion) {
          break;
        }
        branchNodes.unshift(parentNode);
        parentNode = getParentNode(nodes, edges, parentNode);
      }

      return branchNodes;
    }

    const currentNodeIndex = nodes.findIndex((n) => n.id === node.id);

    const currentNode = nodes[currentNodeIndex];

    const startIndex = nodes.findLastIndex(
      (node, i) => i < currentNodeIndex && node.data.stepType === StepType.MultiChoiceQuestion,
    ) as number;

    let previousNodes = nodes.slice(startIndex === -1 ? 0 : startIndex, currentNodeIndex);

    if (startIndex !== -1) {
      previousNodes = getCurrentBranchNodesUp(nodes, edges, currentNode);
    }

    // Get Endpoints variables
    const endpointNodes = previousNodes.filter((node) => node.data.stepType === StepType.UserDefined);
    const previousEndpointsVariables = endpointNodes.flatMap((endpointNode) => {
      const variable = endpointsVariables.find((endpoint) => endpoint.nodeId === endpointNode.id);
      return variable ? [{ ...variable, name: endpointNode.data.label?.toString() ?? variable.name }] : [];
    });
    setEndpoints(previousEndpointsVariables);

    // Get Assign variables
    const assignNodes: Node<NodeDataProps>[] =
      (previousNodes.filter((node) => node.data.stepType === StepType.Assign) as Node<NodeDataProps>[]) ?? [];
    const assignElements = assignNodes
      .map((node) => node.data.assignElements)
      .filter((elements): elements is Assign[] => elements !== undefined)
      .flat();
    const predefinedInputElements: Assign[] = [
      {
        id: predefinedInputKeys[0],
        key: 'input',
        value: stringToTemplate('incoming.body.input'),
        // Can only be a string array, see trigger-service.yaml in Buerokratt-Chatbot
        // Value is not known at this point, so passing a dummy to correctly infer type
        data: [],
      },
      {
        id: predefinedInputKeys[1],
        key: 'Empty Content Type',
        value: stringToTemplate(''),
      },
      {
        id: predefinedInputKeys[2],
        key: 'Chat Id',
        value: stringToTemplate('chatId'),
      },
      {
        id: predefinedInputKeys[3],
        key: 'Nonce Key',
        value: 'x-ruuter-nonce',
      },
      {
        id: predefinedInputKeys[4],
        key: 'Nonce Value',
        value: stringToTemplate('nonce'),
      },
      {
        id: predefinedInputKeys[5],
        key: 'Service Name',
        value: serviceName,
      },
    ];

    setAssignedVariables([...assignElements, ...predefinedInputElements, ...newAssignElements]);
  }, [edges, endpointsVariables, newAssignElements, node.id, nodes, serviceName]);

  function getParentNode(nodes: Node[], edges: Edge[], node: Node): Node | undefined {
    const parentEdge = edges.findLast((edge) => edge.target === node.id);
    return parentEdge ? nodes.findLast((n) => n.id === parentEdge.source) : undefined;
  }

  const popupBodyCss: CSSProperties = {
    padding: 16,
    backgroundColor: theme === 'dark' ? 'var(--dark-bg-main)' : '#F9F9F9',
    width: '100%',
  };

  const border = '1px solid #D2D3D8';

  return (
    <Track direction="vertical" align="stretch">
      {assignedVariables.length > 0 && (
        <VariableSection
          title={t('serviceFlow.previousVariables.assignElements')}
          variables={[...assignedVariables]}
          assignedObjectTree={assignedObjectTree}
          setAssignedObjectTree={setAssignedObjectTree}
          popupBodyCss={popupBodyCss}
          border={border}
          isAssignSection={true}
        />
      )}
      {node.data.stepType === StepType.Assign && (
        <>
          <VariableSection
            title={t('serviceFlow.previousVariables.environmentVariables.title')}
            variables={[...environmentVariables]}
            assignedObjectTree={assignedObjectTree}
            setAssignedObjectTree={setAssignedObjectTree}
            popupBodyCss={popupBodyCss}
            border={border}
          />
          <Collapsible
            title={t('serviceFlow.previousVariables.dateAndTime.title')}
            appearance="normal"
            defaultOpen={false}
            contentStyle={{ padding: '0px' }}
            headerDivider={false}
            style={{ borderRadius: '0px', borderBottom: '1px solid #d2d3d8', borderTop: '0px' }}
          >
            <DateTimeBuilder border={border} popupBodyCss={popupBodyCss} />
          </Collapsible>
          <VariableSection
            title={t('serviceFlow.previousVariables.helpers.title')}
            variables={[...helperVariablesWithTooltips]}
            assignedObjectTree={assignedObjectTree}
            setAssignedObjectTree={setAssignedObjectTree}
            popupBodyCss={popupBodyCss}
            border={border}
          />
          {isObject(assignedObjectTree?.data) && (
            <ObjectTree
              data={assignedObjectTree.data}
              path={templateToString(assignedObjectTree.path)}
              style={{ borderBottom: border, borderTop: border }}
            />
          )}
          {endpoints.length > 0 && (
            <Collapsible
              title={t('serviceFlow.previousVariables.apiResponses.title')}
              appearance="normal"
              defaultOpen={true}
              contentStyle={{ padding: '0px' }}
              headerDivider={false}
              style={{ borderRadius: '0px', borderBottom: '1px solid #d2d3d8', borderTop: '0px' }}
            >
              {endpoints.map((endpoint) => (
                <Track
                  key={endpoint.nodeId}
                  direction="vertical"
                  align="left"
                  style={{ ...popupBodyCss, borderBottom: border }}
                >
                  <label
                    htmlFor="json"
                    style={{ marginBottom: '10px', textTransform: 'capitalize', cursor: 'auto' }}
                  >{`${endpoint.name}`}</label>
                  <Track
                    direction="horizontal"
                    gap={4}
                    justify="start"
                    isMultiline
                    style={{ maxHeight: '30vh', overflow: 'auto' }}
                  >
                    {endpoint.chips.map((chip) => {
                      const typeColor = getTypeColor(chip.data);
                      const dragData: Assign = {
                        id: v4(),
                        key: chip.name,
                        value: stringToTemplate(chip.value),
                        data: chip.data,
                      };

                      return isObject(chip.data) ? (
                        <Tooltip content={`${JSON.stringify(chip.data)} : ${typeColor.type}`} key={dragData.id}>
                          <OutputElementBox
                            dragData={dragData}
                            style={{ cursor: 'pointer' }}
                            borderColor={typeColor.color}
                            onClick={() => {
                              setEndpointsObjectTree(
                                endpointsObjectTree?.path === chip.value
                                  ? null
                                  : {
                                      data: chip.data,
                                      path: chip.value,
                                    },
                              );
                            }}
                          >
                            {endpointsObjectTree?.path === chip.value ? chip.name + ' ▲' : chip.name + ' ▼'}
                          </OutputElementBox>
                        </Tooltip>
                      ) : (
                        <Tooltip content={`${chip.data} : ${typeColor.type}`} key={dragData.id}>
                          <OutputElementBox borderColor={typeColor.color} dragData={dragData}>
                            {chip.name}
                          </OutputElementBox>
                        </Tooltip>
                      );
                    })}
                  </Track>
                </Track>
              ))}
            </Collapsible>
          )}
        </>
      )}
      {isObject(endpointsObjectTree?.data) && (
        <ObjectTree data={endpointsObjectTree.data} path={endpointsObjectTree.path} />
      )}
    </Track>
  );
};

type VariableSectionProps = {
  title: string;
  variables: Assign[];
  assignedObjectTree: { data: unknown; path: string | number } | null;
  setAssignedObjectTree: (value: { data: unknown; path: string | number } | null) => void;
  popupBodyCss: CSSProperties;
  border: string;
  isAssignSection?: boolean;
};

// Helper function to get variable name
const getVariableName = (title: string, variable: Assign, t: (key: string) => string): string => {
  const isEnvironmentOrAssign =
    title === t('serviceFlow.previousVariables.environmentVariables.title') ||
    title === t('serviceFlow.previousVariables.assignElements');

  const rawName = isEnvironmentOrAssign ? variable.key : t(variable.key);
  return rawName.length > 0 ? rawName : t('serviceFlow.previousVariables.noName');
};

// Helper function to get tooltip content
const getTooltipContent = (variable: Assign, typeColor: { type: string }): string => {
  return variable.tooltip ? `${variable.value}\n\n${variable.tooltip}` : `${variable.value} : ${typeColor.type}`;
};

// Helper function to handle object tree toggle
const handleObjectTreeToggle = (
  variable: Assign,
  assignedObjectTree: { data: unknown; path: string | number } | null,
  setAssignedObjectTree: (value: { data: unknown; path: string | number } | null) => void,
) => {
  setAssignedObjectTree(
    assignedObjectTree?.path === variable.value
      ? null
      : {
          data: variable.data,
          path: variable.value,
        },
  );
};

// Component for object variables
const ObjectVariable = ({
  variable,
  typeColor,
  assignedObjectTree,
  setAssignedObjectTree,
  t,
}: {
  variable: Assign;
  typeColor: { type: string; color: string };
  assignedObjectTree: { data: unknown; path: string | number } | null;
  setAssignedObjectTree: (value: { data: unknown; path: string | number } | null) => void;
  t: (key: string) => string;
}) => (
  <Tooltip content={getTooltipContent(variable, typeColor)} key={variable.id}>
    <OutputElementBox
      className="tooltip"
      dragData={variable}
      style={{ cursor: 'pointer' }}
      borderColor={typeColor.color}
      onClick={() => handleObjectTreeToggle(variable, assignedObjectTree, setAssignedObjectTree)}
    >
      {assignedObjectTree?.path === variable.value ? t(variable.key) + ' ▲' : t(variable.key) + ' ▼'}
    </OutputElementBox>
  </Tooltip>
);

// Component for simple variables
const SimpleVariable = ({
  variable,
  typeColor,
  name,
  isAssignSection,
}: {
  variable: Assign;
  typeColor: { type: string; color: string };
  name: string;
  isAssignSection: boolean;
}) => (
  <Tooltip content={getTooltipContent(variable, typeColor)} key={variable.id}>
    <OutputElementBox
      dragData={variable.key ? variable : undefined}
      style={{ cursor: variable.key ? 'grab' : 'default' }}
      borderColor={typeColor.color}
      isAssignElement={isAssignSection ? !predefinedInputKeys.includes(variable.id) : false}
    >
      {name}
    </OutputElementBox>
  </Tooltip>
);

// Component for individual variable
const VariableItem = ({
  variable,
  title,
  assignedObjectTree,
  setAssignedObjectTree,
  isAssignSection,
  t,
}: {
  variable: Assign;
  title: string;
  assignedObjectTree: { data: unknown; path: string | number } | null;
  setAssignedObjectTree: (value: { data: unknown; path: string | number } | null) => void;
  isAssignSection: boolean;
  t: (key: string) => string;
}) => {
  const typeColor = getTypeColor(variable?.value);
  const name = getVariableName(title, variable, t);
  const isObjectVariable = isObject(variable.data) && !predefinedInputKeys.includes(variable.id);

  if (isObjectVariable) {
    return (
      <ObjectVariable
        variable={variable}
        typeColor={typeColor}
        assignedObjectTree={assignedObjectTree}
        setAssignedObjectTree={setAssignedObjectTree}
        t={t}
      />
    );
  }

  return <SimpleVariable variable={variable} typeColor={typeColor} name={name} isAssignSection={isAssignSection} />;
};

const VariableSection = ({
  title,
  variables,
  assignedObjectTree,
  setAssignedObjectTree,
  popupBodyCss,
  border,
  isAssignSection = false,
}: VariableSectionProps) => {
  const { t } = useTranslation();

  return (
    <Track
      direction="vertical"
      align="left"
      style={{
        ...popupBodyCss,
        borderBottom: assignedObjectTree ? undefined : border,
      }}
    >
      <label htmlFor="json" style={{ marginBottom: '10px', cursor: 'auto' }}>
        {title}
      </label>
      <Track direction="horizontal" gap={4} justify="start" isMultiline style={{ maxHeight: '30vh', overflow: 'auto' }}>
        {variables.map((variable) => (
          <VariableItem
            key={variable.id}
            variable={variable}
            title={title}
            assignedObjectTree={assignedObjectTree}
            setAssignedObjectTree={setAssignedObjectTree}
            isAssignSection={isAssignSection}
            t={t}
          />
        ))}
      </Track>
    </Track>
  );
};

export default PreviousVariables;
