export const isTemplate = (value: string | number) => {
  return (
    (String(value).startsWith('${') && String(value).endsWith('}')) ||
    (String(value).startsWith('$=') && String(value).endsWith('='))
  );
};

export const stringToTemplate = (value: string | number) => {
  return value ? '${' + value + '}' : '${""}';
};

export const stringToEscapedTemplate = (value: string | number) => {
  return value ? '$= ' + value + ' =' : '$= "" =';
};

export const templateToString = (value: string | number) => {
  const valueString = String(value);
  if (!isTemplate(value)) {
    console.error(`templateToString: input '${value}' is not a template, returning input as is`);
    return valueString;
  }

  return valueString.substring(2, valueString.length - 1);
};

export const toSnakeCase = (value: string) => {
  return value
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replaceAll(/\s+/g, '_')
    .replaceAll(/-+/g, '_')
    .replaceAll(/_+/g, '_');
};

export const fromSnakeCase = (value: string) => {
  const parts = value.split('_');

  // Check if the last part is a number
  const lastPart = parts.at(-1) ?? '';
  const isLastPartNumber = /^\d+$/.test(lastPart);

  if (isLastPartNumber && parts.length > 1) {
    // Handle case like "send_message_to_client_1" -> "Send message to client - 1"
    const words = parts.slice(0, -1);
    const number = lastPart;

    const displayWords = words.map((word, index) => {
      if (index === 0) {
        // First word: capitalize first letter, lowercase rest
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      } else {
        // Other words: all lowercase
        return word.toLowerCase();
      }
    });

    return `${displayWords.join(' ')} - ${number}`;
  } else {
    // Handle regular snake case conversion
    return parts.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }
};

export const getLastDigits = (value: string) => {
  let lastDigits = '';
  for (let i = value.length - 1; i >= 0; i--) {
    if (/\d/.test(value[i])) {
      lastDigits = value[i] + lastDigits;
    } else {
      break;
    }
  }
  return lastDigits ? Number.parseInt(lastDigits, 10) : 1;
};

export const removeTrailingUnderscores = (value: string) => {
  let end = value.length;
  while (end > 0 && value[end - 1] === '_') end--;
  return value.slice(0, end);
};

export function stringToArray(str: string, fallback: any = []) {
  try {
    if (!str || typeof str !== 'string' || str.trim() === '') {
      return fallback;
    }
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    console.error('stringToArray: Error converting to array:', e);
    return fallback;
  }
}

export function removeNestedTemplates(str: string): string {
  let changed: boolean;
  let iterationCount = 0;
  const MAX_ITERATIONS = 100;

  do {
    changed = false;
    iterationCount++;

    str = str.replaceAll(
      /\$\{([^${}]*)\$\{([^}]*)\}([^}]*)\}/g,
      (match: string, p1: string, p2: string, p3: string): string => {
        changed = true;
        return `\${${p1}${p2}${p3}}`;
      },
    );

    if (iterationCount >= MAX_ITERATIONS) {
      console.warn('Maximum iterations reached for nested template removal');
      break;
    }
  } while (changed);

  iterationCount = 0;

  do {
    changed = false;
    iterationCount++;

    str = str.replaceAll(
      /\$\{([^{}]*)\{([^}]*)\}([^}]*)\}/g,
      (match: string, p1: string, p2: string, p3: string): string => {
        changed = true;
        return `\${${p1}${p2}${p3}}`;
      },
    );

    if (iterationCount >= MAX_ITERATIONS) {
      console.warn('Maximum iterations reached for brace removal');
      break;
    }
  } while (changed);

  return str;
}

export function isNumericString(str: string): boolean {
  if (typeof str !== 'string') return false;
  if (str.trim() === '') return false;

  const num = Number(str);
  return !Number.isNaN(num) && Number.isFinite(num);
}

export function removeWrapperQuotes(str: string): string {
  if (typeof str !== 'string') return str;

  let start = 0;
  let end = str.length - 1;
  while (start <= end && str[start] === '"') start++;
  while (end >= start && str[end] === '"') end--;

  return str.substring(start, end + 1);
}

export function decodeHtmlEntities(value: string): string {
  if (typeof value !== 'string' || value.length === 0) return value;

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value
    .replaceAll(/&#x([0-9A-F]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replaceAll(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replaceAll('&amp;', '&')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'");
}

export const ensureAbsoluteUrl = (href: string): string => {
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(href) || href.startsWith('//')) {
    return href;
  }
  return `https://${href}`;
};
