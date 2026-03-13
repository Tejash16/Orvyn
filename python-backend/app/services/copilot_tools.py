"""
Copilot Tools — Tool implementations and audit/insights data preparation.

Handles:
  - Gemini function calling tool implementations (Python executes directly)
  - Data preparation for Gemini-dependent tools (Express calls Gemini)
  - Audit data preparation and result application
  - DataRoom insights preparation and storage
  - Suggested questions retrieval

Python NEVER calls Gemini directly. For tools that need LLM reasoning
(compare, summarize, extract, audit), Python prepares the data and Electron
sends it to Express which holds the API key.
"""

import hashlib
import os
import uuid
import json
import logging
import datetime
from typing import Optional, List

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger("docrack.copilot_tools")


# ---------------------------------------------------------------------------
# Data-only tools — Python executes directly
# ---------------------------------------------------------------------------

def tool_search_documents(
    query_vector: list,
    query_text: str,
    scope_type: str,
    scope_ids: Optional[list],
    user_id: str,
    db_session: Session,
    chroma_path: str,
) -> dict:
    """
    Tool: search_documents
    Called by Electron when Gemini requests a document search.
    Runs hybrid_search and returns formatted results with source labels.
    """
    import os
    from app.services.embedding_service import hybrid_search

    # Resolve scope filters
    dataroom_id = None
    file_ids = None
    folder_id = None

    if scope_type == "file" and scope_ids:
        file_ids = scope_ids
    elif scope_type == "folder" and scope_ids:
        folder_id = scope_ids[0]
    elif scope_type == "dataroom" and scope_ids:
        dataroom_id = scope_ids[0]
    elif scope_type == "multi_dataroom" and scope_ids:
        if len(scope_ids) == 1:
            dataroom_id = scope_ids[0]
        else:
            # Search each DataRoom separately, then merge and re-rank by score
            all_results = []
            for dr_id in scope_ids:
                dr_results = hybrid_search(
                    query_vector=query_vector,
                    query_text=query_text,
                    user_id=user_id,
                    chroma_path=chroma_path,
                    db_session=db_session,
                    dataroom_id=dr_id,
                )
                all_results.extend(dr_results)
            all_results.sort(key=lambda x: x.get("score", 0), reverse=True)
            max_chunks = int(os.getenv("RAG_MAX_CHUNKS_PER_QUERY", "8"))
            results = all_results[:max_chunks]
            # Skip the single hybrid_search call below and format directly
            return _format_tool_search_results(results)
    # global: no filter

    results = hybrid_search(
        query_vector=query_vector,
        query_text=query_text,
        user_id=user_id,
        chroma_path=chroma_path,
        db_session=db_session,
        dataroom_id=dataroom_id,
        file_ids=file_ids,
        folder_id=folder_id,
    )

    return _format_tool_search_results(results)


def _format_tool_search_results(results: list) -> dict:
    """Format hybrid search results for Gemini tool consumption."""
    formatted_parts = []
    for chunk in results:
        file_name = chunk.get("file_name", "Unknown")
        page_number = chunk.get("page_number")
        chunk_text = chunk.get("text", "")

        label = f"Source: {file_name}"
        if page_number:
            label += f", Page {page_number}"

        formatted_parts.append(f"[{label}]\n{chunk_text}")

    return {
        "results": "\n\n---\n\n".join(formatted_parts),
        "result_count": len(results),
        "sources": [
            {
                "file_id": c.get("file_id"),
                "file_name": c.get("file_name"),
                "relevance": c.get("score", 0),
            }
            for c in results
        ],
    }


def tool_get_file_content(file_id: str, db_session: Session) -> dict:
    """
    Tool: get_file_content
    Fetch a file's extracted text, truncated to 10000 chars.
    """
    row = db_session.execute(
        text("""
            SELECT original_name, file_extension, extracted_text, ai_summary
            FROM files WHERE id = :fid
        """),
        {"fid": file_id},
    ).fetchone()

    if not row:
        return {"error": f"File not found: {file_id}"}

    original_name = row[0]
    file_extension = row[1]
    extracted_text = row[2] or ""
    ai_summary = row[3]

    # Truncate to 10000 chars
    if len(extracted_text) > 10000:
        extracted_text = extracted_text[:10000] + "\n... [truncated]"

    result = {
        "file_name": original_name,
        "file_type": file_extension,
        "content": extracted_text,
    }

    if ai_summary:
        result["summary"] = ai_summary

    return result


