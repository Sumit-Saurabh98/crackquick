import mongoose, { type Schema } from "mongoose";

/**
 * Registers a model, replacing any cached one with the same name. In dev, hot reload re-runs this
 * file with the new schema; reusing `mongoose.models[name]` would keep the old schema and silently
 * drop fields added since the server started.
 */
export function defineModel<S extends Schema>(name: string, schema: S) {
  if (mongoose.models[name]) mongoose.deleteModel(name);
  return mongoose.model(name, schema);
}
