import { ChangeEvent, useCallback, useMemo, useState } from 'react';
import { parseYamlDocument, YamlParseResult } from '../../lib/yaml/parseYamlDocument';

type PlaybookInputProps = {
  onValidDocument: (result: YamlParseResult['document']) => void;
  initialYaml?: string;
};

export function PlaybookInput({ onValidDocument, initialYaml = '' }: PlaybookInputProps) {
  const [yamlText, setYamlText] = useState(initialYaml);
  const [parseResult, setParseResult] = useState<YamlParseResult>(() =>
    parseYamlDocument(initialYaml),
  );

  const handleParse = useCallback(
    (nextYamlText: string) => {
      const result = parseYamlDocument(nextYamlText);
      setParseResult(result);

      if (result.ok) {
        onValidDocument(result.document);
      }
    },
    [onValidDocument],
  );

  const handleEditorChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextYamlText = event.target.value;
      setYamlText(nextYamlText);
      handleParse(nextYamlText);
    },
    [handleParse],
  );

  const handleFileUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const nextYamlText = typeof reader.result === 'string' ? reader.result : '';
        setYamlText(nextYamlText);
        handleParse(nextYamlText);
      };
      reader.readAsText(file);

      event.currentTarget.value = '';
    },
    [handleParse],
  );

  const errorText = useMemo(() => {
    if (parseResult.ok) {
      return null;
    }

    const { message, line, column } = parseResult.error;
    const location =
      typeof line === 'number' && typeof column === 'number'
        ? ` (line ${line}, column ${column})`
        : '';

    return `${message}${location}`;
  }, [parseResult]);

  return (
    <section>
      <h2>Playbook YAML</h2>

      <label htmlFor="playbook-file-upload">Upload .yml/.yaml file</label>
      <input
        id="playbook-file-upload"
        type="file"
        accept=".yml,.yaml,text/yaml,application/x-yaml"
        onChange={handleFileUpload}
      />

      <label htmlFor="playbook-yaml-editor">Paste YAML</label>
      <textarea
        id="playbook-yaml-editor"
        value={yamlText}
        onChange={handleEditorChange}
        rows={18}
        spellCheck={false}
        placeholder="Paste your Ansible playbook YAML here"
      />

      {errorText ? (
        <div role="alert" aria-live="polite">
          Invalid YAML: {errorText}
        </div>
      ) : null}
    </section>
  );
}
