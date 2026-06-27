/**
 * main.js
 * THOR19 Export — CEP Panel Controller
 *
 * Handles all UI interactions and communicates with ExtendScript (bridge.jsx)
 * via CSInterface.evalScript().
 *
 * Architecture:
 *   HTML panel  ←→  main.js  ←→  CSInterface  ←→  bridge.jsx  ←→  THOR19_Export.jsx logic
 */

(function () {
  "use strict";

  // ── CSInterface instance ──────────────────────────────────
  var csInterface = new CSInterface();

  // ── DOM references ────────────────────────────────────────
  var statusDot       = document.getElementById("statusDot");
  var statusText      = document.getElementById("statusText");
  var folderPathEl    = document.getElementById("folderPath");
  var btnSelectFolder = document.getElementById("btnSelectFolder");
  var btnExport       = document.getElementById("btnExport");
  var exportHint      = document.getElementById("exportHint");
  var resultSection   = document.getElementById("resultSection");
  var resultCard      = document.getElementById("resultCard");
  var resultHeader    = document.getElementById("resultHeader");
  var resultBody      = document.getElementById("resultBody");
  var logArea         = document.getElementById("logArea");
  var btnClearLog     = document.getElementById("btnClearLog");

  // ── State ─────────────────────────────────────────────────
  var state = {
    outputFolder: null,   // string: absolute path chosen by user
    isExporting:  false
  };

  // ─────────────────────────────────────────────────────────
  //  Logging helpers
  // ─────────────────────────────────────────────────────────

  /**
   * Append a timestamped entry to the log area.
   * @param {string} msg   - Message text
   * @param {string} level - "info" | "success" | "error" | "warn"
   */
  function log(msg, level) {
    level = level || "info";
    var now  = new Date();
    var hh   = String(now.getHours()).padStart(2, "0");
    var mm   = String(now.getMinutes()).padStart(2, "0");
    var ss   = String(now.getSeconds()).padStart(2, "0");
    var ts   = hh + ":" + mm + ":" + ss;

    var entry = document.createElement("div");
    entry.className  = "log-entry log-" + level;
    entry.setAttribute("data-time", "[" + ts + "]");
    entry.textContent = msg;

    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
  }

  // ─────────────────────────────────────────────────────────
  //  Status bar helpers
  // ─────────────────────────────────────────────────────────

  /**
   * Update the status bar.
   * @param {string} text  - Status message
   * @param {string} state - "ready" | "warning" | "error" | "working" | ""
   */
  function setStatus(text, dotState) {
    statusText.textContent = text;
    statusDot.className    = "status-dot" + (dotState ? " " + dotState : "");
  }

  // ─────────────────────────────────────────────────────────
  //  Export button state
  // ─────────────────────────────────────────────────────────

  function updateExportButton() {
    var canExport = !!state.outputFolder && !state.isExporting;
    btnExport.disabled = !canExport;

    if (state.isExporting) {
      btnExport.textContent = "Exporting…";
      btnExport.classList.add("working");
      exportHint.textContent = "";
      exportHint.className   = "hint";
    } else {
      btnExport.innerHTML = '<span class="btn-icon">▶</span> Export Scene';
      btnExport.classList.remove("working");
      if (!state.outputFolder) {
        exportHint.textContent = "Select an output folder to enable export.";
        exportHint.className   = "hint";
      } else {
        exportHint.textContent = "Ready to export to selected folder.";
        exportHint.className   = "hint";
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Result card renderer
  // ─────────────────────────────────────────────────────────

  /**
   * Show the result card with success details.
   * @param {object} data - { layerCount, pathCount, outputPath, artboardName }
   */
  function showSuccess(data) {
    resultSection.style.display = "block";
    resultCard.style.border     = "1px solid var(--success-border)";

    resultHeader.className   = "result-header success";
    resultHeader.textContent = "✓  Export Complete";

    resultBody.innerHTML = [
      row("Artboard",  data.artboardName  || "—"),
      row("Layers",    data.layerCount    || "0"),
      row("Paths",     data.pathCount     || "0"),
      rowFull("Output", data.outputPath   || "—", true)
    ].join('<hr class="sep">');
  }

  /**
   * Show the result card with error details.
   * @param {string} errMsg
   */
  function showError(errMsg) {
    resultSection.style.display = "block";
    resultCard.style.border     = "1px solid var(--error-border)";

    resultHeader.className   = "result-header error";
    resultHeader.textContent = "✗  Export Failed";

    resultBody.innerHTML =
      '<div class="result-row">' +
        '<span class="result-value" style="color:var(--error);text-align:left;word-break:break-word;">' +
          escapeHtml(errMsg) +
        '</span>' +
      '</div>';
  }

  function row(label, value) {
    return '<div class="result-row">' +
      '<span class="result-label">' + escapeHtml(label) + '</span>' +
      '<span class="result-value">' + escapeHtml(String(value)) + '</span>' +
      '</div>';
  }

  function rowFull(label, value, highlight) {
    return '<div class="result-row" style="flex-direction:column;gap:3px;">' +
      '<span class="result-label">' + escapeHtml(label) + '</span>' +
      '<span class="result-value ' + (highlight ? "highlight" : "") + '">' +
        escapeHtml(String(value)) +
      '</span>' +
      '</div>';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ─────────────────────────────────────────────────────────
  //  Folder path display
  // ─────────────────────────────────────────────────────────

  function renderFolderPath(folderPath) {
    if (!folderPath) {
      folderPathEl.innerHTML  = '<span class="folder-path-placeholder">No folder selected</span>';
      folderPathEl.classList.remove("has-path");
      folderPathEl.title      = "";
    } else {
      folderPathEl.textContent = folderPath;
      folderPathEl.classList.add("has-path");
      folderPathEl.title       = folderPath;
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Select Output Folder
  // ─────────────────────────────────────────────────────────

  btnSelectFolder.addEventListener("click", function () {
    log("Opening folder browser…");
    setStatus("Waiting for folder selection…", "working");

    csInterface.evalScript("thor19_selectFolder()", function (result) {
      if (!result || result === "null" || result === "undefined" || result === "EvalScript error.") {
        setStatus("Folder selection cancelled.", "warning");
        log("Folder selection cancelled or failed.", "warn");
        return;
      }

      // bridge returns JSON: { ok: true, path: "..." } or { ok: false, error: "..." }
      var parsed;
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        // Older CEP may return the raw path string directly; handle both
        parsed = { ok: true, path: result };
      }

      if (parsed.ok && parsed.path) {
        state.outputFolder = parsed.path;
        renderFolderPath(state.outputFolder);
        setStatus("Folder selected. Ready to export.", "ready");
        log("Output folder: " + state.outputFolder, "success");
      } else {
        var errMsg = parsed.error || "Unknown error";
        setStatus("Folder selection failed.", "error");
        log("Folder error: " + errMsg, "error");
      }

      updateExportButton();
    });
  });

  // ─────────────────────────────────────────────────────────
  //  Export
  // ─────────────────────────────────────────────────────────

  btnExport.addEventListener("click", function () {
    if (state.isExporting) { return; }
    if (!state.outputFolder) {
      log("Please select an output folder first.", "warn");
      return;
    }

    state.isExporting = true;
    updateExportButton();
    resultSection.style.display = "none";
    setStatus("Exporting scene…", "working");
    log("Starting export…");
    log("Output folder: " + state.outputFolder);

    // Sanitise path for ExtendScript: backslashes are fine in ES, but we
    // pass as a JSON string to avoid quoting issues in evalScript.
    var escapedPath = state.outputFolder.replace(/\\/g, "/");

    // Call bridge function with folder path as argument
    var script = 'thor19_exportScene("' + escapedPath.replace(/"/g, '\\"') + '")';

    csInterface.evalScript(script, function (result) {
      state.isExporting = false;
      updateExportButton();

      if (!result || result === "EvalScript error.") {
        setStatus("Export failed — evalScript error.", "error");
        log("EvalScript communication error. Check that the extension is loaded correctly.", "error");
        showError("EvalScript communication error. Ensure the document is saved and try again.");
        return;
      }

      var parsed;
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        setStatus("Export failed — bad response.", "error");
        log("Could not parse response: " + result, "error");
        showError("Unexpected response from ExtendScript: " + result);
        return;
      }

      if (parsed.ok) {
        setStatus("Export complete.", "ready");
        log("Export successful!", "success");
        log("Artboard : " + (parsed.artboardName || "—"), "success");
        log("Layers   : " + parsed.layerCount, "success");
        log("Paths    : " + parsed.pathCount, "success");
        log("Output   : " + parsed.outputPath, "success");

        showSuccess({
          artboardName: parsed.artboardName,
          layerCount:   parsed.layerCount,
          pathCount:    parsed.pathCount,
          outputPath:   parsed.outputPath
        });
      } else {
        var errMsg = parsed.error || "Unknown error";
        setStatus("Export failed.", "error");
        log("Export error: " + errMsg, "error");
        showError(errMsg);
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  //  Clear Log
  // ─────────────────────────────────────────────────────────

  btnClearLog.addEventListener("click", function () {
    logArea.innerHTML = "";
    log("Log cleared.");
  });

  // ─────────────────────────────────────────────────────────
  //  Panel Initialisation
  // ─────────────────────────────────────────────────────────

  function init() {
    log("THOR19 Export panel initialised.");
    updateExportButton();

    // Check if a document is currently open
    csInterface.evalScript("thor19_getDocumentStatus()", function (result) {
      var parsed;
      try   { parsed = JSON.parse(result); }
      catch (e) { parsed = { ok: false, error: "Could not connect to Illustrator." }; }

      if (parsed && parsed.ok) {
        setStatus("Document: " + (parsed.docName || "Untitled"), "ready");
        log("Active document: " + (parsed.docName || "Untitled"), "success");
        log("Saved at: " + (parsed.docPath || "(not saved)"));
      } else {
        setStatus("No document open.", "warning");
        log("No Illustrator document is open.", "warn");
      }
    });

    // Listen for Illustrator document events (open/close/switch)
    csInterface.addEventListener("documentAfterActivate", function () {
      csInterface.evalScript("thor19_getDocumentStatus()", function (result) {
        var parsed;
        try   { parsed = JSON.parse(result); }
        catch (e) { parsed = null; }

        if (parsed && parsed.ok) {
          setStatus("Document: " + (parsed.docName || "Untitled"), "ready");
          log("Document activated: " + (parsed.docName || "Untitled"), "info");
        } else {
          setStatus("No document open.", "warning");
        }
      });
    });

    csInterface.addEventListener("documentAfterDeactivate", function () {
      setStatus("No active document.", "warning");
    });
  }

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
