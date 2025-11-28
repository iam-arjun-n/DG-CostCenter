module.exports = class SequenceHelper {
  constructor(options) {
    this.db = options.db;
    this.table = options.table;
  }

  async getNextNumber() {
    try {
      const sql = `SELECT COUNT(*) AS COUNT FROM "${this.table}"`;
      const result = await this.db.run(sql);

      const current = parseInt(result[0].COUNT || 0);
      return current + 1;

    } catch (err) {
      console.error("SequenceHelper error:", err);
      throw err;
    }
  }
};