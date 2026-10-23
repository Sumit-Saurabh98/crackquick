export type Preset = { id: string; name: string; group: "Basics" | "Backtracking" | "Divide & conquer" | "Dynamic programming"; code: string };

export const PRESETS: Preset[] = [
  {
    id: "factorial",
    group: "Basics",
    name: "Factorial: the simplest recursion",
    code: `// factorial(4) = 4 × factorial(3) = 4 × 3 × factorial(2) …
// Watch the calls go down to the base case, then the values come back up.
function factorial(n) {
  if (n <= 1) return 1;      // base case: stop here
  return n * factorial(n - 1); // smaller problem
}

log("4! =", factorial(4));
`,
  },
  {
    id: "sum",
    group: "Basics",
    name: "Sum of an array",
    code: `// @show i
function sum(nums, i) {
  if (i === nums.length) return 0;
  return nums[i] + sum(nums, i + 1);
}

log(sum([3, 1, 4, 1, 5], 0));
`,
  },
  {
    id: "reverse",
    group: "Basics",
    name: "Reverse a string",
    code: `function reverse(s) {
  if (s.length <= 1) return s;
  return reverse(s.slice(1)) + s[0];
}

log(reverse("hello"));
`,
  },
  {
    id: "power",
    group: "Basics",
    name: "Fast power (x^n by halving)",
    code: `function power(x, n) {
  if (n === 0) return 1;
  const half = power(x, Math.floor(n / 2));
  return n % 2 === 0 ? half * half : half * half * x;
}

log("2^10 =", power(2, 10));
`,
  },
  {
    id: "fib",
    group: "Dynamic programming",
    name: "Fibonacci: see the repeated work",
    code: `// Purple boxes are calls that were already computed somewhere else.
// Try the "Fibonacci with memo" example next and compare the tree.
function fib(n) {
  if (n <= 1) return n;
  label("n-1");
  const a = fib(n - 1);
  label("n-2");
  const b = fib(n - 2);
  return a + b;
}

log("fib(5) =", fib(5));
`,
  },
  {
    id: "fibmemo",
    group: "Dynamic programming",
    name: "Fibonacci with memo",
    code: `// @show n
function fib(n, memo) {
  if (n <= 1) return n;
  if (memo[n] !== undefined) {
    note("already known: " + memo[n]);
    return memo[n];
  }
  label("n-1");
  const a = fib(n - 1, memo);
  label("n-2");
  const b = fib(n - 2, memo);
  memo[n] = a + b;
  return memo[n];
}

log("fib(6) =", fib(6, {}));
`,
  },
  {
    id: "stairs",
    group: "Dynamic programming",
    name: "Climbing Stairs (LeetCode 70)",
    code: `// Ways to climb n steps taking 1 or 2 at a time.
function ways(n) {
  if (n === 0) return 1;
  if (n < 0) return 0;
  label("+1 step");
  const one = ways(n - 1);
  label("+2 steps");
  const two = ways(n - 2);
  return one + two;
}

log(ways(4), "ways");
`,
  },
  {
    id: "hanoi",
    group: "Divide & conquer",
    name: "Tower of Hanoi",
    code: `// @show n, from, to
function hanoi(n, from, to, via) {
  if (n === 0) return;
  label("move top " + (n - 1));
  hanoi(n - 1, from, via, to);
  log("move disk " + n + ": " + from + " → " + to);
  label("back on top");
  hanoi(n - 1, via, to, from);
}

hanoi(3, "A", "C", "B");
`,
  },
  {
    id: "mergesort",
    group: "Divide & conquer",
    name: "Merge sort",
    code: `function sort(arr) {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  label("left half");
  const left = sort(arr.slice(0, mid));
  label("right half");
  const right = sort(arr.slice(mid));
  return merge(left, right);
}

function merge(a, b) {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) out.push(a[i] <= b[j] ? a[i++] : b[j++]);
  return out.concat(a.slice(i), b.slice(j));
}

log(sort([5, 2, 4, 6, 1, 3]));
`,
  },
  {
    id: "subsets",
    group: "Backtracking",
    name: "Subsets: take or skip (LeetCode 78)",
    code: `// @show i, path
function subsets(nums, i, path, ans) {
  if (i === nums.length) {
    ans.push([...path]);
    found();
    return;
  }
  path.push(nums[i]);
  label("take " + nums[i]);
  subsets(nums, i + 1, path, ans);
  path.pop();              // undo the choice: this is the backtrack

  label("skip " + nums[i]);
  subsets(nums, i + 1, path, ans);
}

const ans = [];
subsets([1, 2, 3], 0, [], ans);
log(ans);
`,
  },
  {
    id: "combo",
    group: "Backtracking",
    name: "Combination Sum (LeetCode 39)",
    code: `// @show start, remaining, path
function solve(candidates, start, remaining, path, ans) {
  if (remaining === 0) {
    ans.push([...path]);
    found();
    return;
  }
  for (let i = start; i < candidates.length; i++) {
    if (candidates[i] > remaining) {
      note(candidates[i] + " > " + remaining + ", so stop this loop");
      return;
    }
    path.push(candidates[i]);
    label("i=" + i);
    solve(candidates, i, remaining - candidates[i], path, ans);
    path.pop();
  }
}

const candidates = [2, 3, 6, 7];
candidates.sort((a, b) => a - b);
const ans = [];
solve(candidates, 0, 7, [], ans);
log(ans);
`,
  },
  {
    id: "perm",
    group: "Backtracking",
    name: "Permutations (LeetCode 46)",
    code: `// @show path
function permute(nums, used, path, ans) {
  if (path.length === nums.length) {
    ans.push([...path]);
    found();
    return;
  }
  for (let i = 0; i < nums.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    path.push(nums[i]);
    label("pick " + nums[i]);
    permute(nums, used, path, ans);
    path.pop();
    used[i] = false;
  }
}

const ans = [];
permute([1, 2, 3], [false, false, false], [], ans);
log(ans);
`,
  },
  {
    id: "paren",
    group: "Backtracking",
    name: "Generate Parentheses (LeetCode 22)",
    code: `// @show cur, open, close
function gen(n, open, close, cur, ans) {
  if (cur.length === 2 * n) {
    ans.push(cur);
    found();
    return;
  }
  if (open < n) {
    label("(");
    gen(n, open + 1, close, cur + "(", ans);
  }
  if (close < open) {
    label(")");
    gen(n, open, close + 1, cur + ")", ans);
  }
}

const ans = [];
gen(3, 0, 0, "", ans);
log(ans);
`,
  },
  {
    id: "letters",
    group: "Backtracking",
    name: "Letter Combinations of a Phone Number (LeetCode 17)",
    code: `// @show i, cur
const KEYS = { 2: "abc", 3: "def", 4: "ghi", 5: "jkl", 6: "mno", 7: "pqrs", 8: "tuv", 9: "wxyz" };

function letters(digits, i, cur, ans) {
  if (i === digits.length) {
    ans.push(cur);
    found();
    return;
  }
  for (const ch of KEYS[digits[i]]) {
    label(ch);
    letters(digits, i + 1, cur + ch, ans);
  }
}

const ans = [];
letters("23", 0, "", ans);
log(ans);
`,
  },
  {
    id: "queens",
    group: "Backtracking",
    name: "N-Queens, n = 4 (LeetCode 51)",
    code: `// @show row, queens
// queens[r] = column of the queen in row r
function place(n, row, queens, ans) {
  if (row === n) {
    ans.push([...queens]);
    found();
    return;
  }
  for (let c = 0; c < n; c++) {
    if (!isSafe(queens, row, c)) continue;
    queens.push(c);
    label("col " + c);
    place(n, row + 1, queens, ans);
    queens.pop();
  }
}

function isSafe(queens, row, c) {
  for (let r = 0; r < queens.length; r++) {
    if (queens[r] === c || Math.abs(queens[r] - c) === row - r) return false;
  }
  return true;
}

const ans = [];
place(4, 0, [], ans);
log(ans);
`,
  },
  {
    id: "pal",
    group: "Backtracking",
    name: "Palindrome Partitioning (LeetCode 131)",
    code: `// @show start, path
function partition(s, start, path, ans) {
  if (start === s.length) {
    ans.push([...path]);
    found();
    return;
  }
  for (let end = start + 1; end <= s.length; end++) {
    const piece = s.slice(start, end);
    if (!isPal(piece)) {
      note('"' + piece + '" is not a palindrome');
      continue;
    }
    path.push(piece);
    label(piece);
    partition(s, end, path, ans);
    path.pop();
  }
}

function isPal(t) {
  return t === t.split("").reverse().join("");
}

const ans = [];
partition("aab", 0, [], ans);
log(ans);
`,
  },
  {
    id: "blank",
    group: "Basics",
    name: "Blank template",
    code: `function solve(i, path) {
  if (i === 3) {
    found();
    return;
  }
  path.push(i);
  label("add " + i);
  solve(i + 1, path);
  path.pop();
}

solve(0, []);
`,
  },
];
