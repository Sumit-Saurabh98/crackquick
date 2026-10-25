/**
 * Sample inputs for LeetCode-style code that has no main: chosen from each parameter's type and name,
 * the way the problems usually name them (nums, candidates, target, k, s, digits, board, root…).
 */

type Pick = { ints: string; num: string; str: string };

function pick(name: string): Pick {
  const n = name.toLowerCase();
  return {
    ints: /cand|coin/.test(n) ? "2, 3, 6, 7" : /height|price|cost/.test(n) ? "3, 1, 4, 2" : "1, 2, 3",
    num: /target|sum|amount|remain/.test(n) ? "7" : /^k$|^m$/.test(n) ? "2" : /^n$/.test(n) ? "4" : "3",
    str: /digit/.test(n) ? "23" : /^s$|str|text/.test(n) ? "aab" : /word/.test(n) ? "ABCB" : /pattern|^p$/.test(n) ? "a*" : "abc",
  };
}

const BOARD = (q: string) => `{${q}A${q}, ${q}B${q}, ${q}C${q}}, {${q}S${q}, ${q}F${q}, ${q}C${q}}, {${q}A${q}, ${q}D${q}, ${q}E${q}}`;
const GRID = (q: string) => `{${q}1${q}, ${q}1${q}, ${q}0${q}}, {${q}0${q}, ${q}1${q}, ${q}0${q}}, {${q}1${q}, ${q}0${q}, ${q}1${q}}`;

export const JAVA_NODES = {
  TreeNode:
    "class TreeNode { int val; TreeNode left, right; TreeNode() {} TreeNode(int val) { this.val = val; } TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; } }",
  ListNode: "class ListNode { int val; ListNode next; ListNode() {} ListNode(int val) { this.val = val; } ListNode(int val, ListNode next) { this.val = val; this.next = next; } }",
};

export const CPP_NODES = {
  TreeNode:
    "struct TreeNode { int val; TreeNode *left; TreeNode *right; TreeNode() : val(0), left(nullptr), right(nullptr) {} TreeNode(int x) : val(x), left(nullptr), right(nullptr) {} TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {} };",
  ListNode:
    "struct ListNode { int val; ListNode *next; ListNode() : val(0), next(nullptr) {} ListNode(int x) : val(x), next(nullptr) {} ListNode(int x, ListNode *next) : val(x), next(next) {} };",
};

/** A Java expression of type `type` (tree 1 → (2 → 4), 3; list 1 → 2 → 3). */
export function javaSample(type: string, name: string): string {
  const t = type.replace(/\s+/g, "");
  const p = pick(name);
  const board = /board|grid|matrix/.test(name.toLowerCase());
  switch (t) {
    case "int[]":
      return `new int[]{${p.ints}}`;
    case "long[]":
      return "new long[]{1, 2, 3}";
    case "char[]":
      return "new char[]{'a', 'b', 'c'}";
    case "String[]":
      return 'new String[]{"a", "b", "c"}';
    case "int[][]":
      return "new int[][]{{1, 2}, {3, 4}}";
    case "char[][]":
      return board && /grid/.test(name.toLowerCase()) ? `new char[][]{${GRID("'")}}` : `new char[][]{${BOARD("'")}}`;
    case "int":
    case "long":
    case "short":
    case "byte":
    case "Integer":
    case "Long":
      return p.num;
    case "double":
    case "Double":
      return "1.0";
    case "float":
      return "1.0f";
    case "boolean":
    case "Boolean":
      return "true";
    case "char":
    case "Character":
      return "'a'";
    case "String":
      return JSON.stringify(p.str);
    case "TreeNode":
      return "new TreeNode(1, new TreeNode(2, new TreeNode(4), null), new TreeNode(3))";
    case "ListNode":
      return "new ListNode(1, new ListNode(2, new ListNode(3)))";
  }
  if (/^(List|ArrayList|Collection)<Integer>$/.test(t)) return `new java.util.ArrayList<>(java.util.List.of(${p.ints}))`;
  if (/^(List|ArrayList)<String>$/.test(t)) return 'new java.util.ArrayList<>(java.util.List.of("a", "b", "c"))';
  if (/^(List|ArrayList|LinkedList)</.test(t)) return "new java.util.ArrayList<>()";
  if (/^(Set|HashSet)</.test(t)) return "new java.util.HashSet<>()";
  if (/^(Map|HashMap)</.test(t)) return "new java.util.HashMap<>()";
  return "null";
}

/** A C++ initializer for `type` (used as `T x = …;`). */
export function cppSample(type: string, name: string): string {
  const t = type.replace(/\bconst\b|&/g, "").replace(/\bstd::/g, "").replace(/\s+/g, "");
  const p = pick(name);
  const n = name.toLowerCase();
  if (t === "vector<int>" || t === "vector<long>" || t === "vector<longlong>") return `{${p.ints}}`;
  if (t === "vector<vector<int>>") return "{{1, 2}, {3, 4}}";
  if (t === "vector<string>") return '{"a", "b", "c"}';
  if (t === "vector<char>") return "{'a', 'b', 'c'}";
  if (t === "vector<vector<char>>") return /grid/.test(n) ? `{${GRID("'")}}` : `{${BOARD("'")}}`;
  if (t === "vector<bool>") return "{true, false, true}";
  if (t === "string") return JSON.stringify(p.str);
  if (/^(unsigned)?(int|long|longlong|short|size_t)$/.test(t)) return p.num;
  if (t === "double" || t === "float") return "1.0";
  if (t === "bool") return "true";
  if (t === "char") return "'a'";
  if (t === "TreeNode*") return "new TreeNode(1, new TreeNode(2, new TreeNode(4), nullptr), new TreeNode(3))";
  if (t === "ListNode*") return "new ListNode(1, new ListNode(2, new ListNode(3)))";
  return "{}";
}

/** The type a C++ parameter is declared with, as a local variable (references and const dropped). */
export function cppLocalType(type: string) {
  return type.replace(/\bconst\b/g, "").replace(/&+/g, "").replace(/\s+/g, " ").trim();
}
