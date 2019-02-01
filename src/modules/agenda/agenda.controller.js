const expressResult = require('express-result');
const _ = require('lodash'); // eslint-disable-line no-unused-vars

const AgendaWrapper = require('./index');

class AgendaController {

  /**
   * Get the jobs for the currently authenticated user.
   */
  static async getMine(req, res) {
    let agendaWrapper = await AgendaWrapper.instance();
    let user_id = req.user.user_id;
    let jobs = await agendaWrapper.agenda.jobs({'data.user_id': user_id});
    return expressResult.ok(res, jobs);
  }

  // Todo: validation:
  //  - job.name is required => processor maps to job.name
  //  - user_id is required
  //  - tenant_id is required
  //  - job_identifier is required
  //  - repeatInterval is required
  static async postJob(req, res) {
    let jobDataRaw = req.body;
    let agendaWrapper = await AgendaWrapper.instance();
    let mappedBody = AgendaController._mapJobInput(jobDataRaw);

    let validationErrors = AgendaController._validateJob(mappedBody);
    if (validationErrors.length > 0) {
      return expressResult.error(res, {
        message: '[agenda.controller:postJob] Invalid input, see `validationErrors',
        validationErrors
      });
    }

    let jobRequest = await agendaWrapper.agenda.create(mappedBody.processor, mappedBody);
    jobRequest.repeatEvery(mappedBody.repeatPattern);
    jobRequest.unique({
      // Note: mappedBody.processor is automatically added to be a unique criteria
      'data.user_id': mappedBody.user_id,
      'data.tenant_id': mappedBody.tenant_id,
      'data.job_identifier': mappedBody.job_identifier
    });
    try {
      let newJob = await jobRequest.save();
      return expressResult.created(res, AgendaController._mapJobOutput(newJob));
    } catch (err) {
      return expressResult.error(res, err);
    }
  }

  /**
   * Delete all jobs by the given `job_id`.
   * @param req
   * @param res
   *
   * @todo Needs authorization ...
   */
  static async deleteByJobId(req, res) {

    let agendaWrapper = await AgendaWrapper.instance();
    let agenda = agendaWrapper.agenda;
    let jobs = await agenda.jobs({_id: req.params.job_id}); // eslint-disable-line new-cap
    if (!jobs || jobs.length === 0) {
      return expressResult.error(res, 'Job not found');
    }
    if (jobs.length > 1) {
      return expressResult.error(res, 'More than one job found');
    }
    let job = jobs[0];
    if (job.attrs.data.user_id !== req.user.user_id) {
      return expressResult.unauthorized(res, 'Current user is not allowed to perform this action');
    }
    await job.remove();
    return expressResult.ok(res, 'Successfully deleted');

  }

  static async deleteByTenantId(req, res) {

    let {tenant_id} = req.params;

    if (tenant_id !== req.user.tenant_id) {
      return expressResult.unauthorized(res, 'Current user is not allowed to perform this action (`tenant_id` not matching).');
    }

    let agendaWrapper = await AgendaWrapper.instance();
    let agenda = agendaWrapper.agenda;

    await agenda.cancel(
      {
        'data.tenant_id': tenant_id
      }
    );
    return expressResult.ok(res);

  }

  /**
   * Delete a job by:
   * - tenant_id - xxx
   * - user_id - xxx
   * - processor - e.g. nats.publish
   * - job_identifier - e.g. strategy-heartbeat_every_week
   **/
  static async deleteByUserAndJobIdentifier(req /* , res */) {

    // Todo: Test if the user is legitimated to delete this record

    let name = req.body.processor;
    let user_id = req.user.user_id;
    // let tenant_id = req.user.tenant_id;
    let job_identifier = req.body.job_identifier;

    let agendaWrapper = await AgendaWrapper.instance();
    let agenda = agendaWrapper.agenda;

    await agenda.cancel(
      {
        name: name,
        'data.user_id': user_id,
        'data.job_identifier': job_identifier
      }
    );
    // Todo(AAA): missing result here
  }

