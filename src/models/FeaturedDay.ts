import { Schema } from "mongoose";
import { defineModel } from "./model";

/**
 * The question of the day for one calendar date ("YYYY-MM-DD"), the same for everyone. `cycle`
 * counts passes through the catalog: no question repeats until every live one has been featured.
 */
const FeaturedDaySchema = new Schema({
  date: { type: String, required: true, unique: true },
  questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
  cycle: { type: Number, required: true },
  at: { type: Date, default: Date.now },
});

FeaturedDaySchema.index({ cycle: 1, questionId: 1 });

export const FeaturedDay = defineModel("FeaturedDay", FeaturedDaySchema);
