import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function Field({ label, name, children, hint, required }: { label: string; name: string; children?: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-velocity"> *</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TextField(props: { label: string; name: string; defaultValue?: string | number | null; type?: string; required?: boolean; hint?: string; placeholder?: string; step?: string; min?: string }) {
  return (
    <Field label={props.label} name={props.name} hint={props.hint} required={props.required}>
      <Input
        id={props.name}
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue ?? ""}
        required={props.required}
        placeholder={props.placeholder}
        step={props.step}
        min={props.min}
      />
    </Field>
  );
}

export function TextAreaField(props: { label: string; name: string; defaultValue?: string | null; rows?: number; required?: boolean; hint?: string; placeholder?: string }) {
  return (
    <Field label={props.label} name={props.name} hint={props.hint} required={props.required}>
      <Textarea id={props.name} name={props.name} defaultValue={props.defaultValue ?? ""} rows={props.rows ?? 3} required={props.required} placeholder={props.placeholder} />
    </Field>
  );
}

export function SelectField(props: { label: string; name: string; options: Array<{ value: string; label: string }>; defaultValue?: string | null; required?: boolean; hint?: string }) {
  return (
    <Field label={props.label} name={props.name} hint={props.hint} required={props.required}>
      <select
        id={props.name}
        name={props.name}
        defaultValue={props.defaultValue ?? ""}
        required={props.required}
        className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {!props.required ? <option value="">-</option> : null}
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
