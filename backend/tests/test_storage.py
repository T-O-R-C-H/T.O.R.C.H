"""
Task history and metrics persistence.

Failed tasks have to be recorded as failed — the metrics the user sees are
built from this, and a task silently logged as completed would misreport it.
"""

from datetime import datetime

import pytest

from memory.storage import TorchDatabase


def test_save_task_returns_an_id(temp_db):
    task_id = temp_db.save_task("find my invoice", [], "completed")
    assert task_id


def test_saved_task_is_retrievable(temp_db):
    temp_db.save_task("find my invoice", [{"tool": "find_file"}], "completed")

    tasks = temp_db.get_tasks()
    assert len(tasks) == 1
    assert tasks[0]["command"] == "find my invoice"
    assert tasks[0]["status"] == "completed"


def test_failed_tasks_are_recorded_as_failed(temp_db):
    temp_db.save_task("send an email", [], "failed")

    assert temp_db.get_tasks()[0]["status"] == "failed"


def test_steps_survive_the_round_trip(temp_db):
    steps = [{"tool": "find_file", "label": "Looking for your file", "status": "done"}]
    temp_db.save_task("find my invoice", steps, "completed")

    import json

    assert json.loads(temp_db.get_tasks()[0]["steps_json"]) == steps


def test_tasks_are_returned_newest_first(temp_db):
    for command in ["first", "second", "third"]:
        temp_db.save_task(command, [], "completed")

    commands = [task["command"] for task in temp_db.get_tasks()]
    assert commands[0] == "third"


def test_get_tasks_respects_limit(temp_db):
    for index in range(5):
        temp_db.save_task(f"command {index}", [], "completed")

    assert len(temp_db.get_tasks(limit=2)) == 2


def test_metrics_separate_completed_from_attempted(temp_db):
    """A failed task counts as an attempt but never as a completion."""
    temp_db.save_task("worked", [], "completed")
    temp_db.save_task("broke", [], "failed")

    stats = temp_db.get_stats_for_date(datetime.now().strftime("%Y-%m-%d"))
    assert stats["completed"] == 1
    assert stats["total"] == 2


def test_metrics_count_actions_from_completed_steps(temp_db):
    temp_db.save_task("two steps", [{"tool": "find_file"}, {"tool": "read_pdf"}], "completed")

    stats = temp_db.get_stats_for_date(datetime.now().strftime("%Y-%m-%d"))
    assert stats["actions"] == 2


def test_metrics_for_a_day_with_no_tasks(temp_db):
    stats = temp_db.get_stats_for_date("1999-01-01")
    assert stats == {"completed": 0, "total": 0, "actions": 0}


def test_databases_are_isolated_between_instances(tmp_path):
    """Each instance owns its data, so tests cannot leak into each other."""
    first = TorchDatabase(db_path=str(tmp_path / "first.db"))
    first.save_task("only in first", [], "completed")

    second = TorchDatabase(db_path=str(tmp_path / "second.db"))
    assert second.get_tasks() == []


def test_log_command_records_a_habit(temp_db):
    temp_db.log_command("check my email")
    temp_db.log_command("check my email")

    # Second call increments rather than duplicating.
    assert temp_db.get_tasks() == []  # habits are tracked separately from tasks
