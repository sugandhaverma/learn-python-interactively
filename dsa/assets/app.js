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
  SyntaxError: "Python could not understand this line. Check punctuation, brackets, quotes, and colons.",
  IndentationError: "The spaces at the start of this line do not match the surrounding code block.",
  NameError: "This line uses a name Python does not know. Check spelling and define it before using it.",
  TypeError: "This line combines or uses values of incompatible types.",
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
  return lineNumber && lineNumber <= code.split("\n").length ? lineNumber : null;
}

function explainError(error, code, hint) {
  const message = error.message || String(error);
  const lineNumber = getErrorLine(message, code) || code.split("\n").length;
  const errorType = Object.keys(errorExplanations).find((type) => message.includes(type));
  const explanation = errorType
    ? errorExplanations[errorType]
    : `Python reported an error: ${message.split("\n").reverse().find((line) => line.trim()) || "Check the traceback."}`;
  const sourceLine = code.split("\n")[lineNumber - 1] || "";
  let suggestion = hint;
  if (errorType === "SyntaxError" && /^(if|elif|else|for|while|def|class)\b/.test(sourceLine.trim()) && !sourceLine.trim().endsWith(":")) {
    suggestion = `Add a colon to the end of this line: ${sourceLine.trim()}:`;
  } else if (errorType === "IndentationError") {
    suggestion = "Indent the code inside a loop, condition, or function by four spaces. Press Tab in the editor to insert four spaces.";
  } else if (errorType === "NameError") {
    suggestion = `Check the spelling and capitalization of the name on this line. ${hint}`;
  }
  return `Not quite. Cause (${errorType || "Python error"}): ${explanation}\nCheck line ${lineNumber}${sourceLine.trim() ? `: ${sourceLine.trim()}` : ""}\nTry this: ${suggestion}`;
}

function updateProgress() {
  const completed = solvedChallenges.size;
  const total = challengeCards.length;
  progressTrack.setAttribute("aria-valuemax", total);
  progressTrack.setAttribute("aria-valuenow", completed);
  progressFill.style.width = `${(completed / total) * 100}%`;
  progressLabel.textContent = completed === total
    ? `All ${total} challenges complete — you're a DSA superstar! 🎉`
    : `${completed} of ${total} challenges complete — one clever step at a time! 🌱`;

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
  const editor = card.querySelector(".code-editor");
  const feedback = card.querySelector(".feedback");
  const checkButton = card.querySelector(".check-button");
  const resetButton = card.querySelector(".reset-button");

  card.addEventListener("input", () => {
    if (solvedChallenges.delete(card)) {
      card.classList.remove("solved");
      updateProgress();
    }
    if (feedback.classList.contains("success") || feedback.classList.contains("error")) {
      feedback.textContent = "Code changed. Give it another try when you're ready.";
      feedback.classList.remove("success", "error");
    }
  });

  editor.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.setRangeText("    ", start, end, "end");
  });

  resetButton.addEventListener("click", () => {
    editor.value = "";
    if (solvedChallenges.delete(card)) {
      card.classList.remove("solved");
      updateProgress();
    }
    feedback.textContent = "Editor cleared. You can try a fresh approach!";
    feedback.classList.remove("success", "error");
  });

  checkButton.addEventListener("click", async () => {
    if (isRunning) return;
    const code = editor.value;
    feedback.classList.remove("success", "error");
    if (!code.trim()) {
      feedback.textContent = "Your editor is empty—write your Python idea first, then check it. You can do this! 💪";
      feedback.classList.add("error");
      return;
    }

    isRunning = true;
    challengeCards.forEach((item) => {
      item.querySelector(".check-button").disabled = true;
    });
    feedback.textContent = "Running your code… 🏃";
    const output = [];
    try {
      const pyodide = await loadPython();
      pyodide.setStdout({ batched: (text) => output.push(text) });
      pyodide.setStderr({ batched: (text) => output.push(text) });
      await pyodide.runPythonAsync(code);
      const actual = output.join("\n").replace(/\r\n/g, "\n").replace(/\n+$/, "");
      const expected = card.dataset.expected.replaceAll("|", "\n");
      if (actual === expected) {
        feedback.textContent = "Brilliant! Your code works—keep that momentum going! ✨";
        feedback.classList.add("success");
        card.classList.add("solved");
        solvedChallenges.add(card);
        updateProgress();
      } else {
        solvedChallenges.delete(card);
        card.classList.remove("solved");
        updateProgress();
        const lines = code.split("\n");
        const outputLine = lines.slice().reverse().findIndex((line) => /\bprint\s*\(/.test(line));
        const defaultLine = outputLine >= 0 ? lines.length - outputLine : lines.length;
        const lineNumber = Number(card.dataset.logicLine) || defaultLine;
        const sourceLine = lines[lineNumber - 1] || "";
        feedback.textContent = `Logic puzzle! Your code ran, but the result is different.\nYou got: ${actual || "no output"}; expected: ${expected}.\nReview line ${lineNumber}${sourceLine.trim() ? `: ${sourceLine.trim()}` : ""}\nWhy? ${card.dataset.logicCause}\nTry this: ${card.dataset.logicFix || card.dataset.hint}`;
        feedback.classList.add("error");
      }
      runtimeStatus.textContent = "Python is ready. You're doing great—try another challenge!";
    } catch (error) {
      solvedChallenges.delete(card);
      card.classList.remove("solved");
      updateProgress();
      feedback.textContent = explainError(error, code, card.dataset.hint);
      feedback.classList.add("error");
      runtimeStatus.textContent = "Python found an error. Read the line-specific tip and try again—you've got this!";
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
