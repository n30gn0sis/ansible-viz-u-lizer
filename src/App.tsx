import { ChangeEvent, useMemo, useState } from 'react'
import yaml from 'js-yaml'
import {
  Background,
  Controls,
  MiniMap,
  Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

type PlayNode = {
  id: string
  name: string
  hosts?: string
  tasks?: Array<{ name?: string; [k: string]: unknown }>
  [k: string]: unknown
}

const starterYaml = `- name: Web setup
  hosts: all
  tasks:
    - name: Install nginx
      apt:
        name: nginx
        state: present
    - name: Start nginx
      service:
        name: nginx
        state: started

- name: Configure app
  hosts: app
  tasks:
    - name: Upload app config
      template:
        src: app.conf.j2
        dest: /etc/app.conf
`

function App() {
  const [yamlInput, setYamlInput] = useState(starterYaml)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const graph = useMemo(() => {
    try {
      const parsed = yaml.load(yamlInput)
      const plays = Array.isArray(parsed) ? (parsed as PlayNode[]) : [parsed as PlayNode]

      const nodes: Node[] = plays
        .filter((play): play is PlayNode => Boolean(play && typeof play === 'object'))
        .map((play, index) => ({
          id: play.id ?? `play-${index + 1}`,
          position: { x: 80 + index * 260, y: 100 + (index % 2) * 180 },
          data: { label: play.name ?? `Play ${index + 1}`, raw: play },
          type: 'default'
        }))

      const edges: Edge[] = nodes.slice(1).map((node, index) => ({
        id: `edge-${index}`,
        source: nodes[index].id,
        target: node.id,
        animated: true
      }))

      return { nodes, edges, error: null as string | null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to parse YAML'
      return { nodes: [] as Node[], edges: [] as Edge[], error: message }
    }
  }, [yamlInput])

  const [nodes, , onNodesChange] = useNodesState(graph.nodes)
  const [edges, , onEdgesChange] = useEdgesState(graph.edges)

  const selectedNode = nodes.find((node) => node.id === selectedNodeId)

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setYamlInput(await file.text())
  }

  return (
    <div className="grid h-full grid-cols-[320px_1fr_320px] gap-4 p-4">
      <aside className="flex flex-col rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">YAML Input</h2>
        <textarea
          className="h-full min-h-64 resize-none rounded-md border border-slate-300 p-3 font-mono text-sm"
          value={yamlInput}
          onChange={(event) => setYamlInput(event.target.value)}
          placeholder="Paste Ansible playbook YAML here"
        />
        <label className="mt-3 text-sm font-medium text-slate-700">
          Upload YAML file
          <input
            className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
            type="file"
            accept=".yml,.yaml,text/yaml,text/x-yaml"
            onChange={handleUpload}
          />
        </label>
        {graph.error && <p className="mt-2 text-sm text-red-600">{graph.error}</p>}
      </aside>

      <main className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </main>

      <aside className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Node Details</h2>
        {!selectedNode && <p className="text-sm text-slate-500">Select a node to inspect details.</p>}
        {selectedNode && (
          <pre className="overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
            {JSON.stringify(selectedNode.data.raw ?? selectedNode.data, null, 2)}
          </pre>
        )}
      </aside>
    </div>
  )
}

export default App
