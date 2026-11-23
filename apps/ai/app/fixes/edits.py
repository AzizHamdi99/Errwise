from app.schemas.fix import FixEdit, FixOutput, FixRequest


def find_edit_problem(request: FixRequest, output: FixOutput) -> str | None:
    """Why the edits cannot be applied to the code that was sent, or None when they can.

    The answer is a short code, never text from the code or the model. The API repeats this
    check against the real file, which is the one that counts: this one only stops a useless
    answer from being stored and paid for.
    """
    if not output.fixable:
        return None

    windows = {window.file: window for window in request.files}
    spans: dict[str, list[tuple[int, int]]] = {}
    for edit in output.edits:
        window = windows.get(edit.file)
        if window is None:
            return "unknown_file"
        if edit.search == edit.replace:
            return "no_change"
        found = window.code.count(edit.search)
        if found == 0:
            return "search_not_found"
        if found > 1:
            return "search_not_unique"
        start = window.code.index(edit.search)
        spans.setdefault(edit.file, []).append((start, start + len(edit.search)))

    for file_spans in spans.values():
        ordered = sorted(file_spans)
        if any(later[0] < earlier[1] for earlier, later in zip(ordered, ordered[1:], strict=False)):
            return "overlapping_edits"
    return None


def apply_edits(code: str, edits: list[FixEdit]) -> str:
    """The edits of one file applied to its code. Assumes `find_edit_problem` found nothing."""
    result = code
    for edit in sorted(edits, key=lambda e: code.index(e.search), reverse=True):
        start = result.index(edit.search)
        result = result[:start] + edit.replace + result[start + len(edit.search) :]
    return result
