import { apiRequest } from "../../lib/api-client";
import type { SystemStatus } from "./types";

export async function getSystemStatus(): Promise<SystemStatus> {
  return apiRequest<SystemStatus>("/api/v1/system/status");
}
