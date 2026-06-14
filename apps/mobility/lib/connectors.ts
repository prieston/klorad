/**
 * Registry boot — wire every adapter Mobility supports.
 *
 * Each app owns its own registry (rather than a global) so adapter
 * sets stay scoped to the vertical that uses them. The factory list
 * here is the "what's available" surface — the settings UI iterates
 * `mobilityConnectors.list()` to render the connector picker.
 */
import { ConnectorRegistry } from "@klorad/connectors";
import { inetAtmsFactory } from "@klorad/connectors/inet-atms";

export const mobilityConnectors = new ConnectorRegistry();

mobilityConnectors.register(inetAtmsFactory);
