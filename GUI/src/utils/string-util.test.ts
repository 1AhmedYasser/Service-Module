import { describe, expect, it } from 'vitest';

import {
  fromSnakeCase,
  getLastDigits,
  isTemplate,
  removeTrailingUnderscores,
  stringToArray,
  stringToEscapedTemplate,
  stringToTemplate,
  templateToString,
  toSnakeCase,
} from './string-util';

describe('String Utils', () => {
  describe('isTemplate', () => {
    it('should return true for valid templates', () => {
      expect(isTemplate('${test}')).toBe(true);
      expect(isTemplate('${123}')).toBe(true);
      expect(isTemplate('${test-value}')).toBe(true);
    });

    it('should return false for invalid templates', () => {
      expect(isTemplate('test')).toBe(false);
      expect(isTemplate('${test')).toBe(false);
      expect(isTemplate('test}')).toBe(false);
      expect(isTemplate('')).toBe(false);
    });
  });

  describe('stringToTemplate', () => {
    it('should convert string to template', () => {
      expect(stringToTemplate('test')).toBe('${test}');
      expect(stringToTemplate('123')).toBe('${123}');
    });

    it('should handle empty values', () => {
      expect(stringToTemplate('')).toBe('${""}');
      expect(stringToTemplate(0)).toBe('${""}');
    });
  });

  describe('stringToEscapedTemplate', () => {
    it('should convert string to template with equals', () => {
      expect(stringToEscapedTemplate('test')).toBe('$= test =');
      expect(stringToEscapedTemplate('123')).toBe('$= 123 =');
    });

    it('should convert number to template with equals', () => {
      expect(stringToEscapedTemplate(123)).toBe('$= 123 =');
    });

    it('should handle expressions with curly brackets', () => {
      const functionExpression = '(function() { const d = new Date(); return d.getFullYear(); })()';
      expect(stringToEscapedTemplate(functionExpression)).toBe(
        '$= (function() { const d = new Date(); return d.getFullYear(); })() =',
      );

      const objectExpression = '{"key1":"value1","key2":"value2"}';
      expect(stringToEscapedTemplate(objectExpression)).toBe('$= {"key1":"value1","key2":"value2"} =');
    });

    it('should handle empty values', () => {
      expect(stringToEscapedTemplate('')).toBe('$= "" =');
      expect(stringToEscapedTemplate(0)).toBe('$= "" =');
    });
  });

  describe('templateToString', () => {
    it('should extract value from template', () => {
      expect(templateToString('${test}')).toBe('test');
      expect(templateToString('${123}')).toBe('123');
    });

    it('should return original value if not a template', () => {
      expect(templateToString('test')).toBe('test');
      expect(templateToString('123')).toBe('123');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert to snake case', () => {
      expect(toSnakeCase('Hello World')).toBe('hello_world');
      expect(toSnakeCase('test-value')).toBe('test_value');
      expect(toSnakeCase('test  value')).toBe('test_value');
    });

    it('should normalize Estonian characters', () => {
      expect(toSnakeCase('Määra-1')).toBe('maara_1');
      expect(toSnakeCase('Vastuse ümberarvutus')).toBe('vastuse_umberarvutus');
      expect(toSnakeCase('Õun šokolaad žürii')).toBe('oun_sokolaad_zurii');
      expect(toSnakeCase('Müü')).toBe('muu');
    });

    it('should handle edge cases', () => {
      expect(toSnakeCase('')).toBe('');
      expect(toSnakeCase('   ')).toBe('');
      expect(toSnakeCase('TEST')).toBe('test');
    });
  });

  describe('fromSnakeCase', () => {
    it('should convert from snake case to display format', () => {
      expect(fromSnakeCase('hello_world')).toBe('Hello World');
      expect(fromSnakeCase('send_message_to_client_1')).toBe('Send message to client - 1');
      expect(fromSnakeCase('test_value')).toBe('Test Value');
    });

    it('should handle edge cases', () => {
      expect(fromSnakeCase('')).toBe('');
      expect(fromSnakeCase('single')).toBe('Single');
      expect(fromSnakeCase('UPPER_CASE')).toBe('Upper Case');
      expect(fromSnakeCase('just_1')).toBe('Just - 1');
    });
  });

  describe('getLastDigits', () => {
    it('should extract last digits', () => {
      expect(getLastDigits('test123')).toBe(123);
      expect(getLastDigits('123')).toBe(123);
    });

    it('should return 1 for no digits or mixed content', () => {
      expect(getLastDigits('test')).toBe(1);
      expect(getLastDigits('')).toBe(1);
      expect(getLastDigits('abc123def')).toBe(1);
    });
  });

  describe('removeTrailingUnderscores', () => {
    it('should remove trailing underscores', () => {
      expect(removeTrailingUnderscores('test___')).toBe('test');
      expect(removeTrailingUnderscores('test_')).toBe('test');
      expect(removeTrailingUnderscores('test')).toBe('test');
    });

    it('should handle edge cases', () => {
      expect(removeTrailingUnderscores('')).toBe('');
      expect(removeTrailingUnderscores('___')).toBe('');
    });
  });

  describe('stringToArray', () => {
    it('should parse valid JSON arrays', () => {
      expect(stringToArray('["a", "b", "c"]')).toEqual(['a', 'b', 'c']);
      expect(stringToArray('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('should return fallback for invalid input', () => {
      expect(stringToArray('')).toEqual([]);
      expect(stringToArray('invalid json')).toEqual([]);
      expect(stringToArray('{"not": "array"}')).toEqual([]);
    });

    it('should use custom fallback', () => {
      expect(stringToArray('', ['default'])).toEqual(['default']);
      expect(stringToArray('invalid', ['default'])).toEqual(['default']);
    });
  });
});
