begin;

-- Exact immutable v1 catalog exported from src/features/questionnaire/catalog.ts.
insert into public.questions(catalog_version,code,category,kind,title,help_text,is_required,position,comparison_rule,control)
select catalog_version,code,category,kind,title,help_text,is_required,position,comparison_rule,control
from jsonb_to_recordset($catalog$[
  {
    "catalog_version": 1,
    "code": "monthly_income",
    "category": "income_obligations",
    "kind": "money",
    "title": "What is your monthly take-home income?",
    "help_text": "After taxes. Include reliable recurring income only. Use fictional information in this preview.",
    "is_required": true,
    "position": 1,
    "comparison_rule": "none",
    "control": {
      "kind": "money",
      "minCents": 0,
      "maxCents": 1000000000000
    }
  },
  {
    "catalog_version": 1,
    "code": "personal_obligations",
    "category": "income_obligations",
    "kind": "money",
    "title": "What do you pay monthly for personal obligations outside this shared budget?",
    "help_text": "Include minimum debt payments or support. Exclude expenses you plan to share.",
    "is_required": true,
    "position": 2,
    "comparison_rule": "none",
    "control": {
      "kind": "money",
      "minCents": 0,
      "maxCents": 1000000000000
    }
  },
  {
    "catalog_version": 1,
    "code": "shared_categories",
    "category": "shared_expenses",
    "kind": "multiple_choice",
    "title": "Which categories would you like to plan together?",
    "help_text": "Choose at least one. You can still discuss the details together later.",
    "is_required": true,
    "position": 3,
    "comparison_rule": "set_equality",
    "control": {
      "kind": "multiple_choice",
      "options": [
        {
          "value": "rent",
          "label": "Rent & home"
        },
        {
          "value": "utilities",
          "label": "Utilities"
        },
        {
          "value": "groceries",
          "label": "Groceries"
        },
        {
          "value": "other",
          "label": "Other shared costs"
        },
        {
          "value": "shared_savings",
          "label": "Shared savings"
        }
      ]
    }
  },
  {
    "catalog_version": 1,
    "code": "shared_budget_estimate",
    "category": "shared_expenses",
    "kind": "money",
    "title": "What monthly total do you expect for shared living expenses, before shared savings?",
    "help_text": "Your estimate for the whole household, not just your contribution.",
    "is_required": true,
    "position": 4,
    "comparison_rule": "exact",
    "control": {
      "kind": "money",
      "minCents": 0,
      "maxCents": 1000000000000
    }
  },
  {
    "catalog_version": 1,
    "code": "split_preference",
    "category": "expense_split",
    "kind": "single_choice",
    "title": "How would you prefer to divide shared costs?",
    "help_text": "There is no right answer. Start with what feels comfortable to you.",
    "is_required": true,
    "position": 5,
    "comparison_rule": "exact",
    "control": {
      "kind": "single_choice",
      "options": [
        {
          "value": "equal",
          "label": "Equal split — the same dollar amount"
        },
        {
          "value": "proportional",
          "label": "Proportional — based on our incomes"
        },
        {
          "value": "custom",
          "label": "Custom — a percentage we choose together"
        }
      ]
    }
  },
  {
    "catalog_version": 1,
    "code": "monthly_shared_savings",
    "category": "savings",
    "kind": "money",
    "title": "How much would you like the two of you to save together each month?",
    "help_text": "A household target, separate from your personal savings.",
    "is_required": true,
    "position": 6,
    "comparison_rule": "exact",
    "control": {
      "kind": "money",
      "minCents": 0,
      "maxCents": 1000000000000
    }
  },
  {
    "catalog_version": 1,
    "code": "personal_spending",
    "category": "personal_spending",
    "kind": "single_choice",
    "title": "How should personal purchases be handled?",
    "help_text": "Think about the independence you each want to keep.",
    "is_required": true,
    "position": 7,
    "comparison_rule": "exact",
    "control": {
      "kind": "single_choice",
      "options": [
        {
          "value": "independent",
          "label": "Keep personal purchases independent"
        },
        {
          "value": "discuss_above_threshold",
          "label": "Discuss purchases above an agreed amount"
        }
      ]
    }
  },
  {
    "catalog_version": 1,
    "code": "debt_expectation",
    "category": "debt",
    "kind": "single_choice",
    "title": "How should existing personal debt affect your shared plan?",
    "help_text": "No account details or debt identifiers are needed.",
    "is_required": true,
    "position": 8,
    "comparison_rule": "exact",
    "control": {
      "kind": "single_choice",
      "options": [
        {
          "value": "individual_responsibility",
          "label": "Each person remains responsible for their debt"
        },
        {
          "value": "discuss_support",
          "label": "Discuss any support before including it in our plan"
        }
      ]
    }
  },
  {
    "catalog_version": 1,
    "code": "emergency_preference",
    "category": "emergency",
    "kind": "single_choice",
    "title": "What should happen first when an unexpected shared cost appears?",
    "help_text": "A starting point for your conversation, not an automatic financial decision.",
    "is_required": true,
    "position": 9,
    "comparison_rule": "exact",
    "control": {
      "kind": "single_choice",
      "options": [
        {
          "value": "shared_reserve_first",
          "label": "Use our shared emergency reserve first"
        },
        {
          "value": "pause_savings_first",
          "label": "Pause shared savings first"
        },
        {
          "value": "discuss_each_event",
          "label": "Discuss each situation before deciding"
        }
      ]
    }
  },
  {
    "catalog_version": 1,
    "code": "emergency_fund_target",
    "category": "emergency",
    "kind": "money",
    "title": "What shared emergency-fund balance would you like to aim for?",
    "help_text": "Your target balance, not the amount available right now.",
    "is_required": true,
    "position": 10,
    "comparison_rule": "exact",
    "control": {
      "kind": "money",
      "minCents": 0,
      "maxCents": 1000000000000
    }
  },
  {
    "catalog_version": 1,
    "code": "large_purchase_threshold",
    "category": "large_purchase",
    "kind": "money",
    "title": "Above what purchase amount should you discuss a shared decision first?",
    "help_text": "The amount for one purchase, not a monthly spending limit.",
    "is_required": true,
    "position": 11,
    "comparison_rule": "exact",
    "control": {
      "kind": "money",
      "minCents": 0,
      "maxCents": 1000000000000
    }
  },
  {
    "catalog_version": 1,
    "code": "transparency_preference",
    "category": "transparency",
    "kind": "single_choice",
    "title": "What level of financial detail would you feel comfortable discussing?",
    "help_text": "This preference does not grant permission to share your data.",
    "is_required": true,
    "position": 12,
    "comparison_rule": "exact",
    "control": {
      "kind": "single_choice",
      "options": [
        {
          "value": "shared_totals_only",
          "label": "Shared totals only"
        },
        {
          "value": "voluntary_details",
          "label": "More detail, when we each choose to share it"
        },
        {
          "value": "prefer_private",
          "label": "Keep most financial details private"
        }
      ]
    }
  },
  {
    "catalog_version": 1,
    "code": "review_frequency",
    "category": "reviews",
    "kind": "single_choice",
    "title": "How often would you like to review the shared budget?",
    "help_text": "Choose a rhythm that could work for both of you.",
    "is_required": true,
    "position": 13,
    "comparison_rule": "exact",
    "control": {
      "kind": "single_choice",
      "options": [
        {
          "value": "monthly",
          "label": "Every month"
        },
        {
          "value": "quarterly",
          "label": "Every three months"
        },
        {
          "value": "as_needed",
          "label": "When something changes"
        }
      ]
    }
  },
  {
    "catalog_version": 1,
    "code": "comfortable_income_share",
    "category": "expense_split",
    "kind": "slider",
    "title": "What percentage of your own take-home income could comfortably go toward shared costs?",
    "help_text": "This is your comfort level, not the percentage split between partners.",
    "is_required": true,
    "position": 14,
    "comparison_rule": "none",
    "control": {
      "kind": "slider",
      "minBasisPoints": 0,
      "maxBasisPoints": 10000,
      "stepBasisPoints": 100
    }
  },
  {
    "catalog_version": 1,
    "code": "discussion_note",
    "category": "transparency",
    "kind": "text",
    "title": "Is there anything else you would like to prepare for your money conversation?",
    "help_text": "Optional. In the live product this note will remain author-only. Do not enter sensitive information here.",
    "is_required": false,
    "position": 15,
    "comparison_rule": "none",
    "control": {
      "kind": "text",
      "maxLength": 500
    }
  }
]$catalog$::jsonb) as q(catalog_version smallint,code text,category text,kind text,title text,help_text text,is_required boolean,position smallint,comparison_rule text,control jsonb);

do $$
begin
  if (select count(*) from public.questions where catalog_version=1) <> 15
    or (select count(*) from public.questions where catalog_version=1 and is_required) <> 14 then
    raise exception 'Invalid v1 questionnaire catalog';
  end if;
end;
$$;

commit;