def tool_list_files(
    dataroom_id: str,
    folder_id: Optional[str],
    db_session: Session,
) -> dict:
    """
    Tool: list_files_in_dataroom
    Query files in scope with metadata.
    """
    if folder_id:
        rows = db_session.execute(
            text("""
                SELECT f.id, f.original_name, f.file_extension, f.size_bytes,
                       fo.name AS folder_name, f.ai_summary
                FROM files f
                LEFT JOIN folders fo ON f.folder_id = fo.id
                WHERE f.dataroom_id = :did AND f.folder_id = :folid
                ORDER BY f.original_name
            """),
            {"did": dataroom_id, "folid": folder_id},
        ).fetchall()
    else:
        rows = db_session.execute(
            text("""
                SELECT f.id, f.original_name, f.file_extension, f.size_bytes,
                       fo.name AS folder_name, f.ai_summary
                FROM files f
                LEFT JOIN folders fo ON f.folder_id = fo.id
                WHERE f.dataroom_id = :did
                ORDER BY f.original_name
            """),
            {"did": dataroom_id},
        ).fetchall()

    files = []
    for row in rows:
        files.append({
            "id": row[0],
            "name": row[1],
            "type": row[2],
            "size": row[3],
            "folder_name": row[4] or "Unclassified",
            "ai_summary": row[5],
        })

    return {"files": files, "count": len(files)}


def tool_get_entities(
    scope_type: str,
    scope_id: str,
    db_session: Session,
) -> dict:
    """
    Tool: get_entities
    Query file_entities table grouped by entity_type.
    """
    if scope_type == "file":
        rows = db_session.execute(
            text("""
                SELECT entity_type, entity_value, context
                FROM file_entities
                WHERE file_id = :sid
                ORDER BY entity_type, entity_value
            """),
            {"sid": scope_id},
        ).fetchall()
    elif scope_type == "dataroom":
        rows = db_session.execute(
            text("""
                SELECT entity_type, entity_value, context
                FROM file_entities
                WHERE dataroom_id = :sid
                ORDER BY entity_type, entity_value
            """),
            {"sid": scope_id},
        ).fetchall()
    else:
        return {"error": f"Invalid scope_type: {scope_type}. Must be 'file' or 'dataroom'."}

    # Group by entity_type
    grouped = {}
    for row in rows:
        entity_type = row[0]
        if entity_type not in grouped:
            grouped[entity_type] = []
        entry = {"value": row[1]}
        if row[2]:
            entry["context"] = row[2]
        grouped[entity_type].append(entry)

    return {"entities": grouped}


def tool_find_similar(
    file_id: str,
    representative_chunk_vector: list,
    user_id: str,
    chroma_path: str,
    max_results: int = 5,
) -> dict:
    """
    Tool: find_similar_documents
    Vector search across ALL DataRooms, exclude same-file chunks.
    """
    from app.services.embedding_service import vector_search

    # Search globally (no dataroom filter) for similar content
    results = vector_search(
        query_vector=representative_chunk_vector,
        user_id=user_id,
        chroma_path=chroma_path,
        n_results=max_results + 10,  # Fetch extra to account for same-file filtering
    )

    # Filter out chunks from the same file and deduplicate by file_id
    seen_files = set()
    similar = []
    for chunk in results:
        chunk_file_id = chunk.get("file_id")
        if chunk_file_id == file_id:
            continue
        if chunk_file_id in seen_files:
            continue
        seen_files.add(chunk_file_id)
        similar.append({
            "file_id": chunk_file_id,
            "file_name": chunk.get("file_name", "Unknown"),
            "dataroom_id": chunk.get("dataroom_id"),
            "similarity_score": chunk.get("score", 0),
            "matching_text_preview": chunk.get("text", "")[:200],
        })
        if len(similar) >= max_results:
            break

    return {"similar_documents": similar, "count": len(similar)}


