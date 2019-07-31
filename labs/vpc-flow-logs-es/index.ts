import * as cdk from '@aws-cdk/core'
import { VpcFlowLogsEsStack } from './src/vpc-flow-logs-es-stack'

const app = new cdk.App()

new VpcFlowLogsEsStack(app, 'VpcFlowLogsEsStack', {
    env: {
        region: 'cn-northwest-1'
    }
})