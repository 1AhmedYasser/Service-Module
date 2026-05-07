import * as Tabs from '@radix-ui/react-tabs';
import { PaginationState, SortingState } from '@tanstack/react-table';
import React, { ReactElement, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useServiceStore from 'store/new-services.store';
import { FieldType } from 'types/endpoint/field-type';
import { RequestOperator } from 'types/endpoint/request-operator';

import { getColumns } from './columns';
import { Button, FormTextarea, SwitchBox, Track } from '../../..';
import { RequestTab } from '../../../../types';
import {
  EndpointData,
  EndpointTab,
  EndpointVariableData,
  PreDefinedEndpointEnvVariables,
} from '../../../../types/endpoint';
import {
  RequestVariablesRowData,
  RequestVariablesTabsRawData,
  RequestVariablesTabsRowsData,
} from '../../../../types/request-variables';
import DataTable from '../../../DataTable';

type RequestVariablesProps = {
  disableRawData?: boolean;
  endpoint: EndpointData;
  parentEndpointId?: string;
  isLive: boolean;
  requestValues: PreDefinedEndpointEnvVariables;
  requestTab: RequestTab;
  setRequestTab: React.Dispatch<React.SetStateAction<RequestTab>>;
  onParametersChange: (params: EndpointVariableData[]) => void;
};

const RequestVariables: React.FC<RequestVariablesProps> = ({
  disableRawData,
  endpoint,
  isLive,
  requestValues,
  requestTab,
  setRequestTab,
  onParametersChange,
}) => {
  const { t } = useTranslation();
  const tabs: EndpointTab[] = [EndpointTab.PathParams, EndpointTab.Params, EndpointTab.Headers, EndpointTab.Body];
  const [jsonError, setJsonError] = useState<string>();
  const [key, setKey] = useState<number>(0);
  const { updateEndpointRawData, updateEndpointData } = useServiceStore();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });

  const [sorting, setSorting] = useState<SortingState>([]);
  const [deletedVariable, setDeletedVariable] = useState<RequestVariablesRowData | undefined>(undefined);

  const constructRow = (id: number, data: EndpointVariableData, nestedLevel: number): RequestVariablesRowData => {
    const value = isLive ? data.value : data.testValue;
    return {
      id: `${id}`,
      endpointVariableId: data.id,
      required: data.required ?? false,
      variable: data.name,
      value,
      operator: data.operator ?? '=',
      isNameEditable: data.type === 'custom',
      type: data.type,
      description: data.description,
      arrayType: data.arrayType,
      nestedLevel,
    };
  };

  const getTabsRowsData = (): RequestVariablesTabsRowsData => {
    return tabs.reduce((tabsRowsData, tab) => {
      const rows: RequestVariablesRowData[] = [];
      const endpointData = endpoint.definitions[0];
      if (endpointData) {
        if (!endpointData[tab]) return tabsRowsData;
        let rowIdx = 0;
        endpointData[tab].variables.forEach((variable) => {
          rows.push(constructRow(rowIdx, variable, 0));
          if (['schema', 'array'].includes(variable.type)) {
            rowIdx = getRowsFromNestedSchema(variable, rowIdx, rows, 1);
          }
          rowIdx++;
        });
      }
      if (rows.length === 0 || endpointData.type === 'custom') {
        rows.push({
          id: `${rows.length}`,
          required: false,
          isNameEditable: true,
          nestedLevel: 0,
        });
      }
      return { ...tabsRowsData, [tab]: rows };
    }, {});
  };

  const getRowsFromNestedSchema = (
    variable: EndpointVariableData,
    oldRowIdx: number,
    rows: RequestVariablesRowData[],
    nestedLevel: number,
  ): number => {
    let rowIdx = oldRowIdx;
    const variableData = variable.type === 'schema' ? variable.schemaData : variable.arrayData;
    if (Array.isArray(variableData)) {
      variableData.forEach((data) => {
        rowIdx++;
        rows.push(constructRow(rowIdx, data, nestedLevel));
        if (['schema', 'array'].includes(data.type)) {
          rowIdx = getRowsFromNestedSchema(data, rowIdx, rows, nestedLevel + 1);
        }
      });
    }
    return rowIdx;
  };

  const [rowsData, setRowsData] = useState<RequestVariablesTabsRowsData>(getTabsRowsData());

  useEffect(() => {
    setRequestTab((rt) => {
      const availableTabs = Object.keys(rowsData);
      rt.tab = availableTabs.includes(rt.tab) ? rt.tab : (availableTabs[0] as EndpointTab);
      return rt;
    });
    setKey((key) => key + 1);
    // Adding rowsData dependency breaks focus on typing in variable inputs
    // Impossible to fix without a significant refactor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRequestTab]);

  const getInitialTabsRawData = (): RequestVariablesTabsRawData => {
    return tabs.reduce((tabsRawData, tab) => {
      const endpointData = endpoint.definitions[0];
      if (!endpointData?.[tab]) return tabsRawData;
      return { ...tabsRawData, [tab]: endpointData[tab]?.rawData[isLive ? 'value' : 'testValue'] ?? '' };
    }, {});
  };
  const [tabRawData, setTabRawData] = useState<RequestVariablesTabsRawData>(getInitialTabsRawData());

  const getTabTriggerClasses = (tab: EndpointTab) =>
    `endpoint-tab-group__tab-btn ${requestTab.tab === tab ? 'active' : ''}`;

  const maintainSingleEmptyRow = (rows: RequestVariablesRowData[]) => {
    const emptyRow = rows.find((row) => row.value === undefined && row.variable === undefined);
    const nonEmptyRows = rows.filter((row) => row.value !== undefined || row.variable !== undefined);

    const baseEmptyRow: RequestVariablesRowData = {
      id: nonEmptyRows.length.toString(),
      required: false,
      isNameEditable: true,
      nestedLevel: 0,
    };

    return [...nonEmptyRows, emptyRow ? { ...baseEmptyRow, ...emptyRow } : baseEmptyRow];
  };

  const updateRowField = (id: string, field: FieldType, newValue: string) => {
    setRowsData((prevRowsData) => {
      const oldName =
        field === 'variable' && requestTab.tab === EndpointTab.PathParams
          ? prevRowsData[requestTab.tab]?.find((r) => r.id === id)?.variable
          : undefined;

      const newRowsData = { ...prevRowsData };
      newRowsData[requestTab.tab] = [...(newRowsData[requestTab.tab] || [])];

      newRowsData[requestTab.tab]!.forEach((row) => {
        if (row.id !== id) return;
        if (field === 'operator') {
          row[field] = newValue as RequestOperator;
        } else {
          row[field] = newValue;
        }
      });

      if (oldName) {
        endpoint.definitions[0].url = endpoint.definitions[0].url?.replace(`{${oldName}}`, `{${newValue}}`);
      }

      if (endpoint.type === 'custom') {
        newRowsData[requestTab.tab] = maintainSingleEmptyRow(newRowsData[requestTab.tab] || []);
      }
      updateEndpointData(newRowsData, endpoint);

      if (requestTab.tab === 'params') {
        onParametersChange(
          newRowsData[requestTab.tab]
            ?.filter((row) => row.variable)
            .map((row) => ({
              id: row.endpointVariableId ?? row.id,
              name: row.variable!,
              type: row.type ?? 'custom',
              required: row.required ?? false,
              value: row.value!,
              operator: row.operator as RequestOperator,
            })) ?? [],
        );
      }
      return newRowsData;
    });
  };

  const updateOperator = (rowId: string, operator: string) => {
    if (!rowsData[requestTab.tab] || requestTab.tab !== EndpointTab.Params) return;

    const newData = rowsData[requestTab.tab]!.map((row) => {
      if (row.id !== rowId) return row;
      row.operator = operator as RequestOperator;
      return row;
    });

    const variables: EndpointVariableData[] = [];
    newData.forEach((row) => {
      if (!row.variable) return;

      const newVariable: EndpointVariableData = {
        id: row.endpointVariableId ?? row.id,
        name: row.variable ?? '',
        type: row.type ?? 'custom',
        required: row.required ?? false,
        value: row.value,
        operator: requestTab.tab === EndpointTab.Params ? (row.operator as RequestOperator) || '=' : undefined,
      };
      variables.push(newVariable);
    });

    if (requestTab.tab === 'params') {
      onParametersChange(variables);
    }
  };

  const checkNestedVariables = (rowVariableId: string, variable: EndpointVariableData) => {
    const variableData = variable.type === 'schema' ? variable.schemaData : variable.arrayData;
    if (Array.isArray(variableData)) {
      if (rowVariableId && variableData.map((v) => v.id).includes(rowVariableId)) {
        variable[variable.type === 'schema' ? 'schemaData' : 'arrayData'] = variableData.filter(
          (v) => v.id !== rowVariableId,
        );
        return;
      }
      variableData.forEach((v) => {
        if (['schema', 'array'].includes(v.type)) {
          checkNestedVariables(rowVariableId, v);
        }
      });
    }
  };

  const deleteVariable = (rowData: RequestVariablesRowData) => {
    if (rowData.variable === undefined || rowData.value === undefined) return;
    const endpointData = endpoint.definitions[0];
    const defEndpoint = endpoint.definitions.find((x) => x.id === endpointData.id);
    const endpointTab = defEndpoint?.[requestTab.tab];

    if (defEndpoint && endpointTab) {
      if (rowData.endpointVariableId && endpointTab.variables.map((v) => v.id).includes(rowData.endpointVariableId)) {
        endpointTab.variables = endpointTab.variables.filter((v) => v.id !== rowData.endpointVariableId);
      } else {
        endpointTab.variables
          .filter((variable) => ['schema', 'array'].includes(variable.type))
          .forEach((variable) => checkNestedVariables(rowData.endpointVariableId!, variable));
      }
    }

    if (requestTab.tab === 'params') {
      onParametersChange(endpointTab?.variables ?? []);
    }
    setDeletedVariable(rowData);
  };

  const updateParams = (isValue: boolean, rowId: string, value: string) => {
    if (!rowsData[requestTab.tab]) return;
    const newData = rowsData[requestTab.tab]!.map((row) => {
      if (row.id !== rowId) return row;
      if (isValue) {
        row.value = value;
      } else {
        row.variable = value;
      }
      return row;
    });

    const variables: EndpointVariableData[] = [];
    newData.forEach((row) => {
      if (!row.value || !row.variable) return;

      const newVariable: EndpointVariableData = {
        id: row.endpointVariableId ?? row.id,
        name: row.variable ?? '',
        type: row.type ?? 'custom',
        required: row.required ?? false,
        value: row.value,
        operator: requestTab.tab === EndpointTab.Params ? (row.operator as RequestOperator) || '=' : undefined,
      };
      variables.push(newVariable);
    });

    if (requestTab.tab === 'params') {
      onParametersChange(variables);
    } else if (requestTab.tab === 'body') {
      endpoint.definitions[0].body = {
        variables: variables,
        rawData: {},
        isRawSelected: false,
      };
    } else if (requestTab.tab === 'headers') {
      endpoint.definitions[0].headers = {
        variables: variables,
        rawData: {},
        isRawSelected: false,
      };
    } else if (requestTab.tab === 'pathParams') {
      endpoint.definitions[0].pathParams = {
        variables: variables,
        rawData: {},
        isRawSelected: false,
      };
    }
  };

  const columns = useMemo(
    () =>
      getColumns({
        rowsData,
        updateParams,
        requestTab,
        deleteVariable,
        setRowsData,
        updateRowField,
        updateOperator,
        requestValues,
        isLive,
        getTabsRowsData,
      }),
    // Adding missing dependencies breaks focus on typing in variable inputs
    // Impossible to fix without a significant refactor
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deletedVariable, requestTab.tab],
  );

  const buildRawDataView = (): ReactElement => {
    return (
      <>
        <Track justify="between" style={{ padding: '8px 0 8px 0' }}>
          <p style={{ color: '#d73e3e' }}>{jsonError}</p>
          <Button
            appearance="text"
            onMouseDown={() => {
              setTabRawData((prevRawData) => {
                try {
                  const content = prevRawData[requestTab.tab] ?? '';
                  prevRawData[requestTab.tab] = JSON.stringify(JSON.parse(content), null, 4);
                  updateEndpointRawData(prevRawData, endpoint);
                } catch (e: any) {
                  setJsonError(`Unable to format JSON. ${e.message}`);
                }
                return prevRawData;
              });
              setKey(key + 1);
            }}
          >
            {t('newService.endpoint.formatJson')}
          </Button>
        </Track>
        <FormTextarea
          key={`${requestTab.tab}-raw-data`}
          label={''}
          defaultValue={tabRawData[requestTab.tab]}
          onChange={(event) => {
            setJsonError(undefined);
            tabRawData[requestTab.tab] = event.target.value;
            updateEndpointRawData(tabRawData, endpoint);
          }}
        />
      </>
    );
  };

  return (
    <Tabs.Root
      defaultValue={requestTab.tab}
      onValueChange={(value) => {
        setRequestTab((rt) => {
          rt.tab = value as EndpointTab;
          return rt;
        });
        setKey(key + 1);
      }}
      className="endpoint-tab-group"
      key={key}
    >
      <Track justify="between" style={{ borderBottom: 'solid 1px #5d6071' }}>
        <Tabs.List className="endpoint-tab-group__list" aria-label="environment">
          {Object.keys(rowsData).map((tab) => {
            return (
              <Tabs.Trigger className={getTabTriggerClasses(tab as EndpointTab)} value={tab} key={tab}>
                {t(`newService.endpoint.${tab}`)}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
        {!disableRawData && requestTab.tab === 'body' && (
          <Track style={{ paddingRight: 16 }} gap={8}>
            <SwitchBox
              style={{ width: 'fit-content' }}
              label={''}
              name={'raw-data'}
              checked={endpoint.definitions[0][requestTab.tab]?.isRawSelected ?? requestTab.showRawData}
              onCheckedChange={(checked) => {
                setRequestTab((rt) => {
                  rt.showRawData = checked;
                  return rt;
                });
                if (endpoint.definitions[0][requestTab.tab]) {
                  endpoint.definitions[0][requestTab.tab]!.isRawSelected = checked;
                }
                setKey(key + 1);
              }}
            />
            <p style={{ whiteSpace: 'nowrap', color: '#34394C' }}>Raw data</p>
          </Track>
        )}
      </Track>
      {Object.keys(rowsData).map((tab) => (
        <Tabs.Content className="endpoint-tab-group__tab-content" value={tab} key={tab}>
          {(requestTab.showRawData || endpoint.definitions[0][requestTab.tab]?.isRawSelected) &&
          requestTab.tab === 'body' ? (
            buildRawDataView()
          ) : (
            <>
              <DataTable
                sortable
                data={rowsData[tab as EndpointTab] ?? []}
                columns={columns}
                setPagination={setPagination}
                setSorting={setSorting}
                pagination={pagination}
                sorting={sorting}
                withScrollWrapper={false}
              />
              <hr style={{ margin: 0, borderTop: '1px solid #D2D3D8' }} />
            </>
          )}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
};

export default RequestVariables;
