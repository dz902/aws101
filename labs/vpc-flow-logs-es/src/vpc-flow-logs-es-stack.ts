import * as cdk from '@aws-cdk/core'
import * as logs from '@aws-cdk/aws-logs'
import * as es from '@aws-cdk/aws-elasticsearch'
import * as s3 from '@aws-cdk/aws-s3'
import * as lambda from '@aws-cdk/aws-lambda'
import { S3EventSource } from '@aws-cdk/aws-lambda-event-sources'
import * as firehose from '@aws-cdk/aws-kinesisfirehose'
import * as iam from '@aws-cdk/aws-iam'
import { log } from 'util';
import { Resource } from '@aws-cdk/core';

/* 
  VPC Flow Logs Visualization with Amazon Elasticsearch Service
  - S3 to store VPC Flow Logs (gzipped / grouped)
  - S3 Notification to trigger Lambda
  - Lambda to read file, gunzip, convert, send to firehose
  - Firehose to cache logs and send to Elasticsearch 
  - Elasticsearch to store and visualize logs
  - IAM permissions
    - S3 bucket resource policy allows 'log delivery' (auto added)
    - Lambda role allows 'read file from bucket' and 'write to kinesis'
    - Firehose can access the Elasticsearch domain
*/
export class VpcFlowLogsEsStack extends cdk.Stack {
  private esDomain: string = 'vpc-flow-logs'

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // ES

    const flowLogsEs = new es.CfnDomain(this, 'FlowLogsEs', {
      domainName: this.esDomain,
      nodeToNodeEncryptionOptions: { enabled: false },
      elasticsearchVersion: '6.7',
      ebsOptions: {
        ebsEnabled: true,
        volumeSize: 10
      },
      elasticsearchClusterConfig: {
        instanceType: 't2.small.elasticsearch',
        instanceCount: 1,
        zoneAwarenessEnabled: false
      },
                            
    })

    // FIREHOSE

    const queueErrorLogGroup = new logs.LogGroup(this, 'ErrorLogGroup', {
      logGroupName: '/aws/kinesisfirehose/vpc-flow-logs-errors',
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    const queueEsErrorLogStream = queueErrorLogGroup.addStream('QueueEsErrorLogStream', {
      logStreamName: 'EsError'
    })

    const queueS3ErrorLogStream = queueErrorLogGroup.addStream('QueueS3ErrorStream', {
      logStreamName: 'S3Error'
    })

    const queueRole = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com')
    })

    const esArn = this.formatArn({
      service: 'es',
      resource: 'domain',
      resourceName: this.esDomain
    })

    queueRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'es:DescribeElasticsearchDomain',
          'es:DescribeElasticsearchDomains',
          'es:DescribeElasticsearchDomainConfig',
          'es:ESHttpPost',
          'es:ESHttpPut',
          'es:ESHttpGet'
        ],
        resources: [
          esArn,
          `${esArn}/*`
        ]
      })
    )

    queueRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:PutLogEvents'
        ],
        resources: [queueErrorLogGroup.logGroupArn]
      })
    )

    const queueBackupBucket = new s3.Bucket(this, 'BackupBucket')

    const queueBackupBucketRaw = queueBackupBucket.node.defaultChild as s3.CfnBucket

    queueBackupBucketRaw.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)

    const queue:any = new firehose.CfnDeliveryStream(this, 'Queue'  , {
      deliveryStreamName: 'vpc-flow-logs-queue',
      elasticsearchDestinationConfiguration: {
        roleArn: queueRole.roleArn,
        domainArn: flowLogsEs.attrArn,
        indexName: 'flow-logs',
        indexRotationPeriod: 'OneDay',
        typeName: 'logs',
        retryOptions: { durationInSeconds: 300 },
        s3BackupMode: 'FailedDocumentsOnly',
        s3Configuration: {
          roleArn: queueRole.roleArn,
          compressionFormat: 'GZIP',
          bucketArn: queueBackupBucket.bucketArn,
          bufferingHints: {
            sizeInMBs: 5,
            intervalInSeconds: 300
          },
          cloudWatchLoggingOptions: {
            enabled: true,
            logGroupName: queueErrorLogGroup.logGroupName,
            logStreamName: queueS3ErrorLogStream.logStreamName
          }
        },
        bufferingHints: {
          sizeInMBs: 5,
          intervalInSeconds: 300
        },
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: queueErrorLogGroup.logGroupName,
          logStreamName: queueEsErrorLogStream.logStreamName
        }
      }
    })

  const flowLogsEsAccessPolicies = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: iam.Effect.ALLOW,
          Principal: {
            AWS: queueRole.roleArn
          },
          Action: [
            'es:DescribeElasticsearchDomain',
            'es:DescribeElasticsearchDomains',
            'es:DescribeElasticsearchDomainConfig',
            'es:ESHttpPost',
            'es:ESHttpPut',
            'es:ESHttpGet'
          ],
          Resource: `${esArn}/*` 
        },
        {
          Effect: iam.Effect.ALLOW,
          Principal: {
            AWS: '*'
          },
          Action: [
            'es:*'
          ],
          Condition: {
            IpAddress: {
              'aws:SourceIp': [
                '192.168.1.1/32'
              ]
            }
          },
          Resource: `${esArn}/*` 
        }
      ]
    }

    flowLogsEs.accessPolicies = flowLogsEsAccessPolicies

    // FLOW LOGS BUCKET

    const flowLogsBucket = new s3.Bucket(this, 'Bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    })

    // LAMBDA

    const extractorFunctionName = 'flowLogsExtractor'

    const bucketObjectCreationEvent = new S3EventSource(flowLogsBucket, {
      events: [ s3.EventType.OBJECT_CREATED ]
    })

    const extractorLogGroup = new logs.LogGroup(this, 'ExtractorLogGroup', {
      logGroupName: `/aws/lambda/${extractorFunctionName}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    const extractorRole = new iam.Role(this, 'ExtractorRole', {
      roleName: 'flowLogsExtractorRole',
      managedPolicies: [
         iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        'firehose': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['firehose:PutRecordBatch'],
              resources: [queue.attrArn]
            })
          ]
        })
      },
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    })

    flowLogsBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject*'],
      resources: [`${flowLogsBucket.bucketArn}/*`],
      principals: [extractorRole]
    }))

    const extractor = new lambda.Function(this, 'Extractor', {
      functionName: extractorFunctionName,
      runtime: lambda.Runtime.NODEJS_10_X,
      handler: 'index.handler',
      code: lambda.Code.asset(__dirname + '/extract-s3-flow-logs'),
      role: extractorRole,
      events: [bucketObjectCreationEvent]
    })
  }
}