import React from "react";
import type { Shape } from "../model/types";

type BlockProps = {
  shape: Shape;
  isSelected?: boolean;
};

export const ShapeBlock: React.FC<BlockProps> = () => {
  return (
    <div
      className={
        "w-full h-full rounded-lg border bg-white shadow-sm box-border transition "
      }
    ></div>
  );
};
