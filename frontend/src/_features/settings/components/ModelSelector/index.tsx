"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/src/components/ui/combobox";

type Model = {
  id: string;
  name: string;
  free?: boolean;
};

type Props = {
  models: Model[];
  selectedModel: string;
  onModelChange: (value: string) => void;
  loading: boolean;
  mounted: boolean;
};

export function ModelSelector({
  models,
  selectedModel,
  onModelChange,
  loading,
  mounted,
}: Props) {
  const modelMap = Object.fromEntries(models.map((m) => [m.id, m]));

  return (
    <Combobox
      items={models.map((m) => m.id)}
      itemToStringValue={(id) => modelMap[id]?.name || id}
      value={selectedModel}
      onValueChange={(v) => v && onModelChange(v)}
      disabled={loading || !mounted}
    >
      <ComboboxInput
        placeholder={loading ? "Loading models..." : "Search models..."}
        showClear={mounted}
      />
      <ComboboxContent>
        <ComboboxEmpty>No models found.</ComboboxEmpty>
        <ComboboxList>
          {(modelId) => (
            <ComboboxItem key={modelId} value={modelId}>
              {modelMap[modelId]?.name} {modelMap[modelId]?.free ? "(Free)" : ""}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
