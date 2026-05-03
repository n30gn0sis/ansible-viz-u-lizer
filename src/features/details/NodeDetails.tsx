import { Node } from 'reactflow';

type NodeDetailsProps<T = Record<string, unknown>> = {
  selectedNode: Node<T> | null;
};

export default function NodeDetails({ selectedNode }: NodeDetailsProps) {
  if (!selectedNode) {
    return (
      <aside style={{ padding: 12, borderLeft: '1px solid #e2e8f0' }}>
        <h3>Node Details</h3>
        <p>Select a node in the graph to inspect details.</p>
      </aside>
    );
  }

  return (
    <aside style={{ padding: 12, borderLeft: '1px solid #e2e8f0' }}>
      <h3>Node Details</h3>
      <dl style={{ margin: 0 }}>
        <dt>ID</dt>
        <dd>{selectedNode.id}</dd>

        <dt>Type</dt>
        <dd>{String(selectedNode.data?.groupType ?? 'unknown')}</dd>

        <dt>Label</dt>
        <dd>{String(selectedNode.data?.label ?? '')}</dd>

        <dt>Role</dt>
        <dd>{String(selectedNode.data?.role ?? '-')}</dd>

        <dt>Host</dt>
        <dd>{String(selectedNode.data?.host ?? '-')}</dd>

        <dt>Tag</dt>
        <dd>{String(selectedNode.data?.tag ?? '-')}</dd>

        <dt>Module</dt>
        <dd>{String(selectedNode.data?.module ?? '-')}</dd>

        <dt>Conditional</dt>
        <dd>{selectedNode.data?.conditional ? 'Yes' : 'No'}</dd>

        <dt>Loop</dt>
        <dd>{selectedNode.data?.loop ? 'Yes' : 'No'}</dd>

        <dt>Notify</dt>
        <dd>{Array.isArray(selectedNode.data?.notify) ? selectedNode.data.notify.join(', ') : '-'}</dd>
      </dl>
    </aside>
  );
}
