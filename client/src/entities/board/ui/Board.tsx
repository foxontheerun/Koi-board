// import React, { useRef, useState } from "react";
// import type { IBlock } from "../../block/model/types";
// import { ShapeBlock } from "../../block/ui/ShapeBlock";
// import { Button } from "../../../components/ui/button";

// type BoardProps = {
//   boardId: string;
// };

// const initialBlocks: IBlock[] = [
//   {
//     id: "1",
//     type: "rect",
//     x: 120,
//     y: 120,
//     width: 160,
//     height: 80,
//   },
//   {
//     id: "2",
//     type: "text",
//     x: 340,
//     y: 200,
//     width: 220,
//     height: 60,
//     text: "Привет! Я текстовый блок 😊",
//   },
//   {
//     id: "3",
//     type: "text",
//     x: 740,
//     y: 500,
//     width: 320,
//     height: 120,
//     text: "И я текстовый блок!",
//   },
// ];

// export const Board: React.FC<BoardProps> = ({ boardId }) => {
//   const [blocks, setBlocks] = useState<IBlock[]>(initialBlocks);

//   const draggingId = useRef<string | null>(null);
//   const offsetX = useRef(0);
//   const offsetY = useRef(0);

//   function handleMouseDown(
//     e: React.MouseEvent<HTMLDivElement>,
//     blockId: string
//   ) {
//     draggingId.current = blockId;

//     const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
//     offsetX.current = e.clientX - rect.left;
//     offsetY.current = e.clientY - rect.top;

//     (e.currentTarget as HTMLDivElement).style.cursor = "grabbing";
//   }

//   function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
//     if (!draggingId.current) return;

//     const canvasRect = (
//       e.currentTarget as HTMLDivElement
//     ).getBoundingClientRect();
//     const x = e.clientX - canvasRect.left - offsetX.current;
//     const y = e.clientY - canvasRect.top - offsetY.current;

//     setBlocks((prev) =>
//       prev.map((block) =>
//         block.id === draggingId.current ? { ...block, x, y } : block
//       )
//     );
//   }

//   function handleMouseUp() {
//     draggingId.current = null;
//   }

//   return (
//     <div className="flex h-full min-h-[500px] rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
//       {/* Левая панель инструментов */}
//       <aside className="flex w-16 flex-col items-center gap-3 border-r bg-muted/40 py-4">
//         <Button variant="outline" size="icon" className="h-9 w-9 text-xs">
//           ▢
//         </Button>
//         <Button variant="outline" size="icon" className="h-9 w-9 text-xs">
//           T
//         </Button>
//         <Button variant="outline" size="icon" className="h-9 w-9 text-xs">
//           ⤻
//         </Button>
//       </aside>

//       {/* Основная область */}
//       <div className="flex flex-1 flex-col">
//         {/* Верхняя панель */}
//         <header className="flex items-center justify-between border-b px-4 py-2">
//           <div className="flex flex-col">
//             <span className="text-xs text-muted-foreground">Доска</span>
//             <span className="text-sm font-medium truncate">
//               Board #{boardId}
//             </span>
//           </div>
//           <div className="flex items-center gap-2">
//             <Button variant="outline" size="sm">
//               Share
//             </Button>
//             <Button size="sm">Export</Button>
//           </div>
//         </header>

//         {/* Канвас */}
//         <div className="relative flex-1">
//           {/* Фон-сетка */}
//           <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--tw-ring-color,theme(colors.zinc.200))_1px,transparent_0)] [background-size:32px_32px]" />

//           {/* Реальная область для drag’n’drop */}
//           <div
//             className="board-canvas relative h-full w-full cursor-default"
//             onMouseMove={handleMouseMove}
//             onMouseUp={handleMouseUp}
//             onMouseLeave={handleMouseUp}
//           >
//             {blocks.map((block) => (
//               <ShapeBlock
//                 key={block.id}
//                 shape={block}
//                 onMouseDown={handleMouseDown}
//               />
//             ))}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };
