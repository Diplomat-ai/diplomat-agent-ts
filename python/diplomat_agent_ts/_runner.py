import os
import shutil
import subprocess
import sys


MIN_NODE_MAJOR = 20
NPM_PACKAGE = "@diplomat-ai/diplomat-agent-ts"
NPX_CMD = "npx"


def _check_node() -> str:
    node = shutil.which("node")
    if not node:
        print(
            "Error: Node.js >= 20 is required but was not found in PATH.\n"
            "Install it from https://nodejs.org or via nvm/volta.",
            file=sys.stderr,
        )
        sys.exit(1)
    result = subprocess.run([node, "--version"], capture_output=True, text=True)
    version_str = result.stdout.strip().lstrip("v")
    major = int(version_str.split(".")[0])
    if major < MIN_NODE_MAJOR:
        print(
            f"Error: Node.js >= {MIN_NODE_MAJOR} required, found {result.stdout.strip()}.",
            file=sys.stderr,
        )
        sys.exit(1)
    return node


def run_cli(args: list[str]) -> None:
    _check_node()

    node_modules_path = os.environ.get("NODE_MODULES_PATH")
    if node_modules_path:
        cli_path = os.path.join(node_modules_path, ".bin", "diplomat-agent-ts")
        cmd = [cli_path] + args
    else:
        cmd = [NPX_CMD, "--yes", NPM_PACKAGE] + args

    result = subprocess.run(cmd)
    sys.exit(result.returncode)
