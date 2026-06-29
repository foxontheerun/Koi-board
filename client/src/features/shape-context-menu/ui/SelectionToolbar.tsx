import { useEffect, useRef, useState } from "react";
import {
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
  Lock,
  LockOpen,
  Trash2,
  MoreHorizontal,
} from "lucide-react";

export interface SelectionToolbarProps {
  x: number;
  y: number;
  isLocked: boolean;
  onBringToFront: () => void;
  onMoveForward: () => void;
  onMoveBackward: () => void;
  onSendToBack: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
}

const iconButton =
  "p-2 rounded-md hover:bg-[#F5F5F5] text-[#1A1A1A] transition-colors";

export function SelectionToolbar({
  x,
  y,
  isLocked,
  onBringToFront,
  onMoveForward,
  onMoveBackward,
  onSendToBack,
  onToggleLock,
  onDelete,
}: SelectionToolbarProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overflowOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [overflowOpen]);

  const layerItems = [
    { icon: <ChevronsUp className="w-4 h-4" />, label: "Bring to front", onClick: onBringToFront },
    { icon: <ChevronUp className="w-4 h-4" />, label: "Move forward", onClick: onMoveForward },
    { icon: <ChevronDown className="w-4 h-4" />, label: "Move backward", onClick: onMoveBackward },
    { icon: <ChevronsDown className="w-4 h-4" />, label: "Send to back", onClick: onSendToBack },
  ];

  return (
    <div
      ref={rootRef}
      className="fixed -translate-x-1/2 -translate-y-full z-50"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-0.5 bg-white rounded-lg shadow-xl border border-[#E5E5E5] px-1 py-1">
        {isLocked ? (
          <button className={iconButton} title="Unlock" onClick={onToggleLock}>
            <LockOpen className="w-4 h-4" />
          </button>
        ) : (
          <>
            <button className={iconButton} title="Lock" onClick={onToggleLock}>
              <Lock className="w-4 h-4" />
            </button>
            <button
              className={`${iconButton} text-[#DC2626]`}
              title="Delete"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-[#E5E5E5] mx-0.5" />
            <button
              className={iconButton}
              title="Layer order"
              onClick={() => setOverflowOpen((open) => !open)}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {overflowOpen && !isLocked && (
        <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-[#E5E5E5] py-1 min-w-44">
          {layerItems.map((item) => (
            <button
              key={item.label}
              className="w-full px-3 py-2 flex items-center gap-3 hover:bg-[#F5F5F5] transition-colors text-left text-[#1A1A1A]"
              onClick={() => {
                item.onClick();
                setOverflowOpen(false);
              }}
            >
              <span className="text-[#666666]">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
