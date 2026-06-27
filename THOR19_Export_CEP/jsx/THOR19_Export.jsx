/**
 * THOR19_Export.jsx
 * Adobe Illustrator → Blender Vector Bridge
 *
 * Exports the active Illustrator document to thor19_scene.json,
 * saved next to the .ai file. Captures layers/sublayers, bezier
 * paths, compound paths, anchor/handle data, and the active
 * artboard geometry.
 *
 * Tested against Adobe Illustrator CC 2019–2025 (ExtendScript).
 */

// ─────────────────────────────────────────────────────────────
//  UUID v4  (pure ExtendScript — no crypto API available)
// ─────────────────────────────────────────────────────────────

/**
 * Generate a RFC 4122 version-4 UUID using Math.random().
 * ExtendScript has no native crypto, so Math.random() is used.
 * Sufficient for file-scope unique identifiers.
 *
 * @returns {string} UUID v4 string, e.g. "110e8400-e29b-41d4-a716-446655440000"
 */
function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = Math.floor(Math.random() * 16);
        var v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// ─────────────────────────────────────────────────────────────
//  Number helpers
// ─────────────────────────────────────────────────────────────

/**
 * Round a floating-point number to a fixed number of decimal places.
 * Avoids long floating-point tails in the JSON output.
 *
 * @param {number} n     - Value to round.
 * @param {number} places - Decimal places (default 4).
 * @returns {number}
 */
function roundTo(n, places) {
    if (places === undefined) { places = 4; }
    var factor = Math.pow(10, places);
    return Math.round(n * factor) / factor;
}

// ─────────────────────────────────────────────────────────────
//  Coordinate conversion
// ─────────────────────────────────────────────────────────────

/**
 * Convert a single [x, y] point from Illustrator space to
 * Blender-friendly space.
 *
 * Illustrator coordinate system:
 *   - Origin: top-left of the artboard (in document coordinates the
 *     origin is bottom-left of the canvas, but artboard-relative
 *     positions have Y increasing downward from the artboard top).
 *   - We receive raw document coordinates from PathPoint.anchor etc.,
 *     which are in points, Y positive = upward (Illustrator's internal
 *     coordinate system has Y=0 at the bottom of the page).
 *
 * We normalise relative to the artboard:
 *   blender_x =  (illustrator_x - artboard_left)
 *   blender_y = -(illustrator_y - artboard_top)
 *
 * This places the artboard top-left at (0, 0) in Blender and maps
 * the Y axis so that down in Illustrator = negative Y in Blender,
 * matching the 2D canvas expectation.
 *
 * @param {number[]} pt          - [x, y] in Illustrator document points.
 * @param {object}  artboardRect - {left, top, right, bottom} in doc points.
 * @returns {number[]} [bx, by]  - Blender X/Y, Z is always 0.
 */
function convertPoint(pt, artboardRect) {
    var bx = roundTo(pt[0] - artboardRect.left, 6);
    var by = roundTo(-(pt[1] - artboardRect.top), 6);
    return [bx, by];
}

// ─────────────────────────────────────────────────────────────
//  PathPoint extraction
// ─────────────────────────────────────────────────────────────

/**
 * Serialise a single PathPoint into a plain object.
 *
 * @param {PathPoint} pp         - Illustrator PathPoint.
 * @param {object}    artboardRect
 * @returns {object} anchor/handleLeft/handleRight in Blender coords.
 */
function extractPathPoint(pp, artboardRect) {
    var anchor = convertPoint(pp.anchor, artboardRect);
    var hl     = convertPoint(pp.leftDirection, artboardRect);
    var hr     = convertPoint(pp.rightDirection, artboardRect);

    return {
        anchor:       { x: anchor[0], y: anchor[1] },
        handle_left:  { x: hl[0],     y: hl[1] },
        handle_right: { x: hr[0],     y: hr[1] }
    };
}

// ─────────────────────────────────────────────────────────────
//  PathItem / CompoundPathItem extraction
// ─────────────────────────────────────────────────────────────

/**
 * Serialise one PathItem (simple open or closed path).
 *
 * @param {PathItem} pathItem
 * @param {string}   layerId      - UUID of the owning layer.
 * @param {object}   artboardRect
 * @returns {object|null} Serialised path object, or null if empty.
 */
