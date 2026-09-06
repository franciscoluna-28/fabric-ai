"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Label } from "@/src/components/ui/label";
import { Input } from "@/src/components/ui/input";
import { Card, CardContent } from "@/src/components/ui/card";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { useGitHubSettingsStore } from "@/src/store/github-settings";
import { AISettingsManager } from "@/src/_features/settings/components/AISettingsManager";

export default function SettingsPage() {
  const {
    repositoryType,
    perPage,
    sort,
    direction,
    setRepositoryType,
    setPerPage,
    setSort,
    setDirection,
  } = useGitHubSettingsStore();

  return (
    <SectionLayout>
      <Card>
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="text-base font-semibold">GitHub Settings</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Configure how repositories are fetched from GitHub.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Repository Type</Label>
              <Select value={repositoryType} onValueChange={(v) => setRepositoryType(v as "all" | "owner" | "public" | "private")}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="perPage">Per Page</Label>
              <Input
                id="perPage"
                type="number"
                min="1"
                max="100"
                value={perPage}
                onChange={(e) => setPerPage(parseInt(e.target.value) || 10)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sort">Sort By</Label>
              <Select value={sort} onValueChange={(v) => setSort(v as "created" | "updated" | "pushed" | "full_name")}>
                <SelectTrigger id="sort">
                  <SelectValue placeholder="Select sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="updated">Updated</SelectItem>
                  <SelectItem value="pushed">Pushed</SelectItem>
                  <SelectItem value="full_name">Full Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="direction">Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as "asc" | "desc")}>
                <SelectTrigger id="direction">
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <AISettingsManager />
      </div>
    </SectionLayout>
  );
}
