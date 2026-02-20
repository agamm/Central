import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock @tauri-apps/api/core (invoke)
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/api/event (listen)
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}));

// Mock @tauri-apps/plugin-notification
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(() => Promise.resolve(true)),
  requestPermission: vi.fn(() => Promise.resolve("granted")),
  sendNotification: vi.fn(),
}));

// Mock @tauri-apps/plugin-sql
const mockExecute = vi.fn(() =>
  Promise.resolve({ rowsAffected: 1, lastInsertId: 0 }),
);
const mockSelect = vi.fn(
  (): Promise<Record<string, unknown>[]> => Promise.resolve([]),
);

const mockDbInstance = {
  execute: mockExecute,
  select: mockSelect,
  close: vi.fn(),
};

vi.mock("@tauri-apps/plugin-sql", () => {
  const MockDatabase = {
    get: vi.fn(() => mockDbInstance),
    load: vi.fn(() => Promise.resolve(mockDbInstance)),
  };
  return { default: MockDatabase };
});

// Export mock references for test files to use
export { mockExecute, mockSelect, mockDbInstance };
