import * as mongoose from 'mongoose';
import { Workflow, Task, State, Event } from '@melonade/melonade-declaration';
import * as mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import { MongooseStore } from '../mongoose';
import { IWorkflowInstanceStore, taskInstanceStore } from '../../store';

const workflowSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      index: true,
    },
    transactionId: {
      index: true,
      type: String,
    },
    type: String,
    retries: Number,
    input: mongoose.Schema.Types.Mixed,
    output: mongoose.Schema.Types.Mixed,
    createTime: Number,
    startTime: Number,
    endTime: Number,
    workflowDefinition: {
      name: String,
      rev: String,
      description: String,
      tasks: [
        {
          _id: false,
          inputParameters: mongoose.Schema.Types.Mixed,
          name: String,
          taskReferenceName: String,
          type: {
            type: String,
            enum: Task.TaskTypesList,
            required: true,
          },
          defaultDecision: [mongoose.Schema.Types.Mixed],
          decisions: mongoose.Schema.Types.Mixed,
          parallelTasks: [[mongoose.Schema.Types.Mixed]],
          workflow: {
            name: String,
            rev: String,
          },
          retry: {
            limit: Number,
            delay: Number,
          },
        },
      ],
      failureStrategy: String,
      retry: {
        limit: Number,
        delay: Number,
      },
      recoveryWorkflow: {
        name: String,
        rev: String,
      },
      outputParameters: mongoose.Schema.Types.Mixed,
    },
    childOf: {
      type: String,
      index: true,
    },
  },
  {
    toObject: {
      virtuals: true,
    },
    toJSON: {
      virtuals: true,
    },
  },
);

workflowSchema
  .virtual('workflowId')
  .get(function() {
    return this._id;
  })
  .set(function() {
    return this._id;
  });

workflowSchema.plugin(mongooseLeanVirtuals);

export class WorkflowInstanceMongoseStore extends MongooseStore
  implements IWorkflowInstanceStore {
  constructor(uri: string, mongoOption: mongoose.ConnectionOptions) {
    super(uri, mongoOption, 'workflow-instance', workflowSchema);
  }

  get = async (workflowId: string): Promise<Workflow.IWorkflow> => {
    return this.model
      .findOne({ _id: workflowId })
      .lean({ virtuals: true })
      .exec();
  };

  create = async (
    workflowData: Workflow.IWorkflow,
  ): Promise<Workflow.IWorkflow> => {
    return {
      ...workflowData,
      ...(await this.model.create(workflowData)).toObject(),
    };
  };

  update = async (
    workflowUpdate: Event.IWorkflowUpdate,
  ): Promise<Workflow.IWorkflow> => {
    return this.model
      .findOneAndUpdate(
        {
          _id: workflowUpdate.workflowId,
          status: State.WorkflowPrevStates[workflowUpdate.status],
        },
        {
          status: workflowUpdate.status,
          output: workflowUpdate.output,
          endTime: [
            State.WorkflowStates.Completed,
            State.WorkflowStates.Failed,
            State.WorkflowStates.Timeout,
            State.WorkflowStates.Cancelled,
          ].includes(workflowUpdate.status)
            ? Date.now()
            : null,
        },
        {
          new: true,
        },
      )
      .lean({ virtuals: true })
      .exec();
  };

  delete = (workflowId: string): Promise<any> =>
    this.model
      .deleteOne({ _id: workflowId })
      .lean({ virtuals: true })
      .exec();

  getByTransactionId = (transactionId: string): Promise<Workflow.IWorkflow> =>
    this.model
      .findOne({
        transactionId,
        status: State.WorkflowStates.Running,
        type: Workflow.WorkflowTypes.Workflow,
        childOf: { $exists: false },
      })
      .lean({ virtuals: true })
      .exec();

  deleteAll = async (transactionId: string): Promise<void> => {
    const workflows = await this.model
      .find({
        transactionId,
      })
      .lean({ virtuals: true })
      .exec();

    await Promise.all([
      this.model
        .deleteMany({
          transactionId,
        })
        .lean()
        .exec(),
      ...workflows.map(workflow =>
        taskInstanceStore.deleteAll(workflow.workflowId),
      ),
    ]);
  };
}
