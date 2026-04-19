"""
AI Classification Service — Data preparation & result application for Orvyn.

Gemini API calls have moved to the Express backend (holds the API key securely).
This module now handles only:
  - Building file fingerprints from the local SQLite database
  - Building folder tree representations for classification context
  - Applying AI classification results back to the database
"""

import datetime
import logging
import uuid

from sqlalchemy.orm import Session

from app.main import DataRoom, Folder, File, Classification

logger = logging.getLogger(__name__)

# Confidence below this threshold means the file stays unassigned (or is routed
# to the Unclassified bucket in hybrid mode). Must match apply_classify_results /
# apply_generate_results behavior.
CONFIDENCE_THRESHOLD = 0.4


# ---------------------------------------------------------------------------
# Fingerprint & folder-tree helpers
# ---------------------------------------------------------------------------

def create_fingerprint(file_record) -> dict:
    """
    Build a lightweight fingerprint dict from a File ORM object.
    Used as input context for the AI classification prompt.
    """
    text = file_record.extracted_text or ""

    # For images where extracted_text is just "[Image: filename]", use name-based preview
    if text.startswith("[Image:"):
        preview = f"(image file: {file_record.original_name})"
    else:
        preview = text[:1000]

    return {
        "id": file_record.id,
        "name": file_record.original_name,
        "extension": file_record.file_extension,
        "preview": preview,
        "type": file_record.mime_type or "unknown",
    }


def build_folder_tree(session, dataroom_id: str) -> str:
    """
    Query all folders for a DataRoom and build a nested text tree
    with IDs and context descriptions for use in the AI prompt.
    """
    folders = (
        session.query(Folder)
        .filter_by(dataroom_id=dataroom_id)
        .order_by(Folder.display_order)
        .all()
    )

    # Build lookup by parent_id
    children_map = {}
    for f in folders:
        parent = f.parent_id or "__root__"
        children_map.setdefault(parent, []).append(f)

    lines = []

    def _recurse(parent_key: str, depth: int):
        for f in children_map.get(parent_key, []):
            indent = "  " * depth
            lines.append(f"{indent}- [{f.id}] {f.name}: {f.context}")
            _recurse(f.id, depth + 1)

    _recurse("__root__", 0)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Prepare functions — build data for Express/Gemini
# ---------------------------------------------------------------------------

def prepare_classify(engine, dataroom_id: str, file_ids: list[str]) -> dict:
    """
    Prepare fingerprints and folder tree for external AI classification.
    Returns data that Electron forwards to Express for the Gemini call.
    """
    with Session(engine) as session:
        # Build folder tree
        folders = (
            session.query(Folder)
            .filter_by(dataroom_id=dataroom_id)
            .all()
        )
        if not folders:
            raise ValueError("DataRoom has no folders to classify into.")

        folder_ids = [f.id for f in folders]
        folder_tree = build_folder_tree(session, dataroom_id)

        # Build file fingerprints
        files = session.query(File).filter(File.id.in_(file_ids)).all()
        found_ids = {f.id for f in files}
        missing = [fid for fid in file_ids if fid not in found_ids]

        fingerprints = [create_fingerprint(f) for f in files]

    return {
        "fingerprints": fingerprints,
        "folder_tree": folder_tree,
        "folder_ids": folder_ids,
        "missing_file_ids": missing,
    }


def prepare_generate(engine, file_ids: list[str]) -> dict:
    """
    Prepare file fingerprints for AI DataRoom generation.
    Returns data that Electron forwards to Express for the Gemini call.
    """
    with Session(engine) as session:
        files = session.query(File).filter(File.id.in_(file_ids)).all()
        found_ids = {f.id for f in files}
        missing = [fid for fid in file_ids if fid not in found_ids]

        preview_len = 500 if len(files) > 30 else 1000
        fingerprints = []
        for f in files:
            fp = create_fingerprint(f)
            fp["preview"] = fp["preview"][:preview_len]
            fingerprints.append(fp)

    return {
        "fingerprints": fingerprints,
        "missing_file_ids": missing,
    }


# ---------------------------------------------------------------------------
# Apply functions — write AI results to database
# ---------------------------------------------------------------------------

