sap.ui.define([
        "sap/ui/core/UIComponent",
        "sap/ui/model/json/JSONModel",
        "sap/m/MessageBox"
], function (UIComponent, JSONModel, MessageBox) {
        "use strict";

        return UIComponent.extend("com.deloitte.mdg.costcenter.approver.approver.Component", {

                metadata: {
                        manifest: "json"
                },

                init: function () {
                        UIComponent.prototype.init.apply(this, arguments);

                        this.getRouter().initialize();
                        this.setModel(new JSONModel(), "device");

                        this._setupInboxActions();
                        this._loadWorkflowContext();
                        this.setModel(new JSONModel([]), "initiatorModel");
                        this.setModel(new JSONModel([]), "approverModel");
                        this.setModel(new JSONModel([]), "commentModel");
                },

                createContent: function () {
                        return this._getMainView();
                },

                _getMainView: function () {
                        if (!this._mainView) {
                                this._mainView = sap.ui.view({
                                        id: "taskView",
                                        viewName: "com.deloitte.mdg.costcenter.approver.approver.view.Overview",
                                        type: "XML"
                                });
                        }
                        return this._mainView;
                },

                _loadWorkflowContext: function () {

                        const taskModel = this.getComponentData().startupParameters.taskModel;
                        this.setModel(taskModel, "task");

                        const contextUrl = this._getTaskInstancesBaseURL() + "/context";
                        const contextModel = new JSONModel(contextUrl);

                        contextModel.attachRequestCompleted(async () => {

                                const data = contextModel.getData();

                                if (typeof data === "string") {
                                        console.error("Workflow context fetch error:", data);
                                        return;
                                }

                                console.log("Workflow Context Loaded:", data);
                                this.setModel(contextModel, "context");

                                const reqId = data.requestId || data.ReqId;
                                this._reqId = reqId;

                                if (reqId) {
                                        console.log("Loading CAP data for Req:", reqId);
                                        await this._loadCAPDataFromServiceModel(reqId);
                                }
                        });
                },

                _loadCAPDataFromServiceModel: async function (reqId) {
                        try {
                                const oModel = this.getModel("ServiceModel");

                                // OData V4 must use bindContext to read a single entity
                                const oContext = oModel.bindContext(
                                        `/CostCenterRequests(requestId='${reqId}')`,
                                        null,
                                        {
                                                // Expand navigation properties
                                                $expand: "costCenterData,comments"
                                        }
                                );

                                console.log("Requesting CAP data via V4 bindContext…");

                                const data = await oContext.requestObject();
                                console.log("CAP Data Loaded:", data);

                                const view = this._getMainView();

                                // Main view model
                                view.setModel(
                                        new JSONModel({
                                                requestId: data.requestId,
                                                RequestType: data.requestType,
                                                costCenterData: data.costCenterData
                                        })
                                );

                                // Comments model
                                const initComments = (data.comments || [])
                                        .filter(c => c.role !== "Approver")
                                        .map(c => ({
                                                Text: c.commentText,
                                                UserName: c.createdBy,
                                                Date: c.createdAt ? new Date(c.createdAt).toLocaleString() : "",
                                                IsNew: false
                                        }));

                                this.getModel("initiatorModel").setData(initComments);

                                // after loading both models, merge
                                this._mergeComments();

                        } catch (e) {
                                console.error("Unexpected CAP load error:", e);
                        }
                },

                _getWorkflowBaseURL: function () {
                        const appId = this.getManifestEntry("/sap.app/id");
                        const appPath = appId.replaceAll(".", "/");
                        const modulePath = jQuery.sap.getModulePath(appPath);
                        return modulePath + "/bpmworkflowruntime/v1";
                },

                _getTaskInstancesBaseURL: function () {
                        return this._getWorkflowBaseURL() +
                                "/task-instances/" +
                                this.getModel("task").getData().InstanceID;
                },

                _setupInboxActions: function () {
                        const startup = this.getComponentData().startupParameters;
                        if (!startup?.inboxAPI) return;

                        const inboxAPI = startup.inboxAPI;

                        inboxAPI.addAction({
                                action: "APPROVE",
                                label: "Approve",
                                type: "accept"
                        }, () => this._onApprove());

                        inboxAPI.addAction({
                                action: "REJECT",
                                label: "Reject",
                                type: "reject"
                        }, () => this._onReject());
                },


                _hasNewComment: function (comments) {
                        return comments.some(c => c.IsNew);
                },

                _updateStatus: async function (reqStatus, wfStatus) {

                        const base = this.getManifestEntry("/sap.app/dataSources/DatabaseService/uri");

                        const payload = {
                                requestStatus: reqStatus,
                                workflowStatus: wfStatus
                        };

                        await fetch(`${base}CostCenterRequests(requestId='${this._reqId}')`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(payload),
                                credentials: "include"
                        });
                },

                _saveNewComments: async function (comments) {

                        const base = this.getManifestEntry("/sap.app/dataSources/DatabaseService/uri");

                        const newComments = comments.filter(c => c.IsNew);

                        for (let c of newComments) {
                                const payload = {
                                        commentText: c.Text,
                                        role: "Approver",
                                        user: "approver@system.com",
                                        request_requestId: this._reqId
                                };

                                await fetch(`${base}Comments`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify(payload),
                                        credentials: "include"
                                });
                        }
                },

                _refreshInbox: function () {
                        const startup = this.getComponentData().startupParameters;
                        startup?.inboxAPI?.updateTask(
                                "NA",
                                startup.taskModel.getData().InstanceID
                        );
                },
                async _fetchCAPCsrf() {
                        const base = this._getDatabaseBaseURL();
                        const res = await fetch(base, {
                                method: "GET",
                                headers: { "X-CSRF-Token": "Fetch" },
                                credentials: "include"
                        });

                        return res.headers.get("X-CSRF-Token");
                },
                _buildCreateCostCenterBatch: function (lineData) {

                        const boundary = "batch_" + Date.now();

                        const payload =
                                `--${boundary}
Content-Type: application/http
Content-Transfer-Encoding: binary

POST CostCenterSet HTTP/1.1
Content-Type: application/json

${JSON.stringify({
                                        ControllingArea: lineData.controllingArea,
                                        CostCenter: lineData.costCenter,
                                        CostCenterName: lineData.name,
                                        CostCenterType: "1",
                                        ValidFromDate: lineData.validFrom,
                                        ResponsibleUser: lineData.userResponsible,
                                        CompanyCode: lineData.companyCode,
                                        ProfitCenter: lineData.profitCenter
                                })}
--${boundary}--`;

                        return { boundary, payload };
                },

                addApproverCommentToModels: function (text, userName) {

                        const apprModel = this.getModel("approverModel");
                        const arr = apprModel.getData() || [];

                        const now = new Date().toLocaleString();

                        arr.push({
                                Text: text,
                                UserName: userName || "Approver",
                                Date: now,
                                IsNew: true
                        });

                        apprModel.setData(arr);
                        this._mergeComments();
                },
                _mergeComments: function () {

                        const init = this.getModel("initiatorModel").getData() || [];
                        const appr = this.getModel("approverModel").getData() || [];

                        // merge + newest at the top
                        const merged = [...appr, ...init];

                        // sort by date-desc if needed
                        merged.sort((a, b) => new Date(b.Date) - new Date(a.Date));

                        this.getModel("commentModel").setData(merged);
                },



                //Approve or Reject Logic
                _createCostCentersInS4: function (costCenters) {

                        const oModel = this.getModel("CreateCostCenterModel");

                        function format(dateStr) {
                                const d = new Date(dateStr);
                                return d.toISOString().slice(0, 10).replace(/-/g, "");
                        }

                        return new Promise((resolve, reject) => {

                                let completed = 0;
                                const total = costCenters.length;
                                let failed = false;

                                const createdCostCenters = [];

                                costCenters.forEach(cc => {

                                        if (failed) return;

                                        const payload = {

                                                COAREA: cc.controllingArea || "",
                                                COSTCENTER: cc.costCenter || "",

                                                VALIDFROM: format(cc.validFrom),
                                                VALIDTO: "99991231",

                                                NAME: cc.name || "",
                                                DESCRIPTION: cc.description || "",
                                                CURRENCY: cc.currency || "",

                                                COSTCTR_HIER: cc.hierarchyArea || "",
                                                PERSON_INCHARGE: cc.personResponsible || "",
                                                COSTCENTERTYPE: cc.costCenterCategory || "",

                                                COMPCODE: cc.companyCode || "",
                                                PROFITCTR: cc.profitCenter || "",

                                                USER_RESPONSIBLE: cc.userResponsible || "",
                                                DEPARTMENT: cc.department || "",
                                                BUSINESS_AREA: cc.businessArea || "",

                                                LOCKACT_PRIMCOST: cc.actualPrimaryCosts ? "X" : "",
                                                LOCKPLAN_PRIMCOST: cc.planPrimaryCosts ? "X" : "",
                                                LOCKACT_SECCOST: cc.actualSecondaryCosts ? "X" : "",
                                                LOCKPLAN_SECCOST: cc.planSecondaryCosts ? "X" : "",

                                                LOCKACT_REVENUES: cc.actualRevenue ? "X" : "",
                                                LOCKPLAN_REVENUES: cc.planRevenue ? "X" : "",

                                                REC_QUANTITY: cc.recordQuantity ? "X" : "",
                                                COMMIT_UPDATE: cc.commitmentUpdate ? "X" : ""
                                        };

                                        console.log("Create Payload:", payload);

                                        oModel.create("/ETY_COSTCREATESet", payload, {

                                                success: (oData) => {

                                                        if (oData?.COSTCENTER) {
                                                                createdCostCenters.push(oData.COSTCENTER);
                                                        }

                                                        completed++;

                                                        if (completed === total) {

                                                                resolve({
                                                                        success: true,
                                                                        createdCostCenters
                                                                });

                                                        }
                                                },

                                                error: (oError) => {

                                                        if (failed) return;
                                                        failed = true;

                                                        let message = "Unknown backend error";

                                                        try {

                                                                const response = JSON.parse(oError.responseText);

                                                                message =
                                                                        response?.error?.message?.value ||
                                                                        response?.error?.innererror?.errordetails?.[0]?.message ||
                                                                        message;

                                                        } catch (e) {

                                                                if (oError.message) {
                                                                        message = oError.message;
                                                                }

                                                        }

                                                        reject({
                                                                success: false,
                                                                error: message
                                                        });

                                                }

                                        });

                                });

                        });

                },

                _fetchS4Csrf: async function (baseUrl) {

                        const res = await fetch(baseUrl, {
                                method: "GET",
                                headers: {
                                        "X-CSRF-Token": "Fetch"
                                },
                                credentials: "include"
                        });

                        return res.headers.get("X-CSRF-Token");
                },

                _updateCostCentersInS4: function (costCenters) {

                        const oModel = this.getModel("UpdateCostCenterModel");

                        function format(dateStr) {
                                const d = new Date(dateStr);
                                return d.toISOString().slice(0, 10).replace(/-/g, "");
                        }

                        return new Promise((resolve, reject) => {

                                let completed = 0;
                                const total = costCenters.length;
                                let failed = false;

                                const updatedCostCenters = [];

                                costCenters.forEach(cc => {

                                        if (failed) return;

                                        const payload = {

                                                COAREA: cc.controllingArea || "",
                                                COSTCENTER: cc.costCenter || "",

                                                VALIDFROM: format(cc.validFrom),
                                                VALIDTO: "99991231",

                                                NAME: cc.name || "",
                                                DESCRIPTION: cc.description || "",
                                                CURRENCY: cc.currency || "",

                                                COSTCTR_HIER: cc.hierarchyArea || "",
                                                PERSON_INCHARGE: cc.personResponsible || "",
                                                COSTCENTERTYPE: cc.costCenterCategory || "",

                                                COMPCODE: cc.companyCode || "",
                                                PROFITCTR: cc.profitCenter || "",

                                                USER_RESPONSIBLE: cc.userResponsible || "",
                                                DEPARTMENT: cc.department || "",

                                                // ❗ BUSINESS_AREA removed (causes KS/070)

                                                LOCKACT_PRIMCOST: cc.actualPrimaryCosts ? "X" : "",
                                                LOCKPLAN_PRIMCOST: cc.planPrimaryCosts ? "X" : "",
                                                LOCKACT_SECCOST: cc.actualSecondaryCosts ? "X" : "",
                                                LOCKPLAN_SECCOST: cc.planSecondaryCosts ? "X" : "",

                                                LOCKACT_REVENUES: cc.actualRevenue ? "X" : "",
                                                LOCKPLAN_REVENUES: cc.planRevenue ? "X" : "",

                                                REC_QUANTITY: cc.recordQuantity ? "X" : "",
                                                COMMIT_UPDATE: cc.commitmentUpdate ? "X" : ""
                                        };

                                        console.log("Update Payload:", payload);

                                        oModel.create("/ETY_COSTCHANGESet", payload, {

                                                method: "POST",

                                                success: function () {

                                                        updatedCostCenters.push(cc.costCenter);

                                                        completed++;

                                                        if (completed === total) {

                                                                resolve({
                                                                        success: true,
                                                                        updatedCostCenters
                                                                });

                                                        }

                                                },

                                                error: function (oError) {

                                                        if (failed) return;
                                                        failed = true;

                                                        let message = "Unknown backend error";

                                                        try {

                                                                const response = JSON.parse(oError.responseText);

                                                                message =
                                                                        response?.error?.message?.value ||
                                                                        response?.error?.innererror?.errordetails?.[0]?.message ||
                                                                        message;

                                                        } catch (e) {

                                                                if (oError.message) {
                                                                        message = oError.message;
                                                                }

                                                        }

                                                        reject({
                                                                success: false,
                                                                error: message
                                                        });

                                                }

                                        });

                                });

                        });

                },
                _sendDataToSAP: async function () {

                        const view = this._getMainView();
                        const mainModel = view.getModel();  // the one you set inside loadCAP
                        const reqType = mainModel.getProperty("/RequestType");
                        const costCenters = mainModel.getProperty("/costCenterData");


                        let success = false;
                        let error = "";

                        try {
                                if (reqType === "Create") {
                                        return await this._createCostCentersInS4(costCenters);
                                } else if (reqType === "Change" || reqType === "Extend") {
                                        return await this._updateCostCentersInS4(costCenters);
                                }
                        } catch (e) {
                                success = false;
                                error = e.error || e.message || "Unknown SAP error";
                        }

                        return { success, error };
                },

                _getDatabaseBaseURL: function () {
                        const oModel = this.getModel("ServiceModel");
                        const sUrl = oModel && (oModel.sServiceUrl || oModel.oServiceUrl || oModel.getServiceUrl && oModel.getServiceUrl());

                        if (!sUrl) {
                                throw new Error("ServiceModel service URL not found");
                        }

                        return sUrl.endsWith("/") ? sUrl : sUrl + "/";
                },

                _updateRequestStatus: async function (reqStatus, wfStatus) {

                        const base = this._getDatabaseBaseURL();
                        const requestId = this._reqId;
                        const token = await this._fetchCAPCsrf();

                        const payload = {
                                requestStatus: reqStatus,
                                workflowStatus: wfStatus
                        };

                        await fetch(`${base}CostCenterRequests(requestId='${requestId}')`, {
                                method: "PATCH",
                                headers: {
                                        "Content-Type": "application/json",
                                        "X-CSRF-Token": token
                                },
                                body: JSON.stringify(payload),
                                credentials: "include"
                        });
                },

                _updateRequestAfterSAP: async function (result) {
                        const reqStatus = result.success ? "Approved" : "Error";
                        const wfStatus = "Completed";
                        await this._updateRequestStatus(reqStatus, wfStatus);
                },

                _addApproveComment: async function () {

                        const view = this._getMainView();
                        const comments = view.getModel("commentModel")?.getData() || [];
                        const newComments = comments.filter(c => c.IsNew);

                        if (!newComments.length) {
                                return;
                        }

                        const base = this._getDatabaseBaseURL();
                        const token = await this._fetchCAPCsrf();
                        const requestId = this._reqId;

                        for (let c of newComments) {
                                const payload = {
                                        commentText: c.Text,
                                        role: "Approver",
                                        user: "approver@system.com",
                                        request_requestId: requestId
                                };

                                await fetch(`${base}CostCenterComments`, {
                                        method: "POST",
                                        headers: {
                                                "Content-Type": "application/json",
                                                "X-CSRF-Token": token
                                        },
                                        body: JSON.stringify(payload),
                                        credentials: "include"
                                });
                        }
                },

                _completeWorkflowTask: async function () {
                        const base = this._getWorkflowBaseURL();
                        const taskId = this.getModel("task").getData().InstanceID;

                        const res = await fetch(`${base}/task-instances/${taskId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({
                                        status: "COMPLETED"
                                })
                        });

                        if (!res.ok) {
                                throw new Error("Workflow task completion failed");
                        }
                },

                _showProcessing: function () {

                        if (!this._processingDialog) {
                                this._processingDialog = new sap.m.BusyDialog({
                                        text: "Processing request..."
                                });
                        }

                        this._processingDialog.open();
                },

                _hideProcessing: function () {
                        if (this._processingDialog) {
                                this._processingDialog.close();
                        }
                },

                _showResultDialog: function (type, message) {

                        const state =
                                type === "success" ? "Success" :
                                        type === "error" ? "Error" :
                                                "Warning";

                        const dialog = new sap.m.Dialog({
                                title: type === "success" ? "Success" : "Error",
                                type: "Message",
                                state: state,
                                content: [
                                        new sap.m.VBox({
                                                width: "100%",
                                                alignItems: "Center",
                                                justifyContent: "Center",
                                                items: [
                                                        new sap.m.Text({
                                                                text: message,
                                                                textAlign: "Center",
                                                                wrapping: true
                                                        })
                                                ]
                                        })
                                ],
                                beginButton: new sap.m.Button({
                                        text: "Close",
                                        press: () => {
                                                dialog.close();
                                                dialog.destroy();
                                                this._refreshInbox();
                                        }
                                })
                        });

                        dialog.open();
                },

                _onApprove: async function () {
                        const view = this._getMainView();
                        const comments = view.getModel("commentModel")?.getData() ?? [];

                        if (!this._hasNewComment(comments)) {
                                MessageBox.information("Please add a comment before approving.");
                                return;
                        }
                        this._showProcessing();

                        try {
                                const result = await this._sendDataToSAP();
                                this._hideProcessing();
                                if (!result.success) {

                                        this._showResultDialog(
                                                "error",
                                                `SAP Posting Failed:\n${result.error}`
                                        );

                                        return;
                                }

                                await this._updateRequestAfterSAP(result);
                                await this._addApproveComment();
                                await this._completeWorkflowTask();

                                const mainModel = view.getModel();
                                const reqType = mainModel.getProperty("/RequestType");

                                let list = "";
                                let message = "";

                                if (reqType === "Create") {

                                        list = result.createdCostCenters?.join(", ") || "";

                                        message = `${list} Cost Center(s) Created Successfully`;

                                } else if (reqType === "Change" || reqType === "Extend") {

                                        list = result.updatedCostCenters?.join(", ") || "";

                                        message = `${list} Cost Center(s) Updated Successfully`;

                                }

                                this._showResultDialog("success", message);

                        } catch (e) {

                                this._hideProcessing();

                                this._showResultDialog(
                                        "error",
                                        e.message || "Approve failed"
                                );
                        }
                },

                _onReject: async function () {

                        const view = this._getMainView();
                        const comments = view.getModel("commentModel")?.getData() ?? [];

                        if (!this._hasNewComment(comments)) {
                                MessageBox.information("Please add a comment before rejecting.");
                                return;
                        }

                        this._showProcessing();

                        try {

                                await this._updateRequestStatus("Rejected", "Rejected");
                                await this._addApproveComment();
                                await this._completeWorkflowTask();

                                this._hideProcessing();

                                this._showResultDialog(
                                        "success",
                                        `${this._reqId} Rejected`
                                );

                        } catch (e) {

                                this._hideProcessing();

                                this._showResultDialog(
                                        "error",
                                        e.message || "Reject failed"
                                );
                        }
                },

        });
});
