export default {
  stack: {
    id: 'aws-cdk-demo-1',
  },
  cluster: {
    vpc: {
      id: 'vpc-1',
      name: 'starter-vpc',
    },
    ecsCluster: {
      id: 'ecs-cluster-1',
    },
  },
  server: {
    securityGroup: {
      id: 'server-sg',
    },
    port: 3000,
    environmentVariables: {},
    iamRole: {
      id: 'server-role',
    },
    loadBalancer: {
      id: 'server-lb',
      certificateArn: '<Certificate ARN>',
    },
    ecr: {
      repoId: 'ecr-repo-1',
    },
  },
  pipeline: {
    id: 'pipeline-1',
    source: {
      github: {
        owner: 'AceTheNinja',
        repo: 'aws-cdk-nestjs-starter',
        tokenSecretName: 'GITHUB_TOKEN',
        branch: 'master',
      },
    },
    build: {
      id: 'build-1',
    },
  },
};
