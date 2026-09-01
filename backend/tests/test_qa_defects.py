"""
Defects found by the release QA run.

Each of these was reproduced by hand against the running app before being
fixed, so the tests describe real behaviour rather than a guess at it.
"""

import inspect

import main
from agent import executor as executor_module
from tools.files import resolve_known_folder


# ─── D1: a folder request is answered with the folder ───


def test_spoken_folder_names_resolve_to_real_directories():
    """
    "find my downloads folder" ran a recursive search for a *file* named
    Downloads and returned Download.svelte from an unrelated project.
    """
    for spoken in ("downloads", "downloads folder", "my downloads folder", "Downloads"):
        resolved = resolve_known_folder(spoken)
        assert resolved is not None, spoken
        assert resolved.name == "Downloads"
        assert resolved.is_dir()


def test_other_common_folders_resolve():
    for spoken, expected in (("documents", "Documents"), ("desktop", "Desktop")):
        assert resolve_known_folder(spoken).name == expected


def test_a_real_filename_is_not_mistaken_for_a_folder():
    """Otherwise every search would be swallowed by the folder shortcut."""
    for spoken in ("invoice.pdf", "report", "notes.txt", ""):
        assert resolve_known_folder(spoken) is None


def test_an_unknown_word_is_not_invented_into_a_folder():
    assert resolve_known_folder("wombat") is None


def test_find_file_answers_a_folder_request_with_the_path():
    from tools.files import find_file

    result = find_file("downloads folder")

    assert "Downloads" in result
    assert "No files matching" not in result


# ─── D2: the recap cannot contradict its own body ───


def test_a_search_that_found_nothing_is_recognised():
    assert main._result_found_nothing("No exact match found for 'Downloads'.") is True
    assert main._result_found_nothing("Could not find that file") is True
    assert main._result_found_nothing("No results") is True


def test_a_real_find_is_not_read_as_empty():
    assert main._result_found_nothing("Found 3 file(s): C:/x/report.pdf") is False
    assert main._result_found_nothing("") is False


def test_the_recap_does_not_claim_a_find_when_nothing_was_found():
    """
    The recap was chosen from the tool that ran, so a search that found
    nothing still announced "I found the file." above a body saying it had
    not.
    """
    source = inspect.getsource(main.process_command)
    branch = source[source.index('elif "find_file" in tools_used') :]
    branch = branch[: branch.index('elif "search_web"')]

    assert "_result_found_nothing" in branch


# ─── D3: cancelling is a choice, not a failure ───


def test_cancelling_is_worded_as_a_choice():
    message = executor_module.CANCELLED_BY_USER

    assert "cancel" in message.lower()
    # Not framed as something going wrong.
    for blame in ("failed", "error", "couldn't", "could not", "went wrong"):
        assert blame not in message.lower()


def test_a_cancelled_step_is_marked_as_cancelled():
    """The recap needs to tell a decline apart from a genuine failure."""
    source = inspect.getsource(executor_module)

    assert 'step["cancelled"] = True' in source


def test_the_recap_reports_a_cancellation_rather_than_a_failure():
    source = inspect.getsource(main.process_command)

    assert 'any(s.get("cancelled") for s in failed_steps)' in source
    assert "Cancelled — nothing was sent." in source
    # And the cancellation branch is tested before the generic failure wording.
    assert source.index('any(s.get("cancelled")') < source.index("I couldn't finish that.")


# ─── An already-plain error is not translated twice ───


def test_a_translated_message_is_not_translated_again():
    """
    brain.py translates a planning failure, then the executor translated it a
    second time. The plain wording matched no marker, so a specific message
    ("the AI service is busy") was replaced by the generic fallback and that
    is what reached the user.
    """
    from errors.plain_language import translate_error

    plain = translate_error("503 UNAVAILABLE high demand")
    once = f"{plain['what_happened']} {plain['what_to_do']}"

    assert "busy" in once
    # Re-translating loses it, which is why the flag exists.
    assert "busy" not in translate_error(once)["what_happened"]


def test_the_planner_marks_its_errors_as_already_plain():
    import inspect
    from agent import brain

    assert '"error_is_plain": True' in inspect.getsource(brain)


def test_the_executor_skips_translation_when_marked():
    import inspect
    from agent import executor as executor_module

    source = inspect.getsource(executor_module)
    assert 'step.get("error_is_plain")' in source


def test_an_error_only_plan_does_not_announce_a_start():
    """"On it. The AI service is busy right now." announces a start and a
    failure in the same breath."""
    import inspect

    source = inspect.getsource(main.process_command)
    assert 'validated_steps[0].get("tool") == "error"' in source


# ─── Conversation goes to the model, not to a lookup table ───


def test_chit_chat_is_not_short_circuited_before_the_model():
    """
    Greetings used to return a fixed sentence without ever calling the model,
    so "hey" got the same words every time regardless of phrasing or of what
    had already been said. It read as a script because it was one.
    """
    import inspect
    from agent import brain

    source = inspect.getsource(brain.plan_command)
    canned_at = source.find("_canned_conversational_reply")
    provider_at = source.find("get_provider")

    assert canned_at != -1, "the offline fallback should still exist"
    assert provider_at != -1
    assert canned_at > provider_at, (
        "the canned reply must be a fallback after the provider call, "
        "not a short circuit before it"
    )


def test_the_offline_fallback_still_answers_a_greeting():
    """With no service reachable, a stock sentence beats an error message."""
    from agent.brain import _canned_conversational_reply

    assert _canned_conversational_reply("hey") is not None
    assert _canned_conversational_reply("thanks") is not None
    assert _canned_conversational_reply("delete my files") is None


def test_the_prompt_does_not_dictate_the_greeting_sentence():
    """
    The provider prompt carried the exact reply as its example, so even when
    the model did answer it parroted that sentence back.
    """
    import inspect
    from agent.providers import gemini_provider

    source = inspect.getsource(gemini_provider)
    assert "Hey! I'm TORCH, your AI agent. What can I help you with today?" not in source
    assert "<your reply>" in source


def test_temperature_allows_variation():
    """At 0.1 the same greeting came back word for word."""
    import inspect
    from agent.providers import gemini_provider

    source = inspect.getsource(gemini_provider)
    assert '"temperature": 0.6' in source
