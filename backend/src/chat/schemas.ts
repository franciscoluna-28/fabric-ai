import { Type, type Static } from "@sinclair/typebox";

const ChatCitation = Type.Object({
  commitSha: Type.String(),
  commitMessage: Type.String(),
  author: Type.Union([Type.String(), Type.Null()]),
  committedAt: Type.String(),
  filesChanged: Type.Array(Type.String()),
  commitUrl: Type.Union([Type.String(), Type.Null()]),
});

const ChatSessionResponse = Type.Object({
  id: Type.String(),
  projectId: Type.String(),
  title: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

const ChatMessageResponse = Type.Object({
  id: Type.String(),
  role: Type.Union([Type.Literal("user"), Type.Literal("assistant")]),
  content: Type.String(),
  branch: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  citations: Type.Array(ChatCitation),
  createdAt: Type.String({ format: "date-time" }),
});

export const CreateSessionBody = Type.Object({
  projectId: Type.String(),
});

export const CreateSessionResponse = ChatSessionResponse;

export const ChatSessionsQuery = Type.Object({
  projectId: Type.Optional(Type.String()),
});

export const ChatSessionsListResponse = Type.Object({
  sessions: Type.Array(ChatSessionResponse),
});

export const ChatSessionIdParams = Type.Object({
  id: Type.String({ format: "uuid" }),
});

export const ChatMessagesResponse = Type.Object({
  messages: Type.Array(ChatMessageResponse),
});

export const SendMessageBody = Type.Object({
  content: Type.String({ minLength: 1 }),
  branch: Type.Optional(Type.String({ minLength: 1 })),
});

export const DeleteSessionResponse = Type.Object({
  deleted: Type.Boolean(),
});

export type ChatCitationDTO = Static<typeof ChatCitation>;
export type ChatMessageDTO = Static<typeof ChatMessageResponse>;
