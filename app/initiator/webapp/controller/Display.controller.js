sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, MessageToast) {
    "use strict";

    return Controller.extend("com.deloitte.mdg.costcenter.initiator.initiator.controller.Display", {

        onInit: function () {
            this._oTable = this.byId("Display_Table");
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
            const aFilters = [];

            const addMultiFilter = (sPath, aTokens) => {
                if (!aTokens.length) return;

                aFilters.push(
                    new Filter({
                        filters: aTokens.map(t =>
                            new Filter(sPath, FilterOperator.Contains, t.getText())
                        ),
                        and: false
                    })
                );
            };

            addMultiFilter("CostCenter", this.byId("MultiInput_CostCenter").getTokens());
            addMultiFilter("CostCenterName", this.byId("MultiInput_Name").getTokens());
            addMultiFilter("CostCenterDescription", this.byId("MultiInput_Description").getTokens());
            addMultiFilter("CostCtrResponsiblePersonName", this.byId("MultiInput_PersonResponsible").getTokens());

            this._oTable.getBinding("items").filter(aFilters);
        },

        _getTokens: function (id) {
            return this.byId(id).getTokens().map(t => t.getText());
        },

        onClearFilter: function () {
            this.byId("MultiInput_CostCenter").removeAllTokens();
            this.byId("MultiInput_Name").removeAllTokens();
            this.byId("MultiInput_Description").removeAllTokens();
            this.byId("MultiInput_PersonResponsible").removeAllTokens();

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
        },

        //F4 For Functions
        onValueHelpRequest: function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            const inputId = oEvent.getSource().getId().split("--").pop();
            this._currentInputId = oEvent.getSource().getId();

            const oModel = this.getOwnerComponent().getModel("CostCenterModel");

            oModel.read("/A_CostCenter", {
                urlParameters: {
                    "$expand": "to_Text",
                    "$select": "CostCenter,CostCtrResponsiblePersonName," +
                        "to_Text/CostCenterName," +
                        "to_Text/CostCenterDescription," +
                        "to_Text/Language"
                },

                success: (oData) => {
                    const map = {};

                    oData.results.forEach((r, idx) => {
                        const texts = (r.to_Text?.results || [])
                            .filter(t => t.Language === "EN");

                        let value;

                        switch (inputId) {
                            case "MultiInput_CostCenter":
                                value = r.CostCenter;
                                break;

                            case "MultiInput_Name":
                                value = texts[0]?.CostCenterName;
                                break;

                            case "MultiInput_Description":
                                value = texts[0]?.CostCenterDescription;
                                break;

                            case "MultiInput_PersonResponsible":
                                value = r.CostCtrResponsiblePersonName;
                                break;
                        }

                        if (value) {
                            map[value] = true;
                        }
                    });

                    const formatted = Object.keys(map).map(v => ({
                        title: v,
                        description: v
                    }));

                    const oF4Model = new sap.ui.model.json.JSONModel({
                        results: formatted
                    });

                    this._f4Model = oF4Model;
                    this.getView().setModel(oF4Model, "F4Model");

                    this._openF4Dialog("Select Value");
                    sap.ui.core.BusyIndicator.hide();
                },

                error: (e) => {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("F4 read failed", e);
                    sap.m.MessageBox.error("Failed to load value help");
                }
            });
        },

        _openF4Dialog: function (title) {

            if (!this._F4Dialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "com.deloitte.mdg.costcenter.initiator.initiator.fragment.F4Dialog",
                    controller: this
                }).then(oDialog => {
                    this._F4Dialog = oDialog;
                    oDialog.setModel(this._f4Model, "F4Model");

                    this.getView().addDependent(oDialog);
                    oDialog.setTitle(title);
                    oDialog.open();
                });

            } else {
                this._F4Dialog.setModel(this._f4Model, "F4Model");
                this._F4Dialog.setTitle(title);
                this._F4Dialog.open();
            }
        },

        onF4Select: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");
            if (!oItem) return;

            const sValue = oItem.getTitle();
            const oInput = sap.ui.getCore().byId(this._currentInputId);

            if (oInput && oInput.addToken) {
                const exists = oInput.getTokens().some(t => t.getText() === sValue);
                if (!exists) {
                    oInput.addToken(new sap.m.Token({ text: sValue }));
                }
            }

            // reset dialog state
            this.byId("F4SearchField").setValue("");
            this.byId("F4List").getBinding("items").filter([]);

            this._F4Dialog.close();
        },
        onF4Search: function (oEvent) {
            const sValue = oEvent.getParameter("newValue");
            const oList = this.byId("F4List");
            const oBinding = oList.getBinding("items");

            const oFilter = new sap.ui.model.Filter({
                filters: [
                    new sap.ui.model.Filter("title", sap.ui.model.FilterOperator.Contains, sValue),
                    new sap.ui.model.Filter("description", sap.ui.model.FilterOperator.Contains, sValue)
                ],
                and: false
            });

            oBinding.filter([oFilter]);
        },
        onF4Cancel: function () {
            this.byId("F4SearchField").setValue("");
            this.byId("F4List").getBinding("items").filter([]);
            this._F4Dialog.close();
        }


    });
});