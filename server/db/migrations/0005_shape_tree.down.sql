ALTER TABLE shapes ADD COLUMN z_index integer NOT NULL DEFAULT 0;

UPDATE shapes s
SET z_index = ordered.position
FROM (
    SELECT id, row_number() OVER (PARTITION BY board_id ORDER BY order_key, id) AS position
    FROM shapes
) AS ordered
WHERE s.id = ordered.id;

DROP INDEX shapes_parent_id_idx;
ALTER TABLE shapes DROP COLUMN order_key;
ALTER TABLE shapes DROP COLUMN parent_id;
