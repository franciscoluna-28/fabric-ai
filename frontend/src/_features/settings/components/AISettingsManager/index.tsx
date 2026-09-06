"use client";

import { useSyncExternalStore, useState } from "react";
import { Card, CardContent } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Label } from "@/src/components/ui/label";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { PROVIDERS } from "@/src/shared/constants";
import { ModelSelector } from "@/src/_features/settings/components/ModelSelector";
import {
  useAISettings,
  useUpdateAISettings,
  type AISettings,
} from "@/src/shared/services/ai-settings";
import { useModels } from "@/src/shared/services/ai-models";

type Draft = {
  reportProvider: AISettings["reportProvider"];
  reportModel: string;
  embeddingModel: string;
};

function draftFrom(settings?: AISettings): Draft {
  return {
    reportProvider: settings?.reportProvider ?? "openrouter",
    reportModel: settings?.reportModel ?? "",
    embeddingModel: settings?.embeddingModel ?? "",
  };
}

export function AISettingsManager() {
  const { settings, isLoading, error } = useAISettings();
  const updateSettings = useUpdateAISettings();

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [draft, setDraft] = useState<Draft>(() => draftFrom(settings));
  const [prevSettings, setPrevSettings] = useState(settings);
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setDraft(draftFrom(settings));
  }

  const { reportProvider, reportModel, embeddingModel } = draft;
  const setReportProvider = (reportProvider: AISettings["reportProvider"]) =>
    setDraft((d) => ({ ...d, reportProvider }));
  const setReportModel = (reportModel: string) =>
    setDraft((d) => ({ ...d, reportModel }));
  const setEmbeddingModel = (embeddingModel: string) =>
    setDraft((d) => ({ ...d, embeddingModel }));

  const {
    models: chatModels,
    isLoading: chatModelsLoading,
  } = useModels(reportProvider);

  const {
    models: embeddingModels,
    isLoading: embeddingModelsLoading,
  } = useModels("openrouter", "embeddings");

  const dirty =
    !!settings &&
    (reportProvider !== settings.reportProvider ||
      reportModel !== settings.reportModel ||
      embeddingModel !== settings.embeddingModel);

  const handleSave = async () => {
    if (!reportModel || !embeddingModel) {
      toast.error("Select a model for both report generation and embeddings");
      return;
    }

    try {
      await updateSettings.mutateAsync({
        reportProvider,
        reportModel,
        embeddingProvider: "openrouter",
        embeddingModel,
      });
      toast.success("AI settings saved");
    } catch {
      toast.error("Failed to save AI settings");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !settings) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-red-600">Failed to load AI settings</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold">AI Settings</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Choose the models Scrapecat uses across the app. Changes here apply
            globally.
          </p>
        </div>

        <div className="space-y-3">
          <div className="max-w-xs">
            <Label htmlFor="report-provider" className="text-sm font-medium">
              Report Generation Provider
            </Label>
            <Select value={reportProvider} onValueChange={(v) => setReportProvider(v as AISettings["reportProvider"])}>
              <SelectTrigger id="report-provider" className="mt-1.5">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="max-w-xs">
            <Label htmlFor="report-model" className="text-sm font-medium">
              Report Generation Model
            </Label>
            <div className="mt-1.5">
              <ModelSelector
                models={chatModels}
                selectedModel={reportModel}
                onModelChange={setReportModel}
                loading={chatModelsLoading}
                mounted={mounted}
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="max-w-xs">
            <Label htmlFor="embedding-model" className="text-sm font-medium">
              Embeddings Model
            </Label>
            <div className="mt-1.5">
              <ModelSelector
                models={embeddingModels}
                selectedModel={embeddingModel}
                onModelChange={setEmbeddingModel}
                loading={embeddingModelsLoading}
                mounted={mounted}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              OpenRouter · limited to 512-dimension models. Changing it applies
              to newly synced commits; existing embeddings keep their model.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!dirty || updateSettings.isPending} size="sm">
            {updateSettings.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
