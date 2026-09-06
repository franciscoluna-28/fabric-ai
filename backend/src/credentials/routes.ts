import { FastifyRequest, FastifyReply } from "fastify";
import type { Static } from "@sinclair/typebox";
import {
  listCredentials,
  createCredential,
  deleteCredential,
  verifyCredential,
} from "@/credentials/services";
import { AddCredentialBody, VerifyCredentialBody, CredentialIdParams } from "@/credentials/schemas";

export async function listKeys(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const provider = (req.query as { provider?: string }).provider;

  try {
    const keys = await listCredentials(provider);
    return reply.send({ keys });
  } catch (error) {
    console.error("Error listing credentials:", error);
    return reply.status(500).send({ error: "Failed to list credentials" });
  }
}

export async function addKey(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { provider, key } = req.body as Static<typeof AddCredentialBody>;

  try {
    const id = await createCredential({ provider, key });
    return reply.code(201).send({ id });
  } catch (error: any) {
    if (error?.message?.startsWith("Unsupported provider")) {
      return reply.status(400).send({ error: error.message });
    }
    console.error("Error adding credential:", error);
    return reply.status(500).send({ error: "Failed to add credential" });
  }
}

export async function deleteKey(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = req.params as Static<typeof CredentialIdParams>;

  try {
    const deleted = await deleteCredential(id);
    if (!deleted) {
      return reply.status(404).send({ error: "Credential not found" });
    }

    return reply.code(204).send();
  } catch (error) {
    console.error("Error deleting credential:", error);
    return reply.status(500).send({ error: "Failed to delete credential" });
  }
}

export async function verifyKey(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { provider, key } = req.body as Static<typeof VerifyCredentialBody>;

  try {
    const valid = await verifyCredential(provider, key);
    return reply.send({ valid });
  } catch (error) {
    console.error("Error verifying credential:", error);
    return reply.status(500).send({ error: "Failed to verify credential" });
  }
}
