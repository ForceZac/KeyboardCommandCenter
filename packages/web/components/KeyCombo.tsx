import KeyCap from './KeyCap';

interface Props {
  /** Full key combo string, e.g. "Ctrl+Shift+P" or "Ctrl+K → Ctrl+C" */
  combo: string;
}

/**
 * KeyCombo — splits a key combo string into individual key tokens and renders
 * each as a <KeyCap>. Handles both "+" separators (simultaneous) and
 * "→" separators (sequential chord steps).
 */
export default function KeyCombo({ combo }: Props) {
  // Split into chord steps first, then each step into keys
  const steps = combo.split('→').map((step) => step.trim());

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {steps.map((step, stepIdx) => {
        const keys = step.split('+').map((k) => k.trim()).filter(Boolean);
        return (
          <span key={stepIdx} className="inline-flex items-center gap-0.5">
            {stepIdx > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500 mx-0.5">→</span>
            )}
            {keys.map((key, keyIdx) => (
              <span key={keyIdx} className="inline-flex items-center gap-0.5">
                {keyIdx > 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">+</span>
                )}
                <KeyCap label={key} />
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
}
