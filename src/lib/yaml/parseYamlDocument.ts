import { load } from 'js-yaml';

export type YamlParseError = {
  message: string;
  line?: number;
  column?: number;
};

export type YamlParseResult<T = unknown> =
  | { ok: true; document: T }
  | { ok: false; error: YamlParseError };

export function parseYamlDocument<T = unknown>(yamlText: string): YamlParseResult<T> {
  try {
    const document = load(yamlText) as T;
    return { ok: true, document };
  } catch (error) {
    const yamlError = error as {
      message?: string;
      mark?: { line?: number; column?: number };
      reason?: string;
    };

    const line =
      typeof yamlError.mark?.line === 'number' ? yamlError.mark.line + 1 : undefined;
    const column =
      typeof yamlError.mark?.column === 'number' ? yamlError.mark.column + 1 : undefined;

    return {
      ok: false,
      error: {
        message: yamlError.reason ?? yamlError.message ?? 'Invalid YAML document',
        line,
        column,
      },
    };
  }
}
