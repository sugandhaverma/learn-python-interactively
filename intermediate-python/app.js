const runtimeStatus = document.querySelector("#runtime-status");
const challengeCards = [...document.querySelectorAll(".challenge-card")];
const solvedChallenges = new Set();
const progressTrack = document.querySelector(".progress-track");
const progressFill = document.querySelector(".progress-fill");
const progressLabel = document.querySelector(".progress-label");
const completionBanner = document.querySelector("#completion-banner");
let pythonRuntime;
let runtimePromise;
let isRunning = false;

const errorExplanations = {
  SyntaxError: "Python could not understand this line. A quote, bracket, parenthesis, or colon may be missing.",
  IndentationError: "The spaces at the start of this line do not match the surrounding code block.",
  NameError: "This line uses a name Python does not know. It may be misspelled or not defined yet.",
  TypeError: "This line uses a value in an operation that does not support that type.",
  IndexError: "This line asks for a list position that does not exist. List positions start at 0.",
  KeyError: "This line asks for a dictionary key that has not been added yet.",
  ZeroDivisionError: "This line tries to divide by zero."
};

async function loadPython() {
  if (pythonRuntime) return pythonRuntime;
  if (!runtimePromise) {
    runtimeStatus.textContent = "Loading Python for the first time…";
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js";
    script.async = true;
    runtimePromise = new Promise((resolve, reject) => {
      script.onload = async () => {
        try {
          pythonRuntime = await globalThis.loadPyodide();
          resolve(pythonRuntime);
        } catch (error) {
          reject(error);
        }
      };
      script.onerror = () => reject(new Error("Could not load Python. Check your internet connection and try again."));
      document.head.append(script);
    }).catch((error) => {
      runtimePromise = undefined;
      script.remove();
      throw error;
    });
  }
  return runtimePromise;
}

function getErrorLine(message, code) {
  const sourceFrames = [...message.matchAll(/File "<exec>", line (\d+)/g)];
  const tracebackLines = [...message.matchAll(/line\s+(\d+)/g)];
  const lineNumber = sourceFrames.length
    ? Number(sourceFrames[sourceFrames.length - 1][1])
    : tracebackLines.length
      ? Number(tracebackLines[tracebackLines.length - 1][1])
      : null;
  if (lineNumber && lineNumber <= code.split("\n").length) return lineNumber;
  return null;
}

