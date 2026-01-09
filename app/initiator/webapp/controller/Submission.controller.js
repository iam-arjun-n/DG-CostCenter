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
            sap.ui.require(
                ["com/deloitte/mdg/costcenter/initiator/initiator/libs/xlsx.full.min"],
                function () {
                    console.log("XLSX loaded:", window.XLSX);
                }
            );
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
            var sReqId = args.request_id;
            var sFormatted = sType.charAt(0).toUpperCase() + sType.slice(1);

            this.getView().getModel("DraftModel").setProperty("/requestType", sFormatted);
            this._applyVisibility(sFormatted);
            if (sType === "view" && sReqId) {
                this._loadRequestFromCAP(sReqId);
                return;
            }
            this.getUserInfo().then((u) => {

                this.getView().getModel("DraftModel").setProperty("/createdByName", u.displayName || u.email || u.name || u);
            }).catch(() => {
            });

            if (args.ca && args.cc && args.ve) {
                this._loadSAPCostCenter(args.ca, args.cc, args.ve);
            }
        },

        _loadRequestFromCAP: function (reqId) {
            var oModel = this.getOwnerComponent().getModel("ServiceModel");

            var oContext = oModel.bindContext(
                `/CostCenterRequests(requestId='${reqId}')`,
                null,
                { $expand: "costCenterData,comments" }
            );

            oContext.requestObject().then((oData) => {
                var oDraft = this.getView().getModel("DraftModel");

                oDraft.setData({
                    requestId: oData.requestId,
                    requestType: "View",
                    workflowStatus: oData.workflowStatus,
                    requestStatus: oData.requestStatus,
                    createdByName: oData.createdByName,
                    costCenterData: oData.costCenterData || []
                });

                // Comments → UI model
                var aComments = (oData.comments || []).map(c => ({
                    UserName: c.createdBy,
                    Date: c.createdAt,
                    Text: c.commentText
                }));

                this.getView().getModel("commentModel").setData(aComments);

            }).catch((e) => {
                MessageBox.error("Failed to load request " + reqId);
            });
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
                        "ValidityEndDate",
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
                validTo: this.formatForDB(oData.ValidityEndDate),
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
                    columns: ["Submission_Column_ControllingArea", "Submission_Column_CostCenter", "Submission_Column_Name", "Submission_Column_Description"],
                    buttons: [
                        "Submission_Button_Add", "Submission_Button_Delete",
                        "Submission_Button_Edit", "Submission_Button_View",
                        "Submission_Button_Send", "Submission_Button_Duplicatecheck",
                        "Submission_FileUploader", "Submission_Button_Export"
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
                },
                View: {
                    columns: [
                        "Submission_Column_ControllingArea",
                        "Submission_Column_CostCenter",
                        "Submission_Column_Name",
                        "Submission_Column_Description",
                    ],
                    buttons: [
                        "Submission_Button_View"
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
                "Submission_Button_Validate", "Submission_FileUploader",
                "Submission_Button_Export"
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

            // lazy-create the message model (cache on controller)
            if (!this._ccMessageModel) {
                this._ccMessageModel = new JSONModel({ messages: [] });
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

                    // Data model for form fields
                    var oModel = new sap.ui.model.json.JSONModel(oData);
                    dlg.setModel(oModel, "DataModel");

                    // Attach/create the cc message model on the dialog (so validator can write to it)
                    dlg.setModel(this._ccMessageModel, "ccMessageModel");

                    dlg.open();

                    this._checkInitialFilled();
                    this._applyDialogMode();
                }.bind(this)).catch(function (err) {
                    // defensive: show error if fragment failed to load
                    MessageToast.show("Failed to open Cost Center dialog: " + (err.message || err));
                }.bind(this));
            } else {
                // dialog already created — update data model
                var oModel = this._CostCenterForm.getModel("DataModel");
                if (!oModel) {
                    oModel = new sap.ui.model.json.JSONModel(oData);
                    this._CostCenterForm.setModel(oModel, "DataModel");
                } else {
                    oModel.setData(oData);
                }

                // ensure the ccMessageModel is attached to the existing dialog
                if (!this._CostCenterForm.getModel("ccMessageModel")) {
                    this._CostCenterForm.setModel(this._ccMessageModel, "ccMessageModel");
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
            if (this._currentDialogMode === "view") {
                this._CostCenterForm.close();
                return;
            }
            if (!this._CostCenterForm) {
                return;
            }

            if (!this._validateCostCenterForm()) {
                this.onCCMessagePopoverPress({ getSource: () => this.byId("ccMsgButton") });
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

                // clear message model
                let mm = this._CostCenterForm.getModel("ccMessageModel");
                if (mm) {
                    mm.setProperty("/messages", []);
                }

                // remove red borders
                this._CostCenterForm.findElements(true).forEach(ctrl => {
                    if (ctrl.setValueState) {
                        ctrl.setValueState("None");
                    }
                });

                this._CostCenterForm.close();
            }

            this._editIndex = null;
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

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);

            if (sType === "Create" || sType === "View") {
                oRouter.navTo("RouteOverview");
            } else {
                oRouter.navTo("RouteDisplay");
            }
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
                    ctrl.setEditable(!value);
                });
            }

            var always = ["validFrom", "validTo"];
            always.forEach(function (id) {
                var ctrl = that.byId(id);
                if (ctrl && ctrl.setEditable) {
                    ctrl.setEditable(false);
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
            if (oInput) {
                oInput.setValue(sValue);

                const oBinding = oInput.getBinding("value");
                if (oBinding) {
                    oBinding.getModel().setProperty(oBinding.getPath(), sValue);
                }
            }

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

        onValueHelpRequestPersonResponsible: function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            this._currentInputId = oEvent.getSource().getId();

            const oModel = this.getOwnerComponent().getModel("SAPModel");

            oModel.read("/ZI_DDCOSTCENTER", {
                success: (oData) => {
                    const map = {};
                    oData.results.forEach(item => map[item.verak] = item.verak);

                    const formatted = Object.keys(map).map(key => ({
                        title: key,
                        description: "Person Responsible: " + key
                    }));

                    this.getView().setModel(new sap.ui.model.json.JSONModel({ results: formatted }), "F4Model");
                    this._openF4Dialog("Person Responsible");

                    sap.ui.core.BusyIndicator.hide();
                },
                error: (err) => {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageBox.error("Failed to load Person Responsible: " + err.message);
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

        //Mandatory Check:
        _validateCostCenterForm: function () {

            const oDialog = this._CostCenterForm || this.byId("CostCenterForm_Dialog");
            if (!oDialog) {
                return true;
            }

            // --- CLEAR OLD ERRORS ---
            let ccModel = oDialog.getModel("ccMessageModel");
            if (!ccModel) {
                this._ccMessageModel = this._ccMessageModel || new JSONModel({ messages: [] });
                oDialog.setModel(this._ccMessageModel, "ccMessageModel");
                ccModel = oDialog.getModel("ccMessageModel");
            }

            ccModel.setProperty("/messages", []); // reset previous validation messages

            const aErrors = [];

            // --- VALIDATE REQUIRED CONTROLS ---
            oDialog.findElements(true).forEach(ctrl => {

                if (ctrl.getRequired && ctrl.getRequired()) {

                    let val = this._getValueFromCC(ctrl);

                    if (!val) {
                        let label = this._findLabelForCC(ctrl);

                        // add to error list
                        aErrors.push({
                            id: ctrl.getId(),
                            type: "Error",
                            title: label + " is mandatory",
                            description: "Please provide a value for " + label
                        });

                        // highlight the control
                        if (ctrl.setValueState) {
                            ctrl.setValueState("Error");
                            ctrl.setValueStateText(label + " is mandatory");
                        }

                    } else {
                        if (ctrl.setValueState) {
                            ctrl.setValueState("None");
                        }
                    }
                }
            });

            // --- WRITE BACK INTO MODEL FOR POPOVER ---
            ccModel.setProperty("/messages", aErrors);

            return aErrors.length === 0;
        },



        onCCMessagePopoverPress: function (oEvent) {

            // locate or create the popover
            if (!this._ccMsgPopover) {
                this._ccMsgPopover = this.byId("ccMsgPopover");
            }

            // get the button from dialog
            let btn = this.byId("ccMsgButton");

            // fallback for fragment scope
            if (!btn && this._CostCenterForm) {
                btn = this._CostCenterForm.byId("ccMsgButton");
            }

            // open it
            if (btn) {
                this._ccMsgPopover.openBy(btn);
            }
        },

        _getValueFromCC: function (ctrl) {

            if (ctrl.getValue) return ctrl.getValue();
            if (ctrl.getSelectedKey) return ctrl.getSelectedKey();
            if (ctrl.getSelectedKeys) return ctrl.getSelectedKeys().length ? ctrl.getSelectedKeys() : null;
            if (ctrl.getSelectedItem) return ctrl.getSelectedItem()?.getKey();
            if (ctrl.getDateValue) return ctrl.getDateValue();

            return null;
        },

        _findLabelForCC: function (ctrl) {

            const dialog = this.byId("CostCenterForm_Dialog");
            const id = ctrl.getId();
            let result = "";

            dialog.findElements(true).forEach(el => {
                if (el.getLabelFor && el.getLabelFor() === id) {
                    result = el.getText();
                }
            });

            return result || ctrl.getName() || id;
        },
        _showCostCenterValidationErrors: function (aErrors) {

            const items = aErrors.map(msg => new sap.m.MessageItem({
                type: sap.ui.core.MessageType.Error,
                title: msg
            }));

            const view = new sap.m.MessageView({ items });

            const dlg = new sap.m.Dialog({
                title: "Validation Errors",
                state: sap.ui.core.ValueState.Error,
                contentHeight: "280px",
                resizable: true,
                content: view,
                beginButton: new sap.m.Button({
                    text: "Close",
                    press: () => dlg.close()
                })
            });

            dlg.open();
        },
        _updateFieldError: function (ctrl, msg) {

            // Get model
            var oModel = this._CostCenterForm.getModel("ccMessageModel");
            if (!oModel) {
                this._ccMessageModel = this._ccMessageModel || new sap.ui.model.json.JSONModel({ messages: [] });
                this._CostCenterForm.setModel(this._ccMessageModel, "ccMessageModel");
                oModel = this._CostCenterForm.getModel("ccMessageModel");
            }

            // Remove old errors for this field
            var aMessages = oModel.getProperty("/messages") || [];
            var id = ctrl.getId();
            aMessages = aMessages.filter(m => m.id !== id);

            // Add new if error exists
            if (msg) {
                aMessages.push({
                    id: id,
                    type: "Error",
                    title: msg,
                    description: msg
                });
                ctrl.setValueState("Error");
                ctrl.setValueStateText(msg);
            } else {
                ctrl.setValueState("None");
            }

            // Update model with new message list
            oModel.setProperty("/messages", aMessages);
        },
        _clearMandatoryErrorIfFilled: function (ctrl) {
            if (ctrl.getRequired && ctrl.getRequired()) {
                const val = this._getValueFromCC(ctrl);
                if (val && val.toString().trim()) {
                    this._updateFieldError(ctrl, null);
                }
            }
        },


        //Validation
        validateControllingArea: function (oEvent) {
            const ctrl = oEvent.getSource();
            this.onInputValueChange(oEvent);
            this._clearMandatoryErrorIfFilled(ctrl);
        },

        validateCostCenter: function (oEvent) {
            const ctrl = oEvent.getSource();
            this.onInputValueChange(oEvent);
            this._clearMandatoryErrorIfFilled(ctrl);
        },

        validateName: function (oEvent) {
            const ctrl = oEvent.getSource();
            const val = ctrl.getValue().trim();
            this._clearMandatoryErrorIfFilled(ctrl);

            if (!/^[A-Za-z ]*$/.test(val)) {
                this._updateFieldError(ctrl, "No special characters allowed");
                return;
            }

            if (val.length > 30) {
                this._updateFieldError(ctrl, "Name cannot exceed 30 characters");
                return;
            }

            this._updateFieldError(ctrl, null);
        },

        validateDescription: function (oEvent) {
            var ctrl = oEvent.getSource();
            var val = ctrl.getValue().trim();
            this._clearMandatoryErrorIfFilled(ctrl);

            if (val.length > 40) {
                this._updateFieldError(ctrl, "Description cannot exceed 40 characters");
                return;
            }

            if (!/^[A-Za-z0-9 ]*$/.test(val)) {
                this._updateFieldError(ctrl, "No special characters allowed");
                return;
            }

            this._updateFieldError(ctrl, null);
        },

        validatePersonResponsible: function (oEvent) {
            var ctrl = oEvent.getSource();
            var val = ctrl.getValue().trim();
            this._clearMandatoryErrorIfFilled(ctrl);
        },

        validateDepartment: function (oEvent) {
            var ctrl = oEvent.getSource();
            var val = ctrl.getValue().trim();
            this._clearMandatoryErrorIfFilled(ctrl);
        },

        validateCostCenterCategory: function (oEvent) {
            var ctrl = oEvent.getSource();
            var val = ctrl.getValue().trim();
            this._clearMandatoryErrorIfFilled(ctrl);
        },

        validateHierarchyArea: function (oEvent) {
            var ctrl = oEvent.getSource();
            var val = ctrl.getValue().trim();
            this._clearMandatoryErrorIfFilled(ctrl);
        },

        validateCompanyCode: function (oEvent) {
            var ctrl = oEvent.getSource();
            var val = ctrl.getValue().trim();
            this._clearMandatoryErrorIfFilled(ctrl);
        },

        validateBusinessArea: function (oEvent) {
            var ctrl = oEvent.getSource();
            var val = ctrl.getValue().trim();
            this._clearMandatoryErrorIfFilled(ctrl);
        },

        validateCurrency: function (oEvent) {
            var ctrl = oEvent.getSource();
            var val = ctrl.getValue().trim();
            this._clearMandatoryErrorIfFilled(ctrl);
        },

        validateProfitCenter: function (oEvent) {
            var ctrl = oEvent.getSource();
            var val = ctrl.getValue().trim();
            this._clearMandatoryErrorIfFilled(ctrl);
        },

        //Mass Upload
        onDownloadTemplate: function () {
            const sUrl = sap.ui.require.toUrl(
                "com/deloitte/mdg/costcenter/initiator/initiator/templates/Cost Center Mass Upload Template.xlsx"
            );

            const oLink = document.createElement("a");
            oLink.href = sUrl;
            oLink.download = "Cost Center Mass Upload Template.xlsx";
            document.body.appendChild(oLink);
            oLink.click();
            document.body.removeChild(oLink);
        },

        onExcelUpload: function (oEvent) {
            const file = oEvent.getParameter("files")[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: "array" });

                    const sheetName = "Cost Center";
                    const worksheet = workbook.Sheets[sheetName];

                    if (!worksheet) {
                        MessageBox.error("Sheet 'Cost Center' not found in Excel.");
                        return;
                    }

                    const rows = XLSX.utils.sheet_to_json(worksheet, {
                        defval: "",
                        raw: true
                    });

                    this._processCostCenterExcel(rows);

                } catch (err) {
                    MessageBox.error("Failed to read Excel file.");
                    console.error(err);
                }
            };

            reader.readAsArrayBuffer(file);
        },

        _processCostCenterExcel: function (rows) {
            const aValid = [];
            const aErrors = [];

            rows.forEach((row, index) => {
                const rowNo = index + 2; // Excel row number (header = 1)
                const errors = [];

                // Mandatory fields
                if (!row["Cost Center"]) errors.push("Cost Center is mandatory");
                if (!row["Controlling Area"]) errors.push("Controlling Area is mandatory");
                if (!row["Valid From"]) errors.push("Valid From is mandatory");
                if (!row["Valid To"]) errors.push("Valid To is mandatory");
                if (!row["Name"]) errors.push("Name is mandatory");
                if (!row["Currency"]) errors.push("Currency is mandatory");

                // Date validation
                if (!this._isValidExcelDate(row["Valid From"])) {
                    errors.push("Invalid Valid From date");
                }
                if (!this._isValidExcelDate(row["Valid To"])) {
                    errors.push("Invalid Valid To date");
                }

                if (errors.length) {
                    aErrors.push({
                        row: rowNo,
                        messages: errors
                    });
                    return;
                }

                // Map row → DraftModel structure
                aValid.push(this._mapCostCenterRow(row));
            });

            if (aErrors.length) {
                this._showExcelErrors(aErrors);
                return;
            }

            this._setCostCenterExcelData(aValid);
        },

        _showExcelErrors: function (aErrors) {

            let sMessage = aErrors.map(err =>
                `Row ${err.row}:\n• ${err.messages.join("\n• ")}`
            ).join("\n\n");

            sap.m.MessageBox.error(
                "Excel validation failed:\n\n" + sMessage
            );
        },

        _mapCostCenterRow: function (row) {
            return {
                controllingArea: row["Controlling Area"],
                costCenter: row["Cost Center"],
                validFrom: this._formatExcelDate(row["Valid From"]),
                validTo: this._formatExcelDate(row["Valid To"]),
                name: row["Name"],
                description: row["Description"],
                userResponsible: row["User Responsible"],
                personResponsible: row["Person Responsible"],
                department: row["Department"],
                costCenterCategory: row["Cost Center Category"],
                hierarchyArea: row["Hierarchy Area"],
                companyCode: row["Company Code"],
                businessArea: row["Business Area"],
                currency: row["Currency"],
                profitCenter: row["Profit Center"],

                // ✅ FIXED
                recordQuantity: this._toBoolean(row["Record Quantity"]),
                actualPrimaryCosts: this._toBoolean(row["Actual Primary Costs"]),
                actualSecondaryCosts: this._toBoolean(row["Actual Secondary Costs"]),
                planPrimaryCosts: this._toBoolean(row["Plan Primary Costs"]),
                planSecondaryCosts: this._toBoolean(row["Plan Secondary Costs"]),
                actualRevenue: this._toBoolean(row["Actual Revenue"]),
                planRevenue: this._toBoolean(row["Plan Revenue"]),
                commitmentUpdate: this._toBoolean(row["Commitment Update"])
            };
        },
        _isValidExcelDate: function (value) {
            if (!value) return false;

            // Excel date number
            if (typeof value === "number") {
                return true;
            }

            // Already ISO string (yyyy-MM-dd)
            if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                return true;
            }

            return false;
        },

        _formatExcelDate: function (value) {

            // Excel serial number → JS Date
            if (typeof value === "number") {
                const date = XLSX.SSF.parse_date_code(value);
                const yyyy = date.y;
                const mm = String(date.m).padStart(2, "0");
                const dd = String(date.d).padStart(2, "0");
                return `${yyyy}-${mm}-${dd}`; // UI5 DatePicker valueFormat
            }

            // Already ISO
            if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                return value;
            }

            return null;
        },


        _setCostCenterExcelData: function (aData) {
            const oDraftModel = this.getView().getModel("DraftModel");
            const existing = oDraftModel.getProperty("/costCenterData") || [];

            oDraftModel.setProperty("/costCenterData", existing.concat(aData));

            MessageToast.show("Excel uploaded successfully (" + aData.length + " records)");
        },
        _toBoolean: function (v) {
            if (typeof v === "boolean") return v;
            if (typeof v === "number") return v === 1;
            if (typeof v === "string") {
                return ["true", "x", "yes", "1"].includes(v.toLowerCase());
            }
            return false;
        }


    });
});