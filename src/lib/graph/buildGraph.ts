export type GraphNodeType =
  | 'playbook'
  | 'play'
  | 'role'
  | 'task'
  | 'handler'
  | 'module';

export type GraphEdgeType =
  | 'parent-child'
  | 'role-task'
  | 'task-module'
  | 'task-notify-handler'
  | 'include-import';

export interface InterpretedPlaybookModel {
  name?: string;
  line?: number;
  plays?: InterpretedPlay[];
}

export interface InterpretedPlay {
  id?: string;
  name?: string;
  hosts?: string | string[];
  tags?: string[];
  when?: string;
  loop?: unknown;
  line?: number;
  roles?: InterpretedRole[];
  tasks?: InterpretedTask[];
  handlers?: InterpretedHandler[];
}

export interface InterpretedRole {
  id?: string;
  name?: string;
  tags?: string[];
  when?: string;
  loop?: unknown;
  line?: number;
  tasks?: InterpretedTask[];
}

export interface InterpretedTask {
  id?: string;
  name?: string;
  module?: string;
  tags?: string[];
  when?: string;
  loop?: unknown;
  line?: number;
  notify?: string | string[];
  include?: string;
  import?: string;
}

export interface InterpretedHandler extends Omit<InterpretedTask, 'notify'> {}

export interface GraphNodeStyleHints {
  color: string;
  icon: string;
  hasCondition?: boolean;
  hasLoop?: boolean;
}

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  metadata: {
    originalName?: string;
    type: GraphNodeType;
    tags: string[];
    hosts?: string[];
    condition?: string;
    loop?: string;
    line?: number;
  };
  style: GraphNodeStyleHints;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
}

export interface GraphBuildResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const TYPE_STYLE: Record<GraphNodeType, GraphNodeStyleHints> = {
  playbook: { color: '#334155', icon: 'book' },
  play: { color: '#2563eb', icon: 'layers' },
  role: { color: '#7c3aed', icon: 'shield' },
  task: { color: '#16a34a', icon: 'check-square' },
  handler: { color: '#ea580c', icon: 'bell' },
  module: { color: '#0891b2', icon: 'box' },
};

function normalizeTags(tags?: string[]): string[] {
  return [...new Set((tags ?? []).map((t) => t.trim()).filter(Boolean))].sort();
}

function normalizeHosts(hosts?: string | string[]): string[] | undefined {
  if (!hosts) return undefined;
  const raw = Array.isArray(hosts) ? hosts : [hosts];
  const values = raw.flatMap((h) => h.split(',')).map((h) => h.trim()).filter(Boolean);
  if (values.length === 0) return undefined;
  return [...new Set(values)].sort();
}

function serializeLoop(loop: unknown): string | undefined {
  if (loop === undefined || loop === null) return undefined;
  if (typeof loop === 'string') return loop;
  try {
    return JSON.stringify(loop);
  } catch {
    return String(loop);
  }
}

function stableId(parts: Array<string | number | undefined | null>): string {
  return parts
    .filter((p) => p !== undefined && p !== null && String(p).trim().length > 0)
    .map((p) => String(p).trim().toLowerCase().replace(/\s+/g, '-'))
    .join('::');
}

function edgeId(type: GraphEdgeType, source: string, target: string): string {
  return `${type}::${source}=>${target}`;
}

function makeNode(
  id: string,
  type: GraphNodeType,
  label: string,
  details: {
    originalName?: string;
    tags?: string[];
    hosts?: string | string[];
    condition?: string;
    loop?: unknown;
    line?: number;
  } = {},
): GraphNode {
  const baseStyle = TYPE_STYLE[type];
  const loopValue = serializeLoop(details.loop);
  return {
    id,
    type,
    label,
    metadata: {
      originalName: details.originalName,
      type,
      tags: normalizeTags(details.tags),
      hosts: normalizeHosts(details.hosts),
      condition: details.condition,
      loop: loopValue,
      line: details.line,
    },
    style: {
      ...baseStyle,
      hasCondition: Boolean(details.condition),
      hasLoop: Boolean(loopValue),
    },
  };
}

