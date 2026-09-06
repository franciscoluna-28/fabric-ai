import { PROVIDERS } from "@/src/shared/constants";
import { Badge } from "@/src/components/ui/badge";

export function ProviderIcon({ provider }: { provider: string }) {
  return (
    <Badge variant="secondary">
      {PROVIDERS.find((p) => p.id === provider)?.label || provider}
    </Badge>
  );
}
