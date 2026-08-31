"""
Insights aggregation.

The Insights page previously showed invented figures - a hardcoded 87%
"accuracy", a fabricated weekly bar chart, and "4.2 hours saved". These tests
pin the replacement to real rows: every number must be derivable from the
task history, and anything the database cannot support must be absent rather
than estimated.
"""

import json
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import main
from memory.storage import TOOL_CATEGORIES


def _task(db, command, status, tools, created_at, duration_ms=1000):
    """Insert a task directly so created_at can be controlled."""
    steps = [{"tool": tool, "label": tool} for tool in tools]
    with db._connect() as conn:
        conn.execute(
            "INSERT INTO tasks (id, command, status, steps_json, duration_ms, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                f"{command}-{created_at}-{status}-{len(tools)}",
                command,
                status,
                json.dumps(steps),
                duration_ms,
                created_at,
            ),
        )


def _today(hour=12):
    return datetime.now().replace(hour=hour, minute=0, second=0).isoformat()


def _days_ago(days, hour=12):
    stamp = datetime.now().replace(hour=hour, minute=0, second=0) - timedelta(days=days)
    return stamp.isoformat()


# ─── Empty history says nothing rather than zero ───


def test_no_tasks_reports_no_rate_rather_than_zero(temp_db):
    """A success rate of 0% and "no tasks yet" are different claims."""
    result = temp_db.get_insights()

    assert result["total_tasks"] == 0
    assert result["success_rate"] is None
    assert result["avg_duration_ms"] is None
    assert result["categories"] == []


def test_empty_history_still_returns_a_full_week(temp_db):
    result = temp_db.get_insights(days=7)

    assert len(result["daily"]) == 7
    assert all(day["total"] == 0 for day in result["daily"])


# ─── Real counts ───


def test_success_rate_comes_from_task_status(temp_db):
    _task(temp_db, "a", "completed", ["find_file"], _today())
    _task(temp_db, "b", "completed", ["find_file"], _today())
    _task(temp_db, "c", "failed", ["find_file"], _today())
    _task(temp_db, "d", "failed", ["find_file"], _today())

    result = temp_db.get_insights()

    assert result["total_tasks"] == 4
    assert result["completed_tasks"] == 2
    assert result["success_rate"] == 50


def test_daily_buckets_land_on_the_right_day(temp_db):
    _task(temp_db, "today", "completed", ["find_file"], _today())
    _task(temp_db, "yesterday", "failed", ["find_file"], _days_ago(1))

    daily = temp_db.get_insights(days=7)["daily"]

    assert daily[-1]["total"] == 1 and daily[-1]["completed"] == 1
    assert daily[-2]["total"] == 1 and daily[-2]["completed"] == 0
    assert sum(day["total"] for day in daily) == 2


def test_tasks_outside_the_window_are_excluded(temp_db):
    _task(temp_db, "old", "completed", ["find_file"], _days_ago(40))
    _task(temp_db, "recent", "completed", ["find_file"], _today())

    result = temp_db.get_insights(days=7)

    assert result["total_tasks"] == 1


def test_categories_group_tools_by_what_the_user_was_doing(temp_db):
    _task(temp_db, "mail", "completed", ["send_email", "read_inbox"], _today())
    _task(temp_db, "files", "completed", ["find_file"], _today())

    categories = {c["label"]: c["count"] for c in temp_db.get_insights()["categories"]}

    assert categories == {"Email": 2, "Files": 1}


def test_categories_are_ordered_by_count(temp_db):
    _task(temp_db, "files", "completed", ["find_file", "read_pdf", "move_file"], _today())
    _task(temp_db, "mail", "completed", ["send_email"], _today())

    labels = [c["label"] for c in temp_db.get_insights()["categories"]]

    assert labels == ["Files", "Email"]


