import Fastify from "fastify";
import type { FastifyError } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "@/config/env";

import { health } from "@/health/routes";
import { checkVerification } from "@/verification/routes";
import { listModels } from "@/models/routes";
import { listRepositories, listBranches, listCommits, countCommits } from "@/gitRepositories/routes";
import { listProjects, prepareBranch } from "@/projects/routes";
import { createProject as createProjectRoute } from "@/projects/routes";
import { PrepareBranchBody, PrepareBranchResponse, ProjectIdParams, CreateProjectBody, CreateProjectResponse } from "@/projects/schemas";
import { listKeys as listCredentials, addKey as addCredential, deleteKey as deleteCredential, verifyKey as verifyCredential } from "@/credentials/routes";
import { getSettingsRoute, updateSettingsRoute } from "@/settings/routes";
import {
  createSession as createChatSession,
  listSessions as listChatSessions,
  getMessages as getChatMessages,
  removeSession as deleteChatSession,
  streamMessage as streamChatMessage,
} from "@/chat/routes";

import { ErrorResponse } from "@/shared/typebox";
import {
  CreateSessionBody,
  CreateSessionResponse,
  ChatSessionsQuery,
  ChatSessionsListResponse,
  ChatSessionIdParams,
  ChatMessagesResponse,
  SendMessageBody,
  DeleteSessionResponse,
} from "@/chat/schemas";
import { HealthResponse } from "@/health/schemas";
import { VerificationOkResponse } from "@/verification/schemas";
import { ModelsQuery, ModelsResponse } from "@/models/schemas";
import {
  RepoOwnerParams,
  CommitsQuery,
  CommitsResponse,
  CommitsCountQuery,
  CommitsCountResponse,
  RepositoriesQuery,
  RepositoriesResponse,
  BranchesResponse,
} from "@/gitRepositories/schemas";
import { ProjectsResponse } from "@/projects/schemas";
import {
  AddCredentialBody,
  CredentialListResponse,
  CredentialCreatedResponse,
  CredentialIdParams,
  VerifyCredentialBody,
  VerifyCredentialResponse,
} from "@/credentials/schemas";
import { AISettingsBody, AISettingsGetResponse } from "@/settings/schemas";

