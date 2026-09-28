import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const DIAL_CODES = [
  { code: "27", label: "ZA +27" },
  { code: "263", label: "ZW +263" },
  { code: "267", label: "BW +267" },
  { code: "264", label: "NA +264" },
  { code: "258", label: "MZ +258" },
  { code: "260", label: "ZM +260" },
  { code: "254", label: "KE +254" },
  { code: "234", label: "NG +234" },
  { code: "233", label: "GH +233" },
  { code: "971", label: "AE +971" },
  { code: "44", label: "UK +44" },
  { code: "1", label: "US +1" },
  { code: "91", label: "IN +91" },
  { code: "86", label: "CN +86" },
];

/** Joins the chosen country code and the typed number into digits-only international form,
 * dropping a leading national 0 (082… → 2782…). */
export function toInternational(dial: string, local: string) {
  const digits = local.replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `${dial}${digits}` : "";
}

export function PhoneInput({
  id,
  dial,
  onDialChange,
  value,
  onChange,
  compact,
  disabled,
}: {
  id: string;
  dial: string;
  onDialChange: (v: string) => void;
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <select
        aria-label="Country code"
        value={dial}
        disabled={disabled}
        onChange={(e) => onDialChange(e.target.value)}
        className={cn(
          "rounded-md border border-input bg-background px-2 text-sm text-foreground",
          compact ? "h-8" : "h-9",
        )}
      >
        {DIAL_CODES.map((d) => (
          <option key={d.code} value={d.code}>
            {d.label}
          </option>
        ))}
      </select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="82 123 4567"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        required
        className={cn("flex-1", compact && "h-8 text-sm")}
      />
    </div>
  );
}
