"use client";

import { Card, CardContent } from "@/src/components/ui/card";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { CredentialsManager } from "@/src/_features/credentials/components/CredentialsManager";

export default function ApiKeysPage() {
  return (
    <SectionLayout>
      <Card>
        <CardContent className="p-6">
          <CredentialsManager />
        </CardContent>
      </Card>
    </SectionLayout>
  );
}
