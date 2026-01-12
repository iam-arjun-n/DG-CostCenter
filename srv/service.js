const cds = require("@sap/cds");
const SequenceHelper = require("./lib/SequenceHelper");

class CostCenterService extends cds.ApplicationService {

  async init() {

    const db = await cds.connect.to("db");
    const { CostCenterRequests } = this.entities;


    this.before("CREATE", CostCenterRequests, async (req) => {
      try {

        const hanaTable = "COM_DELOITTE_MDG_COSTCENTER_COSTCENTERREQUESTS";

        const seq = new SequenceHelper({
          db,
          table: hanaTable
        });

        const next = await seq.getNextNumber();
        const padded = next.toString().padStart(7, "0");

        req.data.requestId = "CCTR" + padded;

        if (req.data.workflowStatus === "Draft") {
          req.data.requestStatus = "Draft";
          return;
        }
        req.data.requestStatus = "Submitted";
        req.data.workflowStatus = "In Approval";

      } catch (err) {
        console.error("Error generating requestId:", err);
        req.reject(500, "Failed to generate request ID");
      }
    });

    this.before("DELETE", CostCenterRequests, async (req) => {

      const { workflowStatus } = await SELECT.one
        .from(CostCenterRequests)
        .where({ requestId: req.data.requestId });

      if (workflowStatus !== "Draft") {
        req.reject(400, "Only Draft requests can be deleted");
      }

    });

    return super.init();
  }
}

module.exports = { CostCenterService };