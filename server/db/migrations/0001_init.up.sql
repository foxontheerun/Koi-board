CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

CREATE TABLE boards (
    id         text PRIMARY KEY,
    title      text NOT NULL DEFAULT 'New Board',
    owner_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX boards_owner_id_idx ON boards (owner_id);

CREATE TABLE board_members (
    board_id   text NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role       text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (board_id, user_id)
);

CREATE INDEX board_members_user_id_idx ON board_members (user_id);

CREATE TABLE shapes (
    id           text PRIMARY KEY,
    board_id     text NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    type         text NOT NULL,
    x            double precision NOT NULL,
    y            double precision NOT NULL,
    width        double precision NOT NULL,
    height       double precision NOT NULL,
    rotation     double precision NOT NULL DEFAULT 0,
    z_index      integer NOT NULL DEFAULT 0,
    locked       boolean NOT NULL DEFAULT false,
    text         text,
    fill         text,
    stroke       text,
    stroke_width double precision,
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shapes_board_id_idx ON shapes (board_id);
