import { applyEdits, findFunctions, isRecursive, mask, returnsIn, type Edit, type FnDef } from "./scan";
import { LIMIT, MAX_DEPTH, MARK } from "./protocol";

/**
 * C++ support. Recursive functions (and recursive lambdas) open with an `__rtv::Scope` that records
 * the call and, when destroyed, the return; `return x;` becomes `return __rtv::R(x);`. Statements
 * that call a traced function are prefixed with `__rtv::L(line);` so the call's source line is
 * known. Everything stays on its original line, and the runtime below goes before the code with a
 * `#line 1` after it, so line numbers in errors match the user's code.
 */

const ESC = MARK.replace("\u0001", "\\x01");

export const CPP_RUNTIME = String.raw`#pragma once
#include <bits/stdc++.h>
namespace __rtv {
inline int calls = 0, depth = 0, line = -1;
inline bool has_pending = false;
inline std::string pending;
// Flushed every time, so a crash (segfault, abort) still leaves the calls made up to that point.
inline void emit(const std::string& s) { std::cout << "${ESC}" << s << "\n" << std::flush; }
inline std::string q(std::string_view s) {
  std::string o = "\"";
  for (unsigned char c : s) {
    if (c == '"' || c == '\\') { o += '\\'; o += (char)c; }
    else if (c < 32) { char b[8]; std::snprintf(b, sizeof b, "\\u%04x", c); o += b; }
    else o += (char)c;
  }
  return o + "\"";
}
inline std::string raw(const std::string& s) { return "{\"__r\":" + q(s.size() > 200 ? s.substr(0, 200) : s) + "}"; }
template <class T> std::string J(const T& v);
template <class T> concept Range = requires(const T& t) { std::begin(t); std::end(t); };
template <class T> concept MapLike = Range<T> && requires { typename T::key_type; typename T::mapped_type; };
template <class T> concept SetLike = Range<T> && requires { typename T::key_type; } && !MapLike<T>;
template <class T> struct is_pair : std::false_type {};
template <class A, class B> struct is_pair<std::pair<A, B>> : std::true_type {};
template <class T> std::string J(const T& v) {
  using U = std::remove_cvref_t<T>;
  if constexpr (std::is_same_v<U, bool>) return v ? "true" : "false";
  else if constexpr (std::is_same_v<U, char>) return raw(std::string("'") + v + "'");
  else if constexpr (std::is_integral_v<U>) {
    long double d = (long double)v;
    if (d > 9007199254740991.0L || d < -9007199254740991.0L) return raw(std::to_string(v));
    return std::to_string(v);
  } else if constexpr (std::is_floating_point_v<U>) {
    if (!std::isfinite((double)v)) return raw(std::to_string(v));
    std::ostringstream o; o << std::setprecision(15) << v; return o.str();
  } else if constexpr (std::is_convertible_v<const U&, std::string_view>) return q(std::string_view(v));
  else if constexpr (std::is_pointer_v<U>) return raw(v ? "pointer" : "nullptr");
  else if constexpr (is_pair<U>::value) return "{\"__tuple\":[" + J(v.first) + "," + J(v.second) + "]}";
  else if constexpr (MapLike<U>) {
    std::string o = "{\"__dict\":["; int i = 0;
    for (const auto& [k, x] : v) { if (i == 200) break; o += (i++ ? ",[" : "[") + J(k) + "," + J(x) + "]"; }
    return o + "]}";
  } else if constexpr (SetLike<U>) {
    std::string o = "{\"__set\":["; int i = 0;
    for (const auto& x : v) { if (i == 200) break; o += (i++ ? "," : "") + J(x); }
    return o + "]}";
  } else if constexpr (Range<U>) {
    std::string o = "["; int i = 0;
    for (const auto& x : v) { if (i == 200) break; o += (i++ ? "," : "") + J(x); }
    return o + "]";
  } else return raw("?");
}
[[noreturn]] inline void stop(const char* why) { emit(std::string("{\"t\":\"limit\",\"x\":") + q(why) + "}"); std::cout.flush(); std::_Exit(0); }
inline void L(int l) { line = l; }
struct Scope {
  int saved;  // the caller's statement line, restored on return so a second call in that statement keeps it
  Scope(const char* name, std::initializer_list<const char*> params, std::initializer_list<std::string> args) : saved(line) {
    if (++calls > ${LIMIT}) stop("Stopped after ${LIMIT} calls. Try a smaller input.");
    if (depth >= ${MAX_DEPTH}) stop("Stopped at ${MAX_DEPTH} levels deep. Check that your base case is reached.");
    std::string o = std::string("{\"t\":\"c\",\"n\":") + q(name) + ",\"l\":" + std::to_string(line) + ",\"e\":" + (has_pending ? q(pending) : "null") + ",\"p\":[";
    int i = 0;
    for (const char* p : params) o += (i++ ? "," : "") + q(p);
    o += "],\"a\":[";
    i = 0;
    for (const auto& a : args) o += (i++ ? "," : "") + a;
    emit(o + "]}");
    has_pending = false; depth++;
  }
  ~Scope() { depth--; line = saved; emit("{\"t\":\"x\"}"); }
};
template <class T> std::decay_t<T> R(T&& v) { emit("{\"t\":\"v\",\"v\":" + J(v) + "}"); return std::forward<T>(v); }
inline std::string text() { return ""; }
template <class A, class... B> std::string text(const A& a, const B&... b) {
  std::string s;
  if constexpr (std::is_convertible_v<const A&, std::string_view>) s = std::string(std::string_view(a));
  else if constexpr (std::is_arithmetic_v<A> && !std::is_same_v<A, bool> && !std::is_same_v<A, char>) { std::ostringstream o; o << a; s = o.str(); }
  else s = J(a);
  if constexpr (sizeof...(b) > 0) s += " " + text(b...);
  return s;
}
}  // namespace __rtv
template <class... A> void found(const A&... a) { __rtv::emit("{\"t\":\"f\",\"x\":" + __rtv::q(__rtv::text(a...)) + "}"); }
template <class... A> void note(const A&... a) { __rtv::emit("{\"t\":\"n\",\"x\":" + __rtv::q(__rtv::text(a...)) + "}"); }
template <class A> void label(const A& a) { __rtv::pending = __rtv::text(a); __rtv::has_pending = true; }
`;