# ---------------------------------------------------------------------------
# Gemini-dependent tools — Python prepares data only
# ---------------------------------------------------------------------------

def prepare_compare_data(file_ids: list, db_session: Session) -> dict:
    """
    Prepare data for compare_documents tool.
    Gets first 3000 chars from each file for comparison.
    """
    files_data = []

    for fid in file_ids:
        row = db_session.execute(
            text("""
                SELECT original_name, file_extension, extracted_text
                FROM files WHERE id = :fid
            """),
            {"fid": fid},
        ).fetchone()

        if row:
            content = (row[2] or "")[:3000]
            files_data.append({
                "file_id": fid,
                "file_name": row[0],
                "file_type": row[1],
                "content": content,
            })

    return {"files": files_data, "file_count": len(files_data)}


def prepare_summarize_data(dataroom_id: str, db_session: Session) -> dict:
    """
    Prepare data for summarize_dataroom tool.
    Gets all files with ai_summaries and folder structure.
    """
    # Get dataroom info
    dr_row = db_session.execute(
        text("SELECT name, description FROM datarooms WHERE id = :did"),
        {"did": dataroom_id},
    ).fetchone()

    if not dr_row:
        return {"error": f"DataRoom not found: {dataroom_id}"}

    # Get files with summaries
    file_rows = db_session.execute(
        text("""
            SELECT f.original_name, f.file_extension, f.size_bytes,
                   fo.name AS folder_name, f.ai_summary
            FROM files f
            LEFT JOIN folders fo ON f.folder_id = fo.id
            WHERE f.dataroom_id = :did
            ORDER BY fo.name, f.original_name
        """),
        {"did": dataroom_id},
    ).fetchall()

    files = []
    for row in file_rows:
        files.append({
            "name": row[0],
            "type": row[1],
            "size": row[2],
            "folder": row[3] or "Unclassified",
            "summary": row[4] or "No summary available",
        })

    # Get folder structure
    folder_rows = db_session.execute(
        text("""
            SELECT name, context, parent_id
            FROM folders WHERE dataroom_id = :did
            ORDER BY display_order
        """),
        {"did": dataroom_id},
    ).fetchall()

    folders = [{"name": r[0], "context": r[1], "parent_id": r[2]} for r in folder_rows]

    return {
        "dataroom_name": dr_row[0],
        "dataroom_description": dr_row[1],
        "files": files,
        "folders": folders,
        "file_count": len(files),
        "folder_count": len(folders),
    }


def prepare_extract_data(
    query: str,
    dataroom_id: str,
    query_vector: list,
    user_id: str,
    chroma_path: str,
    db_session: Session,
) -> dict:
    """
    Prepare data for extract_data_point tool.
    Search for the specific data point via hybrid search and return top chunks.
    """
    from app.services.embedding_service import hybrid_search

    results = hybrid_search(
        query_vector=query_vector,
        query_text=query,
        user_id=user_id,
        chroma_path=chroma_path,
        db_session=db_session,
        dataroom_id=dataroom_id,
    )

    # Format top results for extraction
    formatted_parts = []
    for chunk in results[:5]:  # Top 5 most relevant
        file_name = chunk.get("file_name", "Unknown")
        chunk_text = chunk.get("text", "")
        formatted_parts.append(f"[Source: {file_name}]\n{chunk_text}")

    return {
        "query": query,
        "relevant_excerpts": "\n\n---\n\n".join(formatted_parts),
        "sources": [
            {"file_id": c.get("file_id"), "file_name": c.get("file_name")}
            for c in results[:5]
        ],
    }


# ---------------------------------------------------------------------------
# Audit data preparation and result application
# ---------------------------------------------------------------------------

