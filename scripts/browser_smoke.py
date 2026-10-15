"""Chromium end-to-end smoke: synthetic audio and fake microphone, never personal audio.

The Chrome fake-device test is not a substitute for physical Mac/Safari microphone QA.
"""
from __future__ import annotations

import io
import math
import struct
import time
import wave

from playwright.sync_api import sync_playwright, expect


def synthetic_bass(scale: float = 1.0) -> bytes:
    sr = 22050
    seconds = 3.0 * scale
    count = int(sr * seconds)
    out = io.BytesIO()
    with wave.open(out, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(sr)
        samples = []
        for i in range(count):
            t = i / sr / scale
            active = (0.15 < t < 0.68) or (0.88 < t < 1.48) or (1.84 < t < 2.37)
            hz = 82.4 if t < 1.5 else 110.0
            value = .34 * math.sin(2 * math.pi * hz * i / sr) if active else 0
            samples.append(struct.pack("<h", int(value * 32767)))
        audio.writeframes(b"".join(samples))
    return out.getvalue()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
                  "--autoplay-policy=no-user-gesture-required"],
        )
        try:
            context = browser.new_context(permissions=["microphone"], viewport={"width": 1200, "height": 900})
            page = context.new_page()
            page.set_default_timeout(45000)
            failures = []
            outgoing = []
            page.on("pageerror", lambda error: failures.append(str(error)))
            page.on("request", lambda request: outgoing.append(request.url) if request.url.startswith(
                ("https://","http://")) and not request.url.startswith(
                    ("http://127.0.0.1:5173/","http://127.0.0.1:8765/")) else None)
            page.goto("http://127.0.0.1:5173/", wait_until="networkidle")
            expect(page.get_by_role("heading", level=1)).to_contain_text("Catch what you hear.")
            reference = page.get_by_role("region", name="Reference audio")
            take = page.get_by_role("region", name="Your take audio")
            reference.locator('input[type=file]').set_input_files(
                {"name":"Bass sesh 2 pick.wav","mimeType":"audio/wav","buffer":synthetic_bass()})
            take.locator('input[type=file]').set_input_files(
                {"name":"Bass sesh 2 pluck.wav","mimeType":"audio/wav","buffer":synthetic_bass(1.25)})
            expect(page.locator(".clip-done")).to_have_count(2, timeout=90000)
            expect(take.get_by_role("heading", name="Pluck")).to_be_visible()
            expect(reference.get_by_role("heading", name="Pick")).to_be_visible()
            take.locator("details.clip-details").last.locator("summary").click()
            assert take.get_by_label("Your take source type").input_value() == "solo_bass"
            reference.locator("details.clip-details").last.locator("summary").click()
            assert reference.get_by_label("Reference source type").input_value() == "solo_bass"
            expect(page.locator(".quick-insight")).to_be_visible(timeout=15000)
            player=page.get_by_role("region", name="Phrase audition")
            player.get_by_role("button", name="Play A / B").click()
            expect(player.get_by_role("button", name="■ Stop")).to_be_enabled()
            expect(player.get_by_role("status")).to_contain_text("Pluck", timeout=15000)
            player.get_by_role("button", name="■ Stop").click()
            page.locator("details.compare-drawer > summary").click()
            expect(page.get_by_role("region", name="Musical comparison")).to_be_visible()
            expect(page.get_by_label("Align the shapes")).to_be_checked()
            slider = page.get_by_role("slider", name="Phrase start")
            slider.focus()
            slider.press("ArrowRight")
            assert float(slider.input_value()) > 0
            page.locator("details.feature-drawer > summary").click()
            groove=page.get_by_role("region", name="Responsive drummer")
            expect(groove.get_by_role("button", name="Follow")).to_be_visible()
            groove.get_by_role("button", name="Answer").click()
            groove.get_by_role("button", name="Follow").click()
            groove.get_by_role("button", name="Play with drums").click()
            expect(groove.get_by_role("button", name="Stop groove")).to_be_visible(timeout=12000)
            groove.get_by_role("button", name="Stop groove").click()
            page.get_by_placeholder("Name this idea…").fill("Pick / Pluck")
            page.get_by_role("button", name="Keep this phrase").click()
            page.locator("details.saved-drawer > summary").click()
            expect(page.get_by_text("Pick / Pluck", exact=True)).to_be_visible(timeout=12000)
            page.reload(wait_until="networkidle")
            page.locator("details.saved-drawer > summary").click()
            expect(page.get_by_text("Pick / Pluck", exact=True)).to_be_visible()
            page.get_by_role("button", name="Open", exact=True).click()
            expect(page.locator(".clip-done")).to_have_count(2)
            page.once("dialog", lambda dialog: dialog.dismiss())
            page.get_by_role("button", name="Delete", exact=True).click()
            expect(page.get_by_text("Pick / Pluck", exact=True)).to_be_visible()
            page.once("dialog", lambda dialog: dialog.accept())
            page.get_by_role("button", name="Delete", exact=True).click()
            expect(page.get_by_text("Pick / Pluck", exact=True)).to_have_count(0)
            if not page.locator("details.record-tray").evaluate("(node)=>node.open"):
                page.locator("details.record-tray > summary").click()
            page.get_by_role("button", name="Record or hum").click()
            expect(page.get_by_role("button", name="Stop recording")).to_be_visible(timeout=15000)
            time.sleep(1)
            page.get_by_role("button", name="Stop recording").click()
            expect(take.get_by_text("offbeat-take-", exact=False)).to_be_visible(timeout=20000)
            expect(take.locator(".clip-done")).to_be_visible(timeout=60000)
            assert not outgoing, f"Unexpected outgoing requests: {outgoing}"
            assert not failures, f"Browser exceptions: {failures}"
            print("PASS: auto-import, bass typing, pick/pluck A/B, expanded tools, save/reload/delete, mic")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
