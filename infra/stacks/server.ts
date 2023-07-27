import { Construct } from 'constructs';
import {
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_ecr as ecr,
  aws_certificatemanager as acm,
  aws_iam as iam,
  CfnOutput,
  Duration,
  aws_ecs_patterns as ecsPatterns,
} from 'aws-cdk-lib';

import { Cluster } from './cluster';
import { Protocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';

import env from '../env';

interface WebAppProps {
  readonly cluster: Cluster;
}

class WebApp extends Construct {
  private fargateService: ecsPatterns.ApplicationLoadBalancedFargateService;

  public readonly service: ecs.IBaseService;
  public readonly containerName: string;
  public readonly ecrRepo: ecr.Repository;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: WebAppProps) {
    super(scope, id);

    this.securityGroup = new ec2.SecurityGroup(
      this,
      env.server.securityGroup.id,
      {
        vpc: props.cluster.vpc,
        allowAllOutbound: true,
        description: `security group for server`,
      },
    );

    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(env.server.port),
      'Ingress rule for webserver',
    );

    this.fargateService = this.createService(props.cluster.ecsCluster);

    this.ecrRepo = new ecr.Repository(this, env.server.ecr.repoId);
    this.ecrRepo.grantPull(this.fargateService.taskDefinition.executionRole);
    this.service = this.fargateService.service;
    this.containerName =
      this.fargateService.taskDefinition.defaultContainer.containerName;

    this.addAutoScaling();
    this.output();
  }

  private createService(cluster: ecs.Cluster) {
    // Creates a new ECS service
    const server = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'Service',
      {
        // The cluster in which to create this service
        cluster: cluster,
        // The number of tasks to run
        desiredCount: 1,
        // The image to use when running the tasks
        taskImageOptions: {
          image: ecs.ContainerImage.fromAsset('.'),
          containerPort: env.server.port,
          environment: env.server.environmentVariables,
          enableLogging: true,
          taskRole: new iam.Role(this, env.server.iamRole.id, {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            managedPolicies: [
              iam.ManagedPolicy.fromAwsManagedPolicyName(
                'CloudWatchFullAccess',
              ),
            ],
          }),
        },
        // The load balancer to use
        publicLoadBalancer: true,
        // The certificate to use for HTTPS
        certificate: acm.Certificate.fromCertificateArn(
          this,
          env.server.loadBalancer.id,
          env.server.loadBalancer.certificateArn,
        ),
        // The type of DNS record to use
        recordType: ecsPatterns.ApplicationLoadBalancedServiceRecordType.CNAME,
        // The security group to use
        securityGroups: [this.securityGroup],
      },
    );

    // Enable cookie stickiness on the target group
    server.targetGroup.enableCookieStickiness(Duration.days(1));

    // Configure the health check
    server.targetGroup.configureHealthCheck({
      path: '/',
      unhealthyThresholdCount: 5,
      protocol: Protocol.HTTP,
      port: '3006',
    });

    return server;
  }

  // Add autoscaling to the Fargate service
  private addAutoScaling() {
    const autoScalingGroup = this.fargateService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 3,
    });
    autoScalingGroup.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60),
    });
  }

  // Create an AWS CloudFormation output for the Amazon ECR repository name and ARN
  private output() {
    new CfnOutput(this, 'ECRRepo_ARN', { value: this.ecrRepo.repositoryArn });
    new CfnOutput(this, 'ContainerName', { value: this.containerName });
  }
}

export { WebApp, WebAppProps };
