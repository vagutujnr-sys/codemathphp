import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { currentSession, getCurrentUser, loginWithPin, logout } from "@/lib/invoicing-api";

const sessionKey = "codemath-invoicing-session";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function session(accessToken = "access-token", refreshToken = "refresh-token") {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 3600,
    user: { id: "profile-id" },
  };
}

function createStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => entries.delete(key),
    setItem: (key, value) => entries.set(key, String(value)),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createStorage());
  vi.stubGlobal("sessionStorage", createStorage());
});

afterEach(() => {
  logout();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("invoicing session persistence", () => {
  it("persists PIN login in browser storage", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ session: session() })));

    await loginWithPin("123456");

    expect(JSON.parse(localStorage.getItem(sessionKey) ?? "null")).toMatchObject({
      access_token: "access-token",
      refresh_token: "refresh-token",
      user: { id: "profile-id" },
    });
    expect(currentSession()?.user.id).toBe("profile-id");
    expect(sessionStorage.getItem(sessionKey)).toBeNull();
  });

  it("migrates an existing session-storage login to persistent browser storage", () => {
    sessionStorage.setItem(sessionKey, JSON.stringify({ ...session(), acquired_at: Date.now() }));

    expect(currentSession()?.user.id).toBe("profile-id");
    expect(localStorage.getItem(sessionKey)).not.toBeNull();
    expect(sessionStorage.getItem(sessionKey)).toBeNull();
  });

  it("refreshes an expired access token instead of logging the account out", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    localStorage.setItem(
      sessionKey,
      JSON.stringify({
        ...session(),
        acquired_at: Date.now() - 3_600_000,
      }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(session("refreshed-access-token", "rotated-refresh-token")))
      .mockResolvedValueOnce(
        response([{ id: "profile-id", display_name: "Admin", role: "admin", client_id: null }]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const account = await getCurrentUser();

    expect(account.role).toBe("admin");
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://project.supabase.co/auth/v1/token?grant_type=refresh_token",
    );
    expect(JSON.parse(localStorage.getItem(sessionKey) ?? "null")).toMatchObject({
      access_token: "refreshed-access-token",
      refresh_token: "rotated-refresh-token",
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer refreshed-access-token" }),
    });
  });

  it("keeps the saved session when a temporary refresh error occurs", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    localStorage.setItem(
      sessionKey,
      JSON.stringify({
        ...session(),
        acquired_at: Date.now() - 3_600_000,
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(response({ message: "Unavailable" }, 503)),
    );

    await expect(getCurrentUser()).rejects.toThrow("Unavailable");
    expect(localStorage.getItem(sessionKey)).not.toBeNull();
  });
});