function extractPathItem(pathItem, layerId, artboardRect) {
    var points = pathItem.pathPoints;
    if (!points || points.length === 0) { return null; }

    var serialisedPoints = [];
    for (var i = 0; i < points.length; i++) {
        serialisedPoints.push(extractPathPoint(points[i], artboardRect));
    }

    return {
        id:       generateUUID(),
        layer_id: layerId,
        name:     pathItem.name || ("path_" + generateUUID().substring(0, 8)),
        closed:   pathItem.closed,
        points:   serialisedPoints
    };
}

/**
 * Serialise a CompoundPathItem.  Illustrator compound paths contain
 * one or more sub-paths (PathItems).  Each sub-path is exported as a
 * separate entry in the paths array so that Blender can reconstruct
 * each spline independently inside a single Curve object.
 *
 * @param {CompoundPathItem} cpItem
 * @param {string}           layerId
 * @param {object}           artboardRect
 * @param {object[]}         pathsArray  - Output array to push into.
 */
function extractCompoundPathItem(cpItem, layerId, artboardRect, pathsArray) {
    var compoundId = generateUUID();
    var subPaths   = cpItem.pathItems;

    for (var i = 0; i < subPaths.length; i++) {
        var sp = subPaths[i];
        if (!sp.pathPoints || sp.pathPoints.length === 0) { continue; }

        var serialisedPoints = [];
        for (var j = 0; j < sp.pathPoints.length; j++) {
            serialisedPoints.push(extractPathPoint(sp.pathPoints[j], artboardRect));
        }

        pathsArray.push({
            id:          generateUUID(),
            compound_id: compoundId,                          // groups sub-paths
            layer_id:    layerId,
            name:        cpItem.name || ("compound_" + compoundId.substring(0, 8)),
            closed:      sp.closed,
            points:      serialisedPoints
        });
    }
}

// ─────────────────────────────────────────────────────────────
//  Recursive layer walker
// ─────────────────────────────────────────────────────────────

/**
 * Walk a Layer (or sublayer) recursively.
 *
 * Populates:
 *   layersArray  – flat list of layer descriptors
 *   pathsArray   – flat list of path descriptors
 *
 * @param {Layer}    layer
 * @param {string|null} parentId   - UUID of parent layer (null for root).
 * @param {object}   artboardRect
 * @param {object[]} layersArray
 * @param {object[]} pathsArray
 */
function walkLayer(layer, parentId, artboardRect, layersArray, pathsArray) {
    // Skip locked, hidden layers if desired — spec says export everything
    // so we include locked/hidden layers but record their state.
    var layerId = generateUUID();

    layersArray.push({
        id:        layerId,
        parent_id: parentId,
        name:      layer.name || ("layer_" + layerId.substring(0, 8)),
        visible:   layer.visible,
        locked:    layer.locked
    });

    // ── PathItems ────────────────────────────────────────────
    try {
        var pathItems = layer.pathItems;
        for (var pi = 0; pi < pathItems.length; pi++) {
            var result = extractPathItem(pathItems[pi], layerId, artboardRect);
            if (result !== null) {
                pathsArray.push(result);
            }
        }
    } catch (ePathItems) {
        // layer.pathItems can throw if there are none; safe to ignore
    }

    // ── CompoundPathItems ────────────────────────────────────
    try {
        var cpItems = layer.compoundPathItems;
        for (var ci = 0; ci < cpItems.length; ci++) {
            extractCompoundPathItem(cpItems[ci], layerId, artboardRect, pathsArray);
        }
    } catch (eCP) {
        // safe to ignore
    }

    // ── GroupItems — walk recursively treating group items as sources ──
    // Groups in Illustrator are not layers but can contain paths.
    try {
        var groupItems = layer.groupItems;
        for (var gi = 0; gi < groupItems.length; gi++) {
            walkGroupItem(groupItems[gi], layerId, artboardRect, pathsArray);
        }
    } catch (eGroups) {
        // safe to ignore
    }

    // ── Sublayers ────────────────────────────────────────────
    try {
        var sublayers = layer.layers;
        for (var sl = 0; sl < sublayers.length; sl++) {
            walkLayer(sublayers[sl], layerId, artboardRect, layersArray, pathsArray);
        }
    } catch (eSub) {
        // safe to ignore
    }
}

