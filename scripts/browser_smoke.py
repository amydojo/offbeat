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
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
        )
        try:
            context = browser.new_context(permissions=["microphone"], viewport={"width": 1200, "height": 900})
            page = context.new_page()
            page.set_default_timeout(45000)
            failures = []
            page.on("pageerror", lambda error: failures.append(str(error)))
            outgoing = []
            page.on("request", lambda request: outgoing.append(request.url) if request.url.startswith(("https://", "http://")) and not request.url.startswith(("http://127.0.0.1:5173/", "http://127.0.0.1:8765/")) else None)
            page.goto("http://127.0.0.1:5173", wait_until="networkidle")
            expect(page.get_by_role("heading", name="Hear what your hands remembered.")).to_be_visible()

            fields = page.locator('input[type="file"]')
            fields.nth(0).set_input_files({"name": "bass-reference.wav", "mimeType": "audio/wav", "buffer": synthetic_bass()})
            fields.nth(1).set_input_files({"name": "bass-take.wav", "mimeType": "audio/wav", "buffer": synthetic_bass(1.25)})
            page.get_by_role("button", name="Analyze shape").first.click()
            expect(page.get_by_role("button", name="Analyze again")).to_have_count(1, timeout=90000)
            page.get_by_role("button", name="Analyze shape").click()
            expect(page.get_by_role("button", name="Analyze again")).to_have_count(2, timeout=90000)

            page.get_by_role("button", name="Compare these phrases").click()
            expect(page.get_by_text("temporally corresponding attacks", exact=False)).to_be_visible(timeout=15000)
            expect(page.get_by_label("Align the shapes")).to_be_checked()
            page.get_by_label("Align the shapes").uncheck()
            expect(page.get_by_label("Align the shapes")).not_to_be_checked()
            page.get_by_label("Align the shapes").check()

            start = page.get_by_role("slider", name="Phrase start")
            start.focus()
            start.press("ArrowRight")
            assert float(start.input_value()) > 0
            page.get_by_role("button", name="A / B · Alternate").click()
            expect(page.get_by_role("button", name="■ Stop")).to_be_enabled()
            # Ensure the selected source actually alternates, not merely starts.
            expect(page.get_by_text("Your take ·", exact=False)).to_be_visible(timeout=18000)
            page.get_by_role("button", name="■ Stop").click()

            page.get_by_placeholder("That riff with the long pause").fill("Synthetic bass groove")
            page.get_by_role("button", name="Keep this phrase").click()
            expect(page.get_by_text("Synthetic bass groove", exact=True)).to_be_visible()
            page.reload(wait_until="networkidle")
            expect(page.get_by_text("Synthetic bass groove", exact=True)).to_be_visible()
            page.get_by_role("button", name="Open", exact=True).click()
            expect(page.get_by_role("button", name="Analyze again")).to_have_count(2)
            page.get_by_role("button", name="Delete", exact=True).click()
            expect(page.get_by_text("Synthetic bass groove", exact=True)).to_have_count(0)
            # Removing a saved session also drops its currently-opened in-memory copy.
            expect(page.get_by_role("button", name="Analyze again")).to_have_count(0)

            # This is browser emulation only; the user's actual Mac device must be tested manually.
            page.get_by_role("button", name="Record bass").click()
            expect(page.get_by_role("button", name="Stop recording")).to_be_visible(timeout=20000)
            time.sleep(1)
            page.get_by_role("button", name="Stop recording").click()
            expect(page.get_by_text("offbeat-take-", exact=False)).to_be_visible(timeout=20000)

            assert not outgoing, f"Unexpected outbound browser requests: {outgoing}"
            assert not failures, f"Browser JavaScript exceptions: {failures}"
            print("PASS: import, analyze, aligned comparison, keyboard selection, A/B, IndexedDB reopen/delete, fake mic")
        finally:
            browser.close()


if __name__ == "__main__":
    run()