  static async deleteAll(req, res) {

    let {roles} = req.user;
    if (!roles || roles.indexOf('system') === -1) {
      return expressResult.unauthorized(res, {message: 'Can only be performed by users with the role `system`.'});
    }

    let agendaWrapper = await AgendaWrapper.instance();
    let agenda = agendaWrapper.agenda;
    let result;
    try {
      result = await agenda.cancel();
    } catch (err) {
      return expressResult.error(res, err);
    }
    return expressResult.ok(res, {numRemoved: result.numRemoved});

  }

  /**
   * Deletes all jobs for the given user.
   * @param req
   * @param res
   * @returns {Promise<*>}
   */
  static async deleteMine(req, res) {
    let {user_id} = req.user;

    let agendaWrapper = await AgendaWrapper.instance();
    let agenda = agendaWrapper.agenda;

    await agenda.cancel(
      {
        'data.user_id': user_id
      }
    );
    return expressResult.ok(res);
  }

  static async _deleteAll(req, res) {

    if (!req.user || !req.user.roles || req.user.roles.indexOf('system') === -1) {
      return expressResult.unauthorized(res, {message: 'Can only be performed by users with the role `system`.'});
    }

    try {
      await AgendaController._removeAll();
    } catch (e) {
      expressResult.error(res, e);
    }
    expressResult.ok(res);
  }

  static async _removeAll() {

    let agendaWrapper = await AgendaWrapper.instance();
    let agenda = agendaWrapper.agenda;
    const jobs = await agenda.jobs();

    await Promise.all(jobs.map(async job => {
      try {
        await job.remove();
      } catch (e) {
        console.error('Error deleting a job', e);
      }
    }));
  }

  static async countMine(req, res) {
    let {user_id, tenant_id} = req.user;

    let agendaWrapper = await AgendaWrapper.instance();
    let agenda = agendaWrapper.agenda;
    const jobs = await agenda.jobs({'data.tenant_id': tenant_id, 'data.user_id': user_id});

    return expressResult.ok(res, {
      tenant_id,
      user_id,
      count: jobs.length
    });
  }

  /**
   * Just an overall count of all jobs being stored.
   */
  static async _count() {
    let agendaWrapper = await AgendaWrapper.instance();
    let agenda = agendaWrapper.agenda;
    const jobs = await agenda.jobs();
    return jobs.length;
  }

  static _validateJob(job) {

    let errors = [];
    let requiredArgs = [
      'user_id',
      'tenant_id',
      'job_identifier',
      'processor',
      'repeatPattern'
    ];
    requiredArgs.forEach(arg => {
      if (!job[arg]) {
        errors.push(`Argument '${arg}' cannot be null or empty.`);
      }
    });
    return errors;
  }

  /**
   * Map the contents of the request body to what is required by agenda.
   *
   * @description
   * Explicitly pick the object we need, don't allow other items to be persisted.
   *
   * @private
   */
  static _mapJobInput(job) {
    return job; // Just let it through for now ...
    // return _.pick(job, [
    //   'processor',
    //   'user_id',
    //   'tenant_id',
    //   'job_identifier'
    // ]);
  }

  static _mapJobOutput(job) {

    // Todo: Remove console.log
    // console.log('_mapJobOutput:job', job);

    return {
      // raw: job, // Todo: probably to removed
      job_id: job.attrs._id,
      tenant_id: job.attrs.data.tenant_id,
      user_id: job.attrs.data.user_id,
      processor: job.attrs.name,
      job_identifier: job.attrs.data.job_identifier,
      repeatPattern: job.attrs.data.repeatPattern,
      data: _.omit(job.attrs.data, ['processor', 'user_id', 'tenant_id', 'job_identifier']) // Do not expose the object already being rolled up ...
    };
  }

}

module.exports = AgendaController;
