ALTER TABLE shapes ADD COLUMN parent_id text REFERENCES shapes (id) ON DELETE CASCADE;
ALTER TABLE shapes ADD COLUMN order_key text;

UPDATE shapes s
SET order_key = to_char(ordered.position, 'FM000000') || 'V'
FROM (
    SELECT id, row_number() OVER (PARTITION BY board_id ORDER BY z_index, id) AS position
    FROM shapes
) AS ordered
WHERE s.id = ordered.id;

ALTER TABLE shapes ALTER COLUMN order_key SET NOT NULL;
ALTER TABLE shapes DROP COLUMN z_index;

CREATE INDEX shapes_parent_id_idx ON shapes (parent_id);
