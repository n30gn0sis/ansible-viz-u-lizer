import { parse } from "yaml";

export type WarningLevel = "warning";

export interface PipelineWarning {
  level: WarningLevel;
  stage: "yaml-parse" | "ansible-interpret" | "graph-build";
  message: string;
  path?: string;
}

export interface TaskNode {
  id: string;
  name: string;
  tags: string[];
  when?: string;
  loop?: unknown;
  notify: string[];
}

export interface PlayModel {
  id: string;
  name: string;
  hosts?: string;
  vars: Record<string, unknown>;
  roles: string[];
  tasks: TaskNode[];
  handlers: string[];
}

export interface GraphNode {
  id: string;
  kind: "play" | "role" | "task" | "handler";
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PipelineResult {
  yaml: unknown;
  plays: PlayModel[];
  graph: GraphModel;
  warnings: PipelineWarning[];
}

const SUPPORTED_PLAY_KEYS = new Set(["name", "hosts", "become", "vars", "roles", "tasks", "handlers", "tags"]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const toName = (fallback: string, value: unknown) => (typeof value === "string" && value.trim() ? value : fallback);

const moduleKeyFromTask = (task: Record<string, unknown>) =>
  Object.keys(task).find((key) => key !== "name" && key !== "tags" && key !== "when" && key !== "notify" && key !== "loop");

export function runPipeline(source: string): PipelineResult {
  const warnings: PipelineWarning[] = [];

  // Stage 1: YAML parse
  let yaml: unknown = [];
  try {
    yaml = parse(source) ?? [];
  } catch (error) {
    warnings.push({
      level: "warning",
      stage: "yaml-parse",
      message: `YAML parse issue: ${error instanceof Error ? error.message : "Unknown parse error"}`,
    });
    yaml = [];
  }

  // Stage 2: Ansible interpret
  const plays: PlayModel[] = [];
  const yamlPlays = asArray<Record<string, unknown>>(yaml);

  yamlPlays.forEach((rawPlay, playIndex) => {
    if (!isObject(rawPlay)) {
      warnings.push({
        level: "warning",
        stage: "ansible-interpret",
        message: "Play entry is not an object and was ignored.",
        path: `plays[${playIndex}]`,
      });
      return;
    }

    Object.keys(rawPlay).forEach((key) => {
      if (!SUPPORTED_PLAY_KEYS.has(key)) {
        warnings.push({
          level: "warning",
          stage: "ansible-interpret",
          message: `Unsupported play key '${key}' was ignored.`,
          path: `plays[${playIndex}].${key}`,
        });
      }
    });

    const tasks = asArray<Record<string, unknown>>(rawPlay.tasks).map((task, taskIndex) => {
      const moduleKey = isObject(task) ? moduleKeyFromTask(task) : undefined;
      if (!moduleKey) {
        warnings.push({
          level: "warning",
          stage: "ansible-interpret",
          message: "Task has no supported module key.",
          path: `plays[${playIndex}].tasks[${taskIndex}]`,
        });
      }

      return {
        id: `play-${playIndex}-task-${taskIndex}`,
        name: toName(`Task ${taskIndex + 1}`, isObject(task) ? task.name : undefined),
        tags: asArray<string>(isObject(task) ? task.tags : []),
        when: typeof task.when === "string" ? task.when : undefined,
        loop: isObject(task) ? task.loop : undefined,
        notify: typeof task.notify === "string"
          ? [task.notify]
          : asArray<string>(isObject(task) ? task.notify : []),
      } as TaskNode;
    });

    plays.push({
      id: `play-${playIndex}`,
      name: toName(`Play ${playIndex + 1}`, rawPlay.name),
      hosts: typeof rawPlay.hosts === "string" ? rawPlay.hosts : undefined,
      vars: isObject(rawPlay.vars) ? rawPlay.vars : {},
      roles: asArray<string>(rawPlay.roles),
      tasks,
      handlers: asArray<Record<string, unknown>>(rawPlay.handlers).map((handler, handlerIndex) =>
        toName(`Handler ${handlerIndex + 1}`, handler?.name),
      ),
    });
  });

  // Stage 3: Graph build
  const graph: GraphModel = { nodes: [], edges: [] };

  plays.forEach((play) => {
    graph.nodes.push({ id: play.id, kind: "play", label: play.name });

    play.roles.forEach((role, roleIndex) => {
      const roleId = `${play.id}-role-${roleIndex}`;
      graph.nodes.push({ id: roleId, kind: "role", label: role });
      graph.edges.push({ from: play.id, to: roleId, label: "uses" });
    });

    play.tasks.forEach((task) => {
      graph.nodes.push({ id: task.id, kind: "task", label: task.name });
      graph.edges.push({ from: play.id, to: task.id, label: "runs" });

      task.notify.forEach((handlerName) => {
        const handlerId = `${play.id}-handler-${handlerName}`;
        if (!graph.nodes.some((node) => node.id === handlerId)) {
          graph.nodes.push({ id: handlerId, kind: "handler", label: handlerName });
        }
        graph.edges.push({ from: task.id, to: handlerId, label: "notifies" });
      });
    });

    play.handlers.forEach((handlerName) => {
      const handlerId = `${play.id}-handler-${handlerName}`;
      if (!graph.nodes.some((node) => node.id === handlerId)) {
        graph.nodes.push({ id: handlerId, kind: "handler", label: handlerName });
      }
      graph.edges.push({ from: play.id, to: handlerId, label: "defines" });
    });
  });

  return { yaml, plays, graph, warnings };
}
