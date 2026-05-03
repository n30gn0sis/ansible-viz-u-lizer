export type Primitive = string | number | boolean | null;

export type VariableValue = Primitive | Primitive[] | Record<string, unknown>;

export interface Variable {
  name: string;
  value: VariableValue;
}

export interface Tag {
  name: string;
}

export interface IncludeRef {
  type: 'include_tasks' | 'import_tasks' | 'include_role' | 'import_role';
  target: string;
}

export interface RoleRef {
  name: string;
  params?: Record<string, unknown>;
}

export interface Task {
  name?: string;
  module?: string;
  args?: unknown;
  when?: unknown;
  loop?: unknown;
  notify?: string[];
  tags?: Tag[];
  includes?: IncludeRef[];
  raw?: Record<string, unknown>;
  warnings: string[];
}

export interface Handler extends Task {}

export interface Play {
  name?: string;
  hosts?: string | string[];
  roles: RoleRef[];
  tasks: Task[];
  handlers: Handler[];
  vars: Variable[];
  tags: Tag[];
  warnings: string[];
}
