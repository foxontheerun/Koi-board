import { authenticate, gql, orderKeyAt, readSession, writeSession } from "./lib.mjs";

const SHAPE_COUNT = Number(process.env.PERF_SHAPES ?? 400);

// A deterministic PRNG so two runs of this script produce the same board, and
// any number in the report can be reproduced from the same seed.
function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = [
  { fill: "#CFE0FF", stroke: "#3B6BDB" },
  { fill: "#D6F5E8", stroke: "#2F9E6D" },
  { fill: "#FFD6E7", stroke: "#D94F8A" },
  { fill: "#E4DAFF", stroke: "#7A5AF8" },
  { fill: "#FFE2CC", stroke: "#E07A2F" },
  { fill: "#FFF1A8", stroke: "#D4A700" },
  { fill: "#CFF5EE", stroke: "#2AA198" },
];

const STICKY = [
  { fill: "#FFF7CC", stroke: "#FACC15" },
  { fill: "#FFEAD9", stroke: "#F97316" },
  { fill: "#E6F0FF", stroke: "#1db3e0" },
  { fill: "#E6F9ED", stroke: "#22C55E" },
];

const WORDS = [
  "sync", "camera", "dirty rect", "overlay", "board", "shape", "layer",
  "pointer", "commit", "resolver", "subscribe", "throttle", "cursor",
];

const CREATE_BOARD = `mutation($title: String) { createBoard(title: $title) { id title } }`;

const UPDATE_SHAPE = `mutation($boardId: ID!, $shape: ShapeInput!, $clientID: ID!) {
  updateShape(boardId: $boardId, shape: $shape, clientID: $clientID) { id }
}`;

const BOARD_SHAPES = `query($id: ID!) { board(id: $id) { id shapes { id } } }`;

// The world region the seeded shapes cover. The camera loads at identity, so
// world (0,0) is the top-left of the viewport: this is about two viewports
// wide and one and a half tall on a desktop window.
const WORLD = { w: 2400, h: 1600 };

function makeShape(index, rand) {
  const roll = rand();
  const x = Math.round(rand() * WORLD.w);
  const y = Math.round(rand() * WORLD.h);
  const orderKey = orderKeyAt(index);
  const id = `perf-${String(index).padStart(4, "0")}`;

  if (roll < 0.4) {
    const c = PALETTE[index % PALETTE.length];
    return {
      id, type: "RECT", x, y,
      width: 80 + Math.round(rand() * 120),
      height: 60 + Math.round(rand() * 90),
      rotation: 0, locked: false, orderKey,
      fill: c.fill, stroke: c.stroke, strokeWidth: 2,
    };
  }

  if (roll < 0.65) {
    const c = PALETTE[(index + 3) % PALETTE.length];
    return {
      id, type: "ELLIPSE", x, y,
      width: 70 + Math.round(rand() * 110),
      height: 70 + Math.round(rand() * 90),
      rotation: 0, locked: false, orderKey,
      fill: c.fill, stroke: c.stroke, strokeWidth: 2,
    };
  }

  if (roll < 0.9) {
    const c = STICKY[index % STICKY.length];
    const words = 2 + Math.floor(rand() * 5);
    const text = Array.from({ length: words }, () => WORDS[Math.floor(rand() * WORDS.length)]).join(" ");
    return {
      id, type: "STICKER", x, y, width: 160, height: 160,
      rotation: 0, locked: false, orderKey,
      text, fontSize: 16, fontWeight: 600, textAlign: "CENTER", textColor: "#111111",
      fill: c.fill, stroke: c.stroke, strokeWidth: 2,
    };
  }

  const words = 3 + Math.floor(rand() * 6);
  const text = Array.from({ length: words }, () => WORDS[Math.floor(rand() * WORDS.length)]).join(" ");
  return {
    id, type: "TEXT", x, y, width: 220, height: 60,
    rotation: 0, locked: false, orderKey,
    text, fontSize: 20, fontWeight: 400, textAlign: "LEFT", textColor: "#1A1A1A",
  };
}

async function main() {
  const session = await authenticate();
  const token = session.accessToken;

  const existing = readSession();
  let boardId = existing?.boardId;

  const force = process.env.PERF_FORCE === "1";

  if (boardId && !force) {
    try {
      const data = await gql(BOARD_SHAPES, { id: boardId }, token);
      if (data.board && data.board.shapes.length === SHAPE_COUNT) {
        console.log(`board ${boardId} already holds ${SHAPE_COUNT} shapes`);
        writeSession({ ...existing, refreshToken: session.refreshToken, shapeCount: SHAPE_COUNT });
        return;
      }
    } catch {
      boardId = undefined;
    }
  }

  if (!boardId) {
    const data = await gql(CREATE_BOARD, { title: `perf ${SHAPE_COUNT}` }, token);
    boardId = data.createBoard.id;
    console.log(`created board ${boardId}`);
  }

  const rand = mulberry32(20260805);
  const clientID = "perf-seed";

  for (let i = 0; i < SHAPE_COUNT; i++) {
    const shape = makeShape(i, rand);
    await gql(UPDATE_SHAPE, { boardId, shape, clientID }, token);
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${SHAPE_COUNT}`);
  }

  const verify = await gql(BOARD_SHAPES, { id: boardId }, token);
  console.log(`board ${boardId} now holds ${verify.board.shapes.length} shapes`);

  writeSession({
    boardId,
    shapeCount: verify.board.shapes.length,
    refreshToken: session.refreshToken,
    email: session.user.email,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
