// Cycles the hero's quick-entry demo through a few example inputs.
const examples = [
  ["9-13, 14-18:30", "→ 2 sessions · 8h 30m"],
  ["8:45 to 17", "→ 1 session · 8h 15m"],
  ["9am-5pm", "→ 1 session · 8h"],
  ["7h 30m", "→ 7h 30m total"],
];

const input = document.querySelector("[data-typer-input]");
const result = document.querySelector("[data-typer-result]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  let index = 0;
  for (;;) {
    await wait(2600);
    index = (index + 1) % examples.length;
    const [text, parsed] = examples[index];
    result.classList.remove("is-visible");
    for (let i = input.textContent.length; i >= 0; i--) {
      input.textContent = input.textContent.slice(0, i);
      await wait(28);
    }
    for (let i = 1; i <= text.length; i++) {
      input.textContent = text.slice(0, i);
      await wait(70 + Math.random() * 60);
    }
    await wait(250);
    result.textContent = parsed;
    result.classList.add("is-visible");
  }
}

if (input && result && !reduceMotion) {
  result.classList.add("is-visible");
  run();
} else if (result) {
  result.classList.add("is-visible");
}