def test_step_count_and_duration_come_from_the_rows(temp_db):
    _task(temp_db, "a", "completed", ["find_file", "read_pdf"], _today(), duration_ms=1000)
    _task(temp_db, "b", "completed", ["send_email"], _today(), duration_ms=3000)

    result = temp_db.get_insights()

    assert result["total_steps"] == 3
    assert result["avg_duration_ms"] == 2000


def test_zero_durations_do_not_drag_the_average_down(temp_db):
    """An unrecorded duration is unknown, not instant."""
    _task(temp_db, "timed", "completed", ["find_file"], _today(), duration_ms=2000)
    _task(temp_db, "untimed", "completed", ["find_file"], _today(), duration_ms=0)

    assert temp_db.get_insights()["avg_duration_ms"] == 2000


# ─── Malformed rows must not take the page down ───


def test_unparseable_steps_are_skipped(temp_db):
    with temp_db._connect() as conn:
        conn.execute(
            "INSERT INTO tasks (id, command, status, steps_json, duration_ms, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("broken", "x", "completed", "{not json", 0, _today()),
        )

    result = temp_db.get_insights()

    assert result["total_tasks"] == 1
    assert result["total_steps"] == 0


def test_unknown_tools_are_not_invented_into_a_category(temp_db):
    _task(temp_db, "odd", "completed", ["respond", "error", "not_a_real_tool"], _today())

    assert temp_db.get_insights()["categories"] == []


# ─── No fabricated metrics ───


def test_no_accuracy_or_time_saved_is_reported(temp_db):
    """
    Nothing in TORCH measures accuracy or hours saved. If a future change adds
    these keys, it is inventing them.
    """
    result = temp_db.get_insights()

    for invented in ("accuracy", "time_saved", "time_saved_hours", "automation"):
        assert invented not in result


def test_every_categorised_tool_is_a_real_tool():
    """A category for a tool that cannot run would be a phantom slice."""
    from agent.planner import VALID_TOOLS

    assert set(TOOL_CATEGORIES) <= VALID_TOOLS


# ─── The endpoint, not just the query ───
#
# The first version of the route referred to a name that did not exist in
# main's namespace. Every test above passed, because they all called storage
# directly - the page showed its error state and nothing else noticed.


@pytest.fixture
def client():
    return TestClient(main.app)


def test_endpoint_returns_the_aggregate(client, auth_headers):
    response = client.get("/api/insights", headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    for key in ("daily", "total_tasks", "success_rate", "categories", "total_steps"):
        assert key in body


def test_endpoint_requires_a_session_token(client):
    assert client.get("/api/insights").status_code == 401


def test_endpoint_clamps_an_absurd_window(client, auth_headers):
    """`days` arrives from the query string, so it is attacker-controlled."""
    assert client.get("/api/insights?days=99999", headers=auth_headers).json()["days"] == 30
    assert client.get("/api/insights?days=-5", headers=auth_headers).json()["days"] == 1


def test_endpoint_rejects_a_non_numeric_window(client, auth_headers):
    assert client.get("/api/insights?days=lots", headers=auth_headers).status_code == 422


# ─── Durations are recorded at all ───
#
# save_task has always accepted duration_ms, but every call site omitted it,
# so all 315 rows in the development database held 0 and "Average time" could
# only ever show a dash.


def test_elapsed_ms_measures_from_a_monotonic_reading():
    import time as time_module

    start = time_module.monotonic() - 1.5
    elapsed = main._elapsed_ms(start)

    assert 1400 <= elapsed <= 1700


def test_elapsed_ms_never_reports_negative_time():
    assert main._elapsed_ms(main.time.monotonic() + 5) == 0


def test_every_save_task_call_records_a_duration():
    """
    A task saved without a duration is indistinguishable from an instant one,
    and drags the reported average toward zero.
    """
    import inspect
    import re

    source = inspect.getsource(main.process_command)
    calls = re.findall(r"db\.save_task\((.*?)\)\n", source, re.DOTALL)

    assert calls, "expected process_command to save tasks"
    for call in calls:
        assert "_elapsed_ms" in call, f"save_task call without a duration: {call.strip()}"
