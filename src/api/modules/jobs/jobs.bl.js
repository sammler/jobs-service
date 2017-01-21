const JobsModel = require('./jobs.model').Model;
const _ = require('lodash');
const Promise = require('bluebird');
const mongoose = require('mongoose');

class JobsBL {

  /**
   * Creates a new job.
   */
  static create(docs) {
    if (!_.isArray(docs)) {
      return JobsBL.createSingle(docs);
    }
    return Promise.map(docs, item => JobsBL.createSingle(item));
  }

  static createSingle(job) {

    if (!job._id) {
      job._id = new mongoose.mongo.ObjectID();
    }
    let docModel = new JobsModel();
    docModel = _.merge(docModel, job); // Todo: why are we doing that?

    const valErrors = docModel.validateSync();
    if (valErrors) {
      throw new Error(valErrors);
    }

    return docModel.save();
  }

  /**
   * Patch fields
   *
   * @description We can ignore in this case that .update is not recommended for mongoose-materialize.
   * @param jobId
   * @param patchedFields
   */
  static patch(jobId, patchedFields) {

    // Todo: Verify that we are not patching any mongoose-materialize important fields

    return JobsModel
      .update(
        {_id: jobId},
        patchedFields,
        {runValidators: true}
      );
  }

  /**
   * Returns the total amount of jobs (regardless their status).
   * @returns {Promise}
   */
  static count() {
    return JobsModel
      .count()
      .exec();
  }

  static getJobById(id) {
    return JobsModel
      .findById(id)
      .exec();
  }

  /**
   * Get all jobs.
   */
  static getJobs() {
    return JobsModel
      .find({})
      .exec();
  }

  static getJobsByStatus(statusFilter) {
    return JobsModel
      .find({status: statusFilter})
      .exec();
  }

  // Todo: Don't use update because of mongoose-materialized
  static remove(id) {
    // Todo: Add check there that no parents with children are deleted
    return JobsModel
      .remove(id)
      .exec();
  }

  static removeAll() {
    return JobsModel
      .remove({})
      .exec();
  }

}

module.exports = JobsBL;
