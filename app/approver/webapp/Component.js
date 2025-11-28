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
                view.setModel(
                    new JSONModel(
                        (data.comments || []).map(c => ({
                            Text: c.commentText,
                            UserName: c.user,
                            Date: c.createdAt ? new Date(c.createdAt).toLocaleString() : "",
                            IsNew: false
                        }))
                    ),
                    "commentModel"
                );

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

        _onApprove: async function () {
            const view = this._getMainView();
            const comments = view.getModel("commentModel")?.getData() ?? [];

            if (!this._hasNewComment(comments)) {
                MessageBox.information("Please add a comment before approving.");
                return;
            }

            await this._updateStatus("Approved", "Completed");
            await this._saveNewComments(comments);

            MessageBox.success("Request approved.");
            this._refreshInbox();
        },

        _onReject: async function () {
            const view = this._getMainView();
            const comments = view.getModel("commentModel")?.getData() ?? [];

            if (!this._hasNewComment(comments)) {
                MessageBox.information("Please add a comment before rejecting.");
                return;
            }

            await this._updateStatus("Rejected", "Rejected");
            await this._saveNewComments(comments);

            MessageBox.error("Request rejected.");
            this._refreshInbox();
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
        }
    });
});