def apply_classify_results(engine, dataroom_id: str, results: list) -> dict:
    """
    Apply classification results (from Express/Gemini) to the database.
    Updates file folder assignments and creates Classification records.
    """
    with Session(engine) as session:
        # Get valid folder IDs for this DataRoom
        folder_ids_set = {
            f.id for f in session.query(Folder).filter_by(dataroom_id=dataroom_id).all()
        }

        classified_count = 0
        skipped_count = 0

        for r in results:
            file_record = session.query(File).filter_by(id=r.get("file_id")).first()
            if not file_record:
                continue

            fid = r.get("folder_id")
            if fid is not None and fid not in folder_ids_set:
                fid = None

            confidence = float(r.get("confidence", 0.0))

            file_record.status = "classified"
            file_record.updated_at = datetime.datetime.utcnow()

            # Only assign folder if confidence >= 0.4
            if fid and confidence >= 0.4:
                file_record.folder_id = fid
                classified_count += 1
            else:
                skipped_count += 1

            # Create Classification record when a folder was suggested
            if fid:
                classification = Classification(
                    id=str(uuid.uuid4()),
                    file_id=r["file_id"],
                    folder_id=fid,
                    confidence=confidence,
                    reasoning=r.get("reasoning", ""),
                )
                session.add(classification)

        session.commit()

    return {
        "status": "success",
        "dataroom_id": dataroom_id,
        "classified": classified_count,
        "low_confidence_skipped": skipped_count,
    }


def apply_generate_results(
    engine,
    name: str,
    description: str,
    gemini_result: dict,
    file_ids: list[str],
    dataroom_id: str = None,
) -> dict:
    """
    Apply AI-generated DataRoom structure (from Express/Gemini) to the database.
    If dataroom_id is provided, reuses the existing DataRoom; otherwise creates a new one.
    Creates folders and assigns files.
    """
    with Session(engine) as session:
        if dataroom_id:
            # Reuse existing DataRoom
            dataroom = session.query(DataRoom).filter_by(id=dataroom_id).first()
            if not dataroom:
                raise ValueError(f"DataRoom {dataroom_id} not found.")
            dataroom.name = name
            dataroom.description = description
            dataroom.created_by_ai = True
        else:
            # Create new DataRoom
            dataroom = DataRoom(
                id=str(uuid.uuid4()),
                name=name,
                description=description,
                created_by_ai=True,
            )
            session.add(dataroom)
            session.flush()

        # Recursively create folders — build path-to-id mapping
        folder_path_map = {}

        def _create_folders(folder_defs: list, parent_id=None, path_prefix=()):
            for order, fdef in enumerate(folder_defs):
                folder_name = fdef["name"]
                folder_context = fdef.get("context", folder_name)
                current_path = path_prefix + (folder_name,)

                folder = Folder(
                    id=str(uuid.uuid4()),
                    dataroom_id=dataroom.id,
                    name=folder_name,
                    context=folder_context,
                    parent_id=parent_id,
                    display_order=order,
                    created_by_ai=True,
                )
                session.add(folder)
                session.flush()

                folder_path_map[current_path] = folder.id

                children = fdef.get("children", [])
                if children:
                    _create_folders(children, parent_id=folder.id, path_prefix=current_path)

        _create_folders(gemini_result.get("folders", []))

        # Assign files and create Classification records
        assigned_count = 0
        unassigned_count = 0
        missing = []

        for assignment in gemini_result.get("assignments", []):
            file_id = assignment.get("file_id")
            folder_path = tuple(assignment.get("folder_path", []))
            confidence = float(assignment.get("confidence", 0.0))
            reasoning = assignment.get("reasoning", "")

            folder_id = folder_path_map.get(folder_path)
            if not folder_id:
                unassigned_count += 1
                continue

            file_record = session.query(File).filter_by(id=file_id).first()
            if not file_record:
                missing.append(file_id)
                continue

            file_record.dataroom_id = dataroom.id
            file_record.folder_id = folder_id if confidence >= 0.4 else None
            file_record.status = "classified"
            file_record.updated_at = datetime.datetime.utcnow()

            classification = Classification(
                id=str(uuid.uuid4()),
                file_id=file_id,
                folder_id=folder_id,
                confidence=confidence,
                reasoning=reasoning,
            )
            session.add(classification)
            assigned_count += 1

        session.commit()
        session.refresh(dataroom)

        return {
            "status": "success",
            "dataroom": {
                "id": dataroom.id,
                "name": dataroom.name,
                "description": dataroom.description,
                "created_by_ai": True,
            },
            "folders_created": len(folder_path_map),
            "files_assigned": assigned_count,
            "files_unassigned": unassigned_count,
            "missing_file_ids": missing,
        }


