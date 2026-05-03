import { useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  MiniMap,
  Node,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

type GroupType = 'play' | 'role' | 'task';

type GraphNodeData = {
  label: string;
  groupType: GroupType;
  taskName?: string;
  tag?: string;
  role?: string;
  host?: string;
  module?: string;
  conditional?: boolean;
  loop?: boolean;
  notify?: string[];
  collapsed?: boolean;
};

type FilterState = {
  taskName: string;
  tag: string;
  role: string;
  host: string;
  module: string;
};

const initialNodes: Node<GraphNodeData>[] = [
  {
    id: 'play-1',
    position: { x: 50, y: 120 },
    data: { label: 'Play: Web Stack', groupType: 'play', collapsed: false },
    style: { border: '2px solid #2563eb', borderRadius: 8, padding: 8 },
  },
  {
    id: 'role-1',
    parentNode: 'play-1',
    extent: 'parent',
    position: { x: 40, y: 80 },
    data: { label: 'Role: nginx', groupType: 'role', role: 'nginx', collapsed: false },
    style: { border: '1px solid #16a34a', borderRadius: 8, padding: 8 },
  },
  {
    id: 'task-1',
    parentNode: 'role-1',
    extent: 'parent',
    position: { x: 40, y: 80 },
    data: {
      label: 'Install package',
      groupType: 'task',
      taskName: 'Install package',
      tag: 'packages',
      role: 'nginx',
      host: 'web01',
      module: 'apt',
      conditional: true,
      notify: ['task-2'],
    },
    style: { border: '1px solid #64748b', borderRadius: 8, padding: 8 },
  },
  {
    id: 'task-2',
    parentNode: 'role-1',
    extent: 'parent',
    position: { x: 250, y: 80 },
    data: {
      label: 'Template config',
      groupType: 'task',
      taskName: 'Template config',
      tag: 'config',
      role: 'nginx',
      host: 'web01',
      module: 'template',
      loop: true,
    },
    style: { border: '1px solid #64748b', borderRadius: 8, padding: 8 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e-play-role', source: 'play-1', target: 'role-1', type: 'smoothstep' },
  { id: 'e-role-task1', source: 'role-1', target: 'task-1', type: 'smoothstep' },
  { id: 'e-role-task2', source: 'role-1', target: 'task-2', type: 'smoothstep' },
  {
    id: 'e-notify-task1-task2',
    source: 'task-1',
    target: 'task-2',
    type: 'step',
    animated: true,
    label: 'notify',
    style: { stroke: '#f97316', strokeDasharray: '6 4' },
  },
];

const matchesFilter = (node: Node<GraphNodeData>, filters: FilterState): boolean => {
  const { data } = node;
  const normalized = {
    taskName: data.taskName?.toLowerCase() ?? '',
    tag: data.tag?.toLowerCase() ?? '',
    role: data.role?.toLowerCase() ?? '',
    host: data.host?.toLowerCase() ?? '',
    module: data.module?.toLowerCase() ?? '',
  };

  return (
    normalized.taskName.includes(filters.taskName.toLowerCase()) &&
    normalized.tag.includes(filters.tag.toLowerCase()) &&
    normalized.role.includes(filters.role.toLowerCase()) &&
    normalized.host.includes(filters.host.toLowerCase()) &&
    normalized.module.includes(filters.module.toLowerCase())
  );
};

export type PlaybookGraphProps = {
  onNodeSelect?: (node: Node<GraphNodeData> | null) => void;
};

export default function PlaybookGraph({ onNodeSelect }: PlaybookGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [filters, setFilters] = useState<FilterState>({
    taskName: '',
    tag: '',
    role: '',
    host: '',
    module: '',
  });

  const visibleNodeIds = useMemo(() => {
    const collapsedIds = new Set(
      nodes.filter((node) => node.data.collapsed).map((node) => node.id),
    );

    return new Set(
      nodes
        .filter((node) => {
          if (!matchesFilter(node, filters) && node.data.groupType === 'task') {
            return false;
          }

          const parent = node.parentNode;
          if (!parent) {
            return true;
          }

          return !collapsedIds.has(parent);
        })
        .map((node) => node.id),
    );
  }, [filters, nodes]);

  const filteredNodes = useMemo(
    () => nodes.map((node) => ({ ...node, hidden: !visibleNodeIds.has(node.id) })),
    [nodes, visibleNodeIds],
  );

  const filteredEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        hidden: !visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target),
      })),
    [edges, visibleNodeIds],
  );

  const toggleCollapsed = (nodeId: string) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, collapsed: !node.data.collapsed } }
          : node,
      ),
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(140px, 1fr))', gap: 8 }}>
        {(['taskName', 'tag', 'role', 'host', 'module'] as const).map((key) => (
          <input
            key={key}
            placeholder={`Filter by ${key}`}
            value={filters[key]}
            onChange={(event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }))}
          />
        ))}
      </div>

      <div style={{ width: '100%', height: 650, border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <ReactFlow
          nodes={filteredNodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              label: `${node.data.label}${node.data.conditional ? ' [when]' : ''}${node.data.loop ? ' [loop]' : ''}`,
            },
          }))}
          edges={filteredEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => onNodeSelect?.(node as Node<GraphNodeData>)}
          onNodeDoubleClick={(_, node) => {
            if (node.data.groupType !== 'task') {
              toggleCollapsed(node.id);
            }
          }}
          fitView
          panOnDrag
          zoomOnScroll
        >
          <MiniMap />
          <Controls showInteractive={false} />
          <Background gap={16} />
        </ReactFlow>
      </div>
    </div>
  );
}
