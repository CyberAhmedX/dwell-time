import { describe, it, expect } from "vitest";
import { runLine, complete } from "../src/engine/shell";
import { sha256 } from "../src/engine/sha256";

const files = {
  "auth.log": [
    "09:00 198.51.100.23 alice Success",
    "09:01 203.0.113.77 bob Failed",
    "09:02 203.0.113.77 carol Failed",
    "09:02 203.0.113.77 dave Success",
    "09:05 198.51.100.23 alice Success",
  ].join("\n") + "\n",
  "conn.tsv": "a\tb\tc\nd\te\tf\n",
  "note.txt": "aGVsbG8gaGFybm9y\n",
};
const out = (line: string): string => runLine(line, files).out;

describe("sha256", () => {
  it("matches the standard test vectors", () => {
    expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
    expect(sha256("a".repeat(1000))).toBe("41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
  });
});

describe("shell", () => {
  it("lists and prints files", () => {
    expect(out("ls")).toBe("auth.log  conn.tsv  note.txt");
    expect(out("cat note.txt")).toBe("aGVsbG8gaGFybm9y");
    expect(out("head -n 2 auth.log").split("\n")).toHaveLength(2);
    expect(out("head -2 auth.log").split("\n")).toHaveLength(2);
    expect(out("tail -n 1 auth.log")).toBe("09:05 198.51.100.23 alice Success");
  });

  it("greps like grep", () => {
    expect(out("grep 203.0.113.77 auth.log").split("\n")).toHaveLength(3);
    expect(out("grep -c Failed auth.log")).toBe("2");
    expect(out("grep -v Failed auth.log").split("\n")).toHaveLength(3);
    expect(out("grep -i SUCCESS auth.log").split("\n")).toHaveLength(3);
    expect(out("grep -n dave auth.log")).toBe("4:09:02 203.0.113.77 dave Success");
    expect(out("grep -o '203[.]0[.]113[.][0-9]*' auth.log | sort -u")).toBe("203.0.113.77");
    expect(out("grep -E 'bob|carol' auth.log").split("\n")).toHaveLength(2);
    // in basic grep, | is a plain character
    expect(out("grep 'bob|carol' auth.log")).toBe("");
  });

  it("pipes count things the way analysts do", () => {
    expect(out("awk '{print $2}' auth.log | sort | uniq -c | sort -rn")).toBe("      3 203.0.113.77\n      2 198.51.100.23");
    expect(out("cut -d ' ' -f2 auth.log | sort -u | wc -l")).toBe("2");
    expect(out("grep Success auth.log | awk '{print $NF, $3}'")).toBe("Success alice\nSuccess dave\nSuccess alice");
    expect(out("cut -f2- conn.tsv")).toBe("b\tc\ne\tf");
    expect(out("sort -k3 auth.log | head -n 1")).toBe("09:00 198.51.100.23 alice Success");
  });

  it("counts lines in a file the way wc does", () => {
    expect(out("wc -l auth.log")).toBe("5 auth.log");
    expect(out("cat auth.log | wc -l")).toBe("5");
  });

  it("decodes and hashes", () => {
    expect(out("base64 -d note.txt")).toBe("hello harnor");
    expect(out("echo hi | base64")).toBe("aGk=");
    expect(out("sha256sum note.txt")).toBe(`${sha256(files["note.txt"])}  note.txt`);
  });

  it("explains mistakes instead of failing silently", () => {
    expect(runLine("nmap 10.0.0.1", files)).toEqual({ out: expect.stringContaining("command not found"), error: true });
    expect(runLine("cat missing.log", files).out).toContain("No such file");
    expect(runLine("cat auth.log > copy.log", files).out).toContain("read-only");
    expect(runLine("grep 'unclosed auth.log", files).out).toContain("quote");
    expect(runLine("cat auth.log |", files).error).toBe(true);
    expect(runLine("grep -E '(' auth.log", files).out).toContain("invalid pattern");
  });

  it("keeps the screen readable on huge output", () => {
    const big = { "big.log": Array.from({ length: 1000 }, (_, i) => `line ${i}`).join("\n") };
    const r = runLine("cat big.log", big).out.split("\n");
    expect(r.length).toBe(401);
    expect(r[400]).toContain("600 more lines");
    // pipes still see all of it
    expect(runLine("cat big.log | wc -l", big).out).toBe("1000");
  });

  it("answers back in character", () => {
    expect(out("sudo cat auth.log")).toContain("sudoers");
    expect(out("cat packet")).toContain("Packet is a cat");
    expect(runLine("clear", files).clear).toBe(true);
  });

  it("completes commands and file names", () => {
    expect(complete("gr", files)).toEqual(["grep"]);
    expect(complete("cat au", files)).toEqual(["auth.log"]);
    expect(complete("cat auth.log | so", files)).toEqual(["sort"]);
  });
});
