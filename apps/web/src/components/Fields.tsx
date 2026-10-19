import { useEffect, useRef, useState } from "react";
export function NumberField({
  label,
  value,
  onChange,
  unit,
  step = 0.1,
  testId,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit?: string;
  step?: number;
  testId?: string;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(String(Math.round(value * 1000) / 1000));
  const textModified = useRef(false);
  useEffect(() => {
    setText(String(Math.round(value * 1000) / 1000));
    textModified.current = false;
  }, [value]);
  function commit() {
    if (!textModified.current) return;
    textModified.current = false;
    const n = Number(text.replace(",", "."));
    if (
      !text.trim() ||
      !Number.isFinite(n) ||
      (min !== undefined && n < min) ||
      (max !== undefined && n > max)
    )
      setText(String(Math.round(value * 1000) / 1000));
    else if (n !== value) {
      onChange(n);
      // A rejected geometric edit keeps the original prop; accepted changes
      // refresh this text through the value effect above.
      setText(String(Math.round(value * 1000) / 1000));
    }
  }
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          data-testid={testId}
          type="number"
          min={min}
          max={max}
          step={step}
          value={text}
          onChange={(e) => {
            textModified.current = true;
            setText(e.target.value);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        {unit && <small>{unit}</small>}
      </div>
    </label>
  );
}
