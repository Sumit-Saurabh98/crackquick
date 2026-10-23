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

    env = {"__name__": "__main__", "__builtins__": builtins, "found": found, "note": note, "label": label,
           "log": log, "print": log}
    old_limit = sys.getrecursionlimit()
    try:
        compiled = compile(code, FILE, "exec")
        sys.setrecursionlimit(max(old_limit, MAX_DEPTH + 200))
        sys.setprofile(prof)
        try:
            exec(compiled, env)
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
                       "error": error, "traced": traced})
`;
