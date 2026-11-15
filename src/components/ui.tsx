import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { Link } from "react-router";
import { Icon, type IconName } from "./Icon";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`button button-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function ButtonLink({
  to,
  children,
  variant = "primary",
  className = "",
}: {
  to: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <Link to={to} className={`button button-${variant} ${className}`}>
      {children}
    </Link>
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="FirstSharedMoney home">
      <span className="brand-mark">
        <span />
        <span />
      </span>
      {!compact && (
        <span>
          FirstShared<span className="brand-light">Money</span>
          <span className="brand-dot">.</span>
        </span>
      )}
    </Link>
  );
}
export function Badge({
  children,
  tone = "purple",
}: {
  children: ReactNode;
  tone?: "purple" | "green" | "neutral" | "amber";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Notice({
  children,
  title,
  tone = "info",
}: {
  children: ReactNode;
  title?: string;
  tone?: "info" | "warning";
}) {
  return (
    <div className={`notice notice-${tone}`}>
      <Icon name={tone === "warning" ? "alert" : "info"} />
      <div>
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children}
    </div>
  );
}
export function EmptyState({
  icon = "lock",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={25} />
      </span>
      <h2>{title}</h2>
      <div className="muted">{children}</div>
      {action}
    </div>
  );
}
export function LoadingState() {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      <span>Getting things ready…</span>
    </div>
  );
}
export function FieldError({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <p id={id} className="field-error" role="alert">
      {children}
    </p>
  );
}
export function Input({
  id,
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        aria-invalid={!!error}
        aria-describedby={
          error ? `${id}-error` : hint ? `${id}-hint` : undefined
        }
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}
export function MoneyInput({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  readOnly = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`money-input ${error ? "is-invalid" : ""}`}>
        <span aria-hidden="true">$</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          readOnly={readOnly}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
        />
        <span className="currency">USD</span>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}
export function ProgressIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="question-progress">
      <div>
        <span>
          Question {current} of {total}
        </span>
        <span>{Math.round((current / total) * 100)}%</span>
      </div>
      <progress
        max={total}
        value={current}
        aria-label={`Question ${current} of ${total}`}
      />
    </div>
  );
}
export function DemoNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="demo-notice">
      <Badge>Demo</Badge>
      <p>
        {children ??
          "Sample Data. Demo drafts stay in this tab and reset on refresh. Nothing is saved to the server."}
      </p>
    </div>
  );
}
