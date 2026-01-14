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

            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteOverview")
                .attachPatternMatched(this._onOverviewRouteMatched, this);

        },
        _onOverviewRouteMatched: function () {
            const oTable = this.byId("Overview_Table");
            if (!oTable) {
                return;
            }

            const oBinding = oTable.getBinding("items");
            if (oBinding) {
                oTable.removeSelections();
                oBinding.refresh();
            }
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
            const oItem = oEvent.getParameter("listItem");
            const oViewBtn = this.byId("Overview_Button_View");
            const oDeleteBtn = this.byId("Overview_Button_DeleteDraft");

            if (!oItem) {
                oViewBtn.setEnabled(false);
                oDeleteBtn.setEnabled(false);
                return;
            }

            const oCtx = oItem.getBindingContext("ServiceModel");
            const status = oCtx.getProperty("workflowStatus");

            this._sSelectedRequestId = oCtx.getProperty("requestId");

            oViewBtn.setEnabled(true);
            oDeleteBtn.setEnabled(status === "Draft");
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

        onDeleteDraftPress: function () {
            const oTable = this.byId("Overview_Table");
            const oItem = oTable.getSelectedItem();

            if (!oItem) {
                sap.m.MessageBox.warning("Select a draft to delete");
                return;
            }

            const oCtx = oItem.getBindingContext("ServiceModel");
            const sStatus = oCtx.getProperty("workflowStatus");

            if (sStatus !== "Draft") {
                sap.m.MessageBox.error("Only Draft requests can be deleted");
                return;
            }

            sap.m.MessageBox.confirm("Delete this draft?", {
                actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                onClose: async (sAction) => {
                    if (sAction !== sap.m.MessageBox.Action.OK) {
                        return;
                    }

                    try {
                        await oCtx.delete();

                        sap.m.MessageToast.show("Draft deleted");

                        oTable.removeSelections();
                        oTable.getBinding("items").refresh();

                    } catch (e) {
                        console.error("Delete failed", e);
                        sap.m.MessageBox.error("Failed to delete draft");
                    }
                }
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
        },

        //Link Popup
        _openCostCenterPopover: function (oSource, aCostCenters) {

            if (!this._oCostCenterPopover) {
                this._oCostCenterPopover = new sap.m.Popover({
                    title: "Cost Centers",
                    placement: sap.m.PlacementType.Auto,
                    contentWidth: "350px",
                    resizable: true,
                    draggable: true,
                    content: [
                        new sap.m.List({
                            items: {
                                path: "ccPopoverModel>/items",
                                template: new sap.m.StandardListItem({
                                    title: "{ccPopoverModel>CostCenter}",
                                    description: "{ccPopoverModel>Name}"
                                })
                            }
                        })
                    ]
                });

                this.getView().addDependent(this._oCostCenterPopover);
            }

            const oPopoverModel = new sap.ui.model.json.JSONModel({
                items: aCostCenters
            });

            this._oCostCenterPopover.setModel(oPopoverModel, "ccPopoverModel");
            this._oCostCenterPopover.openBy(oSource);
        },

        onRequestPress: function (oEvent) {
            const oSource = oEvent.getSource();
            const oCtx = oSource.getBindingContext("ServiceModel");

            if (!oCtx) {
                sap.m.MessageBox.error("No request context found");
                return;
            }

            const sReqId = oCtx.getProperty("requestId");
            const oModel = this.getView().getModel("ServiceModel");
            const oContext = oModel.bindContext(
                `/CostCenterRequests(requestId='${sReqId}')`,
                null,
                { $expand: "costCenterData" }
            );

            oContext.requestObject()
                .then(function (oData) {
                    sap.ui.core.BusyIndicator.hide();

                    const aCostCenters = (oData.costCenterData || []).map(cc => ({
                        CostCenter: cc.costCenter,
                        Name: cc.name
                    }));

                    if (!aCostCenters.length) {
                        sap.m.MessageToast.show("No Cost Centers found");
                        return;
                    }

                    this._openCostCenterPopover(oSource, aCostCenters);
                }.bind(this))
                .catch(function (err) {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageBox.error("Failed to load Cost Center details");
                    console.error(err);
                });
        },

    });
});