def prepare_audit_data(
    dataroom_id: str,
    audit_type: str,
    db_session: Session,
) -> dict:
    """
    Prepare complete DataRoom data for Gemini to perform an audit.
    Express receives this and builds the audit prompt based on audit_type.
    """
    # DataRoom info
    dr_row = db_session.execute(
        text("SELECT name, description FROM datarooms WHERE id = :did"),
        {"did": dataroom_id},
    ).fetchone()

    if not dr_row:
        return {"error": f"DataRoom not found: {dataroom_id}"}

    # Files with metadata and summaries
    file_rows = db_session.execute(
        text("""
            SELECT f.id, f.original_name, f.file_extension, f.size_bytes,
                   fo.name AS folder_name, f.ai_summary, f.extracted_text
            FROM files f
            LEFT JOIN folders fo ON f.folder_id = fo.id
            WHERE f.dataroom_id = :did
            ORDER BY fo.name, f.original_name
        """),
        {"did": dataroom_id},
    ).fetchall()

    files = []
    for row in file_rows:
        entry = {
            "id": row[0],
            "name": row[1],
            "type": row[2],
            "size": row[3],
            "folder": row[4] or "Unclassified",
        }
        if row[5]:
            # Has AI summary
            entry["summary"] = row[5]
        elif row[6]:
            # No summary — use first 500 chars as preview
            entry["preview"] = (row[6])[:500]
        files.append(entry)

    # Folder structure with contexts
    folder_rows = db_session.execute(
        text("""
            SELECT id, name, context, parent_id
            FROM folders WHERE dataroom_id = :did
            ORDER BY display_order
        """),
        {"did": dataroom_id},
    ).fetchall()

    folders = []
    for row in folder_rows:
        folders.append({
            "id": row[0],
            "name": row[1],
            "context": row[2],
            "parent_id": row[3],
        })

    return {
        "dataroom_name": dr_row[0],
        "dataroom_description": dr_row[1],
        "files": files,
        "folders": folders,
        "audit_type": audit_type,
        "file_count": len(files),
        "folder_count": len(folders),
    }


def apply_audit_result(
    dataroom_id: str,
    audit_result: str,
    audit_type: str,
    session_id: Optional[str],
    db_session: Session,
) -> dict:
    """
    Save audit result as a chat session with messages.
    If session_id is provided, append to existing. Otherwise create new.
    """
    if not session_id:
        session_id = str(uuid.uuid4())
        scope_ids_json = json.dumps([dataroom_id])
        db_session.execute(
            text("""
                INSERT INTO chat_sessions (id, scope_type, scope_ids, scope_name, title)
                VALUES (:id, 'dataroom', :sids, :sname, :title)
            """),
            {
                "id": session_id,
                "sids": scope_ids_json,
                "sname": f"Audit: {audit_type}",
                "title": f"{audit_type.replace('_', ' ').title()} Audit",
            },
        )

    # Save audit as assistant message
    db_session.execute(
        text("""
            INSERT INTO chat_messages (id, session_id, role, content)
            VALUES (:id, :sid, 'assistant', :content)
        """),
        {
            "id": str(uuid.uuid4()),
            "sid": session_id,
            "content": audit_result,
        },
    )

    db_session.execute(
        text("UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = :sid"),
        {"sid": session_id},
    )

    db_session.commit()
    logger.info(f"Applied audit result to session {session_id}")

    return {"success": True, "session_id": session_id}


# ---------------------------------------------------------------------------
# Insights data preparation and storage
# ---------------------------------------------------------------------------

