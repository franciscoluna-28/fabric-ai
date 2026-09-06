import { Type } from "@sinclair/typebox";

export const ProjectsResponse = Type.Object({
  projects: Type.Array(
    Type.Object({
      id: Type.String(),
      gitProvider: Type.String(),
      providerProjectId: Type.String(),
      providerOwner: Type.String(),
      repositoryName: Type.String(),
      defaultBranch: Type.String(),
      indexedBranches: Type.Array(Type.String()),
      createdAt: Type.String({ format: "date-time" }),
      updatedAt: Type.String({ format: "date-time" }),
    }),
  ),
});

export const ProjectIdParams = Type.Object({
  id: Type.String(),
});

export const PrepareBranchBody = Type.Object({
  branch: Type.String({ minLength: 1 }),
});

export const PrepareBranchResponse = Type.Object({
  branch: Type.String(),
  commitsFound: Type.Integer(),
  chunksWritten: Type.Integer(),
});

export const CreateProjectBody = Type.Object({
  gitProvider: Type.Optional(
    Type.Union([Type.Literal("github"), Type.Literal("gitlab")], { default: "github" }),
  ),
  providerProjectId: Type.String(),
  providerOwner: Type.String(),
  repositoryName: Type.String(),
  defaultBranch: Type.Optional(Type.String({ default: "main" })),
});

export const CreateProjectResponse = Type.Object({
  id: Type.String(),
  gitProvider: Type.String(),
  providerProjectId: Type.String(),
  providerOwner: Type.String(),
  repositoryName: Type.String(),
  defaultBranch: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});
