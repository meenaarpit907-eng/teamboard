import { describe, expect, it } from "vitest";
import { clerkFrontendApiHost } from "@/lib/clerk-key";

function key(prefix: "pk_test_" | "pk_live_", host: string) {
  return prefix + Buffer.from(`${host}$`).toString("base64");
}

describe("clerkFrontendApiHost", () => {
  it("decodes development and production publishable keys", () => {
    expect(clerkFrontendApiHost(key("pk_test_", "happy-cat-12.clerk.accounts.dev"))).toBe(
      "happy-cat-12.clerk.accounts.dev",
    );
    expect(clerkFrontendApiHost(key("pk_live_", "clerk.arpit.me"))).toBe("clerk.arpit.me");
  });

  it("rejects missing, malformed and non-host values", () => {
    expect(clerkFrontendApiHost(undefined)).toBeNull();
    expect(clerkFrontendApiHost("")).toBeNull();
    expect(clerkFrontendApiHost("sk_test_abc")).toBeNull();
    expect(clerkFrontendApiHost(`pk_test_${Buffer.from("no-dollar.example.com").toString("base64")}`)).toBeNull();
    expect(clerkFrontendApiHost(key("pk_test_", "bad host; script-src *"))).toBeNull();
  });
});
