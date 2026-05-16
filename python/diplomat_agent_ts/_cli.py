import sys

from diplomat_agent_ts._runner import run_cli


def main() -> None:
    run_cli(sys.argv[1:])


if __name__ == "__main__":
    main()
