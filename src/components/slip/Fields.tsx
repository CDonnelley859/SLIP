import type { InputHTMLAttributes } from "react";

export type FieldSpec = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Big, centred, wide-tracked style for join codes. */
  code?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "style" | "className">;

const labelStyle = {
  position: "absolute" as const, left: 12, transform: "translateY(-50%)",
  background: "var(--green)", padding: "0 4px", color: "var(--cream)",
};

/** Stack of outlined text inputs with labels sitting on the border. */
export const FieldGroup = ({ fields }: { fields: FieldSpec[] }) => (
  <div style={{ border: "3px solid rgba(245,232,223,0.35)", position: "relative" }}>
    {fields.map((f, i) => {
      const { label, value, onChange, code, ...rest } = f;
      const last = i === fields.length - 1;
      const id = `field-${label.toLowerCase().replace(/\W+/g, "-")}`;
      const top = i === 0 ? -1 : `calc(${(i / fields.length) * 100}% + 1px)`;
      return (
        <div key={label}>
          <label htmlFor={id} className="label-sm" style={{ ...labelStyle, top }}>{label}</label>
          <input
            id={id}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="mono"
            style={{
              width: "100%", border: 0,
              borderBottom: last ? undefined : "1.5px solid rgba(245,232,223,0.25)",
              background: "transparent", padding: "16px 14px", textTransform: "uppercase",
              color: "var(--cream)", outline: "none",
              fontSize: code ? 20 : 14,
              ...(code ? { letterSpacing: "0.3em", textAlign: "center" as const } : {}),
            }}
            {...rest}
          />
        </div>
      );
    })}
  </div>
);
