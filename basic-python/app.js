const starterCode = `name = "Python learner"
print("Hello, " + name + "!")

for step in range(1, 4):
    print("Practice step", step)`;

const examples = {
  hello: `print("Hello, world!")`,
  variables: `name = "Mina"
print(name)`,
  condition: `age = 12
if age >= 10:
    print("Ready!")`,
  loop: `for number in range(3):
    print(number)`,
  list: `colors = ["blue", "gold"]
print(colors[0])`,
  function: `def greet():
    print("Hi!")

greet()`
};

const editor = document.querySelector("#code-editor");
const output = document.querySelector("#code-output");
const status = document.querySelector("#runner-status");
const runButton = document.querySelector("#run-code");
let pythonRuntime;
let runtimePromise;
let isRunning = false;

async function loadPython() {
  if (pythonRuntime) return pythonRuntime;
  if (!runtimePromise) {
    status.textContent = "Loading Python for the first time…";
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

runButton.addEventListener("click", async () => {
  if (isRunning) return;
  isRunning = true;
  runButton.disabled = true;
  runButton.innerHTML = '<span aria-hidden="true">…</span> Running';
  output.textContent = "";
  try {
    const pyodide = await loadPython();
    pyodide.setStdout({ batched: (text) => appendOutput(text) });
    pyodide.setStderr({ batched: (text) => appendOutput(text) });
    status.textContent = "Running your code…";
    await pyodide.runPythonAsync(editor.value);
    if (!output.textContent) output.textContent = "Code finished without printing anything.";
    status.textContent = "Done. Change something and run it again!";
  } catch (error) {
    appendOutput(error.message || String(error));
    status.textContent = "Something needs fixing. Check the error above and try again.";
  } finally {
    isRunning = false;
    runButton.disabled = false;
    runButton.innerHTML = '<span aria-hidden="true">▶</span> Run code';
  }
});

function appendOutput(text) {
  output.textContent += `${text}\n`;
}

document.querySelector("#reset-code").addEventListener("click", () => {
  editor.value = starterCode;
  output.textContent = "Your result will appear here.";
  status.textContent = pythonRuntime ? "Ready when you are." : "Python loads when you run code for the first time.";
});

document.querySelectorAll(".load-example").forEach((button) => {
  button.addEventListener("click", () => {
    editor.value = examples[button.dataset.example];
    output.textContent = "Example loaded. Press Run code to see what it does.";
    status.textContent = "Example loaded in the editor.";
    document.querySelector("#playground").scrollIntoView({ behavior: "smooth" });
    editor.focus({ preventScroll: true });
  });
});

editor.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    runButton.click();
  }
});

const quiz = document.querySelector(".quiz");
const feedback = document.querySelector("#quiz-feedback");
quiz.querySelectorAll(".quiz-option").forEach((button) => {
  button.addEventListener("click", () => {
    quiz.querySelectorAll(".quiz-option").forEach((option) => {
      option.classList.remove("correct", "incorrect");
    });
    if (button.dataset.choice === quiz.dataset.answer) {
      button.classList.add("correct");
      feedback.textContent = "That's it! print(5) displays the number five.";
    } else {
      button.classList.add("incorrect");
      feedback.textContent = "Not quite. Python uses print(...) to display a value. Try again!";
    }
  });
});