def prepare_insights_data(dataroom_id: str, db_session: Session) -> dict:
    """
    Prepare data for generating DataRoom insights.
    Express receives this and calls Gemini to generate summary, suggestions, etc.
    """
    # DataRoom info
    dr_row = db_session.execute(
        text("SELECT name, description FROM datarooms WHERE id = :did"),
        {"did": dataroom_id},
    ).fetchone()

    if not dr_row:
        return {"error": f"DataRoom not found: {dataroom_id}"}

    # File list with types and sizes
    file_rows = db_session.execute(
        text("""
            SELECT f.original_name, f.file_extension, f.size_bytes,
                   fo.name AS folder_name
            FROM files f
            LEFT JOIN folders fo ON f.folder_id = fo.id
            WHERE f.dataroom_id = :did
            ORDER BY f.original_name
        """),
        {"did": dataroom_id},
    ).fetchall()

    files = []
    type_counts = {}
    folder_file_counts = {}
    for row in file_rows:
        folder_name = row[3] or "Unclassified"
        files.append({
            "name": row[0],
            "type": row[1],
            "size": row[2],
            "folder": folder_name,
        })
        ext = row[1] or "unknown"
        type_counts[ext] = type_counts.get(ext, 0) + 1
        folder_file_counts[folder_name] = folder_file_counts.get(folder_name, 0) + 1

    # File type breakdown string
    breakdown_parts = []
    for ext, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        label = ext.lstrip(".").upper()
        breakdown_parts.append(f"{count} {label}")
    file_type_breakdown = ", ".join(breakdown_parts)

    # Folder names and contexts (with file counts computed above)
    folder_rows = db_session.execute(
        text("""
            SELECT name, context FROM folders
            WHERE dataroom_id = :did ORDER BY display_order
        """),
        {"did": dataroom_id},
    ).fetchall()

    folders = [
        {"name": r[0], "context": r[1], "file_count": folder_file_counts.get(r[0], 0)}
        for r in folder_rows
    ]

    # Existing entities (grouped)
    entity_rows = db_session.execute(
        text("""
            SELECT entity_type, entity_value
            FROM file_entities
            WHERE dataroom_id = :did
            ORDER BY entity_type
        """),
        {"did": dataroom_id},
    ).fetchall()

    entities = {}
    for row in entity_rows:
        entity_type = row[0]
        if entity_type not in entities:
            entities[entity_type] = []
        if row[1] not in entities[entity_type]:
            entities[entity_type].append(row[1])

    # Compute content_hash for insight version caching.
    # Incorporates file count, folder count, and full virtual paths so any
    # structural change (rename, move, add, remove) invalidates the cache.
    file_paths = sorted(
        f"{f['folder']}/{f['name']}" for f in files
    )
    hash_input = (
        str(len(files)) + "|" +
        str(len(folders)) + "|" +
        "|".join(file_paths)
    )
    content_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

    return {
        "dataroom_name": dr_row[0],
        "dataroom_description": dr_row[1],
        "files": files,
        "folders": folders,
        "entities": entities,
        "file_type_breakdown": file_type_breakdown,
        "file_count": len(files),
        "folder_count": len(folders),
        "content_hash": content_hash,
    }


def apply_insights(
    dataroom_id: str,
    insights_data: dict,
    db_session: Session,
    content_hash: Optional[str] = None,
) -> dict:
    """
    Store insights in dataroom_insights table.
    Marks old insights as stale first, then inserts new ones.

    insights_data should contain:
    {
        "summary": "...",
        "suggestions": ["...", "..."],
        "missing_docs": "..."
    }
    """
    # Validate that dataroom_id actually exists — prevents FK violations when
    # a caller accidentally passes a file_id or other ID instead of a dataroom_id.
    dr_exists = db_session.execute(
        text("SELECT id FROM datarooms WHERE id = :did"),
        {"did": dataroom_id},
    ).fetchone()
    if not dr_exists:
        raise ValueError(
            f"apply_insights: dataroom_id '{dataroom_id}' does not exist in datarooms table. "
            "A file_id or scope_id may have been passed instead of a dataroom_id."
        )

    # Mark old insights as stale
    db_session.execute(
        text("UPDATE dataroom_insights SET stale = 1 WHERE dataroom_id = :did"),
        {"did": dataroom_id},
    )

    count = 0

    # Insert summary
    if insights_data.get("summary"):
        db_session.execute(
            text("""
                INSERT INTO dataroom_insights (id, dataroom_id, insight_type, content, content_hash)
                VALUES (:id, :did, 'summary', :content, :hash)
            """),
            {"id": str(uuid.uuid4()), "did": dataroom_id, "content": insights_data["summary"], "hash": content_hash},
        )
        count += 1

    # Insert suggestions as JSON array
    if insights_data.get("suggestions"):
        suggestions_json = json.dumps(insights_data["suggestions"]) if isinstance(
            insights_data["suggestions"], list
        ) else insights_data["suggestions"]
        db_session.execute(
            text("""
                INSERT INTO dataroom_insights (id, dataroom_id, insight_type, content, content_hash)
                VALUES (:id, :did, 'suggestions', :content, :hash)
            """),
            {"id": str(uuid.uuid4()), "did": dataroom_id, "content": suggestions_json, "hash": content_hash},
        )
        count += 1

    # Insert missing docs suggestion
    if insights_data.get("missing_docs"):
        db_session.execute(
            text("""
                INSERT INTO dataroom_insights (id, dataroom_id, insight_type, content, content_hash)
                VALUES (:id, :did, 'missing_docs', :content, :hash)
            """),
            {"id": str(uuid.uuid4()), "did": dataroom_id, "content": insights_data["missing_docs"], "hash": content_hash},
        )
        count += 1

    db_session.commit()
    logger.info(f"Applied {count} insights for dataroom {dataroom_id}")

    return {"success": True, "insights_stored": count}


