import subprocess
import sys


def test_help_exits_zero():
    result = subprocess.run(
        [sys.executable, "-m", "diplomat_agent_ts._cli", "--help"],
        capture_output=True,
        text=True,
        cwd="python",
    )
    assert result.returncode in (0, 1)


def test_version_flag():
    result = subprocess.run(
        [sys.executable, "-m", "diplomat_agent_ts._cli", "--version"],
        capture_output=True,
        text=True,
        cwd="python",
    )
    assert result.returncode in (0, 1)


def test_node_missing_gives_clear_error(monkeypatch):
    import shutil
    original_which = shutil.which
    monkeypatch.setattr(shutil, "which", lambda name: None if name == "node" else original_which(name))
    result = subprocess.run(
        [sys.executable, "-c",
         "import sys; sys.path.insert(0, 'python'); from diplomat_agent_ts._runner import run_cli; run_cli([])"],
        capture_output=True,
        text=True,
    )
    assert "Node.js" in result.stderr
    assert result.returncode == 1
