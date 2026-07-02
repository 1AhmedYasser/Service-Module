import { Edge, Node } from '@xyflow/react';
import { StepType } from 'types';
import { NodeDataProps } from 'types/service-flow';
import { describe, expect, it, vi } from 'vitest';

import {
  getYamlContent,
  toMarkdownMessage,
  validateAssign,
  validateCondition,
  validateDynamicChoices,
  validateFileGenerate,
  validateMultiChoiceQuestion,
  validateOpenWebpage,
  validateTextField,
} from './service-builder';

// Mock i18next
vi.mock('i18next', () => ({
  default: {
    t: vi.fn((key: string) => key),
  },
  t: vi.fn((key: string) => key),
}));

describe('Validation Functions', () => {
  describe('validateTextField', () => {
    it('should return null when message is defined', () => {
      const nodeData = { message: 'Test message' };
      const result = validateTextField(nodeData as NodeDataProps);
      expect(result).toBeNull();
    });

    it('should return error when message is undefined', () => {
      const nodeData = { message: undefined };
      const result = validateTextField(nodeData as NodeDataProps);
      expect(result).toBe('toast.missing-textfield-message');
    });
  });

  describe('validateOpenWebpage', () => {
    it('should return null when both link and linkText are defined', () => {
      const nodeData = { link: 'https://example.com', linkText: 'Example' };
      const result = validateOpenWebpage(nodeData as NodeDataProps);
      expect(result).toBeNull();
    });

    it('should return error when link is undefined', () => {
      const nodeData = { link: undefined, linkText: 'Example' };
      const result = validateOpenWebpage(nodeData as NodeDataProps);
      expect(result).toBe('toast.missing-website');
    });

    it('should return error when linkText is undefined', () => {
      const nodeData = { link: 'https://example.com', linkText: undefined };
      const result = validateOpenWebpage(nodeData as NodeDataProps);
      expect(result).toBe('toast.missing-website');
    });

    it('should return error when both are undefined', () => {
      const nodeData = { link: undefined, linkText: undefined };
      const result = validateOpenWebpage(nodeData as NodeDataProps);
      expect(result).toBe('toast.missing-website');
    });
  });

  describe('validateFileGenerate', () => {
    it('should return null when both fileName and fileContent are defined', () => {
      const nodeData = { fileName: 'test.txt', fileContent: 'Test content' };
      const result = validateFileGenerate(nodeData as NodeDataProps);
      expect(result).toBeNull();
    });

    it('should return error when fileName is undefined', () => {
      const nodeData = { fileName: undefined, fileContent: 'Test content' };
      const result = validateFileGenerate(nodeData as NodeDataProps);
      expect(result).toBe('toast.missing-file-generation');
    });

    it('should return error when fileContent is undefined', () => {
      const nodeData = { fileName: 'test.txt', fileContent: undefined };
      const result = validateFileGenerate(nodeData as NodeDataProps);
      expect(result).toBe('toast.missing-file-generation');
    });
  });

  describe('validateAssign', () => {
    it('should return null when assignElements is defined and not empty', () => {
      const nodeData = { assignElements: [{ id: '1', key: 'test', value: 'value' }] };
      const result = validateAssign(nodeData as NodeDataProps);
      expect(result).toBeNull();
    });

    it('should return error when assignElements is undefined', () => {
      const nodeData = { assignElements: undefined };
      const result = validateAssign(nodeData as NodeDataProps);
      expect(result).toBe('toast.missing-assign-elements');
    });

    it('should return error when assignElements is empty array', () => {
      const nodeData = { assignElements: [] };
      const result = validateAssign(nodeData as unknown as NodeDataProps);
      expect(result).toBe('toast.missing-assign-elements');
    });
  });

  describe('validateMultiChoiceQuestion', () => {
    it('should return null when question and buttons are properly defined', () => {
      const nodeData = {
        multiChoiceQuestion: {
          question: 'Test question',
          buttons: [{ id: '1', title: 'Option 1', payload: 'payload1' }],
        },
      };
      const result = validateMultiChoiceQuestion(nodeData as NodeDataProps);
      expect(result).toBeNull();
    });

    it('should return error when question is undefined', () => {
      const nodeData = {
        multiChoiceQuestion: {
          question: undefined,
          buttons: [{ id: '1', title: 'Option 1', payload: 'payload1' }],
        },
      };
      const result = validateMultiChoiceQuestion(nodeData as unknown as NodeDataProps);
      expect(result).toBe('toast.missing-mcq-question');
    });

    it('should return error when question is empty string', () => {
      const nodeData = {
        multiChoiceQuestion: {
          question: '',
          buttons: [{ id: '1', title: 'Option 1', payload: 'payload1' }],
        },
      };
      const result = validateMultiChoiceQuestion(nodeData as NodeDataProps);
      expect(result).toBe('toast.missing-mcq-question');
    });

    it('should return error when buttons are undefined', () => {
      const nodeData = {
        multiChoiceQuestion: {
          question: 'Test question',
          buttons: undefined,
        },
      };
      const result = validateMultiChoiceQuestion(nodeData as unknown as NodeDataProps);
      expect(result).toBe('toast.missing-mcq-options');
    });

    it('should return error when buttons array is empty', () => {
      const nodeData = {
        multiChoiceQuestion: {
          question: 'Test question',
          buttons: [],
        },
      };
      const result = validateMultiChoiceQuestion(nodeData as unknown as NodeDataProps);
      expect(result).toBe('toast.missing-mcq-options');
    });
  });

  describe('validateDynamicChoices', () => {
    it('should return null when all required fields are defined', () => {
      const nodeData = {
        dynamicChoices: {
          list: 'test list',
          serviceName: 'test service',
          key: 'test key',
        },
      };
      const result = validateDynamicChoices(nodeData as NodeDataProps);
      expect(result).toBeNull();
    });

    it('should return error when list is undefined', () => {
      const nodeData = {
        dynamicChoices: {
          list: undefined,
          serviceName: 'test service',
          key: 'test key',
        },
      };
      const result = validateDynamicChoices(nodeData as unknown as NodeDataProps);
      expect(result).toBe('toast.missing-dynamic-choices-list');
    });

    it('should return error when list is empty string', () => {
      const nodeData = {
        dynamicChoices: {
          list: '',
          serviceName: 'test service',
          key: 'test key',
        },
      };
      const result = validateDynamicChoices(nodeData as NodeDataProps);
      expect(result).toBe('toast.missing-dynamic-choices-list');
    });

    it('should return error when serviceName is undefined', () => {
      const nodeData = {
        dynamicChoices: {
          list: 'test list',
          serviceName: undefined,
          key: 'test key',
        },
      };
      const result = validateDynamicChoices(nodeData as NodeDataProps);
      expect(result).toBe('toast.missing-dynamic-choices-service-name');
    });

    it('should return error when serviceName is empty string', () => {
      const nodeData = {
        dynamicChoices: {
          list: 'test list',
          serviceName: '',
          key: 'test key',
        },
      };
      const result = validateDynamicChoices(nodeData as NodeDataProps);
      expect(result).toBe('toast.missing-dynamic-choices-service-name');
    });

    it('should return error when key is undefined', () => {
      const nodeData = {
        dynamicChoices: {
          list: 'test list',
          serviceName: 'test service',
          key: undefined,
        },
      };
      const result = validateDynamicChoices(nodeData as NodeDataProps);
      expect(result).toBe('toast.missing-dynamic-choices-key');
    });

    it('should return error when key is empty string', () => {
      const nodeData = {
        dynamicChoices: {
          list: 'test list',
          serviceName: 'test service',
          key: '',
        },
      };
      const result = validateDynamicChoices(nodeData as NodeDataProps);
      expect(result).toBe('toast.missing-dynamic-choices-key');
    });
  });

  describe('validateCondition', () => {
    it('should not throw when rules are valid', () => {
      const nodeData = {
        rules: {
          children: [{ field: 'test', operator: 'equals', value: 'value' }],
        },
      };
      expect(() => validateCondition(nodeData as NodeDataProps)).not.toThrow();
    });

    it('should return error when rules children are undefined', () => {
      const nodeData = { rules: { children: undefined } };
      expect(validateCondition(nodeData as unknown as NodeDataProps)).toBe('toast.missing-condition-rules');
    });

    it('should return error when rules children are empty', () => {
      const nodeData = { rules: { children: [] } };
      expect(validateCondition(nodeData as unknown as NodeDataProps)).toBe('toast.missing-condition-rules');
    });

    it('should return error when rules are undefined', () => {
      const nodeData = { rules: undefined };
      expect(validateCondition(nodeData as unknown as NodeDataProps)).toBe('toast.missing-condition-rules');
    });
  });
});

