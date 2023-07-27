import { Construct } from 'constructs';

import { aws_ecs as ecs, aws_ec2 as ec2, CfnOutput } from 'aws-cdk-lib';
import env from '../env';

class Cluster extends Construct {
  readonly ecsCluster: ecs.Cluster;
  readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    // Create a new VPC
    this.vpc = new ec2.Vpc(this, env.cluster.vpc.id, {
      vpcName: env.cluster.vpc.name,
    });

    // Creates a new ECS cluster in the VPC created above.
    this.ecsCluster = new ecs.Cluster(this, env.cluster.ecsCluster.id, {
      vpc: this.vpc,
    });

    this.output();
  }

  output() {
    // create a cloudformation output for the ARN of the ECS cluster
    new CfnOutput(this, 'ECSCluster_ARN', {
      value: this.ecsCluster.clusterArn,
    });
  }
}

export { Cluster };
