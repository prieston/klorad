import { loader } from "fumadocs-core/source";
import { docs } from "../.source/index";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
