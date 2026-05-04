"""delegate_to_subagent — fresh agent in its own context for focused work.

Subagent shares the parent's scrape backend and search setting via contextvars,
so tool invocations don't need to thread state through @function_tool args.

Depth-capped at _MAX_DEPTH = 1: a subagent calling delegate_to_subagent itself
gets an error back and must do the work directly.
"""
import contextvars
import logging

from agents import function_tool

from config import settings

logger = logging.getLogger(__name__)

_MAX_DEPTH = 1
_call_depth: contextvars.ContextVar[int] = contextvars.ContextVar("subagent_depth", default=0)
_enable_search: contextvars.ContextVar[bool] = contextvars.ContextVar("enable_search", default=False)


def set_request_context(enable_search: bool) -> None:
    """Called by the orchestrator before Runner.run."""
    _enable_search.set(enable_search)
    _call_depth.set(0)


def _truncate(text: str, cap: int | None = None) -> str:
    cap = cap or settings.tool_output_max_chars
    if len(text) <= cap:
        return text
    return text[:cap] + "\n... [truncated]"


@function_tool
async def delegate_to_subagent(task: str) -> str:
    """Delegate a focused task to a fresh subagent running in its own context.

    Use for deep searches, bulk lookups, or anything where you want the result
    without polluting your main context with intermediate tool outputs.

    Write a clear, self-contained task description — the subagent does NOT see
    your prior context. End by telling it to call submit_result with a summary.

    Args:
        task: A self-contained task description for the subagent.
    """
    depth = _call_depth.get()
    if depth >= _MAX_DEPTH:
        return "ERROR: max delegation depth reached. Do the task yourself."
    _call_depth.set(depth + 1)
    try:
        from agents import Agent, ModelSettings, Runner, StopAtTools
        from pydantic import BaseModel

        from agent import _create_model
        from tools.firecrawl import TruncatingMCPWrapper, get_firecrawl_mcp
        from tools.submit import make_submit_result

        class SubagentResult(BaseModel):
            summary: str

        logger.info("Subagent starting: %s", task[:200])

        enable_search = _enable_search.get()
        async with get_firecrawl_mcp(enable_search) as firecrawl_server:
            wrapped = TruncatingMCPWrapper(
                firecrawl_server,
                max_length=settings.firecrawl_max_content_length,
            )
            subagent = Agent(
                name="Subagent",
                instructions=(
                    "You are a focused research subagent. Complete the task "
                    "concisely and call submit_result with a summary string."
                ),
                model=_create_model(),
                model_settings=ModelSettings(),
                mcp_servers=[wrapped],
                tools=[make_submit_result(SubagentResult)],
                tool_use_behavior=StopAtTools(stop_at_tool_names=["submit_result"]),
            )
            result = await Runner.run(
                starting_agent=subagent,
                input=task,
                max_turns=settings.agent_subagent_max_turns,
            )

        return _truncate(str(result.final_output))
    except Exception as e:
        logger.exception("Subagent failed")
        return f"ERROR: subagent failed - {e}"
    finally:
        _call_depth.set(depth)
