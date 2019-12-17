# VPC Flow Logs / CDK 演示

## 免责声明

仅供参考。本篇文章中所提供的代码仅为教学、说明之用，无意直接用于任何生产环境。代码为个人研究所写，不能确保一定可用、有效，也不能确保所有潜在的安全问题都考虑到。如有需要，敬请酌情在非重要环境及非重要数据上试用，并按照自己实际需求对代码进行进一步的调整、修改、补充。我们不对文中代码的任何层面做任何保障，也不承担因为使用代码而造成的任何后果。
 
潜在费用。使用这篇文章中的 CDK 代码将会部署一些服务资源，包括 Amazon S3、Amazon Elasticsearch Service、Amazon CloudWatch、AWS Lambda、Amazon Kinesis 等等。读者应该了解并接受这些服务的收费模式，并在试用完成后注意及时停用、关闭资源，删除 AWS CloudFormation （下简称CFn）中生成的 Stack，避免持续产生费用。我们无法对实际资源使用产生的费用负责。

## 使用方式

### 准备工作

开始安装前，请确保系统已满足如下条件：

- 有 `npm` 或者 `yarn` 工具
- 有 AWS 命令行工具
- 已配置好 AWS 的 Access Key ID 及 Access Secret Key （可运行 `aws configure` 命令来设置）

### 安装依赖

在本目录下运行 `npm install` 或 `yarn install`。

### 运行 CDK

- 使用 `npm run cdk synth` 命令，转译 CDK 模板
- 使用 `npm run cdk deploy` 命令，部署转译好的 CloudFormation 模板

### 删除资源

部署成功后，可在 CloudFormation 中看到已经部署的 Stack。实验完成后，记得删除 Stack，避免持续产生费用。

