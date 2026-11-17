import { describe, expect, it } from "vitest";
import { extrasFromScript, fmtTime, parseDuration, readTime, spokenText, targetFor, wordsToTarget } from "@/lib/readtime";

const SCRIPT = `# Title
## Hook
Why does the taka keep falling? [S1] [CHECK: rate]
▸ Map of the Gulf
▸ Clip: Governor's press conference (0:20)

## The money
Remittances keep the country afloat, ${"word ".repeat(140)}
▸ B-roll of Motijheel 15s

## Sources
1. Something long that should not count at all whatsoever`;

describe("read time", () => {
  it("counts only spoken words", () => {
    const t = spokenText(SCRIPT);
    expect(t).not.toMatch(/S1|CHECK|Map of|Sources|Something/);
    expect(t.startsWith("Why does the taka keep falling?")).toBe(true);
  });

  it("parses durations and finds timed clips in on-screen notes", () => {
    expect(parseDuration("0:45")).toBe(45);
    expect(parseDuration("1:05")).toBe(65);
    expect(parseDuration("20s")).toBe(20);
    expect(parseDuration("2 min")).toBe(120);
    expect(parseDuration("1m30s")).toBe(90);
    expect(extrasFromScript(SCRIPT).map((e) => e.seconds)).toEqual([20, 15]);
  });

  it("adds speech at your pace, clips and beats, and checks the Shorts limit", () => {
    const rt = readTime(SCRIPT, 150, [{ label: "Intro music", seconds: 5 }]);
    expect(rt.words).toBe(151);
    expect(rt.speechSec).toBe(60);
    expect(rt.extrasSec).toBe(40);
    expect(rt.totalSec).toBe(rt.speechSec + rt.extrasSec + rt.pausesSec);
    const t = targetFor("short")!;
    expect(t.max).toBe(180);
    expect(wordsToTarget(rt, 150, t).cut).toBe(0);
    const long = readTime(SCRIPT + "\n## More\n" + "talk ".repeat(400), 150);
    expect(wordsToTarget(long, 150, t).cut).toBeGreaterThan(0);
    expect(targetFor("video", "8–12 min")).toMatchObject({ min: 480, max: 720 });
    expect(fmtTime(185)).toBe("3:05");
  });
});
