import { useQuery, useMutation } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Plus } from "lucide-react";
import {
  MY_BOARDS_QUERY,
  CREATE_BOARD_MUTATION,
} from "../../../entities/Board/api/board.gql";
import { useAuth } from "../../../features/auth/model/AuthContext";

interface BoardSummary {
  id: string;
  title: string;
}

const cardAccents = [
  { from: "#E3F6FB", to: "#C9EDF5", fg: "#16B8D4" },
  { from: "#FFE3D6", to: "#FFD0BD", fg: "#FF6A3D" },
  { from: "#D7F7EA", to: "#BFF0DD", fg: "#34D399" },
  { from: "#FCE7F3", to: "#FBD5E8", fg: "#EC4899" },
  { from: "#EDE9FE", to: "#DED6FD", fg: "#8B5CF6" },
  { from: "#FEF3C7", to: "#FDE8A0", fg: "#F59E0B" },
];

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
  const showEmpty = !loading && boards.length === 0 && !error;

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
        {user && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#4ECDC4] shadow-sm">
              <span className="text-sm uppercase text-white">
                {user.email.charAt(0)}
              </span>
            </div>
            <span className="max-w-48 truncate text-sm text-[#666666]">
              {user.email}
            </span>
            <button
              onClick={handleLogout}
              title="Log out"
              className="rounded-lg p-2 text-[#666666] transition-colors hover:bg-[#F5F5F5]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="font-logo text-2xl text-[#14202B]">Your boards</h1>
            <p className="mt-1 text-sm text-[#666666]">
              {boards.length > 0
                ? `${boards.length} board${boards.length === 1 ? "" : "s"}`
                : "Your collaborative whiteboards live here"}
            </p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 rounded-lg bg-[#0E7C99] px-4 py-2 font-medium text-white shadow-sm transition-colors hover:bg-[#0A5E73] disabled:opacity-60"
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

        {showEmpty && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D6D6D6] bg-white/60 px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E3F6FB]">
              <LayoutDashboard
                className="h-6 w-6 text-[#16B8D4]"
                strokeWidth={1.5}
              />
            </div>
            <h2 className="font-logo text-lg text-[#14202B]">No boards yet</h2>
            <p className="mb-6 mt-1 max-w-xs text-sm text-[#666666]">
              Create your first board and start collaborating in real time.
            </p>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-[#0E7C99] px-4 py-2 font-medium text-white shadow-sm transition-colors hover:bg-[#0A5E73] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {creating ? "Creating…" : "New board"}
            </button>
          </div>
        )}

        {boards.length > 0 && (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
            {boards.map((board, i) => {
              const accent = cardAccents[i % cardAccents.length];
              return (
                <button
                  key={board.id}
                  onClick={() => navigate(`/${board.id}`)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[#E5E5E5] bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className="flex h-24 items-center justify-center"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                    }}
                  >
                    <LayoutDashboard
                      className="h-7 w-7 transition-transform group-hover:scale-110"
                      style={{ color: accent.fg }}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div className="px-4 py-3">
                    <span className="block truncate font-medium text-[#14202B]">
                      {board.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
