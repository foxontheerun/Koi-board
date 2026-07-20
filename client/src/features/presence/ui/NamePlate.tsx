import { User } from "lucide-react";

interface NamePlateProps {
  name: string;
  onChange: (name: string) => void;
}

const MAX_NAME_LENGTH = 24;

// Small bottom-left widget where the user edits the display name that rides
// along with their cursor. Persisted in localStorage by the caller.
export function NamePlate({ name, onChange }: NamePlateProps) {
  return (
    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-white/90 px-2 py-1.5 shadow-sm ring-1 ring-black/5 backdrop-blur">
      <User className="h-3.5 w-3.5 text-[#666666]" />
      <input
        type="text"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Your display name"
        className="w-28 bg-transparent text-sm text-[#1A1A1A] outline-none"
      />
    </div>
  );
}
