sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
    "sap/m/Token",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "sap/ui/export/Spreadsheet",
    "com/deloitte/mdg/costcenter/initiator/initiator/model/formatter",
    "sap/ui/model/odata/v4/ODataUtils"
], function (Controller, Fragment, Filter, FilterOperator, FilterType, Token, MessageBox, JSONModel, Spreadsheet, formatter, ODataUtils) {
    "use strict";

    return Controller.extend("com.deloitte.mdg.costcenter.initiator.initiator.controller.Overview", {

        formatter: formatter,

        onInit: function () {
            this._oModel = this.getView().getModel("ServiceModel");
            this._addCurrentUserToken();
        },

        _addCurrentUserToken: function () {
            var oCreatedByInput = this.byId("Overview_Created_By");
            var sCurrentUser = this.getOwnerComponent().getModel("userInfo")?.getProperty("/email");

            if (sCurrentUser && oCreatedByInput) {
                oCreatedByInput.addToken(new Token({ text: sCurrentUser }));
            }
        },

        onRequestIdSubmit: function (oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oInput.getValue().trim();

            if (sValue) {
                oInput.addToken(new sap.m.Token({ text: sValue }));
                oInput.setValue("");
            }
        },

        onCreatedBySubmit: function (oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oInput.getValue().trim();

            if (sValue) {
                oInput.addToken(new sap.m.Token({ text: sValue }));
                oInput.setValue("");
            }
        },


        onGo: function () {
            var oTable = this.byId("Overview_Table");
            var oBinding = oTable.getBinding("items");
            var aFilters = [];

            // Request ID
            var aReqTokens = this.byId("Request_Id").getTokens();
            if (aReqTokens.length) {
                aFilters.push(new Filter({
                    filters: aReqTokens.map(t =>
                        new Filter("requestId", FilterOperator.EQ, t.getText())
                    ),
                    and: false
                }));
            }

            // Created By
            var aUserTokens = this.byId("Created_By").getTokens();
            if (aUserTokens.length) {
                aFilters.push(new Filter({
                    filters: aUserTokens.map(t =>
                        new Filter("createdBy", FilterOperator.EQ, t.getText())
                    ),
                    and: false
                }));
            }

            // Request Type
            var sReqType = this.byId("Request_Type").getSelectedKey();
            if (sReqType) {
                aFilters.push(new Filter("requestType", FilterOperator.EQ, sReqType));
            }

            // Workflow Status
            var sWF = this.byId("Workflow_Status").getSelectedKey();
            if (sWF) {
                aFilters.push(new Filter("workflowStatus", FilterOperator.EQ, sWF));
            }

            oBinding.filter(aFilters);
            var oStart = this.byId("Creation_Date").getDateValue();
            var oEnd = this.byId("Creation_Date").getSecondDateValue();

            if (oStart && oEnd) {
                oStart.setHours(0, 0, 0, 0);
                oEnd.setHours(23, 59, 59, 999);

                var sFilter =
                    "createdAt ge " + oStart.toISOString() +
                    " and createdAt le " + oEnd.toISOString();

                oBinding.changeParameters({
                    $filter: sFilter
                });
            } else {
                // clear date filter
                oBinding.changeParameters({
                    $filter: undefined
                });
            }
        },

        onClear: function () {
            this.byId("Request_Id").destroyTokens();
            this.byId("Created_By").destroyTokens();

            this.byId("Request_Type").setSelectedKey("");
            this.byId("Workflow_Status").setSelectedKey("");

            var oDate = this.byId("Creation_Date");
            oDate.setDateValue(null);
            oDate.setSecondDateValue(null);

            this.byId("Overview_Table").getBinding("items").filter([]);
            var oTable = this.byId("Overview_Table");
            var oBinding = oTable.getBinding("items");
            oBinding.filter([]);

            oBinding.changeParameters({
                $filter: undefined
            });
        },

        onRequestPress: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("costCenterModel");
            var sReqId = oCtx.getProperty("requestId");
            MessageBox.information("Request ID: " + sReqId);
        },

        onCreatePress: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteSubmission", {
                request_type: "create"
            });
        },

        onChangeExtendPress: function () {
            MessageBox.information("Change/Extend Cost Center triggered.");
        },

        onUpdateStarted: function () { },

        onRequestSelectionChange: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oViewButton = this.byId("Overview_Button_View");

            if (!oItem) {
                oViewButton.setEnabled(false);
                this._sSelectedRequestId = null;
                return;
            }

            var oCtx = oItem.getBindingContext("ServiceModel");
            this._sSelectedRequestId = oCtx.getProperty("requestId");

            oViewButton.setEnabled(true);
        },

        onExport: function () {
            var oTable = this.byId("Overview_Table");
            var aItems = oTable.getBinding("items").getCurrentContexts().map(ctx => ctx.getObject());

            if (!aItems || aItems.length === 0) {
                MessageBox.warning("No data to export.");
                return;
            }

            var aExportData = aItems.map(item => ({
                "Request ID": item.requestId,
                "Request Type": item.requestType,
                "Workflow Status": item.workflowStatus,
                "Created On": item.createdAt,
                "Created By": item.createdBy
            }));

            var oSettings = {
                workbook: {
                    columns: [
                        { label: 'Request ID', property: 'Request ID' },
                        { label: 'Request Type', property: 'Request Type' },
                        { label: 'Workflow Status', property: 'Workflow Status' },
                        { label: 'Created On', property: 'Created On' },
                        { label: 'Created By', property: 'Created By' }
                    ]
                },
                dataSource: aExportData,
                fileName: "CostCenterRequests.xlsx"
            };

            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(() => { oSheet.destroy(); });
        },
        onChangeExtendPress: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteDisplay");
        },
        viewRequest: function () {
            if (!this._sSelectedRequestId) {
                MessageBox.warning("Please select a request first.");
                return;
            }

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteSubmission", {
                request_type: "view",
                request_id: this._sSelectedRequestId
            });
        },

        _openF4Dialog: function (title) {

            if (!this._F4Dialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "com.deloitte.mdg.costcenter.initiator.initiator.fragment.F4Dialog",
                    controller: this
                }).then((oDialog) => {
                    this._F4Dialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.setTitle(title);
                    oDialog.open();
                });
            } else {
                this._F4Dialog.setTitle(title);
                this._F4Dialog.open();
            }
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
        onF4Select: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");
            if (!oItem) {
                return;
            }

            const sValue = oItem.getTitle();
            const oInput = sap.ui.getCore().byId(this._currentInputId);

            if (oInput && oInput.addToken) {
                const exists = oInput.getTokens().some(t => t.getText() === sValue);
                if (!exists) {
                    oInput.addToken(new sap.m.Token({ text: sValue }));
                }
            }

            // reset search + list
            const oSearch = this.byId("F4SearchField");
            const oList = this.byId("F4List");

            if (oSearch) {
                oSearch.setValue("");
            }
            if (oList) {
                oList.getBinding("items").filter([]);
            }

            this._F4Dialog.close();
        },

        onF4Cancel: function () {
            this._F4Dialog.close();
        },


        onValueHelpRequestRequestId: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            this._currentInputId = oEvent.getSource().getId();

            try {
                const oModel = this.getOwnerComponent().getModel("ServiceModel");

                const oListBinding = oModel.bindList(
                    "/CostCenterRequests",
                    null,
                    null,
                    null,
                    { $select: "requestId" }
                );

                const aContexts = await oListBinding.requestContexts(0, 1000);

                const map = {};
                aContexts.forEach(ctx => {
                    const id = ctx.getObject().requestId;
                    if (id) {
                        map[id] = true;
                    }
                });

                const formatted = Object.keys(map).map(id => ({
                    title: id,
                    description: "Request ID"
                }));

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({ results: formatted }),
                    "F4Model"
                );

                this._openF4Dialog("Request ID");

            } catch (e) {
                sap.m.MessageBox.error("Failed to load Request IDs");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },

        onValueHelpRequestCreatedBy: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            this._currentInputId = oEvent.getSource().getId();

            try {
                const oModel = this.getOwnerComponent().getModel("ServiceModel");

                const oListBinding = oModel.bindList(
                    "/CostCenterRequests",
                    null,
                    null,
                    null,
                    { $select: "createdBy" }
                );

                const aContexts = await oListBinding.requestContexts(0, 1000);

                const map = {};
                aContexts.forEach(ctx => {
                    const user = ctx.getObject().createdBy;
                    if (user) {
                        map[user] = true;
                    }
                });

                const formatted = Object.keys(map).map(user => ({
                    title: user,
                    description: "Created By"
                }));

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({ results: formatted }),
                    "F4Model"
                );

                this._openF4Dialog("Created By");

            } catch (e) {
                sap.m.MessageBox.error("Failed to load Created By values");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        }
    });
});