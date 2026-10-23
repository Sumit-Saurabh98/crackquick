import { execute } from "./engine";

/** Runs one program and posts its trace back. The page kills this worker if it takes too long. */
self.onmessage = (e: MessageEvent<{ code: string }>) => {
  self.postMessage(execute(e.data.code));
};
