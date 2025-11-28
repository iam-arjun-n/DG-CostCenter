sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, MessageToast) {
    "use strict";

    return Controller.extend("com.deloitte.mdg.costcenter.initiator.initiator.controller.Display", {

        onInit: function () {

            this.loadData();
        },
        onNavBack: function () {
            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteOverview", {}, true);
        },

        loadData: function () {
            var oTable = this.byId("Display_Table");
            var oModel = this.getOwnerComponent().getModel("CostCenterModel");
            oModel.read("/A_CostCenter", {
                urlParameters: {
                    "$expand": "to_Text",
                    "$filter": "Language eq 'EN'"
                },
                success: function (oData) {
                    oData.results.forEach(item => {
                        const Name = item.to_Text?.results.map(mat => mat.CostCenterName);
                        item.CostCenterName = Name[0]
                    });
                    oData.results.forEach(item => {
                        const Description = item.to_Text?.results.map(mat => mat.CostCenterDescription);
                        item.CostCenterDescription = Description[0]
                    });

                    var ACostCenterModel = new sap.ui.model.json.JSONModel({ A_CostCenter: oData.results });
                    oTable.setModel(ACostCenterModel, "CostCenterModel");
                }.bind(this),
                error: function (e) {
                    console.error("READ FAILED", e);
                }
            });
        },

        onGoFilter: function () {
            var aFilters = [];
            var aCostCenters = this._getTokens("F_COSTCENTER");
            var aNames = this._getTokens("F_NAME");
            var aResp = this._getTokens("F_RESP");

            if (aCostCenters.length) {
                aFilters.push(new Filter("CostCenter", FilterOperator.Contains, aCostCenters.join(",")));
            }
            if (aNames.length) {
                aFilters.push(new Filter("CostCenterName", FilterOperator.Contains, aNames.join(",")));
            }
            if (aResp.length) {
                aFilters.push(new Filter("CostCtrResponsiblePersonName", FilterOperator.Contains, aResp.join(",")));
            }

            this._oTable.getBinding("items").filter(aFilters);
        },

        _getTokens: function (id) {
            return this.byId(id).getTokens().map(t => t.getText());
        },

        onClearFilter: function () {
            this.byId("F_COSTCENTER").removeAllTokens();
            this.byId("F_NAME").removeAllTokens();
            this.byId("F_RESP").removeAllTokens();
            this._oTable.getBinding("items").filter([]);
        },

        onItemSelected: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            this._selectedCostCenter = oItem.getBindingContext("CostCenterModel").getObject();
        },

        onChangePress: function () {
            if (!this._selectedCostCenter) return MessageToast.show("Select a Cost Center");

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteSubmission", {
                request_type: "change",
                ca: this._selectedCostCenter.ControllingArea,
                cc: this._selectedCostCenter.CostCenter,
                ve: this._formatVE(this._selectedCostCenter.ValidityEndDate)
            });
        },

        onExtendPress: function () {
            if (!this._selectedCostCenter) return MessageToast.show("Select a Cost Center");

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteSubmission", {
                request_type: "extend",
                ca: this._selectedCostCenter.ControllingArea,
                cc: this._selectedCostCenter.CostCenter,
                ve: this._formatVE(this._selectedCostCenter.ValidityEndDate)
            });
        },

        _formatVE: function (value) {
            if (typeof value === "string") {
                var clean = value.replace("Z", "").split(".")[0];
                return clean.slice(0, 19);
            }

            var m = /Date\((\d+)\)/.exec(value);
            if (m) {
                var d = new Date(parseInt(m[1], 10));
                return d.toISOString().replace("Z", "").split(".")[0];
            }

            if (value instanceof Date) {
                return value.toISOString().replace("Z", "").split(".")[0];
            }

            return value;
        },
        getFirstCostCenterName: function (oTextData) {
            if (oTextData && oTextData.results && oTextData.results.length > 0) {
                return oTextData.results[0].CostCenterName || "";
            }
            return "";
        },

        getFirstCostCenterDescription: function (oTextData) {
            if (oTextData && oTextData.results && oTextData.results.length > 0) {
                return oTextData.results[0].CostCenterDescription || "";
            }
            return "";
        }
    });
});