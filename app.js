// Prompt Library App

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("prompt-form");
  const titleInput = document.getElementById("prompt-title");
  const contentInput = document.getElementById("prompt-content");
  const promptsList = document.getElementById("prompts-list");

  function getPrompts() {
    return JSON.parse(localStorage.getItem("prompts") || "[]");
  }

  function savePrompts(prompts) {
    localStorage.setItem("prompts", JSON.stringify(prompts));
  }

  function renderPrompts() {
    const prompts = getPrompts();
    promptsList.innerHTML = "";
    if (prompts.length === 0) {
      promptsList.innerHTML =
        '<p style="color:#64748b;">No prompts saved yet.</p>';
      return;
    }
    prompts.forEach((prompt, idx) => {
      const card = document.createElement("div");
      card.className = "prompt-card";

      const title = document.createElement("div");
      title.className = "prompt-title";
      title.textContent = prompt.title;

      const preview = document.createElement("div");
      preview.className = "prompt-preview";
      preview.textContent = prompt.content.split(" ").slice(0, 8).join(" ");
      if (prompt.content.split(" ").length > 8) preview.textContent += "...";

      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", function () {
        deletePrompt(idx);
      });

      card.appendChild(title);
      card.appendChild(preview);
      card.appendChild(delBtn);
      promptsList.appendChild(card);
    });
  }

  function deletePrompt(idx) {
    const prompts = getPrompts();
    prompts.splice(idx, 1);
    savePrompts(prompts);
    renderPrompts();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    if (!title || !content) return;
    const prompts = getPrompts();
    prompts.push({ title, content });
    savePrompts(prompts);
    renderPrompts();
    form.reset();
    titleInput.focus();
  });

  renderPrompts();
});