function getOutputLine(code, fallbackLine) {
  const lines = code.split("\n");
  const reversedPrintIndex = lines.slice().reverse().findIndex((line) => /\bprint\s*\(/.test(line));
  if (reversedPrintIndex >= 0) return lines.length - reversedPrintIndex;
  const reversedCodeIndex = lines.slice().reverse().findIndex((line) => line.trim());
  return reversedCodeIndex >= 0 ? lines.length - reversedCodeIndex : fallbackLine;
}

function suggestErrorFix(errorType, sourceLine, message, hint) {
  if (errorType === "SyntaxError") {
    if (/^(if|elif|else|for|while|def|class)\b/.test(sourceLine.trim()) && !sourceLine.trim().endsWith(":")) {
      return `Add a colon to the end of the line, for example: ${sourceLine.trim()}:`;
    }
    return `Check for a missing matching quote, bracket, or colon. For example, write print("Hello") with both quotes. ${hint}`;
  }
  if (errorType === "IndentationError") {
    const fix = message.includes("unexpected indent")
      ? "Remove the extra spaces before this line if it is not inside a block."
      : "If this line is inside an if, loop, or function, indent it by four spaces.";
    return `${fix} Use spaces consistently rather than mixing tabs and spaces.`;
  }
  if (errorType === "NameError") {
    return `Check spelling and uppercase/lowercase, then define the variable before using it (for example: score = 10). ${hint}`;
  }
  if (errorType === "TypeError") {
    return `Check the value types. Convert a number to text with str(value), or make sure sum() receives numbers rather than nested lists. ${hint}`;
  }
  if (errorType === "IndexError") {
    return `Use an index from 0 to len(your_list) - 1, or check the list length before accessing it. ${hint}`;
  }
  if (errorType === "KeyError") {
    return `Give a new key a starting value before adding to it, for example counts[word] = counts.get(word, 0) + 1.`;
  }
  if (errorType === "ZeroDivisionError") {
    return `Check that the divisor is not zero before dividing, or catch ZeroDivisionError with try/except. ${hint}`;
  }
  return hint;
}

function explainError(error, code, fallbackLine, hint) {
  const message = error.message || String(error);
  const lineNumber = getErrorLine(message, code) || fallbackLine;
  const errorType = Object.keys(errorExplanations).find((type) => message.includes(type));
  const explanation = errorType
    ? `Cause (${errorType}): ${errorExplanations[errorType]}`
    : `Python reported an error: ${message.split("\n").reverse().find((line) => line.trim()) || "Check the traceback."}`;
  const sourceLine = code.split("\n")[lineNumber - 1] || "";
  const suggestion = suggestErrorFix(errorType, sourceLine, message, hint);
  return `Not quite. ${explanation}\nLine ${lineNumber}${sourceLine.trim() ? `: ${sourceLine.trim()}` : ""}\nTry this: ${suggestion}`;
}

function updateProgress() {
  const completed = solvedChallenges.size;
  const total = challengeCards.length;
  progressTrack.setAttribute("aria-valuemax", total);
  progressTrack.setAttribute("aria-valuenow", completed);
  progressFill.style.width = `${(completed / total) * 100}%`;
  progressLabel.textContent = completed === total
    ? `All ${total} challenges complete — you did it! 🎉`
    : `${completed} of ${total} challenges complete — every little step counts! 🌱`;

  if (completed === total) {
    completionBanner.hidden = false;
    completionBanner.classList.remove("celebrate");
    void completionBanner.offsetWidth;
    completionBanner.classList.add("celebrate");
    completionBanner.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    completionBanner.hidden = true;
    completionBanner.classList.remove("celebrate");
  }
}

challengeCards.forEach((card) => {
  card.addEventListener("input", () => {
    if (solvedChallenges.delete(card)) {
      card.classList.remove("solved");
      updateProgress();
    }
    const feedback = card.querySelector(".feedback");
    if (feedback.classList.contains("success") || feedback.classList.contains("error")) {
      feedback.textContent = "Code changed. Check your answer when you are ready.";
      feedback.classList.remove("success", "error");
    }
  });
});

challengeCards.forEach((card) => {
  const editor = card.querySelector(".code-editor");
  const feedback = card.querySelector(".feedback");
  const checkButton = card.querySelector(".check-button");
  const resetButton = card.querySelector(".reset-button");
  const initialCode = "";

  resetButton.addEventListener("click", () => {
    editor.value = initialCode;
    if (solvedChallenges.delete(card)) {
      card.classList.remove("solved");
      updateProgress();
    }
    feedback.textContent = "Editor cleared. Write your solution, then check it.";
    feedback.classList.remove("success", "error");
  });

  editor.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.setRangeText("    ", start, end, "end");
  });

  checkButton.addEventListener("click", async () => {
    if (isRunning) return;
    const code = editor.value;
    feedback.classList.remove("success", "error");
    if (!code.trim()) {
      feedback.textContent = "Write some Python code in the editor first. The question above describes what your code should do.";
      feedback.classList.add("error");
      return;
    }

    isRunning = true;
    challengeCards.forEach((item) => {
      item.querySelector(".check-button").disabled = true;
    });
    feedback.textContent = "Running your code…";

    const output = [];
    try {
      const pyodide = await loadPython();
      pyodide.setStdout({ batched: (text) => output.push(text) });
      pyodide.setStderr({ batched: (text) => output.push(text) });
      await pyodide.runPythonAsync(code);
      const actual = output.join("").trim();
      if (actual === card.dataset.expected) {
        feedback.textContent = "👏 Correct! Your code works. Keep that brilliant momentum going! ✨";
        feedback.classList.add("success");
        card.classList.add("solved");
        solvedChallenges.add(card);
        updateProgress();
      } else {
        solvedChallenges.delete(card);
        card.classList.remove("solved");
        updateProgress();
        const lineNumber = getOutputLine(code, Number(card.dataset.answerLine));
        const sourceLine = code.split("\n")[lineNumber - 1] || "";
        const cause = card.dataset.logicCause || "The code ran, but its result did not match the requested result.";
        const fix = card.dataset.logicFix || card.dataset.hint;
        feedback.textContent = `Logic error: ${cause}\nYour output: ${actual || "empty"}; expected: ${card.dataset.expected}.\nReview line ${lineNumber}${sourceLine.trim() ? `: ${sourceLine.trim()}` : ""}\nTry this: ${fix}`;
        feedback.classList.add("error");
      }
      runtimeStatus.textContent = "Python is ready. Try another challenge.";
    } catch (error) {
      solvedChallenges.delete(card);
      card.classList.remove("solved");
      updateProgress();
      feedback.textContent = explainError(error, code, Number(card.dataset.answerLine), card.dataset.hint);
      feedback.classList.add("error");
      runtimeStatus.textContent = "Python found an error. Read the line-specific feedback and try again.";
    } finally {
      isRunning = false;
      challengeCards.forEach((item) => {
        item.querySelector(".check-button").disabled = false;
      });
    }
  });
});

document.querySelector("#celebrate-again").addEventListener("click", () => {
  completionBanner.classList.remove("celebrate");
  void completionBanner.offsetWidth;
  completionBanner.classList.add("celebrate");
});
