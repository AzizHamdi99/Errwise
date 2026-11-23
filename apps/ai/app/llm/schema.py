from typing import Any

from pydantic import BaseModel

# Keywords the provider's strict mode may reject. Pydantic enforces them after the call instead.
_UNSUPPORTED = {"title", "default", "minLength", "maxLength", "minItems", "maxItems"}


def _inline_refs(node: Any, defs: dict[str, Any]) -> Any:
    """Nested models become `$ref`s. Strict mode is safest with them written out in place."""
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str):
            target = _inline_refs(defs[ref.rsplit("/", 1)[-1]], defs)
            siblings = {k: _inline_refs(v, defs) for k, v in node.items() if k != "$ref"}
            return {**target, **siblings}
        return {k: _inline_refs(v, defs) for k, v in node.items() if k != "$defs"}
    if isinstance(node, list):
        return [_inline_refs(item, defs) for item in node]
    return node


def _clean(node: Any) -> Any:
    """Drops the unsupported keywords, but never a *property* that happens to share their name."""
    if isinstance(node, dict):
        out: dict[str, Any] = {}
        for key, value in node.items():
            if key in _UNSUPPORTED:
                continue
            if key == "properties" and isinstance(value, dict):
                out[key] = {name: _clean(sub) for name, sub in value.items()}
            else:
                out[key] = _clean(value)
        return out
    if isinstance(node, list):
        return [_clean(item) for item in node]
    return node


def _require_strict(node: Any, where: str) -> None:
    if isinstance(node, dict):
        properties = node.get("properties")
        if isinstance(properties, dict):
            if node.get("additionalProperties") is not False:
                raise ValueError(f"{where} must forbid extra fields")
            if set(node.get("required", [])) != set(properties):
                raise ValueError(f"{where} must require every field")
            for name, sub in properties.items():
                _require_strict(sub, f"{where}.{name}")
        if "items" in node:
            _require_strict(node["items"], f"{where}[]")


def strict_json_schema(model: type[BaseModel]) -> dict[str, Any]:
    """JSON schema for strict structured outputs: all fields required, no extra properties.

    Checked on every object of the schema, nested ones included.
    """
    raw = model.model_json_schema(by_alias=True)
    schema: dict[str, Any] = _clean(_inline_refs(raw, raw.get("$defs", {})))
    _require_strict(schema, model.__name__)
    if "properties" not in schema:
        raise ValueError(f"{model.__name__} must be an object")
    return schema
