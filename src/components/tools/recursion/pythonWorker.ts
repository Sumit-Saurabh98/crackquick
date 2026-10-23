import { PY_HARNESS } from "./pyHarness";

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";

/**
 * A module worker that runs Python with Pyodide. Built from source text because Pyodide only runs in
 * module workers and the bundler's workers are classic. Pyodide downloads on the first run (then
 * the browser caches it) and stays loaded for later runs. Messages match recursion.worker.ts.
 */
export function createPythonWorker() {
  const src = `
import { loadPyodide } from "${PYODIDE}pyodide.mjs";
const HARNESS = ${JSON.stringify(PY_HARNESS)};
let py = null;
const empty = (error) => ({ nodes: [], events: [], logs: [], usedFound: false, error, traced: [] });
self.onmessage = async (e) => {
  const { id, code } = e.data;
  if (!py) {
    self.postMessage({ id, type: "status", status: "loading-python" });
    try {
      py = await loadPyodide({ indexURL: "${PYODIDE}" });
      py.runPython(HARNESS);
    } catch (err) {
      py = null;
      self.postMessage({ id, type: "result", result: empty("Couldn't start Python: " + (err && err.message || err) + ". Check your internet connection and try again.") });
      return;
    }
  }
  self.postMessage({ id, type: "status", status: "running" });
  const run = py.globals.get("__rtv_run");
  try {
    self.postMessage({ id, type: "result", result: JSON.parse(run(code)) });
  } catch (err) {
    self.postMessage({ id, type: "result", result: empty("Python error: " + (err && err.message || err)) });
  } finally {
    run.destroy && run.destroy();
  }
};
`;
  const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  const worker = new Worker(url, { type: "module", name: "python" });
  // Some browsers fetch the worker script a moment later, so free the URL once it has surely loaded.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return worker;
}
