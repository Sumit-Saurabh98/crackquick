import { applyEdits, findFunctions, isRecursive, mask, matching, paramDecls, returnsIn, type Edit, type FnDef } from "./scan";
import { JAVA_NODES, javaSample } from "./samples";
import { LIMIT, MAX_DEPTH, MARK } from "./protocol";

/**
 * Java support. Recursive methods get `__T.enter(…)` + try/finally `__T.exit()`, and their
 * `return x;` becomes `return __T.ret(x);`. Every insertion stays on its original line, so
 * line numbers in errors and stack traces still match the user's code. found() / label() / note()
 * are added to each top-level class; the __T helper class goes after the user's code.
 */

const RUNTIME = `
final class __T {
  static int calls = 0, depth = 0;
  static String pending = null;
  static void emit(String s) { System.out.print("${MARK}" + s + "\\n"); }
  static void stop(String why) { emit("{\\"t\\":\\"limit\\",\\"x\\":" + q(why) + "}"); System.out.flush(); Runtime.getRuntime().halt(0); }
  static void enter(String name, String[] params, Object[] args) {
    if (++calls > ${LIMIT}) stop("Stopped after ${LIMIT} calls. Try a smaller input.");
    if (depth >= ${MAX_DEPTH}) stop("Stopped at ${MAX_DEPTH} levels deep. Check that your base case is reached.");
    StackTraceElement[] st = Thread.currentThread().getStackTrace();
    int line = st.length > 3 ? st[3].getLineNumber() : -1;
    StringBuilder b = new StringBuilder("{\\"t\\":\\"c\\",\\"n\\":").append(q(name)).append(",\\"l\\":").append(line);
    b.append(",\\"e\\":").append(pending == null ? "null" : q(pending)).append(",\\"p\\":[");
    for (int i = 0; i < params.length; i++) b.append(i > 0 ? "," : "").append(q(params[i]));
    b.append("],\\"a\\":[");
    for (int i = 0; i < args.length; i++) b.append(i > 0 ? "," : "").append(j(args[i], 0, new java.util.IdentityHashMap<>()));
    emit(b.append("]}").toString());
    pending = null;
    depth++;
  }
  static void exit() { depth--; emit("{\\"t\\":\\"x\\"}"); }
  /** Called first thing in main: print UTF-8 whatever the machine's default is. */
  static void utf8() { System.setOut(new java.io.PrintStream(new java.io.FileOutputStream(java.io.FileDescriptor.out), true, java.nio.charset.StandardCharsets.UTF_8)); }
  static <V> V ret(V v) { emit("{\\"t\\":\\"v\\",\\"v\\":" + j(v, 0, new java.util.IdentityHashMap<>()) + "}"); return v; }
  static void found(Object... a) { emit("{\\"t\\":\\"f\\",\\"x\\":" + q(text(a)) + "}"); }
  static void note(Object... a) { emit("{\\"t\\":\\"n\\",\\"x\\":" + q(text(a)) + "}"); }
  static void label(Object t) { pending = String.valueOf(t); }
  static String text(Object[] a) {
    StringBuilder b = new StringBuilder();
    for (int i = 0; i < a.length; i++) b.append(i > 0 ? " " : "").append(a[i] instanceof String ? (String) a[i] : show(a[i]));
    return b.toString();
  }
  static String show(Object o) {
    if (o != null && o.getClass().isArray()) {
      StringBuilder b = new StringBuilder("[");
      int n = java.lang.reflect.Array.getLength(o);
      for (int i = 0; i < n; i++) b.append(i > 0 ? ", " : "").append(show(java.lang.reflect.Array.get(o, i)));
      return b.append("]").toString();
    }
    return String.valueOf(o);
  }
  static String q(String s) {
    StringBuilder b = new StringBuilder("\\"");
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      if (c == '"' || c == '\\\\') b.append('\\\\').append(c);
      else if (c < 32) b.append(String.format("\\\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static String raw(String s) { return "{\\"__r\\":" + q(s.length() > 200 ? s.substring(0, 200) : s) + "}"; }
  static String j(Object o, int d, java.util.IdentityHashMap<Object, Boolean> seen) {
    if (o == null) return raw("null");
    if (o instanceof Boolean) return o.toString();
    if (o instanceof Integer || o instanceof Short || o instanceof Byte) return o.toString();
    if (o instanceof Long) { long v = (Long) o; return Math.abs(v) < (1L << 53) ? Long.toString(v) : raw(v + "L"); }
    if (o instanceof Number) { double v = ((Number) o).doubleValue(); return Double.isFinite(v) ? o.toString() : raw(o.toString()); }
    if (o instanceof Character) return raw("'" + o + "'");
    if (o instanceof CharSequence) return q(o.toString());
    if (seen.containsKey(o)) return "{\\"__c\\":1}";
    if (d > 6) return "{\\"__x\\":1}";
    seen.put(o, true);
    try {
      StringBuilder b = new StringBuilder();
      if (o.getClass().isArray()) {
        int n = Math.min(200, java.lang.reflect.Array.getLength(o));
        b.append("[");
        for (int i = 0; i < n; i++) b.append(i > 0 ? "," : "").append(j(java.lang.reflect.Array.get(o, i), d + 1, seen));
        return b.append("]").toString();
      }
      if (o instanceof java.util.Map) {
        b.append("{\\"__dict\\":[");
        int i = 0;
        for (java.util.Map.Entry<?, ?> e : ((java.util.Map<?, ?>) o).entrySet()) {
          if (i == 200) break;
          b.append(i++ > 0 ? "," : "").append("[").append(j(e.getKey(), d + 1, seen)).append(",").append(j(e.getValue(), d + 1, seen)).append("]");
        }
        return b.append("]}").toString();
      }
      if (o instanceof java.util.Collection) {
        boolean set = o instanceof java.util.Set;
        b.append(set ? "{\\"__set\\":[" : "[");
        int i = 0;
        for (Object x : (java.util.Collection<?>) o) {
          if (i == 200) break;
          b.append(i++ > 0 ? "," : "").append(j(x, d + 1, seen));
        }
        return b.append(set ? "]}" : "]").toString();
      }
      // Tree / list nodes: show the value, not ClassName@hash.
      try {
        java.lang.reflect.Field f = o.getClass().getDeclaredField("val");
        f.setAccessible(true);
        return raw("node(" + f.get(o) + ")");
      } catch (Exception e) {
        return raw(String.valueOf(o));
      }
    } finally {
      seen.remove(o);
    }
  }
}
`;

