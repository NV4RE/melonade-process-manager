import { AdminClient, KafkaConsumer, Producer } from 'node-rdkafka';
import * as config from '../config';
import { jsonTryParse } from '../utils/common';
import { ITask } from '../task';
import { IWorkflow } from '../workflow';
import { ITaskUpdate, IWorkflowUpdate, ITransactionUpdate } from '../state';
import { ITransaction } from '../transaction';

export interface kafkaConsumerMessage {
  value: Buffer;
  size: number;
  key: string;
  topic: string;
  offset: number;
  partition: number;
}

export interface IEvent {
  transactionId: string;
  type: 'TRANSACTION' | 'WORKFLOW' | 'TASK' | 'SYSTEM';
  details?:
    | ITransaction
    | IWorkflow
    | ITask
    | ITransactionUpdate
    | IWorkflowUpdate
    | ITaskUpdate;
  timestamp: number;
  isError: boolean;
  error?: string;
}

export const adminClient = AdminClient.create(config.kafkaAdminConfig);
export const stateConsumerClient = new KafkaConsumer(
  config.kafkaTaskConfig.config,
  config.kafkaTaskConfig.topic,
);
export const systemConsumerClient = new KafkaConsumer(
  config.kafkaSystemTaskConfig.config,
  config.kafkaSystemTaskConfig.topic,
);
export const producerClient = new Producer(
  config.kafkaProducerConfig.config,
  config.kafkaProducerConfig.topic,
);

stateConsumerClient.setDefaultConsumeTimeout(1);
stateConsumerClient.connect();
stateConsumerClient.on('ready', () => {
  console.log('State consumer kafka is ready');
  stateConsumerClient.subscribe([config.kafkaTopicName.event]);
});

stateConsumerClient.setDefaultConsumeTimeout(1);
systemConsumerClient.connect();
systemConsumerClient.on('ready', () => {
  console.log('System consumer kafka is ready');
  systemConsumerClient.subscribe([config.kafkaTopicName.systemTask]);
});

producerClient.connect();
producerClient.on('ready', () => {
  console.log('Producer kafka is ready');
});

export const createTopic = (topicName: string): Promise<any> =>
  new Promise((resolve: Function, reject: Function) => {
    adminClient.createTopic(
      {
        topic: `${config.kafkaTopicName.task}.${topicName}`,
        num_partitions: 10,
        replication_factor: 1,
        config: {
          'cleanup.policy': 'compact',
          'compression.type': 'snappy',
          'delete.retention.ms': '86400000',
          'file.delete.delay.ms': '60000',
        },
      },
      (error: Error, data: any) => {
        if (error) return reject(error);
        resolve(data);
      },
    );
  });

export const poll = (
  consumer: KafkaConsumer,
  messageNumber: number = 100,
): Promise<any[]> =>
  new Promise((resolve: Function, reject: Function) => {
    consumer.consume(
      messageNumber,
      (error: Error, messages: kafkaConsumerMessage[]) => {
        if (error) return reject(error);
        resolve(
          messages.map((message: kafkaConsumerMessage) =>
            jsonTryParse(message.value.toString(), {}),
          ),
        );
      },
    );
  });

export const dispatch = (
  task: ITask,
  transactionId: string,
  isSystemTask: boolean = false,
) =>
  producerClient.produce(
    isSystemTask
      ? config.kafkaTopicName.systemTask
      : `${config.kafkaTopicName.task}.${task.taskName}`,
    null,
    Buffer.from(JSON.stringify(task)),
    transactionId,
    Date.now(),
  );

// Use to send Retry, Failed, Reject event, Completed workflow, Dispatch task
export const sendEvent = (event: IEvent) =>
  producerClient.produce(
    config.kafkaTopicName.store,
    null,
    Buffer.from(JSON.stringify(event)),
    event.transactionId,
    Date.now(),
  );

export const flush = (timeout: number = 1000) =>
  new Promise((resolve: Function, reject: Function) => {
    producerClient.flush(timeout, (error: Error) => {
      if (error) return reject(error);
      resolve();
    });
  });