# ---------------------------------------------------------------------------
# Suggestions
# ---------------------------------------------------------------------------

def get_suggestions(dataroom_id: str, db_session: Session) -> dict:
    """
    Get suggested questions for a DataRoom.

    If fresh suggestions exist (stale=0), return cached.
    If stale or missing, return data needed for Express to generate them.
    """
    # Check for fresh suggestions
    row = db_session.execute(
        text("""
            SELECT content FROM dataroom_insights
            WHERE dataroom_id = :did AND insight_type = 'suggestions' AND stale = 0
            ORDER BY generated_at DESC
            LIMIT 1
        """),
        {"did": dataroom_id},
    ).fetchone()

    if row:
        # Try to parse as JSON array
        try:
            suggestions = json.loads(row[0])
            return {"stale": False, "suggestions": suggestions}
        except (json.JSONDecodeError, TypeError):
            return {"stale": False, "suggestions": [row[0]]}

    # Stale or missing — collect data for generation
    file_rows = db_session.execute(
        text("""
            SELECT f.original_name, COALESCE(fo.name, 'Unclassified') AS folder_name
            FROM files f
            LEFT JOIN folders fo ON f.folder_id = fo.id
            WHERE f.dataroom_id = :did
            ORDER BY f.original_name
            LIMIT 20
        """),
        {"did": dataroom_id},
    ).fetchall()
    file_names = [r[0] for r in file_rows]

    folder_rows = db_session.execute(
        text("""
            SELECT name FROM folders
            WHERE dataroom_id = :did
            ORDER BY display_order
        """),
        {"did": dataroom_id},
    ).fetchall()
    folder_names = [r[0] for r in folder_rows]

    # Compute current content_hash to check if insights are actually out of date
    all_file_rows = db_session.execute(
        text("""
            SELECT f.original_name, COALESCE(fo.name, 'Unclassified') AS folder_name
            FROM files f
            LEFT JOIN folders fo ON f.folder_id = fo.id
            WHERE f.dataroom_id = :did
            ORDER BY f.original_name
        """),
        {"did": dataroom_id},
    ).fetchall()
    all_folder_count = len(folder_rows)
    file_paths = sorted(f"{r[1]}/{r[0]}" for r in all_file_rows)
    hash_input = (
        str(len(all_file_rows)) + "|" +
        str(all_folder_count) + "|" +
        "|".join(file_paths)
    )
    current_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

    # Check if stale suggestions exist with matching content_hash
    stale_row = db_session.execute(
        text("""
            SELECT id, content, content_hash FROM dataroom_insights
            WHERE dataroom_id = :did AND insight_type = 'suggestions' AND stale = 1
            ORDER BY generated_at DESC
            LIMIT 1
        """),
        {"did": dataroom_id},
    ).fetchone()

    if stale_row and stale_row[2] == current_hash:
        # DataRoom content hasn't changed — un-stale and return cached suggestions
        db_session.execute(
            text("""
                UPDATE dataroom_insights SET stale = 0
                WHERE dataroom_id = :did AND insight_type = 'suggestions'
                AND content_hash = :hash
            """),
            {"did": dataroom_id, "hash": current_hash},
        )
        db_session.commit()
        try:
            suggestions = json.loads(stale_row[1])
            return {"stale": False, "suggestions": suggestions}
        except (json.JSONDecodeError, TypeError):
            return {"stale": False, "suggestions": [stale_row[1]]}

    return {
        "stale": True,
        "data_for_generation": {
            "file_names": file_names,
            "folder_names": folder_names,
        },
    }
