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
