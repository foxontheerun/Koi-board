import { useEffect, useRef } from "react";
import {
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
  Lock,
  LockOpen,
  Trash2,
} from "lucide-react";

export interface ContextMenuProps {
  x: number;
  y: number;
  isLocked: boolean;
  onClose: () => void;
  onBringToFront: () => void;
  onMoveForward: () => void;
  onMoveBackward: () => void;
  onSendToBack: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
}

export function ContextMenu({
  x,
  y,
  isLocked,
  onClose,
  onBringToFront,
  onMoveForward,
  onMoveBackward,
  onSendToBack,
  onToggleLock,
  onDelete,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const items = isLocked
    ? [{ icon: <LockOpen className="w-4 h-4" />, label: "Unlock", onClick: onToggleLock }]
    : [
        { icon: <ChevronsUp className="w-4 h-4" />, label: "Bring to front", onClick: onBringToFront },
        { icon: <ChevronUp className="w-4 h-4" />, label: "Move forward", onClick: onMoveForward },
        { icon: <ChevronDown className="w-4 h-4" />, label: "Move backward", onClick: onMoveBackward },
        { icon: <ChevronsDown className="w-4 h-4" />, label: "Send to back", onClick: onSendToBack },
        { divider: true } as const,
        { icon: <Lock className="w-4 h-4" />, label: "Lock", onClick: onToggleLock },
        { icon: <Trash2 className="w-4 h-4" />, label: "Delete", onClick: onDelete, danger: true },
      ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white rounded-lg shadow-xl border border-[#E5E5E5] py-1 min-w-44 z-50"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) =>
        "divider" in item ? (
          <div key={index} className="h-px bg-[#E5E5E5] my-1" />
        ) : (
          <button
            key={item.label}
            className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-[#F5F5F5] transition-colors text-left ${
              item.danger ? "text-[#DC2626]" : "text-[#1A1A1A]"
            }`}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            <span className={item.danger ? "text-[#DC2626]" : "text-[#666666]"}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ),
      )}
    </div>
  );
}
