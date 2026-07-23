import { useQuery, useMutation } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import { LogOut, Plus } from "lucide-react";
import {
  MY_BOARDS_QUERY,
  CREATE_BOARD_MUTATION,
} from "../../../entities/Board/api/board.gql";
import { useAuth } from "../../../features/auth/model/AuthContext";

interface BoardSummary {
  id: string;
  title: string;
}

export function BoardsListPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const { data, loading, error } = useQuery<{ myBoards: BoardSummary[] }>(
    MY_BOARDS_QUERY,
    { fetchPolicy: "cache-and-network" },
  );
  const [createBoard, { loading: creating }] = useMutation<{
    createBoard: BoardSummary;
  }>(CREATE_BOARD_MUTATION);

  const handleCreate = async () => {
    const res = await createBoard({ variables: { title: "Untitled board" } });
    const id = res.data?.createBoard.id;
    if (id) navigate(`/${id}`);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const boards = data?.myBoards ?? [];

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <header className="flex h-14 items-center justify-between border-b border-[#E5E5E5] bg-white px-6 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#16B8D4]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <ellipse cx="8" cy="9" rx="5.5" ry="3.4" fill="#FF6A3D" />
              <path d="M12.5 9 L17 6 L17 12 Z" fill="#FF6A3D" />
              <circle cx="6" cy="8.2" r="0.9" fill="#fff" />
            </svg>
          </div>
          <span className="font-logo text-lg text-[#14202B]">Koi</span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="max-w-48 truncate text-sm text-[#666666]">
              {user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            title="Log out"
            className="rounded-lg p-2 text-[#666666] transition-colors hover:bg-[#F5F5F5]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[#14202B]">Your boards</h1>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 rounded-lg bg-[#16B8D4] px-4 py-2 font-medium text-white transition-colors hover:bg-[#0E7C99] disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {creating ? "Creating…" : "New board"}
          </button>
        </div>

        {loading && boards.length === 0 && (
          <p className="text-sm text-[#666666]">Loading…</p>
        )}
        {error && (
          <p className="text-sm text-red-600">Couldn't load your boards.</p>
        )}
        {!loading && boards.length === 0 && !error && (
          <p className="text-sm text-[#666666]">
            No boards yet — create your first one.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {boards.map((board) => (
            <button
              key={board.id}
              onClick={() => navigate(`/${board.id}`)}
              className="group flex h-32 flex-col justify-end rounded-xl border border-[#E5E5E5] bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="truncate font-medium text-[#14202B]">
                {board.title}
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
