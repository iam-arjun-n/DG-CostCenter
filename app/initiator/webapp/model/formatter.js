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
                default: return sStatus;
            }
        },
        
        extDate: function (date) {
            if (date) {
                const day = date.toLocaleString("default", { day: "2-digit" });
                const month = date.toLocaleString("default", { month: "short" });
                const year = date.toLocaleString("default", { year: "numeric" });
                return `${day}-${month}-${year}`;
            }
        }
    };
});