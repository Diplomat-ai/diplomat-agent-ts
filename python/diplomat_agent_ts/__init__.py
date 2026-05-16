from __future__ import annotations

__version__ = "0.1.0"
__all__ = ["run"]


def run(args: list[str] | None = None) -> None:
    """Programmatic entry point. Equivalent to calling diplomat-agent-ts from the CLI."""
    import sys

    from diplomat_agent_ts._runner import run_cli

    run_cli(args if args is not None else sys.argv[1:])