/**
 * Recursively walk a GroupItem, collecting paths under the given layerId.
 * Groups do not map to Blender collections; their contents are attributed
 * to the nearest ancestor layer.
 *
 * @param {GroupItem} group
 * @param {string}    layerId
 * @param {object}    artboardRect
 * @param {object[]}  pathsArray
 */
function walkGroupItem(group, layerId, artboardRect, pathsArray) {
    // Direct paths inside group
    try {
        var gPaths = group.pathItems;
        for (var pi = 0; pi < gPaths.length; pi++) {
            var r = extractPathItem(gPaths[pi], layerId, artboardRect);
            if (r !== null) { pathsArray.push(r); }
        }
    } catch (e) { /* ignore */ }

    // Compound paths inside group
    try {
        var gCP = group.compoundPathItems;
        for (var ci = 0; ci < gCP.length; ci++) {
            extractCompoundPathItem(gCP[ci], layerId, artboardRect, pathsArray);
        }
    } catch (e) { /* ignore */ }

    // Nested groups
    try {
        var subGroups = group.groupItems;
        for (var gi = 0; gi < subGroups.length; gi++) {
            walkGroupItem(subGroups[gi], layerId, artboardRect, pathsArray);
        }
    } catch (e) { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────
//  Artboard extraction
// ─────────────────────────────────────────────────────────────

/**
 * Extract the geometry of the active artboard.
 *
 * Artboard.artboardRect returns [left, top, right, bottom] in
 * document coordinates (points, Y positive upward from page bottom).
 *
 * We store:
 *   left, top, right, bottom  – raw document coordinates
 *   width, height             – in points
 *   center_x, center_y        – artboard centre in Blender coords
 *                               (i.e. relative to artboard top-left,
 *                                Y-flipped).
 *
 * @param {Artboard} artboard
 * @returns {object}
 */
function extractArtboard(artboard) {
    var r      = artboard.artboardRect; // [left, top, right, bottom]
    var left   = r[0];
    var top    = r[1];
    var right  = r[2];
    var bottom = r[3];
    var width  = roundTo(right  - left, 4);
    var height = roundTo(top    - bottom, 4);   // top > bottom in AI coords

    // Centre relative to artboard top-left, Y-flipped for Blender
    var cx = roundTo(width  / 2, 6);
    var cy = roundTo(-height / 2, 6);    // negative because Y is flipped

    return {
        id:       generateUUID(),
        name:     artboard.name || "Artboard 1",
        left:     roundTo(left,   4),
        top:      roundTo(top,    4),
        right:    roundTo(right,  4),
        bottom:   roundTo(bottom, 4),
        width:    width,
        height:   height,
        center_x: cx,
        center_y: cy
    };
}

// ─────────────────────────────────────────────────────────────
//  JSON serialisation  (ExtendScript has no JSON.stringify)
// ─────────────────────────────────────────────────────────────

/**
 * Minimal JSON serialiser compatible with ExtendScript (ES3).
 * Handles: null, boolean, number, string, Array, plain Object.
 * Does NOT handle: Date, undefined, functions, circular refs.
 *
 * @param {*}      value  - Value to serialise.
 * @param {number} indent - Current indentation level.
 * @returns {string} JSON string.
 */
function toJSON(value, indent) {
    if (indent === undefined) { indent = 0; }
    var TAB  = "    ";                                // 4-space indent
    var pad  = "";
    var pad1 = "";
    for (var i = 0; i < indent;     i++) { pad  += TAB; }
    for (var j = 0; j < indent + 1; j++) { pad1 += TAB; }

    if (value === null)                           { return "null"; }
    if (typeof value === "boolean")               { return value ? "true" : "false"; }
    if (typeof value === "number")                {
        // Guard against NaN / Infinity which are not valid JSON
        if (isNaN(value) || !isFinite(value))     { return "0"; }
        return String(value);
    }
    if (typeof value === "string") {
        // Escape special characters
        var escaped = value
            .replace(/\\/g, "\\\\")
            .replace(/"/g,  "\\\"")
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")
            .replace(/\t/g, "\\t");
        return "\"" + escaped + "\"";
    }
    if (value instanceof Array) {
        if (value.length === 0) { return "[]"; }
        var arrParts = [];
        for (var ai = 0; ai < value.length; ai++) {
            arrParts.push(pad1 + toJSON(value[ai], indent + 1));
        }
        return "[\n" + arrParts.join(",\n") + "\n" + pad + "]";
    }
    if (typeof value === "object") {
        var keys = [];
        for (var k in value) {
            if (value.hasOwnProperty(k)) { keys.push(k); }
        }
        if (keys.length === 0) { return "{}"; }
        var objParts = [];
        for (var oi = 0; oi < keys.length; oi++) {
            var key = keys[oi];
            objParts.push(pad1 + "\"" + key + "\": " + toJSON(value[key], indent + 1));
        }
        return "{\n" + objParts.join(",\n") + "\n" + pad + "}";
    }
    return "null";
}

// ─────────────────────────────────────────────────────────────
//  File output
// ─────────────────────────────────────────────────────────────

/**
 * Write a UTF-8 string to disk.
 *
 * @param {string} filePath - Absolute platform path.
 * @param {string} content  - String to write.
 * @throws {Error} If the file cannot be opened or written.
 */
function writeFile(filePath, content) {
    var f = new File(filePath);
    f.encoding = "UTF-8";
    if (!f.open("w")) {
        throw new Error("Cannot open file for writing: " + filePath);
    }
    f.write(content);
    f.close();
}

// ─────────────────────────────────────────────────────────────
//  Main entry point
// ─────────────────────────────────────────────────────────────

(function main() {
    // ── Guard: document must be open ─────────────────────────
    if (app.documents.length === 0) {
        alert("THOR19 Export\n\nNo document is open.\nPlease open an Illustrator document and try again.");
        return;
    }

    var doc = app.activeDocument;

    // ── Guard: document must be saved ────────────────────────
    if (doc.fullName === undefined || doc.fullName === null) {
        alert("THOR19 Export\n\nThis document has not been saved yet.\nPlease save the document and try again.");
        return;
    }

    // Verify the document has a valid path on disk
    var docFile = doc.fullName;
    var docPath;
    try {
        docPath = docFile.path;
    } catch (eDocPath) {
        alert("THOR19 Export\n\nCould not determine the document path.\nPlease save the document and try again.");
        return;
    }

    // ── Determine output path ─────────────────────────────────
    var outputPath = docPath + "/thor19_scene.json";

    // ── Active artboard ───────────────────────────────────────
    var activeArtboardIndex = doc.artboards.getActiveArtboardIndex();
    var activeArtboard      = doc.artboards[activeArtboardIndex];
    var artboardData        = extractArtboard(activeArtboard);

    // Build a rect object for coordinate conversion
    var abRect = {
        left:   activeArtboard.artboardRect[0],
        top:    activeArtboard.artboardRect[1],
        right:  activeArtboard.artboardRect[2],
        bottom: activeArtboard.artboardRect[3]
    };

    // ── Walk layers ───────────────────────────────────────────
    var layersArray = [];
    var pathsArray  = [];
    var docLayers   = doc.layers;

    for (var li = 0; li < docLayers.length; li++) {
        walkLayer(docLayers[li], null, abRect, layersArray, pathsArray);
    }

    // ── Assemble scene object ─────────────────────────────────
    var scene = {
        version:      "1.0",
        generator:    "THOR19_Export.jsx",
        source_file:  docFile.fsName,   // absolute OS path of the .ai file
        artboard:     artboardData,
        layers:       layersArray,
        paths:        pathsArray
    };

    // ── Serialise ─────────────────────────────────────────────
    var jsonString;
    try {
        jsonString = toJSON(scene, 0);
    } catch (eJSON) {
        alert("THOR19 Export\n\nFailed to serialise scene data:\n" + eJSON.message);
        return;
    }

    // ── Write file ────────────────────────────────────────────
    try {
        writeFile(outputPath, jsonString);
    } catch (eWrite) {
        alert("THOR19 Export\n\nFailed to write JSON file:\n" + eWrite.message + "\n\nPath: " + outputPath);
        return;
    }

    // ── Success report ────────────────────────────────────────
    var summary = (
        "THOR19 Export — Complete\n\n" +
        "Artboard : " + artboardData.name + "\n" +
        "           " + artboardData.width + " × " + artboardData.height + " pt\n\n" +
        "Layers   : " + layersArray.length + "\n" +
        "Paths    : " + pathsArray.length + "\n\n" +
        "Output   : " + outputPath
    );
    alert(summary);

})();
// EOF THOR19_Export.jsx
