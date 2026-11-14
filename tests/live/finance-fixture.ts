import type { SupabaseClient } from "@supabase/supabase-js";
import { questions } from "../../src/features/questionnaire/catalog.ts";
import { parseQuestionnaire } from "../../supabase/functions/_shared/questionnaire-contract.ts";
import { questionnaireValues } from "./questionnaire-fixtures.ts";
import type {
  AnswerValueByQuestion,
  PrivacyConsent,
} from "../../src/types/domain.ts";

/** Real owner-scoped RPCs with fictional raw inputs; never seeded financial results. */
export async function submitFinanceFixture(
  client: SupabaseClient,
  coupleId: string,
  overrides: Partial<AnswerValueByQuestion>,
  consent: PrivacyConsent,
) {
  async function rpc(name: string, args: Record<string, unknown>) {
    const result = await client.rpc(name, { p_couple_id: coupleId, ...args });
    if (result.error)
      throw new Error(
        "Owner questionnaire fixture failed; response suppressed.",
      );
    return parseQuestionnaire(result.data);
  }
  let q = await rpc("fsm_get_questionnaire", {});
  if (q.status === "submitted")
    q = await rpc("fsm_reopen_questionnaire", {
      p_expected_revision: q.revision,
    });
  for (const question of questions)
    q = await rpc("fsm_save_answer", {
      p_question_code: question.code,
      p_value: overrides[question.code] ?? questionnaireValues[question.code],
      p_expected_revision: q.revision,
    });
  return rpc("fsm_submit_questionnaire", {
    p_expected_revision: q.revision,
    p_comparison: consent.comparison,
    p_budget: consent.budget,
  });
}
