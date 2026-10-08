import { readFileSync } from "node:fs";
process.env.MONGODB_URI = readFileSync(".env.local", "utf8").match(/^MONGODB_URI=(.*)$/m)![1].trim();
const { dbConnect } = await import("@/lib/mongodb");
const { questionOfTheDay } = await import("@/lib/featured");
const { FeaturedDay } = await import("@/models/FeaturedDay");
const { Question } = await import("@/models/Question");
const mongoose = (await import("mongoose")).default;
await dbConnect();
try {
  const live = await Question.countDocuments({ retired: { $ne: true } });
  const already = await FeaturedDay.countDocuments({ cycle: 1 });
  const seen: string[] = [];
  const cycles: number[] = [];
  for (let i = 0; i < live - already + 3; i++) {
    const d = await questionOfTheDay(`zz-test-${String(i).padStart(4, "0")}`);
    seen.push(d!.questionId);
    cycles.push(d!.cycle);
  }
  const firstPass = seen.slice(0, live - already);
  const real = (await FeaturedDay.find({ date: { $not: /^zz-test-/ } }).lean()).map((d) => String(d.questionId));
  console.log(`live questions ${live}, already featured for real dates ${already}`);
  console.log(`first ${firstPass.length} picks: ${new Set(firstPass).size} distinct, overlap with real days: ${firstPass.filter((x) => real.includes(x)).length}, all cycle 1: ${cycles.slice(0, firstPass.length).every((c) => c === 1)}`);
  console.log(`next 3 picks are cycle ${[...new Set(cycles.slice(firstPass.length))].join(",")}`);
  console.log(`same date asked again → same question: ${(await questionOfTheDay("zz-test-0000"))!.questionId === seen[0]}`);
} finally {
  console.log("cleanup: deleted", (await FeaturedDay.deleteMany({ date: /^zz-test-/ })).deletedCount, "test days; real days kept:", await FeaturedDay.countDocuments({}));
  await mongoose.disconnect();
}
