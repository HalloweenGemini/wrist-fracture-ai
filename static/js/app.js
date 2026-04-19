/* Wrist Fracture AI – frontend. */
(() => {
  const els = {
    dropZone: document.getElementById("drop-zone"),
    fileInput: document.getElementById("file-input"),
    canvasWrap: document.getElementById("canvas-wrap"),
    dropEmpty: document.querySelector(".drop-empty"),
    preview: document.getElementById("preview"),
    overlay: document.getElementById("overlay"),
    imgSpinner: document.getElementById("img-spinner"),
    status: document.getElementById("status"),
    statusText: document.getElementById("status-text"),
    summary: document.getElementById("summary"),
    results: document.getElementById("results"),
    btnClear: document.getElementById("btn-clear"),
    btnSample: document.getElementById("btn-sample"),
  };

  // Last detection result (used by the resize handler to redraw).
  let lastDetections = null;
  let lastFileMeta = null;

  const setStatus = (text, cls = "") => {
    els.status.className = "status" + (cls ? " " + cls : "");
    els.statusText.textContent = text;
  };

  const clearAll = () => {
    els.canvasWrap.hidden = true;
    els.dropEmpty.hidden = false;
    els.dropZone.classList.remove("has-image");
    els.preview.removeAttribute("src");
    els.overlay.width = 0; els.overlay.height = 0;
    els.imgSpinner.hidden = true;
    els.results.innerHTML = '<div class="placeholder"><div class="placeholder-icon">◎</div><p>Upload an X-ray to see detected fracture regions and type predictions.</p></div>';
    els.summary.textContent = "drop an X-ray to begin";
    els.summary.classList.add("muted");
    setStatus("Ready.");
    els.btnClear.disabled = true;
    lastDetections = null;
    lastFileMeta = null;
  };

  const loadImageFromBlob = (blob) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    els.preview.onload = () => resolve({ url });
    els.preview.onerror = () => reject(new Error("Failed to decode image"));
    els.preview.src = url;
  });

  const drawOverlay = (detections) => {
    const img = els.preview;
    const ov = els.overlay;
    // Match overlay to displayed preview size
    const rect = img.getBoundingClientRect();
    const cssW = rect.width, cssH = rect.height;
    const dpr = window.devicePixelRatio || 1;
    ov.width = cssW * dpr;
    ov.height = cssH * dpr;
    ov.style.width = cssW + "px";
    ov.style.height = cssH + "px";
    ov.style.left = (img.offsetLeft) + "px";
    ov.style.top = (img.offsetTop) + "px";

    const ctx = ov.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const scaleX = cssW / img.naturalWidth;
    const scaleY = cssH / img.naturalHeight;

    ctx.lineWidth = 2;
    ctx.font = "600 13px ui-sans-serif, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textBaseline = "top";

    detections.forEach((d, i) => {
      const [x1, y1, x2, y2] = d.bbox;
      const X = x1 * scaleX, Y = y1 * scaleY;
      const W = (x2 - x1) * scaleX, H = (y2 - y1) * scaleY;
      // Outer dark stroke for contrast on bright regions, then colored stroke
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 4;
      ctx.strokeRect(X, Y, W, H);
      ctx.strokeStyle = d.class_color;
      ctx.lineWidth = 2;
      ctx.shadowColor = d.class_color;
      ctx.shadowBlur = 6;
      ctx.strokeRect(X, Y, W, H);
      ctx.shadowBlur = 0;

      // Label background
      const label = `#${i + 1}  ${d.class_name.toUpperCase()} ${(d.class_conf * 100).toFixed(0)}%`;
      const pad = 5;
      const metrics = ctx.measureText(label);
      const lbW = metrics.width + pad * 2;
      const lbH = 20;
      const lx = X;
      const ly = Math.max(0, Y - lbH - 2);
      // subtle dark border around label for contrast
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(lx - 1, ly - 1, lbW + 2, lbH + 2);
      ctx.fillStyle = d.class_color;
      ctx.fillRect(lx, ly, lbW, lbH);
      ctx.fillStyle = "#0b0f14";
      ctx.fillText(label, lx + pad, ly + 3);
    });
  };

  const renderResults = (data) => {
    els.results.innerHTML = "";
    if (!data.detections || data.detections.length === 0) {
      const d = document.createElement("div");
      d.className = "no-det";
      d.innerHTML = "<strong>No fracture detected</strong><br/><span class=\"muted\">YOLO found no candidate ROIs at conf ≥ 0.05.</span>";
      els.results.appendChild(d);
      return;
    }

    const tmpl = document.getElementById("detection-card-template");
    data.detections.forEach((det, i) => {
      const node = tmpl.content.cloneNode(true);
      const card = node.querySelector(".card");
      card.style.borderLeftColor = det.class_color;

      const badgeDot = node.querySelector('[data-role="badge-dot"]');
      badgeDot.style.color = det.class_color;
      badgeDot.style.background = det.class_color;

      node.querySelector('[data-role="badge-name"]').textContent = det.class_name;
      node.querySelector('[data-role="idx"]').textContent = `#${i + 1}`;
      node.querySelector('[data-role="det-conf"]').textContent = (det.det_conf * 100).toFixed(1) + "%";

      const barRow = node.querySelector('[data-role="bar-row"]');
      // probabilities in fixed order
      ["occult", "simple", "comminuted"].forEach((name) => {
        const p = det.probs[name] || 0;
        const color = name === "occult" ? "#F5B700" :
                      name === "simple" ? "#FF6B35" : "#D62828";
        const row = document.createElement("div");
        row.className = "bar" + (name === det.class_name ? " predicted" : "");
        row.style.color = color;
        row.innerHTML = `
          <div class="bar-label">${name}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${(p * 100).toFixed(1)}%"></div></div>
          <div class="bar-val">${(p * 100).toFixed(1)}%</div>
        `;
        barRow.appendChild(row);
      });

      const [x1, y1, x2, y2] = det.bbox;
      node.querySelector('[data-role="bbox"]').textContent =
        `bbox  [${x1}, ${y1}] → [${x2}, ${y2}]  (${x2 - x1}×${y2 - y1})`;

      els.results.appendChild(node);
    });
  };

  const processFile = async (blob) => {
    if (!blob || !blob.type || !blob.type.startsWith("image/")) {
      setStatus("Not an image file.", "err");
      return;
    }
    try {
      await loadImageFromBlob(blob);
      els.dropEmpty.hidden = true;
      els.canvasWrap.hidden = false;
      els.dropZone.classList.add("has-image");
      els.btnClear.disabled = false;
      lastFileMeta = {
        name: blob.name || "pasted-image.png",
        size: blob.size,
      };

      setStatus("Running YOLO + EfficientNet…", "loading");
      els.summary.textContent = "running inference…";
      els.summary.classList.remove("muted");
      els.imgSpinner.hidden = false;
      els.results.innerHTML = '<div class="placeholder"><div class="placeholder-icon">◎</div><p>Running inference…</p></div>';

      const fd = new FormData();
      fd.append("image", blob, lastFileMeta.name);
      const t0 = performance.now();
      const res = await fetch("/predict", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");
      const dt = ((performance.now() - t0) / 1000).toFixed(2);

      lastDetections = data.detections;
      els.imgSpinner.hidden = true;
      // Wait for image to layout before drawing overlay
      requestAnimationFrame(() => drawOverlay(data.detections));
      renderResults(data);
      const n = data.n_detections;
      const meta = `${data.image_width}×${data.image_height}`;
      els.summary.textContent = n === 0
        ? `no fracture · ${meta} · ${data.elapsed_ms} ms`
        : `${n} detection${n > 1 ? "s" : ""} · ${meta} · ${data.elapsed_ms} ms · ${data.device}`;
      els.summary.classList.remove("muted");
      setStatus(`Done · ${n} detection${n === 1 ? "" : "s"}`, "ok");
    } catch (e) {
      console.error(e);
      els.imgSpinner.hidden = true;
      setStatus("Error: " + e.message, "err");
      els.summary.textContent = "error";
    }
  };

  // File input
  els.fileInput.addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) processFile(f);
  });

  // Drag and drop
  ["dragenter", "dragover"].forEach(ev =>
    els.dropZone.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      els.dropZone.classList.add("drag");
    })
  );
  ["dragleave", "drop"].forEach(ev =>
    els.dropZone.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      els.dropZone.classList.remove("drag");
    })
  );
  els.dropZone.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  });

  // Click the drop-zone empty area to open file picker
  els.dropZone.addEventListener("click", (e) => {
    if (!els.canvasWrap.hidden) return; // don't retrigger picker over preview
    els.fileInput.click();
  });

  // Paste from clipboard (document-level, always works)
  document.addEventListener("paste", async (e) => {
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.type && it.type.startsWith("image/")) {
        const blob = it.getAsFile();
        if (blob) { processFile(blob); return; }
      }
    }
  });

  // Clear
  els.btnClear.addEventListener("click", clearAll);

  // Load bundled sample if present (samples are not shipped with the repo;
  // drop your own X-ray PNGs at static/samples/sample1.png to enable).
  els.btnSample.addEventListener("click", async () => {
    const pick = Math.random() < 0.5 ? "sample1.png" : "sample2.png";
    try {
      setStatus("Loading sample…", "loading");
      const resp = await fetch(`/static/samples/${pick}`);
      if (!resp.ok) throw new Error("no sample bundled — upload your own image");
      const blob = await resp.blob();
      const f = new File([blob], pick, { type: blob.type || "image/png" });
      processFile(f);
    } catch (e) {
      setStatus(e.message, "err");
    }
  });

  // Redraw overlay on resize
  window.addEventListener("resize", () => {
    if (!els.canvasWrap.hidden && lastDetections) {
      drawOverlay(lastDetections);
    }
  });

  // Graceful image error (ignore when src is cleared to empty)
  els.preview.addEventListener("error", () => {
    if (!els.preview.getAttribute("src")) return;
    setStatus("Failed to decode image.", "err");
  });

  // Drop-zone keyboard affordance
  els.dropZone.setAttribute("role", "button");
  els.dropZone.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && els.canvasWrap.hidden) {
      e.preventDefault();
      els.fileInput.click();
    }
  });

  // Enable keyboard: focus drop zone on load
  els.dropZone.focus();

  clearAll();
})();
