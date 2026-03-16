# UFO Sightings Database

Local SQLite database pipeline for NUFORC sightings using code/data format from:
https://github.com/timothyrenner/nuforc_sightings_data

## What this workspace includes

- `scripts/build_ufo_db.py`: Ingests NUFORC processed CSV (or raw JSONL) into SQLite.
- `scripts/query_ufo_db.py`: Quick CLI query helper for common filters.
- `sql/starter_queries.sql`: Starter analysis queries.

## Data source note

The upstream repo uses DVC and does not include the large data files directly.
You need one of:

- `nuforc_sightings_data/data/processed/nuforc_reports.csv` (preferred)
- `nuforc_sightings_data/data/raw/nuforc_reports.json` (JSON lines fallback)
- a public mirror CSV (for example, `planetsig/ufo-reports`)

The upstream README also notes NUFORC terms around scraping/distribution; use data in line with those terms.

## Quick start with a public geocoded mirror

Download one widely used mirror (geocoded, includes latitude/longitude):

```bash
curl -L \
  "https://raw.githubusercontent.com/planetsig/ufo-reports/master/csv-data/ufo-complete-geocoded-time-standardized.csv" \
  -o "data/ufo-complete-geocoded-time-standardized.csv"
```

Build the DB from that file:

```bash
python3 scripts/build_ufo_db.py \
  --input "data/ufo-complete-geocoded-time-standardized.csv" \
  --format planetsig \
  --rebuild
```

## Build the database

From this directory:

```bash
python3 scripts/build_ufo_db.py --rebuild
```

If your file is in another location:

```bash
python3 scripts/build_ufo_db.py \
  --input "/absolute/path/to/nuforc_reports.csv" \
  --format csv \
  --db ufo_sightings.db \
  --rebuild
```

Load from raw JSONL:

```bash
python3 scripts/build_ufo_db.py \
  --input "nuforc_sightings_data/data/raw/nuforc_reports.json" \
  --format jsonl \
  --rebuild
```

The loader also auto-detects many CSV variants (header-based CSV, plus the no-header planetsig format).

## Query examples

```bash
python3 scripts/query_ufo_db.py --state AZ --shape circle --limit 10
python3 scripts/query_ufo_db.py --keyword triangle --from-date 2010-01-01 --limit 25
```

Rank reports by detail score:

```bash
python3 scripts/query_detailed_reports.py \
  --db ufo_sightings.db \
  --order detail \
  --min-words 120 \
  --limit 25
```

Pull fresh long-form reports and upsert into SQLite:

```bash
python3 scripts/pull_intriguing_reports.py \
  --max-date-pages 5 \
  --max-reports 60 \
  --min-words 120 \
  --db ufo_sightings.db \
  --format csv \
  --out exports/intriguing_live_top20.csv
```

`pull_intriguing_reports.py` follows the same page traversal approach as the
`timothyrenner/nuforc_sightings_data` spider, then scores and exports the most detailed narratives.

Refresh recent sightings for specific states and upsert them into SQLite:

```bash
python3 scripts/refresh_states.py \
  --states MO IL IA TN \
  --from-date 2015-01-01 \
  --target-per-state 20 \
  --db ufo_sightings.db \
  --verbose
```

Ad-hoc SQL:

```bash
sqlite3 ufo_sightings.db < sql/starter_queries.sql
```

## Web frontend

Build the React + Tailwind + Framer Motion frontend bundle:

```bash
cd frontend
npm install
npm run build
cd ..
```

The build writes static assets into `web/`, which are served by the local API server below.

For hot-reload UI development, run Vite in a second terminal (it proxies `/api` to `http://127.0.0.1:8000` by default):

```bash
cd frontend
npm run dev
```

If your API server uses another origin/port, set `VITE_API_ORIGIN` before `npm run dev`.

Start the local API + UI server:

```bash
python3 scripts/serve_frontend.py \
  --db ufo_sightings.db \
  --enrichment-csv exports/research_results_batch_0001_1000.csv \
  --port 8000
```

If port `8000` is busy, use the auto-port dev launcher:

```bash
python3 scripts/dev_server.py
```

Enable AI case briefs (optional, recommended):

```bash
export OPENAI_API_KEY="your_key_here"
export OPENAI_MODEL="gpt-4.1-mini"
python3 scripts/dev_server.py
```

Open:

- `http://127.0.0.1:8000`

API endpoints:

- `GET /api/sightings`
- `GET /api/options`
- `GET /api/stats`
- `GET /api/health`
- `POST /api/enrich` (on-demand AI brief for a `sighting_id`)
