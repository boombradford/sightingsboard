-- Total sightings loaded
SELECT COUNT(*) AS total_sightings FROM sightings;

-- Most active states
SELECT state, COUNT(*) AS sightings
FROM sightings
WHERE state IS NOT NULL AND state <> ''
GROUP BY state
ORDER BY sightings DESC
LIMIT 25;

-- Most common reported shapes
SELECT LOWER(shape) AS shape, COUNT(*) AS sightings
FROM sightings
WHERE shape IS NOT NULL AND shape <> ''
GROUP BY LOWER(shape)
ORDER BY sightings DESC
LIMIT 25;

-- Sightings by year
SELECT SUBSTR(date_time, 1, 4) AS year, COUNT(*) AS sightings
FROM sightings
WHERE date_time IS NOT NULL AND date_time <> ''
GROUP BY SUBSTR(date_time, 1, 4)
ORDER BY year;

-- Keyword search (requires FTS5 table)
SELECT s.sighting_id, s.date_time, s.city, s.state, s.summary
FROM sightings s
JOIN sightings_fts ON sightings_fts.rowid = s.sighting_id
WHERE sightings_fts MATCH 'triangle'
ORDER BY s.date_time DESC
LIMIT 50;
