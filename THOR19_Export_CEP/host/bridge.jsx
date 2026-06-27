/**
 * bridge.jsx
 * THOR19 Export — ExtendScript Bridge
 *
 * This file exposes three global functions that are called from main.js
 * via CSInterface.evalScript():
 *
 *   thor19_getDocumentStatus()  → JSON string  { ok, docName, docPath }
 *   thor19_selectFolder()       → JSON string  { ok, path } or { ok:false, error }
 *   thor19_exportScene(folder)  → JSON string  { ok, layerCount, pathCount, outputPath, artboardName }
 *                                           or  { ok:false, error }
 *
 * ALL export logic lives in THOR19_Export.jsx (loaded via #include below).
 * This file only provides the CEP communication layer.
 * The original export logic is NOT modified in any way.
 *
 * NOTE: ExtendScript uses ES3. No arrow functions, const/let, template strings, etc.
 */

// ── CEP mode flag ─────────────────────────────────────────
// Must be set BEFORE #include so that THOR19_Export.jsx's
// standalone IIFE sees the flag and exits without executing.
var THOR19_CEP_MODE = true;

// ── Load the original export logic unchanged ──────────────
// #include resolves relative to this file (host/bridge.jsx)
// THOR19_Export.jsx is in ../jsx/
#include "../jsx/THOR19_Export.jsx"

// ─────────────────────────────────────────────────────────
//  JSON helper (bridge-local, minimal)
//  The main toJSON() lives in THOR19_Export.jsx.
//  This helper is for bridge response objects only.
// ─────────────────────────────────────────────────────────

/**
 * Minimal JSON encoder for bridge response objects.
 * Response objects are small flat structures (no nesting needed).
 *
 * @param {object} obj - Plain object with string/number/boolean values.
 * @returns {string}
 */
function bridgeJSON(obj) {
    var parts = [];
    for (var k in obj) {
        if (!obj.hasOwnProperty(k)) { continue; }
        var v = obj[k];
        var encoded;
        if (v === null || v === undefined) {
            encoded = "null";
        } else if (typeof v === "boolean") {
            encoded = v ? "true" : "false";
        } else if (typeof v === "number") {
            encoded = (isNaN(v) || !isFinite(v)) ? "0" : String(v);
        } else {
            // string — escape backslashes and double-quotes
            encoded = "\"" + String(v)
                .replace(/\\/g, "\\\\")
                .replace(/"/g, "\\\"")
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r")
                + "\"";
        }
        parts.push("\"" + k + "\": " + encoded);
    }
    return "{" + parts.join(", ") + "}";
}

// ─────────────────────────────────────────────────────────
//  thor19_getDocumentStatus
// ─────────────────────────────────────────────────────────

/**
 * Return status of the currently active Illustrator document.
 * Called by main.js on panel init and on document events.
 *
 * @returns {string} JSON: { ok:true, docName, docPath }
 *                      or { ok:false, error }
 */
function thor19_getDocumentStatus() {
    try {
        if (app.documents.length === 0) {
            return bridgeJSON({ ok: false, error: "No document is open." });
        }

        var doc     = app.activeDocument;
        var docName = doc.name || "Untitled";
        var docPath = "";

        try {
            if (doc.fullName) {
                docPath = doc.fullName.fsName;
            }
        } catch (e) {
            docPath = "(not saved)";
        }

        return bridgeJSON({ ok: true, docName: docName, docPath: docPath });

    } catch (e) {
        return bridgeJSON({ ok: false, error: "Error: " + e.message });
    }
}

// ─────────────────────────────────────────────────────────
//  thor19_selectFolder
// ─────────────────────────────────────────────────────────

/**
 * Open a native folder-picker dialog via ExtendScript's Folder.selectDialog().
 * Returns the absolute platform path the user selected, or an error if
 * the dialog was cancelled.
 *
 * @returns {string} JSON: { ok:true, path:"..." }
 *                      or { ok:false, error:"..." }
 */
function thor19_selectFolder() {
    try {
        var selectedFolder = Folder.selectDialog("Select output folder for thor19_scene.json");

        if (!selectedFolder) {
            // User cancelled
            return bridgeJSON({ ok: false, error: "Cancelled" });
        }

        var folderPath = selectedFolder.fsName;
        if (!folderPath) {
            return bridgeJSON({ ok: false, error: "Could not resolve folder path." });
        }

        return bridgeJSON({ ok: true, path: folderPath });

    } catch (e) {
        return bridgeJSON({ ok: false, error: "Folder dialog error: " + e.message });
    }
}

