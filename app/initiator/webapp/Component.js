sap.ui.define([
    "sap/ui/core/UIComponent",
    "com/deloitte/mdg/costcenter/initiator/initiator/model/models",
    "sap/ui/model/json/JSONModel"
], (UIComponent, models, JSONModel) => {
    "use strict";

    return UIComponent.extend("com.deloitte.mdg.costcenter.initiator.initiator.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        currentUser: "",

        init: async function () {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(models.createDeviceModel(), "device");
            this.getRouter().initialize();

            await this.loadUserInfo();
        },

        getBaseURL: function () {
            const appId = this.getManifestEntry("/sap.app/id");
            const appPath = appId.replaceAll(".", "/");
            return jQuery.sap.getModulePath(appPath);
        },

        loadUserInfo: async function () {
            const mock = {
                firstname: "Dummy",
                lastname: "User",
                email: "dummy.user@com",
                name: "dummy.user@com",
                displayName: "Dummy User (dummy.user@com)"
            };

            // helper to set model + currentUser
            const apply = (data) => {
                const m = new sap.ui.model.json.JSONModel(data);
                this.setModel(m, "userInfo");
                this.currentUser = data.email || data.name || data.displayName || mock.email;
                console.info("loadUserInfo -> applied user:", this.currentUser);
            };

            // 1) Try sap.ushell.Container (recommended for FLP)
            try {
                if (window.sap && sap.ushell && sap.ushell.Container) {
                    console.info("loadUserInfo: sap.ushell.Container detected in current window");
                    const UserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
                    const email = (UserInfo.getEmail && UserInfo.getEmail()) || (UserInfo.getId && UserInfo.getId());
                    const displayName = (UserInfo.getFullName && UserInfo.getFullName()) || (UserInfo.getDisplayName && UserInfo.getDisplayName()) || email;
                    const res = {
                        firstname: UserInfo.getFirstName ? UserInfo.getFirstName() : "",
                        lastname: UserInfo.getLastName ? UserInfo.getLastName() : "",
                        email: email || mock.email,
                        name: email || mock.email,
                        displayName: displayName || mock.displayName
                    };
                    apply(res);
                    return;
                } else {
                    console.warn("loadUserInfo: sap.ushell.Container not present in current window");
                }
            } catch (e) {
                console.warn("loadUserInfo: error using sap.ushell.Container:", e);
            }

            // 2) Try parent window (app hosted inside an iframe inside Launchpad)
            try {
                if (window.parent && window.parent !== window && window.parent.sap && window.parent.sap.ushell && window.parent.sap.ushell.Container) {
                    console.info("loadUserInfo: sap.ushell.Container detected in parent window");
                    const ParentUserInfo = await window.parent.sap.ushell.Container.getServiceAsync("UserInfo");
                    const email = (ParentUserInfo.getEmail && ParentUserInfo.getEmail()) || (ParentUserInfo.getId && ParentUserInfo.getId());
                    const displayName = (ParentUserInfo.getFullName && ParentUserInfo.getFullName()) || (ParentUserInfo.getDisplayName && ParentUserInfo.getDisplayName()) || email;
                    const res = {
                        firstname: ParentUserInfo.getFirstName ? ParentUserInfo.getFirstName() : "",
                        lastname: ParentUserInfo.getLastName ? ParentUserInfo.getLastName() : "",
                        email: email || mock.email,
                        name: email || mock.email,
                        displayName: displayName || mock.displayName
                    };
                    apply(res);
                    return;
                } else {
                    console.warn("loadUserInfo: sap.ushell.Container not found in parent window");
                }
            } catch (e) {
                console.warn("loadUserInfo: error checking parent window for sap.ushell:", e);
            }

            try {
                console.info("loadUserInfo: trying /user-api/attributes");
                const resp = await fetch("/user-api/attributes", { credentials: "include" });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data && (data.email || data.name || data.displayName)) {
                        const res = {
                            firstname: data.firstname || "",
                            lastname: data.lastname || "",
                            email: data.email || data.name || mock.email,
                            name: data.name || data.email || mock.email,
                            displayName: data.displayName || data.email || mock.displayName
                        };
                        apply(res);
                        return;
                    } else {
                        console.warn("loadUserInfo: /user-api/attributes returned no usable fields", data);
                    }
                } else {
                    console.warn("loadUserInfo: /user-api/attributes fetch returned", resp.status, resp.statusText);
                }
            } catch (e) {
                console.warn("loadUserInfo: /user-api/attributes error:", e);
            }

            // 4) Try a relative call to your CAP / whoami or /.userinfo if you exposed one (optional)
            try {
                console.info("loadUserInfo: trying fallback endpoints: /whoami and /.userinfo");
                let tryUrls = ["/whoami", "/.userinfo", "/user-info", "/user-api/attributes"];
                for (let u of tryUrls) {
                    try {
                        const r = await fetch(u, { credentials: "include" });
                        if (!r.ok) { console.debug("loadUserInfo: attempt", u, "status", r.status); continue; }
                        const json = await r.json();
                        if (json && (json.email || json.user || json.name || json.displayName)) {
                            const email = json.email || json.user || json.name;
                            const res = {
                                firstname: json.firstname || "",
                                lastname: json.lastname || "",
                                email: email || mock.email,
                                name: email || mock.email,
                                displayName: json.displayName || email || mock.displayName
                            };
                            apply(res);
                            return;
                        }
                    } catch (e) {
                        // continue
                    }
                }
                console.warn("loadUserInfo: no fallback endpoint returned usable user");
            } catch (e) {
                console.warn("loadUserInfo: fallback endpoints error", e);
            }

            // 5) Last resort: set mock and print diagnostics to console
            console.error("loadUserInfo: Unable to determine user from FLP/approuter. Applying mock. Diagnostic summary:");
            console.groupCollapsed("UserInfo diagnostic hints");
            console.log("window.location.href =", window.location.href);
            console.log("window.sap present? ", !!window.sap);
            console.log("window.sap.ushell present? ", !!(window.sap && window.sap.ushell));
            console.log("parent !== self? ", window.parent !== window);
            console.log("parent.sap.ushell present? ", !!(window.parent && window.parent.sap && window.parent.sap.ushell));
            console.log("Try accessing this app via the Launchpad (FLP) or via approuter route so the user is provided.");
            console.groupEnd();

            apply(mock);
        }

    });
});