import * as cdk from '@aws-cdk/core';
import * as regionInfo from '@aws-cdk/region-info';
import { VpcFlowLogsEsStack } from './src/vpc-flow-logs-es-stack'

// regional endpoints override see: https://gist.github.com/bnusunny/090e65be682b4703b72b41e4f648c51c

regionInfo.Fact.register({
    region: 'cn-northwest-1',
    name: regionInfo.FactName.servicePrincipal('s3'),
    value: 's3.amazonaws.com',
}, true);

regionInfo.Fact.register({
    region: 'cn-northwest-1',
    name: regionInfo.FactName.servicePrincipal('lambda'),
    value: 'lambda.amazonaws.com',
}, true);

regionInfo.Fact.register({
    region: 'cn-northwest-1',
    name: regionInfo.FactName.servicePrincipal('firehose'),
    value: 'firehose.amazonaws.com',
}, true);

//------------

const app = new cdk.App()

new VpcFlowLogsEsStack(app, 'VpcFlowLogsEsStack', {
    env: {
        region: 'cn-northwest-1'
    }
})