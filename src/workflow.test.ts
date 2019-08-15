import { Workflow } from './workflow';
import { WorkflowDefinition } from './workflowDefinition';
import { TaskTypes } from './constants/task';

jest.mock('uuid/v4');
Date.now = jest.fn();

describe('Workflow', () => {
  describe('Workflow', () => {
    const workflowDefinition = new WorkflowDefinition({
      name: 'WORKFLOW_001',
      rev: '1',
      tasks: [
        {
          name: 'TASK_1',
          taskReferenceName: 'TASK_1',
          type: TaskTypes.Task,
          inputParameters: {},
        },
        {
          name: 'TASK_2',
          taskReferenceName: 'TASK_2',
          type: TaskTypes.Task,
          inputParameters: {},
        },
      ],
    });
    const simpleWorkflow = new Workflow(workflowDefinition, {});

    test('Simple Workflow', () => {
      expect(simpleWorkflow.toObject()).toEqual({
        createTime: undefined,
        endTime: null,
        input: {},
        retryCount: 0,
        startTime: undefined,
        status: 'RUNNING',
        workflowId: undefined,
        workflowName: 'WORKFLOW_001',
        workflowRev: '1',
      });
    });

    test('Start first task', () => {
      expect(async () => await simpleWorkflow.startTask()).not.toThrow();
    });
  });
});
