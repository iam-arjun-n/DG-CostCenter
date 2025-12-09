sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ushell/Container",
    "sap/ui/core/format/DateFormat",
    "sap/ui/model/json/JSONModel"
], function (Controller, Fragment, MessageToast, MessageBox, Container, DateFormat, JSONModel) {
    "use strict";

    return Controller.extend("com.deloitte.mdg.costcenter.initiator.initiator.controller.Submission", {

        onInit: function () {
            var oView = this.getView();
            var oDraftModel = new sap.ui.model.json.JSONModel({
                requestId: "",
                requestType: "",
                workflowStatus: "",
                requestStatus: "",
                createdByName: "",
                costCenterData: []
            });
            oView.setModel(oDraftModel, "DraftModel");

            // comment model for UI display and payload
            var oCommentModel = new sap.ui.model.json.JSONModel([]);
            this.getView().setModel(oCommentModel, "commentModel");

            sap.ui.core.UIComponent.getRouterFor(this)
                .getRoute("RouteSubmission")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var args = oEvent.getParameter("arguments");
            var sType = args.request_type || "create";
            var sFormatted = sType.charAt(0).toUpperCase() + sType.slice(1);

            this.getView().getModel("DraftModel").setProperty("/requestType", sFormatted);
            this._applyVisibility(sFormatted);

            // set createdByName from user info (async)
            this.getUserInfo().then((u) => {
                // store both email and displayName if possible
                this.getView().getModel("DraftModel").setProperty("/createdByName", u.displayName || u.email || u.name || u);
            }).catch(() => {
                // ignore - mock already handled in getUserInfo
            });

            if (args.ca && args.cc && args.ve) {
                this._loadSAPCostCenter(args.ca, args.cc, args.ve);
            }
        },

        _loadSAPCostCenter: function (ca, cc, ve) {
            var oModel = this.getOwnerComponent().getModel("CostCenterModel");
            var encodedVe = encodeURIComponent(ve);
            var sPath = `/A_CostCenter(ControllingArea='${ca}',CostCenter='${cc}',ValidityEndDate=datetime'${encodedVe}')`;

            oModel.read(sPath, {
                urlParameters: {
                    "$expand": "to_Text",
                    "$select": [
                        "ControllingArea",
                        "CostCenter",
                        "ValidityStartDate",
                        "CompanyCode",
                        "BusinessArea",
                        "CostCtrResponsiblePersonName",
                        "CostCtrResponsibleUser",
                        "CostCenterCurrency",
                        "ProfitCenter",
                        "Department",
                        "CostCenterCategory",
                        "CostCenterStandardHierArea",
                        "to_Text/CostCenterName",
                        "to_Text/CostCenterDescription"
                    ].join(",")
                },
                success: this._onSAPDataLoaded.bind(this),
                error: () => MessageToast.show("Failed to load Cost Center details")
            });
        },

        _onSAPDataLoaded: function (oData) {
            var oText = oData.to_Text && oData.to_Text.results && oData.to_Text.results[0] || {};

            var formatted = [{
                controllingArea: oData.ControllingArea,
                costCenter: oData.CostCenter,
                validFrom: this.formatForDB(oData.ValidityStartDate),
                name: oText.CostCenterName,
                description: oText.CostCenterDescription,
                userResponsible: oData.CostCtrResponsibleUser,
                personResponsible: oData.CostCtrResponsiblePersonName,
                department: oData.Department,
                costCenterCategory: oData.CostCenterCategory,
                hierarchyArea: oData.CostCenterStandardHierArea,
                companyCode: oData.CompanyCode,
                businessArea: oData.BusinessArea,
                currency: oData.CostCenterCurrency,
                profitCenter: oData.ProfitCenter
            }];

            this.getView().getModel("DraftModel").setProperty("/costCenterData", formatted);

            // For Extend / Change / Create, editability is now handled
            // centrally when the dialog is opened (edit/view).
            var that = this;
            setTimeout(function () {
                that._checkInitialFilled();
            }, 0);
        },

        _applyVisibility: function (sType) {
            var oView = this.getView();

            var config = {
                Create: {
                    columns: ["Submission_Column_ControllingArea", "Submission_Column_CostCenter"],
                    buttons: [
                        "Submission_Button_Add", "Submission_Button_Delete",
                        "Submission_Button_Edit", "Submission_Button_View",
                        "Submission_Button_Send", "Submission_Button_Duplicatecheck"
                    ]
                },
                Change: {
                    columns: [
                        "Submission_Column_CostCenter", "Submission_Column_Name",
                        "Submission_Column_Description", "Submission_Column_UserResponsible"
                    ],
                    buttons: [
                        "Submission_Button_Edit", "Submission_Button_View",
                        "Submission_Button_ChangeLog", "Submission_Button_Send"
                    ]
                },
                Extend: {
                    columns: [
                        "Submission_Column_CostCenter", "Submission_Column_Name",
                        "Submission_Column_Description", "Submission_Column_UserResponsible"
                    ],
                    buttons: [
                        "Submission_Button_Edit", "Submission_Button_View",
                        "Submission_Button_Send"
                    ]
                }
            };

            var allColumns = [
                "Submission_Column_ControllingArea", "Submission_Column_CostCenter",
                "Submission_Column_Name", "Submission_Column_Description",
                "Submission_Column_UserResponsible"
            ];

            var allButtons = [
                "Submission_Button_Add", "Submission_Button_AddFromRef",
                "Submission_Button_Edit", "Submission_Button_Delete",
                "Submission_Button_View", "Submission_Button_ChangeLog",
                "Submission_Button_Send", "Submission_Button_Duplicatecheck",
                "Submission_Button_Validate"
            ];

            allColumns.concat(allButtons).forEach(function (id) {
                var ctrl = oView.byId(id);
                if (ctrl && ctrl.setVisible) {
                    ctrl.setVisible(false);
                }
            });

            (config[sType] && config[sType].columns || []).forEach(function (id) {
                var ctrl = oView.byId(id);
                if (ctrl && ctrl.setVisible) {
                    ctrl.setVisible(true);
                }
            });

            (config[sType] && config[sType].buttons || []).forEach(function (id) {
                var ctrl = oView.byId(id);
                if (ctrl && ctrl.setVisible) {
                    ctrl.setVisible(true);
                }
            });
        },

        onSelectionChange: function () {
            var item = this.byId("Submission_Table").getSelectedItem();
            var enabled = !!item;

            ["Submission_Button_Edit", "Submission_Button_Delete", "Submission_Button_View"]
                .forEach(function (id) {
                    var ctrl = this.byId(id);
                    if (ctrl && ctrl.setEnabled) {
                        ctrl.setEnabled(enabled);
                    }
                }.bind(this));
        },

        addCostCenter: function () {
            this._editIndex = null;
            this._openCostCenterDialog({}, "edit");
        },

        editCostCenter: function () {
            var item = this.byId("Submission_Table").getSelectedItem();
            if (!item) {
                MessageToast.show("Select a row to edit.");
                return;
            }

            var path = item.getBindingContext("DraftModel").getPath();
            this._editIndex = parseInt(path.split("/").pop(), 10);

            var data = this.getView().getModel("DraftModel")
                .getProperty("/costCenterData")[this._editIndex];

            this._openCostCenterDialog(jQuery.extend({}, data), "edit");
        },

        _openCostCenterDialog: function (oData, sMode) {
            var oView = this.getView();
            this._currentDialogMode = sMode || "edit";

            // ===== DEFAULT VALUES FOR CREATE MODE =====
            if (this._currentDialogMode === "edit" && this._editIndex == null) {

                let today = new Date();
                let endDate = new Date(9999, 11, 31); // Dec = 11

                // Format: "December 16, 2025"
                let formatter = sap.ui.core.format.DateFormat.getDateInstance({
                    style: "long"
                });

                // Apply defaults only if empty
                oData.controllingArea = oData.controllingArea || "1100";
                oData.validFrom = oData.validFrom || formatter.format(today);
                oData.validTo = oData.validTo || formatter.format(endDate);

                // Default checkbox
                oData.actualRevenue = (oData.actualRevenue !== false);
            }

            // ===== LOAD DIALOG =====
            if (!this._CostCenterForm) {
                Fragment.load({
                    id: oView.getId(),
                    name: "com.deloitte.mdg.costcenter.initiator.initiator.fragment.CostCenterForm",
                    controller: this
                }).then(function (dlg) {
                    this._CostCenterForm = dlg;
                    oView.addDependent(dlg);

                    var oModel = new sap.ui.model.json.JSONModel(oData);
                    dlg.setModel(oModel, "DataModel");
                    dlg.open();

                    this._checkInitialFilled();
                    this._applyDialogMode();
                }.bind(this));
            } else {
                var oModel = this._CostCenterForm.getModel("DataModel");
                if (!oModel) {
                    oModel = new sap.ui.model.json.JSONModel(oData);
                    this._CostCenterForm.setModel(oModel, "DataModel");
                } else {
                    oModel.setData(oData);
                }

                this._CostCenterForm.open();
                this._checkInitialFilled();
                this._applyDialogMode();
            }
        },

        // Central place: decides editability based on mode + request type
        _applyDialogMode: function () {
            if (!this._CostCenterForm) {
                return;
            }

            if (this._currentDialogMode === "view") {
                this._setAllDialogFieldsEditable(false);
            } else {
                this._applyEditModeForRequestType();
            }
        },

        onInputValueChange: function (oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oInput.getValue();

            // write to model immediately
            var sPath = oInput.getBinding("value").getPath();
            oInput.getModel("DataModel").setProperty(sPath, sValue);

            this._checkInitialFilled();
        },


        _checkInitialFilled: function () {
            if (!this._CostCenterForm) {
                return;
            }

            var oModel = this._CostCenterForm.getModel("DataModel");
            if (!oModel) {
                return;
            }

            var data = oModel.getData() || {};
            var filled = data.controllingArea && data.costCenter && data.validFrom && data.validTo;

            var tabBasic = this.byId("Tab_BasicData");
            var tabControl = this.byId("Tab_Control");

            if (tabBasic && tabBasic.setEnabled) {
                tabBasic.setEnabled(!!filled);
            }

            if (tabControl && tabControl.setEnabled) {
                tabControl.setEnabled(!!filled);
            }
        },


        onSubmitCostCenter: function () {
            if (!this._CostCenterForm) {
                return;
            }

            if (!this._checkMandatoryFields()) {
                return;
            }

            var oModel = this._CostCenterForm.getModel("DataModel");
            if (!oModel) {
                return;
            }

            var data = oModel.getData();
            var oDraftModel = this.getView().getModel("DraftModel");
            var arr = oDraftModel.getProperty("/costCenterData") || [];

            if (this._editIndex !== undefined && this._editIndex !== null) {
                arr[this._editIndex] = data;
                this._editIndex = null;
            } else {
                arr.push(data);
            }

            oDraftModel.setProperty("/costCenterData", arr);
            this._CostCenterForm.close();
        },

        onCancelCostCenter: function () {
            if (this._CostCenterForm) {
                this._CostCenterForm.close();
            }
            this._editIndex = null;
            // No need to restore anything; next open recalculates editability
        },

        deleteCostCenter: function () {
            var item = this.byId("Submission_Table").getSelectedItem();
            if (!item) {
                MessageToast.show("Select a row to delete.");
                return;
            }

            var path = item.getBindingContext("DraftModel").getPath();
            var idx = parseInt(path.split("/").pop(), 10);
            var oDraftModel = this.getView().getModel("DraftModel");
            var arr = oDraftModel.getProperty("/costCenterData") || [];

            arr.splice(idx, 1);
            oDraftModel.setProperty("/costCenterData", arr);
            this.byId("Submission_Table").removeSelections();
        },

        viewCostCenter: function () {
            var item = this.byId("Submission_Table").getSelectedItem();
            if (!item) {
                MessageToast.show("Select a row to view.");
                return;
            }

            var path = item.getBindingContext("DraftModel").getPath();
            var idx = parseInt(path.split("/").pop(), 10);
            var data = this.getView().getModel("DraftModel").getProperty("/costCenterData")[idx];

            // Open in VIEW mode → all fields read-only
            this._openCostCenterDialog(jQuery.extend({}, data), "view");
        },

        nButtonPress: function () {
            this.getView().getModel("commentModel").setData([]);
            this.getView().getModel("DraftModel").setProperty("/comments", []);

            // clear cost center data also
            this.getView().getModel("DraftModel").setProperty("/costCenterData", []);

            var sType = this.getView().getModel("DraftModel").getProperty("/requestType");

            sap.ui.core.UIComponent.getRouterFor(this)
                .navTo(sType === "Create" ? "RouteOverview" : "RouteDisplay");
        },

        formatForDB: function (dateObj) {
            return dateObj.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric"
            });
        },

        toISO: function (value) {
            if (!value) {
                return null;
            }

            if (value instanceof Date) {
                return value.toISOString().split("T")[0];
            }

            if (typeof value === "string" && value.indexOf("/Date(") > -1) {
                var ms = parseInt(value.replace("/Date(", "").replace(")/", ""), 10);
                return new Date(ms).toISOString().split("T")[0];
            }

            return new Date(value).toISOString().split("T")[0];
        },

        /**
         * FeedInput post handler - adds a comment to commentModel.
         * Stores both UI-friendly fields and payload fields:
         *  - UI: UserName, Date, Text  (used by view's FeedListItem)
         *  - Payload: user, role, commentText
         *
         * Option C: we include both actual username (from UserInfo) and a role.
         */
        onPost: function (oEvent) {
            var oFormat = DateFormat.getDateTimeInstance({ style: "medium" });
            var oComments = this.getView().getModel("commentModel");
            var oDate = new Date();
            var sDate = oFormat.format(oDate);

            var sValue = oEvent.getParameter("value");
            if (!sValue || !sValue.trim()) {
                MessageToast.show("Comment cannot be empty.");
                return;
            }

            var aComments = oComments.getData();
            var oEntry = {
                UserName: this.getOwnerComponent().currentUser,
                Date: sDate,
                Text: sValue
            };

            aComments.unshift(oEntry);
            oComments.setData(aComments);

            oEvent.getSource().setValue("");
        },


        initiateApprovalProcess: async function () {
            try {
                let oDraft = this.getView().getModel("DraftModel").getData();
                let oModel = this.getOwnerComponent().getModel("ServiceModel");
                let comments = this.getView().getModel("commentModel").getData();

                if (comments.length === 0) {
                    MessageBox.information("Please add at least one comment before sending for approval.");
                    return;
                }

                // 1️⃣ Create CAP object
                let payload = {
                    requestType: oDraft.requestType,
                    createdByName: oDraft.createdByName,
                    costCenterData: oDraft.costCenterData.map(i => ({
                        //Basic Data Tab
                        controllingArea: i.controllingArea,
                        costCenter: i.costCenter,
                        validFrom: this.toISO(i.validFrom),
                        validTo: this.toISO(i.validTo),
                        name: i.name,
                        description: i.description,
                        userResponsible: i.userResponsible,
                        personResponsible: i.personResponsible,
                        department: i.department,
                        costCenterCategory: i.costCenterCategory,
                        hierarchyArea: i.hierarchyArea,
                        companyCode: i.companyCode,
                        businessArea: i.businessArea,
                        currency: i.currency,
                        profitCenter: i.profitCenter,

                        //Control Tab
                        recordQuantity: i.recordQuantity,
                        actualPrimaryCosts: i.actualPrimaryCosts,
                        actualSecondaryCosts: i.actualSecondaryCosts,
                        planPrimaryCosts: i.planPrimaryCosts,
                        planSecondaryCosts: i.planSecondaryCosts,
                        actualRevenue: i.actualRevenue,
                        planRevenue: i.planRevenue,
                        commitmentUpdate: i.commitmentUpdate
                    })),
                    comments: comments.map(c => ({
                        user: c.UserName,
                        role: "Initiator",
                        commentText: c.Text
                    }))
                };

                let listBinding = oModel.bindList("/CostCenterRequests");
                let context = await listBinding.create(payload);
                await context.created();
                let reqId = context.getProperty("requestId");
                let response = await fetch(
                    this._getWorkflowBaseURL() + "/workflow-instances",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-CSRF-Token": this._fetchCSRFToken()
                        },
                        body: JSON.stringify({
                            definitionId: "com.deloitte.mdg.costcenter.workflow.costcenterapprovalprocess",
                            context: { ReqId: reqId }
                        })
                    }
                );

                if (!response.ok) {
                    let msg = await response.text();
                    throw new Error(msg);
                }

                MessageToast.show("Request submitted successfully!");
                sap.ui.core.UIComponent.getRouterFor(this).navTo("RouteOverview");

                this.getView().getModel("commentModel").setData([]);
                this.getView().getModel("DraftModel").setProperty("/costCenterData", []);

            } catch (e) {
                MessageBox.error("Submit failed: " + e.message);
            }
        },



        // ---------- Helper: field id groups ----------

        _getWorkflowBaseURL: function () {
            let appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");
            let appPath = appId.replaceAll(".", "/");
            return jQuery.sap.getModulePath(appPath) + "/bpmworkflowruntime/v1";
        },

        _fetchCSRFToken: function () {
            let token;
            $.ajax({
                url: this._getWorkflowBaseURL() + "/xsrf-token",
                method: "GET",
                async: false,
                headers: { "X-CSRF-Token": "Fetch" },
                success: function (_, __, xhr) {
                    token = xhr.getResponseHeader("X-CSRF-Token");
                }
            });
            return token;
        },


        _getInitialFieldIds: function () {
            return ["controllingArea", "costCenter", "validFrom", "validTo"];
        },

        _getOtherFieldIds: function () {
            return [
                "name", "description", "userResponsible", "personResponsible",
                "department", "costCenterCategory", "hierarchyArea",
                "companyCode", "businessArea", "currency", "profitCenter",

                // Control tab Optional
                "recordQuantity",
                "actualPrimaryCosts",
                "actualSecondaryCosts",
                "planPrimaryCosts",
                "planSecondaryCosts",
                "actualRevenue",
                "planRevenue",
                "commitmentUpdate"
            ];
        },

        _setAllDialogFieldsEditable: function (bEditable) {
            var allIds = this._getInitialFieldIds().concat(this._getOtherFieldIds());
            var that = this;
            allIds.forEach(function (id) {
                var ctrl = that.byId(id);
                if (ctrl && ctrl.setEditable) {
                    ctrl.setEditable(bEditable);
                }
            });
        },

        _checkMandatoryFields: function () {
            var oModel = this._CostCenterForm.getModel("DataModel");
            var d = oModel.getData();

            var missing = [];

            function req(field, label) {
                if (!d[field] || d[field] === "") {
                    missing.push(label);
                }
            }

            // Header Data
            req("controllingArea", "Controlling Area");
            req("costCenter", "Cost Center");
            req("validFrom", "Valid From");
            req("validTo", "Valid To");

            // Basic Data
            req("personResponsible", "Person Responsible");
            req("costCenterCategory", "Cost Center Category");
            req("hierarchyArea", "Hierarchy Area");
            req("companyCode", "Company Code");
            req("currency", "Currency");

            if (missing.length > 0) {
                MessageBox.error("Please enter mandatory fields:\n\n• " + missing.join("\n• "));
                return false;
            }

            return true;
        },


        // Core rule engine: applies EDIT mode rules per requestType
        _applyEditModeForRequestType: function () {
            var oDraft = this.getView().getModel("DraftModel").getData();
            var sType = oDraft.requestType;
            var initialFields = this._getInitialFieldIds();
            var otherFields = this._getOtherFieldIds();
            var that = this;

            if (sType === "Create") {
                this._setAllDialogFieldsEditable(true);
                return;
            }

            if (sType === "Change") {
                initialFields.forEach(function (id) {
                    var ctrl = that.byId(id);
                    if (ctrl && ctrl.setEditable) {
                        ctrl.setEditable(false);
                    }
                });
                otherFields.forEach(function (id) {
                    var ctrl = that.byId(id);
                    if (ctrl && ctrl.setEditable) {
                        ctrl.setEditable(true);
                    }
                });
                return;
            }

            if (sType === "Extend") {
                if (!this._CostCenterForm) {
                    return;
                }
                var oModel = this._CostCenterForm.getModel("DataModel");
                var oData = (oModel && oModel.getData()) || {};

                initialFields.forEach(function (id) {
                    var ctrl = that.byId(id);
                    if (ctrl && ctrl.setEditable) {
                        ctrl.setEditable(false);
                    }
                });

                otherFields.forEach(function (id) {
                    var ctrl = that.byId(id);
                    if (!ctrl || !ctrl.setEditable) {
                        return;
                    }
                    var value = oData[id];
                    // If value exists → readonly, else editable
                    ctrl.setEditable(!value);
                });
                return;
            }

            // Default fallback: make everything editable
            this._setAllDialogFieldsEditable(true);
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
            if (oInput) {
                oInput.setValue(sValue);
            }

            this._F4Dialog.close();
        },


        onF4Cancel: function () {
            this._F4Dialog.close();
        },

        onValueHelpRequestControllingArea: function (oEvent) {
            sap.ui.core.BusyIndicator.show();

            const inputId = oEvent.getSource().getId();
            this._currentInputId = inputId;

            const oModel = this.getOwnerComponent().getModel("SAPModel");
            const entitySet = "/I_ControllingArea";

            oModel.read(entitySet, {
                success: (oData) => {
                    // Map to your universal F4 structure
                    const formattedData = oData.results.map(item => ({
                        title: item.ControllingArea,
                        description: item.ControllingAreaName
                    }));

                    // Prepare model format your new dialog expects
                    const wrappedData = { results: formattedData };

                    const oF4Model = new sap.ui.model.json.JSONModel(wrappedData);
                    this.getView().setModel(oF4Model, "F4Model");

                    // Open dialog
                    this._openF4Dialog("Controlling Area");

                    sap.ui.core.BusyIndicator.hide();
                },
                error: (err) => {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageBox.error("Failed to load Controlling Areas: " + err.message);
                }
            });
        },
        onValueHelpRequestCostCenter: function (oEvent) {
            sap.ui.core.BusyIndicator.show();

            // Store the input ID so we know where to write back the result
            this._currentInputId = oEvent.getSource().getId();

            const oModel = this.getOwnerComponent().getModel("SAPModel");
            const entitySet = "/ZI_DDCOSTCENTER";

            // OPTIONAL: Filter by controlling area if you want
            const sCA = this._CostCenterForm
                .getModel("DataModel")
                .getProperty("/controllingArea");

            let aFilters = [];
            if (sCA) {
                aFilters.push(new sap.ui.model.Filter("kokrs", sap.ui.model.FilterOperator.EQ, sCA));
            }

            oModel.read(entitySet, {
                filters: aFilters,
                success: (oData) => {
                    const formatted = oData.results.map(item => ({
                        title: item.kostl,           // Cost center
                        description: item.ktext      // Short text (or item.ltext)
                    }));

                    const wrapped = { results: formatted };

                    const oF4Model = new sap.ui.model.json.JSONModel(wrapped);
                    this.getView().setModel(oF4Model, "F4Model");

                    this._openF4Dialog("Cost Center");
                    sap.ui.core.BusyIndicator.hide();
                },
                error: (err) => {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageBox.error("Failed to load Cost Centers: " + err.message);
                }
            });
        },

        onValueHelpRequestCostCenterCategory: function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            this._currentInputId = oEvent.getSource().getId();

            const oModel = this.getOwnerComponent().getModel("SAPModel");

            oModel.read("/ZI_DDCOSTCENTER", {
                success: (oData) => {
                    // Unique categories only
                    const map = {};
                    oData.results.forEach(item => map[item.kosar] = item.kosar);

                    const formatted = Object.keys(map).map(key => ({
                        title: key,
                        description: "Category " + key
                    }));

                    this.getView().setModel(new sap.ui.model.json.JSONModel({ results: formatted }), "F4Model");
                    this._openF4Dialog("Cost Center Category");

                    sap.ui.core.BusyIndicator.hide();
                },
                error: (err) => {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageBox.error("Failed to load Cost Center Categories: " + err.message);
                }
            });
        },

        onValueHelpRequestCompanyCode: function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            this._currentInputId = oEvent.getSource().getId();

            const oModel = this.getOwnerComponent().getModel("SAPModel");

            oModel.read("/ZI_DDCOSTCENTER", {
                success: (oData) => {
                    const map = {};
                    oData.results.forEach(item => map[item.bukrs] = item.bukrs);

                    const formatted = Object.keys(map).map(key => ({
                        title: key,
                        description: "Company Code " + key
                    }));

                    this.getView().setModel(new sap.ui.model.json.JSONModel({ results: formatted }), "F4Model");
                    this._openF4Dialog("Company Code");

                    sap.ui.core.BusyIndicator.hide();
                },
                error: (err) => {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageBox.error("Failed to load Company Codes: " + err.message);
                }
            });
        },

        onValueHelpRequestProfitCenter: function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            this._currentInputId = oEvent.getSource().getId();

            const oModel = this.getOwnerComponent().getModel("SAPModel");

            oModel.read("/ZI_DDCOSTCENTER", {
                success: (oData) => {
                    const map = {};
                    oData.results.forEach(item => map[item.prctr] = item.prctr);

                    const formatted = Object.keys(map).map(key => ({
                        title: key,
                        description: "Profit Center " + key
                    }));

                    this.getView().setModel(new sap.ui.model.json.JSONModel({ results: formatted }), "F4Model");
                    this._openF4Dialog("Profit Center");

                    sap.ui.core.BusyIndicator.hide();
                },
                error: (err) => {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageBox.error("Failed to load Profit Centers: " + err.message);
                }
            });
        },

        onValueHelpRequestCurrency: function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            this._currentInputId = oEvent.getSource().getId();

            const oModel = this.getOwnerComponent().getModel("SAPModel");

            oModel.read("/ZI_DDCOSTCENTER", {
                success: (oData) => {
                    const map = {};
                    oData.results.forEach(item => map[item.waers] = item.waers);

                    const formatted = Object.keys(map).map(key => ({
                        title: key,
                        description: "Currency " + key
                    }));

                    this.getView().setModel(new sap.ui.model.json.JSONModel({ results: formatted }), "F4Model");
                    this._openF4Dialog("Currency");

                    sap.ui.core.BusyIndicator.hide();
                },
                error: (err) => {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageBox.error("Failed to load Currencies: " + err.message);
                }
            });
        },
        onValueHelpRequestHierarchyArea: function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            this._currentInputId = oEvent.getSource().getId();

            const oModel = this.getOwnerComponent().getModel("SAPModel");

            oModel.read("/ZI_DDCOSTCENTER", {
                success: (oData) => {
                    const map = {};
                    oData.results.forEach(item => map[item.khinr] = item.khinr);

                    const formatted = Object.keys(map).map(key => ({
                        title: key,
                        description: "Hierarchy " + key
                    }));

                    this.getView().setModel(new sap.ui.model.json.JSONModel({ results: formatted }), "F4Model");
                    this._openF4Dialog("Hierarchy Area");

                    sap.ui.core.BusyIndicator.hide();
                },
                error: (err) => {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageBox.error("Failed to load Hierarchy Areas: " + err.message);
                }
            });
        },

        /**
         * getUserInfo: returns an object { email, name, displayName } when possible
         */
        getUserInfo: async function () {

            let mock = {
                email: "dummy.user@com",
                name: "dummy.user@com",
                displayName: "Dummy User (dummy.user@com)"
            };

            try {
                const UserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");

                let email =
                    (UserInfo.getEmail && UserInfo.getEmail()) ||
                    (UserInfo.getId && UserInfo.getId()) ||
                    mock.email;

                let displayName =
                    (UserInfo.getFullName && UserInfo.getFullName()) ||
                    (UserInfo.getDisplayName && UserInfo.getDisplayName()) ||
                    email;

                return {
                    email: email,
                    name: email,
                    displayName: displayName
                };

            } catch (e) {
                return mock;
            }
        },


    });
});