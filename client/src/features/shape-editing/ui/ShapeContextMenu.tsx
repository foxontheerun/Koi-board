import { useEffect, useRef } from "react";
import { Copy, Trash2, Lock, Unlock, MoveUp, MoveDown } from "lucide-react";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onToggleLock: () => void;
  isLocked: boolean;
  onDeleteClick: () => void;
  onCopyClick: () => void;
}

export function ContextMenu({
  x,
  y,
  onClose,
  onBringToFront,
  onSendToBack,
  onToggleLock,
  onDeleteClick,
  onCopyClick,
  isLocked,
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

  const menuItems = [
    { icon: <Copy className="w-4 h-4" />, label: "Copy", onClick: onCopyClick },
    {
      icon: <Trash2 className="w-4 h-4" />,
      label: "Delete",
      onClick: onDeleteClick,
    },
    { divider: true },
    {
      icon: <MoveUp className="w-4 h-4" />,
      label: "На слой выше",
      onClick: onBringToFront,
    },
    {
      icon: <MoveDown className="w-4 h-4" />,
      label: "На слой ниже",
      onClick: onSendToBack,
    },
    { divider: true },
    {
      icon: isLocked ? (
        <Unlock className="w-4 h-4" />
      ) : (
        <Lock className="w-4 h-4" />
      ),
      label: isLocked ? "Unlock" : "Lock",
      onClick: () => onToggleLock(),
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white rounded-lg shadow-xl border border-[#E5E5E5] py-1 min-w-44 z-50"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, index) =>
        item.divider ? (
          <div key={index} className="h-px bg-[#E5E5E5] my-1" />
        ) : (
          <button
            key={index}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#F5F5F5] transition-colors text-left"
            onClick={item.onClick || onClose}
          >
            <div className="flex items-center gap-3 text-[#1A1A1A]">
              <span className="text-[#666666]">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          </button>
        )
      )}
    </div>
  );
}
