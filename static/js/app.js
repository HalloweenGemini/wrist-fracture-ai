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

      // Two-row label: #01  fx 5% · simple 100%
      const idx = String(i + 1).padStart(2, "0");
      const label = `Nº${idx}  fx ${(d.det_conf * 100).toFixed(0)}% · ${d.class_name} ${(d.class_conf * 100).toFixed(0)}%`;
      const pad = 6;
      const metrics = ctx.measureText(label);
      const lbW = metrics.width + pad * 2;
      const lbH = 20;
      const lx = X;
      const ly = Math.max(0, Y - lbH - 2);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(lx - 1, ly - 1, lbW + 2, lbH + 2);
      ctx.fillStyle = d.class_color;
      ctx.fillRect(lx, ly, lbW, lbH);
      ctx.fillStyle = "#0a0d12";
      ctx.fillText(label, lx + pad, ly + 3);
    });
  };

  const TIER = (det) => {
    if (det < 0.25) return { key: "low",  label: "low confidence" };
    if (det < 0.50) return { key: "mid",  label: "moderate" };
    return                { key: "high", label: "high confidence" };
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
      const card = node.querySelector('[data-role="card"]');
      card.style.animationDelay = (i * 60) + "ms";

      const idx = String(i + 1).padStart(2, "0");
      node.querySelector('[data-role="idx"]').textContent = idx;

      const tier = TIER(det.det_conf);
      const tierEl = node.querySelector('[data-role="tier"]');
      tierEl.textContent = tier.label;
      tierEl.classList.add(tier.key);

      const detNumEl = node.querySelector('[data-role="det-num"]');
      const typeNumEl = node.querySelector('[data-role="type-num"]');
      const typeNameEl = node.querySelector('[data-role="type-name"]');

      const detPct  = +(det.det_conf  * 100).toFixed(1);
      const typePct = +(det.class_conf * 100).toFixed(1);

      detNumEl.textContent  = detPct.toFixed(1);
      typeNumEl.textContent = typePct.toFixed(1);
      typeNameEl.textContent = det.class_name;

      const typeSection = node.querySelector('[data-role="type-section"]');
      typeSection.style.setProperty("--gauge-color", det.class_color);
      typeSection.style.setProperty("--fill-color",  det.class_color);

      // Joint prob (det × class)
      const joint = (det.det_conf * det.class_conf * 100).toFixed(2);
      node.querySelector('[data-role="joint"]').textContent = joint + "%";

      const [x1, y1, x2, y2] = det.bbox;
      node.querySelector('[data-role="bbox"]').textContent =
        `${x1}, ${y1} → ${x2}, ${y2}  (${x2 - x1}×${y2 - y1})`;

      // Per-class breakdown
      const bd = node.querySelector('[data-role="breakdown"]');
      [["occult","#F5B700"], ["simple","#FF6B35"], ["comminuted","#D62828"]].forEach(([name, color]) => {
        const p = det.probs[name] || 0;
        const row = document.createElement("div");
        row.className = "bd-row" + (name === det.class_name ? " is-predicted" : "");
        row.style.setProperty("--c", color);
        row.innerHTML = `
          <span class="bd-marker"></span>
          <span class="bd-label">${name}</span>
          <span class="bd-track"><span class="bd-fill"></span></span>
          <span class="bd-val">${(p * 100).toFixed(1)}%</span>
        `;
        bd.appendChild(row);
      });

      els.results.appendChild(node);

      // Animate the fills on the next tick so the transitions trigger
      requestAnimationFrame(() => {
        node.parentNode && null;  // no-op; node was appended, re-query
      });
    });

    // Kick off width transitions after DOM insertion (double-RAF ensures paint)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      els.results.querySelectorAll('[data-role="det-fill"]').forEach((el, i) => {
        const d = data.detections[i];
        el.style.width = Math.min(100, d.det_conf * 100) + "%";
      });
      els.results.querySelectorAll('[data-role="type-fill"]').forEach((el, i) => {
        const d = data.detections[i];
        el.style.width = Math.min(100, d.class_conf * 100) + "%";
      });
      els.results.querySelectorAll(".bd-row").forEach((row) => {
        const val = parseFloat(row.querySelector(".bd-val").textContent);
        row.querySelector(".bd-fill").style.width = val + "%";
      });
    }));
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
