import { Node } from '@xyflow/react';
import ApiEndpointCard from 'components/ApiEndpointCard';
import { FC, useEffect, useMemo } from 'react';
import { EndpointData } from 'types/endpoint';
import { NodeDataProps } from 'types/service-flow';

import Track from '../Track';
import PreviousVariables from './PreviousVariables';

type ApiContentProps = {
  readonly node: Node<NodeDataProps>;
  readonly endpoint: EndpointData | undefined;
  readonly onEndpointChange?: (endpoint: EndpointData) => void;
  readonly responseSchema?: string;
};

const ApiContent: FC<ApiContentProps> = ({ node, endpoint, onEndpointChange, responseSchema }) => {
  const endpointCopy = useMemo(() => {
    return endpoint ? (JSON.parse(JSON.stringify(endpoint)) as EndpointData) : undefined;
  }, [endpoint]);

  useEffect(() => {
    if (onEndpointChange && endpointCopy) {
      onEndpointChange(endpointCopy);
    }
  }, [endpointCopy, onEndpointChange]);

  return (
    <Track direction="vertical" align="stretch">
      {endpointCopy && (
        <ApiEndpointCard
          endpoint={endpointCopy}
          showCommonSwitch={false}
          responseSchema={responseSchema}
          onNameChange={(name) => {
            endpointCopy.name = name;
          }}
        />
      )}
      <PreviousVariables node={node} />
    </Track>
  );
};

export default ApiContent;