export type CppProgram = { source: string; traced: string[] };

/** Where a statement starts on this line, if it's safe to put `__rtv::L(n);` in front of it. */
function statementStart(m: string, lineStart: number, lineEnd: number): number | null {
  let i = lineStart;
  while (i < lineEnd && (m[i] === " " || m[i] === "\t")) i++;
  if (i >= lineEnd) return null;
  // Must begin a statement: not a continuation, closing brace, else / case label …
  if (!/[A-Za-z_(*]/.test(m[i])) return null;
  const word = /^[A-Za-z_]\w*/.exec(m.slice(i, lineEnd))?.[0] ?? "";
  if (["else", "case", "default", "public", "private", "protected", "template", "typename", "using", "class", "struct"].includes(word)) return null;
  // … and the previous code must end a statement or open/close a block.
  let p = lineStart - 1;
  while (p >= 0 && /\s/.test(m[p])) p--;
  if (p >= 0 && !";{}".includes(m[p])) return null;
  return i;
}

export function instrumentCpp(src: string, only?: string[]): CppProgram {
  const m = mask(src, true);
  const fns = findFunctions(m, true);
  const traced = (only?.length ? fns.filter((f) => only.includes(f.name)) : fns.filter((f) => isRecursive(m, f))).filter((f) => f.name !== "main");
  const edits: Edit[] = [];
  for (const f of traced) {
    const names = f.params.map((p) => `"${p}"`).join(",");
    const args = f.params.map((p) => `__rtv::J(${p})`).join(", ");
    edits.push({ at: f.open + 1, text: ` __rtv::Scope __rtv_s("${f.name}", {${names}}, {${args}});` });
    for (const [a, b] of returnsIn(m, f.open, f.close)) {
      // returns inside a nested traced lambda are handled by that lambda
      if (traced.some((g) => g !== f && g.open > f.open && g.close < f.close && a > g.open && a < g.close)) continue;
      edits.push({ at: a, text: "__rtv::R(" }, { at: b, text: ")" });
    }
  }
  // Call-site lines: prefix statements (inside any function body) that call a traced function.
  const bodies: FnDef[] = fns;
  const callRe = new RegExp(`(^|[^\\w$.>])(${[...new Set(traced.map((f) => f.selfParam ?? f.name).concat(traced.map((f) => f.name)))].join("|")})\\s*\\(`);
  if (traced.length) {
    let lineStart = 0;
    let lineNo = 1;
    while (lineStart <= m.length) {
      const nl = m.indexOf("\n", lineStart);
      const lineEnd = nl < 0 ? m.length : nl;
      const text = m.slice(lineStart, lineEnd);
      if (callRe.test(text) && bodies.some((f) => f.open < lineStart && lineEnd <= f.close)) {
        const at = statementStart(m, lineStart, lineEnd);
        if (at !== null) edits.push({ at, text: `__rtv::L(${lineNo}); ` });
      }
      if (nl < 0) break;
      lineStart = nl + 1;
      lineNo++;
    }
  }
  return { source: applyEdits(src, edits), traced: [...new Set(traced.map((f) => f.name))] };
}
