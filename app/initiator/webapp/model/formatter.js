sap.ui.define([], function () {
    "use strict";
    return {
        getColor: function (ReqStat) {
            switch (ReqStat) {
                case "A":
                    return "Information";
                case "Not Started":
                    return "Error";
                case "C":
                    return "Success";
                case "Rejected":
                    return "Error";
                case "Completed":
                    return "Success";
                default:
                    return "Information";
            }
        },

        checkStatus: function (oStatus) {
            switch (oStatus) {
                case "C":
                    return true;
                default:
                    return false;
            }
        },

        reqStatus: function (ReqStat) {
            switch (ReqStat) {
                case "In Approval":
                    return "In Approval";
                case "R":
                    return "Rejected";
                case "C":
                    return "Completed";
                case "Completed":
                    return "Completed";
                case "Initiator":
                    return "Initiator";
                case "HOD":
                    return "At HOD";
                case "MDM":
                    return "At MDM";
                case "Costing":
                    return "At Costing";
                case "Commercial":
                    return "At Commercial";
                case "CostingAndCommercial":
                    return "At Costing & Commercial";
                case "Rejected":
                    return "Rejected";
                default:
                    return "Not Defined";
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