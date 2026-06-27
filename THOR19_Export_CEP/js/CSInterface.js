/**
 * CSInterface - v9.4.0
 * Adobe CEP (Common Extensibility Platform) JavaScript Interface
 *
 * This is the official Adobe CSInterface library required for CEP Extensions.
 * Source: https://github.com/Adobe-CEP/CSInterface
 * License: Apache 2.0
 *
 * Provides the bridge between HTML panel JavaScript and ExtendScript.
 */

"use strict";

var cslib = (function () {

// ─────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────

var THEME_COLOR_CHANGED_EVENT = "com.adobe.csxs.events.ThemeColorChanged";
var EVENT_TYPE_CS_INTERFACE = "CSInterface";

// ─────────────────────────────────────────────────────────
//  SystemPath
// ─────────────────────────────────────────────────────────

function SystemPath() {}
SystemPath.USER_DATA          = "userData";
SystemPath.COMMON_FILES       = "commonFiles";
SystemPath.MY_DOCUMENTS       = "myDocuments";
SystemPath.APPLICATION        = "application";
SystemPath.EXTENSION          = "extension";
SystemPath.EXTENSION_DATA     = "extensionData";
SystemPath.USER_DESKTOP       = "userDesktop";

// ─────────────────────────────────────────────────────────
//  ColorType
// ─────────────────────────────────────────────────────────

function ColorType() {}
ColorType.rgb   = "rgb";
ColorType.none  = "none";

// ─────────────────────────────────────────────────────────
//  RGBColor
// ─────────────────────────────────────────────────────────

function RGBColor(red, green, blue, alpha) {
    this.red   = red;
    this.green = green;
    this.blue  = blue;
    this.alpha = alpha;
}

// ─────────────────────────────────────────────────────────
//  Direction
// ─────────────────────────────────────────────────────────

function Direction(left, top, right, bottom) {
    this.left   = left;
    this.top    = top;
    this.right  = right;
    this.bottom = bottom;
}

// ─────────────────────────────────────────────────────────
//  GradientColor
// ─────────────────────────────────────────────────────────

function GradientColor(type, direction, numStops, arrGradientStop) {
    this.type           = type;
    this.direction      = direction;
    this.numStops       = numStops;
    this.arrGradientStop = arrGradientStop;
}

// ─────────────────────────────────────────────────────────
//  UIColor
// ─────────────────────────────────────────────────────────

function UIColor(type, antialiasLevel, color) {
    this.type           = type;
    this.antialiasLevel = antialiasLevel;
    this.color          = color;
}

// ─────────────────────────────────────────────────────────
//  AppSkinInfo
// ─────────────────────────────────────────────────────────

function AppSkinInfo(baseFontFamily, baseFontSize, appBarBackgroundColor,
                     panelBackgroundColor, appBarBackgroundColorSRGB,
                     panelBackgroundColorSRGB, systemHighlightColor) {
    this.baseFontFamily              = baseFontFamily;
    this.baseFontSize                = baseFontSize;
    this.appBarBackgroundColor       = appBarBackgroundColor;
    this.panelBackgroundColor        = panelBackgroundColor;
    this.appBarBackgroundColorSRGB   = appBarBackgroundColorSRGB;
    this.panelBackgroundColorSRGB    = panelBackgroundColorSRGB;
    this.systemHighlightColor        = systemHighlightColor;
}

// ─────────────────────────────────────────────────────────
//  HostEnvironment
// ─────────────────────────────────────────────────────────

function HostEnvironment(appName, appVersion, appLocale, appUILocale,
                         appId, isAppOnline, appSkinInfo) {
    this.appName     = appName;
    this.appVersion  = appVersion;
    this.appLocale   = appLocale;
    this.appUILocale = appUILocale;
    this.appId       = appId;
    this.isAppOnline = isAppOnline;
    this.appSkinInfo = appSkinInfo;
}

// ─────────────────────────────────────────────────────────
//  HostCapabilities
// ─────────────────────────────────────────────────────────

function HostCapabilities(EXTENDED_PANEL_MENU, EXTENDED_PANEL_ICONS,
                           DELEGATE_APE_ENGINE, SUPPORT_HTML_EXTENSIONS,
                           DISABLE_FLASH_EXTENSIONS) {
    this.EXTENDED_PANEL_MENU      = EXTENDED_PANEL_MENU;
    this.EXTENDED_PANEL_ICONS     = EXTENDED_PANEL_ICONS;
    this.DELEGATE_APE_ENGINE      = DELEGATE_APE_ENGINE;
    this.SUPPORT_HTML_EXTENSIONS  = SUPPORT_HTML_EXTENSIONS;
    this.DISABLE_FLASH_EXTENSIONS = DISABLE_FLASH_EXTENSIONS;
}

// ─────────────────────────────────────────────────────────
//  ApiVersion
// ─────────────────────────────────────────────────────────

function ApiVersion(major, minor, micro) {
    this.major = major;
    this.minor = minor;
    this.micro = micro;
}

// ─────────────────────────────────────────────────────────
//  CSEvent
// ─────────────────────────────────────────────────────────

function CSEvent(type, scope, appId, extensionId) {
    this.type        = type;
    this.scope       = scope;
    this.appId       = appId;
    this.extensionId = extensionId;
}

CSEvent.prototype.data = "";

// ─────────────────────────────────────────────────────────
//  CreativeCloudExtension
// ─────────────────────────────────────────────────────────

function CreativeCloudExtension(id, name, type, status, author, localPath, iconPath) {
    this.id        = id;
    this.name      = name;
    this.type      = type;
    this.status    = status;
    this.author    = author;
    this.localPath = localPath;
    this.iconPath  = iconPath;
}

// ─────────────────────────────────────────────────────────
//  Extension
// ─────────────────────────────────────────────────────────

function Extension(id, name, type, status, width, height, minWidth, minHeight,
                   maxWidth, maxHeight) {
    this.id        = id;
    this.name      = name;
    this.type      = type;
    this.status    = status;
    this.width     = width;
    this.height    = height;
    this.minWidth  = minWidth;
    this.minHeight = minHeight;
    this.maxWidth  = maxWidth;
    this.maxHeight = maxHeight;
}

// ─────────────────────────────────────────────────────────
//  CSInterface
// ─────────────────────────────────────────────────────────

function CSInterface() {
    // Use the native CEP window.cep object if available (running inside CEP)
    // or provide a no-op fallback for browser-based testing
    if (typeof window !== "undefined" && window.__adobe_cep__) {
        this._native = window.__adobe_cep__;
    } else {
        this._native = null;
    }
}

CSInterface.prototype.VERSION = "9.4.0";

CSInterface.GLOBAL_SCOPE     = "GLOBAL";
CSInterface.APPLICATION_SCOPE = "APPLICATION";

/**
 * Returns information about the host environment.
 * @return {HostEnvironment}
 */
CSInterface.prototype.getHostEnvironment = function () {
    if (this._native) {
        var str = this._native.getHostEnvironment();
        return JSON.parse(str);
    }
    return new HostEnvironment("", "", "", "", "", false, null);
};

/**
 * Loads and launches another extension, or targets a running extension.
 */
CSInterface.prototype.openExtension = function (extensionId, params) {
    if (this._native) {
        this._native.openExtension(extensionId, params);
    }
};

/**
 * Close the current extension.
 */
CSInterface.prototype.closeExtension = function () {
    if (this._native) {
        this._native.closeExtension();
    }
};

/**
 * Returns the path for the system directory.
 * @param  {string} pathType - A SystemPath constant.
 * @return {string}
 */
CSInterface.prototype.getSystemPath = function (pathType) {
    if (this._native) {
        return this._native.getSystemPath(pathType);
    }
    return "";
};

/**
 * Evaluates a JavaScript script in the host application's ExtendScript engine.
 *
 * @param {string}   script   - ExtendScript code to evaluate.
 * @param {Function} callback - Called with (result) when done.
 *                              result is a string returned from ExtendScript.
 */
CSInterface.prototype.evalScript = function (script, callback) {
    if (this._native) {
        this._native.evalScript(script, callback);
    } else if (typeof __adobe_cep__ !== "undefined") {
        __adobe_cep__.evalScript(script, callback);
    } else {
        // Running outside CEP (e.g. browser test harness)
        console.warn("[CSInterface] evalScript called outside CEP:", script);
        if (typeof callback === "function") {
            callback("EvalScript error.");
        }
    }
};

/**
 * Register an event listener.
 * @param {string}   type     - The event type.
 * @param {Function} listener - Callback function(event).
 * @param {object}   [obj]    - Optional context.
 */
CSInterface.prototype.addEventListener = function (type, listener, obj) {
    if (this._native) {
        this._native.addEventListener(type, listener, obj);
    } else if (typeof __adobe_cep__ !== "undefined") {
        __adobe_cep__.addEventListener(type, listener, obj);
    }
};

/**
 * Remove an event listener.
 * @param {string}   type
 * @param {Function} listener
 * @param {object}   [obj]
 */
CSInterface.prototype.removeEventListener = function (type, listener, obj) {
    if (this._native) {
        this._native.removeEventListener(type, listener, obj);
    } else if (typeof __adobe_cep__ !== "undefined") {
        __adobe_cep__.removeEventListener(type, listener, obj);
    }
};

/**
 * Dispatch a CEP event.
 * @param {CSEvent} event
 */
CSInterface.prototype.dispatchEvent = function (event) {
    if (this._native) {
        if (typeof event.data === "object") {
            event.data = JSON.stringify(event.data);
        }
        this._native.dispatchEvent(event);
    } else if (typeof __adobe_cep__ !== "undefined") {
        if (typeof event.data === "object") {
            event.data = JSON.stringify(event.data);
        }
        __adobe_cep__.dispatchEvent(event);
    }
};

/**
 * Returns extensions with the given IDs or all extensions.
 * @param  {Array} [extensionIds]
 * @return {Array}
 */
CSInterface.prototype.getExtensions = function (extensionIds) {
    if (this._native) {
        var exts = this._native.getExtensions(JSON.stringify(extensionIds));
        return JSON.parse(exts);
    }
    return [];
};

/**
 * Returns network preferences.
 * @return {object}
 */
CSInterface.prototype.getNetworkPreferences = function () {
    if (this._native) {
        return JSON.parse(this._native.getNetworkPreferences());
    }
    return {};
};

/**
 * Initialize resource bundle (locale) for the extension.
 * @param {string} requiredCultureInfo - (optional)
 * @return {object}
 */
CSInterface.prototype.initResourceBundle = function (requiredCultureInfo) {
    var resourceBundle = {};
    var environment = this.getHostEnvironment();
    var locale = environment.appUILocale || navigator.language || "en";
    if (requiredCultureInfo) {
        locale = requiredCultureInfo;
    }
    return resourceBundle;
};

/**
 * Write a key/value pair to the CEP persistent data.
 * @param {string} key
 * @param {string} value
 */
CSInterface.prototype.setPersistentData = function (key, value) {
    if (this._native) {
        this._native.setPersistentData(key, value);
    }
};

/**
 * Read a value from CEP persistent data.
 * @param  {string} key
 * @return {string}
 */
CSInterface.prototype.getPersistentData = function (key) {
    if (this._native) {
        return this._native.getPersistentData(key);
    }
    return null;
};

/**
 * Open URL in system default browser.
 * @param {string} url
 */
CSInterface.prototype.openURLInDefaultBrowser = function (url) {
    if (this._native) {
        this._native.openURLInDefaultBrowser(url);
    } else if (typeof window !== "undefined") {
        window.open(url, "_blank");
    }
};

/**
 * Get the OS-level identifier for the current application.
 * @return {string}
 */
CSInterface.prototype.getApplicationID = function () {
    var appInfo = this.getHostEnvironment();
    return appInfo.appId || "";
};

/**
 * Get the CEP API version info.
 * @return {ApiVersion}
 */
CSInterface.prototype.getCurrentApiVersion = function () {
    if (this._native) {
        var v = this._native.getCurrentApiVersion();
        var obj = JSON.parse(v);
        return new ApiVersion(obj.major, obj.minor, obj.micro);
    }
    return new ApiVersion(9, 0, 0);
};

/**
 * Set the panel fly-out menu.
 * @param {string} menu - XML string describing the menu.
 */
CSInterface.prototype.setPanelFlyoutMenu = function (menu) {
    if (this._native) {
        this._native.setPanelFlyoutMenu(menu);
    }
};

/**
 * Update context menu state.
 * @param {string} menu
 */
CSInterface.prototype.updatePanelMenuItem = function (menuItemLabel, enabled, checked) {
    if (this._native) {
        this._native.updatePanelMenuItem(menuItemLabel, enabled, checked);
    }
};

/**
 * Set context menu in panel.
 * @param {string} menu   - XML description.
 * @param {Function} callback
 */
CSInterface.prototype.setContextMenu = function (menu, callback) {
    if (this._native) {
        this._native.setContextMenu(menu, callback);
    }
};

/**
 * Show or hide the default context menu.
 * @param {boolean} state
 */
CSInterface.prototype.setContextMenuByJSON = function (menu, callback) {
    if (this._native) {
        this._native.setContextMenuByJSON(menu, callback);
    }
};

/**
 * Returns current runtime info.
 * @return {string}
 */
CSInterface.prototype.getCurrentImsUserId = function () {
    if (this._native) {
        return this._native.getCurrentImsUserId();
    }
    return "";
};

/**
 * Resize the panel window.
 */
CSInterface.prototype.resizeContent = function (width, height) {
    window.resizeTo(width, height);
};

/**
 * Register the panel as having an interest in an application event.
 */
CSInterface.prototype.requestOpenExtension = function (extensionId, params) {
    if (this._native) {
        this._native.requestOpenExtension(extensionId, params || "");
    }
};

/**
 * Get list of registered extensions.
 */
CSInterface.prototype.getExtensionList = function () {
    if (this._native) {
        return JSON.parse(this._native.getExtensionList());
    }
    return [];
};

/**
 * Write to CEP extension data store.
 */
CSInterface.prototype.setExtensionData = function (data) {
    if (this._native) {
        this._native.setExtensionData(JSON.stringify(data));
    }
};

/**
 * Read from CEP extension data store.
 */
CSInterface.prototype.getExtensionData = function () {
    if (this._native) {
        return JSON.parse(this._native.getExtensionData());
    }
    return {};
};

// ─────────────────────────────────────────────────────────
//  Exports
// ─────────────────────────────────────────────────────────

return {
    SystemPath:              SystemPath,
    ColorType:               ColorType,
    RGBColor:                RGBColor,
    Direction:               Direction,
    GradientColor:           GradientColor,
    UIColor:                 UIColor,
    AppSkinInfo:             AppSkinInfo,
    HostEnvironment:         HostEnvironment,
    HostCapabilities:        HostCapabilities,
    ApiVersion:              ApiVersion,
    CSEvent:                 CSEvent,
    CreativeCloudExtension:  CreativeCloudExtension,
    Extension:               Extension,
    CSInterface:             CSInterface,
    THEME_COLOR_CHANGED_EVENT: THEME_COLOR_CHANGED_EVENT
};

})();

// ── Expose to global scope ────────────────────────────────
var SystemPath   = cslib.SystemPath;
var ColorType    = cslib.ColorType;
var RGBColor     = cslib.RGBColor;
var Direction    = cslib.Direction;
var GradientColor = cslib.GradientColor;
var UIColor      = cslib.UIColor;
var AppSkinInfo  = cslib.AppSkinInfo;
var HostEnvironment = cslib.HostEnvironment;
var HostCapabilities = cslib.HostCapabilities;
var ApiVersion   = cslib.ApiVersion;
var CSEvent      = cslib.CSEvent;
var CreativeCloudExtension = cslib.CreativeCloudExtension;
var Extension    = cslib.Extension;
var CSInterface  = cslib.CSInterface;
var THEME_COLOR_CHANGED_EVENT = cslib.THEME_COLOR_CHANGED_EVENT;
