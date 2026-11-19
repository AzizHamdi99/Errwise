from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """JSON on the wire is camelCase like the rest of Errwise. Python code stays snake_case."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
