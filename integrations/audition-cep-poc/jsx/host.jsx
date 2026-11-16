/* ExtendScript side: deliberately read-only POC. */
var AACP = AACP || {};
AACP.getHostInfo = function () {
    try {
        if (typeof app === "undefined") {
            return '{"ok":false,"code":"HOST_APP_UNAVAILABLE"}';
        }
        var name = String(app.name || "unknown").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
        var version = String(app.version || "unknown").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
        return '{"ok":true,"name":"' + name + '","version":"' + version + '"}';
    } catch (e) {
        return '{"ok":false,"code":"HOST_INFO_ERROR","message":"' + String(e).replace(/"/g, "'") + '"}';
    }
};