# ---------------------------------------------------------------------------
# Hybrid organize — AI mode + existing DataRoom
# ---------------------------------------------------------------------------

def create_fingerprint_rich(file_record) -> dict:
    """
    Like create_fingerprint but with a longer text preview (1500 chars) and
    an ai_summary field when available. Used for the hybrid organize path
    where we want the LLM to have as much signal as possible to match files
    against existing folders.
    """
    text = file_record.extracted_text or ""

    if text.startswith("[Image:"):
        preview = f"(image file: {file_record.original_name})"
    else:
        preview = text[:1500]

    fp = {
        "id": file_record.id,
        "name": file_record.original_name,
        "extension": file_record.file_extension,
        "preview": preview,
        "type": file_record.mime_type or "unknown",
    }
    if file_record.ai_summary:
        fp["summary"] = file_record.ai_summary[:500]
    return fp


def prepare_hybrid(engine, dataroom_id: str, file_ids: list[str]) -> dict:
    """
    Prepare fingerprints and existing folder tree for the hybrid organize path.
    Unlike prepare_classify, this does NOT raise when the DataRoom has zero folders
    (hybrid is legal on a fresh DR — the LLM then creates everything new).
    """
    with Session(engine) as session:
        folders = (
            session.query(Folder)
            .filter_by(dataroom_id=dataroom_id)
            .all()
        )
        folder_ids = [f.id for f in folders]
        folder_tree = build_folder_tree(session, dataroom_id)

        files = session.query(File).filter(File.id.in_(file_ids)).all()
        found_ids = {f.id for f in files}
        missing = [fid for fid in file_ids if fid not in found_ids]

        fingerprints = [create_fingerprint_rich(f) for f in files]

    return {
        "fingerprints": fingerprints,
        "folder_tree": folder_tree,
        "folder_ids": folder_ids,
        "missing_file_ids": missing,
    }


def _topo_sort_new_folders(new_folders: list, existing_folder_ids: set) -> tuple[list, set]:
    """
    Topologically order new-folder definitions so a parent is always created
    before its children. Also de-duplicates temp_ids, drops folders whose
    parent is unresolvable, and breaks cycles.

    Returns (ordered_folders, dropped_temp_ids).
    """
    # De-duplicate by temp_id (keep first occurrence)
    seen_temp_ids = set()
    deduped = []
    dropped = set()
    for f in new_folders:
        tid = f.get("temp_id")
        if not tid or not isinstance(tid, str):
            logger.warning("Hybrid: skipping new folder without valid temp_id: %s", f)
            continue
        if tid in seen_temp_ids:
            logger.warning("Hybrid: duplicate temp_id %s, dropping duplicate", tid)
            continue
        seen_temp_ids.add(tid)
        deduped.append(f)

    valid_temp_ids = set(seen_temp_ids)

    # Kahn's algorithm keyed on temp_id
    by_temp_id = {f["temp_id"]: f for f in deduped}
    ready = []       # temp_ids with resolved parents (either existing UUID, None, or already-ordered temp_id)
    pending = {}     # temp_id -> parent_temp_id (dependency)
    ordered = []

    for f in deduped:
        parent = f.get("parent")
        if parent is None or parent in existing_folder_ids:
            ready.append(f["temp_id"])
        elif isinstance(parent, str) and parent in valid_temp_ids:
            pending[f["temp_id"]] = parent
        else:
            logger.warning(
                "Hybrid: new folder %s has unresolvable parent %r, dropping",
                f["temp_id"], parent,
            )
            dropped.add(f["temp_id"])

    processed = set()
    while ready:
        tid = ready.pop(0)
        if tid in processed:
            continue
        processed.add(tid)
        ordered.append(by_temp_id[tid])
        # Release any pending folder whose parent is this one
        to_release = [child for child, parent in pending.items() if parent == tid]
        for child in to_release:
            del pending[child]
            ready.append(child)

    # Anything left in `pending` is a cycle
    for tid in pending:
        logger.warning("Hybrid: new folder %s is in a parent cycle, dropping", tid)
        dropped.add(tid)

    # Recursively drop descendants of dropped folders
    changed = True
    while changed:
        changed = False
        new_ordered = []
        for f in ordered:
            parent = f.get("parent")
            if isinstance(parent, str) and parent in dropped:
                dropped.add(f["temp_id"])
                logger.warning(
                    "Hybrid: dropping new folder %s because ancestor was dropped",
                    f["temp_id"],
                )
                changed = True
            else:
                new_ordered.append(f)
        ordered = new_ordered

    return ordered, dropped


