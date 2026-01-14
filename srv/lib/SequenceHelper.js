module.exports = class SequenceHelper {
  constructor(options) {
    this.db = options.db;
    this.table = options.table;
  }

  async getNextNumber() {
    try {
      const sql = `
      SELECT MAX("REQUESTID") AS MAX_ID
      FROM "${this.table}"
    `;
      const result = await this.db.run(sql);

      const maxId = result[0]?.MAX_ID;

      if (!maxId) return 1;

      const numeric = parseInt(maxId.replace("CCTR", ""), 10);
      return numeric + 1;

    } catch (err) {
      console.error("SequenceHelper error:", err);
      throw err;
    }
  }
};