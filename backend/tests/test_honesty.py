"""
Claims the UI and tools make about what TORCH did.

Each of these covers a surface that previously reported an action it never
performed. The agent runs on a non-technical user's real machine, so a false
claim is worse than a missing feature: the user believes the post went out, or
that a permission they switched off is being honoured.
"""

import inspect

import pytest

from agent.planner import CAPABILITY_REFUSALS, validate_plan
from agent.step_phrasing import get_plain_phrase
from config.settings import settings
from tools import social


def _plan(tool, args=None):
    return validate_plan([{"tool": tool, "label": "", "args": args or {}}])[0]


# ─── Social tools never claim to have posted ───


@pytest.mark.parametrize("tool", ["post_social", "send_message"])
def test_social_step_phrasing_does_not_claim_completion(tool):
    """The completed label is shown after the step succeeds, so it must not
    say the message went out - the tool only opens the site."""
    done = get_plain_phrase(tool, {}, "done").lower()
    for claim in ["posted to", "sent your message", "published"]:
        assert claim not in done
    assert "open" in done


@pytest.mark.parametrize("tool", ["post_social", "send_message"])
def test_social_source_has_no_success_language(tool):
    source = inspect.getsource(getattr(social, tool))
    for claim in ["Successfully opened", "Ready to post", "Sent your message"]:
        assert claim not in source


def test_social_docstrings_state_the_limitation():
    for tool in ["post_social", "send_message"]:
        doc = (getattr(social, tool).__doc__ or "").lower()
        assert "does not" in doc or "themselves" in doc


# ─── Onboarding permissions actually block tools ───


@pytest.fixture
def permissions(monkeypatch):
    """Capability switches, restored after each test."""

    def set_permissions(files=True, apps=True, email=True):
        monkeypatch.setattr(settings, "allow_files", files)
        monkeypatch.setattr(settings, "allow_apps", apps)
        monkeypatch.setattr(settings, "allow_email", email)

    return set_permissions


def test_tools_pass_through_when_everything_is_allowed(permissions):
    permissions()
    for tool in ["find_file", "open_app", "send_email"]:
        assert _plan(tool)["tool"] == tool


@pytest.mark.parametrize(
    "capability,blocked,still_allowed",
    [
        ("files", "find_file", "open_app"),
        ("apps", "open_app", "find_file"),
        ("email", "send_email", "find_file"),
    ],
)
def test_disabling_a_capability_blocks_only_its_tools(
    permissions, capability, blocked, still_allowed
):
    permissions(**{capability: False})

    blocked_step = _plan(blocked)
    assert blocked_step["tool"] == "error"
    assert blocked_step["error"] == CAPABILITY_REFUSALS[capability]

    assert _plan(still_allowed)["tool"] == still_allowed


def test_refusal_is_plain_language(permissions):
    permissions(files=False)
    message = _plan("find_file")["error"]
    assert "Settings" in message
    for jargon in ["allow_files", "capability", "None", "Traceback"]:
        assert jargon not in message


def test_disabled_capability_is_not_merely_an_approval_prompt(permissions):
    """A switched-off capability must stop the tool, not ask to approve it."""
    permissions(email=False)
    step = _plan("send_email")
    assert step["tool"] == "error"
    assert step["requires_approval"] is False