export async function buildApp() {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });

  app.setErrorHandler<FastifyError>((error, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: "Invalid request parameters" });
    }
    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: error.message || "Internal Server Error",
    });
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Scrapecat API",
        version: "v1",
        description: "Backend API for Scrapecat reports",
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  app.get("/api/v1/health", {
    schema: {
      description: "Health check endpoint",
      tags: ["health"],
      response: { 200: HealthResponse },
    },
  }, health);

  app.get("/api/v1/verification/status", {
    schema: {
      description: "Verify GitHub token connection status",
      tags: ["verification"],
      response: { 200: VerificationOkResponse },
    },
  }, checkVerification);

  app.get("/api/v1/models", {
    schema: {
      description: "List available AI models",
      tags: ["models"],
      querystring: ModelsQuery,
      response: { 200: ModelsResponse, 400: ErrorResponse },
    },
  }, listModels);

  app.get("/api/v1/repositories", {
    schema: {
      description: "List GitHub repositories for the authenticated user",
      tags: ["repositories"],
      querystring: RepositoriesQuery,
      response: { 200: RepositoriesResponse, 400: ErrorResponse, 500: ErrorResponse },
    },
  }, listRepositories);

  app.get("/api/v1/repositories/:owner/:repo/branches", {
    schema: {
      description: "List branches for a repository",
      tags: ["repositories"],
      params: RepoOwnerParams,
      response: { 200: BranchesResponse, 400: ErrorResponse },
    },
}, listBranches);

  app.get("/api/v1/repositories/:owner/:repo/commits", {
    schema: {
      description: "List commits for a repository within an optional date range",
      tags: ["repositories"],
      params: RepoOwnerParams,
      querystring: CommitsQuery,
      response: { 200: CommitsResponse, 400: ErrorResponse },
    },
  }, listCommits);

  app.get("/api/v1/repositories/:owner/:repo/commits/count", {
    schema: {
      description: "Count commits for a repository within an optional date range",
      tags: ["repositories"],
      params: RepoOwnerParams,
      querystring: CommitsCountQuery,
      response: { 200: CommitsCountResponse, 400: ErrorResponse },
    },
  }, countCommits);

  app.get("/api/v1/projects", {
    schema: {
      description: "List synced GitHub projects",
      tags: ["projects"],
      response: { 200: ProjectsResponse, 500: ErrorResponse },
    },
  }, listProjects);

  app.post("/api/v1/projects", {
    schema: {
      description: "Create or connect a new project",
      tags: ["projects"],
      body: CreateProjectBody,
      response: { 201: CreateProjectResponse, 500: ErrorResponse },
    },
  }, createProjectRoute);

  app.post("/api/v1/projects/:id/branches/prepare", {
    schema: {
      description: "Ingest a project branch before chat retrieval",
      tags: ["projects"],
      params: ProjectIdParams,
      body: PrepareBranchBody,
      response: { 200: PrepareBranchResponse, 404: ErrorResponse, 500: ErrorResponse },
    },
  }, prepareBranch);

  app.get("/api/v1/credentials", {
    schema: {
      description: "List stored credentials (key hints only, no full keys returned)",
      tags: ["credentials"],
      response: { 200: CredentialListResponse, 400: ErrorResponse },
    },
  }, listCredentials);

  app.post("/api/v1/credentials", {
    schema: {
      description: "Store a new credential (API key encrypted at rest)",
      tags: ["credentials"],
      body: AddCredentialBody,
      response: { 201: CredentialCreatedResponse, 400: ErrorResponse },
    },
  }, addCredential);

  app.delete("/api/v1/credentials/:id", {
    schema: {
      description: "Delete a stored credential",
      tags: ["credentials"],
      params: CredentialIdParams,
      response: { 204: {}, 404: ErrorResponse },
    },
  }, deleteCredential);

  app.post("/api/v1/credentials/verify", {
    schema: {
      description: "Verify an API key against its provider",
      tags: ["credentials"],
      body: VerifyCredentialBody,
      response: { 200: VerifyCredentialResponse, 400: ErrorResponse },
    },
  }, verifyCredential);

  app.get("/api/v1/settings/ai", {
    schema: {
      description: "Get global AI model settings",
      tags: ["settings"],
      response: { 200: AISettingsGetResponse, 500: ErrorResponse },
    },
  }, getSettingsRoute);

  app.put("/api/v1/settings/ai", {
    schema: {
      description: "Update global AI model settings",
      tags: ["settings"],
      body: AISettingsBody,
      response: { 200: AISettingsGetResponse, 400: ErrorResponse, 500: ErrorResponse },
    },
  }, updateSettingsRoute);

  app.post("/api/v1/chat/sessions", {
    schema: {
      description: "Create a new chat session for a project",
      tags: ["chat"],
      body: CreateSessionBody,
      response: { 201: CreateSessionResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
    },
  }, createChatSession);

  app.get("/api/v1/chat/sessions", {
    schema: {
      description: "List chat sessions, optionally filtered by project",
      tags: ["chat"],
      querystring: ChatSessionsQuery,
      response: { 200: ChatSessionsListResponse, 400: ErrorResponse, 500: ErrorResponse },
    },
  }, listChatSessions);

  app.get("/api/v1/chat/sessions/:id/messages", {
    schema: {
      description: "List messages for a chat session",
      tags: ["chat"],
      params: ChatSessionIdParams,
      response: { 200: ChatMessagesResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
    },
  }, getChatMessages);

  app.delete("/api/v1/chat/sessions/:id", {
    schema: {
      description: "Delete a chat session",
      tags: ["chat"],
      params: ChatSessionIdParams,
      response: { 200: DeleteSessionResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
    },
  }, deleteChatSession);

  app.post("/api/v1/chat/sessions/:id/messages", {
    schema: {
      description: "Send a message and stream the assistant reply (SSE)",
      tags: ["chat"],
      params: ChatSessionIdParams,
      body: SendMessageBody,
      response: { 400: ErrorResponse, 404: ErrorResponse },
    },
  }, streamChatMessage);

  return app;
}
