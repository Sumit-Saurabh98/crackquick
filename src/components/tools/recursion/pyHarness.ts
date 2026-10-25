/* The Python tracer (run inside Pyodide). Kept as source text; String.raw keeps its backslashes. */
export const PY_HARNESS = String.raw`
# Traces the user's recursive functions for the recursion visualizer. Runs inside Pyodide; the
# result has the same shape as the JavaScript engine's RunResult (see engine.ts), as JSON.
import ast
import builtins
import json
import math
import re
import sys
import traceback

LIMIT = 3000
MAX_DEPTH = 800
FILE = "<user>"


class _Limit(Exception):
    pass


class TreeNode:
    """LeetCode's binary tree node (used when the code doesn't define its own)."""

    def __init__(self, val=0, left=None, right=None):
        self.val, self.left, self.right = val, left, right

    def __repr__(self):
        return f"TreeNode({self.val})"


class ListNode:
    """LeetCode's linked list node."""

    def __init__(self, val=0, next=None):
        self.val, self.next = val, next

    def __repr__(self):
        return f"ListNode({self.val})"


def _leetcode_names():
    """What LeetCode's Python environment has without imports."""
    import bisect, collections, functools, heapq, itertools, math, typing
    names = {n: getattr(typing, n) for n in ("List", "Optional", "Dict", "Set", "Tuple", "Deque", "DefaultDict")}
    names.update(deque=collections.deque, defaultdict=collections.defaultdict, Counter=collections.Counter,
                 heapq=heapq, math=math, bisect=bisect, functools=functools, itertools=itertools,
                 cache=functools.cache, lru_cache=functools.lru_cache, inf=math.inf,
                 TreeNode=TreeNode, ListNode=ListNode)
    return names


def _sample(ann, name):
    """Sample input for a parameter, from its annotation and name (nums, candidates, target, s, root…)."""
    a = (ann or "").replace(" ", "").replace("typing.", "")
    n = name.lower()
    ints = [2, 3, 6, 7] if ("cand" in n or "coin" in n) else [1, 2, 3]
    num = 7 if re.search("target|sum|amount|remain", n) else 2 if n in ("k", "m") else 4 if n == "n" else 3
    text = "23" if "digit" in n else "ABCB" if "word" in n else "aab" if (n == "s" or "str" in n or "text" in n) else "abc"
    board = [["A", "B", "C"], ["S", "F", "C"], ["A", "D", "E"]]
    tree = TreeNode(1, TreeNode(2, TreeNode(4)), TreeNode(3))
    linked = ListNode(1, ListNode(2, ListNode(3)))
    if "TreeNode" in a or (not a and n == "root"):
        return tree
    if "ListNode" in a or (not a and n == "head"):
        return linked
    if a in ("List[int]", "list[int]"):
        return ints
    if a in ("List[List[int]]", "list[list[int]]"):
        return [[1, 2], [3, 4]]
    if a in ("List[str]", "list[str]"):
        return ["a", "b", "c"]
    if a in ("List[List[str]]", "list[list[str]]"):
        return board
    if a == "str":
        return text
    if a == "float":
        return 1.0
    if a == "bool":
        return True
    if a == "int":
        return num
    if not a:
        if n in ("nums", "arr", "candidates", "coins", "heights", "prices", "nums1", "nums2"):
            return ints
        if n in ("s", "t", "digits", "word", "text", "p"):
            return text
        if n in ("board", "grid", "matrix"):
            return board
    return num


def _drive(cls, log):
    """Calls the Solution class's first public method with sample input, like LeetCode does."""
    import inspect
    name = next((k for k, v in cls.__dict__.items() if not k.startswith("_") and (callable(v) or isinstance(v, staticmethod))), None)
    if name is None:
        return None
    fn = getattr(cls, name)
    try:
        import annotationlib
        anns = annotationlib.get_annotations(fn, format=annotationlib.Format.STRING)
    except Exception:
        anns = {}
    params = [p for p in inspect.signature(fn).parameters if p not in ("self", "cls")]
    args = [_sample(anns.get(p), p) for p in params]
    shown = ", ".join(repr(a) for a in args)
    notice = (f"No call to your code, so it ran {cls.__name__}().{name}({shown}) with sample input, "
              "the way LeetCode would. Add a call at the bottom to use your own input.")
    result = getattr(cls(), name)(*args)
    if result is not None:
        log("Result:", result)
    return notice


def _recursive_names(code):
    """Functions whose body calls themselves, by name or as self.name / cls.name."""
    names = []
    for fn in ast.walk(ast.parse(code)):
        if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for node in ast.walk(fn):
            if not isinstance(node, ast.Call):
                continue
            f = node.func
            if (isinstance(f, ast.Name) and f.id == fn.name) or (isinstance(f, ast.Attribute) and f.attr == fn.name):
                if fn.name not in names:
                    names.append(fn.name)
                break
    return names


def _snap(v, d=0, seen=None):
    """A value as plain JSON, in the visualizer's Snap format."""
    if seen is None:
        seen = set()
    if v is None:
        return {"__r": "None"}
    if isinstance(v, bool):
        return {"__r": "True" if v else "False"}
    if isinstance(v, int):
        return v if abs(v) < 2**53 else {"__r": str(v)}
    if isinstance(v, float):
        return v if math.isfinite(v) else {"__r": repr(v)}
    if isinstance(v, str):
        return v
    if id(v) in seen:
        return {"__c": 1}
    if d > 6:
        return {"__x": 1}
    seen.add(id(v))
    try:
        if isinstance(v, list):
            return [_snap(x, d + 1, seen) for x in v[:200]]
        if isinstance(v, tuple):
            return {"__tuple": [_snap(x, d + 1, seen) for x in v[:200]]}
        if isinstance(v, (set, frozenset)):
            return {"__set": [_snap(x, d + 1, seen) for x in list(v)[:200]]}
        if isinstance(v, dict):
            return {"__dict": [[_snap(k, d + 1, seen), _snap(x, d + 1, seen)] for k, x in list(v.items())[:200]]}
        if callable(v):
            return {"__f": getattr(v, "__name__", "fn")}
        if hasattr(v, "val") and (hasattr(v, "left") or hasattr(v, "next")):
            return {"__r": f"node({v.val!r})"}
        return {"__r": repr(v)[:200]}
    finally:
        seen.discard(id(v))


def _text(args, sep=" "):
    return sep.join(a if isinstance(a, str) else str(a) for a in args)


def __rtv_run(code):
    m = re.search(r"#\s*@trace\s+([^\n]+)", code)
    error = None
    try:
        traced = [n for n in re.split(r"[\s,]+", m.group(1).strip()) if n] if m else _recursive_names(code)
    except SyntaxError:
        traced = []  # reported when compiling below
    traced_set = set(traced)

    root = dict(id=0, name="main", isMain=True, args=[], params=[], parent=-1, children=[], depth=0, edge=None,
                notes=[], found=False, enter=-1, exit=-1, hasRet=False, ret=None, threw=False, line=None)
    nodes, events, logs = [root], [], []
    stack, frames = [root], []
    st = {"pending": None, "used_found": False, "calls": 0}

    def prof(frame, event, arg):
        co = frame.f_code
        if co.co_filename != FILE or co.co_name not in traced_set:
            return
        if event == "call":
            if st["calls"] >= LIMIT:
                raise _Limit(f"Stopped after {LIMIT} calls. Try a smaller input.")
            if len(stack) > MAX_DEPTH:
                raise _Limit(f"Stopped at {MAX_DEPTH} levels deep. Check that your base case is reached.")
            st["calls"] += 1
            count = co.co_argcount + co.co_kwonlyargcount + (1 if co.co_flags & 4 else 0) + (1 if co.co_flags & 8 else 0)
            params = [p for p in co.co_varnames[:count] if p not in ("self", "cls")]
            loc = frame.f_locals
            back = frame.f_back
            parent = stack[-1]
            node = dict(id=len(nodes), name=co.co_name, isMain=False, args=[_snap(loc.get(p)) for p in params],
                        params=params, parent=parent["id"], children=[], depth=parent["depth"] + 1,
                        edge=st["pending"], notes=[], found=False, enter=len(events), exit=-1, hasRet=False,
                        ret=None, threw=False,
                        line=back.f_lineno if back is not None and back.f_code.co_filename == FILE else None)
            st["pending"] = None
            nodes.append(node)
            parent["children"].append(node["id"])
            events.append({"type": "call", "id": node["id"]})
            stack.append(node)
            frames.append(frame)
        elif event == "return" and frames and frames[-1] is frame:
            frames.pop()
            node = stack.pop()
            if arg is not None:
                node["hasRet"] = True
                node["ret"] = _snap(arg)
            node["exit"] = len(events)
            events.append({"type": "return", "id": node["id"]})

    def found(*a):
        n = stack[-1]
        n["found"] = True
        st["used_found"] = True
        if a:
            n["notes"].append(_text(a))

    def note(*a):
        stack[-1]["notes"].append(_text(a))

    def label(t):
        st["pending"] = str(t)

    def log(*a, sep=" ", end="\n", **_kw):
        logs.append({"step": len(events), "text": _text(a, sep)})

    env = {**_leetcode_names(), "__name__": "__main__", "__builtins__": builtins, "found": found, "note": note,
           "label": label, "log": log, "print": log}
    notice = None
    old_limit = sys.getrecursionlimit()
    try:
        compiled = compile(code, FILE, "exec")
        sys.setrecursionlimit(max(old_limit, MAX_DEPTH + 200))
        sys.setprofile(prof)
        try:
            exec(compiled, env)
            # LeetCode-style: a class that nothing calls (Solution, or else the first class defined in
            # the code). Call it, like LeetCode would.
            if not events:
                own = [v for v in env.values() if isinstance(v, type) and v.__module__ == "__main__"
                       and v not in (TreeNode, ListNode)]
                cls = env.get("Solution") if isinstance(env.get("Solution"), type) else (own[0] if own else None)
                if cls is not None:
                    notice = _drive(cls, log)
        finally:
            sys.setprofile(None)
    except _Limit as e:
        error = str(e)
    except SyntaxError as e:
        error = f"SyntaxError: {e.msg} (line {e.lineno})"
    except RecursionError:
        error = "RecursionError: too many nested calls. Check that your base case is reached."
    except BaseException as e:  # noqa: BLE001 - report anything the user's code raises
        where = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == FILE]
        error = f"{type(e).__name__}: {e}" + (f" (line {where[-1].lineno})" if where else "")
    finally:
        sys.setrecursionlimit(old_limit)
    for n in nodes:
        if n["exit"] == -1:
            n["exit"] = len(events)
    return json.dumps({"nodes": nodes, "events": events, "logs": logs, "usedFound": st["used_found"],
                       "error": error, "traced": traced, "notice": notice})
`;
