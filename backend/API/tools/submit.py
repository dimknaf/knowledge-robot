"""submit_result — terminal tool. The agent's call to this is the structured output.

The tool is a factory because the output schema is dynamic per request.
StopAtTools(["submit_result"]) halts the runner once the agent calls it.
"""
from typing import Type

from agents import function_tool
from pydantic import BaseModel


def make_submit_result(model_class: Type[BaseModel]):
    """Build a submit_result tool whose argument type is the given Pydantic model."""

    @function_tool
    async def submit_result(result: model_class) -> str:  # type: ignore[valid-type]
        """Submit your structured findings. Call this exactly once when you are done.

        Args:
            result: The structured result for this task, matching the requested schema.
        """
        return result.model_dump_json()

    return submit_result
