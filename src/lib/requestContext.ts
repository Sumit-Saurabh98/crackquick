import { AsyncLocalStorage } from "node:async_hooks";
import { setTimezoneResolver } from "./dates";

/** Per-request values on the server. Only the timezone so far: each user has their own. */
const store = new AsyncLocalStorage<{ timezone: string }>();

setTimezoneResolver(() => store.getStore()?.timezone);

export function runWithTimezone<T>(timezone: string, fn: () => T): T {
  return store.run({ timezone }, fn);
}
