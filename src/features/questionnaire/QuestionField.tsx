import type { Question } from "../../types/domain";
import type { DraftValue } from "./validation";
import { FieldError, MoneyInput } from "../../components/ui";
import { Icon } from "../../components/Icon";

export function QuestionField({
  question,
  value,
  onChange,
  error,
  preview = true,
}: {
  question: Question;
  value: DraftValue | undefined;
  onChange: (value: DraftValue) => void;
  error: string;
  preview?: boolean;
}) {
  if (question.kind === "money")
    return (
      <MoneyInput
        id="question-money"
        label="Amount in dollars"
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
        error={error}
        hint="USD · You can enter 0. Please use fictional amounts."
      />
    );
  if (question.kind === "text")
    return (
      <div className="field">
        <label htmlFor="question-note">
          Your private note <span className="muted">(optional)</span>
        </label>
        <textarea
          id="question-note"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          maxLength={500}
          placeholder="Something you’d like to think through…"
          aria-describedby={error ? "question-error" : "note-count"}
          aria-invalid={!!error}
        />
        <p id="note-count" className="field-hint">
          {typeof value === "string" ? value.length : 0} / 500 characters ·
          {preview ? "local preview only" : "private to you"}
        </p>
        {error && <FieldError id="question-error">{error}</FieldError>}
      </div>
    );
  if (question.kind === "slider")
    return (
      <div className="field slider-field">
        <label htmlFor="question-slider">
          Your comfortable share of income
        </label>
        <output htmlFor="question-slider">
          {typeof value === "string"
            ? `${Number(value) / 100}%`
            : "Choose a percentage"}
        </output>
        <input
          id="question-slider"
          type="range"
          min={question.minBasisPoints}
          max={question.maxBasisPoints}
          step={question.stepBasisPoints}
          value={typeof value === "string" ? value : "5000"}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "question-error" : "slider-help"}
        />
        <div className="flex justify-between muted text-sm">
          <span>0%</span>
          <span>100%</span>
        </div>
        <p id="slider-help" className="field-hint">
          Move the slider to choose your comfort level, or{" "}
          <button
            className="text-link"
            type="button"
            onClick={() => onChange("5000")}
          >
            use 50%
          </button>
          .
        </p>
        {error && <FieldError id="question-error">{error}</FieldError>}
      </div>
    );
  return (
    <fieldset
      className="choice-field"
      aria-describedby={error ? "question-error" : undefined}
    >
      <legend className="sr-only">{question.title}</legend>
      {question.options.map((option) => {
        const selected =
          question.kind === "multiple_choice"
            ? Array.isArray(value) && value.includes(option.value)
            : value === option.value;
        return (
          <label
            key={option.value}
            className={`choice-option ${selected ? "selected" : ""}`}
          >
            <input
              type={question.kind === "multiple_choice" ? "checkbox" : "radio"}
              name={question.code}
              value={option.value}
              checked={selected}
              onChange={() => {
                if (question.kind === "multiple_choice") {
                  const values = Array.isArray(value) ? value : [];
                  onChange(
                    selected
                      ? values.filter((item) => item !== option.value)
                      : [...values, option.value],
                  );
                } else onChange(option.value);
              }}
            />
            <span
              className={`choice-indicator ${question.kind === "multiple_choice" ? "square" : ""}`}
            >
              {selected &&
                (question.kind === "multiple_choice" ? (
                  <Icon name="check" size={13} />
                ) : (
                  <i />
                ))}
            </span>
            <span>{option.label}</span>
          </label>
        );
      })}
      {error && <FieldError id="question-error">{error}</FieldError>}
    </fieldset>
  );
}
