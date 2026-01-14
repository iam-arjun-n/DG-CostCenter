sap.ui.define([], function () {
    "use strict";
    return {
        getColor: function (ReqStat) {
            switch (ReqStat) {
                case "Draft":
                    return "Warning";

                case "In Approval":
                case "A":
                    return "Information";

                case "Completed":
                case "C":
                    return "Success";

                case "Rejected":
                case "Not Started":
                    return "Error";

                default:
                    return "Information";
            }
        },
        getHighlight: function (status) {
            switch (status) {
                case "Draft":
                    return "Warning";

                case "InApproval":
                case "In Approval":
                    return "Information";

                case "Completed":
                    return "Success";

                case "Rejected":
                    return "Error";

                default:
                    return "None";
            }
        },

        reqWorkflowText: function (sStatus) {
            switch (sStatus) {
                case "Draft": return "Draft";
                case "InApproval": return "In Approval";
                case "Completed": return "Completed";
                case "Rejected": return "Rejected";
                case "NotStarted": return "Not Started";
                default: return sStatus;
            }
        },

        extDate: function (vDate) {
            if (!vDate) {
                return "";
            }
            const oDate = vDate instanceof Date ? vDate : new Date(vDate);
            if (isNaN(oDate.getTime())) {
                return "";
            }
            const dd = String(oDate.getDate()).padStart(2, "0");
            const mm = String(oDate.getMonth() + 1).padStart(2, "0");
            const yyyy = oDate.getFullYear();

            return `${dd}-${mm}-${yyyy}`;
        }
    };
});