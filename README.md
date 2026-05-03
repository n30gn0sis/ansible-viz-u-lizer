# ansible-viz-u-lizer

## Recommended architecture

Organize the project into clear responsibilities so parsing, interpretation, graph construction, and UI rendering evolve independently:

- `lib/yaml`: Load and parse YAML documents into a normalized intermediate structure.
- `lib/ansible`: Interpret parsed YAML as Ansible concepts (playbooks, plays, tasks, roles, includes, vars).
- `lib/graph`: Transform interpreted Ansible structures into graph primitives (nodes, edges, groups, metadata).
- `features/*`: UI modules for visualization, interactions, filters, and user workflows built on top of `lib/graph` outputs.

## Setup and run

Typical local workflow:

1. Install dependencies.
2. Run the development server.
3. Build a production bundle.

Example commands (adapt if your package manager differs):

```bash
npm install
npm run dev
npm run build
```

## Explicit assumptions

Current scope is intentionally pragmatic:

- The tool prioritizes support for common Ansible playbook patterns first.
- Behavior is optimized for readability and useful graph output over full Ansible execution fidelity.

## Unsupported or partially supported edge cases

The following are known limitations at this stage:

- Advanced dynamic include behavior.
- YAML anchors/aliases edge behavior.
- Complex role defaults resolution precedence in deeply layered role trees.
- Full templating evaluation (for example, Jinja expressions requiring runtime inventory or host facts).

## Future improvements

Planned enhancements include:

- Richer AST with precise line mapping back to source files.
- Diff mode for comparing two playbook versions.
- Graph export options (PNG/SVG).
- Collapsible subgraphs for large playbooks/role hierarchies.
- Lint hints surfaced directly in graph context.
