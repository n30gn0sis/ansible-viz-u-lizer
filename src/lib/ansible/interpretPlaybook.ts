import type { Handler, IncludeRef, Play, RoleRef, Tag, Task, Variable } from './types';

const STANDARD_TASK_KEYS = new Set([
  'name',
  'action',
  'args',
  'register',
  'when',
  'loop',
  'with_items',
  'notify',
  'tags',
  'vars',
  'become',
  'become_user',
  'become_method',
  'delegate_to',
  'delegate_facts',
  'ignore_errors',
  'ignore_unreachable',
  'failed_when',
  'changed_when',
  'check_mode',
  'diff',
  'run_once',
  'retries',
  'delay',
  'until',
  'environment',
  'any_errors_fatal',
  'throttle',
  'timeout',
  'connection',
  'port',
  'remote_user',
  'sudo',
  'sudo_user',
  'poll',
  'async',
  'loop_control',
  'no_log',
  'listen',
  'notify_group',
]);

const INCLUDE_KEYS: IncludeRef['type'][] = [
  'include_tasks',
  'import_tasks',
  'include_role',
  'import_role',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toTags(value: unknown): Tag[] {
  if (typeof value === 'string') return [{ name: value }];
  if (Array.isArray(value)) {
    return value.filter((tag): tag is string => typeof tag === 'string').map((name) => ({ name }));
  }
  return [];
}

function toNotify(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((n): n is string => typeof n === 'string');
  return [];
}

function toVariables(value: unknown): Variable[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).map(([name, variableValue]) => ({
    name,
    value: variableValue as Variable['value'],
  }));
}

function toRoles(value: unknown, warnings: string[]): RoleRef[] {
  if (!Array.isArray(value)) {
    if (value !== undefined) warnings.push('Unsupported roles format; expected an array.');
    return [];
  }

  return value.flatMap((entry, index) => {
    if (typeof entry === 'string') return [{ name: entry }];
    if (isRecord(entry)) {
      const name = typeof entry.role === 'string' ? entry.role : typeof entry.name === 'string' ? entry.name : undefined;
      if (!name) {
        warnings.push(`Role at index ${index} has no resolvable name.`);
        return [];
      }
      const params = { ...entry };
      delete params.role;
      return [{ name, params }];
    }

    warnings.push(`Unsupported role reference at index ${index}.`);
    return [];
  });
}

function toIncludeRefs(taskObj: Record<string, unknown>): IncludeRef[] {
  const refs: IncludeRef[] = [];
  for (const key of INCLUDE_KEYS) {
    if (!(key in taskObj)) continue;
    const raw = taskObj[key];
    if (typeof raw === 'string') {
      refs.push({ type: key, target: raw });
    } else if (isRecord(raw) && typeof raw.name === 'string') {
      refs.push({ type: key, target: raw.name });
    }
  }
  return refs;
}

function detectModule(taskObj: Record<string, unknown>): { module?: string; args?: unknown } {
  for (const key of Object.keys(taskObj)) {
    if (STANDARD_TASK_KEYS.has(key)) continue;
    if (INCLUDE_KEYS.includes(key as IncludeRef['type'])) continue;

    return { module: key, args: taskObj[key] };
  }
  return {};
}

function toTask(entry: unknown, kind: 'task' | 'handler', index: number): Task {
  const warnings: string[] = [];
  if (!isRecord(entry)) {
    return {
      warnings: [`Unsupported ${kind} at index ${index}; expected object.`],
    };
  }

  const includes = toIncludeRefs(entry);
  const moduleInfo = detectModule(entry);

  if (!moduleInfo.module && includes.length === 0) {
    warnings.push(`Could not determine module/include for ${kind} at index ${index}.`);
  }

  if ('block' in entry || 'rescue' in entry || 'always' in entry) {
    warnings.push(`Control-flow block keywords detected in ${kind} at index ${index}; partially supported.`);
  }

  return {
    name: typeof entry.name === 'string' ? entry.name : undefined,
    module: moduleInfo.module,
    args: moduleInfo.args,
    when: entry.when,
    loop: entry.loop ?? entry.with_items,
    notify: toNotify(entry.notify),
    tags: toTags(entry.tags),
    includes,
    raw: entry,
    warnings,
  };
}

function toTaskList(value: unknown, kind: 'task' | 'handler', playWarnings: string[]): Task[] {
  if (!Array.isArray(value)) {
    if (value !== undefined) playWarnings.push(`Unsupported ${kind}s format; expected an array.`);
    return [];
  }

  return value.map((entry, index) => toTask(entry, kind, index));
}

export interface InterpretedPlaybook {
  plays: Play[];
  warnings: string[];
}

export function interpretPlaybook(input: unknown): InterpretedPlaybook {
  const warnings: string[] = [];
  if (!Array.isArray(input)) {
    return {
      plays: [],
      warnings: ['Unsupported playbook root; expected a top-level list of plays.'],
    };
  }

  const plays: Play[] = input.map((entry, index) => {
    const playWarnings: string[] = [];
    if (!isRecord(entry)) {
      playWarnings.push(`Unsupported play at index ${index}; expected object.`);
      return {
        roles: [],
        tasks: [],
        handlers: [],
        vars: [],
        tags: [],
        warnings: playWarnings,
      };
    }

    if (entry.serial !== undefined) {
      playWarnings.push('Play key "serial" is not explicitly interpreted.');
    }

    return {
      name: typeof entry.name === 'string' ? entry.name : undefined,
      hosts:
        typeof entry.hosts === 'string' || Array.isArray(entry.hosts)
          ? (entry.hosts as string | string[])
          : undefined,
      roles: toRoles(entry.roles, playWarnings),
      tasks: toTaskList(entry.tasks, 'task', playWarnings),
      handlers: toTaskList(entry.handlers, 'handler', playWarnings) as Handler[],
      vars: toVariables(entry.vars),
      tags: toTags(entry.tags),
      warnings: playWarnings,
    };
  });

  for (const [index, play] of plays.entries()) {
    play.warnings.forEach((w) => warnings.push(`Play ${index}: ${w}`));
    play.tasks.forEach((t, taskIndex) => t.warnings.forEach((w) => warnings.push(`Play ${index} task ${taskIndex}: ${w}`)));
    play.handlers.forEach((h, handlerIndex) => h.warnings.forEach((w) => warnings.push(`Play ${index} handler ${handlerIndex}: ${w}`)));
  }

  return { plays, warnings };
}
