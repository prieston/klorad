/**
 * Public surface for the iNET ATMS adapter — the things apps import
 * to register and use the connector.
 */
import type { ConnectorFactory } from "../../types.js";
import {
  createInetAtmsConnector,
  INET_ATMS_CONNECTOR_ID,
} from "./adapter.js";
import { InetAtmsConfigSchema, type InetAtmsConfig } from "./types.js";
import type { InetDevice, InetStatus } from "./types.js";

export {
  INET_ATMS_CONNECTOR_ID,
  createInetAtmsConnector,
} from "./adapter.js";
export type { InetAtmsConnector } from "./adapter.js";
export {
  INET_SUBSYSTEMS,
  InetAtmsConfigSchema,
  type InetAtmsConfig,
  type InetDevice,
  type InetMedia,
  type InetStatus,
  type InetSubsystem,
} from "./types.js";
export {
  parseMulti,
  type DmsLine,
  type DmsPage,
  type ParsedDmsMessage,
} from "./multi-parser.js";

/** Registry factory the app calls once at boot:
 *  `registry.register(inetAtmsFactory)`. */
export const inetAtmsFactory: ConnectorFactory<
  InetAtmsConfig,
  InetDevice,
  InetStatus
> = {
  id: INET_ATMS_CONNECTOR_ID,
  label: "Parsons iNET ATMS",
  description:
    "Traffic management devices (CCTV, DMS) served via the iNET REST API.",
  authType: "basic",
  configSchema: InetAtmsConfigSchema,
  create: createInetAtmsConnector,
};