// ─────────────────────────────────────────────────────────
//  thor19_exportScene
// ─────────────────────────────────────────────────────────

/**
 * Run the full THOR19 export using the original logic from THOR19_Export.jsx.
 *
 * The ONLY difference from the original script is that the output path is
 * determined by the folder argument passed from the UI, rather than being
 * derived from the document path.
 *
 * ALL other logic (UUID, coordinate conversion, path extraction, compound
 * path handling, layer walker, artboard extraction, JSON serialiser) is
 * called here without modification — the functions are defined in the
 * #include'd THOR19_Export.jsx.
 *
 * @param  {string} outputFolder - Absolute path to the desired output folder.
 *                                 Forward or back slashes accepted.
 * @returns {string} JSON result.
 */
function thor19_exportScene(outputFolder) {
    try {

        // ── Guard: document must be open ─────────────────────
        if (app.documents.length === 0) {
            return bridgeJSON({ ok: false, error: "No document is open. Please open an Illustrator document." });
        }

        var doc = app.activeDocument;

        // ── Guard: document must have a valid source path ────
        // (Needed for source_file field in the scene object, not for output.)
        var docFile;
        try {
            docFile = doc.fullName;
        } catch (eDocFile) {
            return bridgeJSON({ ok: false, error: "Could not read document path. Please save the document first." });
        }

        if (!docFile) {
            return bridgeJSON({ ok: false, error: "Document has not been saved. Please save the document first." });
        }

        // ── Validate output folder ────────────────────────────
        if (!outputFolder || outputFolder === "" || outputFolder === "undefined") {
            return bridgeJSON({ ok: false, error: "No output folder provided." });
        }

        // Normalise path separators (CEP may send forward slashes on Windows)
        // ExtendScript's Folder/File constructors accept both on all platforms.
        var folderObj = new Folder(outputFolder);
        if (!folderObj.exists) {
            return bridgeJSON({ ok: false, error: "Output folder does not exist: " + outputFolder });
        }

        // Build final output path: folder + OS separator + filename
        var outputPath = folderObj.fsName + "/" + "thor19_scene.json";

        // ── Active artboard ───────────────────────────────────
        // (uses extractArtboard from THOR19_Export.jsx — unchanged)
        var activeArtboardIndex = doc.artboards.getActiveArtboardIndex();
        var activeArtboard      = doc.artboards[activeArtboardIndex];
        var artboardData        = extractArtboard(activeArtboard);

        // Build artboard rect for coordinate conversion
        // (same pattern as the original main() — unchanged)
        var abRect = {
            left:   activeArtboard.artboardRect[0],
            top:    activeArtboard.artboardRect[1],
            right:  activeArtboard.artboardRect[2],
            bottom: activeArtboard.artboardRect[3]
        };

        // ── Walk layers ───────────────────────────────────────
        // (uses walkLayer from THOR19_Export.jsx — unchanged)
        var layersArray = [];
        var pathsArray  = [];
        var docLayers   = doc.layers;

        for (var li = 0; li < docLayers.length; li++) {
            walkLayer(docLayers[li], null, abRect, layersArray, pathsArray);
        }

        // ── Assemble scene object ─────────────────────────────
        // (identical structure to the original — no fields changed)
        var scene = {
            version:     "1.0",
            generator:   "THOR19_Export.jsx",
            source_file: docFile.fsName,
            artboard:    artboardData,
            layers:      layersArray,
            paths:       pathsArray
        };

        // ── Serialise ─────────────────────────────────────────
        // (uses toJSON from THOR19_Export.jsx — unchanged)
        var jsonString;
        try {
            jsonString = toJSON(scene, 0);
        } catch (eJSON) {
            return bridgeJSON({ ok: false, error: "JSON serialisation failed: " + eJSON.message });
        }

        // ── Write file ────────────────────────────────────────
        // (uses writeFile from THOR19_Export.jsx — unchanged)
        try {
            writeFile(outputPath, jsonString);
        } catch (eWrite) {
            return bridgeJSON({ ok: false, error: "File write failed: " + eWrite.message + " | Path: " + outputPath });
        }

        // ── Return success payload ────────────────────────────
        return bridgeJSON({
            ok:           true,
            layerCount:   layersArray.length,
            pathCount:    pathsArray.length,
            outputPath:   outputPath,
            artboardName: artboardData.name
        });

    } catch (e) {
        return bridgeJSON({ ok: false, error: "Unexpected export error: " + e.message });
    }
}
