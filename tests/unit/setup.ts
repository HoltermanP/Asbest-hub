import "dotenv/config";
import { vi } from "vitest";

// "server-only" is a Next.js marker package; make it a no-op in unit tests.
vi.mock("server-only", () => ({}));
