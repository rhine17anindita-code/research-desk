import { describe, expect, it } from "vitest";
import { assertPublicUrl, isPrivateIp } from "@/lib/net";
import { isPublicHttpUrl } from "@/lib/ideation/metadata";

describe("outbound requests stay on the public internet", () => {
  it("spots private, loopback, link-local and mapped addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.1.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) expect(isPrivateIp(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
  it("refuses private hosts and odd schemes", async () => {
    for (const u of ["http://localhost:3000", "http://169.254.169.254/latest", "http://[::ffff:127.0.0.1]/", "file:///etc/passwd", "http://foo.local/", "http://localhost./"]) await expect(assertPublicUrl(u), u).rejects.toThrow();
    await expect(assertPublicUrl("https://example.com/x")).resolves.toBeTruthy();
    expect(isPublicHttpUrl("http://[::]/")).toBe(false);
    expect(isPublicHttpUrl("http://localhost./")).toBe(false);
    expect(isPublicHttpUrl("https://www.thedailystar.net/news")).toBe(true);
  });
});
