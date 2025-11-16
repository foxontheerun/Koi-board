// src/pages/board/ui/BoardPage.tsx

// import React from "react";
// import { useParams } from "react-router-dom";
// import { Board } from "../entities/board/ui/Board";

// type BoardPageParams = {
//   id: string;
// };

// const BoardPage: React.FC = () => {
//   const { id } = useParams<BoardPageParams>();

//   if (!id) {
//     return <div>Board not found</div>;
//   }

//   return (
//     <div className="board-root">
//       <div className="board-toolbar">
//         <div>Board ID: {id}</div>
//       </div>

//       <Board boardId={id} />
//     </div>
//   );
// };

// export default BoardPage;
