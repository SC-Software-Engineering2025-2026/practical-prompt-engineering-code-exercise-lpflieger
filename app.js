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

      // --- 5-star rating UI ---
      const ratingWrap = document.createElement("div");
      ratingWrap.className = "star-rating";
      const avgRating = prompt.rating || 0;
      const ratingCount = prompt.ratingCount || 0;
      // Get user's rating for this prompt (by index, for demo)
      const userRatings = JSON.parse(
        localStorage.getItem("userRatings") || "{}",
      );
      const userRating = userRatings[prompt.id || idx] || 0;
      for (let i = 1; i <= 5; i++) {
        const star = document.createElement("span");
        star.className = "star" + (i <= Math.round(avgRating) ? " filled" : "");
        star.textContent = "★";
        star.tabIndex = 0;
        star.setAttribute("aria-label", `Rate ${i} star${i > 1 ? "s" : ""}`);
        // Highlight on hover/focus
        star.addEventListener("mouseenter", () =>
          highlightStars(ratingWrap, i),
        );
        star.addEventListener("mouseleave", () =>
          highlightStars(ratingWrap, Math.round(avgRating)),
        );
        star.addEventListener("focus", () => highlightStars(ratingWrap, i));
        star.addEventListener("blur", () =>
          highlightStars(ratingWrap, Math.round(avgRating)),
        );
        // Click to rate
        star.addEventListener("click", () => handleRate(idx, i));
        star.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleRate(idx, i);
          }
        });
        ratingWrap.appendChild(star);
      }
      // Show average and count
      const countSpan = document.createElement("span");
      countSpan.className = "rating-count";
      countSpan.textContent =
        ratingCount > 0
          ? `${avgRating.toFixed(1)} (${ratingCount})`
          : "Not rated";
      ratingWrap.appendChild(countSpan);

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
      card.appendChild(ratingWrap);
      card.appendChild(preview);
      card.appendChild(delBtn);
      promptsList.appendChild(card);
    });
    // Helper: highlight stars on hover/focus
    function highlightStars(ratingWrap, n) {
      const stars = ratingWrap.querySelectorAll(".star");
      stars.forEach((star, i) => {
        if (i < n) star.classList.add("filled");
        else star.classList.remove("filled");
      });
    }
    // Handle rating click
    function handleRate(idx, rating) {
      const prompts = getPrompts();
      const prompt = prompts[idx];
      // Update average rating
      if (!prompt.ratingCount) prompt.ratingCount = 0;
      if (!prompt.rating) prompt.rating = 0;
      prompt.rating =
        (prompt.rating * prompt.ratingCount + rating) /
        (prompt.ratingCount + 1);
      prompt.ratingCount += 1;
      savePrompts(prompts);
      // Save user rating (by prompt id or idx)
      const userRatings = JSON.parse(
        localStorage.getItem("userRatings") || "{}",
      );
      userRatings[prompt.id || idx] = rating;
      localStorage.setItem("userRatings", JSON.stringify(userRatings));
      renderPrompts();
    }
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
    // Assign a unique id for rating tracking
    const id = "prompt-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
    prompts.push({ id, title, content, rating: 0, ratingCount: 0 });
    savePrompts(prompts);
    renderPrompts();
    form.reset();
    titleInput.focus();
  });

  renderPrompts();
});
