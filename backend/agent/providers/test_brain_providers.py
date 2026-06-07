import sys
import os
import asyncio

# Add backend directory to sys.path
sys.path.insert(0, "/Users/ebukasmac/Desktop/Personal_Projects/Collabs/T.O.R.C.H/backend")

from config.settings import settings
from agent.brain import plan_command
from agent.providers import get_provider
from agent.providers.gemini_provider import GeminiProvider
from agent.providers.openai_provider import OpenAIProvider
from agent.providers.anthropic_provider import AnthropicProvider

async def test_providers():
    print("--- Testing LLM Provider Abstraction ---")
    
    # Save current settings to restore later
    orig_gemini_key = settings.gemini_api_key
    orig_openai_key = settings.openai_api_key
    orig_anthropic_key = settings.anthropic_api_key

    try:
        # Case 1: No API Keys configured
        settings.gemini_api_key = ""
        settings.openai_api_key = ""
        settings.anthropic_api_key = ""
        
        provider = get_provider()
        assert provider is None, f"Expected None provider, got {provider}"
        print("[PASS] get_provider() returns None when no keys set.")

        res = await plan_command("Find Sales.pdf")
        assert len(res) == 1
        assert res[0]["tool"] == "error"
        assert "No AI provider configured" in res[0]["label"]
        print("[PASS] plan_command returns error step when no keys configured.")

        # Case 2: OpenAI Key configured (Switching provider)
        settings.openai_api_key = "dummy_openai_key"
        provider = get_provider()
        assert isinstance(provider, OpenAIProvider), f"Expected OpenAIProvider, got {type(provider)}"
        print("[PASS] get_provider() returns OpenAIProvider when only OpenAI key is set.")

        res = await plan_command("Find Sales.pdf")
        assert len(res) == 1
        assert res[0]["tool"] == "error"
        assert "Selected provider not implemented" in res[0]["label"]
        assert "OpenAI provider is not yet implemented" in res[0]["error"]
        print("[PASS] plan_command returns error step when OpenAIProvider throws NotImplementedError.")

        # Case 3: Anthropic Key configured (Switching provider)
        settings.openai_api_key = ""
        settings.anthropic_api_key = "dummy_anthropic_key"
        provider = get_provider()
        assert isinstance(provider, AnthropicProvider), f"Expected AnthropicProvider, got {type(provider)}"
        print("[PASS] get_provider() returns AnthropicProvider when only Anthropic key is set.")

        res = await plan_command("Find Sales.pdf")
        assert len(res) == 1
        assert res[0]["tool"] == "error"
        assert "Selected provider not implemented" in res[0]["label"]
        assert "Anthropic provider is not yet implemented" in res[0]["error"]
        print("[PASS] plan_command returns error step when AnthropicProvider throws NotImplementedError.")

        # Case 4: Gemini Key configured (Success / Original behavior)
        if orig_gemini_key:
            print(f"Original Gemini Key found. Testing GeminiProvider E2E...")
            settings.gemini_api_key = orig_gemini_key
            settings.anthropic_api_key = ""
            provider = get_provider()
            assert isinstance(provider, GeminiProvider), f"Expected GeminiProvider, got {type(provider)}"
            print("[PASS] get_provider() returns GeminiProvider when Gemini key is set.")

            # Make a real call
            res = await plan_command("Find Sales.pdf in Documents")
            print(f"Gemini output: {res}")
            assert len(res) > 0
            assert any(step.get("tool") == "find_file" for step in res), "Expected a find_file step in the plan"
            print("[PASS] Gemini planning works end-to-end exactly as before.")
        else:
            print("[SKIP] Skipping real Gemini Provider E2E test (no GEMINI_API_KEY in environment).")

    finally:
        # Restore settings
        settings.gemini_api_key = orig_gemini_key
        settings.openai_api_key = orig_openai_key
        settings.anthropic_api_key = orig_anthropic_key

if __name__ == "__main__":
    asyncio.run(test_providers())

