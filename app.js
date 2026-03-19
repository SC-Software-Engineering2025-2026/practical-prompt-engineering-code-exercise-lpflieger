// Prompt Library App

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("prompt-form");
  const titleInput = document.getElementById("prompt-title");
  const contentInput = document.getElementById("prompt-content");
  const promptsList = document.getElementById("prompts-list");

  // --- Metadata utilities ---
  function isValidISOString(s) {
    if (typeof s !== "string") return false;
    const t = Date.parse(s);
    if (Number.isNaN(t)) return false;
    return new Date(t).toISOString() === s;
  }

  function validateModelName(name) {
    if (typeof name !== "string" || name.trim() === "")
      throw new Error("Model name must be a non-empty string.");
    if (name.length > 100)
      throw new Error("Model name must be 100 characters or fewer.");
    return name.trim();
  }

  function estimateTokens(text, isCode) {
    try {
      if (typeof text !== "string") throw new Error("Text must be a string.");
      const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
      const chars = text.length;
      let min = 0.75 * words;
      let max = 0.25 * chars;
      if (isCode) {
        min = min * 1.3;
        max = max * 1.3;
      }
      min = Math.ceil(min);
      max = Math.ceil(max);
      const reference = Math.max(min, max);
      let confidence = "high";
      if (reference >= 5000) confidence = "low";
      else if (reference >= 1000) confidence = "medium";
      return { min, max, confidence };
    } catch (e) {
      throw new Error("estimateTokens error: " + e.message);
    }
  }

  function trackModel(modelName, content) {
    try {
      const model = validateModelName(modelName);
      // detect isCode: prefer explicit checkbox if present, else basic heuristic
      let isCode = false;
      const cb = document.getElementById("prompt-is-code");
      if (cb) isCode = !!cb.checked;
      else {
        const codeHints =
          /\b(function|def|class|import|return|console\.|console\b|;|\{|\})\b/;
        isCode = codeHints.test(content);
      }
      const createdAt = new Date().toISOString();
      const tokenEstimate = estimateTokens(content, isCode);
      const metadata = {
        model,
        createdAt,
        updatedAt: createdAt,
        tokenEstimate,
      };
      // validate ISO strings
      if (!isValidISOString(metadata.createdAt))
        throw new Error("createdAt is not a valid ISO 8601 string.");
      if (!isValidISOString(metadata.updatedAt))
        throw new Error("updatedAt is not a valid ISO 8601 string.");
      return metadata;
    } catch (e) {
      throw new Error("trackModel error: " + e.message);
    }
  }

  function updateTimestamps(metadata) {
    try {
      if (!metadata || typeof metadata !== "object")
        throw new Error("metadata must be an object");
      if (!metadata.createdAt || !isValidISOString(metadata.createdAt))
        throw new Error("metadata.createdAt must be a valid ISO 8601 string");
      const now = new Date().toISOString();
      if (Date.parse(now) < Date.parse(metadata.createdAt))
        throw new Error("updatedAt cannot be earlier than createdAt");
      metadata.updatedAt = now;
      if (!isValidISOString(metadata.updatedAt))
        throw new Error("updatedAt is not a valid ISO 8601 string");
      return metadata;
    } catch (e) {
      throw new Error("updateTimestamps error: " + e.message);
    }
  }

  function getPrompts() {
    return JSON.parse(localStorage.getItem("prompts") || "[]");
  }

  function savePrompts(prompts) {
    localStorage.setItem("prompts", JSON.stringify(prompts));
  }

  // --- Export / Import Utilities ---
  function computeStats(prompts) {
    const totalPrompts = prompts.length;
    let ratingSum = 0;
    let ratingCountSum = 0;
    const modelCounts = {};
    prompts.forEach((p) => {
      if (p && typeof p === "object") {
        if (typeof p.rating === "number" && p.ratingCount > 0) {
          ratingSum += p.rating * p.ratingCount;
          ratingCountSum += p.ratingCount;
        }
        try {
          const m = (p.metadata && p.metadata.model) || null;
          if (m) modelCounts[m] = (modelCounts[m] || 0) + 1;
        } catch (e) {}
      }
    });
    const averageRating = ratingCountSum ? ratingSum / ratingCountSum : 0;
    let mostUsedModel = null;
    let topCount = 0;
    Object.keys(modelCounts).forEach((m) => {
      if (modelCounts[m] > topCount) {
        topCount = modelCounts[m];
        mostUsedModel = m;
      }
    });
    return { totalPrompts, averageRating, mostUsedModel };
  }

  function validatePromptShape(p) {
    if (!p || typeof p !== "object")
      throw new Error("Prompt must be an object");
    if (!p.id || typeof p.id !== "string")
      throw new Error("Prompt missing valid 'id'");
    if (!p.title || typeof p.title !== "string")
      throw new Error("Prompt missing valid 'title'");
    if (!p.content || typeof p.content !== "string")
      throw new Error("Prompt missing valid 'content'");
    if (!p.metadata || typeof p.metadata !== "object")
      throw new Error("Prompt missing 'metadata' object");
    if (!p.metadata.model) throw new Error("Prompt metadata missing 'model'");
    if (!isValidISOString(p.metadata.createdAt))
      throw new Error("Prompt.metadata.createdAt must be valid ISO string");
    if (!isValidISOString(p.metadata.updatedAt))
      throw new Error("Prompt.metadata.updatedAt must be valid ISO string");
    return true;
  }

  function gatherExportPayload() {
    const prompts = getPrompts();
    // Validate prompts integrity
    for (let i = 0; i < prompts.length; i++) validatePromptShape(prompts[i]);
    const stats = computeStats(prompts);
    return {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      stats,
      prompts,
      notesByPrompt: getNotesByPrompt(),
      userRatings: JSON.parse(localStorage.getItem("userRatings") || "{}"),
    };
  }

  function downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function exportPromptsHandler() {
    try {
      const payload = gatherExportPayload();
      const fname = `prompts-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      downloadJSON(payload, fname);
      alert("Export created: " + fname);
    } catch (e) {
      console.error(e);
      alert("Export failed: " + (e && e.message ? e.message : e));
    }
  }

  function createBackup() {
    try {
      const backup = {
        createdAt: new Date().toISOString(),
        prompts: getPrompts(),
        notesByPrompt: getNotesByPrompt(),
        userRatings: JSON.parse(localStorage.getItem("userRatings") || "{}"),
      };
      const key = "prompts-backup-" + Date.now();
      localStorage.setItem(key, JSON.stringify(backup));
      localStorage.setItem("prompts-last-backup-key", key);
      return key;
    } catch (e) {
      console.error("Backup failed", e);
      throw new Error("Could not create backup before import: " + e.message);
    }
  }

  function restoreBackup(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) throw new Error("Backup not found: " + key);
      const b = JSON.parse(raw);
      if (b.prompts) savePrompts(b.prompts);
      if (b.notesByPrompt) saveNotesByPrompt(b.notesByPrompt);
      if (b.userRatings)
        localStorage.setItem("userRatings", JSON.stringify(b.userRatings));
      return true;
    } catch (e) {
      console.error("Restore backup failed", e);
      throw e;
    }
  }

  function importPromptsPayload(payload) {
    if (!payload || typeof payload !== "object")
      throw new Error("Invalid payload");
    if (!payload.version) throw new Error("Payload missing version");
    // Accept major version 1
    const major = String(payload.version).split(".")[0];
    if (major !== "1")
      throw new Error("Unsupported export version: " + payload.version);
    if (!payload.prompts || !Array.isArray(payload.prompts))
      throw new Error("Payload missing prompts array");
    // Validate incoming prompts
    for (let i = 0; i < payload.prompts.length; i++)
      validatePromptShape(payload.prompts[i]);

    const existing = getPrompts();
    const existingById = {};
    existing.forEach((p) => (existingById[p.id] = p));
    const duplicates = payload.prompts.filter((p) => existingById[p.id]);

    let action = "skip"; // default
    if (duplicates.length > 0) {
      const ids = duplicates
        .map((d) => d.id)
        .slice(0, 10)
        .join(", ");
      const resp = prompt(
        `Import detected ${duplicates.length} duplicate ID(s): ${ids}. Choose action: replace | skip | keep-both`,
        "skip",
      );
      if (!resp) throw new Error("Import cancelled by user");
      action = resp.trim().toLowerCase();
      if (!["replace", "skip", "keep-both"].includes(action))
        throw new Error("Invalid import action: " + action);
    }

    // Backup before applying
    const backupKey = createBackup();

    try {
      let merged = [...existing];
      const idsSeen = new Set(merged.map((p) => p.id));
      payload.prompts.forEach((imp) => {
        if (!idsSeen.has(imp.id)) {
          merged.push(imp);
          idsSeen.add(imp.id);
        } else {
          if (action === "replace") {
            merged = merged.map((p) => (p.id === imp.id ? imp : p));
          } else if (action === "skip") {
            // do nothing
          } else if (action === "keep-both") {
            const newId =
              imp.id +
              "-import-" +
              Date.now() +
              "-" +
              Math.floor(Math.random() * 10000);
            const copy = { ...imp, id: newId };
            merged.push(copy);
          }
        }
      });
      savePrompts(merged);
      // optionally merge notes and userRatings if present
      if (payload.notesByPrompt) {
        const notes = getNotesByPrompt();
        const mergedNotes = { ...notes, ...payload.notesByPrompt };
        saveNotesByPrompt(mergedNotes);
      }
      if (payload.userRatings) {
        const ur = JSON.parse(localStorage.getItem("userRatings") || "{}");
        const mergedUR = { ...ur, ...payload.userRatings };
        localStorage.setItem("userRatings", JSON.stringify(mergedUR));
      }
      alert("Import successful.");
      renderPrompts();
      return true;
    } catch (e) {
      console.error("Import failed, restoring backup", e);
      try {
        restoreBackup(backupKey);
      } catch (restoreErr) {
        console.error("Rollback failed", restoreErr);
        alert(
          "Import failed and rollback also failed: " +
            (restoreErr.message || restoreErr),
        );
        throw restoreErr;
      }
      alert(
        "Import failed and previous data was restored: " + (e.message || e),
      );
      throw e;
    }
  }

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = function (ev) {
      alert("Failed to read file: " + ev);
    };
    reader.onload = function (e) {
      try {
        const text = e.target.result;
        const payload = JSON.parse(text);
        importPromptsPayload(payload);
      } catch (err) {
        console.error(err);
        alert("Import failed: " + (err && err.message ? err.message : err));
      }
    };
    reader.readAsText(file);
  }

  // Wire up UI buttons
  try {
    const exportBtn = document.getElementById("export-btn");
    const importBtn = document.getElementById("import-btn");
    const importFileInput = document.getElementById("import-file-input");
    if (exportBtn) exportBtn.addEventListener("click", exportPromptsHandler);
    if (importBtn && importFileInput) {
      importBtn.addEventListener("click", () => importFileInput.click());
      importFileInput.addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) handleImportFile(f);
        // clear value so same file can be reselected later
        importFileInput.value = "";
      });
    }
  } catch (e) {
    console.error("Error wiring export/import UI", e);
  }

  function renderPrompts() {
    const prompts = getPrompts();
    // sort by createdAt descending using metadata if present
    prompts.sort((a, b) => {
      const aTime = Date.parse(
        (a.metadata && a.metadata.createdAt) || a.createdAt || 0,
      );
      const bTime = Date.parse(
        (b.metadata && b.metadata.createdAt) || b.createdAt || 0,
      );
      return bTime - aTime;
    });
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

      // Metadata row (model, timestamps, token estimate)
      const metadata = prompt.metadata || prompt.meta || null;
      const metaRow = document.createElement("div");
      metaRow.className = "metadata-row";
      if (metadata && metadata.model) {
        const modelBadge = document.createElement("div");
        modelBadge.className = "model-badge";
        modelBadge.textContent = metadata.model;
        metaRow.appendChild(modelBadge);
      }
      if (metadata && metadata.createdAt) {
        const ts = document.createElement("div");
        ts.className = "timestamps";
        const created = new Date(metadata.createdAt);
        const updated = metadata.updatedAt
          ? new Date(metadata.updatedAt)
          : created;
        ts.textContent = `Created: ${created.toLocaleString()} • Updated: ${updated.toLocaleString()}`;
        metaRow.appendChild(ts);
      }
      if (metadata && metadata.tokenEstimate) {
        const t = metadata.tokenEstimate;
        const badge = document.createElement("div");
        badge.className = `token-estimate confidence-${t.confidence}`;
        badge.textContent = `${t.min}–${t.max} tokens (${t.confidence})`;
        metaRow.appendChild(badge);
      }
      if (metaRow.children.length > 0) card.appendChild(metaRow);

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
      // --- Notes Section ---
      const notesSection = document.createElement("section");
      notesSection.className = "notes-section";
      notesSection.setAttribute("aria-label", "Notes section for this prompt");

      const notesHeader = document.createElement("div");
      notesHeader.className = "notes-header";
      notesHeader.textContent = "Notes";
      notesSection.appendChild(notesHeader);

      // Notes list
      const notesList = document.createElement("ul");
      notesList.className = "notes-list";
      notesList.setAttribute("data-prompt-id", prompt.id);
      notesSection.appendChild(notesList);

      // Render notes for this prompt
      const notesByPrompt = getNotesByPrompt();
      const notes = notesByPrompt[prompt.id] || [];
      notes.forEach((note) => {
        const noteItem = document.createElement("li");
        noteItem.className = "note-item";
        noteItem.setAttribute("data-note-id", note.id);

        // If editing, show textarea
        if (note.editing) {
          const editInput = document.createElement("textarea");
          editInput.className = "add-note-input";
          editInput.value = note.content;
          editInput.rows = 2;
          editInput.setAttribute("aria-label", "Edit note");
          noteItem.appendChild(editInput);

          const actions = document.createElement("div");
          actions.className = "note-actions";

          const saveBtn = document.createElement("button");
          saveBtn.className = "note-btn";
          saveBtn.textContent = "Save";
          saveBtn.setAttribute("aria-label", "Save note");
          saveBtn.addEventListener("click", () =>
            saveEditNote(prompt.id, note.id, editInput.value),
          );
          actions.appendChild(saveBtn);

          const cancelBtn = document.createElement("button");
          cancelBtn.className = "note-btn";
          cancelBtn.textContent = "Cancel";
          cancelBtn.setAttribute("aria-label", "Cancel editing note");
          cancelBtn.addEventListener("click", () =>
            cancelEditNote(prompt.id, note.id),
          );
          actions.appendChild(cancelBtn);

          noteItem.appendChild(actions);
        } else {
          const contentDiv = document.createElement("div");
          contentDiv.className = "note-content";
          contentDiv.textContent = note.content;
          noteItem.appendChild(contentDiv);

          const timestamp = document.createElement("span");
          timestamp.className = "note-timestamp";
          timestamp.textContent = formatTimestamp(note.lastEdited);
          noteItem.appendChild(timestamp);

          const actions = document.createElement("div");
          actions.className = "note-actions";

          const editBtn = document.createElement("button");
          editBtn.className = "note-btn";
          editBtn.textContent = "Edit";
          editBtn.setAttribute("aria-label", "Edit note");
          editBtn.addEventListener("click", () =>
            startEditNote(prompt.id, note.id),
          );
          actions.appendChild(editBtn);

          const delBtn = document.createElement("button");
          delBtn.className = "note-btn";
          delBtn.textContent = "Delete";
          delBtn.setAttribute("aria-label", "Delete note");
          delBtn.addEventListener("click", () =>
            deleteNote(prompt.id, note.id),
          );
          actions.appendChild(delBtn);

          noteItem.appendChild(actions);
        }
        notesList.appendChild(noteItem);
      });

      // Add note form
      const addNoteForm = document.createElement("form");
      addNoteForm.className = "add-note-form";
      addNoteForm.setAttribute("autocomplete", "off");
      addNoteForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const input = addNoteForm.querySelector(".add-note-input");
        const value = input.value.trim();
        if (!value) return;
        addNote(prompt.id, value);
        input.value = "";
      });
      const addNoteInput = document.createElement("input");
      addNoteInput.className = "add-note-input";
      addNoteInput.type = "text";
      addNoteInput.maxLength = 300;
      addNoteInput.setAttribute("aria-label", "Add note");
      addNoteInput.required = true;
      addNoteForm.appendChild(addNoteInput);
      const addNoteBtn = document.createElement("button");
      addNoteBtn.className = "add-note-btn";
      addNoteBtn.type = "submit";
      addNoteBtn.textContent = "Add Note";
      addNoteForm.appendChild(addNoteBtn);
      notesSection.appendChild(addNoteForm);

      card.appendChild(notesSection);
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

  // --- Notes Section Logic ---
  function getNotesByPrompt() {
    try {
      return JSON.parse(localStorage.getItem("notesByPrompt") || "{}") || {};
    } catch {
      return {};
    }
  }
  function saveNotesByPrompt(notesByPrompt) {
    try {
      localStorage.setItem("notesByPrompt", JSON.stringify(notesByPrompt));
    } catch (e) {
      alert("Error saving notes: localStorage quota exceeded.");
    }
  }
  function addNote(promptId, content) {
    const notesByPrompt = getNotesByPrompt();
    const note = {
      id: "note-" + Date.now() + "-" + Math.floor(Math.random() * 10000),
      content,
      lastEdited: Date.now(),
    };
    if (!notesByPrompt[promptId]) notesByPrompt[promptId] = [];
    notesByPrompt[promptId].push(note);
    saveNotesByPrompt(notesByPrompt);
    renderPrompts();
    flashNoteSaved(promptId, note.id);
  }
  function startEditNote(promptId, noteId) {
    const notesByPrompt = getNotesByPrompt();
    notesByPrompt[promptId] = (notesByPrompt[promptId] || []).map((n) =>
      n.id === noteId ? { ...n, editing: true } : { ...n, editing: false },
    );
    saveNotesByPrompt(notesByPrompt);
    renderPrompts();
  }
  function saveEditNote(promptId, noteId, newContent) {
    const notesByPrompt = getNotesByPrompt();
    notesByPrompt[promptId] = (notesByPrompt[promptId] || []).map((n) =>
      n.id === noteId
        ? { ...n, content: newContent, lastEdited: Date.now(), editing: false }
        : { ...n, editing: false },
    );
    saveNotesByPrompt(notesByPrompt);
    renderPrompts();
    flashNoteSaved(promptId, noteId);
  }
  function cancelEditNote(promptId, noteId) {
    const notesByPrompt = getNotesByPrompt();
    notesByPrompt[promptId] = (notesByPrompt[promptId] || []).map((n) =>
      n.id === noteId ? { ...n, editing: false } : n,
    );
    saveNotesByPrompt(notesByPrompt);
    renderPrompts();
  }
  function deleteNote(promptId, noteId) {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    const notesByPrompt = getNotesByPrompt();
    notesByPrompt[promptId] = (notesByPrompt[promptId] || []).filter(
      (n) => n.id !== noteId,
    );
    saveNotesByPrompt(notesByPrompt);
    renderPrompts();
  }
  function formatTimestamp(ts) {
    const d = new Date(ts);
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0") +
      " " +
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0")
    );
  }
  function flashNoteSaved(promptId, noteId) {
    setTimeout(() => {
      const card = document.querySelector(
        `.notes-list[data-prompt-id='${promptId}'] [data-note-id='${noteId}'] .note-content`,
      );
      if (card) {
        card.classList.add("note-saved");
        setTimeout(() => card.classList.remove("note-saved"), 700);
      }
    }, 50);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    if (!title || !content) return;
    const modelInput = document.getElementById("prompt-model");
    const modelName = modelInput ? modelInput.value.trim() : "";
    try {
      const prompts = getPrompts();
      // Assign a unique id for rating tracking
      const id =
        "prompt-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
      // build metadata using trackModel (auto-created timestamps and estimate)
      const metadata = trackModel(modelName, content);
      prompts.push({ id, title, content, rating: 0, ratingCount: 0, metadata });
      savePrompts(prompts);
      renderPrompts();
      form.reset();
      titleInput.focus();
    } catch (err) {
      console.error(err);
      alert(
        "Could not save prompt: " + (err && err.message ? err.message : err),
      );
    }
  });

  renderPrompts();
});