export function buildGraph(model: InterpretedPlaybookModel): GraphBuildResult {
  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();
  const handlerNameToId = new Map<string, string>();

  const playbookId = stableId(['playbook', model.name ?? 'root']);
  nodeMap.set(
    playbookId,
    makeNode(playbookId, 'playbook', model.name ?? 'Playbook', {
      originalName: model.name,
      line: model.line,
    }),
  );

  (model.plays ?? []).forEach((play, playIndex) => {
    const playId = stableId(['play', play.id ?? playIndex, play.name ?? `play-${playIndex + 1}`]);
    nodeMap.set(
      playId,
      makeNode(playId, 'play', play.name ?? `Play ${playIndex + 1}`, {
        originalName: play.name,
        tags: play.tags,
        hosts: play.hosts,
        condition: play.when,
        loop: play.loop,
        line: play.line,
      }),
    );

    edgeMap.set(edgeId('parent-child', playbookId, playId), {
      id: edgeId('parent-child', playbookId, playId),
      source: playbookId,
      target: playId,
      type: 'parent-child',
    });

    (play.handlers ?? []).forEach((handler, handlerIndex) => {
      const handlerId = stableId([
        'handler',
        playId,
        handler.id ?? handlerIndex,
        handler.name ?? `handler-${handlerIndex + 1}`,
      ]);
      const handlerLabel = handler.name ?? `Handler ${handlerIndex + 1}`;
      nodeMap.set(
        handlerId,
        makeNode(handlerId, 'handler', handlerLabel, {
          originalName: handler.name,
          tags: handler.tags,
          condition: handler.when,
          loop: handler.loop,
          line: handler.line,
        }),
      );
      handlerNameToId.set(handlerLabel.trim().toLowerCase(), handlerId);
      edgeMap.set(edgeId('parent-child', playId, handlerId), {
        id: edgeId('parent-child', playId, handlerId),
        source: playId,
        target: handlerId,
        type: 'parent-child',
      });
    });

    (play.roles ?? []).forEach((role, roleIndex) => {
      const roleId = stableId(['role', playId, role.id ?? roleIndex, role.name ?? `role-${roleIndex + 1}`]);
      nodeMap.set(
        roleId,
        makeNode(roleId, 'role', role.name ?? `Role ${roleIndex + 1}`, {
          originalName: role.name,
          tags: role.tags,
          condition: role.when,
          loop: role.loop,
          line: role.line,
        }),
      );

      edgeMap.set(edgeId('parent-child', playId, roleId), {
        id: edgeId('parent-child', playId, roleId),
        source: playId,
        target: roleId,
        type: 'parent-child',
      });

      (role.tasks ?? []).forEach((task, taskIndex) => {
        addTaskGraph(task, {
          parentId: roleId,
          roleId,
          playId,
          taskIndex,
          nodeMap,
          edgeMap,
          handlerNameToId,
        });
      });
    });

    (play.tasks ?? []).forEach((task, taskIndex) => {
      addTaskGraph(task, {
        parentId: playId,
        playId,
        taskIndex,
        nodeMap,
        edgeMap,
        handlerNameToId,
      });
    });
  });

  return {
    nodes: [...nodeMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...edgeMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function addTaskGraph(
  task: InterpretedTask,
  ctx: {
    parentId: string;
    playId: string;
    roleId?: string;
    taskIndex: number;
    nodeMap: Map<string, GraphNode>;
    edgeMap: Map<string, GraphEdge>;
    handlerNameToId: Map<string, string>;
  },
): void {
  const taskId = stableId(['task', ctx.parentId, task.id ?? ctx.taskIndex, task.name ?? `task-${ctx.taskIndex + 1}`]);
  const taskLabel = task.name ?? `Task ${ctx.taskIndex + 1}`;

  ctx.nodeMap.set(
    taskId,
    makeNode(taskId, 'task', taskLabel, {
      originalName: task.name,
      tags: task.tags,
      condition: task.when,
      loop: task.loop,
      line: task.line,
    }),
  );

  ctx.edgeMap.set(edgeId('parent-child', ctx.parentId, taskId), {
    id: edgeId('parent-child', ctx.parentId, taskId),
    source: ctx.parentId,
    target: taskId,
    type: 'parent-child',
  });

  if (ctx.roleId) {
    ctx.edgeMap.set(edgeId('role-task', ctx.roleId, taskId), {
      id: edgeId('role-task', ctx.roleId, taskId),
      source: ctx.roleId,
      target: taskId,
      type: 'role-task',
    });
  }

  if (task.module) {
    const moduleId = stableId(['module', task.module]);
    if (!ctx.nodeMap.has(moduleId)) {
      ctx.nodeMap.set(moduleId, makeNode(moduleId, 'module', task.module, { originalName: task.module }));
    }
    ctx.edgeMap.set(edgeId('task-module', taskId, moduleId), {
      id: edgeId('task-module', taskId, moduleId),
      source: taskId,
      target: moduleId,
      type: 'task-module',
    });
  }

  const notifies = Array.isArray(task.notify) ? task.notify : task.notify ? [task.notify] : [];
  notifies.forEach((notifyName) => {
    const key = notifyName.trim().toLowerCase();
    const handlerId = ctx.handlerNameToId.get(key);
    if (!handlerId) return;

    ctx.edgeMap.set(edgeId('task-notify-handler', taskId, handlerId), {
      id: edgeId('task-notify-handler', taskId, handlerId),
      source: taskId,
      target: handlerId,
      type: 'task-notify-handler',
    });
  });

  const includeTarget = task.include ?? task.import;
  if (includeTarget) {
    const includeNodeId = stableId(['module', 'include', includeTarget]);
    if (!ctx.nodeMap.has(includeNodeId)) {
      ctx.nodeMap.set(includeNodeId, makeNode(includeNodeId, 'module', includeTarget, { originalName: includeTarget }));
    }

    ctx.edgeMap.set(edgeId('include-import', taskId, includeNodeId), {
      id: edgeId('include-import', taskId, includeNodeId),
      source: taskId,
      target: includeNodeId,
      type: 'include-import',
    });
  }
}
