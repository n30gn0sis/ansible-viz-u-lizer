import { useMemo, useState } from "react";
import samplePlaybook from "./sample/samplePlaybook.yaml?raw";
import { runPipeline } from "./lib/pipeline";

export default function App() {
  const [editorValue, setEditorValue] = useState(samplePlaybook);
  const result = useMemo(() => runPipeline(editorValue), [editorValue]);

  return (
    <main style={{ fontFamily: "system-ui", padding: 16, display: "grid", gap: 16 }}>
      <h1>Ansible Viz U Lizer</h1>

      <section>
        <h2>Playbook editor</h2>
        <textarea
          value={editorValue}
          onChange={(event) => setEditorValue(event.target.value)}
          rows={20}
          style={{ width: "100%", fontFamily: "monospace" }}
        />
      </section>

      <section>
        <h2>Warnings (non-blocking)</h2>
        {result.warnings.length === 0 ? (
          <p>No warnings.</p>
        ) : (
          <ul>
            {result.warnings.map((warning, index) => (
              <li key={`${warning.stage}-${index}`}>
                [{warning.stage}] {warning.message} {warning.path ? `(${warning.path})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Pipeline output</h2>
        <p>Stages: YAML parse → Ansible interpret → Graph build</p>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </section>
    </main>
  );
}
