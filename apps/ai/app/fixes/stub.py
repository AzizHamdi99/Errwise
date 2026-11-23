from app.schemas.fix import FixEdit, FixRequest, FixResponse


class StubFixProposer:
    """Deterministic fake, handy offline and for building the dashboard.

    Prefixes the failing line with a comment, which is a valid patch but not a real fix. When
    that line cannot be told apart from another one it declines, like the real thing would.
    """

    async def propose(self, request: FixRequest) -> FixResponse:
        window = request.files[0]
        lines = window.code.split("\n")
        index = window.failing_line - window.start_line
        line = lines[index] if index < len(lines) else ""

        if line.strip() and window.code.count(line) == 1:
            indent = line[: len(line) - len(line.lstrip())]
            return FixResponse(
                fixable=True,
                pr_title=f"Stub: handle {request.type}",
                explanation="Stub fix. No model was called, the change is only a comment.",
                confidence="low",
                edits=[
                    FixEdit(
                        file=window.file,
                        search=line,
                        replace=f"{indent}// TODO(errwise stub): handle {request.type}\n{line}",
                    )
                ],
                reason="",
                prompt_version="stub",
                model="stub",
            )
        return FixResponse(
            fixable=False,
            pr_title="",
            explanation="",
            confidence="low",
            edits=[],
            reason="Stub fix. No model was called.",
            prompt_version="stub",
            model="stub",
        )
