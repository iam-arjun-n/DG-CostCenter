sap.ui.define([
    "sap/ui/core/UIComponent",
    "com/deloitte/mdg/costcenter/initiator/initiator/model/models"
], (UIComponent, models) => {
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

        loadUserInfo: function () {
            return new Promise((resolve) => {
                const url = this.getBaseURL() + "/user-api/attributes";

                const oUserModel = new JSONModel();
                const mock = {
                    firstname: "Dummy",
                    lastname: "User",
                    email: "dummy.user@com",
                    name: "dummy.user@com",
                    displayName: "Dummy User (dummy.user@com)"
                };

                oUserModel.loadData(url);
                oUserModel.dataLoaded()
                    .then(() => {
                        if (!oUserModel.getData().email) {
                            oUserModel.setData(mock);
                        }
                        this.setModel(oUserModel, "userInfo");
                        this.currentUser = oUserModel.getData().email;
                        resolve();
                    })
                    .catch(() => {
                        oUserModel.setData(mock);
                        this.setModel(oUserModel, "userInfo");
                        this.currentUser = mock.email;
                        resolve();
                    });
            });
        }
    });
});