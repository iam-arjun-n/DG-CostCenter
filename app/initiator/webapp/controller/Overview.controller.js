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
    "com/deloitte/mdg/costcenter/initiator/initiator/model/formatter"
], function (Controller, Fragment, Filter, FilterOperator, FilterType, Token, MessageBox, JSONModel, Spreadsheet, formatter) {
    "use strict";

    return Controller.extend("com.deloitte.mdg.costcenter.initiator.initiator.controller.Overview", {

        formatter: formatter,

        onInit: function () {
            this._oModel = this.getView().getModel("costCenterModel");
            this._addCurrentUserToken();
        },

        _addCurrentUserToken: function () {
            var oCreatedByInput = this.byId("Overview_Created_By");
            var sCurrentUser = this.getOwnerComponent().getModel("userInfo")?.getProperty("/email");

            if (sCurrentUser && oCreatedByInput) {
                oCreatedByInput.addToken(new Token({ text: sCurrentUser }));
            }
        },

        onGo: function () {
            var oTable = this.byId("Overview_Table");
            var oBinding = oTable.getBinding("items");
            var aFilters = [];

            var sGlobalSearch = this.byId("Request_Id").getValue();
            if (sGlobalSearch) {
                var aGlobalFilters = [
                    new Filter("requestId", FilterOperator.Contains, sGlobalSearch),
                    new Filter("requestType", FilterOperator.Contains, sGlobalSearch),
                    new Filter("workflowStatus", FilterOperator.Contains, sGlobalSearch),
                    new Filter("createdBy", FilterOperator.Contains, sGlobalSearch)
                ];
                aFilters.push(new Filter({ filters: aGlobalFilters, and: false }));
            }

            var sReqType = this.byId("Request_Type").getSelectedKey();
            if (sReqType) {
                aFilters.push(new Filter("requestType", FilterOperator.EQ, sReqType));
            }

            var sWFStatus = this.byId("Workflow_Status").getSelectedKey();
            if (sWFStatus) {
                aFilters.push(new Filter("workflowStatus", FilterOperator.EQ, sWFStatus));
            }

            var oCreatedBy = this.byId("Overview_Created_By");
            var aTokens = oCreatedBy.getTokens();
            if (aTokens.length > 0) {
                var aCreatedByFilters = aTokens.map(function (token) {
                    return new Filter("createdBy", FilterOperator.Contains, token.getText());
                });
                aFilters.push(new Filter({ filters: aCreatedByFilters, and: false }));
            }

            var oDateRangeStart = this.byId("Creation_Date").getDateValue();
            var oDateRangeEnd = this.byId("Creation_Date").getSecondDateValue();
            if (oDateRangeStart && oDateRangeEnd) {
                aFilters.push(new Filter("createdAt", FilterOperator.BT, oDateRangeStart, oDateRangeEnd));
            }

            oBinding.filter(aFilters, FilterType.Application);
        },

        onClear: function () {
            this.byId("Request_Id").setValue("");
            this.byId("Request_Type").setSelectedKey("");
            this.byId("Workflow_Status").setSelectedKey("");
            var oCreatedBy = this.byId("Overview_Created_By");
            oCreatedBy.destroyTokens();
            this.byId("Creation_Date").setValue("");
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
            if (!oItem) return;
            var oCtx = oItem.getBindingContext("costCenterModel");
            console.log("Selected Request:", oCtx.getProperty("requestId"));
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
        }

    });
});