def apply_hybrid_results(
    engine,
    dataroom_id: str,
    gemini_result: dict,
    file_ids: list[str],
) -> dict:
    """
    Apply hybrid organize results to an existing DataRoom.
    - existing_assignments: {file_id, folder_id, confidence, reasoning} → assign to existing folder UUIDs.
    - new_folders: {temp_id, name, context, parent} where parent is an existing UUID, another temp_id, or None.
    - new_assignments: {file_id, new_folder_temp_id, confidence, reasoning} → assign to newly created folders.

    Files with confidence < CONFIDENCE_THRESHOLD or whose target folder could not
    be resolved are routed to an "Unclassified" folder (created at root, or reused
    if one already exists).

    Returns counts for each outcome plus the dataroom descriptor.
    """
    existing_assignments = gemini_result.get("existing_assignments", []) or []
    new_folders = gemini_result.get("new_folders", []) or []
    new_assignments = gemini_result.get("new_assignments", []) or []

    with Session(engine) as session:
        dataroom = session.query(DataRoom).filter_by(id=dataroom_id).first()
        if not dataroom:
            raise ValueError(f"DataRoom {dataroom_id} not found.")

        existing_folder_ids = {
            f.id for f in session.query(Folder).filter_by(dataroom_id=dataroom_id).all()
        }

        # Topologically order new_folders
        ordered_new_folders, dropped_temp_ids = _topo_sort_new_folders(
            new_folders, existing_folder_ids
        )

        # Create new folders in order; build temp_id -> real UUID map
        temp_to_real: dict[str, str] = {}
        for order, fdef in enumerate(ordered_new_folders):
            tid = fdef["temp_id"]
            parent_raw = fdef.get("parent")
            if parent_raw is None:
                parent_id = None
            elif parent_raw in existing_folder_ids:
                parent_id = parent_raw
            else:
                parent_id = temp_to_real.get(parent_raw)
                if parent_id is None:
                    logger.warning(
                        "Hybrid: new folder %s parent %s could not be resolved at create time, skipping",
                        tid, parent_raw,
                    )
                    dropped_temp_ids.add(tid)
                    continue

            folder = Folder(
                id=str(uuid.uuid4()),
                dataroom_id=dataroom_id,
                name=fdef.get("name") or "Untitled",
                context=fdef.get("context") or fdef.get("name") or "",
                parent_id=parent_id,
                display_order=order,
                created_by_ai=True,
            )
            session.add(folder)
            session.flush()
            temp_to_real[tid] = folder.id

        new_folders_created = len(temp_to_real)

        # Track which files landed where
        existing_reused_set: set[str] = set()
        files_assigned_existing = 0
        files_assigned_new = 0
        unclassified_file_ids: list[tuple[str, float, str, str]] = []  # (file_id, conf, reasoning, suggested_folder_id)
        files_missing_folder = 0
        already_processed: set[str] = set()

        # Pass 1: existing_assignments (prefer reuse over duplicate new_assignment)
        for r in existing_assignments:
            file_id = r.get("file_id")
            if not file_id or file_id in already_processed:
                continue
            fid = r.get("folder_id")
            confidence = float(r.get("confidence") or 0.0)
            reasoning = r.get("reasoning") or ""

            if fid is None or fid not in existing_folder_ids:
                # Folder invalid → treat as unclassified
                unclassified_file_ids.append((file_id, confidence, reasoning, None))
                already_processed.add(file_id)
                continue

            file_record = session.query(File).filter_by(id=file_id).first()
            if not file_record:
                already_processed.add(file_id)
                continue

            if confidence >= CONFIDENCE_THRESHOLD:
                file_record.folder_id = fid
                file_record.status = "classified"
                file_record.updated_at = datetime.datetime.utcnow()
                existing_reused_set.add(fid)
                files_assigned_existing += 1

                session.add(Classification(
                    id=str(uuid.uuid4()),
                    file_id=file_id,
                    folder_id=fid,
                    confidence=confidence,
                    reasoning=reasoning,
                ))
            else:
                unclassified_file_ids.append((file_id, confidence, reasoning, fid))
            already_processed.add(file_id)

        # Pass 2: new_assignments
        for r in new_assignments:
            file_id = r.get("file_id")
            if not file_id or file_id in already_processed:
                if file_id in already_processed:
                    logger.warning(
                        "Hybrid: file %s appeared in both existing_assignments and new_assignments; "
                        "keeping existing_assignment outcome",
                        file_id,
                    )
                continue
            tid = r.get("new_folder_temp_id")
            confidence = float(r.get("confidence") or 0.0)
            reasoning = r.get("reasoning") or ""

            real_folder_id = temp_to_real.get(tid) if tid else None

            if real_folder_id is None:
                # Temp id unknown or folder was dropped
                files_missing_folder += 1
                unclassified_file_ids.append((file_id, confidence, reasoning, None))
                already_processed.add(file_id)
                continue

            file_record = session.query(File).filter_by(id=file_id).first()
            if not file_record:
                already_processed.add(file_id)
                continue

            if confidence >= CONFIDENCE_THRESHOLD:
                file_record.folder_id = real_folder_id
                file_record.status = "classified"
                file_record.updated_at = datetime.datetime.utcnow()
                files_assigned_new += 1

                session.add(Classification(
                    id=str(uuid.uuid4()),
                    file_id=file_id,
                    folder_id=real_folder_id,
                    confidence=confidence,
                    reasoning=reasoning,
                ))
            else:
                unclassified_file_ids.append((file_id, confidence, reasoning, real_folder_id))
            already_processed.add(file_id)

        # Route unclassified files into a dedicated folder (reuse if it exists)
        files_unclassified = 0
        if unclassified_file_ids:
            unclassified_folder = (
                session.query(Folder)
                .filter_by(dataroom_id=dataroom_id, parent_id=None, name="Unclassified")
                .first()
            )
            if not unclassified_folder:
                unclassified_folder = Folder(
                    id=str(uuid.uuid4()),
                    dataroom_id=dataroom_id,
                    name="Unclassified",
                    context="Files that could not be confidently placed — please review",
                    parent_id=None,
                    display_order=0,
                    created_by_ai=True,
                )
                session.add(unclassified_folder)
                session.flush()
                new_folders_created += 1

            for file_id, confidence, reasoning, suggested_fid in unclassified_file_ids:
                file_record = session.query(File).filter_by(id=file_id).first()
                if not file_record:
                    continue
                file_record.folder_id = unclassified_folder.id
                file_record.status = "classified"
                file_record.updated_at = datetime.datetime.utcnow()
                files_unclassified += 1

                # Audit: record the LLM's original suggestion (if any), not the Unclassified fallback
                if suggested_fid:
                    session.add(Classification(
                        id=str(uuid.uuid4()),
                        file_id=file_id,
                        folder_id=suggested_fid,
                        confidence=confidence,
                        reasoning=reasoning,
                    ))

        # Collect file_ids that never appeared in either assignment list
        handled = already_processed
        unhandled = [fid for fid in file_ids if fid not in handled]
        if unhandled:
            logger.warning(
                "Hybrid: %d file(s) in request were not addressed by Gemini result",
                len(unhandled),
            )

        session.commit()
        session.refresh(dataroom)

        return {
            "status": "success",
            "dataroom": {
                "id": dataroom.id,
                "name": dataroom.name,
                "description": dataroom.description,
            },
            "existing_folders_reused": len(existing_reused_set),
            "new_folders_created": new_folders_created,
            "files_assigned_existing": files_assigned_existing,
            "files_assigned_new": files_assigned_new,
            "files_unclassified": files_unclassified,
            "files_missing_folder": files_missing_folder,
            "dropped_new_folders": len(dropped_temp_ids),
            "unaddressed_file_ids": unhandled,
        }
