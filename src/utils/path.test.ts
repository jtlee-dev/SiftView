import { describe, it, expect } from "vitest";
import { basename, getExtension } from "./path";

describe("basename", () => {
  it("returns filename from path with forward slashes", () => {
    expect(basename("/some/dir/myfile.txt")).toBe("myfile.txt");
  });

  it("returns filename from path with backslashes", () => {
    expect(basename("C:\\Users\\doc\\file.json")).toBe("file.json");
  });

  it("returns full string when no path separator", () => {
    expect(basename("single")).toBe("single");
  });

  it("returns last segment when multiple slashes", () => {
    expect(basename("a/b/c")).toBe("c");
  });
});

describe("getExtension", () => {
  it("returns extension from path with forward slashes", () => {
    expect(getExtension("/some/dir/myfile.json")).toBe("json");
  });

  it("returns extension in lowercase", () => {
    expect(getExtension("file.JSON")).toBe("json");
  });

  it("returns empty string when no extension", () => {
    expect(getExtension("/path/noext")).toBe("");
  });

  it("returns last extension when multiple dots", () => {
    expect(getExtension("archive.tar.gz")).toBe("gz");
  });
});