/** `notice`: set when the program had no main and one was written for it. */
export type JavaProgram = { source: string; traced: string[]; notice: string | null };

/** Top-level type declarations: [kind, name, body open, body close]. */
function topLevelTypes(m: string) {
  const out: { kind: string; name: string; open: number; close: number; publicAt: number }[] = [];
  let depth = 0;
  for (let i = 0; i < m.length; i++) {
    const ch = m[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (depth === 0 && /[a-z]/.test(ch) && (i === 0 || /[^\w$]/.test(m[i - 1]))) {
      const x = /^(class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/.exec(m.slice(i, i + 200));
      if (!x) continue;
      const open = m.indexOf("{", i);
      if (open < 0) break;
      const close = matching(m, open);
      if (close < 0) break;
      const headStart = m.lastIndexOf("}", i) + 1;
      const pub = /\bpublic\b/.exec(m.slice(headStart, i));
      out.push({ kind: x[1], name: x[2], open, close, publicAt: pub ? headStart + pub.index : -1 });
      i = close;
    }
  }
  return out;
}

/**
 * `public` is dropped from top-level types (blanked, so nothing moves): the runner compiles the
 * code under its own file name, and javac insists a public class lives in a file of the same name.
 */
export function instrumentJava(code: string, only?: string[]): JavaProgram {
  const m = mask(code, false);
  const types = topLevelTypes(m);
  const mainAt = /\bstatic\s+(?:final\s+)?void\s+main\s*\(/.exec(m)?.index ?? -1;
  const hasMain = types.some((t) => t.open < mainAt && mainAt < t.close);
  let src = code;
  for (const t of types) if (t.publicAt >= 0) src = src.slice(0, t.publicAt) + "      " + src.slice(t.publicAt + 6);

  const all = findFunctions(m, false);
  const driver = hasMain ? null : leetCodeDriver(m, types, all);
  const fns = all.filter((f) => f.name !== "main");
  const main = all.find((f) => f.name === "main" && f.open > mainAt);
  const traced = only?.length ? fns.filter((f) => only.includes(f.name)) : fns.filter((f) => isRecursive(m, f));
  const edits: Edit[] = [];
  for (const f of traced) {
    const names = f.params.map((p) => `"${p}"`).join(",");
    edits.push({ at: f.open + 1, text: ` __T.enter("${f.name}", new String[]{${names}}, new Object[]{${f.params.join(", ")}}); try {` });
    for (const [a, b] of returnsIn(m, f.open, f.close)) {
      edits.push({ at: a, text: "__T.ret(" }, { at: b, text: ")" });
    }
    edits.push({ at: f.close, text: "} finally { __T.exit(); } " });
  }
  if (main) edits.push({ at: main.open + 1, text: " __T.utf8();" });
  // LeetCode imports these for you, so its snippets use List / ArrayList / Map… without imports. They go
  // at the start of line 1 so no line moves (not before a package line, which has to come first).
  if (!/^\s*package\s/m.test(m)) edits.push({ at: 0, text: "import java.util.*; import java.util.function.*; import java.util.stream.*; " });
  for (const t of types.filter((t) => t.kind === "class")) {
    edits.push({
      at: t.close,
      text: " static void found(Object... a) { __T.found(a); } static void note(Object... a) { __T.note(a); } static void label(Object t) { __T.label(t); } ",
    });
  }
  // LeetCode provides TreeNode / ListNode; add them when the code uses them without defining them.
  const extra = (Object.keys(JAVA_NODES) as (keyof typeof JAVA_NODES)[])
    .filter((n) => new RegExp(`\\b${n}\\b`).test(m) && !types.some((t) => t.name === n))
    .map((n) => JAVA_NODES[n]);
  const source = [applyEdits(src, edits), ...extra, driver?.code ?? "", RUNTIME].join("\n");
  return {
    source,
    traced: [...new Set(traced.map((f) => f.name))],
    notice: driver?.notice ?? null,
  };
}

/**
 * LeetCode-style code (a Solution class, no main): a main that calls its public method with sample
 * input, the way LeetCode runs it. It goes after the user's code, so their line numbers don't move.
 */
function leetCodeDriver(m: string, types: ReturnType<typeof topLevelTypes>, fns: FnDef[]) {
  const classes = types.filter((t) => t.kind === "class");
  const cls = classes.find((t) => t.name === "Solution") ?? classes[0];
  if (!cls) throw new Error("Add a class with your method, and a main method (public static void main(String[] args)) that calls it.");
  // Methods declared directly in the class (not in nested classes), with their modifiers.
  const methods = fns
    .filter((f) => f.nameAt > cls.open && f.close < cls.close && f.name !== cls.name)
    .filter((f) => {
      let depth = 0;
      for (let i = cls.open; i < f.nameAt; i++) depth += m[i] === "{" ? 1 : m[i] === "}" ? -1 : 0;
      return depth === 1;
    })
    .map((f) => {
      const start = Math.max(m.lastIndexOf(";", f.nameAt), m.lastIndexOf("}", f.nameAt), m.lastIndexOf("{", f.nameAt)) + 1;
      return { f, head: m.slice(start, f.nameAt) };
    });
  const target = methods.find((x) => /\bpublic\b/.test(x.head)) ?? methods.find((x) => !/\bprivate\b/.test(x.head)) ?? methods[0];
  if (!target) throw new Error(`Add a method to ${cls.name}, and a main method (public static void main(String[] args)) that calls it.`);
  const args = paramDecls(target.f.paramList).map((d) => javaSample(d.type, d.name)).join(", ");
  const recv = /\bstatic\b/.test(target.head) ? cls.name : `new ${cls.name}()`;
  const call = `${recv}.${target.f.name}(${args})`;
  const body = /\bvoid\s*$/.test(target.head.trim()) ? `${call};` : `Object __r = ${call}; System.out.println("Result: " + __T.show(__r));`;
  return {
    code: `class __Main { public static void main(String[] args) { __T.utf8(); ${body} } }`,
    notice: `No main method, so it ran ${call} with sample input, the way LeetCode would. Add a main to use your own input.`,
  };
}
