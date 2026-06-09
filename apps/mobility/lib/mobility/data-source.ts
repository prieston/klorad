/**
 * Helpers for MobilityDataSource — encrypt / decrypt credentials,
 * build configured connectors, and validate config via the adapter's
 * Zod schema. The route handlers + sync runner share this layer so
 * "how a source becomes a working connector" lives in one place.
 */
import { decryptSecret, encryptSecret } from "@klorad/secrets";
import type { KloradConnector } from "@klorad/connectors";
import { mobilityConnectors } from "@/lib/connectors";

/**
 * Persisted shape of `MobilityDataSource.config`. Adapter-specific
 * fields live in the same JSON object; the adapter's Zod schema
 * validates them at decode time, so this type stays narrow.
 */
export type DataSourceConfigJson = Record<string, unknown>;

/**
 * Persisted shape of the encrypted credentials blob. Adapter-defined;
 * for iNET it's `{ username, password }`. Whole object goes through
 * `@klorad/secrets` at write time and back through it at read time;
 * the DB row only ever holds ciphertext.
 */
export type DataSourceCredentialsJson = Record<string, unknown>;

export interface BuildConnectorInput {
  connectorId: string;
  config: DataSourceConfigJson;
  /** Already-decrypted creds. Caller is responsible for decrypting
   *  `credentialsEncrypted` before handing the object in. */
  credentials: DataSourceCredentialsJson | null;
}

/**
 * Resolve a registered factory, parse the merged config + creds
 * through its schema, and return a configured connector instance.
 * Throws on unknown connector id or invalid config.
 */
export async function buildConnector(
  input: BuildConnectorInput,
): Promise<KloradConnector<unknown, unknown, unknown>> {
  const factory = mobilityConnectors.get<unknown, unknown, unknown>(
    input.connectorId,
  );
  if (!factory) {
    throw new Error(`Unknown connector "${input.connectorId}"`);
  }
  const merged = {
    ...input.config,
    ...(input.credentials ?? {}),
  };
  const parsed = factory.configSchema.parse(merged);
  const connector = factory.create();
  await connector.configure(parsed);
  return connector;
}

/** Encrypt a credentials object into the ciphertext we persist on
 *  the row. `null` skips encryption (fixture mode, no creds). */
export function encryptCredentials(
  creds: DataSourceCredentialsJson | null,
): string | null {
  if (!creds) return null;
  return encryptSecret(JSON.stringify(creds));
}

/** Reverse — decrypt a ciphertext from the row back into the JSON
 *  object the connector expects. `null` propagates. */
export function decryptCredentials(
  ciphertext: string | null,
): DataSourceCredentialsJson | null {
  if (!ciphertext) return null;
  return JSON.parse(decryptSecret(ciphertext)) as DataSourceCredentialsJson;
}
