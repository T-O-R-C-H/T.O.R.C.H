from agent.companion import _normalize_result


SCREENS = [
    {
        "width": 1280,
        "height": 720,
        "bounds": {"x": -1920, "y": 0, "width": 1920, "height": 1080},
    }
]


def test_normalize_maps_image_pixels_to_desktop_coordinates():
    result = _normalize_result(
        {
            "speech": "Open this.",
            "guidance": {
                "type": "point",
                "screen_index": 0,
                "box_2d": [450, 450, 550, 550],
                "label": "Open",
            },
        },
        SCREENS,
    )

    assert result["guidance"] == {"type": "point", "x": -960.0, "y": 540.0, "label": "Open"}


def test_normalize_rejects_malformed_guidance():
    result = _normalize_result(
        {"speech": "Nothing to point at.", "guidance": {"type": "point", "x": "bad"}},
        SCREENS,
    )

    assert result == {"speech": "Nothing to point at.", "guidance": {"type": "none"}}
