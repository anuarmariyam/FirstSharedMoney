import type { FsmApiContract } from "../types/api";

/** An integration seam, not local authentication or a simulated server. */
export interface FsmClient {
  readonly connection: "connected" | "not_connected";
  request<Operation extends keyof FsmApiContract>(
    operation: Operation,
    body: FsmApiContract[Operation]["request"],
    resource: { coupleId?: string; versionId?: string; scenarioId?: string },
  ): Promise<FsmApiContract[Operation]["response"]>;
}
export const fsmClient: FsmClient = {
  connection: "not_connected",
  async request() {
    throw new Error("Live sessions are not connected yet.");
  },
};
