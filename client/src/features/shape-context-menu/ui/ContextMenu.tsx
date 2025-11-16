import { useEffect, useRef } from "react";
import { Copy, Trash2, Lock, Unlock } from "lucide-react";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ x, y, onClose }: ContextMenuProps) {
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
    { icon: <Copy className="w-4 h-4" />, label: "Copy", shortcut: "⌘C" },
    { icon: <Trash2 className="w-4 h-4" />, label: "Delete", shortcut: "⌫" },
    { divider: true },
    { icon: <Lock className="w-4 h-4" />, label: "Lock", shortcut: "⌘L" },
    { icon: <Unlock className="w-4 h-4" />, label: "Unlock", shortcut: "⌘⇧L" },
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
            onClick={onClose}
          >
            <div className="flex items-center gap-3 text-[#1A1A1A]">
              <span className="text-[#666666]">{item.icon}</span>
              <span>{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="text-[#999999]">{item.shortcut}</span>
            )}
          </button>
        )
      )}
    </div>
  );
}