describe('Nonce step injection', () => {
  const baseNodeData = {
    onDelete: vi.fn(),
    onEdit: vi.fn(),
    type: 'custom',
    readonly: false,
    childrenCount: 0,
    setClickedNode: vi.fn(),
  };

  const buildEndpointNode = (id: string, label: string, headerName: string): Node<NodeDataProps> => ({
    id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      ...baseNodeData,
      label,
      stepType: StepType.UserDefined,
      endpoint: {
        endpointId: id,
        name: label,
        definitions: [
          {
            id: `${id}-def`,
            label,
            path: '/back-up-removable-chats',
            methodType: 'post',
            type: 'custom',
            dataType: 'custom',
            supported: true,
            isSelected: true,
            url: '[#CHATBOT_RUUTER_PRIVATE]/chats/back-up-removable-chats',
            headers: {
              variables: [{ id: 'h1', name: headerName, type: 'string', value: 'placeholder' }],
              rawData: {},
            },
          },
        ],
      },
    },
  });

  it('inserts a get-new-nonce step before an endpoint sending x-ruuter-nonce, and points the previous step at it', () => {
    const endpointNode = buildEndpointNode('node-1', 'Backup Conversations', 'x-ruuter-nonce');
    const nextNode = buildEndpointNode('node-2', 'Empty Messages', 'content-type');
    const nodes: Node<NodeDataProps>[] = [endpointNode, nextNode];
    const edges: Edge[] = [{ id: 'e1', source: 'node-1', target: 'node-2' }];

    const result = getYamlContent(nodes, edges, 'test_service', '', false);

    expect(result.prepare.next).toBe('backup_conversations_get_new_nonce');

    expect(result.backup_conversations_get_new_nonce).toEqual({
      call: 'http.post',
      args: { url: '[#SERVICE_TRAINING_RESQL]/get-new-nonce' },
      result: 'backup_conversations_nonce',
      next: 'backup_conversations',
    });

    expect(result.backup_conversations.args.headers['x-ruuter-nonce']).toBe(
      '${backup_conversations_nonce.response.body[0].nonce}',
    );

    // Ruuter resolves ${var.response...} against whatever already ran by that point in the
    // YAML, so the nonce-fetch step must be declared before the step that consumes its result.
    const keys = Object.keys(result as Record<string, unknown>);
    expect(keys.indexOf('backup_conversations_get_new_nonce')).toBeLessThan(keys.indexOf('backup_conversations'));
  });

  it('does not inject a nonce step when no x-ruuter-nonce header is present', () => {
    const endpointNode = buildEndpointNode('node-1', 'Backup Conversations', 'content-type');
    const nextNode = buildEndpointNode('node-2', 'Empty Messages', 'content-type');
    const nodes: Node<NodeDataProps>[] = [endpointNode, nextNode];
    const edges: Edge[] = [{ id: 'e1', source: 'node-1', target: 'node-2' }];

    const result = getYamlContent(nodes, edges, 'test_service', '', false);

    expect(result.backup_conversations_get_new_nonce).toBeUndefined();
    expect(result.prepare.next).toBe('backup_conversations');
  });

  it('gives each nonce-requiring endpoint its own step and result variable', () => {
    const firstEndpoint = buildEndpointNode('node-1', 'Backup Conversations', 'x-ruuter-nonce');
    const secondEndpoint = buildEndpointNode('node-2', 'Empty Messages', 'x-ruuter-nonce');
    const nodes: Node<NodeDataProps>[] = [firstEndpoint, secondEndpoint];
    const edges: Edge[] = [{ id: 'e1', source: 'node-1', target: 'node-2' }];

    const result = getYamlContent(nodes, edges, 'test_service', '', false);

    expect(result.backup_conversations.next).toBe('empty_messages_get_new_nonce');
    expect(result.empty_messages_get_new_nonce).toEqual({
      call: 'http.post',
      args: { url: '[#SERVICE_TRAINING_RESQL]/get-new-nonce' },
      result: 'empty_messages_nonce',
      next: 'empty_messages',
    });
    const keys = Object.keys(result as Record<string, unknown>);
    expect(keys.indexOf('backup_conversations_get_new_nonce')).toBeLessThan(keys.indexOf('backup_conversations'));
    expect(keys.indexOf('empty_messages_get_new_nonce')).toBeLessThan(keys.indexOf('empty_messages'));

    expect(result.empty_messages.args.headers['x-ruuter-nonce']).toBe('${empty_messages_nonce.response.body[0].nonce}');
  });
});

describe('toMarkdownMessage', () => {
  it('converts rich text html bullet lists to plain bullet characters', () => {
    const html =
      '<p>hello here is my stuff</p><ul><li>be honest</li><li>be loyal</li><li>be strong</li><li>be faithful</li></ul>';

    expect(toMarkdownMessage(html)).toBe(
      'hello here is my stuff\n\n• be honest\n• be loyal\n• be strong\n• be faithful',
    );
  });

  it('converts existing markdown bullet lists to plain bullet characters', () => {
    const markdown = 'hello here is my stuff\n\n* be honest\n* be loyal';

    expect(toMarkdownMessage(markdown)).toBe('hello here is my stuff\n\n• be honest\n• be loyal');
  });

  it('converts ordered lists to plain numbered lines', () => {
    const markdown = 'Steps:\n\n1. first\n2. second';

    expect(toMarkdownMessage(markdown)).toBe('Steps:\n\n1) first\n2) second');
  });
});
