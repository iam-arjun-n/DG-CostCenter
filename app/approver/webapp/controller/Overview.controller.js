sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, MessageBox, JSONModel) {
  "use strict";

  return Controller.extend("com.deloitte.mdg.costcenter.approver.approver.controller.Approval", {
    onInit: function () {
      // placeholder models
      this.getView().setModel(new JSONModel({ costCenterData: [], comments: [], request: {} }), "local");
      // also set default on root model for bindings convenience (/costCenterData and /comments)
      this.getView().setModel(new JSONModel({ costCenterData: [], comments: [], request: {} }));

      // read startup params (inbox) and wire up loading
      var startup = this.getOwnerComponent().getComponentData() && this.getOwnerComponent().getComponentData().startupParameters;
      if (startup && startup.taskModel) {
        // set task model (this is required by inbox runtime)
        this.getOwnerComponent().setModel(startup.taskModel, "task");

        // get instance id and load context
        this._taskModel = startup.taskModel;
        this._taskModel.attachRequestCompleted(this._onTaskModelReady.bind(this));
      } else {
        // If opened standalone: allow query param ?reqId=...
        var params = new URLSearchParams(window.location.search);
        var reqId = params.get("reqId");
        if (reqId) {
          this._loadRequest(reqId);
        }
      }
    },

    _onTaskModelReady: function () {
      // task model contains InstanceID + context. We'll call workflow runtime to get full context
      var taskData = this.getOwnerComponent().getModel("task").getData();
      if (!taskData || !taskData.InstanceID) {
        console.warn("No task InstanceID found in task model");
        return;
      }
      this._taskInstanceID = taskData.InstanceID;
      this._getTaskContext().then(ctx => {
        var reqId = ctx.ReqId || ctx.ReqID || ctx.requestId;
        if (reqId) {
          this._loadRequest(reqId);
        } else {
          console.warn("No ReqId in task context", ctx);
        }
      }).catch(err => {
        console.error("Failed to fetch task context", err);
      });
    },

    // ----------- DATA LOADS -----------
    _getServiceBaseURL: function () {
      // manifest has data source "/odata/v4/cost-center/"
      var uri = this.getOwnerComponent().getManifestEntry("/sap.app/dataSources/DatabaseService/uri");
      // if uri is absolute it may already contain origin; otherwise prefix
      if (/^https?:\/\//.test(uri)) return uri.replace(/\/$/, "");
      return window.location.origin + uri.replace(/\/$/, "");
    },

    _getWorkflowRuntimeBaseURL: function () {
      // app id -> module path -> append bpmworkflowruntime/v1
      var appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");
      var appPath = appId.replaceAll(".", "/");
      var modulePath = jQuery.sap.getModulePath(appPath);
      return modulePath + "/bpmworkflowruntime/v1";
    },

    _getTaskContext: async function () {
      var base = this._getWorkflowRuntimeBaseURL();
      var url = base + "/task-instances/" + encodeURIComponent(this._taskInstanceID) + "/context";
      let res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },

    _loadRequest: async function (reqId) {
      try {
        this._currentReqId = reqId;
        var base = this._getServiceBaseURL();
        var url = base + "/CostCenterRequests(requestId='" + encodeURIComponent(reqId) + "')?$expand=comments,costCenterData";
        let res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) {
          let text = await res.text();
          throw new Error("Failed to fetch request: " + text);
        }
        let data = await res.json();

        // map to UI models: costCenterData (array), comments (array)
        var costCenterData = data.costCenterData || [];
        var comments = (data.comments || []).map(c => ({
          ID: c.ID,
          commentText: c.commentText,
          createdAt: c.createdAt || c.createdAt,
          user: c.user,
          role: c.role
        }));

        // set into view model root so bindings to /costCenterData and /comments work
        var oRoot = this.getView().getModel();
        oRoot.setProperty("/costCenterData", costCenterData);
        oRoot.setProperty("/comments", comments);
        oRoot.setProperty("/request", {
          requestId: data.requestId,
          requestType: data.requestType,
          workflowStatus: data.workflowStatus,
          requestStatus: data.requestStatus,
          createdByName: data.createdByName
        });

        // also keep on controller
        this._request = data;
        // enable view button only if records exist
        this.getView().byId("Approval_Button_View").setEnabled(costCenterData.length > 0);

      } catch (err) {
        MessageBox.error("Error loading request: " + err.message);
      }
    },

    // --------- UI actions ----------
    onSelectionChange: function (oEvt) {
      var sel = oEvt.getSource().getSelectedItem();
      this.getView().byId("Approval_Button_View").setEnabled(!!sel);
    },

    onViewLine: function () {
      var table = this.byId("Approval_CostCenterTable");
      var sel = table.getSelectedItem();
      if (!sel) {
        MessageToast.show("Select a row to view.");
        return;
      }
      var ctx = sel.getBindingContext();
      var obj = ctx.getObject();

      // open fragment in edit mode (you asked: "All data should only in the edit mode in the fragment")
      this._openDetailFragment(obj);
    },

    _openDetailFragment: function (lineData) {
      var that = this;
      if (!this._detailDialog) {
        // create simple fragment inline (you can move to separate file if desired)
        sap.ui.core.Fragment.load({
          name: "com.deloitte.mdg.costcenter.approver.approver.fragment.CostCenterForm",
          controller: this
        }).then(function (dlg) {
          that._detailDialog = dlg;
          that.getView().addDependent(dlg);
          dlg.setModel(new JSONModel(lineData), "line");
          dlg.open();
        });
      } else {
        this._detailDialog.setModel(new JSONModel(lineData), "line");
        this._detailDialog.open();
      }
    },

    onPostComment: function (oEvent) {
      var sValue = oEvent.getParameter("value");
      if (!sValue || !sValue.trim()) {
        MessageToast.show("Comment cannot be empty.");
        return;
      }
      // get current user (best-effort)
      var user = (sap.ushell && sap.ushell.Container && sap.ushell.Container.getUser) ? sap.ushell.Container.getUser().getEmail() : "approver@dummy";

      var comment = {
        ID: null,
        commentText: sValue,
        createdAt: new Date().toISOString(),
        user: user,
        role: "Approver"
      };

      // push to UI list
      var root = this.getView().getModel();
      var a = root.getProperty("/comments") || [];
      a.unshift(comment);
      root.setProperty("/comments", a);

      // also clear input
      oEvent.getSource().setValue("");
    },

    // --------- Approve / Reject handlers ----------
    onApprove: async function () {
      await this._handleDecision(true);
    },

    onReject: async function () {
      await this._handleDecision(false);
    },

    _handleDecision: async function (isApprove) {
      try {
        // require at least one comment from approver
        var root = this.getView().getModel();
        var comments = root.getProperty("/comments") || [];
        var approverComments = comments.filter(c => c.role === "Approver" || (c.user && c.user.indexOf("@") > -1)); // best-effort
        if (approverComments.length === 0) {
          MessageBox.information("Please add at least one comment before " + (isApprove ? "approving." : "rejecting."));
          return;
        }

        var reqId = (this._request && this._request.requestId) || this._currentReqId || root.getProperty("/request/requestId");
        if (!reqId) {
          throw new Error("No requestId available");
        }

        var serviceBase = this._getServiceBaseURL();

        // 1) PATCH request entity to update statuses
        var patchBody = {
          workflowStatus: isApprove ? "Completed" : "Rejected",
          requestStatus: isApprove ? "Approved" : "Rejected"
        };

        var patchUrl = serviceBase + "/CostCenterRequests(requestId='" + encodeURIComponent(reqId) + "')";
        // fetch CSRF token
        var token = await this._fetchCSRFToken(serviceBase);

        let patchRes = await fetch(patchUrl, {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token
          },
          body: JSON.stringify(patchBody)
        });

        if (!patchRes.ok) {
          let t = await patchRes.text();
          throw new Error("Failed to update request status: " + t);
        }

        // 2) Post the latest approver comment(s) to CostCenterComments
        // We'll post all comments that have role === 'Approver' and do not have an ID (new)
        var newApproverComments = (comments || []).filter(c => (c.role === "Approver") && !c.ID);
        for (let c of newApproverComments) {
          const commentPayload = {
            request_requestId: reqId,
            user: c.user || "approver@dummy",
            role: "Approver",
            commentText: c.commentText || c.Text || ""
          };

          let postRes = await fetch(serviceBase + "/CostCenterComments", {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": token
            },
            body: JSON.stringify(commentPayload)
          });

          if (!postRes.ok) {
            // log but continue
            console.warn("Failed to create comment:", await postRes.text());
          }
        }

        // 3) Patch workflow task instance to COMPLETED (so inbox marks it done)
        if (this._taskInstanceID) {
          const wfBase = this._getWorkflowRuntimeBaseURL();
          const ctx = await this._getTaskContext().catch(()=>({}));
          // include approver decision in context
          ctx.approved = isApprove;
          ctx.approver = (newApproverComments[0] && newApproverComments[0].user) || "approver@dummy";
          ctx.comment = (newApproverComments[0] && newApproverComments[0].commentText) || "";

          // fetch token for workflow runtime
          let wfToken = await this._fetchCSRFToken(wfBase);
          let patchTaskUrl = wfBase + "/task-instances/" + encodeURIComponent(this._taskInstanceID);
          let patchTaskRes = await fetch(patchTaskUrl, {
            method: "PATCH",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": wfToken
            },
            body: JSON.stringify({
              status: "COMPLETED",
              context: ctx
            })
          });

          if (!patchTaskRes.ok) {
            console.warn("Failed to complete task instance:", await patchTaskRes.text());
            // Not fatal from CAP perspective, but inform user
          }
        }

        MessageToast.show((isApprove ? "Approved" : "Rejected") + " successfully.");

        // refresh local display by reloading the request
        await this._loadRequest(reqId);

        // tell inbox to refresh
        var startup = this.getOwnerComponent().getComponentData() && this.getOwnerComponent().getComponentData().startupParameters;
        if (startup && startup.inboxAPI) {
          startup.inboxAPI.updateTask("NA", this._taskInstanceID);
        }

      } catch (err) {
        MessageBox.error("Action failed: " + err.message);
      }
    },

    // fetch CSRF token helper (for serviceBase or workflow base)
    _fetchCSRFToken: async function (baseUrl) {
      try {
        var tokenUrl = baseUrl.replace(/\/$/, "") + "/$metadata"; // some servers return token on xsrf-token endpoint; try dedicated endpoint if exists
        // prefer xsrf-token if available
        var xsrfUrl = baseUrl.replace(/\/$/, "") + "/xsrf-token";
        let res = await fetch(xsrfUrl, {
          method: "GET",
          credentials: "same-origin",
          headers: { "X-CSRF-Token": "Fetch" }
        });
        if (res.ok) {
          let token = res.headers.get("X-CSRF-Token");
          return token || "";
        }
        return "";
      } catch (e) {
        console.warn("Unable to fetch CSRF token", e);
        return "";
      }
    }

  });
});