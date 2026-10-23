import type { Language } from "./runTypes";

export type Preset = {
  id: string;
  name: string;
  group: "Basics" | "Backtracking" | "Divide & conquer" | "Dynamic programming";
  code: Record<Language, string>;
};

export const PRESETS: Preset[] = [
  {
    id: "factorial",
    group: "Basics",
    name: "Factorial: the simplest recursion",
    code: {
      javascript: `// factorial(4) = 4 × factorial(3) = 4 × 3 × factorial(2) …
// Watch the calls go down to the base case, then the values come back up.
function factorial(n) {
  if (n <= 1) return 1;      // base case: stop here
  return n * factorial(n - 1); // smaller problem
}

log("4! =", factorial(4));
`,
      python: String.raw`# factorial(4) = 4 × factorial(3) = 4 × 3 × factorial(2) …
# Watch the calls go down to the base case, then the values come back up.
def factorial(n):
    if n <= 1:
        return 1                 # base case: stop here
    return n * factorial(n - 1)  # smaller problem

print("4! =", factorial(4))
`,
      java: String.raw`// factorial(4) = 4 × factorial(3) = 4 × 3 × factorial(2) …
// Watch the calls go down to the base case, then the values come back up.
public class Main {
    static int factorial(int n) {
        if (n <= 1) return 1;          // base case: stop here
        return n * factorial(n - 1);   // smaller problem
    }

    public static void main(String[] args) {
        System.out.println("4! = " + factorial(4));
    }
}
`,
      cpp: String.raw`// factorial(4) = 4 × factorial(3) = 4 × 3 × factorial(2) …
// Watch the calls go down to the base case, then the values come back up.
#include <bits/stdc++.h>
using namespace std;

int factorial(int n) {
    if (n <= 1) return 1;          // base case: stop here
    return n * factorial(n - 1);   // smaller problem
}

int main() {
    cout << "4! = " << factorial(4) << "\n";
}
`,
    },
  },
  {
    id: "sum",
    group: "Basics",
    name: "Sum of an array",
    code: {
      javascript: `// @show i
function sum(nums, i) {
  if (i === nums.length) return 0;
  return nums[i] + sum(nums, i + 1);
}

log(sum([3, 1, 4, 1, 5], 0));
`,
      python: String.raw`# @show i
def total(nums, i):
    if i == len(nums):
        return 0
    return nums[i] + total(nums, i + 1)

print(total([3, 1, 4, 1, 5], 0))
`,
      java: String.raw`// @show i
public class Main {
    static int sum(int[] nums, int i) {
        if (i == nums.length) return 0;
        return nums[i] + sum(nums, i + 1);
    }

    public static void main(String[] args) {
        System.out.println(sum(new int[]{3, 1, 4, 1, 5}, 0));
    }
}
`,
      cpp: String.raw`// @show i
#include <bits/stdc++.h>
using namespace std;

int sum(const vector<int>& nums, int i) {
    if (i == (int)nums.size()) return 0;
    return nums[i] + sum(nums, i + 1);
}

int main() {
    vector<int> nums = {3, 1, 4, 1, 5};
    cout << sum(nums, 0) << "\n";
}
`,
    },
  },
  {
    id: "reverse",
    group: "Basics",
    name: "Reverse a string",
    code: {
      javascript: `function reverse(s) {
  if (s.length <= 1) return s;
  return reverse(s.slice(1)) + s[0];
}

log(reverse("hello"));
`,
      python: String.raw`def reverse(s):
    if len(s) <= 1:
        return s
    return reverse(s[1:]) + s[0]

print(reverse("hello"))
`,
      java: String.raw`public class Main {
    static String reverse(String s) {
        if (s.length() <= 1) return s;
        return reverse(s.substring(1)) + s.charAt(0);
    }

    public static void main(String[] args) {
        System.out.println(reverse("hello"));
    }
}
`,
      cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

string reverseStr(const string& s) {
    if (s.size() <= 1) return s;
    return reverseStr(s.substr(1)) + s[0];
}

int main() {
    cout << reverseStr("hello") << "\n";
}
`,
    },
  },
  {
    id: "power",
    group: "Basics",
    name: "Fast power (x^n by halving)",
    code: {
      javascript: `function power(x, n) {
  if (n === 0) return 1;
  const half = power(x, Math.floor(n / 2));
  return n % 2 === 0 ? half * half : half * half * x;
}

log("2^10 =", power(2, 10));
`,
      python: String.raw`def power(x, n):
    if n == 0:
        return 1
    half = power(x, n // 2)
    return half * half if n % 2 == 0 else half * half * x

print("2^10 =", power(2, 10))
`,
      java: String.raw`public class Main {
    static long power(long x, int n) {
        if (n == 0) return 1;
        long half = power(x, n / 2);
        return n % 2 == 0 ? half * half : half * half * x;
    }

    public static void main(String[] args) {
        System.out.println("2^10 = " + power(2, 10));
    }
}
`,
      cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

long long power(long long x, int n) {
    if (n == 0) return 1;
    long long half = power(x, n / 2);
    return n % 2 == 0 ? half * half : half * half * x;
}

int main() {
    cout << "2^10 = " << power(2, 10) << "\n";
}
`,
    },
  },
  {
    id: "fib",
    group: "Dynamic programming",
    name: "Fibonacci: see the repeated work",
    code: {
      javascript: `// Purple boxes are calls that were already computed somewhere else.
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
      python: String.raw`# Purple boxes are calls that were already computed somewhere else.
# Try the "Fibonacci with memo" example next and compare the tree.
def fib(n):
    if n <= 1:
        return n
    label("n-1")
    a = fib(n - 1)
    label("n-2")
    b = fib(n - 2)
    return a + b

print("fib(5) =", fib(5))
`,
      java: String.raw`// Purple boxes are calls that were already computed somewhere else.
// Try the "Fibonacci with memo" example next and compare the tree.
public class Main {
    static int fib(int n) {
        if (n <= 1) return n;
        label("n-1");
        int a = fib(n - 1);
        label("n-2");
        int b = fib(n - 2);
        return a + b;
    }

    public static void main(String[] args) {
        System.out.println("fib(5) = " + fib(5));
    }
}
`,
      cpp: String.raw`// Purple boxes are calls that were already computed somewhere else.
// Try the "Fibonacci with memo" example next and compare the tree.
#include <bits/stdc++.h>
using namespace std;

int fib(int n) {
    if (n <= 1) return n;
    label("n-1");
    int a = fib(n - 1);
    label("n-2");
    int b = fib(n - 2);
    return a + b;
}

int main() {
    cout << "fib(5) = " << fib(5) << "\n";
}
`,
    },
  },
  {
    id: "fibmemo",
    group: "Dynamic programming",
    name: "Fibonacci with memo",
    code: {
      javascript: `// @show n
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
      python: String.raw`# @show n
def fib(n, memo):
    if n <= 1:
        return n
    if n in memo:
        note("already known:", memo[n])
        return memo[n]
    label("n-1")
    a = fib(n - 1, memo)
    label("n-2")
    b = fib(n - 2, memo)
    memo[n] = a + b
    return memo[n]

print("fib(6) =", fib(6, {}))
`,
      java: String.raw`// @show n
import java.util.*;

public class Main {
    static int fib(int n, Map<Integer, Integer> memo) {
        if (n <= 1) return n;
        if (memo.containsKey(n)) {
            note("already known:", memo.get(n));
            return memo.get(n);
        }
        label("n-1");
        int a = fib(n - 1, memo);
        label("n-2");
        int b = fib(n - 2, memo);
        memo.put(n, a + b);
        return a + b;
    }

    public static void main(String[] args) {
        System.out.println("fib(6) = " + fib(6, new HashMap<>()));
    }
}
`,
      cpp: String.raw`// @show n
#include <bits/stdc++.h>
using namespace std;

int fib(int n, unordered_map<int, int>& memo) {
    if (n <= 1) return n;
    if (memo.count(n)) {
        note("already known:", memo[n]);
        return memo[n];
    }
    label("n-1");
    int a = fib(n - 1, memo);
    label("n-2");
    int b = fib(n - 2, memo);
    return memo[n] = a + b;
}

int main() {
    unordered_map<int, int> memo;
    cout << "fib(6) = " << fib(6, memo) << "\n";
}
`,
    },
  },
  {
    id: "stairs",
    group: "Dynamic programming",
    name: "Climbing Stairs (LeetCode 70)",
    code: {
      javascript: `// Ways to climb n steps taking 1 or 2 at a time.
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
      python: String.raw`# Ways to climb n steps taking 1 or 2 at a time.
def ways(n):
    if n == 0:
        return 1
    if n < 0:
        return 0
    label("+1 step")
    one = ways(n - 1)
    label("+2 steps")
    two = ways(n - 2)
    return one + two

print(ways(4), "ways")
`,
      java: String.raw`// Ways to climb n steps taking 1 or 2 at a time.
public class Main {
    static int ways(int n) {
        if (n == 0) return 1;
        if (n < 0) return 0;
        label("+1 step");
        int one = ways(n - 1);
        label("+2 steps");
        int two = ways(n - 2);
        return one + two;
    }

    public static void main(String[] args) {
        System.out.println(ways(4) + " ways");
    }
}
`,
      cpp: String.raw`// Ways to climb n steps taking 1 or 2 at a time.
#include <bits/stdc++.h>
using namespace std;

int ways(int n) {
    if (n == 0) return 1;
    if (n < 0) return 0;
    label("+1 step");
    int one = ways(n - 1);
    label("+2 steps");
    int two = ways(n - 2);
    return one + two;
}

int main() {
    cout << ways(4) << " ways\n";
}
`,
    },
  },
  {
    id: "hanoi",
    group: "Divide & conquer",
    name: "Tower of Hanoi",
    code: {
      javascript: `// @show n, from, to
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
      python: String.raw`# @show n, src, dst
def hanoi(n, src, dst, via):
    if n == 0:
        return
    label(f"move top {n - 1}")
    hanoi(n - 1, src, via, dst)
    print(f"move disk {n}: {src} → {dst}")
    label("back on top")
    hanoi(n - 1, via, dst, src)

hanoi(3, "A", "C", "B")
`,
      java: String.raw`// @show n, from, to
public class Main {
    static void hanoi(int n, char from, char to, char via) {
        if (n == 0) return;
        label("move top " + (n - 1));
        hanoi(n - 1, from, via, to);
        System.out.println("move disk " + n + ": " + from + " → " + to);
        label("back on top");
        hanoi(n - 1, via, to, from);
    }

    public static void main(String[] args) {
        hanoi(3, 'A', 'C', 'B');
    }
}
`,
      cpp: String.raw`// @show n, from, to
#include <bits/stdc++.h>
using namespace std;

void hanoi(int n, char from, char to, char via) {
    if (n == 0) return;
    label("move top " + to_string(n - 1));
    hanoi(n - 1, from, via, to);
    cout << "move disk " << n << ": " << from << " → " << to << "\n";
    label("back on top");
    hanoi(n - 1, via, to, from);
}

int main() {
    hanoi(3, 'A', 'C', 'B');
}
`,
    },
  },
  {
    id: "mergesort",
    group: "Divide & conquer",
    name: "Merge sort",
    code: {
      javascript: `function sort(arr) {
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
      python: String.raw`def sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    label("left half")
    left = sort(arr[:mid])
    label("right half")
    right = sort(arr[mid:])
    return merge(left, right)

def merge(a, b):
    out, i, j = [], 0, 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            out.append(a[i])
            i += 1
        else:
            out.append(b[j])
            j += 1
    return out + a[i:] + b[j:]

print(sort([5, 2, 4, 6, 1, 3]))
`,
      java: String.raw`import java.util.*;

public class Main {
    static int[] mergeSort(int[] arr) {
        if (arr.length <= 1) return arr;
        int mid = arr.length / 2;
        label("left half");
        int[] left = mergeSort(Arrays.copyOfRange(arr, 0, mid));
        label("right half");
        int[] right = mergeSort(Arrays.copyOfRange(arr, mid, arr.length));
        return merge(left, right);
    }

    static int[] merge(int[] a, int[] b) {
        int[] out = new int[a.length + b.length];
        int i = 0, j = 0, k = 0;
        while (i < a.length && j < b.length) out[k++] = a[i] <= b[j] ? a[i++] : b[j++];
        while (i < a.length) out[k++] = a[i++];
        while (j < b.length) out[k++] = b[j++];
        return out;
    }

    public static void main(String[] args) {
        System.out.println(Arrays.toString(mergeSort(new int[]{5, 2, 4, 6, 1, 3})));
    }
}
`,
      cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

vector<int> mergeTwo(const vector<int>& a, const vector<int>& b) {
    vector<int> out;
    size_t i = 0, j = 0;
    while (i < a.size() && j < b.size()) out.push_back(a[i] <= b[j] ? a[i++] : b[j++]);
    while (i < a.size()) out.push_back(a[i++]);
    while (j < b.size()) out.push_back(b[j++]);
    return out;
}

vector<int> mergeSort(vector<int> arr) {
    if (arr.size() <= 1) return arr;
    int mid = arr.size() / 2;
    label("left half");
    vector<int> left = mergeSort(vector<int>(arr.begin(), arr.begin() + mid));
    label("right half");
    vector<int> right = mergeSort(vector<int>(arr.begin() + mid, arr.end()));
    return mergeTwo(left, right);
}

int main() {
    for (int x : mergeSort({5, 2, 4, 6, 1, 3})) cout << x << " ";
    cout << "\n";
}
`,
    },
  },
  {
    id: "subsets",
    group: "Backtracking",
    name: "Subsets: take or skip (LeetCode 78)",
    code: {
      javascript: `// @show i, path
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
      python: String.raw`# @show i, path
def subsets(nums, i, path, ans):
    if i == len(nums):
        ans.append(path[:])
        found()
        return
    path.append(nums[i])
    label(f"take {nums[i]}")
    subsets(nums, i + 1, path, ans)
    path.pop()               # undo the choice: this is the backtrack

    label(f"skip {nums[i]}")
    subsets(nums, i + 1, path, ans)

ans = []
subsets([1, 2, 3], 0, [], ans)
print(ans)
`,
      java: String.raw`// @show i, path
import java.util.*;

public class Main {
    static void subsets(int[] nums, int i, List<Integer> path, List<List<Integer>> ans) {
        if (i == nums.length) {
            ans.add(new ArrayList<>(path));
            found();
            return;
        }
        path.add(nums[i]);
        label("take " + nums[i]);
        subsets(nums, i + 1, path, ans);
        path.remove(path.size() - 1);   // undo the choice: this is the backtrack

        label("skip " + nums[i]);
        subsets(nums, i + 1, path, ans);
    }

    public static void main(String[] args) {
        List<List<Integer>> ans = new ArrayList<>();
        subsets(new int[]{1, 2, 3}, 0, new ArrayList<>(), ans);
        System.out.println(ans);
    }
}
`,
      cpp: String.raw`// @show i, path
#include <bits/stdc++.h>
using namespace std;

void subsets(const vector<int>& nums, int i, vector<int>& path, vector<vector<int>>& ans) {
    if (i == (int)nums.size()) {
        ans.push_back(path);
        found();
        return;
    }
    path.push_back(nums[i]);
    label("take " + to_string(nums[i]));
    subsets(nums, i + 1, path, ans);
    path.pop_back();               // undo the choice: this is the backtrack

    label("skip " + to_string(nums[i]));
    subsets(nums, i + 1, path, ans);
}

int main() {
    vector<int> nums = {1, 2, 3}, path;
    vector<vector<int>> ans;
    subsets(nums, 0, path, ans);
    for (auto& v : ans) {
        cout << "[";
        for (size_t k = 0; k < v.size(); k++) cout << (k ? "," : "") << v[k];
        cout << "] ";
    }
    cout << "\n";
}
`,
    },
  },
  {
    id: "combo",
    group: "Backtracking",
    name: "Combination Sum (LeetCode 39)",
    code: {
      javascript: `// @show start, remaining, path
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
      python: String.raw`# @show start, remaining, path
def solve(candidates, start, remaining, path, ans):
    if remaining == 0:
        ans.append(path[:])
        found()
        return
    for i in range(start, len(candidates)):
        if candidates[i] > remaining:
            note(f"{candidates[i]} > {remaining}, so stop this loop")
            return
        path.append(candidates[i])
        label(f"i={i}")
        solve(candidates, i, remaining - candidates[i], path, ans)
        path.pop()

candidates = sorted([2, 3, 6, 7])
ans = []
solve(candidates, 0, 7, [], ans)
print(ans)
`,
      java: String.raw`// @show start, remaining, path
import java.util.*;

public class Main {
    static void solve(int[] candidates, int start, int remaining, List<Integer> path, List<List<Integer>> ans) {
        if (remaining == 0) {
            ans.add(new ArrayList<>(path));
            found();
            return;
        }
        for (int i = start; i < candidates.length; i++) {
            if (candidates[i] > remaining) {
                note(candidates[i] + " > " + remaining + ", so stop this loop");
                return;
            }
            path.add(candidates[i]);
            label("i=" + i);
            solve(candidates, i, remaining - candidates[i], path, ans);
            path.remove(path.size() - 1);
        }
    }

    public static void main(String[] args) {
        int[] candidates = {2, 3, 6, 7};
        Arrays.sort(candidates);
        List<List<Integer>> ans = new ArrayList<>();
        solve(candidates, 0, 7, new ArrayList<>(), ans);
        System.out.println(ans);
    }
}
`,
      cpp: String.raw`// @show start, remaining, path
#include <bits/stdc++.h>
using namespace std;

void solve(const vector<int>& candidates, int start, int remaining, vector<int>& path, vector<vector<int>>& ans) {
    if (remaining == 0) {
        ans.push_back(path);
        found();
        return;
    }
    for (int i = start; i < (int)candidates.size(); i++) {
        if (candidates[i] > remaining) {
            note(to_string(candidates[i]) + " > " + to_string(remaining) + ", so stop this loop");
            return;
        }
        path.push_back(candidates[i]);
        label("i=" + to_string(i));
        solve(candidates, i, remaining - candidates[i], path, ans);
        path.pop_back();
    }
}

int main() {
    vector<int> candidates = {2, 3, 6, 7}, path;
    sort(candidates.begin(), candidates.end());
    vector<vector<int>> ans;
    solve(candidates, 0, 7, path, ans);
    for (auto& v : ans) {
        cout << "[";
        for (size_t k = 0; k < v.size(); k++) cout << (k ? "," : "") << v[k];
        cout << "] ";
    }
    cout << "\n";
}
`,
    },
  },
  {
    id: "perm",
    group: "Backtracking",
    name: "Permutations (LeetCode 46)",
    code: {
      javascript: `// @show path
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
      python: String.raw`# @show path
# LeetCode style: methods called through self are traced too.
class Solution:
    def permute(self, nums):
        ans = []
        self.backtrack(nums, [False] * len(nums), [], ans)
        return ans

    def backtrack(self, nums, used, path, ans):
        if len(path) == len(nums):
            ans.append(path[:])
            found()
            return
        for i in range(len(nums)):
            if used[i]:
                continue
            used[i] = True
            path.append(nums[i])
            label(f"pick {nums[i]}")
            self.backtrack(nums, used, path, ans)
            path.pop()
            used[i] = False

print(Solution().permute([1, 2, 3]))
`,
      java: String.raw`// @show path
// LeetCode style: a Solution class, called from main.
import java.util.*;

class Solution {
    public List<List<Integer>> permute(int[] nums) {
        List<List<Integer>> ans = new ArrayList<>();
        backtrack(nums, new boolean[nums.length], new ArrayList<>(), ans);
        return ans;
    }

    void backtrack(int[] nums, boolean[] used, List<Integer> path, List<List<Integer>> ans) {
        if (path.size() == nums.length) {
            ans.add(new ArrayList<>(path));
            found();
            return;
        }
        for (int i = 0; i < nums.length; i++) {
            if (used[i]) continue;
            used[i] = true;
            path.add(nums[i]);
            label("pick " + nums[i]);
            backtrack(nums, used, path, ans);
            path.remove(path.size() - 1);
            used[i] = false;
        }
    }
}

public class Main {
    public static void main(String[] args) {
        System.out.println(new Solution().permute(new int[]{1, 2, 3}));
    }
}
`,
      cpp: String.raw`// @show path
// LeetCode style: a Solution class, called from main.
#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    vector<vector<int>> permute(vector<int>& nums) {
        vector<vector<int>> ans;
        vector<int> path;
        vector<bool> used(nums.size(), false);
        backtrack(nums, used, path, ans);
        return ans;
    }

private:
    void backtrack(vector<int>& nums, vector<bool>& used, vector<int>& path, vector<vector<int>>& ans) {
        if (path.size() == nums.size()) {
            ans.push_back(path);
            found();
            return;
        }
        for (int i = 0; i < (int)nums.size(); i++) {
            if (used[i]) continue;
            used[i] = true;
            path.push_back(nums[i]);
            label("pick " + to_string(nums[i]));
            backtrack(nums, used, path, ans);
            path.pop_back();
            used[i] = false;
        }
    }
};

int main() {
    vector<int> nums = {1, 2, 3};
    vector<vector<int>> ans = Solution().permute(nums);
    for (auto& v : ans) {
        cout << "[";
        for (size_t k = 0; k < v.size(); k++) cout << (k ? "," : "") << v[k];
        cout << "] ";
    }
    cout << "\n";
}
`,
    },
  },
  {
    id: "paren",
    group: "Backtracking",
    name: "Generate Parentheses (LeetCode 22)",
    code: {
      javascript: `// @show cur, open, close
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
      python: String.raw`# @show cur, opened, closed
def gen(n, opened, closed, cur, ans):
    if len(cur) == 2 * n:
        ans.append(cur)
        found()
        return
    if opened < n:
        label("(")
        gen(n, opened + 1, closed, cur + "(", ans)
    if closed < opened:
        label(")")
        gen(n, opened, closed + 1, cur + ")", ans)

ans = []
gen(3, 0, 0, "", ans)
print(ans)
`,
      java: String.raw`// @show cur, open, close
import java.util.*;

public class Main {
    static void gen(int n, int open, int close, String cur, List<String> ans) {
        if (cur.length() == 2 * n) {
            ans.add(cur);
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

    public static void main(String[] args) {
        List<String> ans = new ArrayList<>();
        gen(3, 0, 0, "", ans);
        System.out.println(ans);
    }
}
`,
      cpp: String.raw`// @show cur, open, close
#include <bits/stdc++.h>
using namespace std;

void gen(int n, int open, int close, string cur, vector<string>& ans) {
    if ((int)cur.size() == 2 * n) {
        ans.push_back(cur);
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

int main() {
    vector<string> ans;
    gen(3, 0, 0, "", ans);
    for (auto& s : ans) cout << s << " ";
    cout << "\n";
}
`,
    },
  },
  {
    id: "letters",
    group: "Backtracking",
    name: "Letter Combinations of a Phone Number (LeetCode 17)",
    code: {
      javascript: `// @show i, cur
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
      python: String.raw`# @show i, cur
KEYS = {"2": "abc", "3": "def", "4": "ghi", "5": "jkl", "6": "mno", "7": "pqrs", "8": "tuv", "9": "wxyz"}

def letters(digits, i, cur, ans):
    if i == len(digits):
        ans.append(cur)
        found()
        return
    for ch in KEYS[digits[i]]:
        label(ch)
        letters(digits, i + 1, cur + ch, ans)

ans = []
letters("23", 0, "", ans)
print(ans)
`,
      java: String.raw`// @show i, cur
import java.util.*;

public class Main {
    static final String[] KEYS = {"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"};

    static void letters(String digits, int i, String cur, List<String> ans) {
        if (i == digits.length()) {
            ans.add(cur);
            found();
            return;
        }
        for (char ch : KEYS[digits.charAt(i) - '0'].toCharArray()) {
            label(ch);
            letters(digits, i + 1, cur + ch, ans);
        }
    }

    public static void main(String[] args) {
        List<String> ans = new ArrayList<>();
        letters("23", 0, "", ans);
        System.out.println(ans);
    }
}
`,
      cpp: String.raw`// @show i, cur
#include <bits/stdc++.h>
using namespace std;

const vector<string> KEYS = {"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"};

void letters(const string& digits, int i, string cur, vector<string>& ans) {
    if (i == (int)digits.size()) {
        ans.push_back(cur);
        found();
        return;
    }
    for (char ch : KEYS[digits[i] - '0']) {
        label(string(1, ch));
        letters(digits, i + 1, cur + ch, ans);
    }
}

int main() {
    vector<string> ans;
    letters("23", 0, "", ans);
    for (auto& s : ans) cout << s << " ";
    cout << "\n";
}
`,
    },
  },
  {
    id: "queens",
    group: "Backtracking",
    name: "N-Queens, n = 4 (LeetCode 51)",
    code: {
      javascript: `// @show row, queens
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
      python: String.raw`# @show row, queens
# queens[r] = column of the queen in row r
def place(n, row, queens, ans):
    if row == n:
        ans.append(queens[:])
        found()
        return
    for c in range(n):
        if not is_safe(queens, row, c):
            continue
        queens.append(c)
        label(f"col {c}")
        place(n, row + 1, queens, ans)
        queens.pop()

def is_safe(queens, row, c):
    for r, qc in enumerate(queens):
        if qc == c or abs(qc - c) == row - r:
            return False
    return True

ans = []
place(4, 0, [], ans)
print(ans)
`,
      java: String.raw`// @show row, queens
import java.util.*;

public class Main {
    // queens.get(r) = column of the queen in row r
    static void place(int n, int row, List<Integer> queens, List<List<Integer>> ans) {
        if (row == n) {
            ans.add(new ArrayList<>(queens));
            found();
            return;
        }
        for (int c = 0; c < n; c++) {
            if (!isSafe(queens, row, c)) continue;
            queens.add(c);
            label("col " + c);
            place(n, row + 1, queens, ans);
            queens.remove(queens.size() - 1);
        }
    }

    static boolean isSafe(List<Integer> queens, int row, int c) {
        for (int r = 0; r < queens.size(); r++) {
            if (queens.get(r) == c || Math.abs(queens.get(r) - c) == row - r) return false;
        }
        return true;
    }

    public static void main(String[] args) {
        List<List<Integer>> ans = new ArrayList<>();
        place(4, 0, new ArrayList<>(), ans);
        System.out.println(ans);
    }
}
`,
      cpp: String.raw`// @show row, queens
#include <bits/stdc++.h>
using namespace std;

// queens[r] = column of the queen in row r
bool isSafe(const vector<int>& queens, int row, int c) {
    for (int r = 0; r < (int)queens.size(); r++)
        if (queens[r] == c || abs(queens[r] - c) == row - r) return false;
    return true;
}

void place(int n, int row, vector<int>& queens, vector<vector<int>>& ans) {
    if (row == n) {
        ans.push_back(queens);
        found();
        return;
    }
    for (int c = 0; c < n; c++) {
        if (!isSafe(queens, row, c)) continue;
        queens.push_back(c);
        label("col " + to_string(c));
        place(n, row + 1, queens, ans);
        queens.pop_back();
    }
}

int main() {
    vector<int> queens;
    vector<vector<int>> ans;
    place(4, 0, queens, ans);
    for (auto& v : ans) {
        cout << "[";
        for (size_t k = 0; k < v.size(); k++) cout << (k ? "," : "") << v[k];
        cout << "] ";
    }
    cout << "\n";
}
`,
    },
  },
  {
    id: "pal",
    group: "Backtracking",
    name: "Palindrome Partitioning (LeetCode 131)",
    code: {
      javascript: `// @show start, path
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
      python: String.raw`# @show start, path
def partition(s, start, path, ans):
    if start == len(s):
        ans.append(path[:])
        found()
        return
    for end in range(start + 1, len(s) + 1):
        piece = s[start:end]
        if piece != piece[::-1]:
            note(f'"{piece}" is not a palindrome')
            continue
        path.append(piece)
        label(piece)
        partition(s, end, path, ans)
        path.pop()

ans = []
partition("aab", 0, [], ans)
print(ans)
`,
      java: String.raw`// @show start, path
import java.util.*;

public class Main {
    static void partition(String s, int start, List<String> path, List<List<String>> ans) {
        if (start == s.length()) {
            ans.add(new ArrayList<>(path));
            found();
            return;
        }
        for (int end = start + 1; end <= s.length(); end++) {
            String piece = s.substring(start, end);
            if (!new StringBuilder(piece).reverse().toString().equals(piece)) {
                note("\"" + piece + "\" is not a palindrome");
                continue;
            }
            path.add(piece);
            label(piece);
            partition(s, end, path, ans);
            path.remove(path.size() - 1);
        }
    }

    public static void main(String[] args) {
        List<List<String>> ans = new ArrayList<>();
        partition("aab", 0, new ArrayList<>(), ans);
        System.out.println(ans);
    }
}
`,
      cpp: String.raw`// @show start, path
#include <bits/stdc++.h>
using namespace std;

bool isPal(const string& t) { return equal(t.begin(), t.end(), t.rbegin()); }

void partitionPal(const string& s, int start, vector<string>& path, vector<vector<string>>& ans) {
    if (start == (int)s.size()) {
        ans.push_back(path);
        found();
        return;
    }
    for (int end = start + 1; end <= (int)s.size(); end++) {
        string piece = s.substr(start, end - start);
        if (!isPal(piece)) {
            note("\"" + piece + "\" is not a palindrome");
            continue;
        }
        path.push_back(piece);
        label(piece);
        partitionPal(s, end, path, ans);
        path.pop_back();
    }
}

int main() {
    vector<string> path;
    vector<vector<string>> ans;
    partitionPal("aab", 0, path, ans);
    for (auto& v : ans) {
        cout << "[";
        for (size_t k = 0; k < v.size(); k++) cout << (k ? "," : "") << v[k];
        cout << "] ";
    }
    cout << "\n";
}
`,
    },
  },
  {
    id: "blank",
    group: "Basics",
    name: "Blank template",
    code: {
      javascript: `function solve(i, path) {
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
      python: String.raw`def solve(i, path):
    if i == 3:
        found()
        return
    path.append(i)
    label(f"add {i}")
    solve(i + 1, path)
    path.pop()

solve(0, [])
`,
      java: String.raw`import java.util.*;

public class Main {
    static void solve(int i, List<Integer> path) {
        if (i == 3) {
            found();
            return;
        }
        path.add(i);
        label("add " + i);
        solve(i + 1, path);
        path.remove(path.size() - 1);
    }

    public static void main(String[] args) {
        solve(0, new ArrayList<>());
    }
}
`,
      cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

void solve(int i, vector<int>& path) {
    if (i == 3) {
        found();
        return;
    }
    path.push_back(i);
    label("add " + to_string(i));
    solve(i + 1, path);
    path.pop_back();
}

int main() {
    vector<int> path;
    solve(0, path);
}
`,
    },
  },
];
