sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "com/deloitte/mdg/costcenter/approver/approver/model/models"
], (UIComponent, JSONModel, models) => {
    "use strict";

    return UIComponent.extend("com.deloitte.mdg.costcenter.approver.approver.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(new JSONModel(), "device");

            this.getRouter().initialize();

            this._setupInboxActions();
        },

        _setupInboxActions: function () {
            const startup = this.getComponentData()?.startupParameters;
            if (!startup || !startup.inboxAPI) return;

            const inboxAPI = startup.inboxAPI;

            inboxAPI.addAction({
                action: "APPROVE",
                label: "Approve",
                type: "accept"
            }, function () {
                this._onApprove();
            }.bind(this));

            inboxAPI.addAction({
                action: "REJECT",
                label: "Reject",
                type: "reject"
            }, function () {
                this._onReject();
            }.bind(this));
        },

        _getApprovalView: function () {
            const root = this.getRouter().getTarget("TargetApproval")._oOptions?.view;
            return root;
        },

        _onApprove: async function () {
            let view = this._getApprovalView();
            if (!view) return;

            const comments = view.getModel("commentModel")?.getData() ?? [];
            const reqId = view.getModel()?.getData()?.data?.requestId;

            if (!this._hasComment(comments)) {
                MessageBox.information("Please add a comment before approving.");
                return;
            }

            await this._updateRequestStatus(reqId, "Approved", "Completed");
            await this._postApproverComments(reqId, comments);

            MessageBox.success("Request approved.");
            this._refreshInboxTask();
        },

        _onReject: async function () {
            let view = this._getApprovalView();
            if (!view) return;

            const comments = view.getModel("commentModel")?.getData() ?? [];
            const reqId = view.getModel()?.getData()?.data?.requestId;

            if (!this._hasComment(comments)) {
                MessageBox.information("Please add a comment before rejecting.");
                return;
            }

            await this._updateRequestStatus(reqId, "Rejected", "Rejected");
            await this._postApproverComments(reqId, comments);

            MessageBox.error("Request rejected.");
            this._refreshInboxTask();
        },

        _hasComment: function (comments) {
            return comments.some(c => c.IsNew);
        },

        _updateRequestStatus: async function (reqId, reqStatus, wfStatus) {
            const base = this.getManifestEntry("/sap.app/dataSources/DatabaseService/uri");

            let payload = {
                requestStatus: reqStatus,
                workflowStatus: wfStatus
            };

            await fetch(`${base}CostCenterRequests(requestId='${reqId}')`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
        },


        _postApproverComments: async function (reqId, comments) {
            const base = this.getManifestEntry("/sap.app/dataSources/DatabaseService/uri");

            let newCom = comments.filter(c => c.IsNew);

            for (let c of newCom) {
                const payload = {
                    commentText: c.Text,
                    role: "Approver",
                    user: "approver@system.com",
                    request_requestId: reqId
                };

                await fetch(`${base}Comments`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });
            }
        },

        _refreshInboxTask: function () {
            const startup = this.getComponentData()?.startupParameters;
            if (startup && startup.inboxAPI) {
                startup.inboxAPI.updateTask("NA", startup.taskModel.getData().InstanceID);
            }
        }
    });
});