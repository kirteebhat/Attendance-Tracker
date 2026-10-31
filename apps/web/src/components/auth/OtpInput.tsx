import React, { useRef, useEffect } from "react";

export interface OtpInputProps {
  value: string;
  onChange: (otp: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  disabled = false,
  hasError = false,
  autoFocus = true,
}) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  useEffect(() => {
    if (autoFocus && !disabled) {
      const firstEmptyIndex = digits.findIndex((d) => !d);
      const targetIndex = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
      inputRefs.current[targetIndex]?.focus();
    }
  }, []);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    if (!val) {
      // Cleared
      const newDigits = [...digits];
      newDigits[index] = "";
      onChange(newDigits.join(""));
      return;
    }

    // Single digit or paste into input
    if (val.length === 1) {
      const newDigits = [...digits];
      newDigits[index] = val;
      const combined = newDigits.join("");
      onChange(combined);

      // Advance to next box
      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    } else {
      // Multi-digit paste or autofill
      handlePastedCode(val);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // Current box is empty, jump to previous box and clear it
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        onChange(newDigits.join(""));
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = "";
        onChange(newDigits.join(""));
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text/plain").replace(/\D/g, "");
    if (pasted) {
      handlePastedCode(pasted);
    }
  };

  const handlePastedCode = (code: string) => {
    const cleanDigits = code.slice(0, 6).split("");
    const newDigits = Array.from({ length: 6 }, (_, i) => cleanDigits[i] || "");
    const combined = newDigits.join("");
    onChange(combined);

    // Focus last filled box or 6th box
    const focusTarget = Math.min(cleanDigits.length, 5);
    inputRefs.current[focusTarget]?.focus();
  };

  return (
    <div
      role="group"
      aria-label="6-digit authentication code"
      className="flex items-center justify-between gap-1.5 sm:gap-3 w-full"
    >
      {Array.from({ length: 6 }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputRefs.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[idx] || ""}
          disabled={disabled}
          onChange={(e) => handleChange(idx, e)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${idx + 1} of 6`}
          className={`w-9 h-12 sm:w-12 sm:h-14 flex-1 max-w-[48px] min-w-0 text-center text-lg sm:text-2xl font-mono font-bold rounded-xl border transition-all duration-150 outline-none select-none
            ${
              disabled
                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                : hasError
                ? "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-600 focus:ring-2 focus:ring-rose-500"
                : digits[idx]
                ? "bg-blue-50/50 dark:bg-slate-800 text-blue-900 dark:text-white border-blue-500 dark:border-blue-400 focus:ring-2 focus:ring-blue-500 shadow-xs"
                : "bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            }`}
        />
      ))}
    </div>
  );
};

