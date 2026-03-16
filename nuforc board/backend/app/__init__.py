"""Sky Ledger Atlas backend package — re-exports for backward compatibility."""

# models
from .models import (
    SIGNAL_KEYS,
    build_constraints_where,
    build_filter_parts,
    clean_text,
    detect_explainable_case,
    extract_case_signals,
    has_media_marker,
    is_http_url,
    merge_filters,
    normalize_date,
    normalize_fts_keyword,
    normalize_state,
    normalize_to_date_upper_bound,
    parse_bool,
    parse_constraints,
    parse_filter_payload,
    parse_filter_query,
    parse_json_maybe,
    parse_observer_count,
    parse_stats_map,
    to_float,
    to_int,
    utc_now_iso,
)

# scoring
from .scoring import (
    TOP_3_SHAPES,
    compute_story_score,
    quality_label_for_case,
    top_signal_percentages,
)

# db
from .db import (
    ensure_vnext_schema,
    fetch_bookmark_set,
    fetch_evidence_count_map,
    fetch_evidence_sighting_ids,
    fetch_score_map,
    load_ai_cache,
    load_enrichment_index,
    save_ai_cache,
)

# ai
from .ai import (
    backfill_scores,
    batch_generate_briefs,
    generate_ai_case_brief,
    generate_ai_case_brief_vnext,
    generate_claude_brief,
)

# queries/cases
from .queries.cases import (
    _serialize_case_row,
    build_case_fingerprint,
    build_fingerprint_from_payload,
    cache_entry_matches_case,
    fetch_case_file,
    get_case_payload,
)

# queries/sightings
from .queries.sightings import (
    compare_cohorts,
    fetch_options,
    fetch_pivot,
    fetch_sightings,
    fetch_stats,
)

# queries/evidence
from .queries.evidence import (
    create_case_evidence,
    list_case_evidence,
    update_case_evidence,
)

# queries/briefs
from .queries.briefs import (
    compare_case_briefs,
    create_brief_issue,
    create_case_brief_version,
    list_case_brief_versions,
)

# queries/bookmarks
from .queries.bookmarks import (
    add_collection_item,
    create_bookmark,
    create_collection,
    delete_bookmark,
    delete_collection_item,
    list_bookmarks,
    list_collection_items,
    list_collections,
    update_bookmark,
)

# queries/sampling
from .queries.sampling import (
    create_sample_set,
    generate_sample,
    get_sample_set,
    list_sample_sets,
)

# queries/discover
from .queries.discover import (
    dismiss_discovery,
    fetch_discover,
    undismiss_discovery,
)

# queries/clusters
from .queries.clusters import fetch_clusters

# server
from .server import UFORequestHandler, main, parse_args

__all__ = [
    # models
    "SIGNAL_KEYS",
    "build_constraints_where",
    "build_filter_parts",
    "clean_text",
    "detect_explainable_case",
    "extract_case_signals",
    "has_media_marker",
    "is_http_url",
    "merge_filters",
    "normalize_date",
    "normalize_fts_keyword",
    "normalize_state",
    "normalize_to_date_upper_bound",
    "parse_bool",
    "parse_constraints",
    "parse_filter_payload",
    "parse_filter_query",
    "parse_json_maybe",
    "parse_observer_count",
    "parse_stats_map",
    "to_float",
    "to_int",
    "utc_now_iso",
    # scoring
    "TOP_3_SHAPES",
    "compute_story_score",
    "quality_label_for_case",
    "top_signal_percentages",
    # db
    "ensure_vnext_schema",
    "fetch_bookmark_set",
    "fetch_evidence_count_map",
    "fetch_evidence_sighting_ids",
    "fetch_score_map",
    "load_ai_cache",
    "load_enrichment_index",
    "save_ai_cache",
    # ai
    "backfill_scores",
    "batch_generate_briefs",
    "generate_ai_case_brief",
    "generate_ai_case_brief_vnext",
    "generate_claude_brief",
    # cases
    "_serialize_case_row",
    "build_case_fingerprint",
    "build_fingerprint_from_payload",
    "cache_entry_matches_case",
    "fetch_case_file",
    "get_case_payload",
    # sightings
    "compare_cohorts",
    "fetch_options",
    "fetch_pivot",
    "fetch_sightings",
    "fetch_stats",
    # evidence
    "create_case_evidence",
    "list_case_evidence",
    "update_case_evidence",
    # briefs
    "compare_case_briefs",
    "create_brief_issue",
    "create_case_brief_version",
    "list_case_brief_versions",
    # bookmarks
    "add_collection_item",
    "create_bookmark",
    "create_collection",
    "delete_bookmark",
    "delete_collection_item",
    "list_bookmarks",
    "list_collection_items",
    "list_collections",
    "update_bookmark",
    # sampling
    "create_sample_set",
    "generate_sample",
    "get_sample_set",
    "list_sample_sets",
    # discover
    "dismiss_discovery",
    "fetch_discover",
    "undismiss_discovery",
    # clusters
    "fetch_clusters",
    # server
    "UFORequestHandler",
    "main",
    "parse_args",
]
