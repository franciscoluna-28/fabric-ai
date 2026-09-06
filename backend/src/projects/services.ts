import { ingestCommits } from "@/repositories/ingest";
import * as projectsStore from "@/projects/stores/projects-store";

export async function prepareProjectBranch(projectId: string, branch: string) {
  const project = await projectsStore.getProjectById({ id: projectId });
  if (!project) throw new Error("Project not found");

  const result = await ingestCommits({
    owner: project.providerOwner,
    repo: project.repositoryName,
    branch,
    projectId,
  });

  return { branch, ...result };
}
