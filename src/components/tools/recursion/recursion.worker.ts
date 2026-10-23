import { execute } from "./engine";
import type { WorkerMessage, WorkerRequest } from "./runTypes";

/** Runs one JavaScript program and posts its trace back. The page kills this worker if it takes too long. */
const post = (m: WorkerMessage) => self.postMessage(m);

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, code } = e.data;
  post({ id, type: "status", status: "running" });
  post({ id, type: "result", result: execute(code) });
};
