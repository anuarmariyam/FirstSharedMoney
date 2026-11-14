import type { SessionBackend } from "./handler.ts";
import {
  createScenarioRequest,
  comparisonInputs,
  parseScenario,
} from "../_shared/finance-contract.ts";
import {
  financialEngine,
  financialInput,
} from "../../../src/engines/financial.ts";
import { conflictEngine } from "../../../src/engines/conflict.ts";
import { sameJSON } from "../_shared/questionnaire-contract.ts";

export async function financeOperation(
  backend: SessionBackend,
  actorId: string,
  coupleId: string,
  kind: "comparison" | "financial-inputs" | "scenarios",
  body: unknown,
) {
  if (!backend.internalRpc) throw new Error("INTERNAL_ERROR");
  async function rpc(name: string, args: Record<string, unknown>) {
    const result = await backend.internalRpc!(name, {
      ...args,
      p_couple_id: coupleId,
      p_verified_actor_user_id: actorId,
    });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }
  if (kind === "comparison") {
    const input = comparisonInputs(
      await rpc("fsm_internal_comparison_inputs", {}),
    );
    return {
      data: {
        sourceRevisions: { A: input.A.revision, B: input.B.revision },
        results: conflictEngine.compare(input),
      },
      status: 200,
    };
  }
  const request = kind === "scenarios" ? createScenarioRequest(body) : null;
  const source = financialInput(await rpc("fsm_internal_financial_inputs", {}));
  if (!request) return { data: source, status: 200 };
  if (!sameJSON(source.sourceRevisions, request.expectedRevisions))
    throw new Error("INPUTS_CHANGED");
  const input = financialInput({
    ...source,
    sharedExpenses: request.sharedExpenses,
    sharedEmergencyFundCents: request.sharedEmergencyFundCents,
  });
  const output = financialEngine.simulate(
    input,
    request.model,
    request.stressTest,
  );
  const stored = await rpc("fsm_internal_store_scenario", {
    p_request_id: request.requestId,
    p_input: input,
    p_model: request.model,
    p_stress_test: request.stressTest,
    p_output: output,
  });
  return {
    data: parseScenario(stored),
    status:
      stored &&
      typeof stored === "object" &&
      "_created" in stored &&
      stored._created === true
        ? 201
        : 200,
  };
}
