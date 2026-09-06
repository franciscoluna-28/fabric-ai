"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { usePromptPresetsStore } from "@/src/store/prompt-presets";
import { FileText } from "lucide-react";

interface PromptPresetsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPrompt: (prompt: string) => void;
}

export function PromptPresetsModal({
  open,
  onOpenChange,
  onSelectPrompt,
}: PromptPresetsModalProps) {
  const { presets } = usePromptPresetsStore();

  const handleLoad = (prompt: string) => {
    onSelectPrompt(prompt);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Prompt Presets</DialogTitle>
          <DialogDescription>
            Save the current instructions as a preset or load an existing one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {presets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No presets saved yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-start gap-2 rounded-lg border p-3"
                >
                  <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {preset.name}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {preset.prompt}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => handleLoad(preset.prompt)}
                  >
                    Load
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
