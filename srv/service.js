const cds = require("@sap/cds");
const SequenceHelper = require("./lib/SequenceHelper");

class CostCenterService extends cds.ApplicationService {

  async init() {

    const db = await cds.connect.to("db");
    const { CostCenterRequests } = this.entities;
    

    this.before("CREATE", CostCenterRequests, async (req) => {
      try {

        const hanaTable = "COM_DELOITTE_MDG_COST_CENTER_COSTCENTERREQUESTS";

        const seq = new SequenceHelper({
          db,
          table: hanaTable
        });

        const next = await seq.getNextNumber();     // 1, 2, 3...
        const padded = next.toString().padStart(7, "0");  // 0000001

        req.data.requestId = "CCTR" + padded;
        req.data.requestStatus = "Draft";
        req.data.workflowStatus = "NotStarted";

      } catch (err) {
        console.error("Error generating requestId:", err);
        req.reject(500, "Failed to generate request ID");
      }
    });

    

    return super.init();
  }
}

module.exports = { CostCenterService };